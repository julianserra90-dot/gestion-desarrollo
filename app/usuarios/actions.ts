"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function actualizarUsuario(formData: FormData) {
  const id = String(formData.get("usuario_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const rol = String(formData.get("rol") ?? "empresa");
  const empresaId = String(formData.get("empresa_id") ?? "");

  const volver = (mensaje: string): never =>
    redirect(`/usuarios?error=${encodeURIComponent(mensaje)}`);

  if (!nombre) {
    volver("El usuario necesita un nombre y apellido.");
  }

  if (rol === "empresa" && !empresaId) {
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
      // Un admin no pertenece a ninguna empresa: ve todas las obras.
      empresa_id: rol === "admin" ? null : empresaId,
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
