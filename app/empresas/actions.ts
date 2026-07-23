"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function crearEmpresa(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const volverA = String(formData.get("volver_a") ?? "/empresas");

  if (!nombre) {
    volverCon(volverA, "Poné un nombre para la empresa.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("empresas").insert({ nombre });

  if (error) {
    volverCon(volverA, mensajeDeError(error, nombre));
  }

  revalidatePath("/", "layout");
  redirect(volverA);
}

export async function renombrarEmpresa(formData: FormData) {
  const id = String(formData.get("empresa_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!nombre) {
    volverCon("/empresas", "El nombre no puede quedar vacío.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("empresas")
    .update({ nombre })
    .eq("id", id);

  if (error) {
    volverCon("/empresas", mensajeDeError(error, nombre));
  }

  revalidatePath("/", "layout");
  redirect("/empresas");
}

export async function eliminarEmpresa(formData: FormData) {
  const id = String(formData.get("empresa_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("empresas").delete().eq("id", id);

  if (error) {
    // La base rechaza el borrado si la empresa está referenciada en alguna
    // obra o en algún gasto. Se traduce a algo legible.
    volverCon(
      "/empresas",
      error.code === "23503"
        ? "No se puede eliminar: la empresa participa en obras o figura como pagadora de gastos."
        : error.message
    );
  }

  revalidatePath("/", "layout");
  redirect("/empresas");
}

function mensajeDeError(error: { code?: string; message: string }, nombre: string) {
  return error.code === "23505"
    ? `Ya existe una empresa llamada "${nombre}".`
    : error.message;
}

function volverCon(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}
