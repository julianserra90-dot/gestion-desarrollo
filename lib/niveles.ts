/**
 * Qué lleva cada nivel de la obra.
 *
 * SÓLO SERVIDOR.
 *
 * La medición de cada tarea sabe a qué piso pertenece cada elemento. Juntando
 * las de toda la obra sale la pregunta que antes no se podía contestar: **qué
 * cuesta el primer piso**. Hasta ahora el cómputo sólo sabía sumar por rubro,
 * que es cómo se cotiza, no cómo se construye.
 *
 * El cuadro es el mismo que cierra cualquier planilla de hormigón: los niveles
 * abajo uno de otro y las tareas como columnas. Cada celda va en la unidad de
 * su tarea —m³ de vigas, m² de mampostería— y por eso no se suman entre sí.
 * Lo que sí se suma es la última columna, que está en pesos.
 */

import type { ItemComputo } from "@/lib/computo";
import { createClient } from "@/lib/supabase/server";

export type TareaMedida = {
  itemId: string;
  nombre: string;
  unidad: string;
  /** Lo que sale una unidad de la tarea: la suma de su desglose. */
  precioUnitario: number;
};

export type FilaDeNivel = {
  /** "" cuando los elementos no declararon piso; en pantalla, "Sin nivel". */
  nivel: string;
  /** Cuánto lleva este nivel de cada tarea, por id de tarea. */
  cantidades: Record<string, number>;
  /** Lo que cuesta este nivel, a los precios del cómputo. */
  costo: number;
  elementos: number;
  /** Cuántos elementos todavía no suman porque les falta una medida. */
  sinMedir: number;
};

export type ResumenPorNivel = {
  filas: FilaDeNivel[];
  /** Las columnas del cuadro: las tareas que tienen medición. */
  tareas: TareaMedida[];
  costoTotal: number;
  /**
   * Lo que el cuadro **no** cubre: las tareas del cómputo que tienen cantidad
   * pero no están medidas, así que no se sabe a qué piso va lo suyo.
   *
   * Va a la vista y no escondido: un cuadro que dice "la obra son doce
   * millones" cuando en realidad son treinta, porque sólo se midió el
   * hormigón, es peor que no tener cuadro.
   */
  sinMedicion: { tareas: number; costo: number };
};

/**
 * El cuadro de niveles de una obra.
 *
 * Se arma con lo guardado en la medición, no recalculando las medidas: la
 * cantidad de cada elemento la decidió el servidor al guardarla, y es la misma
 * de la que sale la cantidad de la tarea.
 *
 * Un elemento en cero es uno al que le falta una medida: no suma, pero se
 * cuenta aparte para que se vea cuánto del cuadro está todavía por verificar.
 */
export async function getResumenPorNivel(computo: {
  items: ItemComputo[];
}): Promise<ResumenPorNivel> {
  const precioDe = (i: ItemComputo) =>
    i.precioMateriales + i.precioManoObra + i.precioIntegrado;

  const conMedicion = computo.items.filter((i) => i.elementosMedidos > 0);
  const vacio: ResumenPorNivel = {
    filas: [],
    tareas: [],
    costoTotal: 0,
    sinMedicion: sinMedicionDe(computo.items, precioDe),
  };

  if (conMedicion.length === 0) return vacio;

  const supabase = await createClient();
  const { data } = await supabase
    .from("computo_item_medicion")
    .select("item_id, nivel, cantidad, orden")
    .in(
      "item_id",
      conMedicion.map((i) => i.id)
    )
    .order("orden");

  if (!data?.length) return vacio;

  const porItem = new Map(conMedicion.map((i) => [i.id, i]));

  // Las tareas, en el orden del cómputo: es el de la obra, de la excavación a
  // la limpieza final, y así las columnas se leen como la planilla.
  const tareas: TareaMedida[] = conMedicion
    .filter((i) => data.some((e) => e.item_id === i.id))
    .map((i) => ({
      itemId: i.id,
      nombre: i.nombre,
      unidad: i.unidad,
      precioUnitario: precioDe(i),
    }));

  // Los niveles, en el orden en que aparecen. Alfabético pondría "Sobre 1.º"
  // antes que "Sobre planta baja", al revés de como se construye.
  const filas: FilaDeNivel[] = [];
  const porNivel = new Map<string, FilaDeNivel>();

  for (const e of data) {
    const item = porItem.get(e.item_id);
    if (!item) continue;

    const nivel = (e.nivel ?? "").trim();
    let fila = porNivel.get(nivel);
    if (!fila) {
      fila = { nivel, cantidades: {}, costo: 0, elementos: 0, sinMedir: 0 };
      porNivel.set(nivel, fila);
      filas.push(fila);
    }

    const cantidad = Number(e.cantidad);
    fila.cantidades[e.item_id] = (fila.cantidades[e.item_id] ?? 0) + cantidad;
    fila.costo += cantidad * precioDe(item);
    fila.elementos += 1;
    if (cantidad <= 0) fila.sinMedir += 1;
  }

  return {
    filas,
    tareas,
    costoTotal: filas.reduce((a, f) => a + f.costo, 0),
    sinMedicion: sinMedicionDe(computo.items, precioDe),
  };
}

/**
 * Lo que queda afuera del cuadro: tareas con cantidad cargada a mano y sin
 * medición, que es de donde saldría el nivel.
 */
function sinMedicionDe(items: ItemComputo[], precioDe: (i: ItemComputo) => number) {
  const sueltas = items.filter((i) => i.elementosMedidos === 0 && i.cantidad > 0);
  return {
    tareas: sueltas.length,
    costo: sueltas.reduce((a, i) => a + i.cantidad * precioDe(i), 0),
  };
}
