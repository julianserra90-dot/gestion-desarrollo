"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { convertirMonto } from "@/lib/dolar";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

type PresupuestoUpdate = Database["public"]["Tables"]["presupuestos"]["Update"];

/** Los materiales los cotiza un proveedor; la mano de obra, un contratista. */
function tipoProveedorPara(tipo: string) {
  return tipo === "Mano de obra" ? "Contratista" : "Proveedor";
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
    fecha: String(formData.get("fecha") ?? "").trim(),
    validez: String(formData.get("validez_hasta") ?? "").trim(),
    monto: Number(formData.get("monto") ?? 0),
    moneda: String(formData.get("moneda") ?? "ARS"),
    detalle: String(formData.get("detalle") ?? "").trim(),
    observaciones: String(formData.get("observaciones") ?? "").trim(),
    comprobante: formData.get("comprobante"),
  };
}

function validar(campos: ReturnType<typeof leerFormulario>) {
  if (!campos.rubroId) return "Elegí a qué rubro corresponde la cotización.";
  if (!campos.fecha) return "Poné la fecha de la cotización.";
  if (!Number.isFinite(campos.monto) || campos.monto <= 0) {
    return "El monto cotizado tiene que ser mayor a cero.";
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

  const invalido = validar(campos);
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

  const montos = await convertirMonto(campos.monto, campos.moneda, campos.fecha);

  if (!montos.ok) {
    if (archivo) await eliminarArchivo(archivo.id).catch(() => {});
    volver(montos.error);
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("presupuestos").insert({
    obra_id: obraId,
    rubro_id: campos.rubroId,
    tipo: campos.tipo,
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
  });

  if (error) {
    if (archivo) await eliminarArchivo(archivo.id).catch(() => {});
    volver(error.message);
  }

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

  const invalido = validar(campos);
  if (invalido) volver(invalido);

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("presupuestos")
    .select("comprobante_drive_id")
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

  const montos = await convertirMonto(campos.monto, campos.moneda, campos.fecha);
  if (!montos.ok) {
    volver(montos.error);
    return;
  }

  const cambios: PresupuestoUpdate = {
    rubro_id: campos.rubroId,
    tipo: campos.tipo,
    proveedor_id: proveedor.id,
    fecha: campos.fecha,
    validez_hasta: campos.validez === "" ? null : campos.validez,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    moneda: campos.moneda,
    detalle: campos.detalle === "" ? null : campos.detalle,
    observaciones: campos.observaciones === "" ? null : campos.observaciones,
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

  const seReemplazo = subidoAhora && actual.comprobante_drive_id;
  if ((seReemplazo || quitarComprobante) && actual.comprobante_drive_id) {
    await eliminarArchivo(actual.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/presupuestos`);
}

/**
 * Marca una cotización como la elegida.
 *
 * De cada rubro y tipo hay una sola aprobada, así que la que estuviera antes
 * vuelve a quedar como pendiente. Se hace en dos pasos porque la base tiene un
 * índice único que impide que haya dos aprobadas a la vez.
 */
export async function aprobarPresupuesto(id: string, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();

  const { data: elegida } = await supabase
    .from("presupuestos")
    .select("obra_id, rubro_id, tipo")
    .eq("id", id)
    .maybeSingle();

  if (!elegida) {
    volverAListado(slug, "No se encontró la cotización.");
    return;
  }

  await supabase
    .from("presupuestos")
    .update({ estado: "Descartado" })
    .eq("obra_id", elegida.obra_id)
    .eq("rubro_id", elegida.rubro_id)
    .eq("tipo", elegida.tipo)
    .eq("estado", "Aprobado");

  const { error } = await supabase
    .from("presupuestos")
    .update({ estado: "Aprobado" })
    .eq("id", id);

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

/**
 * Marca si un rubro lleva materiales, mano de obra o las dos.
 *
 * Vive acá y no en la solapa Rubros porque es mirando las cotizaciones donde
 * uno se da cuenta de que un rubro no lleva mano de obra.
 */
export async function cambiarTiposDeRubro(rubroId: string, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const mat = formData.get("usa_materiales") === "on";
  const mo = formData.get("usa_mano_obra") === "on";

  // Un rubro sin ninguna de las dos no sirve para nada, y la base lo rechaza.
  if (!mat && !mo) {
    volverAListado(
      slug,
      "Un rubro tiene que llevar al menos materiales o mano de obra."
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("rubros")
    .update({ usa_materiales: mat, usa_mano_obra: mo })
    .eq("id", rubroId);

  if (error) volverAListado(slug, error.message);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/presupuestos`);
}

function volverAListado(slug: string, texto: string): never {
  redirect(`/obras/${slug}/presupuestos?error=${encodeURIComponent(texto)}`);
}
