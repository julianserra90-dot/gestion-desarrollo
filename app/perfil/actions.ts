"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function actualizarMiPerfil(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!nombre) {
    redirect("/perfil?error=" + encodeURIComponent("Poné tu nombre y apellido."));
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("perfiles")
    .update({ nombre })
    .eq("id", user.id);

  if (error) {
    redirect("/perfil?error=" + encodeURIComponent(error.message));
  }

  // El nombre queda copiado en cada registro al momento de cargarlo (para poder
  // guardar también autores que no son usuarios del sistema). Por eso, al
  // renombrarse, hay que actualizar lo ya cargado: si no, lo viejo seguiría
  // mostrando el nombre anterior.
  await Promise.all([
    supabase
      .from("foto_registros")
      .update({ subido_por_nombre: nombre })
      .eq("subido_por", user.id),
    supabase
      .from("documentos")
      .update({ subido_por_nombre: nombre })
      .eq("subido_por", user.id),
    supabase
      .from("avances")
      .update({ actualizado_por_nombre: nombre })
      .eq("actualizado_por", user.id),
  ]);

  revalidatePath("/", "layout");
  redirect("/perfil?ok=1");
}
