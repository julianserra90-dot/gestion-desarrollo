import { createClient } from "@/lib/supabase/server";

export type ArchivoVisible = {
  nombre: string;
  mimeType: string | null;
};

/**
 * Busca un archivo por su id de Drive y devuelve su nombre y tipo, pero sólo
 * si el usuario tiene permiso para verlo.
 *
 * El control de acceso lo hace el RLS: las consultas van con el cliente del
 * usuario, así que una fila de una obra que no puede ver simplemente no
 * aparece. Devuelve null tanto si el archivo no existe como si no tiene
 * permiso, y está bien que no se distingan.
 */
export async function buscarArchivoVisible(
  fileId: string
): Promise<ArchivoVisible | null> {
  const supabase = await createClient();

  const [foto, adjunto, gasto, presupuesto, pagoLote, imagenObra] = await Promise.all([
    supabase
      .from("fotos")
      .select("nombre, mime_type")
      .eq("drive_file_id", fileId)
      .maybeSingle(),
    supabase
      .from("documento_archivos")
      .select("nombre, mime_type")
      .eq("drive_file_id", fileId)
      .maybeSingle(),
    supabase
      .from("gastos")
      .select("comprobante_nombre, comprobante_mime")
      .eq("comprobante_drive_id", fileId)
      .maybeSingle(),
    supabase
      .from("presupuestos")
      .select("comprobante_nombre, comprobante_mime")
      .eq("comprobante_drive_id", fileId)
      .maybeSingle(),
    supabase
      .from("lote_pagos")
      .select("comprobante_nombre, comprobante_mime")
      .eq("comprobante_drive_id", fileId)
      .maybeSingle(),
    supabase
      .from("obras")
      .select("imagen_nombre, imagen_mime")
      .eq("imagen_drive_id", fileId)
      .maybeSingle(),
  ]);

  if (foto.data) {
    return {
      nombre: foto.data.nombre ?? "foto.jpg",
      mimeType: foto.data.mime_type,
    };
  }

  if (adjunto.data) {
    // Los adjuntos guardan el nombre con extensión, tal como se subieron, así
    // que el archivo baja listo para abrir con el programa correcto.
    return {
      nombre: adjunto.data.nombre ?? "documento",
      mimeType: adjunto.data.mime_type,
    };
  }

  if (gasto.data) {
    return {
      nombre: gasto.data.comprobante_nombre ?? "comprobante",
      mimeType: gasto.data.comprobante_mime,
    };
  }

  if (presupuesto.data) {
    return {
      nombre: presupuesto.data.comprobante_nombre ?? "cotización",
      mimeType: presupuesto.data.comprobante_mime,
    };
  }

  if (pagoLote.data) {
    return {
      nombre: pagoLote.data.comprobante_nombre ?? "comprobante",
      mimeType: pagoLote.data.comprobante_mime,
    };
  }

  if (imagenObra.data) {
    return {
      nombre: imagenObra.data.imagen_nombre ?? "portada.jpg",
      mimeType: imagenObra.data.imagen_mime,
    };
  }

  return null;
}
