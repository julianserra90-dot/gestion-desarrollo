"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Campos = {
  porcentaje: number;
  fechaDesde: string;
  fechaHasta: string;
  comentario: string;
};

function leerCampos(formData: FormData): Campos {
  return {
    porcentaje: Number(formData.get("porcentaje") ?? 0),
    fechaDesde: String(formData.get("fecha_desde") ?? "").trim(),
    fechaHasta: String(formData.get("fecha_hasta") ?? "").trim(),
    comentario: String(formData.get("comentario") ?? "").trim(),
  };
}

/** Devuelve el problema, o null si está todo bien. */
function validar({ porcentaje, fechaDesde, fechaHasta }: Campos): string | null {
  if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
    return "El avance del período tiene que ser mayor a 0 y hasta 100.";
  }

  if (!fechaDesde || !fechaHasta) {
    return "Poné desde y hasta qué día se hizo este avance.";
  }

  if (fechaHasta < fechaDesde) {
    return "El día de fin no puede ser anterior al de inicio.";
  }

  return null;
}

/**
 * Suma una carga al historial del rubro. El porcentaje es lo que se avanzó en
 * esos días, no el total: el acumulado lo arma la suma de las cargas.
 */
export async function cargarAvance(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const campos = leerCampos(formData);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/avances/${rubroId}?error=${encodeURIComponent(mensaje)}`
    );

  const problema = validar(campos);

  if (problema) {
    volver(problema);
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { error } = await supabase.from("avances").insert({
    obra_id: obraId,
    rubro_id: rubroId,
    porcentaje: campos.porcentaje,
    fecha_desde: campos.fechaDesde,
    fecha_hasta: campos.fechaHasta,
    comentario: campos.comentario === "" ? null : campos.comentario,
    actualizado_por: user?.id ?? null,
    actualizado_por_nombre: perfil?.nombre ?? null,
  });

  if (error) {
    volver(error.message);
    return;
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/avances/${rubroId}`);
}

export async function actualizarAvance(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const avanceId = String(formData.get("avance_id") ?? "");
  const campos = leerCampos(formData);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/avances/${rubroId}/${avanceId}/editar?error=${encodeURIComponent(mensaje)}`
    );

  const problema = validar(campos);

  if (problema) {
    volver(problema);
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("avances")
    .update({
      porcentaje: campos.porcentaje,
      fecha_desde: campos.fechaDesde,
      fecha_hasta: campos.fechaHasta,
      comentario: campos.comentario === "" ? null : campos.comentario,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", avanceId)
    .eq("obra_id", obraId);

  if (error) {
    volver(error.message);
    return;
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/avances/${rubroId}`);
}

export async function eliminarAvance(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const avanceId = String(formData.get("avance_id") ?? "");

  const supabase = await createClient();

  const { error } = await supabase
    .from("avances")
    .delete()
    .eq("id", avanceId)
    .eq("obra_id", obraId);

  if (error) {
    redirect(
      `/obras/${slug}/avances/${rubroId}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/avances/${rubroId}`);
}
