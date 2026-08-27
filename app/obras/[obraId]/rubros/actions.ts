"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function crearRubro(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!nombre) {
    volver(slug, "Poné un nombre para el rubro.");
  }

  const supabase = await createClient();

  // Va al final de la lista y ya marcado: si lo estás creando a mano es
  // porque lo vas a usar.
  const { data: ultimo } = await supabase
    .from("rubros")
    .select("orden")
    .eq("obra_id", obraId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Arranca admitiendo las dos cosas, que es lo más común. Si lleva sólo una,
  // se desmarca en la solapa Presupuestos, al lado del rubro.
  const { error } = await supabase.from("rubros").insert({
    obra_id: obraId,
    nombre,
    orden: Number(ultimo?.orden ?? 0) + 1,
    activo: true,
  });

  if (error) {
    volver(slug, mensaje(error, nombre));
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/rubros`);
}

/**
 * Guarda de una vez la elección de rubros de la obra y los nombres editados.
 *
 * Va todo junto en un solo formulario a propósito: marcar quince rubros con un
 * botón por fila sería quince recargas de página.
 *
 * Y se guarda con un solo upsert, no con un update por fila: son casi cuarenta
 * rubros, y cuarenta viajes a la base uno atrás del otro son varios segundos de
 * espera para algo que es marcar casilleros.
 */
export async function guardarRubros(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const ids = new Set(formData.getAll("rubro_ids").map(String));

  const supabase = await createClient();

  // Se traen todas las columnas que el upsert va a reescribir. Las que esta
  // pantalla no edita —qué se cotiza en el rubro, que se marca en
  // Presupuestos— viajan con su valor actual, para que guardar acá no las pise.
  const { data: actuales, error: errorLectura } = await supabase
    .from("rubros")
    .select(
      "id, orden, obra_id, usa_materiales, usa_mano_obra, usa_mano_obra_y_materiales"
    )
    .eq("obra_id", obraId);

  if (errorLectura) {
    volver(slug, errorLectura.message);
  }

  const filas = [];

  for (const rubro of actuales ?? []) {
    // Con el buscador puesto sólo viajan las filas visibles; las demás quedan
    // como estaban.
    if (!ids.has(rubro.id)) continue;

    const nombre = String(formData.get(`nombre_${rubro.id}`) ?? "").trim();

    if (!nombre) {
      volver(slug, "El nombre de un rubro no puede quedar vacío.");
    }

    filas.push({
      id: rubro.id,
      obra_id: rubro.obra_id,
      orden: rubro.orden,
      nombre,
      activo: formData.get(`activo_${rubro.id}`) === "on",
      usa_materiales: rubro.usa_materiales,
      usa_mano_obra: rubro.usa_mano_obra,
      usa_mano_obra_y_materiales: rubro.usa_mano_obra_y_materiales,
    });
  }

  if (filas.length > 0) {
    const { error } = await supabase.from("rubros").upsert(filas);

    if (error) {
      volver(slug, mensaje(error, ""));
    }
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/rubros`);
}

/**
 * El id viene atado con `bind` y no por el formulario: React no permite un
 * `name` en un botón que declara su propio formAction.
 */
export async function eliminarRubro(id: string, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("rubros").delete().eq("id", id);

  if (error) {
    volver(
      slug,
      error.code === "23503"
        ? "No se puede eliminar: el rubro está en uso. Desmarcalo para que deje de aparecer en los formularios."
        : error.message
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/rubros`);
}

function mensaje(error: { code?: string; message: string }, nombre: string) {
  if (error.code !== "23505") return error.message;

  return nombre
    ? `Esta obra ya tiene un rubro llamado "${nombre}".`
    : "Quedaron dos rubros con el mismo nombre en esta obra.";
}

function volver(slug: string, texto: string): never {
  redirect(`/obras/${slug}/rubros?error=${encodeURIComponent(texto)}`);
}
