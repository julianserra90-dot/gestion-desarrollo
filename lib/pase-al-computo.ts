/**
 * El pase del plano al cómputo: lo que el dibujo de las plantas mide, contra
 * lo que el cómputo de la obra tiene guardado.
 *
 * SÓLO SERVIDOR. Las cuentas están en `lib/planta-computo.ts`; acá se junta
 * lo que hay que leer para hacerlas.
 *
 * Lo usan tres lugares, y por eso vive aparte: la vista previa antes de pasar,
 * el pase mismo —que no confía en lo que le mande el navegador y lo rehace— y
 * el cómputo, que avisa cuando el dibujo cambió después de la última vez.
 */

import { ordenDeRubro } from "@/lib/computo";
import type { Forma } from "@/lib/medicion";
import {
  compararConComputo,
  delPlano,
  type ItemGuardado,
  type LineaDelPase,
  type Pendientes,
} from "@/lib/planta-computo";
import { getPisos, getPlantas } from "@/lib/plantas";
import { createClient } from "@/lib/supabase/server";

export type LineaConNombre = LineaDelPase & {
  nombre: string;
  rubro: string;
  unidad: string;
};

export type Pase = {
  /** Si la obra ya tiene cómputo. Si no, se crea al pasar. */
  hayComputo: boolean;
  /** Si el cómputo ya tiene renglones que vinieron del plano. */
  yaPasado: boolean;
  /** Cada tarea que el plano mide o midió, con lo que le pasa. */
  lineas: LineaConNombre[];
  /** Las tareas del dibujo que no se pasan, con su unidad (null: ya no existe). */
  noSeMiden: { nombre: string; unidad: string | null }[];
  sinEscala: string[];
  pendientes: Pendientes;
};

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Arma el pase de una obra. Devuelve el error en vez de un pase vacío: "el
 * plano no mide nada" y "no se pudo leer el cómputo" no pueden verse igual.
 */
export async function getPase(obraId: string): Promise<{ pase: Pase } | { error: string }> {
  const supabase = await createClient();

  const [plantas, pisos, { data: computo, error: alLeerComputo }, { data: items, error: alLeerItems }] =
    await Promise.all([
      getPlantas(obraId),
      getPisos(obraId),
      supabase.from("computos").select("obra_id").eq("obra_id", obraId).maybeSingle(),
      supabase
        .from("computo_items")
        .select(
          "id, tarea_id, nombre, unidad, cantidad, orden, computo_item_medicion(origen, nivel, etiqueta, forma, a, b, c, unidades, cantidad)"
        )
        .eq("obra_id", obraId)
        .order("orden"),
    ]);

  if (alLeerComputo) return { error: alLeerComputo.message };
  if (alLeerItems) return { error: alLeerItems.message };

  // Las tareas que el dibujo nombra: el tipo de cada muro, cada capa y la
  // tarea de cada pieza de la estructura.
  const usadas = new Set<string>();
  for (const planta of plantas) {
    const d = planta.dibujo;
    for (const m of d.muros) if (m.tarea) usadas.add(m.tarea);
    for (const a of d.ambientes) {
      for (const c of [...a.capas, ...a.piso, ...a.cielorraso]) usadas.add(c.tarea);
    }
    for (const capas of Object.values(d.caras)) for (const c of capas) usadas.add(c.tarea);
    const { columnas, vigas, losas } = d.estructura;
    for (const p of [...columnas, ...vigas, ...losas]) if (p.tarea) usadas.add(p.tarea);
  }
  // Las que el cómputo tiene con renglones del plano también hacen falta por
  // su nombre, aunque el dibujo ya no las use.
  for (const i of items ?? []) {
    if (i.tarea_id && i.computo_item_medicion.some((m) => m.origen === "plano")) {
      usadas.add(i.tarea_id);
    }
  }

  // Un id que no es un uuid no está en el catálogo, y preguntarle a la base
  // por él hace fallar la consulta entera.
  const ids = [...usadas].filter((id) => ES_UUID.test(id));
  const { data: tareas, error: alLeerTareas } = ids.length
    ? await supabase.from("tareas").select("id, nombre, rubro, unidad").in("id", ids)
    : { data: [], error: null };
  if (alLeerTareas) return { error: alLeerTareas.message };

  const deCatalogo = new Map((tareas ?? []).map((t) => [t.id, t] as const));
  const enComputo = new Map<string, NonNullable<typeof items>[number]>();
  for (const i of items ?? []) {
    if (i.tarea_id && !enComputo.has(i.tarea_id)) enComputo.set(i.tarea_id, i);
  }

  // La unidad con que se cotiza: la que tiene en esta obra, que alguien pudo
  // cambiar, antes que la del catálogo.
  const unidadDe = (tareaId: string) =>
    enComputo.get(tareaId)?.unidad ?? deCatalogo.get(tareaId)?.unidad ?? null;

  const plano = delPlano(plantas, pisos, unidadDe);

  const guardados: ItemGuardado[] = (items ?? []).map((i) => ({
    id: i.id,
    tareaId: i.tarea_id,
    cantidad: Number(i.cantidad),
    medicion: i.computo_item_medicion.map((m) => ({
      origen: m.origen === "plano" ? "plano" : "mano",
      nivel: m.nivel,
      etiqueta: m.etiqueta,
      forma: m.forma as Forma,
      a: m.a === null ? null : Number(m.a),
      b: m.b === null ? null : Number(m.b),
      c: m.c === null ? null : Number(m.c),
      unidades: Number(m.unidades),
      cantidad: Number(m.cantidad),
    })),
  }));

  const lineas = compararConComputo(plano.renglones, guardados)
    .map((l): LineaConNombre => {
      const item = enComputo.get(l.tareaId);
      const tarea = deCatalogo.get(l.tareaId);
      return {
        ...l,
        nombre: item?.nombre ?? tarea?.nombre ?? "Tarea que ya no está en el catálogo",
        rubro: tarea?.rubro ?? "—",
        unidad: item?.unidad ?? tarea?.unidad ?? "",
      };
    })
    // En el orden de la obra, como la planilla del cómputo: mampostería,
    // revoques, contrapisos, pisos.
    .sort(
      (a, b) =>
        ordenDeRubro(a.rubro) - ordenDeRubro(b.rubro) ||
        a.rubro.localeCompare(b.rubro, "es") ||
        a.nombre.localeCompare(b.nombre, "es")
    );

  return {
    pase: {
      hayComputo: Boolean(computo),
      yaPasado: guardados.some((i) => i.medicion.some((m) => m.origen === "plano")),
      lineas,
      noSeMiden: plano.noSeMiden.map((n) => ({
        nombre: deCatalogo.get(n.tareaId)?.nombre ?? "Una tarea que ya no está en el catálogo",
        unidad: n.unidad,
      })),
      sinEscala: plano.sinEscala,
      pendientes: plano.pendientes,
    },
  };
}

/**
 * Cuántas tareas del cómputo quedaron distintas de lo que el plano mide
 * ahora. Cero si el plano nunca se pasó: no hay nada desactualizado, y el
 * cómputo no tiene por qué reclamar un pase que nadie pidió.
 */
export async function tareasDesactualizadas(obraId: string): Promise<number> {
  const resultado = await getPase(obraId);
  if ("error" in resultado) {
    console.error("tareasDesactualizadas:", resultado.error);
    return 0;
  }
  if (!resultado.pase.yaPasado) return 0;
  return resultado.pase.lineas.filter((l) => l.cambia).length;
}
