"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  consultarPorDireccion,
  consultarPorSmp,
  valoresDesdeCiudad,
  type ConsultaCiudad,
} from "@/lib/ciudad";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Un estudio nace de la dirección y nada más: USIG ubica la parcela y
 * Ciudad 3D trae la ficha catastral y la normativa. Lo que la Ciudad no
 * contestó queda en los avisos de la ficha, no frena el alta.
 */
export async function crearPrefactibilidad(formData: FormData) {
  const direccion = texto(formData, "direccion");
  if (!direccion) {
    volverCon("/prefactibilidades/nueva", "Poné la dirección del terreno.");
    return;
  }

  let consulta: ConsultaCiudad;
  try {
    consulta = await consultarPorDireccion(direccion);
  } catch (e) {
    volverCon("/prefactibilidades/nueva", mensajeDe(e));
    return;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prefactibilidades")
    .insert({
      direccion,
      ...valoresDesdeCiudad(consulta),
      ciudad: consulta as unknown as Json,
      consultado_en: consulta.consultadoEn,
    })
    .select("id")
    .single();

  if (error || !data) {
    volverCon(
      "/prefactibilidades/nueva",
      error?.message ?? "No se pudo guardar el estudio."
    );
    return;
  }

  revalidatePath("/prefactibilidades");
  redirect(`/prefactibilidades/${data.id}`);
}

/**
 * Vuelve a preguntarle a la Ciudad y pisa lo que trajo la vez anterior,
 * correcciones a mano incluidas: es la forma de recuperar lo que USIG no
 * contestó, o de empezar de nuevo si se corrigió de más. Si el estudio ya
 * tiene nomenclatura catastral se consulta por ella, que es exacta; si no,
 * por la dirección.
 */
export async function reconsultarPrefactibilidad(formData: FormData) {
  const id = String(formData.get("prefactibilidad_id") ?? "");
  const ficha = `/prefactibilidades/${id}`;

  const supabase = await createClient();
  const { data: estudio } = await supabase
    .from("prefactibilidades")
    .select("id, direccion, direccion_normalizada, cod_calle, smp")
    .eq("id", id)
    .maybeSingle();

  if (!estudio) {
    volverCon("/prefactibilidades", "El estudio ya no existe.");
    return;
  }

  let consulta: ConsultaCiudad;
  try {
    consulta = estudio.smp
      ? await consultarPorSmp(estudio.smp, {
          direccionNormalizada: estudio.direccion_normalizada,
          codCalle: estudio.cod_calle,
          altura: null,
        })
      : await consultarPorDireccion(estudio.direccion);
  } catch (e) {
    volverCon(ficha, mensajeDe(e));
    return;
  }

  const { error } = await supabase
    .from("prefactibilidades")
    .update({
      ...valoresDesdeCiudad(consulta),
      ciudad: consulta as unknown as Json,
      consultado_en: consulta.consultadoEn,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    volverCon(ficha, error.message);
  }

  revalidatePath("/prefactibilidades");
  redirect(ficha);
}

export async function actualizarPrefactibilidad(formData: FormData) {
  const id = String(formData.get("prefactibilidad_id") ?? "");
  const datos = leerDatos(formData);

  const errorValidacion = validar(datos);
  if (errorValidacion) {
    volverCon(`/prefactibilidades/${id}/editar`, errorValidacion);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("prefactibilidades")
    .update({ ...datos, actualizado_en: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    volverCon(`/prefactibilidades/${id}/editar`, error.message);
  }

  revalidatePath("/prefactibilidades");
  redirect(`/prefactibilidades/${id}`);
}

export async function eliminarPrefactibilidad(formData: FormData) {
  const id = String(formData.get("prefactibilidad_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("prefactibilidades")
    .delete()
    .eq("id", id);

  if (error) {
    volverCon(`/prefactibilidades/${id}`, error.message);
  }

  revalidatePath("/prefactibilidades");
  redirect("/prefactibilidades");
}

/** Los campos que se corrigen a mano. Lo que trajo la Ciudad (`ciudad`, coordenadas) no se toca desde el formulario. */
function leerDatos(formData: FormData) {
  return {
    direccion: texto(formData, "direccion") ?? "",
    barrio: texto(formData, "barrio"),
    smp: texto(formData, "smp"),
    ancho_m: numero(formData, "ancho_m"),
    profundidad_m: numero(formData, "profundidad_m"),
    superficie_m2: numero(formData, "superficie_m2"),
    valor_terreno: numero(formData, "valor_terreno"),
    moneda_valor: texto(formData, "moneda_valor") ?? "USD",
    construcciones_existentes: texto(formData, "construcciones_existentes"),
    tipo_desarrollo: texto(formData, "tipo_desarrollo"),
    estado: texto(formData, "estado") ?? "En estudio",
    unidad_edificabilidad: texto(formData, "unidad_edificabilidad"),
    altura_maxima_m: numero(formData, "altura_maxima_m"),
    plano_limite_m: numero(formData, "plano_limite_m"),
    plantas_sobre_pb: entero(formData, "plantas_sobre_pb"),
    sup_edificable_planta_m2: numero(formData, "sup_edificable_planta_m2"),
    lfi_m: numero(formData, "lfi_m"),
    lib_m: numero(formData, "lib_m"),
    retiro_frente_m: numero(formData, "retiro_frente_m"),
    patios: texto(formData, "patios"),
    mixtura_usos: texto(formData, "mixtura_usos"),
    usos_permitidos: texto(formData, "usos_permitidos"),
    aph: formData.get("aph") === "on",
    aph_detalle: texto(formData, "aph_detalle"),
    catalogado: formData.get("catalogado") === "on",
    afectaciones: texto(formData, "afectaciones"),
    plusvalia: texto(formData, "plusvalia"),
    observaciones: texto(formData, "observaciones"),
  };
}

function validar(datos: ReturnType<typeof leerDatos>) {
  if (!datos.direccion) return "Poné la dirección del terreno.";

  // Los `check` de la base también lo rechazan, pero con un mensaje en
  // inglés sobre un constraint: mejor decirlo antes y en castellano.
  const medidas: [number | null, string][] = [
    [datos.ancho_m, "El frente"],
    [datos.profundidad_m, "El fondo"],
    [datos.superficie_m2, "La superficie"],
    [datos.altura_maxima_m, "La altura máxima"],
    [datos.plano_limite_m, "El plano límite"],
    [datos.lfi_m, "La profundidad hasta la LFI"],
    [datos.lib_m, "La profundidad hasta la LIB"],
  ];
  for (const [valor, nombre] of medidas) {
    if (valor !== null && valor <= 0) return `${nombre} tiene que ser mayor a cero.`;
  }

  return null;
}

/** Texto recortado, o null si quedó vacío: en la base un dato que falta es null, no "". */
function texto(formData: FormData, clave: string): string | null {
  const valor = String(formData.get(clave) ?? "").trim();
  return valor === "" ? null : valor;
}

function numero(formData: FormData, clave: string): number | null {
  const valor = String(formData.get(clave) ?? "").trim();
  if (valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function entero(formData: FormData, clave: string): number | null {
  const n = numero(formData, clave);
  return n === null ? null : Math.round(n);
}

function mensajeDe(e: unknown) {
  return e instanceof Error ? e.message : "La consulta a la Ciudad falló.";
}

function volverCon(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}
