"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizar } from "@/lib/ambitos";
import { eliminarArchivo } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

type Socio = { empresa_id: string; porcentaje: number };

/**
 * Los porcentajes se comparan contra 100 con tolerancia, porque repartir entre
 * 3 empresas da 33,33 + 33,33 + 33,34 y sumas así no dan exactamente 100 en
 * punto flotante.
 */
const TOLERANCIA = 0.05;

export async function crearObra(formData: FormData) {
  const datos = leerDatosObra(formData);
  const socios = leerSocios(formData);

  const errorValidacion = validar(datos.nombre, socios);
  if (errorValidacion) {
    volverCon("/obras/nueva", errorValidacion);
  }

  const supabase = await createClient();
  const slug = await generarSlug(datos.nombre);

  const { data: obra, error } = await supabase
    .from("obras")
    .insert({ ...datos, slug })
    .select("id, slug")
    .single();

  if (error || !obra) {
    volverCon("/obras/nueva", error?.message ?? "No se pudo crear la obra.");
    return;
  }

  const { error: errorSocios } = await supabase.rpc("set_obra_socios", {
    p_obra: obra.id,
    p_socios: socios,
  });

  if (errorSocios) {
    // La obra quedó creada pero sin socias: se avisa y se manda a editarla,
    // en vez de dejar el error mudo.
    volverCon(
      `/obras/${obra.slug}/editar`,
      `La obra se creó pero no se pudieron guardar las socias: ${errorSocios.message}`
    );
  }

  revalidatePath("/", "layout");
  // Derecho a Rubros: la obra nace con el catálogo cargado pero sin nada
  // marcado, y sin rubros no se puede clasificar ni un gasto.
  redirect(`/obras/${obra.slug}/rubros?nueva=1`);
}

export async function actualizarObra(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const datos = leerDatosObra(formData);
  const socios = leerSocios(formData);

  const errorValidacion = validar(datos.nombre, socios);
  if (errorValidacion) {
    volverCon(`/obras/${slug}/editar`, errorValidacion);
  }

  const supabase = await createClient();

  const { error } = await supabase.from("obras").update(datos).eq("id", obraId);

  if (error) {
    volverCon(`/obras/${slug}/editar`, error.message);
  }

  const { error: errorSocios } = await supabase.rpc("set_obra_socios", {
    p_obra: obraId,
    p_socios: socios,
  });

  if (errorSocios) {
    volverCon(`/obras/${slug}/editar`, errorSocios.message);
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}`);
}

export async function archivarObra(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("obras")
    .update({ archivada_en: new Date().toISOString() })
    .eq("id", obraId);

  if (error) {
    volverCon(`/obras/${formData.get("slug")}/editar`, error.message);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function desarchivarObra(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");

  const supabase = await createClient();
  await supabase.from("obras").update({ archivada_en: null }).eq("id", obraId);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function eliminarObra(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const supabase = await createClient();

  // Los socios no bloquean el borrado, pero hay que sacarlos primero porque
  // apuntan a la obra. El trigger de la base es el que decide si se puede.
  await supabase.from("obra_socios").delete().eq("obra_id", obraId);

  const { error } = await supabase.from("obras").delete().eq("id", obraId);

  if (error) {
    volverCon(`/obras/${slug}/editar`, error.message);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Borra una obra archivada con todo lo que cuelga de ella: gastos, ingresos,
 * presupuestos, avances, fotos, documentos y los archivos en Drive.
 *
 * Dos candados a propósito, porque esto no se deshace:
 *
 *   1. Sólo obras archivadas. Archivar es la decisión reversible; obligar a
 *      pasar por ahí primero evita que un clic se lleve una obra viva.
 *   2. Hay que escribir el nombre de la obra. Un botón rojo se aprieta sin
 *      leer; el nombre no se tipea por accidente.
 *
 * Recién con la obra vacía se libera lo que quedaba enganchado a ella: las
 * empresas que sólo participaban acá pasan a poder borrarse.
 */
export async function eliminarObraConTodo(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "").trim();

  const volverAEditar = (mensaje: string): never =>
    volverCon(`/obras/${slug}/editar`, mensaje);

  const supabase = await createClient();

  const { data: obra } = await supabase
    .from("obras")
    .select("nombre, archivada_en")
    .eq("id", obraId)
    .maybeSingle();

  if (!obra) {
    volverCon("/", "La obra no existe o no tenés permiso para verla.");
    return;
  }

  if (!obra.archivada_en) {
    volverAEditar(
      "Archivá la obra antes de borrarla definitivamente. Es la única forma de que un borrado así sea deliberado."
    );
    return;
  }

  if (normalizar(confirmacion) !== normalizar(obra.nombre)) {
    volverAEditar(
      `Para borrarla hay que escribir el nombre exacto de la obra: ${obra.nombre}`
    );
    return;
  }

  // ---- Los archivos de Drive, antes de perder las filas que los referencian --

  const [{ data: registros }, { data: documentos }] = await Promise.all([
    supabase.from("foto_registros").select("id").eq("obra_id", obraId),
    supabase.from("documentos").select("id").eq("obra_id", obraId),
  ]);

  const registroIds = (registros ?? []).map((r) => r.id);
  const documentoIds = (documentos ?? []).map((d) => d.id);

  const [
    { data: fotos },
    { data: adjuntos },
    { data: gastos },
    { data: ingresos },
    { data: presupuestos },
  ] = await Promise.all([
    registroIds.length > 0
      ? supabase.from("fotos").select("drive_file_id").in("registro_id", registroIds)
      : Promise.resolve({ data: [] }),
    documentoIds.length > 0
      ? supabase
          .from("documento_archivos")
          .select("drive_file_id")
          .in("documento_id", documentoIds)
      : Promise.resolve({ data: [] }),
    supabase.from("gastos").select("comprobante_drive_id").eq("obra_id", obraId),
    supabase.from("ingresos").select("comprobante_drive_id").eq("obra_id", obraId),
    supabase
      .from("presupuestos")
      .select("comprobante_drive_id")
      .eq("obra_id", obraId),
  ]);

  const enDrive = [
    ...(fotos ?? []).map((f) => f.drive_file_id),
    ...(adjuntos ?? []).map((a) => a.drive_file_id),
    ...(gastos ?? []).map((g) => g.comprobante_drive_id),
    ...(ingresos ?? []).map((i) => i.comprobante_drive_id),
    ...(presupuestos ?? []).map((p) => p.comprobante_drive_id),
  ].filter((id): id is string => Boolean(id));

  // ---- Las filas ------------------------------------------------------------
  //
  // El orden importa: gastos, presupuestos y avances apuntan a rubros con
  // `on delete restrict`, así que tienen que irse antes de que el borrado de la
  // obra se lleve los rubros por cascada.

  const enOrden = [
    "gastos",
    "presupuestos",
    "avances",
    "documentos",
    "foto_registros",
    "ingresos",
    "obra_socios",
  ] as const;

  for (const tabla of enOrden) {
    const { error } = await supabase.from(tabla).delete().eq("obra_id", obraId);

    if (error) {
      volverAEditar(`No se pudo borrar ${tabla}: ${error.message}`);
      return;
    }
  }

  const { error } = await supabase.from("obras").delete().eq("id", obraId);

  if (error) {
    volverAEditar(error.message);
    return;
  }

  // Recién ahora Drive: si algo de arriba falla, los archivos siguen ahí y la
  // obra se puede volver a intentar. Al revés quedarían huérfanos.
  await Promise.all(enDrive.map((id) => eliminarArchivo(id).catch(() => {})));

  revalidatePath("/", "layout");
  redirect("/");
}

// ============================== helpers =====================================

function leerDatosObra(formData: FormData) {
  const texto = (campo: string) => {
    const valor = String(formData.get(campo) ?? "").trim();
    return valor === "" ? null : valor;
  };

  const presupuesto = String(formData.get("presupuesto") ?? "").trim();
  const valorM2 = String(formData.get("valor_m2_usd") ?? "").trim();
  const unidades = String(formData.get("unidades_funcionales") ?? "").trim();
  const pisos = String(formData.get("pisos") ?? "").trim();

  // Un campo de superficie: número o null si viene vacío.
  const superficie = (campo: string) => {
    const valor = String(formData.get(campo) ?? "").trim();
    return valor === "" ? null : Number(valor);
  };

  return {
    nombre: String(formData.get("nombre") ?? "").trim(),
    ubicacion: texto("ubicacion"),
    estado: String(formData.get("estado") ?? "Proyecto"),
    fecha_inicio: texto("fecha_inicio"),
    fecha_fin_estimada: texto("fecha_fin_estimada"),
    presupuesto: presupuesto === "" ? null : Number(presupuesto),
    valor_m2_usd: valorM2 === "" ? null : Number(valorM2),
    domicilio: texto("domicilio"),
    unidades_funcionales: unidades === "" ? null : Number(unidades),
    pisos: pisos === "" ? null : Number(pisos),
    sup_cubierta_m2: superficie("sup_cubierta_m2"),
    sup_semicubierta_m2: superficie("sup_semicubierta_m2"),
    sup_descubierta_m2: superficie("sup_descubierta_m2"),
    sup_venta_m2: superficie("sup_venta_m2"),
    // El coeficiente siempre viene del desplegable; el default sólo por las dudas.
    coef_semicubierta: Number(formData.get("coef_semicubierta") ?? 0.5),
    coef_descubierta: Number(formData.get("coef_descubierta") ?? 0),
  };
}

function leerSocios(formData: FormData): Socio[] {
  const empresas = formData.getAll("socio_empresa_id").map(String);
  const porcentajes = formData.getAll("socio_porcentaje").map(String);

  return empresas
    .map((empresa_id, i) => ({
      empresa_id,
      porcentaje: Number(porcentajes[i] ?? 0),
    }))
    .filter((socio) => socio.empresa_id !== "");
}

function validar(nombre: string, socios: Socio[]) {
  if (!nombre) {
    return "La obra necesita un nombre.";
  }

  if (socios.length === 0) {
    return "La obra necesita al menos una empresa socia.";
  }

  const ids = new Set(socios.map((s) => s.empresa_id));
  if (ids.size !== socios.length) {
    return "Hay una empresa repetida en la lista de socias.";
  }

  if (socios.some((s) => !Number.isFinite(s.porcentaje) || s.porcentaje <= 0)) {
    return "Todos los porcentajes tienen que ser mayores a cero.";
  }

  const suma = socios.reduce((acc, s) => acc + s.porcentaje, 0);
  if (Math.abs(suma - 100) > TOLERANCIA) {
    return `Los porcentajes suman ${suma.toFixed(2)}%. Tienen que sumar 100%.`;
  }

  return null;
}

async function generarSlug(nombre: string) {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "obra";

  const supabase = await createClient();
  const { data } = await supabase
    .from("obras")
    .select("slug")
    .like("slug", `${base}%`);

  const usados = new Set((data ?? []).map((o) => o.slug));

  if (!usados.has(base)) return base;

  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function volverCon(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}
