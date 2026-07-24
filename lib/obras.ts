import { createClient } from "@/lib/supabase/server";

/**
 * Busca una obra por el slug que viene en la URL.
 *
 * Lo usan todas las solapas de la ficha de obra. Devuelve null si no existe o
 * si el usuario no tiene permiso para verla — el RLS no distingue entre las
 * dos cosas, y está bien que sea así.
 */
export async function getObraPorSlug(slug: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("obras")
    .select(
      "id, slug, nombre, ubicacion, estado, fecha_inicio, fecha_fin_estimada"
    )
    .eq("slug", slug)
    .maybeSingle();

  return data;
}
