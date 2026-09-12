/**
 * El catálogo de detalles de gasto: las frases con que se cargan los gastos.
 *
 * SÓLO SERVIDOR: lee y escribe la base.
 *
 * Es una ayuda para escribir siempre igual ("Jornales", "Acopio de
 * materiales"), no una tabla a la que el gasto apunte: `gastos.concepto` sigue
 * siendo texto. Por eso agregar uno nuevo no puede fallar el gasto: si el
 * catálogo no lo toma, el gasto se guarda igual con su texto.
 */

import { createClient } from "@/lib/supabase/server";

/** Los detalles disponibles, en orden alfabético. */
export async function getDetallesGasto(): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("detalles_gasto")
    .select("nombre")
    .order("nombre");

  return (data ?? []).map((d) => d.nombre);
}

/**
 * Suma un detalle al catálogo si no está. Sin distinguir mayúsculas: el índice
 * de la base lo frena igual, pero así no se intenta y no queda un error en el
 * log por un duplicado que no es tal.
 */
export async function agregarDetalleGasto(nombre: string) {
  const limpio = nombre.trim();
  if (!limpio) return;

  const supabase = await createClient();

  const { data: existe } = await supabase
    .from("detalles_gasto")
    .select("id")
    .ilike("nombre", limpio)
    .maybeSingle();

  if (existe) return;

  await supabase.from("detalles_gasto").insert({ nombre: limpio });
}
