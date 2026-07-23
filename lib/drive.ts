/**
 * Acceso al Drive de la aplicación.
 *
 * SÓLO SERVIDOR. Nunca importar esto desde un componente cliente: usa el
 * refresh token, que es una credencial.
 *
 * Se habla con la API REST de Google directamente con fetch, en vez de usar el
 * paquete `googleapis`, que pesa cientos de megas y trae todas las APIs de
 * Google cuando acá se usan cuatro endpoints.
 *
 * El permiso es `drive.file`: la app sólo ve y toca los archivos que ella misma
 * creó. Aunque el token se filtrara, el resto del Drive queda fuera de alcance.
 */

const CARPETA_MIME = "application/vnd.google-apps.folder";
const RAIZ = "Gestión de desarrollo";

// El access token dura una hora. Se cachea para no pedir uno nuevo por request.
let tokenCache: { valor: string; venceEn: number } | null = null;
const carpetasCache = new Map<string, string>();

function requerir(nombre: string) {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(
      `Falta ${nombre} en .env.local. Corré "node scripts/autorizar-drive.mjs" para generarlo.`
    );
  }

  return valor;
}

async function getAccessToken() {
  if (tokenCache && tokenCache.venceEn > Date.now() + 60_000) {
    return tokenCache.valor;
  }

  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requerir("GOOGLE_DRIVE_CLIENT_ID"),
      client_secret: requerir("GOOGLE_DRIVE_CLIENT_SECRET"),
      refresh_token: requerir("GOOGLE_DRIVE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok || !datos.access_token) {
    throw new Error(
      `Google rechazó el refresh token (${datos.error ?? respuesta.status}). ` +
        `Si la app quedó en estado "Testing", el token vence a los 7 días: ` +
        `pasala a "In production" y volvé a autorizar.`
    );
  }

  tokenCache = {
    valor: datos.access_token,
    venceEn: Date.now() + datos.expires_in * 1000,
  };

  return tokenCache.valor;
}

async function api(ruta: string, init: RequestInit = {}) {
  const token = await getAccessToken();

  const respuesta = await fetch(`https://www.googleapis.com/drive/v3/${ruta}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Drive respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  return respuesta;
}

/** Busca una carpeta por nombre dentro de otra, y la crea si no existe. */
async function asegurarCarpeta(nombre: string, padreId?: string): Promise<string> {
  const clave = `${padreId ?? "raiz"}/${nombre}`;
  const cacheada = carpetasCache.get(clave);
  if (cacheada) return cacheada;

  // Las comillas simples del nombre romperían la query de Drive.
  const nombreEscapado = nombre.replace(/'/g, "\\'");

  const filtros = [
    `name = '${nombreEscapado}'`,
    `mimeType = '${CARPETA_MIME}'`,
    "trashed = false",
    padreId ? `'${padreId}' in parents` : null,
  ].filter(Boolean);

  const busqueda = await api(
    `files?q=${encodeURIComponent(filtros.join(" and "))}&fields=files(id)&pageSize=1`
  );
  const { files } = await busqueda.json();

  if (files?.[0]?.id) {
    carpetasCache.set(clave, files[0].id);
    return files[0].id;
  }

  const creacion = await api("files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nombre,
      mimeType: CARPETA_MIME,
      ...(padreId ? { parents: [padreId] } : {}),
    }),
  });

  const { id } = await creacion.json();
  carpetasCache.set(clave, id);
  return id;
}

export type TipoArchivo = "documentos" | "fotos" | "comprobantes";

/**
 * Devuelve la carpeta donde va un archivo, creando el árbol si hace falta:
 *
 *   Gestión de desarrollo / <obra> / <tipo>
 */
export async function carpetaDe(obraSlug: string, tipo: TipoArchivo) {
  const raiz = await asegurarCarpeta(RAIZ);
  const obra = await asegurarCarpeta(obraSlug, raiz);
  return asegurarCarpeta(tipo, obra);
}

export type ArchivoSubido = {
  id: string;
  nombre: string;
  mimeType: string;
  tamano: number;
};

export async function subirArchivo({
  archivo,
  nombre,
  obraSlug,
  tipo,
}: {
  archivo: File | Blob;
  nombre: string;
  obraSlug: string;
  tipo: TipoArchivo;
}): Promise<ArchivoSubido> {
  const carpetaId = await carpetaDe(obraSlug, tipo);
  const mimeType = archivo.type || "application/octet-stream";
  const boundary = `gd-${crypto.randomUUID()}`;

  const cuerpo = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify({ name: nombre, parents: [carpetaId] }),
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    archivo,
    `\r\n--${boundary}--`,
  ]);

  const token = await getAccessToken();

  const respuesta = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: cuerpo,
    }
  );

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`No se pudo subir a Drive: ${detalle.slice(0, 300)}`);
  }

  const datos = await respuesta.json();

  return {
    id: datos.id,
    nombre: datos.name,
    mimeType: datos.mimeType,
    tamano: Number(datos.size ?? 0),
  };
}

/**
 * Trae el contenido de un archivo.
 *
 * Devuelve la respuesta cruda para poder pasarle el stream al navegador sin
 * cargar el archivo entero en memoria del servidor.
 */
export async function descargarArchivo(fileId: string) {
  return api(`files/${fileId}?alt=media`);
}

export async function eliminarArchivo(fileId: string) {
  await api(`files/${fileId}`, { method: "DELETE" });
}

/** Chequeo de configuración: confirma que las credenciales funcionan. */
export async function probarConexion() {
  const raiz = await asegurarCarpeta(RAIZ);
  return { ok: true as const, carpetaRaiz: raiz };
}
