"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const LISTADO = "/prefactibilidades/referencias";

export async function crearReferencia(formData: FormData) {
  const datos = leerBase(formData);
  if (!datos.direccion || !datos.estudio) {
    volverCon(LISTADO, "Hacen falta el estudio y la dirección.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edificios_referencia")
    .insert(datos)
    .select("id")
    .single();

  if (error || !data) {
    volverCon(LISTADO, error?.message ?? "No se pudo guardar el edificio.");
    return;
  }

  revalidatePath(LISTADO);
  redirect(`${LISTADO}/${data.id}`);
}

export async function actualizarReferencia(formData: FormData) {
  const id = String(formData.get("referencia_id") ?? "");
  const datos = { ...leerBase(formData), ...leerResolucion(formData) };
  if (!datos.direccion || !datos.estudio) {
    volverCon(`${LISTADO}/${id}`, "Hacen falta el estudio y la dirección.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("edificios_referencia").update(datos).eq("id", id);

  if (error) {
    volverCon(`${LISTADO}/${id}`, error.message);
  }

  revalidatePath(LISTADO);
  revalidatePath("/prefactibilidades");
  redirect(`${LISTADO}/${id}?guardado=1`);
}

export async function eliminarReferencia(formData: FormData) {
  const id = String(formData.get("referencia_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("edificios_referencia").delete().eq("id", id);

  if (error) {
    volverCon(`${LISTADO}/${id}`, error.message);
  }

  revalidatePath(LISTADO);
  redirect(LISTADO);
}

function leerBase(formData: FormData) {
  return {
    estudio: texto(formData, "estudio") ?? "",
    barrio: texto(formData, "barrio"),
    direccion: texto(formData, "direccion") ?? "",
    frente_m: numero(formData, "frente_m"),
    fondo_m: numero(formData, "fondo_m"),
    esquina: formData.get("esquina") === "on",
    frente_a_parque: formData.get("frente_a_parque") === "on",
    superficie_lote_m2: numero(formData, "superficie_lote_m2"),
    unidades_funcionales: entero(formData, "unidades_funcionales"),
    link: texto(formData, "link"),
    etiqueta: texto(formData, "etiqueta"),
  };
}

/**
 * La resolución. Se marca como analizada cuando se escribe algo de ella:
 * así los comparables distinguen "sin cargar" de "cargada y sin cocheras".
 */
function leerResolucion(formData: FormData) {
  const resolucion = {
    plantas_sobre_pb: entero(formData, "plantas_sobre_pb"),
    unidades_por_planta: entero(formData, "unidades_por_planta"),
    nucleo: texto(formData, "nucleo"),
    ascensor: formData.get("ascensor") === "on",
    ingreso: texto(formData, "ingreso"),
    patios: texto(formData, "patios"),
    tipologias: texto(formData, "tipologias"),
    cocheras: entero(formData, "cocheras"),
    local_pb: formData.get("local_pb") === "on",
    notas: texto(formData, "notas"),
  };
  const hayAlgo =
    resolucion.plantas_sobre_pb !== null ||
    resolucion.unidades_por_planta !== null ||
    resolucion.nucleo !== null ||
    resolucion.ingreso !== null ||
    resolucion.patios !== null ||
    resolucion.tipologias !== null ||
    resolucion.notas !== null;
  return { ...resolucion, analizado_en: hayAlgo ? new Date().toISOString() : null };
}

function texto(formData: FormData, clave: string): string | null {
  const valor = String(formData.get(clave) ?? "").trim();
  return valor === "" ? null : valor;
}

function numero(formData: FormData, clave: string): number | null {
  const valor = String(formData.get(clave) ?? "").trim().replace(",", ".");
  if (valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function entero(formData: FormData, clave: string): number | null {
  const n = numero(formData, clave);
  return n === null ? null : Math.round(n);
}

function volverCon(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}
