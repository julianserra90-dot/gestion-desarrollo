/**
 * El ajuste por índice CAC, sin nada de base de datos: lo usan la pantalla del
 * cómputo y la del índice.
 *
 * Todo se lleva **al último mes cargado**: el estimado, lo cotizado y lo
 * gastado quedan "a valores de" ese mes y recién ahí se comparan. Llevarlos al
 * mes de los precios del cómputo daría la misma proporción, pero en pesos de
 * hace meses, que no se leen contra nada.
 *
 * Los meses viajan como clave "2026-07", igual que en Flujo.
 */

export type IndiceCac = { mes: string; valor: number };

/** "2026-07-01" → "2026-07". */
export function mesDeFecha(fecha: string) {
  return fecha.slice(0, 7);
}

/**
 * El índice que rige en un mes: el de ese mes o, si todavía no salió, el del
 * último mes anterior cargado. El CAC se publica con semanas de atraso, y un
 * gasto de este mes no puede quedar sin ajustar por eso: se lo toma a valores
 * del último índice conocido, que es lo mejor que hay.
 *
 * Null si el mes es anterior a todo lo cargado: ahí no hay contra qué ajustar.
 */
export function indiceDelMes(indices: IndiceCac[], mes: string): number | null {
  let valor: number | null = null;

  // Vienen ordenados de más viejo a más nuevo.
  for (const i of indices) {
    if (i.mes > mes) break;
    valor = i.valor;
  }

  return valor;
}

/** El mes al que se lleva todo: el último índice cargado. */
export function mesDeReferencia(indices: IndiceCac[]): string | null {
  return indices.length > 0 ? indices[indices.length - 1].mes : null;
}

/**
 * Por cuánto multiplicar un monto de `mes` para llevarlo al mes de referencia.
 *
 * 1 cuando no se puede ajustar (sin índices, o un mes anterior a todos): el
 * monto queda en sus pesos y la pantalla avisa que hay montos sin ajustar, en
 * vez de inventar un factor.
 */
export function factorCac(indices: IndiceCac[], mes: string) {
  const referencia = mesDeReferencia(indices);
  if (!referencia) return { factor: 1, ajustado: false };

  const desde = indiceDelMes(indices, mes);
  const hasta = indiceDelMes(indices, referencia);
  if (!desde || !hasta) return { factor: 1, ajustado: false };

  return { factor: hasta / desde, ajustado: true };
}

/** Cuánto se fue un número del estimado, en porcentaje. Null sin estimado. */
export function desvio(real: number, estimado: number): number | null {
  if (estimado <= 0) return null;
  return ((real - estimado) / estimado) * 100;
}
