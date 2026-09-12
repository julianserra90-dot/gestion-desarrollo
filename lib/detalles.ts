/**
 * El catálogo de detalles: las frases con que se cargan gastos e ingresos.
 *
 * SÓLO SERVIDOR: lee y escribe la base.
 *
 * Es una ayuda para escribir siempre igual ("Jornales", "Aporte de capital"),
 * no una tabla a la que el gasto o el ingreso apunten: `concepto` sigue siendo
 * texto. Por eso agregar uno nuevo no puede hacer fallar la carga: si el
 * catálogo no lo toma, el gasto o el ingreso se guardan igual con su texto.
 *
 * Una lista por ámbito: "Jornales" no es un ingreso.
 */

import { createClient } from "@/lib/supabase/server";

export type AmbitoDetalle = "Gasto" | "Ingreso";

/** Los detalles de un ámbito, en orden alfabético. */
export async function getDetalles(ambito: AmbitoDetalle): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("detalles")
    .select("nombre")
    .eq("ambito", ambito)
    .order("nombre");

  return (data ?? []).map((d) => d.nombre);
}

/**
 * Suma un detalle al catálogo de su ámbito si no está. Sin distinguir
 * mayúsculas: el índice de la base lo frena igual, pero así no se intenta y no
 * queda un error en el log por un duplicado que no es tal.
 */
export async function agregarDetalle(ambito: AmbitoDetalle, nombre: string) {
  const limpio = nombre.trim();
  if (!limpio) return;

  const supabase = await createClient();

  const { data: existe } = await supabase
    .from("detalles")
    .select("id")
    .eq("ambito", ambito)
    .ilike("nombre", limpio)
    .maybeSingle();

  if (existe) return;

  await supabase.from("detalles").insert({ ambito, nombre: limpio });
}

/**
 * Si el formulario pidió sumar el detalle escrito al catálogo, lo hace. Aparte
 * de guardar el gasto o el ingreso: si esto falla, aquello se guarda igual.
 */
export async function guardarDetalleSiCorresponde(
  ambito: AmbitoDetalle,
  formData: FormData,
  concepto: string | null
) {
  if (concepto && formData.get("agregar_detalle") === "on") {
    await agregarDetalle(ambito, concepto).catch(() => {});
  }
}
