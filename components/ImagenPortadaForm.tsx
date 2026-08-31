"use client";

import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import * as ui from "@/components/ui";

/**
 * La imagen de portada de la obra, siempre cuadrada (1:1).
 *
 * El recorte lo elige el usuario en el navegador —arrastra para mover,
 * desliza para acercar— y lo que se sube a Drive ya sale recortado al tamaño
 * final. Así no hace falta guardar coordenadas ni recalcular nada al mostrarla
 * en el listado: es una imagen más, ya lista.
 *
 * El acercamiento nunca deja hueco: el mínimo (`zoom = 1`) es el que cubre el
 * marco entero, igual que un `object-fit: cover`, y desde ahí sólo se puede
 * acercar más, nunca alejar hasta ver de menos.
 */

const MARCO_ANCHO = 350;
const MARCO_ALTO = 350; // cuadrada

const SALIDA_ANCHO = 960;
const SALIDA_ALTO = 960; // misma proporción, en el tamaño que se guarda

export type ImagenActual = {
  driveId: string;
  nombre: string | null;
};

export default function ImagenPortadaForm({
  obraId,
  slug,
  imagenActual,
  subirAction,
  eliminarAction,
}: {
  obraId: string;
  slug: string;
  imagenActual: ImagenActual | null;
  subirAction: (formData: FormData) => void;
  eliminarAction: (formData: FormData) => void;
}) {
  const [archivo, setArchivo] = useState<{
    url: string;
    img: HTMLImageElement;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const arrastre = useRef<{ x: number; y: number } | null>(null);

  function elegirArchivo() {
    inputRef.current?.click();
  }

  function onArchivoElegido(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setArchivo({ url, img });
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setError(null);
    };
    img.src = url;
  }

  function cancelar() {
    if (archivo) URL.revokeObjectURL(archivo.url);
    setArchivo(null);
  }

  // El mínimo cubre el marco entero, como object-fit: cover. `zoom` multiplica
  // desde ahí: 1 es "lo más lejos que se puede", nunca deja un borde vacío.
  function escalaPara(z: number) {
    if (!archivo) return 1;
    const base = Math.max(
      MARCO_ANCHO / archivo.img.naturalWidth,
      MARCO_ALTO / archivo.img.naturalHeight
    );
    return base * z;
  }

  const escala = () => escalaPara(zoom);

  // Cuánto se puede desplazar sin que el marco se quede sin imagen en algún
  // borde: la mitad de lo que la imagen escalada excede al marco.
  function limitePan(s: number) {
    if (!archivo) return { x: 0, y: 0 };
    return {
      x: Math.max(0, (archivo.img.naturalWidth * s - MARCO_ANCHO) / 2),
      y: Math.max(0, (archivo.img.naturalHeight * s - MARCO_ALTO) / 2),
    };
  }

  function fijarPan(x: number, y: number, s: number) {
    const limite = limitePan(s);
    setPan({
      x: Math.max(-limite.x, Math.min(limite.x, x)),
      y: Math.max(-limite.y, Math.min(limite.y, y)),
    });
  }

  function onPointerDown(e: ReactPointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrastre.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!arrastre.current) return;
    fijarPan(e.clientX - arrastre.current.x, e.clientY - arrastre.current.y, escala());
  }

  function onPointerUp() {
    arrastre.current = null;
  }

  function onZoom(nuevo: number) {
    setZoom(nuevo);
    // Cambiar el zoom cambia cuánto se puede desplazar: si ya estaba en el
    // borde, hay que volver a acomodarlo con el nuevo límite.
    fijarPan(pan.x, pan.y, escalaPara(nuevo));
  }

  async function guardar() {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);

    const s = escala();

    // El centro de la imagen, desplazado por el pan, es el centro de lo que
    // se ve en el marco. De ahí sale la esquina de recorte en coordenadas de
    // la imagen original (sin escalar).
    const centroX = archivo.img.naturalWidth / 2 - pan.x / s;
    const centroY = archivo.img.naturalHeight / 2 - pan.y / s;
    const cropAncho = MARCO_ANCHO / s;
    const cropAlto = MARCO_ALTO / s;

    const cropX = Math.max(
      0,
      Math.min(centroX - cropAncho / 2, archivo.img.naturalWidth - cropAncho)
    );
    const cropY = Math.max(
      0,
      Math.min(centroY - cropAlto / 2, archivo.img.naturalHeight - cropAlto)
    );

    const canvas = document.createElement("canvas");
    canvas.width = SALIDA_ANCHO;
    canvas.height = SALIDA_ALTO;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setError("El navegador no pudo procesar la imagen.");
      setSubiendo(false);
      return;
    }

    ctx.drawImage(
      archivo.img,
      cropX,
      cropY,
      cropAncho,
      cropAlto,
      0,
      0,
      SALIDA_ANCHO,
      SALIDA_ALTO
    );

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setError("No se pudo generar la imagen recortada.");
          setSubiendo(false);
          return;
        }

        const formData = new FormData();
        formData.set("obra_id", obraId);
        formData.set("slug", slug);
        formData.set("imagen", blob, "portada.jpg");

        await subirAction(formData);
        // Si `subirAction` no redirige (por ejemplo un error), se libera el
        // botón para reintentar.
        setSubiendo(false);
      },
      "image/jpeg",
      0.9
    );
  }

  function quitar() {
    const formData = new FormData();
    formData.set("obra_id", obraId);
    formData.set("slug", slug);
    eliminarAction(formData);
  }

  return (
    <div style={panel}>
      <h3 style={sectionTitle}>Imagen de portada</h3>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onArchivoElegido}
        style={{ display: "none" }}
      />

      {error && <p style={errorBox}>{error}</p>}

      {archivo ? (
        <>
          <div
            style={marco}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={archivo.url}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: archivo.img.naturalWidth * escala(),
                height: archivo.img.naturalHeight * escala(),
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
                cursor: "grab",
              }}
            />
          </div>

          <p style={ayuda}>Arrastrá para mover. Acercá con el control de abajo.</p>

          <div style={controlZoom}>
            <span style={ayuda}>Acercar</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => onZoom(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>

          <div style={acciones}>
            <button
              type="button"
              onClick={cancelar}
              disabled={subiendo}
              style={ui.secondaryButton}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={subiendo}
              style={ui.button}
            >
              {subiendo ? "Guardando..." : "Guardar imagen"}
            </button>
          </div>
        </>
      ) : imagenActual ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/archivos/${imagenActual.driveId}`}
            alt={imagenActual.nombre ?? "Portada"}
            style={previa}
          />

          <div style={acciones}>
            <button type="button" onClick={elegirArchivo} style={ui.secondaryButton}>
              Cambiar imagen
            </button>
            <button type="button" onClick={quitar} style={botonQuitar}>
              Quitar imagen
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={vacio}>Sin imagen todavía</div>

          <div style={acciones}>
            <button type="button" onClick={elegirArchivo} style={ui.button}>
              Elegir imagen
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// El margen abajo es propio: esto se usa arriba de ObraForm, que no trae uno
// arriba (nunca esperó tener un panel como este apilado justo antes).
const panel = {
  ...ui.panel,
  marginBottom: "32px",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
  margin: "0 0 16px",
};

const marco = {
  position: "relative" as const,
  width: `${MARCO_ANCHO}px`,
  height: `${MARCO_ALTO}px`,
  overflow: "hidden" as const,
  background: "#f2f2f2",
  border: "1px solid #dcdcdc",
  touchAction: "none" as const,
};

const previa = {
  width: `${MARCO_ANCHO}px`,
  height: `${MARCO_ALTO}px`,
  objectFit: "cover" as const,
  display: "block" as const,
  border: "1px solid #dcdcdc",
};

const vacio = {
  width: `${MARCO_ANCHO}px`,
  height: `${MARCO_ALTO}px`,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  background: "#f2f2f2",
  border: "1px dashed #cccccc",
  color: "#999999",
  fontSize: "14px",
};

const ayuda = {
  fontSize: "13px",
  color: "#999999",
  margin: "10px 0 0",
};

const controlZoom = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginTop: "12px",
  maxWidth: `${MARCO_ANCHO}px`,
};

const acciones = {
  display: "flex",
  gap: "12px",
  marginTop: "16px",
};

const botonQuitar = {
  background: "none",
  border: "1px solid #dcdcdc",
  padding: "12px 18px",
  fontSize: "14px",
  color: "#b91c1c",
  cursor: "pointer",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "12px",
  marginBottom: "16px",
  fontSize: "14px",
};
