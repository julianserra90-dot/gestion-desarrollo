"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function crearRubro(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const orden = Number(formData.get("orden") ?? 0);

  if (!nombre) {
    volver(slug, "Poné un nombre para el rubro.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("rubros").insert({
    obra_id: obraId,
    nombre,
    orden: Number.isFinite(orden) ? orden : 0,
  });

  if (error) {
    volver(slug, mensaje(error, nombre));
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/rubros`);
}

export async function renombrarRubro(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("rubro_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const orden = Number(formData.get("orden") ?? 0);

  if (!nombre) {
    volver(slug, "El nombre del rubro no puede quedar vacío.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rubros")
    .update({ nombre, orden: Number.isFinite(orden) ? orden : 0 })
    .eq("id", id);

  if (error) {
    volver(slug, mensaje(error, nombre));
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/rubros`);
}

export async function eliminarRubro(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("rubro_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("rubros").delete().eq("id", id);

  if (error) {
    volver(
      slug,
      error.code === "23503"
        ? "No se puede eliminar: el rubro está en uso."
        : error.message
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/rubros`);
}

function mensaje(error: { code?: string; message: string }, nombre: string) {
  return error.code === "23505"
    ? `Esta obra ya tiene un rubro llamado "${nombre}".`
    : error.message;
}

function volver(slug: string, texto: string): never {
  redirect(`/obras/${slug}/rubros?error=${encodeURIComponent(texto)}`);
}
