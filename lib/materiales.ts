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

import type { Presentacion } from "@/lib/presentaciones";
import { createClient } from "@/lib/supabase/server";

export type MaterialCatalogo = {
  id: string;
  nombre: string;
  unidad: string;
  rubroNombre: string | null;
  /** Cuánto trae el envase (30, de una bolsa de 30 kg). Null si no declara. */
  contenido: number | null;
  /** La unidad de lo que trae (kg). Siempre junto con `contenido`. */
  contenidoUnidad: string | null;
};

/**
 * Las presentaciones comerciales de cada material, por id: lata de 4 litros,
 * balde de 20.
 *
 * Aparte del catálogo y no adentro de su consulta: si la tabla falla —o
 * todavía no existe— el catálogo tiene que seguir abriendo, porque de él
 * dependen los formularios de gasto. Sin presentaciones, el listado vuelve a
 * usar el envase del material, que es lo que hacía siempre.
 */
export async function getPresentaciones(): Promise<
  Map<string, (Presentacion & { id: string })[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("material_presentaciones")
    .select("id, material_id, nombre, contenido, unidad")
    .order("contenido");

  if (error) console.error("getPresentaciones:", error.message);

  const porMaterial = new Map<string, (Presentacion & { id: string })[]>();
  for (const p of data ?? []) {
    const lista = porMaterial.get(p.material_id) ?? [];
    lista.push({ id: p.id, nombre: p.nombre, contenido: Number(p.contenido), unidad: p.unidad });
    porMaterial.set(p.material_id, lista);
  }
  return porMaterial;
}

export async function getMaterialesCatalogo(): Promise<MaterialCatalogo[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("materiales")
    .select("id, nombre, unidad, contenido, contenido_unidad, rubros(nombre)")
    .order("nombre");

  return (data ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    unidad: m.unidad,
    rubroNombre: m.rubros?.nombre ?? null,
    contenido: m.contenido === null ? null : Number(m.contenido),
    contenidoUnidad: m.contenido_unidad,
  }));
}
