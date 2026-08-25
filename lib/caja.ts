/**
 * Dinero en cuenta: la caja de la obra.
 *
 * SÓLO SERVIDOR: lee de la base. El cálculo de cómo se reparte un pago vive en
 * `lib/reparto.ts`, que es puro y lo usa también el formulario.
 *
 * La cuenta tiene dos lados que no se mezclan solos. Los pesos que entran
 * quedan como pesos y los dólares como dólares, hasta que alguien los use para
 * pagar un gasto. Recién ahí se define a cuánto se vendieron esos dólares, que
 * rara vez es el blue de Ámbito.
 */

import { createClient } from "@/lib/supabase/server";

export type Caja = {
  /** Lado en pesos. */
  arsIngresado: number;
  arsUsado: number;
  arsSaldo: number;
  /** Lado en dólares. Son dólares de verdad, no una valuación. */
  usdIngresado: number;
  usdUsado: number;
  usdSaldo: number;
  /** Todo valuado en pesos al día de cada movimiento, para el balance. */
  ingresos: number;
  ingresosSocias: number;
  ingresosTerceros: number;
  usado: number;
};

const VACIA: Caja = {
  arsIngresado: 0,
  arsUsado: 0,
  arsSaldo: 0,
  usdIngresado: 0,
  usdUsado: 0,
  usdSaldo: 0,
  ingresos: 0,
  ingresosSocias: 0,
  ingresosTerceros: 0,
  usado: 0,
};

export async function getCaja(obraId: string): Promise<Caja> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("obra_caja")
    .select(
      "ars_ingresado, ars_usado, ars_saldo, usd_ingresado, usd_usado, usd_saldo, ingresos, ingresos_socias, ingresos_terceros, usado"
    )
    .eq("obra_id", obraId)
    .maybeSingle();

  if (!data) return VACIA;

  return {
    arsIngresado: Number(data.ars_ingresado ?? 0),
    arsUsado: Number(data.ars_usado ?? 0),
    arsSaldo: Number(data.ars_saldo ?? 0),
    usdIngresado: Number(data.usd_ingresado ?? 0),
    usdUsado: Number(data.usd_usado ?? 0),
    usdSaldo: Number(data.usd_saldo ?? 0),
    ingresos: Number(data.ingresos ?? 0),
    ingresosSocias: Number(data.ingresos_socias ?? 0),
    ingresosTerceros: Number(data.ingresos_terceros ?? 0),
    usado: Number(data.usado ?? 0),
  };
}
