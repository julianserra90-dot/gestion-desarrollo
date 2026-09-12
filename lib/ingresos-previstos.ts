/**
 * La agenda de ingresos de una obra: las cuotas que las socias van a poner.
 *
 * SÓLO SERVIDOR: lee de la base.
 *
 * Contesta cuánto falta por entrar y cuándo. Cada cuota prevista sabe si ya la
 * cumplió un ingreso real (el ingreso apunta a ella con `previsto_id`). Los dos
 * lados —pesos y dólares— van separados como en toda la app: una cuota en
 * dólares se espera en dólares y no se valúa en pesos para sumarla.
 */

import { createClient } from "@/lib/supabase/server";

export type EstadoPrevisto = "pendiente" | "vencida" | "ingresada";

export type IngresoPrevisto = {
  id: string;
  empresaId: string;
  empresaNombre: string;
  serieId: string;
  numeroCuota: number;
  fechaPrevista: string;
  monto: number;
  moneda: string;
  detalle: string;
  observaciones: string | null;
  estado: EstadoPrevisto;
  /** El ingreso real que la cumplió, si ya entró. Monto en su moneda. */
  ingreso: { id: string; fecha: string; monto: number; moneda: string } | null;
};

export type ResumenPrevistos = {
  previstoArs: number;
  previstoUsd: number;
  ingresadoArs: number;
  ingresadoUsd: number;
  faltaArs: number;
  faltaUsd: number;
  pendientes: number;
  vencidas: number;
};

/** Hoy en formato ISO, para saber qué cuotas ya pasaron de fecha. */
function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

const SELECT =
  "id, empresa_id, serie_id, numero_cuota, fecha_prevista, monto, moneda, detalle, observaciones, empresas(nombre), ingresos(id, fecha, moneda, monto, monto_usd)";

type Fila = {
  id: string;
  empresa_id: string;
  serie_id: string;
  numero_cuota: number;
  fecha_prevista: string;
  monto: number;
  moneda: string;
  detalle: string;
  observaciones: string | null;
  empresas: { nombre: string } | null;
  ingresos: { id: string; fecha: string; moneda: string; monto: number; monto_usd: number | null }[];
};

function armar(f: Fila, hoy: string): IngresoPrevisto {
  // Una cuota se cumple con un solo ingreso (índice único en la base), pero
  // la relación viene como lista.
  const real = f.ingresos[0] ?? null;

  const ingreso = real
    ? {
        id: real.id,
        fecha: real.fecha,
        moneda: real.moneda,
        monto:
          real.moneda === "USD" ? Number(real.monto_usd ?? 0) : Number(real.monto),
      }
    : null;

  const estado: EstadoPrevisto = ingreso
    ? "ingresada"
    : f.fecha_prevista < hoy
      ? "vencida"
      : "pendiente";

  return {
    id: f.id,
    empresaId: f.empresa_id,
    empresaNombre: f.empresas?.nombre ?? "—",
    serieId: f.serie_id,
    numeroCuota: f.numero_cuota,
    fechaPrevista: f.fecha_prevista,
    monto: Number(f.monto),
    moneda: f.moneda,
    detalle: f.detalle,
    observaciones: f.observaciones,
    estado,
    ingreso,
  };
}

/** Toda la agenda, de la cuota más próxima a la más lejana. */
export async function getIngresosPrevistos(obraId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("ingresos_previstos")
    .select(SELECT)
    .eq("obra_id", obraId)
    .order("fecha_prevista", { ascending: true })
    .order("numero_cuota", { ascending: true });

  const hoy = hoyIso();
  return ((data ?? []) as Fila[]).map((f) => armar(f, hoy));
}

export async function getIngresoPrevisto(obraId: string, previstoId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("ingresos_previstos")
    .select(SELECT)
    .eq("obra_id", obraId)
    .eq("id", previstoId)
    .maybeSingle();

  return data ? armar(data as Fila, hoyIso()) : null;
}

/**
 * Los totales de la agenda. Lo ingresado se cuenta por lo que entró de verdad
 * (el monto del ingreso real), no por lo previsto: si una cuota de 4.000 entró
 * como 3.800, faltan 200 aunque la cuota figure cumplida.
 */
export function resumirPrevistos(cuotas: IngresoPrevisto[]): ResumenPrevistos {
  const r: ResumenPrevistos = {
    previstoArs: 0,
    previstoUsd: 0,
    ingresadoArs: 0,
    ingresadoUsd: 0,
    faltaArs: 0,
    faltaUsd: 0,
    pendientes: 0,
    vencidas: 0,
  };

  for (const c of cuotas) {
    const esUsd = c.moneda === "USD";
    if (esUsd) r.previstoUsd += c.monto;
    else r.previstoArs += c.monto;

    if (c.ingreso) {
      // Sólo cuenta si entró en la misma moneda de la cuota; si entró en la
      // otra, no se valúa: la cuota sigue figurando como no cubierta en su
      // moneda, que es lo que se ve en la fila.
      if (c.ingreso.moneda === c.moneda) {
        if (esUsd) r.ingresadoUsd += c.ingreso.monto;
        else r.ingresadoArs += c.ingreso.monto;
      }
    } else if (c.estado === "vencida") {
      r.vencidas += 1;
    } else {
      r.pendientes += 1;
    }
  }

  r.faltaArs = Math.max(0, r.previstoArs - r.ingresadoArs);
  r.faltaUsd = Math.max(0, r.previstoUsd - r.ingresadoUsd);
  return r;
}
