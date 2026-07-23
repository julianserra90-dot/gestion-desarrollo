import { buscarArchivoVisible } from "@/lib/archivos";
import { descargarArchivo } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

/**
 * Sirve un archivo de Drive, pero sólo a quien tenga permiso sobre la obra.
 *
 * Cómo se controla el acceso: se busca el drive_file_id en la base usando el
 * cliente del usuario. Como el RLS está activo, la fila sólo aparece si el
 * usuario puede ver esa obra. Si no aparece en ninguna tabla, devolvemos 404
 * y nunca se toca Drive. Así el permiso es el mismo que gobierna todo lo demás.
 *
 * Con ?descargar=1 fuerza la descarga con el nombre original del archivo.
 * Sin ese parámetro lo muestra en el navegador (útil para PDFs e imágenes).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const forzarDescarga =
    new URL(request.url).searchParams.get("descargar") === "1";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("No autenticado", { status: 401 });
  }

  const archivo = await buscarArchivoVisible(fileId);
  if (!archivo) {
    return new Response("No encontrado", { status: 404 });
  }

  let respuestaDrive: Response;
  try {
    respuestaDrive = await descargarArchivo(fileId);
  } catch {
    return new Response("No se pudo obtener el archivo", { status: 502 });
  }

  // Se pasa el stream de Drive directo al cliente, sin cargar el archivo entero
  // en memoria del servidor.
  const headers = new Headers();
  const tipo = respuestaDrive.headers.get("content-type");
  const largo = respuestaDrive.headers.get("content-length");
  if (tipo) headers.set("content-type", tipo);
  if (largo) headers.set("content-length", largo);
  // Privado: que ningún proxy intermedio cachee un archivo con permisos.
  headers.set("cache-control", "private, max-age=3600");
  headers.set(
    "content-disposition",
    disposition(forzarDescarga ? "attachment" : "inline", archivo.nombre)
  );

  return new Response(respuestaDrive.body, { status: 200, headers });
}

/**
 * Arma el header Content-Disposition con el nombre del archivo.
 *
 * Va el nombre dos veces: una versión sin acentos ni caracteres raros para
 * navegadores viejos, y la versión completa codificada (RFC 5987) que usan
 * los actuales. Sin esto, un archivo con tildes llega con el nombre roto.
 */
function disposition(tipo: "inline" | "attachment", nombre: string) {
  const ascii = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");

  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

