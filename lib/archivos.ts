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

  const [foto, documento, gasto] = await Promise.all([
    supabase
      .from("fotos")
      .select("nombre, mime_type")
      .eq("drive_file_id", fileId)
      .maybeSingle(),
    supabase
      .from("documentos")
      .select("nombre, tipo, mime_type")
      .eq("drive_file_id", fileId)
      .maybeSingle(),
    supabase
      .from("gastos")
      .select("comprobante_nombre, comprobante_mime")
      .eq("comprobante_drive_id", fileId)
      .maybeSingle(),
  ]);

  if (foto.data) {
    return {
      nombre: foto.data.nombre ?? "foto.jpg",
      mimeType: foto.data.mime_type,
    };
  }

  if (documento.data) {
    // El nombre visible del documento no trae extensión; se la agrega desde el
    // tipo para que el archivo descargado abra con el programa correcto.
    const base = documento.data.nombre ?? "documento";
    const ext = documento.data.tipo?.toLowerCase();
    const yaTiene = ext && base.toLowerCase().endsWith(`.${ext}`);

    return {
      nombre: ext && !yaTiene ? `${base}.${ext}` : base,
      mimeType: documento.data.mime_type,
    };
  }

  if (gasto.data) {
    return {
      nombre: gasto.data.comprobante_nombre ?? "comprobante",
      mimeType: gasto.data.comprobante_mime,
    };
  }

  return null;
}
