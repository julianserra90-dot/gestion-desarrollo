/**
 * El avance de un rubro que sale de lo hecho **tarea por tarea**: lo marcado en
 * el 3D (`avances_del_plano`, cosa por cosa) y lo cargado a mano en la
 * pantalla del rubro (`avances_de_tarea`, cuánto de cada tarea). Las dos cosas
 * entran a la misma cuenta (`cargasDelPlano`): cada tarea pesa lo que cuesta
 * dentro del rubro, y lo hecho de cada una se suma —3D más a mano— con tope en
 * su cantidad del cómputo.
 *
 * El resultado son las cargas del rubro marcadas `desde_el_plano`, que se
 * rehacen enteras cada vez que algo cambia. Las cargas de porcentaje a mano de
 * antes no se tocan.
 */

import { cargasDelPlano, hechoDeTarea, type TareaDelRubro } from "@/lib/avance-del-plano";
import { nombreDePiso } from "@/lib/pisos";
import { getPisos } from "@/lib/plantas";
import type { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

/** Una tarea del rubro en el cómputo, con lo hecho de ella por cada lado. */
export type TareaConAvance = {
  tareaId: string;
  nombre: string;
  unidad: string;
  /** Lo que tiene el cómputo. */
  cantidad: number;
  /** Cuánto pesa en el rubro, de 0 a 1. */
  peso: number;
  /** Lo marcado en el 3D, en su unidad. */
  enEl3d: number;
  /** Lo cargado a mano, en su unidad. */
  aMano: number;
  /** Lo hecho: piso por piso, el mayor de lo marcado y lo de a mano. */
  hecho: number;
  /** Lo cargado a mano sin piso. */
  aManoSinPiso: number;
  /**
   * Sus pisos, como en el cómputo: cada uno con lo que tiene y lo hecho de él.
   * Vacío si el cómputo no la reparte por piso.
   */
  pisos: PisoDeTarea[];
  /** Si el plano la mide: se puede marcar en el 3D. */
  enElPlano: boolean;
};

/** Un piso de una tarea: lo que tiene el cómputo y lo hecho, por lado. */
export type PisoDeTarea = { piso: number; nivel: string; cantidad: number; enEl3d: number; aMano: number };

/** Las tareas del rubro en el cómputo, cada una con lo que costaría. */
async function tareasDelRubro(
  supabase: Cliente,
  obraId: string,
  rubroId: string
): Promise<
  { tareas: (TareaDelRubro & { nombre: string; unidad: string; items: string[] })[] } | { error: string }
> {
  const { data, error } = await supabase
    .from("computo_items")
    .select("id, tarea_id, nombre, unidad, cantidad, orden, precio_materiales, precio_mano_obra, precio_integrado")
    .eq("obra_id", obraId)
    .eq("rubro_id", rubroId)
    .not("tarea_id", "is", null)
    .order("orden");
  if (error) return { error: error.message };
  const porTarea = new Map<string, TareaDelRubro & { nombre: string; unidad: string; items: string[] }>();
  for (const i of data ?? []) {
    if (!i.tarea_id) continue;
    const ya = porTarea.get(i.tarea_id) ?? {
      tareaId: i.tarea_id,
      nombre: i.nombre,
      unidad: i.unidad,
      cantidad: 0,
      costo: 0,
      items: [],
    };
    ya.items.push(i.id);
    ya.cantidad += Number(i.cantidad);
    ya.costo +=
      Number(i.cantidad) * (Number(i.precio_materiales) + Number(i.precio_mano_obra) + Number(i.precio_integrado));
    porTarea.set(i.tarea_id, ya);
  }
  return { tareas: Array.from(porTarea.values()) };
}

/** Lo hecho de unas tareas, por cada lado: marcas del 3D y cargas a mano. */
async function hechoDe(supabase: Cliente, obraId: string, tareas: string[]) {
  if (tareas.length === 0) return { delPlano: [], aMano: [] };
  const [{ data: delPlano, error: e1 }, { data: aMano, error: e2 }] = await Promise.all([
    supabase
      .from("avances_del_plano")
      .select("tarea_id, cantidad, fecha, fecha_inicio, piso")
      .eq("obra_id", obraId)
      .in("tarea_id", tareas),
    supabase
      .from("avances_de_tarea")
      .select("tarea_id, cantidad, fecha, fecha_inicio, piso")
      .eq("obra_id", obraId)
      .in("tarea_id", tareas),
  ]);
  if (e1) return { error: e1.message };
  // Sin la tabla todavía —la migración sin aplicar—, nada a mano.
  if (e2) console.error("avances_de_tarea:", e2.message);
  return {
    delPlano: (delPlano ?? []).map((m) => ({
      tareaId: m.tarea_id,
      cantidad: Number(m.cantidad),
      fecha: m.fecha,
      inicio: m.fecha_inicio,
      piso: m.piso as number | null,
    })),
    aMano: (aMano ?? []).map((m) => ({
      tareaId: m.tarea_id,
      cantidad: Number(m.cantidad),
      fecha: m.fecha,
      inicio: m.fecha_inicio,
      piso: m.piso as number | null,
    })),
  };
}

/** Las tareas del rubro con su peso y lo hecho de cada una: para cargarlas a mano. */
export async function getTareasConAvance(
  supabase: Cliente,
  obraId: string,
  rubroId: string
): Promise<TareaConAvance[]> {
  const delRubro = await tareasDelRubro(supabase, obraId, rubroId);
  if ("error" in delRubro) return [];
  const conCantidad = delRubro.tareas.filter((t) => t.cantidad > 0);
  const costoTotal = conCantidad.reduce((s, t) => s + Math.max(0, t.costo), 0);
  const hecho = await hechoDe(supabase, obraId, conCantidad.map((t) => t.tareaId));
  // Las que vienen del plano —alguna de sus mediciones salió de él— y, de esas
  // mediciones, sus pisos: el renglón "1.º piso" es del piso que se llama así.
  const [{ data: delPlano }, pisosDeObra] = await Promise.all([
    supabase
      .from("computo_item_medicion")
      .select("item_id, nivel, cantidad")
      .eq("origen", "plano")
      .in(
        "item_id",
        conCantidad.flatMap((t) => t.items)
      ),
    getPisos(obraId),
  ]);
  const itemsDelPlano = new Set((delPlano ?? []).map((m) => m.item_id));
  const pisoDe = new Map(pisosDeObra.map((p) => [nombreDePiso(p), p.numero] as const));
  const suma = (lista: { tareaId: string; cantidad: number }[], id: string) =>
    lista.filter((m) => m.tareaId === id).reduce((s, m) => s + m.cantidad, 0);
  const sumaEn = (lista: { tareaId: string; cantidad: number; piso?: number | null }[], id: string, piso: number | null) =>
    lista.filter((m) => m.tareaId === id && (m.piso ?? null) === piso).reduce((s, m) => s + m.cantidad, 0);
  const pisosDe = (t: (typeof conCantidad)[number]): PisoDeTarea[] => {
    const porPiso = new Map<number, PisoDeTarea>();
    for (const m of delPlano ?? []) {
      if (!t.items.includes(m.item_id) || !m.nivel) continue;
      const piso = pisoDe.get(m.nivel.trim());
      if (piso === undefined) continue;
      const ya = porPiso.get(piso) ?? { piso, nivel: m.nivel.trim(), cantidad: 0, enEl3d: 0, aMano: 0 };
      ya.cantidad += Number(m.cantidad);
      porPiso.set(piso, ya);
    }
    // De arriba hacia abajo, como en la definición de pisos.
    return Array.from(porPiso.values())
      .sort((a, b) => b.piso - a.piso)
      .map((p) =>
        "error" in hecho
          ? p
          : { ...p, enEl3d: sumaEn(hecho.delPlano, t.tareaId, p.piso), aMano: sumaEn(hecho.aMano, t.tareaId, p.piso) }
      );
  };
  return conCantidad.map((t) => ({
    tareaId: t.tareaId,
    nombre: t.nombre,
    unidad: t.unidad,
    cantidad: t.cantidad,
    peso: costoTotal > 0 ? Math.max(0, t.costo) / costoTotal : 1 / conCantidad.length,
    enEl3d: "error" in hecho ? 0 : suma(hecho.delPlano, t.tareaId),
    aMano: "error" in hecho ? 0 : suma(hecho.aMano, t.tareaId),
    enElPlano: t.items.some((id) => itemsDelPlano.has(id)),
    ...(() => {
      const pisos = pisosDe(t);
      const aManoSinPiso = "error" in hecho ? 0 : sumaEn(hecho.aMano, t.tareaId, null);
      // Lo marcado en pisos que el cómputo no lista también cuenta.
      const enOtros =
        "error" in hecho
          ? 0
          : hecho.delPlano
              .filter((m) => m.tareaId === t.tareaId && !pisos.some((p) => p.piso === m.piso))
              .reduce((s, m) => s + m.cantidad, 0);
      return {
        pisos,
        aManoSinPiso,
        hecho:
          pisos.reduce((s, p) => s + hechoDeTarea(p.enEl3d, p.aMano, p.cantidad), 0) +
          hechoDeTarea(enOtros, aManoSinPiso),
      };
    })(),
  }));
}

/**
 * Rehace las cargas del rubro que salen de lo hecho por tarea —en el 3D y a
 * mano—: las borra y las vuelve a escribir, una por día.
 */
export async function rehacerCargasDelRubro(
  supabase: Cliente,
  obraId: string,
  rubroId: string
): Promise<{ error?: string }> {
  const delRubro = await tareasDelRubro(supabase, obraId, rubroId);
  if ("error" in delRubro) return { error: delRubro.error };
  const hecho = await hechoDe(supabase, obraId, delRubro.tareas.map((t) => t.tareaId));
  if ("error" in hecho) return { error: hecho.error };

  const cargas = cargasDelPlano(
    [...hecho.delPlano, ...hecho.aMano.map((m) => ({ ...m, aMano: true }))],
    delRubro.tareas
  );

  const { error: alBorrar } = await supabase
    .from("avances")
    .delete()
    .eq("obra_id", obraId)
    .eq("rubro_id", rubroId)
    .eq("desde_el_plano", true);
  if (alBorrar) return { error: alBorrar.message };
  if (cargas.length === 0) return {};

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfiles").select("nombre").eq("id", user?.id ?? "").maybeSingle();
  const { error: alCargar } = await supabase.from("avances").insert(
    cargas.map((c) => ({
      obra_id: obraId,
      rubro_id: rubroId,
      porcentaje: c.porcentaje,
      fecha_desde: c.desde,
      fecha_hasta: c.fecha,
      comentario: [
        c.cosas > 0 ? `Marcado en el 3D: ${c.cosas} ${c.cosas === 1 ? "cosa" : "cosas"}` : null,
        c.aMano > 0 ? `Cargado por tarea: ${c.aMano} ${c.aMano === 1 ? "carga" : "cargas"}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      desde_el_plano: true,
      actualizado_por: user?.id ?? null,
      actualizado_por_nombre: perfil?.nombre ?? null,
    }))
  );
  if (alCargar) return { error: alCargar.message };
  return {};
}
