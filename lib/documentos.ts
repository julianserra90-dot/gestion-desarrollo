/**
 * Los documentos de una obra, con sus archivos.
 *
 * SÓLO SERVIDOR.
 *
 * Un documento se clasifica por dos ejes que no se mezclan: el ámbito dice para
 * qué sirve el papel y el rubro de qué parte de la obra habla. Lo administrativo
 * no lleva rubro —un seguro no es de albañilería— y en su lugar lleva un título
 * libre, que después se le ofrece al usuario como sugerencia para no reescribirlo.
 *
 * Cada documento puede tener varios archivos: el mismo plano en PDF y en DWG es
 * un documento con dos adjuntos.
 */

import {
  type Ambito,
  type LineaDocumento,
  esAmbito,
  mismaLinea,
  versionSiguiente,
} from "@/lib/ambitos";
import { createClient } from "@/lib/supabase/server";

export type ArchivoDeDocumento = {
  id: string;
  driveFileId: string;
  /** Con extensión, tal como se subió. */
  nombre: string;
  /** El formato: PDF, DWG, XLS. */
  tipo: string | null;
  tamano: number | null;
};

export type Documento = {
  id: string;
  obraId: string;
  nombre: string;
  ambito: Ambito;
  /** El rubro, en Obra y Proyecto. En Administrativa y Lote es null. */
  rubro: { id: string; nombre: string } | null;
  /** La etiqueta libre, en Administrativa y Lote. En el resto es null. */
  titulo: string | null;
  version: string | null;
  estado: string;
  fecha: string;
  subidoPor: string | null;
  /** De qué documento es continuación, si es una versión nueva. */
  reemplazaA: string | null;
  archivos: ArchivoDeDocumento[];
};

/**
 * Bajo qué nombre se agrupa el documento dentro de su ámbito: el rubro si lo
 * tiene, el título si es administrativo.
 */
export function carpetaDelDocumento(doc: Documento): string {
  return doc.rubro?.nombre ?? doc.titulo ?? "Sin clasificar";
}

export async function getDocumentos(obraId: string): Promise<Documento[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("documentos")
    .select(
      `id, obra_id, nombre, ambito, titulo, version, estado, fecha,
       subido_por_nombre, reemplaza_a,
       rubros ( id, nombre ),
       documento_archivos ( id, drive_file_id, nombre, tipo, tamano )`
    )
    .eq("obra_id", obraId)
    // Dos versiones del mismo plano suelen cargarse el mismo día, y ahí la
    // fecha empata: desempata la carga, así arriba queda siempre la última.
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false });

  return (data ?? []).map((d) => ({
    id: d.id,
    obraId: d.obra_id,
    nombre: d.nombre,
    ambito: esAmbito(d.ambito) ? d.ambito : "Administrativa",
    rubro: d.rubros ? { id: d.rubros.id, nombre: d.rubros.nombre } : null,
    titulo: d.titulo,
    version: d.version,
    estado: d.estado,
    fecha: d.fecha,
    subidoPor: d.subido_por_nombre,
    reemplazaA: d.reemplaza_a,
    archivos: (d.documento_archivos ?? []).map((a) => ({
      id: a.id,
      driveFileId: a.drive_file_id,
      nombre: a.nombre,
      tipo: a.tipo,
      tamano: a.tamano,
    })),
  }));
}

/**
 * Los títulos ya usados en los ámbitos sin rubro (Administrativa, Lote), para
 * ofrecerlos al cargar uno nuevo. Se arman de lo cargado en vez de un catálogo
 * aparte: la lista se mantiene sola y nadie tiene que administrarla.
 *
 * Vienen agrupados por ámbito porque cada uno tiene los suyos: "Escritura" no
 * pinta como sugerencia al cargar un aviso de obra.
 */
export async function getTitulosUsados(
  obraId: string
): Promise<Record<string, string[]>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("documentos")
    .select("ambito, titulo")
    .eq("obra_id", obraId)
    .not("titulo", "is", null);

  const porAmbito = new Map<string, Set<string>>();

  for (const d of data ?? []) {
    if (!d.titulo) continue;
    const set = porAmbito.get(d.ambito) ?? new Set<string>();
    set.add(d.titulo);
    porAmbito.set(d.ambito, set);
  }

  const resultado: Record<string, string[]> = {};
  for (const [ambito, titulos] of porAmbito) {
    resultado[ambito] = Array.from(titulos).sort((a, b) => a.localeCompare(b, "es"));
  }

  return resultado;
}

/** Lo mínimo de cada documento, para resolver versiones y ofrecer nombres. */
export type DocumentoBreve = {
  id: string;
  nombre: string;
  ambito: Ambito;
  rubroId: string | null;
  titulo: string | null;
  version: string | null;
  estado: string;
};

export async function getDocumentosBreves(
  obraId: string
): Promise<DocumentoBreve[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("documentos")
    .select("id, nombre, ambito, rubro_id, titulo, version, estado")
    .eq("obra_id", obraId);

  return (data ?? []).map((d) => ({
    id: d.id,
    nombre: d.nombre,
    ambito: esAmbito(d.ambito) ? d.ambito : "Administrativa",
    rubroId: d.rubro_id,
    titulo: d.titulo,
    version: d.version,
    estado: d.estado,
  }));
}

/**
 * Qué versión le toca a una carga nueva y a cuál desplaza.
 *
 * La línea la define el nombre dentro de su rubro: "Banquinas" y "Replanteo"
 * son dos documentos distintos de albañilería, y subir otro "Banquinas" ahí es
 * la versión siguiente de ése, sin que haya que decirlo.
 */
export async function resolverLinea(
  obraId: string,
  linea: LineaDocumento
): Promise<{ version: string; vigente: DocumentoBreve | null }> {
  const previos = (await getDocumentosBreves(obraId)).filter((d) =>
    mismaLinea(linea, {
      ambito: d.ambito,
      rubroId: d.rubroId,
      titulo: d.titulo,
      nombre: d.nombre,
    })
  );

  return {
    version: versionSiguiente(previos.map((d) => d.version)),
    vigente: previos.find((d) => d.estado === "Vigente") ?? null,
  };
}

/** Un documento puntual, para precargar el formulario de nueva versión. */
export async function getDocumento(id: string): Promise<Documento | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("documentos")
    .select(
      `id, obra_id, nombre, ambito, titulo, version, estado, fecha,
       subido_por_nombre, reemplaza_a,
       rubros ( id, nombre ),
       documento_archivos ( id, drive_file_id, nombre, tipo, tamano )`
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    obraId: data.obra_id,
    nombre: data.nombre,
    ambito: esAmbito(data.ambito) ? data.ambito : "Administrativa",
    rubro: data.rubros ? { id: data.rubros.id, nombre: data.rubros.nombre } : null,
    titulo: data.titulo,
    version: data.version,
    estado: data.estado,
    fecha: data.fecha,
    subidoPor: data.subido_por_nombre,
    reemplazaA: data.reemplaza_a,
    archivos: (data.documento_archivos ?? []).map((a) => ({
      id: a.id,
      driveFileId: a.drive_file_id,
      nombre: a.nombre,
      tipo: a.tipo,
      tamano: a.tamano,
    })),
  };
}
