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
  /** Lo que el rubro pesa en el avance general: su mejor costo conocido. */
  peso: number;
  /** De dónde salió el peso, para poder explicarlo en pantalla. */
  pesoDe: "cotizacion" | "computo" | null;
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
  /** La arma el sistema con lo hecho por tarea (3D y a mano): no se edita. */
  desdeElPlano: boolean;
};

/**
 * Los rubros que la obra usa, con su avance. Los desmarcados no aparecen: sus
 * cargas quedan guardadas por si se vuelven a marcar.
 */
export async function getAvancePorRubro(
  obraId: string
): Promise<RubroConAvance[]> {
  const supabase = await createClient();

  const [{ data: rubros }, { data: cargas }, { data: cotizaciones }, { data: items }] =
    await Promise.all([
      supabase
        .from("rubros")
        .select("id, nombre, orden")
        .eq("obra_id", obraId)
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("avances")
        .select("rubro_id, porcentaje, fecha_hasta")
        .eq("obra_id", obraId),
      supabase
        .from("presupuestos")
        .select("rubro_id, monto")
        .eq("obra_id", obraId)
        .eq("estado", "Aprobado"),
      supabase
        .from("computo_items")
        .select("rubro_id, cantidad, precio_materiales, precio_mano_obra, precio_integrado")
        .eq("obra_id", obraId),
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

  const cotizado = new Map<string, number>();
  for (const cot of cotizaciones ?? []) {
    cotizado.set(cot.rubro_id, (cotizado.get(cot.rubro_id) ?? 0) + Number(cot.monto));
  }

  // Lo estimado por rubro, como en la pantalla de incidencia: cantidad ×
  // precio, los tres tipos juntos —el que la tarea no lleva ya está en cero—.
  // Sin ajuste por CAC a propósito: el cómputo entero está en los precios de
  // un mes, así que el factor sería el mismo para todos los rubros y no
  // cambia cuánto pesa cada uno.
  const estimado = new Map<string, number>();
  for (const i of items ?? []) {
    const unitario =
      Number(i.precio_materiales) +
      Number(i.precio_mano_obra) +
      Number(i.precio_integrado);
    estimado.set(
      i.rubro_id,
      (estimado.get(i.rubro_id) ?? 0) + Number(i.cantidad) * unitario
    );
  }

  return (rubros ?? []).map((r) => {
    const acumulado = acumulados.get(r.id) ?? 0;
    const cot = cotizado.get(r.id) ?? 0;
    const est = estimado.get(r.id) ?? 0;
    // El mejor costo conocido del rubro. Un rubro sin ninguna de las dos cosas
    // pesa cero, que es lo que lo deja afuera del ponderado en vez de meterlo
    // con un peso inventado.
    const peso = cot > 0 ? cot : est;

    return {
      rubroId: r.id,
      nombre: r.nombre,
      acumulado,
      estado: estadoDe(acumulado),
      cantCargas: cantidades.get(r.id) ?? 0,
      ultimaFecha: ultimas.get(r.id) ?? null,
      peso,
      pesoDe: peso > 0 ? (cot > 0 ? "cotizacion" : "computo") : null,
    };
  });
}

/**
 * El avance general de la obra: cada rubro pesa lo que cuesta.
 *
 * Demoler al 100% mueve mucho menos que albañilería al 50%, y el promedio
 * simple no lo veía. Cada rubro pesa su mejor costo conocido: la cotización
 * aprobada si ya la hay, y si no el cómputo estimado (ver `getAvancePorRubro`).
 *
 * Sólo cae al promedio simple la obra que no tiene ninguna de las dos cosas,
 * que es el caso para el que se había elegido: una obra recién arrancada tiene
 * que mostrar algo igual. Que el cómputo también pese importa porque armarlo
 * marca los rubros de la obra: con el peso en cero, tildar treinta tareas
 * desplomaba el avance de una obra que no se había movido.
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
      "id, porcentaje, comentario, fecha_desde, fecha_hasta, actualizado_por_nombre, desde_el_plano"
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
      desdeElPlano: c.desde_el_plano,
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
      "id, rubro_id, porcentaje, comentario, fecha_desde, fecha_hasta, actualizado_por_nombre, desde_el_plano"
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
    desdeElPlano: data.desde_el_plano,
  };
}

/**
 * Con qué se terminó ponderando el avance general, para poder decirlo en
 * pantalla sin que cada una lo deduzca a su manera. `null` es el promedio
 * simple: la obra no tiene ni cotizaciones aprobadas ni cómputo.
 */
export function origenDelPeso(
  rubros: RubroConAvance[]
): "cotizacion" | "computo" | "mixto" | null {
  const hayCotizacion = rubros.some((r) => r.pesoDe === "cotizacion");
  const hayComputo = rubros.some((r) => r.pesoDe === "computo");

  if (hayCotizacion && hayComputo) return "mixto";
  if (hayCotizacion) return "cotizacion";
  if (hayComputo) return "computo";
  return null;
}
