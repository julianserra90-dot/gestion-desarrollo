"use client";

import * as ui from "@/components/ui";

/**
 * Cuándo se hizo un avance: **en el día** —una fecha— o **desde/hasta** —dos—.
 * Con las dos se sabe cuántos días llevó. Lo usan la carga a mano del rubro y
 * el marcado del 3D.
 *
 * `desde` null es en el día. Con `nombres`, los campos van en el formulario
 * con esos nombres (el de fin siempre; el de inicio, sólo con desde/hasta).
 */
export default function ElegirFechas({
  desde,
  hasta,
  alCambiar,
  nombres,
}: {
  desde: string | null;
  hasta: string;
  alCambiar: (fechas: { desde: string | null; hasta: string }) => void;
  nombres?: { desde: string; hasta: string };
}) {
  const enRango = desde !== null;
  return (
    <div style={caja}>
      <div style={selector} role="group" aria-label="Cuándo">
        <button
          type="button"
          aria-pressed={!enRango}
          onClick={() => alCambiar({ desde: null, hasta })}
          style={!enRango ? opcionPuesta : opcion}
        >
          En el día
        </button>
        <button
          type="button"
          aria-pressed={enRango}
          onClick={() => alCambiar({ desde: desde ?? hasta, hasta })}
          style={enRango ? opcionPuesta : opcion}
        >
          Desde/hasta
        </button>
      </div>
      <div style={fechas}>
        {enRango && (
          <>
            <input
              type="date"
              name={nombres?.desde}
              value={desde}
              max={hasta}
              onChange={(e) => alCambiar({ desde: e.target.value || hasta, hasta })}
              aria-label="Desde"
              style={campo}
            />
            <span style={a}>a</span>
          </>
        )}
        <input
          type="date"
          name={nombres?.hasta}
          value={hasta}
          min={desde ?? undefined}
          onChange={(e) => e.target.value && alCambiar({ desde, hasta: e.target.value })}
          aria-label={enRango ? "Hasta" : "Día"}
          style={campo}
          required
        />
      </div>
    </div>
  );
}

// El selector y las fechas, un solo bloque del mismo ancho: el selector ocupa
// la fila de los rótulos de al lado (26 px) y las fechas, la de los campos.
const caja = { display: "inline-grid", gap: "6px" };

const selector = {
  display: "flex",
  height: "26px",
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  borderRadius: "999px",
  overflow: "hidden" as const,
};

const opcion = {
  flex: "1 1 0",
  padding: "0 12px",
  whiteSpace: "nowrap" as const,
  background: "#ffffff",
  color: "#555555",
  border: "none",
  fontSize: "12px",
  fontFamily: "inherit",
  cursor: "pointer",
};

const opcionPuesta = { ...opcion, background: "#111111", color: "#ffffff", fontWeight: 600 };

const fechas = { display: "flex", alignItems: "center", gap: "8px" };

const campo = { ...ui.input, width: "auto" };

const a = { fontSize: "13px", color: "#777777" };
