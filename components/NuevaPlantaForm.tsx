"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import * as ui from "@/components/ui";

/**
 * El lado mayor, en píxeles, con el que se guarda un plano.
 *
 * Es lo que decide con qué precisión se calca: en un A1 a 1:50 dibujado a
 * 4.000 px, un píxel son unos 10 mm de obra, que para cotizar alcanza. Más
 * grande pesa y tarda en abrir sin que el trazo a mano lo aproveche.
 */
const LADO_PDF = 4000;
/** Una imagen ya hecha se respeta; sólo se achica si es desmedida. */
const LADO_MAXIMO = 6000;

type Imagen = { archivo: File; ancho: number; alto: number };

/**
 * El alta de una planta: sus datos y el plano.
 *
 * El plano puede ser un PDF, pero lo que se guarda es siempre una imagen: la
 * página se dibuja acá, en el navegador, antes de subir. Así el editor calca
 * sobre una imagen y no tiene que abrir un PDF cada vez, y el servidor no
 * necesita saber leerlos.
 */
export default function NuevaPlantaForm({
  action,
  obraId,
  slug,
}: {
  action: (formData: FormData) => Promise<{ error?: string; id?: string }>;
  obraId: string;
  slug: string;
}) {
  const router = useRouter();
  /** El plano ya convertido a imagen: lo que se va a subir. */
  const [imagen, setImagen] = useState<(Imagen & { vista: string }) | null>(null);
  /** Cuántas páginas tiene el PDF elegido. Null si no es un PDF. */
  const [paginas, setPaginas] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<"quieto" | "leyendo" | "subiendo">("quieto");
  const [error, setError] = useState<string | null>(null);
  // El PDF abierto, para no leerlo de nuevo al cambiar de página.
  const pdf = useRef<{ documento: PdfAbierto; nombre: string } | null>(null);
  // Cada preparación lleva su número: si se cambia de página antes de que
  // termine la anterior, la que llega tarde no pisa a la que se pidió después.
  const turno = useRef(0);

  /**
   * Convierte lo elegido en la imagen que se va a subir, y la muestra.
   *
   * Se hace al elegir y no al guardar para que se vea qué se está por subir:
   * en un PDF de varias láminas, la página 3 no dice nada hasta que se la ve.
   */
  const preparar = async (hacer: () => Promise<Imagen>) => {
    const mio = ++turno.current;
    setError(null);
    setEstado("leyendo");

    try {
      const lista = await hacer();
      if (mio !== turno.current) return;
      setImagen((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior.vista);
        return { ...lista, vista: URL.createObjectURL(lista.archivo) };
      });
    } catch {
      if (mio !== turno.current) return;
      setImagen(null);
      setError("No se pudo abrir el plano. Probá con otro archivo o subilo como imagen.");
    }

    if (mio === turno.current) setEstado("quieto");
  };

  const elegir = (elegido: File | null) => {
    setPaginas(null);
    setPagina(1);
    pdf.current = null;

    if (!elegido) {
      turno.current++;
      setImagen(null);
      return;
    }

    if (!esPdf(elegido)) {
      preparar(() => prepararImagen(elegido));
      return;
    }

    preparar(async () => {
      const documento = await abrirPdf(elegido);
      pdf.current = { documento, nombre: elegido.name };
      setPaginas(documento.numPages);
      return dibujarPagina(documento, 1, elegido.name);
    });
  };

  const cambiarPagina = (numero: number) => {
    const abierto = pdf.current;
    if (!abierto) return;
    setPagina(numero);
    preparar(() => dibujarPagina(abierto.documento, numero, abierto.nombre));
  };

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!imagen || estado !== "quieto") return;

    const formData = new FormData(e.currentTarget);
    setError(null);
    setEstado("subiendo");

    try {
      formData.set("imagen", imagen.archivo);
      formData.set("imagen_ancho", String(imagen.ancho));
      formData.set("imagen_alto", String(imagen.alto));

      const resultado = await action(formData);

      if (resultado.id) {
        // Derecho al editor: una planta recién creada no tiene nada que mirar
        // en el listado. El botón queda en "Subiendo" hasta que cambia la
        // pantalla, para que no se pueda mandar dos veces.
        router.push(`/obras/${slug}/plantas/${resultado.id}`);
        return;
      }

      setError(resultado.error ?? "No se pudo crear la planta.");
    } catch {
      setError("No se pudo subir el plano. Probá de nuevo.");
    }

    setEstado("quieto");
  };

  return (
    <form onSubmit={enviar}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />

      {error && <p style={errorBox}>{error}</p>}

      <div style={ui.panel}>
        <div style={grid}>
          <label style={fieldAncho}>
            <span style={labelCampo}>Nombre</span>
            <input
              type="text"
              name="nombre"
              required
              placeholder="Ej: Planta tipo (1.º a 4.º)"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={labelCampo}>Altura de piso a techo (m)</span>
            <input
              type="number"
              name="altura"
              required
              min="0.01"
              step="0.01"
              defaultValue="2.6"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={labelCampo}>Pisos iguales</span>
            <input
              type="number"
              name="repeticiones"
              required
              min="1"
              step="1"
              defaultValue="1"
              style={ui.input}
            />
            <span style={ayuda}>
              Una planta tipo que se repite del 1.º al 4.º son 4: se dibuja una
              vez y las medidas se multiplican.
            </span>
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>Plano</span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              required
              onChange={(e) => elegir(e.target.files?.[0] ?? null)}
              style={ui.input}
            />
            <span style={ayuda}>
              PDF o imagen. Tiene que traer una regla o una cota conocida: es
              con lo que después se marca la escala.
            </span>
          </label>

          {paginas !== null && paginas > 1 && (
            <label style={field}>
              <span style={labelCampo}>Página del PDF</span>
              <input
                type="number"
                min="1"
                max={paginas}
                step="1"
                value={pagina}
                onChange={(e) =>
                  cambiarPagina(
                    Math.min(paginas, Math.max(1, Math.round(Number(e.target.value)) || 1))
                  )
                }
                style={ui.input}
              />
              <span style={ayuda}>El PDF tiene {paginas} páginas.</span>
            </label>
          )}

          {imagen && (
            // eslint-disable-next-line @next/next/no-img-element -- es un archivo local recién elegido, no hay nada que optimizar
            <img src={imagen.vista} alt="El plano que se va a subir" style={vistaPrevia} />
          )}
        </div>
      </div>

      <div style={acciones}>
        <Link href={`/obras/${slug}/plantas`} style={ui.secondaryButton}>
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={estado !== "quieto" || !imagen}
          style={estado !== "quieto" || !imagen ? botonInactivo : ui.button}
        >
          {estado === "subiendo"
            ? "Subiendo el plano..."
            : estado === "leyendo"
              ? "Leyendo el plano..."
              : "Crear planta"}
        </button>
      </div>
    </form>
  );
}

function esPdf(archivo: File) {
  return archivo.type === "application/pdf" || /\.pdf$/i.test(archivo.name);
}

type PdfAbierto = Awaited<ReturnType<typeof abrirPdf>>;

/**
 * Abre un PDF con pdf.js.
 *
 * Se importa recién acá, y no arriba del archivo, para que la librería —que
 * pesa— no viaje con cada pantalla sino sólo cuando alguien elige un PDF. Es
 * el build `legacy` porque el común usa cosas de JavaScript que un navegador
 * de hace un año todavía no tiene.
 */
async function abrirPdf(archivo: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  return pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
}

/** Dibuja una página del PDF y la devuelve como JPG. */
async function dibujarPagina(
  pdf: PdfAbierto,
  numero: number,
  nombreOriginal: string
): Promise<Imagen> {
  const pagina = await pdf.getPage(numero);
  const natural = pagina.getViewport({ scale: 1 });
  const viewport = pagina.getViewport({
    scale: LADO_PDF / Math.max(natural.width, natural.height),
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  await pagina.render({ canvas, viewport }).promise;

  const base = nombreOriginal.replace(/\.pdf$/i, "");
  return {
    archivo: await aJpg(canvas, `${base}${pdf.numPages > 1 ? `-p${numero}` : ""}.jpg`),
    ancho: canvas.width,
    alto: canvas.height,
  };
}

/** Una imagen se sube como vino, salvo que sea desmedida. */
async function prepararImagen(archivo: File): Promise<Imagen> {
  const bitmap = await createImageBitmap(archivo);
  const lado = Math.max(bitmap.width, bitmap.height);

  if (lado <= LADO_MAXIMO) {
    return { archivo, ancho: bitmap.width, alto: bitmap.height };
  }

  const factor = LADO_MAXIMO / lado;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * factor);
  canvas.height = Math.round(bitmap.height * factor);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sin canvas");
  // Fondo blanco: un PNG transparente pasado a JPG quedaría negro.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return {
    archivo: await aJpg(canvas, archivo.name.replace(/\.[^.]+$/, "") + ".jpg"),
    ancho: canvas.width,
    alto: canvas.height,
  };
}

function aJpg(canvas: HTMLCanvasElement, nombre: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(new File([blob], nombre, { type: "image/jpeg" }))
          : reject(new Error("no se pudo exportar el plano")),
      "image/jpeg",
      0.92
    );
  });
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
  alignContent: "start" as const,
};

const fieldAncho = {
  ...field,
  gridColumn: "1 / -1",
};

const vistaPrevia = {
  gridColumn: "1 / -1",
  maxWidth: "100%",
  maxHeight: "360px",
  border: "1px solid #eeeeee",
  borderRadius: "10px",
  justifySelf: "start" as const,
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const ayuda = {
  fontSize: "13px",
  color: "#999999",
};

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};

const botonInactivo = {
  ...ui.button,
  background: "#999999",
  border: "1px solid #999999",
  cursor: "not-allowed",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
