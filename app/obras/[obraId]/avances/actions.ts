"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function actualizarAvance(formData: FormData) {
  const avanceId = String(formData.get("avance_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const porcentaje = Number(formData.get("porcentaje") ?? 0);
  const estado = String(formData.get("estado") ?? "");
  const comentario = String(formData.get("comentario") ?? "").trim();
  const fecha = String(formData.get("fecha") ?? "").trim();

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/avances/${avanceId}/editar?error=${encodeURIComponent(mensaje)}`
    );

  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    volver("El porcentaje tiene que estar entre 0 y 100.");
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

  const { error } = await supabase
    .from("avances")
    .update({
      porcentaje,
      estado,
      comentario: comentario === "" ? null : comentario,
      fecha: fecha === "" ? undefined : fecha,
      actualizado_por: user?.id ?? null,
      actualizado_por_nombre: perfil?.nombre ?? null,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", avanceId);

  if (error) {
    volver(error.message);
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/avances`);
}
