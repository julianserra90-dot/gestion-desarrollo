/**
 * Lo gastado y lo cotizado de una obra, medido en dólares.
 *
 * SÓLO SERVIDOR.
 *
 * Cada movimiento se valúa al dólar de SU fecha, no a una cotización única
 * aplicada a todo. Sumados, dan el equivalente al dólar promedio real de la
 * obra, ponderado por cuánto se gastó en cada momento: es la única forma de que
 * comparar febrero con noviembre signifique algo.
 */

import { getConvertidor } from "@/lib/dolar";
import { createClient } from "@/lib/supabase/server";

export type TotalesUsd = {
  /** Lo gastado, en pesos nominales. */
  gastadoArs: number;
  /** Lo gastado, cada gasto al dólar de su fecha. */
  gastadoUsd: number;
  /** Las cotizaciones aprobadas, al dólar de su fecha. Null si no hay. */
  aprobadoUsd: number | null;
  /** Cuántos movimientos no se pudieron convertir por falta de cotización. */
  sinCotizar: number;
};

type Movimiento = {
  fecha: string;
  monto: number;
  monto_usd: number | null;
  cotizacion: number | null;
};

export async function getTotalesUsd(obraId: string): Promise<TotalesUsd> {
  const supabase = await createClient();

  const [{ data: gastos }, { data: presupuestos }] = await Promise.all([
    supabase
      .from("gastos")
      .select("fecha, monto, monto_usd, cotizacion, estado, tipo_gasto")
      .eq("obra_id", obraId),
    supabase
      .from("presupuestos")
      .select("fecha, monto, monto_usd, cotizacion")
      .eq("obra_id", obraId)
      .eq("estado", "Aprobado"),
  ]);

  // Mismo criterio que el resto de la app: un gasto anulado no se gastó, y un
  // ajuste de saldo no es obra construida.
  const vigentes = (gastos ?? []).filter(
    (g) => g.estado !== "Anulado" && g.tipo_gasto !== "Ajuste de saldo"
  );

  const aprobados = presupuestos ?? [];

  const convertidor = await getConvertidor([
    ...vigentes.map((g) => g.fecha),
    ...aprobados.map((p) => p.fecha),
  ]);

  /**
   * Si el movimiento se guardó con su conversión se usa esa; si es viejo y no
   * la tiene, se calcula al dólar de su fecha.
   */
  const aDolares = (m: Movimiento): number | null => {
    if (m.monto_usd !== null) return Number(m.monto_usd);

    const cotizacion =
      Number(m.cotizacion) || convertidor.cotizacionDe(m.fecha);

    return cotizacion ? Number(m.monto) / cotizacion : null;
  };

  const usdGastos = vigentes.map(aDolares);
  const usdAprobados = aprobados.map(aDolares);

  const sumar = (valores: (number | null)[]) =>
    valores.reduce<number>((total, v) => total + (v ?? 0), 0);

  return {
    gastadoArs: vigentes.reduce((total, g) => total + Number(g.monto), 0),
    gastadoUsd: sumar(usdGastos),
    aprobadoUsd: aprobados.length > 0 ? sumar(usdAprobados) : null,
    sinCotizar: [...usdGastos, ...usdAprobados].filter((v) => v === null).length,
  };
}
