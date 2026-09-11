"use client";

import * as ui from "@/components/ui";

/**
 * El `<th>` de una columna con filtro estilo Excel: mismo look que
 * `GastosLista.tsx`, para que el filtro se lea igual en cualquier tabla de la
 * app. La lógica vive en `useFiltrosDeColumna`; esto es sólo el dibujo.
 */
export default function ColumnaFiltrable({
  clave,
  rotulo,
  opciones,
  filtro,
  abierto,
  onAbrir,
  onCerrar,
  onAlternar,
  onLimpiar,
  onVaciar,
  alineacion = "izquierda",
}: {
  clave: string;
  rotulo: string;
  opciones: string[];
  /** Los valores tildados, o `undefined` si la columna no tiene filtro (todos
   *  tildados). */
  filtro: Set<string> | undefined;
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  onAlternar: (valor: string) => void;
  onLimpiar: () => void;
  onVaciar: () => void;
  alineacion?: "izquierda" | "derecha";
}) {
  const activo = Boolean(filtro);

  return (
    <th style={{ ...(alineacion === "derecha" ? ui.thRight : ui.th), position: "relative" }}>
      <span style={contenidoTh}>
        {rotulo}
        <button
          type="button"
          onClick={onAbrir}
          style={{ ...botonFiltro, color: activo ? "#111111" : "#bbbbbb" }}
          title={`Filtrar por ${rotulo.toLowerCase()}`}
        >
          ▾
        </button>
      </span>

      {abierto && (
        <>
          {/* Capa invisible que cierra el desplegable al tocar afuera. */}
          <div style={fondoCerrar} onClick={onCerrar} />

          <div style={popover}>
            <div style={accionesPopover}>
              <button type="button" onClick={onLimpiar} style={enlacePopover}>
                Todos
              </button>
              <span style={separadorPopover}>·</span>
              <button type="button" onClick={onVaciar} style={enlacePopover}>
                Ninguno
              </button>
            </div>

            {opciones.map((valor) => (
              <label key={valor || clave} style={opcionFiltro}>
                <input
                  type="checkbox"
                  checked={!filtro || filtro.has(valor)}
                  onChange={() => onAlternar(valor)}
                />
                {valor}
              </label>
            ))}
          </div>
        </>
      )}
    </th>
  );
}

const contenidoTh = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
};

const botonFiltro = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 2px",
  fontSize: "11px",
  lineHeight: 1,
};

const fondoCerrar = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 10,
};

// El th escribe en mayúsculas espaciadas; el desplegable vuelve al texto
// normal. La sombra es la única de la app: sin ella el recuadro se funde con
// las filas que tapa.
const popover = {
  position: "absolute" as const,
  top: "calc(100% - 6px)",
  left: "8px",
  zIndex: 20,
  background: "#ffffff",
  border: "1px solid #dcdcdc",
  padding: "10px 12px",
  minWidth: "210px",
  maxHeight: "300px",
  overflowY: "auto" as const,
  boxShadow: "0 6px 16px rgba(0, 0, 0, 0.08)",
  textTransform: "none" as const,
  letterSpacing: "normal",
  fontWeight: 400,
  textAlign: "left" as const,
};

const accionesPopover = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  paddingBottom: "8px",
  marginBottom: "4px",
  borderBottom: "1px solid #eeeeee",
};

const separadorPopover = {
  color: "#cccccc",
};

const enlacePopover = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#111111",
  textDecoration: "underline",
  fontSize: "13px",
  cursor: "pointer",
};

const opcionFiltro = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "5px 0",
  fontSize: "13px",
  color: "#333333",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};
