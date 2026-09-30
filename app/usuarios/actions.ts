"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ROL_CON_EMPRESA, leerRol } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function actualizarUsuario(formData: FormData) {
  const id = String(formData.get("usuario_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const rol = leerRol(String(formData.get("rol") ?? ""));
  const empresaId = String(formData.get("empresa_id") ?? "");

  const volver = (mensaje: string): never =>
    redirect(`/usuarios?error=${encodeURIComponent(mensaje)}`);

  if (!nombre) {
    volver("El usuario necesita un nombre y apellido.");
  }

  // El redirect corta acá, así que abajo el rol ya es uno de los cuatro.
  if (!rol) {
    redirect(`/usuarios?error=${encodeURIComponent("Elegí un rol.")}`);
  }

  if (rol === ROL_CON_EMPRESA && !empresaId) {
    volver(
      "Elegí a qué empresa pertenece. Sin empresa asignada, el usuario no ve ninguna obra."
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("perfiles")
    .update({
      nombre,
      rol,
      // Sólo el desarrollador pertenece a una empresa: el administrador ve
      // todas las obras, y el inversor y el comprador no son de ninguna.
      empresa_id: rol === ROL_CON_EMPRESA ? empresaId : null,
    })
    .eq("id", id);

  if (error) {
    volver(error.message);
  }

  // El nombre queda copiado en lo que la persona ya cargó, así que se
  // actualiza para que no quede el anterior dando vueltas.
  await Promise.all([
    supabase
      .from("foto_registros")
      .update({ subido_por_nombre: nombre })
      .eq("subido_por", id),
    supabase
      .from("documentos")
      .update({ subido_por_nombre: nombre })
      .eq("subido_por", id),
    supabase
      .from("avances")
      .update({ actualizado_por_nombre: nombre })
      .eq("actualizado_por", id),
  ]);

  revalidatePath("/", "layout");
  redirect("/usuarios?ok=1");
}
