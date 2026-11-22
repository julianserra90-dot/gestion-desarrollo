/**
 * Las plantas de una obra: el plano de cada piso con lo que se calcó encima.
 *
 * SÓLO SERVIDOR. La cuenta de las medidas vive aparte, en
 * `lib/planta-dibujo.ts`, porque el editor también la usa.
 */

import {
  type Dibujo,
  type Escala,
  leerDibujo,
  leerEscala,
} from "@/lib/planta-dibujo";
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
