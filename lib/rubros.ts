/**
 * Los rubros que una obra ofrece para clasificar gastos, avances y fotos.
 *
 * SÓLO SERVIDOR.
 *
 * Cada obra tiene el catálogo entero cargado pero marca cuáles usa, así que los
 * formularios muestran únicamente los marcados. La excepción es editar algo ya
 * cargado: ahí también viaja su rubro aunque esté desmarcado, porque si no
 * desaparecería del desplegable y se perdería al guardar.
 */

import { createClient } from "@/lib/supabase/server";

export type RubroOpcion = {
  id: string;
  nombre: string;
  /** Si en este rubro se compran materiales. */
  usaMateriales: boolean;
  /** Si en este rubro se contrata mano de obra. */
  usaManoObra: boolean;
};

export async function getRubrosActivos(
  obraId: string,
  incluir?: string | null
): Promise<RubroOpcion[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("rubros")
    .select("id, nombre, activo, usa_materiales, usa_mano_obra")
    .eq("obra_id", obraId)
    .order("orden");

  return (data ?? [])
    .filter((r) => r.activo || r.id === incluir)
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      usaMateriales: r.usa_materiales,
      usaManoObra: r.usa_mano_obra,
    }));
}
