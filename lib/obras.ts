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
      "id, slug, nombre, ubicacion, estado, fecha_inicio, fecha_fin_estimada, presupuesto, valor_m2_usd, domicilio, unidades_funcionales, pisos, sup_cubierta_m2, sup_semicubierta_m2, sup_descubierta_m2, coef_semicubierta, coef_descubierta, sup_venta_m2, lote_valor_usd, lote_superficie_m2, lote_vendedor, lote_detalle"
    )
    .eq("slug", slug)
    .maybeSingle();

  return data;
}
