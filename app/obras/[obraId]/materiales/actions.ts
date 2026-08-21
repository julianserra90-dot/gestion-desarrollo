"use server";

/**
 * Alta, edición y borrado del catálogo de materiales.
 *
 * El catálogo es **uno solo para todas las obras** —el ladrillo común es el
 * mismo ladrillo en todos lados—, pero se entra desde una obra. Por eso cada
 * acción recibe el `slug`: sólo para saber a dónde volver.
 *
 * Modificar y borrar son de admin (política `materiales_admin`); agregar lo
 * puede hacer cualquiera, porque hace falta al cargar un gasto. Con RLS un
 * update sin permiso **no falla**: simplemente no toca ninguna fila. Por eso se
 * pide `select()` y se mira si volvió algo — mostrar "se guardó" cuando no se
 * guardó nada es peor que el error.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UNIDADES } from "@/lib/unidades";

const SIN_PERMISO =
  "No se pudo guardar: modificar el catálogo es cosa del administrador.";

export async function crearMaterial(formData: FormData) {
  const volver = rutaDeVuelta(formData);
  const nombre = String(formData.get("nombre") ?? "").trim();
  const unidad = String(formData.get("unidad") ?? "");

  if (!nombre) volverCon(volver, "Poné un nombre.");
  if (!UNIDADES.some((u) => u === unidad)) {
    volverCon(volver, "Elegí en qué unidad se compra.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("materiales").insert({
    nombre,
    unidad,
    rubro_id: opcional(formData.get("rubro_id")),
  });

  if (error) volverCon(volver, mensajeDeError(error, nombre));

  listo(volver);
}

export async function actualizarMaterial(formData: FormData) {
  const volver = rutaDeVuelta(formData);
  const id = String(formData.get("material_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const unidad = String(formData.get("unidad") ?? "");

  if (!nombre) volverCon(volver, "El nombre no puede quedar vacío.");
  if (!UNIDADES.some((u) => u === unidad)) {
    volverCon(volver, "Elegí en qué unidad se compra.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materiales")
    .update({
      nombre,
      unidad,
      rubro_id: opcional(formData.get("rubro_id")),
    })
    .eq("id", id)
    .select("id");

  if (error) volverCon(volver, mensajeDeError(error, nombre));
  if (!data?.length) volverCon(volver, SIN_PERMISO);

  listo(volver);
}

export async function eliminarMaterial(formData: FormData) {
  const volver = rutaDeVuelta(formData);
  const id = String(formData.get("material_id") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materiales")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    // La base rechaza el borrado si el material quedó en el detalle de algún
    // gasto (`on delete restrict`). La pantalla ya esconde el botón en ese
    // caso; esto cubre el borrado a destiempo, con la pantalla abierta de
    // antes.
    volverCon(
      volver,
      error.code === "23503"
        ? "No se puede eliminar: está cargado en el detalle de algún gasto."
        : error.message
    );
  }

  if (!data?.length) volverCon(volver, SIN_PERMISO);

  listo(volver);
}

/**
 * El slug viaja en el form porque el catálogo no sabe de obras.
 *
 * Se vuelve a la solapa **Catálogo**, que es donde están estos formularios: al
 * resumen se lo dejaría mirando el aviso de "listo, se guardó" sin ver qué
 * cambió.
 */
function rutaDeVuelta(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  return `/obras/${slug}/materiales/catalogo`;
}

/** "Sin rubro" manda cadena vacía, y como uuid la base la rechazaría. */
function opcional(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  return texto === "" ? null : texto;
}

function mensajeDeError(error: { code?: string; message: string }, nombre: string) {
  return error.code === "23505"
    ? `Ya hay un material con el nombre "${nombre}".`
    : error.message;
}

function volverCon(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}

function listo(ruta: string): never {
  revalidatePath("/", "layout");
  redirect(`${ruta}?ok=1`);
}
