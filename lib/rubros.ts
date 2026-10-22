/**
 * Los rubros que una obra ofrece para clasificar gastos, avances y fotos.
 *
 * SÓLO SERVIDOR.
 *
 * Cada obra tiene el catálogo entero cargado pero marca cuáles usa, así que los
 * formularios muestran únicamente los marcados. La excepción es editar algo ya
 * cargado: ahí también viaja su rubro aunque esté desmarcado, porque si no
 * desaparecería del desplegable y se perdería al guardar.
 *
 * El formulario de gasto es el otro caso aparte: pide **todos** con
 * `getRubrosDeObra` para poder ofrecer los que la obra no usa y activarlos al
 * guardar. Cargar un gasto de algo que todavía no estaba marcado era salir a la
 * solapa Rubros y volver, perdiendo el gasto a medio cargar —el mismo problema
 * que el alta de un material desde el formulario ya había resuelto—.
 */

import { createClient } from "@/lib/supabase/server";

export type RubroOpcion = {
  id: string;
  nombre: string;
  /** Si la obra lo usa. Los formularios muestran sólo los marcados, salvo el de
   *  gasto, que ofrece los otros para activarlos. */
  activo: boolean;
  /** Si en este rubro se compran materiales. */
  usaMateriales: boolean;
  /** Si en este rubro se contrata mano de obra. */
  usaManoObra: boolean;
  /** Si en este rubro se cotiza mano de obra y materiales juntos, en un solo papel. */
  usaCombinado: boolean;
  /** Si en este rubro se cotizan honorarios o trámites: lo que se paga sin
   *  comprar ni contratar. */
  usaAdministrativo: boolean;
};

/** Todos los rubros de la obra, marcados o no, en orden alfabético. */
export async function getRubrosDeObra(obraId: string): Promise<RubroOpcion[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("rubros")
    .select(
      "id, nombre, activo, usa_materiales, usa_mano_obra, usa_mano_obra_y_materiales, usa_administrativo"
    )
    .eq("obra_id", obraId)
    .order("nombre");

  return (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    activo: r.activo,
    usaMateriales: r.usa_materiales,
    usaManoObra: r.usa_mano_obra,
    usaCombinado: r.usa_mano_obra_y_materiales,
    usaAdministrativo: r.usa_administrativo,
  }));
}

export async function getRubrosActivos(
  obraId: string,
  incluir?: string | null
): Promise<RubroOpcion[]> {
  const rubros = await getRubrosDeObra(obraId);

  return rubros.filter((r) => r.activo || r.id === incluir);
}
