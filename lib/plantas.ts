/**
 * Las plantas de una obra: el plano de cada piso con lo que se calcó encima.
 *
 * SÓLO SERVIDOR. La cuenta de las medidas vive aparte, en
 * `lib/planta-dibujo.ts`, porque el editor también la usa.
 */

import {
  type Dibujo,
  type Escala,
  type TipoDeAbertura,
  leerDibujo,
  leerEscala,
  leerTiposDeAbertura,
} from "@/lib/planta-dibujo";
import type { Piso } from "@/lib/pisos";
import { leerComposicion, type TipoMuro } from "@/lib/tipos-de-muro";
import { createClient } from "@/lib/supabase/server";

export type Planta = {
  id: string;
  obraId: string;
  nombre: string;
  /** De piso a techo, en metros. */
  altura: number;
  /** Cuántos pisos son esta misma planta. */
  repeticiones: number;
  imagen: { driveId: string; ancho: number; alto: number };
  escala: Escala | null;
  dibujo: Dibujo;
};

const COLUMNAS =
  "id, obra_id, nombre, altura, repeticiones, imagen_drive_id, imagen_ancho, imagen_alto, escala, dibujo";

type Fila = {
  id: string;
  obra_id: string;
  nombre: string;
  altura: number;
  repeticiones: number;
  imagen_drive_id: string;
  imagen_ancho: number;
  imagen_alto: number;
  escala: unknown;
  dibujo: unknown;
};

function aPlanta(f: Fila): Planta {
  return {
    id: f.id,
    obraId: f.obra_id,
    nombre: f.nombre,
    altura: Number(f.altura),
    repeticiones: f.repeticiones,
    imagen: {
      driveId: f.imagen_drive_id,
      ancho: f.imagen_ancho,
      alto: f.imagen_alto,
    },
    escala: leerEscala(f.escala),
    dibujo: leerDibujo(f.dibujo),
  };
}

export async function getPlantas(obraId: string): Promise<Planta[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plantas")
    .select(COLUMNAS)
    .eq("obra_id", obraId)
    .order("orden")
    .order("creado_en");

  // Un error de consulta no puede pasar por "no hay plantas": el listado vacío
  // es un estado normal, y sin esto una tabla que falta se ve igual que una
  // obra sin dibujar.
  if (error) console.error("getPlantas:", error.message);

  return (data ?? []).map(aPlanta);
}

/**
 * La definición de pisos de la obra, de abajo hacia arriba: cada piso con su
 * nivel de piso terminado, su altura y la planta dibujada que le toca.
 */
export async function getPisos(obraId: string): Promise<Piso[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pisos")
    .select("numero, nombre, cota, altura, planta_id")
    .eq("obra_id", obraId)
    .order("numero");

  if (error) console.error("getPisos:", error.message);

  return (data ?? []).map((p) => ({
    numero: p.numero,
    nombre: p.nombre,
    cota: Number(p.cota),
    altura: Number(p.altura),
    plantaId: p.planta_id,
  }));
}

/**
 * Los tipos de muro de la obra, por nombre. Tolerante: si la tabla falla, la
 * obra se dibuja sin tipos —los muros con tipo miden como uno sin—, y queda
 * dicho en el log.
 */
/**
 * Los tipos de puerta y ventana de la obra —P01, V02—, para ponerlos en
 * cualquier planta. Vacío si la tabla todavía no existe.
 */
export async function getTiposDeAberturaDeObra(obraId: string): Promise<TipoDeAbertura[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipos_de_abertura")
    .select("tipo, nombre, ancho, alto, antepecho, apertura, hojas, marco, tareas")
    .eq("obra_id", obraId)
    .order("nombre");

  if (error) console.error("getTiposDeAberturaDeObra:", error.message);

  return leerTiposDeAbertura(data ?? []);
}

export async function getTiposDeMuroDeObra(obraId: string): Promise<TipoMuro[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipos_de_muro")
    .select("id, nombre, composicion")
    .eq("obra_id", obraId)
    .order("nombre");

  if (error) console.error("getTiposDeMuroDeObra:", error.message);

  return (data ?? []).map((t) => ({ id: t.id, nombre: t.nombre, ...leerComposicion(t.composicion) }));
}

/**
 * Todo el catálogo del cómputo, por rubro: lo que puede llevar una abertura
 * —el amure del premarco en Albañilería, la colocación en Carpinterías—, que
 * se cotiza en cualquier unidad.
 */
export async function getTareasDelCatalogo(): Promise<
  { id: string; nombre: string; rubro: string; unidad: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tareas")
    .select("id, nombre, rubro, unidad, orden")
    .order("rubro")
    .order("orden");

  if (error) console.error("getTareasDelCatalogo:", error.message);

  return (data ?? []).map((t) => ({ id: t.id, nombre: t.nombre, rubro: t.rubro, unidad: t.unidad }));
}

/**
 * Las subtareas del catálogo, por su madre: el pastinado de juntas, del
 * porcelanato. Sin la columna todavía —la migración sin aplicar—, ninguna.
 */
export async function getSubtareas(): Promise<Map<string, string[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tareas").select("id, madre_id").not("madre_id", "is", null);
  if (error) console.error("getSubtareas:", error.message);

  const deMadre = new Map<string, string[]>();
  for (const t of data ?? []) {
    if (!t.madre_id) continue;
    deMadre.set(t.madre_id, [...(deMadre.get(t.madre_id) ?? []), t.id]);
  }
  return deMadre;
}

/**
 * Las tareas que sirven de zócalo: las que se cotizan por metro lineal.
 */
export async function getTareasPorMetro(): Promise<
  { id: string; nombre: string; rubro: string; unidad: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tareas")
    .select("id, nombre, rubro, unidad, orden")
    .in("unidad", ["ml", "m"])
    .order("rubro")
    .order("orden");

  if (error) console.error("getTareasPorMetro:", error.message);

  return (data ?? []).map((t) => ({ id: t.id, nombre: t.nombre, rubro: t.rubro, unidad: t.unidad }));
}

export async function getPlanta(id: string): Promise<Planta | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plantas")
    .select(COLUMNAS)
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("getPlanta:", error.message);

  return data ? aPlanta(data) : null;
}

/**
 * Las tareas del catálogo del cómputo que sirven de capa de una terminación:
 * las que se miden en m². Azotado, revoque, porcelanato, pintura.
 *
 * Son las mismas tareas que después se tildan en el cómputo, y es a propósito:
 * lo que se marca sobre una cara es lo que se va a cotizar, sin una lista de
 * terminaciones aparte que haya que emparejar con el catálogo.
 */
export async function getCapasDisponibles(): Promise<
  { id: string; nombre: string; rubro: string }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tareas")
    .select("id, nombre, rubro, orden")
    .eq("unidad", "m²")
    .order("rubro")
    .order("orden");

  if (error) console.error("getCapasDisponibles:", error.message);

  return (data ?? []).map((t) => ({ id: t.id, nombre: t.nombre, rubro: t.rubro }));
}

/**
 * Las tareas del catálogo que sirven de tipo de muro: las que se miden en m²
 * y las de m³.
 *
 * Las dos unidades, porque el catálogo cotiza los ladrillos huecos y los
 * tabiques por superficie y los ladrillos comunes por volumen. No se filtra
 * por rubro: un muro puede ser un tabique de hormigón, que está en
 * Estructuras, o una tarea propia que alguien cargó en otro lado. El
 * desplegable pone primero las mamposterías.
 */
export async function getTiposDeMuro(): Promise<
  { id: string; nombre: string; rubro: string; unidad: string }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tareas")
    .select("id, nombre, rubro, unidad, orden")
    .in("unidad", ["m²", "m³"])
    .order("rubro")
    .order("orden");

  if (error) console.error("getTiposDeMuro:", error.message);

  return (data ?? []).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    rubro: t.rubro,
    unidad: t.unidad,
  }));
}
