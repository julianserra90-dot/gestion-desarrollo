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

import { type Ambito, esAmbito } from "@/lib/ambitos";
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
  /** El rubro, en Obra y Proyecto. En Administrativa es null. */
  rubro: { id: string; nombre: string } | null;
  /** La etiqueta libre, en Administrativa. En el resto es null. */
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
    .order("fecha", { ascending: false });

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
 * Los títulos administrativos que ya se usaron en la obra, para ofrecerlos al
 * cargar uno nuevo. Se arman de lo cargado en vez de un catálogo aparte: la
 * lista se mantiene sola y nadie tiene que administrarla.
 */
export async function getTitulosUsados(obraId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("documentos")
    .select("titulo")
    .eq("obra_id", obraId)
    .eq("ambito", "Administrativa")
    .not("titulo", "is", null);

  const titulos = (data ?? [])
    .map((d) => d.titulo)
    .filter((t): t is string => Boolean(t));

  return Array.from(new Set(titulos)).sort((a, b) => a.localeCompare(b, "es"));
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
