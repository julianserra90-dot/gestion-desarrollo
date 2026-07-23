"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

export async function subirDocumento(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const archivo = formData.get("archivo");
  const nombreManual = String(formData.get("nombre") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim() || "V01";
  const estado = String(formData.get("estado") ?? "Vigente");
  const fecha = String(formData.get("fecha") ?? "").trim();

  const volver = (mensaje: string): never =>
    redirect(`/obras/${slug}/documentos/nuevo?error=${encodeURIComponent(mensaje)}`);

  if (!(archivo instanceof File) || archivo.size === 0) {
    volver("Seleccioná un archivo.");
    return;
  }

  // El nombre visible: el que puso el usuario, o el del archivo sin extensión.
  const nombre = nombreManual || archivo.name.replace(/\.[^.]+$/, "");
  // El tipo sale de la extensión (PDF, DWG, XLS...).
  const tipo = archivo.name.split(".").pop()?.toUpperCase() ?? null;

  const subida = await subirArchivo({
    archivo,
    nombre: archivo.name,
    obraSlug: slug,
    tipo: "documentos",
  }).catch((e) => {
    volver(`No se pudo subir el archivo: ${e instanceof Error ? e.message : "error"}`);
  });

  if (!subida) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { error } = await supabase.from("documentos").insert({
    obra_id: obraId,
    nombre,
    tipo,
    categoria: categoria === "" ? null : categoria,
    version,
    estado,
    fecha: fecha === "" ? undefined : fecha,
    drive_file_id: subida.id,
    mime_type: subida.mimeType,
    tamano: subida.tamano,
    subido_por: user?.id ?? null,
    subido_por_nombre: perfil?.nombre ?? null,
  });

  if (error) {
    // Si la fila no se pudo guardar, se borra el archivo de Drive para no dejar
    // un huérfano sin referencia en la base.
    await eliminarArchivo(subida.id).catch(() => {});
    volver(error.message);
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/documentos`);
}

export async function eliminarDocumento(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("documento_id") ?? "");

  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documentos")
    .select("drive_file_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("documentos").delete().eq("id", id);

  if (error) {
    redirect(`/obras/${slug}/documentos?error=${encodeURIComponent(error.message)}`);
  }

  // Borrado el registro, se limpia el archivo de Drive.
  if (doc?.drive_file_id) {
    await eliminarArchivo(doc.drive_file_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/documentos`);
}
