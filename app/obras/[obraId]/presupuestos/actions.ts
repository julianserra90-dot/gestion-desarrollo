"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { convertirMonto } from "@/lib/dolar";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { leerItems, sumaDeItems } from "@/lib/items-material";
import type { ItemMaterial } from "@/lib/items-material";
import { createClient } from "@/lib/supabase/server";

type PresupuestoUpdate = Database["public"]["Tables"]["presupuestos"]["Update"];

/**
 * Los materiales los cotiza un proveedor; la mano de obra —sola o junto con
 * los materiales— la cotiza un contratista.
 */
function tipoProveedorPara(tipo: string) {
  return tipo === "Mano de obra" || tipo === "Mano de obra y materiales"
    ? "Contratista"
    : "Proveedor";
}

/**
 * Resuelve quién cotiza.
 *
 * Si el formulario mandó uno nuevo se crea, o se reutiliza el que ya exista con
 * ese nombre y tipo. Es el mismo catálogo que usan los gastos: aprobar una
 * cotización tiene que dejar al gremio listo para elegir cuando llegue la
 * factura.
 */
async function resolverProveedor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  tipo: string
): Promise<{ id: string | null; error?: string }> {
  const nuevo = String(formData.get("proveedor_nuevo") ?? "").trim();
  const seleccionado = String(formData.get("proveedor_id") ?? "");

  if (!nuevo) {
    return { id: seleccionado && !seleccionado.startsWith("__") ? seleccionado : null };
  }

  const tipoProveedor = tipoProveedorPara(tipo);

  const { data: existente } = await supabase
    .from("proveedores")
    .select("id")
    .eq("nombre", nuevo)
    .eq("tipo", tipoProveedor)
    .maybeSingle();

  if (existente) return { id: existente.id };

  const { data: creado, error } = await supabase
    .from("proveedores")
    .insert({ nombre: nuevo, tipo: tipoProveedor })
    .select("id")
    .single();

  if (error || !creado) {
    return { id: null, error: error?.message ?? "No se pudo crear el proveedor." };
  }

  return { id: creado.id };
}

function leerFormulario(formData: FormData) {
  return {
    rubroId: String(formData.get("rubro_id") ?? ""),
    tipo: String(formData.get("tipo") ?? "Materiales"),
    numero: String(formData.get("numero") ?? "").trim(),
    fecha: String(formData.get("fecha") ?? "").trim(),
    validez: String(formData.get("validez_hasta") ?? "").trim(),
    monto: Number(formData.get("monto") ?? 0),
    desdeItems: formData.get("monto_desde_items") === "on",
    moneda: String(formData.get("moneda") ?? "ARS"),
    detalle: String(formData.get("detalle") ?? "").trim(),
    observaciones: String(formData.get("observaciones") ?? "").trim(),
    comprobante: formData.get("comprobante"),
  };
}

/**
 * Los items que cotizó el proveedor, guardados reemplazando los anteriores.
 *
 * Mismo criterio que el detalle del gasto: borrar y volver a insertar es más
 * simple que averiguar qué cambió, y no se pierde nada —no tienen historia
 * propia y nadie referencia sus `id`—.
 *
 * Sólo un presupuesto de materiales los lleva: la mano de obra no se desglosa
 * en items.
 */
async function guardarItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  presupuestoId: string,
  items: ItemMaterial[]
) {
  const { error: errorBorrado } = await supabase
    .from("presupuesto_materiales")
    .delete()
    .eq("presupuesto_id", presupuestoId);

  if (errorBorrado) return errorBorrado.message;
  if (items.length === 0) return null;

  const { error } = await supabase
    .from("presupuesto_materiales")
    .insert(items.map((item) => ({ ...item, presupuesto_id: presupuestoId })));

  return error?.message ?? null;
}

function itemsDelPresupuesto(formData: FormData, tipo: string): ItemMaterial[] {
  return tipo === "Materiales" ? leerItems(formData) : [];
}

/**
 * El monto cotizado, que puede salir de sumar los items.
 *
 * Se recalcula acá y no se confía en el campo del formulario: llega de sólo
 * lectura, pero llega igual, y el número que vale es el de los renglones.
 */
function montoCotizado(
  campos: ReturnType<typeof leerFormulario>,
  items: ItemMaterial[]
) {
  return campos.desdeItems ? sumaDeItems(items) : campos.monto;
}

function validar(campos: ReturnType<typeof leerFormulario>, monto: number) {
  if (!campos.rubroId) return "Elegí a qué rubro corresponde la cotización.";
  if (!campos.fecha) return "Poné la fecha de la cotización.";
  if (!Number.isFinite(monto) || monto <= 0) {
    return campos.desdeItems
      ? "El monto sale de sumar los materiales, y hoy suman cero: cargá los items con su precio, o destildá la casilla para escribirlo a mano."
      : "El monto cotizado tiene que ser mayor a cero.";
  }
  return null;
}

export async function crearPresupuesto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const campos = leerFormulario(formData);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/presupuestos/nuevo?error=${encodeURIComponent(mensaje)}`
    );

  const items = itemsDelPresupuesto(formData, campos.tipo);
  const monto = montoCotizado(campos, items);

  const invalido = validar(campos, monto);
  if (invalido) volver(invalido);

  const supabase = await createClient();

  const proveedor = await resolverProveedor(supabase, formData, campos.tipo);
  if (proveedor.error) volver(proveedor.error);

  if (!proveedor.id) {
    volver(
      campos.tipo === "Mano de obra"
        ? "Elegí qué contratista cotizó."
        : "Elegí qué proveedor cotizó."
    );
    return;
  }

  // El comprobante es opcional. Si vino, se sube a Drive antes de guardar.
  let archivo: Awaited<ReturnType<typeof subirArchivo>> | null = null;
  if (campos.comprobante instanceof File && campos.comprobante.size > 0) {
    archivo = await subirArchivo({
      archivo: campos.comprobante,
      nombre: campos.comprobante.name,
      obraSlug: slug,
      tipo: "documentos",
    }).catch((e) => {
      volver(`No se pudo subir la cotización: ${e instanceof Error ? e.message : "error"}`);
      return null;
    });
  }

  const montos = await convertirMonto(monto, campos.moneda, campos.fecha);

  if (!montos.ok) {
    if (archivo) await eliminarArchivo(archivo.id).catch(() => {});
    volver(montos.error);
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Vuelve el `id` porque los items cuelgan de él: sin eso habría que salir a
  // buscar el presupuesto recién creado.
  const { data: creado, error } = await supabase
    .from("presupuestos")
    .insert({
      obra_id: obraId,
      rubro_id: campos.rubroId,
      tipo: campos.tipo,
      numero: campos.numero === "" ? null : campos.numero,
      monto_desde_items: campos.desdeItems,
      proveedor_id: proveedor.id,
      fecha: campos.fecha,
      validez_hasta: campos.validez === "" ? null : campos.validez,
      monto: montos.ars,
      monto_usd: montos.usd,
      cotizacion: montos.cotizacion,
      moneda: campos.moneda,
      detalle: campos.detalle === "" ? null : campos.detalle,
      observaciones: campos.observaciones === "" ? null : campos.observaciones,
      cargado_por: user?.id ?? null,
      comprobante_drive_id: archivo?.id ?? null,
      comprobante_nombre: archivo?.nombre ?? null,
      comprobante_mime: archivo?.mimeType ?? null,
      comprobante_tamano: archivo?.tamano ?? null,
    })
    .select("id")
    .single();

  if (error || !creado) {
    if (archivo) await eliminarArchivo(archivo.id).catch(() => {});
    volver(error?.message ?? "No se pudo guardar la cotización.");
    return;
  }

  const problema = await guardarItems(
    supabase,
    creado.id,
    items
  );

  if (problema) volver(`La cotización se guardó, pero el detalle no: ${problema}`);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/presupuestos`);
}

export async function actualizarPresupuesto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("presupuesto_id") ?? "");
  const quitarComprobante = formData.get("quitar_comprobante") === "on";
  const campos = leerFormulario(formData);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/presupuestos/${id}/editar?error=${encodeURIComponent(mensaje)}`
    );

  const items = itemsDelPresupuesto(formData, campos.tipo);
  const monto = montoCotizado(campos, items);

  const invalido = validar(campos, monto);
  if (invalido) volver(invalido);

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("presupuestos")
    .select("comprobante_drive_id, estado")
    .eq("id", id)
    .maybeSingle();

  if (!actual) {
    volver("No se encontró la cotización.");
    return;
  }

  const proveedor = await resolverProveedor(supabase, formData, campos.tipo);
  if (proveedor.error) volver(proveedor.error);

  if (!proveedor.id) {
    volver("Elegí quién cotizó.");
    return;
  }

  const montos = await convertirMonto(monto, campos.moneda, campos.fecha);
  if (!montos.ok) {
    volver(montos.error);
    return;
  }

  const cambios: PresupuestoUpdate = {
    rubro_id: campos.rubroId,
    tipo: campos.tipo,
    numero: campos.numero === "" ? null : campos.numero,
    monto_desde_items: campos.desdeItems,
    proveedor_id: proveedor.id,
    fecha: campos.fecha,
    validez_hasta: campos.validez === "" ? null : campos.validez,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    moneda: campos.moneda,
    detalle: campos.detalle === "" ? null : campos.detalle,
    observaciones: campos.observaciones === "" ? null : campos.observaciones,
    // Un pedido del cómputo que ya tiene proveedor y precio pasa a ser una
    // cotización como las demás, lista para aprobar.
    ...(actual.estado === "A cotizar" ? { estado: "Pendiente" } : {}),
  };

  let subidoAhora: string | null = null;

  if (campos.comprobante instanceof File && campos.comprobante.size > 0) {
    const nuevo = await subirArchivo({
      archivo: campos.comprobante,
      nombre: campos.comprobante.name,
      obraSlug: slug,
      tipo: "documentos",
    }).catch((e) => {
      volver(`No se pudo subir la cotización: ${e instanceof Error ? e.message : "error"}`);
      return null;
    });

    if (nuevo) {
      subidoAhora = nuevo.id;
      cambios.comprobante_drive_id = nuevo.id;
      cambios.comprobante_nombre = nuevo.nombre;
      cambios.comprobante_mime = nuevo.mimeType;
      cambios.comprobante_tamano = nuevo.tamano;
    }
  } else if (quitarComprobante) {
    cambios.comprobante_drive_id = null;
    cambios.comprobante_nombre = null;
    cambios.comprobante_mime = null;
    cambios.comprobante_tamano = null;
  }

  const { error } = await supabase
    .from("presupuestos")
    .update(cambios)
    .eq("id", id);

  if (error) {
    if (subidoAhora) await eliminarArchivo(subidoAhora).catch(() => {});
    volver(error.message);
  }

  // Si dejó de ser de materiales, el detalle que tenía ya no significa nada:
  // `itemsDelPresupuesto` devuelve vacío y el reemplazo lo borra.
  const problema = await guardarItems(
    supabase,
    id,
    items
  );

  if (problema) volver(`La cotización se guardó, pero el detalle no: ${problema}`);

  const seReemplazo = subidoAhora && actual.comprobante_drive_id;
  if ((seReemplazo || quitarComprobante) && actual.comprobante_drive_id) {
    await eliminarArchivo(actual.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/presupuestos`);
}

/**
 * Marca una cotización como aprobada: entra a "lo cotizado" del rubro y tipo.
 *
 * Pueden convivir varias aprobadas para el mismo rubro y tipo —un mismo
 * contratista a veces cotiza en dos papeles, uno por cada parte del
 * alcance—, y "lo cotizado" las suma todas. Queda a criterio de quien aprueba
 * no aprobar dos cotizaciones que se pisan.
 */
export async function aprobarPresupuesto(id: string, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();

  const { error } = await supabase
    .from("presupuestos")
    .update({ estado: "Aprobado" })
    .eq("id", id);

  if (error) volverAListado(slug, error.message);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/presupuestos`);
}

/**
 * Copia una cotización como pedido "A cotizar", para pedirle lo mismo a otro
 * proveedor y comparar. Se lleva rubro, tipo y detalle; el monto queda como
 * referencia y el proveedor en blanco, que es justo lo que cambia.
 */
export async function duplicarPresupuesto(id: string, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();

  const { data: original } = await supabase
    .from("presupuestos")
    .select("obra_id, rubro_id, tipo, detalle, monto")
    .eq("id", id)
    .maybeSingle();

  if (!original) volverAListado(slug, "No se encontró la cotización.");

  const { error } = await supabase.from("presupuestos").insert({
    obra_id: original!.obra_id,
    rubro_id: original!.rubro_id,
    tipo: original!.tipo,
    detalle: original!.detalle,
    monto: original!.monto,
    estado: "A cotizar",
  });

  if (error) volverAListado(slug, error.message);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/presupuestos`);
}

/** Vuelve a dejar la cotización sin elegir: el rubro queda sin aprobada. */
export async function desaprobarPresupuesto(id: string, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();

  const { error } = await supabase
    .from("presupuestos")
    .update({ estado: "Pendiente" })
    .eq("id", id);

  if (error) volverAListado(slug, error.message);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/presupuestos`);
}

export async function eliminarPresupuesto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("presupuesto_id") ?? "");

  const supabase = await createClient();

  const { data: presupuesto } = await supabase
    .from("presupuestos")
    .select("comprobante_drive_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("presupuestos").delete().eq("id", id);

  if (error) {
    redirect(
      `/obras/${slug}/presupuestos/${id}/editar?error=${encodeURIComponent(error.message)}`
    );
  }

  if (presupuesto?.comprobante_drive_id) {
    await eliminarArchivo(presupuesto.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/presupuestos`);
}

/** La columna del rubro que prende cada bloque de cotización. */
const COLUMNA_DEL_TIPO = {
  Materiales: "usa_materiales",
  "Mano de obra": "usa_mano_obra",
  "Mano de obra y materiales": "usa_mano_obra_y_materiales",
  Administrativo: "usa_administrativo",
} as const;

type TipoDeBloque = keyof typeof COLUMNA_DEL_TIPO;

/**
 * Agrega o saca un bloque de cotización del rubro, de a uno.
 *
 * Vive acá y no en la solapa Rubros porque es mirando las cotizaciones donde
 * uno se da cuenta de que un rubro no lleva mano de obra.
 */
export async function cambiarTipoDeRubro(rubroId: string, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoDeBloque;
  const incluir = formData.get("incluir") === "1";
  const columna = COLUMNA_DEL_TIPO[tipo];

  if (!columna) volverAListado(slug, "Ese tipo de cotización no existe.");

  const supabase = await createClient();

  // Hay que mirar las otras para no dejar el rubro sin ninguna: la base lo
  // rechaza, y un rubro sin bloques no serviría para nada.
  const { data: rubro } = await supabase
    .from("rubros")
    .select(
      "usa_materiales, usa_mano_obra, usa_mano_obra_y_materiales, usa_administrativo"
    )
    .eq("id", rubroId)
    .maybeSingle();

  if (!rubro) volverAListado(slug, "No se encontró el rubro.");

  const quedan: Record<string, boolean> = { ...rubro!, [columna]: incluir };

  if (!Object.values(quedan).some(Boolean)) {
    volverAListado(slug, "El rubro tiene que llevar al menos un bloque.");
  }

  // La columna sale de un mapa, así que el tipo tiene que decir cuáles son las
  // cuatro posibles: con una clave calculada a secas queda un índice de string
  // y el update tipado no lo acepta.
  const cambio: Partial<Record<(typeof COLUMNA_DEL_TIPO)[TipoDeBloque], boolean>> =
    { [columna]: incluir };

  const { error } = await supabase.from("rubros").update(cambio).eq("id", rubroId);

  if (error) volverAListado(slug, error.message);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/presupuestos`);
}

function volverAListado(slug: string, texto: string): never {
  redirect(`/obras/${slug}/presupuestos?error=${encodeURIComponent(texto)}`);
}
