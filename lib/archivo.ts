/**
 * El Archivo de una obra: todo lo que se fue cargando, en carpetas.
 *
 * Nada se guarda dos veces: cada archivo sigue donde se cargó —un documento,
 * el comprobante de un gasto, el plano de una planta, una foto— y acá sólo se
 * lo junta y se lo ordena, como en un Drive:
 *
 *   Proyecto · Obra        los documentos de cada uno, por rubro
 *   Planos                 el plano sobre el que se calcó cada planta
 *   Fotos                  por mes
 *   Facturas               el comprobante de cada gasto, por mes
 *   Cotizaciones           el de cada presupuesto, por rubro
 *   Administrativa · Lote  los documentos, por título; en Lote, también los
 *                          comprobantes de sus pagos
 *
 * Lo obsoleto no está: la pregunta del Archivo es qué vale hoy. Las carpetas
 * vacías tampoco.
 *
 * SÓLO SERVIDOR. Cada archivo se abre por `/archivos/<id>`, que es la que
 * controla el permiso.
 */

import { carpetaDelDocumento, getDocumentos } from "@/lib/documentos";
import { nombreMes } from "@/lib/meses";
import { createClient } from "@/lib/supabase/server";

export type ArchivoDeCarpeta = {
  /** El id de Drive: se abre por `/archivos/<id>`. */
  id: string;
  nombre: string;
  mime: string | null;
  /** AAAA-MM-DD. */
  fecha: string;
};

export type Carpeta = {
  nombre: string;
  carpetas: Carpeta[];
  archivos: ArchivoDeCarpeta[];
};

/** Cuántos archivos hay en una carpeta, contando las de adentro. */
export function cuantosHay(carpeta: Carpeta): number {
  return carpeta.archivos.length + carpeta.carpetas.reduce((s, c) => s + cuantosHay(c), 0);
}

/** La carpeta a la que lleva un camino de nombres, o null si no está. */
export function carpetaEn(raiz: Carpeta, camino: string[]): Carpeta | null {
  let actual: Carpeta | undefined = raiz;
  for (const nombre of camino) {
    actual = actual.carpetas.find((c) => c.nombre === nombre);
    if (!actual) return null;
  }
  return actual;
}

export async function getArchivo(obraId: string): Promise<Carpeta> {
  const supabase = await createClient();
  const [documentos, { data: plantas }, { data: gastos }, { data: presupuestos }, { data: pagosDelLote }, { data: registros }] =
    await Promise.all([
      getDocumentos(obraId),
      supabase
        .from("plantas")
        .select("nombre, imagen_drive_id, imagen_nombre, imagen_mime, creado_en")
        .eq("obra_id", obraId)
        .order("orden"),
      supabase
        .from("gastos")
        .select("fecha, estado, comprobante_drive_id, comprobante_nombre, comprobante_mime")
        .eq("obra_id", obraId)
        .not("comprobante_drive_id", "is", null),
      supabase
        .from("presupuestos")
        .select("fecha, comprobante_drive_id, comprobante_nombre, comprobante_mime, rubros ( nombre )")
        .eq("obra_id", obraId)
        .not("comprobante_drive_id", "is", null),
      supabase
        .from("lote_pagos")
        .select("fecha, comprobante_drive_id, comprobante_nombre, comprobante_mime")
        .eq("obra_id", obraId)
        .not("comprobante_drive_id", "is", null),
      supabase
        .from("foto_registros")
        .select("fecha, fotos ( drive_file_id, nombre, mime_type )")
        .eq("obra_id", obraId),
    ]);

  const raiz: Carpeta = { nombre: "Archivo", carpetas: [], archivos: [] };
  /** La carpeta de ese camino, creándola si hace falta. */
  const en = (...camino: string[]): Carpeta => {
    let actual = raiz;
    for (const nombre of camino) {
      let siguiente = actual.carpetas.find((c) => c.nombre === nombre);
      if (!siguiente) {
        siguiente = { nombre, carpetas: [], archivos: [] };
        actual.carpetas.push(siguiente);
      }
      actual = siguiente;
    }
    return actual;
  };
  const mes = (fecha: string) => nombreMes(fecha.slice(0, 7));

  // Las de arriba, en el orden en que se recorre una obra. Se crean vacías
  // para fijar el orden; las que quedan vacías se sacan al final.
  for (const nombre of ["Proyecto", "Planos", "Obra", "Fotos", "Facturas", "Cotizaciones", "Administrativa", "Lote"]) {
    en(nombre);
  }

  for (const doc of documentos) {
    if (doc.estado === "Obsoleto") continue;
    const carpeta = en(doc.ambito, carpetaDelDocumento(doc));
    for (const a of doc.archivos) {
      carpeta.archivos.push({ id: a.driveFileId, nombre: a.nombre || doc.nombre, mime: a.tipo, fecha: doc.fecha });
    }
  }

  for (const p of plantas ?? []) {
    if (!p.imagen_drive_id) continue;
    en("Planos").archivos.push({
      id: p.imagen_drive_id,
      nombre: p.nombre || p.imagen_nombre || "Plano",
      mime: p.imagen_mime,
      fecha: p.creado_en.slice(0, 10),
    });
  }

  for (const r of registros ?? []) {
    for (const f of r.fotos ?? []) {
      if (!f.drive_file_id) continue;
      en("Fotos", mes(r.fecha)).archivos.push({
        id: f.drive_file_id,
        nombre: f.nombre ?? "Foto",
        mime: f.mime_type,
        fecha: r.fecha,
      });
    }
  }

  for (const g of gastos ?? []) {
    if (g.estado === "Anulado" || !g.comprobante_drive_id) continue;
    en("Facturas", mes(g.fecha)).archivos.push({
      id: g.comprobante_drive_id,
      nombre: g.comprobante_nombre ?? "Comprobante",
      mime: g.comprobante_mime,
      fecha: g.fecha,
    });
  }

  for (const p of presupuestos ?? []) {
    if (!p.comprobante_drive_id) continue;
    en("Cotizaciones", p.rubros?.nombre ?? "Sin rubro").archivos.push({
      id: p.comprobante_drive_id,
      nombre: p.comprobante_nombre ?? "Cotización",
      mime: p.comprobante_mime,
      fecha: p.fecha,
    });
  }

  for (const p of pagosDelLote ?? []) {
    if (!p.comprobante_drive_id) continue;
    en("Lote", "Pagos").archivos.push({
      id: p.comprobante_drive_id,
      nombre: p.comprobante_nombre ?? "Comprobante",
      mime: p.comprobante_mime,
      fecha: p.fecha,
    });
  }

  // Sin carpetas vacías; adentro, las carpetas por nombre (los meses, del más
  // nuevo al más viejo) y los archivos del más nuevo al más viejo.
  const ordenar = (c: Carpeta, nivel: number) => {
    c.carpetas = c.carpetas.filter((h) => cuantosHay(h) > 0);
    if (nivel > 0) {
      const porMes = c.nombre === "Fotos" || c.nombre === "Facturas";
      c.carpetas.sort((a, b) =>
        porMes
          ? fechaDeMes(b.nombre) - fechaDeMes(a.nombre)
          : a.nombre.localeCompare(b.nombre, "es", { numeric: true })
      );
    }
    c.archivos.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.nombre.localeCompare(b.nombre, "es"));
    for (const h of c.carpetas) ordenar(h, nivel + 1);
  };
  ordenar(raiz, 0);
  return raiz;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "Octubre de 2026" → un número para ordenar por fecha. */
function fechaDeMes(nombre: string): number {
  const [mesTexto, , anio] = nombre.toLowerCase().split(" ");
  return Number(anio) * 12 + MESES.indexOf(mesTexto);
}
