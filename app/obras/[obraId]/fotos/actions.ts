"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { subirArchivo } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

export async function crearRegistroFotos(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const estado = String(formData.get("estado") ?? "Registrado");
  const imagenes = formData.getAll("imagenes").filter((x): x is File => x instanceof File && x.size > 0);

  const volver = (mensaje: string): never =>
    redirect(`/obras/${slug}/fotos/nuevo?error=${encodeURIComponent(mensaje)}`);

  if (!fecha) volver("Poné la fecha del registro.");
  if (imagenes.length === 0) volver("Seleccioná al menos una foto.");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  // 1. El registro (el lote de fotos con su fecha, rubro y descripción).
  const { data: registro, error: errorRegistro } = await supabase
    .from("foto_registros")
    .insert({
      obra_id: obraId,
      rubro_id: rubroId === "" ? null : rubroId,
      fecha,
      descripcion: descripcion === "" ? null : descripcion,
      estado,
      subido_por: user?.id ?? null,
      subido_por_nombre: perfil?.nombre ?? null,
    })
    .select("id")
    .single();

  if (errorRegistro || !registro) {
    volver(errorRegistro?.message ?? "No se pudo crear el registro.");
    return;
  }

  // 2. Cada imagen: sube a Drive y guarda la fila con su id.
  const subidas: string[] = [];
  try {
    for (const [i, imagen] of imagenes.entries()) {
      const archivo = await subirArchivo({
        archivo: imagen,
        nombre: imagen.name || `foto-${i + 1}.jpg`,
        obraSlug: slug,
        tipo: "fotos",
      });
      subidas.push(archivo.id);

      await supabase.from("fotos").insert({
        registro_id: registro.id,
        drive_file_id: archivo.id,
        nombre: archivo.nombre,
        mime_type: archivo.mimeType,
        tamano: archivo.tamano,
        orden: i,
      });
    }
  } catch (error) {
    // Si algo falla a mitad de camino, se borra el registro para no dejar un
    // lote vacío colgado. Las imágenes ya subidas a Drive quedan huérfanas;
    // es aceptable, se limpian aparte si hace falta.
    await supabase.from("foto_registros").delete().eq("id", registro.id);
    volver(
      `Se subieron ${subidas.length} de ${imagenes.length} fotos y falló: ${
        error instanceof Error ? error.message : "error desconocido"
      }`
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/fotos`);
}
