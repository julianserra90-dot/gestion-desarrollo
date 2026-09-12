/**
 * El catálogo de materiales, listo para los formularios.
 *
 * SÓLO SERVIDOR: lee de la base.
 *
 * Cada material trae el **nombre** de su rubro y no el id: el catálogo es común
 * a todas las obras y apunta a los rubros de la plantilla (`obra_id` nulo),
 * mientras que un gasto apunta al rubro de su obra, que es otra fila con otro
 * id. Lo que coincide entre los dos es el nombre, y por eso los formularios
 * agrupan y comparan por nombre.
 */

import { createClient } from "@/lib/supabase/server";

export type MaterialCatalogo = {
  id: string;
  nombre: string;
  unidad: string;
  rubroNombre: string | null;
};

export async function getMaterialesCatalogo(): Promise<MaterialCatalogo[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("materiales")
    .select("id, nombre, unidad, rubros(nombre)")
    .order("nombre");

  return (data ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    unidad: m.unidad,
    rubroNombre: m.rubros?.nombre ?? null,
  }));
}
