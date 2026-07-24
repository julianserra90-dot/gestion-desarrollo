/**
 * El avance físico de una obra, rubro por rubro.
 *
 * SÓLO SERVIDOR.
 *
 * Cada carga dice cuánto se avanzó EN ESOS DÍAS, no el total a esa fecha, así
 * que el avance de un rubro es la suma de sus cargas. Esa forma tiene una
 * ventaja concreta: cada fila del historial responde "qué se hizo esta semana",
 * que es la pregunta que se hace en obra.
 */

import { estadoDe } from "@/lib/estado-avance";
import { createClient } from "@/lib/supabase/server";

export type RubroConAvance = {
  rubroId: string;
  nombre: string;
  acumulado: number;
  estado: string;
  cantCargas: number;
  /** El último día cubierto por una carga. */
  ultimaFecha: string | null;
  /** La cotización aprobada: lo que el rubro pesa en el avance general. */
  peso: number;
};

export type CargaDeAvance = {
  id: string;
  porcentaje: number;
  comentario: string | null;
  fechaDesde: string;
  fechaHasta: string;
  cargadoPor: string | null;
  /** Cuánto daba el acumulado del rubro después de esta carga. */
  acumulado: number;
};

/**
 * Los rubros que la obra usa, con su avance. Los desmarcados no aparecen: sus
 * cargas quedan guardadas por si se vuelven a marcar.
 */
export async function getAvancePorRubro(
  obraId: string
): Promise<RubroConAvance[]> {
  const supabase = await createClient();

  const [{ data: rubros }, { data: cargas }, { data: cotizaciones }] =
    await Promise.all([
      supabase
        .from("rubros")
        .select("id, nombre, orden")
        .eq("obra_id", obraId)
        .eq("activo", true)
        .order("orden"),
      supabase
        .from("avances")
        .select("rubro_id, porcentaje, fecha_hasta")
        .eq("obra_id", obraId),
      supabase
        .from("presupuestos")
        .select("rubro_id, monto")
        .eq("obra_id", obraId)
        .eq("estado", "Aprobado"),
    ]);

  const acumulados = new Map<string, number>();
  const cantidades = new Map<string, number>();
  const ultimas = new Map<string, string>();

  for (const carga of cargas ?? []) {
    const previo = acumulados.get(carga.rubro_id) ?? 0;
    acumulados.set(carga.rubro_id, previo + carga.porcentaje);
    cantidades.set(carga.rubro_id, (cantidades.get(carga.rubro_id) ?? 0) + 1);

    const ultima = ultimas.get(carga.rubro_id);
    if (!ultima || carga.fecha_hasta > ultima) {
      ultimas.set(carga.rubro_id, carga.fecha_hasta);
    }
  }

  const pesos = new Map<string, number>();
  for (const cot of cotizaciones ?? []) {
    pesos.set(cot.rubro_id, (pesos.get(cot.rubro_id) ?? 0) + Number(cot.monto));
  }

  return (rubros ?? []).map((r) => {
    const acumulado = acumulados.get(r.id) ?? 0;

    return {
      rubroId: r.id,
      nombre: r.nombre,
      acumulado,
      estado: estadoDe(acumulado),
      cantCargas: cantidades.get(r.id) ?? 0,
      ultimaFecha: ultimas.get(r.id) ?? null,
      peso: pesos.get(r.id) ?? 0,
    };
  });
}

/**
 * El avance general de la obra: cada rubro pesa lo que cuesta.
 *
 * Demoler al 100% mueve mucho menos que albañilería al 50%, y el promedio
 * simple no lo veía. Sin cotizaciones aprobadas no hay con qué ponderar, y ahí
 * cae al promedio simple para que una obra recién arrancada muestre algo.
 *
 * Misma fórmula que `obra_resumen.avance_fisico` en la base, que es la que
 * alimenta el listado de obras.
 */
export function avanceGeneral(rubros: RubroConAvance[]): number {
  if (rubros.length === 0) return 0;

  // Un rubro pasado de 100 no infla el general: se corta ahí.
  const tope = (n: number) => Math.min(n, 100);
  const pesoTotal = rubros.reduce((t, r) => t + r.peso, 0);

  if (pesoTotal <= 0) {
    return Math.round(
      rubros.reduce((t, r) => t + tope(r.acumulado), 0) / rubros.length
    );
  }

  return Math.round(
    rubros.reduce((t, r) => t + tope(r.acumulado) * r.peso, 0) / pesoTotal
  );
}

/**
 * El historial de un rubro, de la carga más nueva a la más vieja, con el
 * acumulado que daba en cada momento.
 */
export async function getCargasDeRubro(
  obraId: string,
  rubroId: string
): Promise<CargaDeAvance[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("avances")
    .select(
      "id, porcentaje, comentario, fecha_desde, fecha_hasta, actualizado_por_nombre"
    )
    .eq("obra_id", obraId)
    .eq("rubro_id", rubroId)
    .order("fecha_desde", { ascending: true })
    .order("actualizado_en", { ascending: true });

  // El acumulado se arma en orden cronológico y recién después se da vuelta,
  // así cada fila muestra cuánto llevaba la obra en ese momento.
  let acumulado = 0;

  const cargas = (data ?? []).map((c) => {
    acumulado += c.porcentaje;

    return {
      id: c.id,
      porcentaje: c.porcentaje,
      comentario: c.comentario,
      fechaDesde: c.fecha_desde,
      fechaHasta: c.fecha_hasta,
      cargadoPor: c.actualizado_por_nombre,
      acumulado,
    };
  });

  return cargas.reverse();
}

export type UltimaActividad = {
  rubroId: string;
  rubro: string;
  porcentaje: number;
  comentario: string | null;
  fechaHasta: string;
  cargadoPor: string | null;
};

/** La última carga de avance de la obra, sea de qué rubro sea. */
export async function getUltimaActividad(
  obraId: string
): Promise<UltimaActividad | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("avances")
    .select(
      "rubro_id, porcentaje, comentario, fecha_hasta, actualizado_por_nombre, rubros(nombre)"
    )
    .eq("obra_id", obraId)
    .order("fecha_hasta", { ascending: false })
    .order("actualizado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    rubroId: data.rubro_id,
    rubro: data.rubros?.nombre ?? "Sin rubro",
    porcentaje: data.porcentaje,
    comentario: data.comentario,
    fechaHasta: data.fecha_hasta,
    cargadoPor: data.actualizado_por_nombre,
  };
}

/** Una carga puntual, para editarla. */
export async function getCarga(
  obraId: string,
  avanceId: string
): Promise<(CargaDeAvance & { rubroId: string }) | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("avances")
    .select(
      "id, rubro_id, porcentaje, comentario, fecha_desde, fecha_hasta, actualizado_por_nombre"
    )
    .eq("id", avanceId)
    .eq("obra_id", obraId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    rubroId: data.rubro_id,
    porcentaje: data.porcentaje,
    comentario: data.comentario,
    fechaDesde: data.fecha_desde,
    fechaHasta: data.fecha_hasta,
    cargadoPor: data.actualizado_por_nombre,
    acumulado: 0,
  };
}
