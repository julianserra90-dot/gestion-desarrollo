"use server";

/**
 * Alta, edición y borrado del catálogo de proveedores y contratistas.
 *
 * El catálogo es **uno solo para todas las obras** —así el mismo plomero sirve
 * en dos edificios—, pero se entra desde Presupuestos de una obra, que es donde
 * uno se acuerda de que hay que corregirlo. Por eso cada acción recibe el
 * `slug`: sólo para saber a dónde volver.
 *
 * Modificar y borrar son de admin (política `proveedores_admin`; agregar lo
 * puede hacer cualquiera, porque el formulario de gastos ya lo hacía). Con RLS
 * un update sin permiso **no falla**: simplemente no toca ninguna fila. Por eso
 * se pide `select()` y se mira si volvió algo — mostrar "se guardó" cuando no
 * se guardó nada es peor que el error.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_DE_PROVEEDOR } from "@/lib/proveedores-tipos";

const SIN_PERMISO =
  "No se pudo guardar: modificar el catálogo es cosa del administrador.";

export async function crearProveedor(formData: FormData) {
  const volver = rutaDeVuelta(formData);
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "");

  if (!nombre) volverCon(volver, "Poné un nombre.");
  if (!TIPOS_DE_PROVEEDOR.some((t) => t.tipo === tipo)) {
    volverCon(volver, "Elegí si es contratista, proveedor o varios.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("proveedores").insert({
    nombre,
    tipo,
    telefono: opcional(formData.get("telefono")),
    rubro_id: opcional(formData.get("rubro_id")),
  });

  if (error) volverCon(volver, mensajeDeError(error, nombre));

  listo(volver);
}

export async function actualizarProveedor(formData: FormData) {
  const volver = rutaDeVuelta(formData);
  const id = String(formData.get("proveedor_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!nombre) volverCon(volver, "El nombre no puede quedar vacío.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proveedores")
    .update({
      nombre,
      telefono: opcional(formData.get("telefono")),
      rubro_id: opcional(formData.get("rubro_id")),
    })
    .eq("id", id)
    .select("id");

  if (error) volverCon(volver, mensajeDeError(error, nombre));
  if (!data?.length) volverCon(volver, SIN_PERMISO);

  listo(volver);
}

export async function eliminarProveedor(formData: FormData) {
  const volver = rutaDeVuelta(formData);
  const id = String(formData.get("proveedor_id") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proveedores")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    // La base rechaza el borrado si quedó enganchado a un gasto o a una
    // cotización (las dos claves foráneas son `on delete restrict`). La
    // pantalla ya lo esconde en ese caso; esto cubre el borrado a destiempo,
    // con la pantalla abierta de antes.
    volverCon(
      volver,
      error.code === "23503"
        ? "No se puede eliminar: tiene gastos o cotizaciones cargadas a su nombre."
        : error.message
    );
  }

  if (!data?.length) volverCon(volver, SIN_PERMISO);

  listo(volver);
}

/** El slug viaja en el form porque el catálogo no sabe de obras. */
function rutaDeVuelta(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  return `/obras/${slug}/presupuestos/contratistas`;
}

/**
 * Un campo vacío es `null`, no `""`: no es un dato en blanco. Vale para el
 * teléfono y para el rubro, donde "Sin rubro" manda cadena vacía y como uuid
 * la base la rechazaría.
 */
function opcional(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  return texto === "" ? null : texto;
}

function mensajeDeError(error: { code?: string; message: string }, nombre: string) {
  return error.code === "23505"
    ? `Ya hay otro con el nombre "${nombre}" en esa misma categoría.`
    : error.message;
}

function volverCon(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}

function listo(ruta: string): never {
  revalidatePath("/", "layout");
  redirect(`${ruta}?ok=1`);
}
