/**
 * El lote de una obra: la compra del terreno y sus pagos, todo en dólares.
 *
 * SÓLO SERVIDOR.
 *
 * El terreno se lleva aparte del costo de construir: no entra en el m² de obra
 * ni en el balance entre socias. Acá se junta el valor pactado con lo que se fue
 * pagando, para ver cuánto falta y cuánto salió la operación completa.
 *
 * Todo se mide en dólares porque así se compra un inmueble. Un pago en pesos
 * —una escribanía, los sellos— se valúa al dólar de su fecha, igual que en la
 * solapa Dólares.
 */

import { getConvertidor } from "@/lib/dolar";
import { calcularLiquidacion, type Transferencia } from "@/lib/liquidacion";
import { type CategoriaLote, esCategoriaLote } from "@/lib/lote-tipos";
import { createClient } from "@/lib/supabase/server";

export {
  CATEGORIAS_LOTE,
  CATEGORIAS_ASOCIADAS,
  esCategoriaLote,
  type CategoriaLote,
} from "@/lib/lote-tipos";

export type PagoLote = {
  id: string;
  fecha: string;
  categoria: CategoriaLote;
  concepto: string;
  monto: number;
  moneda: "ARS" | "USD";
  /** El pago valuado en dólares al cambio de su fecha. */
  usd: number | null;
  observaciones: string | null;
  /** La socia que lo pagó. Null si todavía no se asignó. */
  empresaId: string | null;
  empresa: string | null;
};

/** Lo que cada socia puso en el lote, contra lo que le toca por su porcentaje. */
export type SocioLote = {
  empresaId: string;
  empresa: string;
  porcentaje: number;
  /** Lo que efectivamente puso, en USD. */
  puestoUsd: number;
  /** Su parte del total desembolsado, según el porcentaje. */
  leCorrespondeUsd: number;
  /** Puesto menos lo que le corresponde: positivo puso de más. */
  saldoUsd: number;
};

export type Lote = {
  /** Precio pactado de compra, en USD. */
  valorUsd: number | null;
  superficieM2: number | null;
  vendedor: string | null;
  detalle: string | null;
  pagos: PagoLote[];
  /** Pagado del precio (categoría Compra), en USD. */
  pagadoCompraUsd: number;
  /** Lo que falta del precio pactado. Null si no hay precio cargado. */
  saldoUsd: number | null;
  /** Escribanía, sellos, comisión y otros, en USD. */
  asociadosUsd: number;
  /** Todo lo desembolsado por el lote: compra pagada + asociados. */
  totalUsd: number;
  /** Cuántos pagos no se pudieron valuar por falta de cotización. */
  sinCotizar: number;
  /** El reparto del lote entre socias, con sus saldos. */
  socios: SocioLote[];
  /** Quién le transfiere a quién para emparejar el lote. */
  liquidacion: Transferencia[];
  /** Lo desembolsado que todavía no se atribuyó a una socia, en USD. */
  sinAsignarUsd: number;
};

export async function getLote(
  obraId: string,
  valorUsd: number | null,
  superficieM2: number | null,
  vendedor: string | null,
  detalle: string | null
): Promise<Lote> {
  const supabase = await createClient();

  const [{ data }, { data: socios }] = await Promise.all([
    supabase
      .from("lote_pagos")
      .select(
        "id, fecha, categoria, concepto, monto, moneda, observaciones, empresa_id, empresas(nombre)"
      )
      .eq("obra_id", obraId)
      .order("fecha", { ascending: false }),
    supabase
      .from("obra_socios")
      .select("empresa_id, porcentaje, empresas(nombre)")
      .eq("obra_id", obraId),
  ]);

  const filas = data ?? [];
  const convertidor = await getConvertidor(filas.map((p) => p.fecha));

  const aUsd = (monto: number, moneda: string, fecha: string): number | null => {
    if (moneda === "USD") return monto;
    const cotizacion = convertidor.cotizacionDe(fecha);
    return cotizacion ? monto / cotizacion : null;
  };

  const pagos: PagoLote[] = filas.map((p) => ({
    id: p.id,
    fecha: p.fecha,
    categoria: esCategoriaLote(p.categoria) ? p.categoria : "Otro",
    concepto: p.concepto,
    monto: Number(p.monto),
    moneda: p.moneda === "ARS" ? "ARS" : "USD",
    usd: aUsd(Number(p.monto), p.moneda, p.fecha),
    observaciones: p.observaciones,
    empresaId: p.empresa_id,
    empresa: p.empresas?.nombre ?? null,
  }));

  const sumaUsd = (filtro: (p: PagoLote) => boolean) =>
    pagos.filter(filtro).reduce((total, p) => total + (p.usd ?? 0), 0);

  const pagadoCompraUsd = sumaUsd((p) => p.categoria === "Compra");
  const asociadosUsd = sumaUsd((p) => p.categoria !== "Compra");

  // El reparto se calcula sobre lo atribuido: un pago sin empresa no le puede
  // corresponder a nadie, así que queda afuera y los saldos siguen dando cero.
  const atribuidoUsd = sumaUsd((p) => p.empresaId !== null);

  const listaSocios: SocioLote[] = (socios ?? [])
    .map((s) => {
      const puestoUsd = sumaUsd((p) => p.empresaId === s.empresa_id);
      const leCorrespondeUsd = (Number(s.porcentaje) / 100) * atribuidoUsd;

      return {
        empresaId: s.empresa_id,
        empresa: s.empresas?.nombre ?? "—",
        porcentaje: Number(s.porcentaje),
        puestoUsd,
        leCorrespondeUsd,
        saldoUsd: puestoUsd - leCorrespondeUsd,
      };
    })
    .sort((a, b) => a.empresa.localeCompare(b.empresa));

  return {
    valorUsd,
    superficieM2,
    vendedor,
    detalle,
    pagos,
    pagadoCompraUsd,
    saldoUsd: valorUsd === null ? null : valorUsd - pagadoCompraUsd,
    asociadosUsd,
    totalUsd: pagadoCompraUsd + asociadosUsd,
    sinCotizar: pagos.filter((p) => p.usd === null).length,
    socios: listaSocios,
    liquidacion: calcularLiquidacion(
      listaSocios.map((s) => ({ empresa: s.empresa, saldo: s.saldoUsd }))
    ),
    sinAsignarUsd: sumaUsd((p) => p.empresaId === null),
  };
}

/** Un pago puntual, para editarlo. */
export async function getPagoLote(
  obraId: string,
  pagoId: string
): Promise<PagoLote | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("lote_pagos")
    .select(
      "id, fecha, categoria, concepto, monto, moneda, observaciones, empresa_id, empresas(nombre)"
    )
    .eq("id", pagoId)
    .eq("obra_id", obraId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    fecha: data.fecha,
    categoria: esCategoriaLote(data.categoria) ? data.categoria : "Otro",
    concepto: data.concepto,
    monto: Number(data.monto),
    moneda: data.moneda === "ARS" ? "ARS" : "USD",
    usd: null,
    observaciones: data.observaciones,
    empresaId: data.empresa_id,
    empresa: data.empresas?.nombre ?? null,
  };
}

/**
 * La incidencia del terreno: cuánto del costo por m² construido es tierra. Es
 * la lectura de negocio del lote —un terreno caro sube el piso de toda la obra—.
 */
export function incidenciaPorM2(
  valorUsd: number | null,
  superficieConstruidaM2: number | null
): number | null {
  if (!valorUsd || !superficieConstruidaM2 || superficieConstruidaM2 <= 0) {
    return null;
  }
  return valorUsd / superficieConstruidaM2;
}
