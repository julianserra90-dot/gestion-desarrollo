"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as ui from "@/components/ui";

/**
 * El cartel que pregunta antes de algo que no se deshace.
 *
 * Reemplaza a `window.confirm`, que **no sirve**: el navegador de adentro de
 * una app —el que se usa para mirar la obra mientras se trabaja— no abre las
 * ventanas del sistema y devuelve "no" al instante, sin mostrar nada. El
 * borrado se cortaba solo, en silencio, y parecía que el botón no andaba.
 *
 * Se usa con el hook: `preguntar` devuelve una promesa con la respuesta, y
 * `dialogo` es lo que hay que poner en la pantalla.
 *
 *     const { preguntar, dialogo } = useConfirmacion();
 *     const borrar = async () => {
 *       if (!(await preguntar("¿Borrar?", "Borrar"))) return;
 *       …
 *     };
 *     return <>{…}{dialogo}</>;
 */
export function useConfirmacion() {
  const [pregunta, setPregunta] = useState<{ mensaje: string; confirmar: string } | null>(null);
  /** El `resolve` de la promesa que está esperando la respuesta. */
  const responder = useRef<((si: boolean) => void) | null>(null);

  const cerrar = useCallback((si: boolean) => {
    responder.current?.(si);
    responder.current = null;
    setPregunta(null);
  }, []);

  const preguntar = useCallback(
    (mensaje: string, confirmar = "Sí") => {
      // Si ya había una abierta —dos clics seguidos—, la de antes se va con un
      // "no": nadie la contestó.
      responder.current?.(false);
      responder.current = null;
      setPregunta({ mensaje, confirmar });
      return new Promise<boolean>((resolver) => {
        responder.current = resolver;
      });
    },
    []
  );

  // Si el que preguntó se va de la pantalla, la promesa no queda colgada.
  useEffect(() => () => responder.current?.(false), []);

  const dialogo = pregunta ? (
    <Cartel mensaje={pregunta.mensaje} confirmar={pregunta.confirmar} cerrar={cerrar} />
  ) : null;

  return { preguntar, dialogo };
}

function Cartel({
  mensaje,
  confirmar,
  cerrar,
}: {
  mensaje: string;
  confirmar: string;
  cerrar: (si: boolean) => void;
}) {
  const noGracias = useRef<HTMLButtonElement>(null);

  // Arranca en Cancelar, que es lo que no rompe nada, y Escape también sale.
  useEffect(() => {
    noGracias.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cerrar(false);
      }
    };
    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, [cerrar]);

  return (
    <div
      style={fondo}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar"
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar(false);
      }}
    >
      <div style={caja}>
        <p style={texto}>{mensaje}</p>
        <div style={pie}>
          <button type="button" ref={noGracias} onClick={() => cerrar(false)} style={ui.secondaryButton}>
            Cancelar
          </button>
          <button type="button" onClick={() => cerrar(true)} style={botonFuerte}>
            {confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Estilos ----------------------------------------------------------------

const fondo = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 90,
  display: "grid",
  placeItems: "center",
  padding: "16px",
  background: "rgba(17, 17, 17, 0.35)",
};

const caja = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "18px",
  width: "min(440px, 100%)",
  padding: "22px",
  background: "#ffffff",
  borderRadius: ui.RADIO,
  boxShadow: "0 20px 60px rgba(17, 17, 17, 0.25)",
};

const texto = {
  margin: 0,
  fontSize: "15px",
  lineHeight: 1.5,
  color: "#111111",
};

const pie = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
};

/** Rojo: lo que pasa por este cartel no se deshace. */
const botonFuerte = {
  ...ui.button,
  background: ui.ROJO,
  border: `1px solid ${ui.ROJO}`,
};
