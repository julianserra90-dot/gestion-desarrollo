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
};

export async function getLote(
  obraId: string,
  valorUsd: number | null,
  superficieM2: number | null,
  vendedor: string | null,
  detalle: string | null
): Promise<Lote> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("lote_pagos")
    .select("id, fecha, categoria, concepto, monto, moneda, observaciones")
    .eq("obra_id", obraId)
    .order("fecha", { ascending: false });

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
  }));

  const sumaUsd = (filtro: (p: PagoLote) => boolean) =>
    pagos.filter(filtro).reduce((total, p) => total + (p.usd ?? 0), 0);

  const pagadoCompraUsd = sumaUsd((p) => p.categoria === "Compra");
  const asociadosUsd = sumaUsd((p) => p.categoria !== "Compra");

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
    .select("id, fecha, categoria, concepto, monto, moneda, observaciones")
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
