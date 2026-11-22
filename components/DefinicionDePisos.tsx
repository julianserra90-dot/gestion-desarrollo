"use client";

import { useState, useTransition } from "react";
import * as ui from "@/components/ui";
import { formatNivel } from "@/lib/format";
import {
  type Piso,
  aDefinicion,
  borrarPiso,
  cambiarPiso,
  insertarPiso,
  nombreDePiso,
  pisosDe,
  ponerCota,
} from "@/lib/pisos";

/**
 * La definición de pisos de la obra: una tabla con el número, el nombre, la
 * cota de nivel y la altura de cada piso, y la planta dibujada que le toca.
 *
 * Es la de cualquier programa de arquitectura, y a propósito: es donde se dice
 * a qué altura va cada piso, que es lo que hace falta para apilar las plantas.
 * Se lee de arriba hacia abajo como un corte —el último piso arriba, los
 * subsuelos abajo—.
 *
 * Las cotas van encadenadas (`lib/pisos.ts`): cambiar la altura de un piso
 * sube o baja a los de arriba, y escribir una cota le cambia la altura al de
 * abajo. No se puede dejar dos pisos encimados.
 *
 * Nada se guarda hasta "Guardar": se edita una copia, y "Cancelar" la tira.
 */
export default function DefinicionDePisos({
  pisos,
  plantas,
  guardar,
  alCerrar,
}: {
  pisos: Piso[];
  /** Las plantas dibujadas de la obra, para decir cuál es la de cada piso. */
  plantas: { id: string; nombre: string }[];
  guardar: (pisos: Piso[]) => Promise<{ error?: string }>;
  alCerrar: () => void;
}) {
  const [def, setDef] = useState(() => aDefinicion(pisos));
  /** El piso elegido, por su lugar en la lista de abajo hacia arriba. */
  const [elegido, setElegido] = useState(() => aDefinicion(pisos).base);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  const filas = pisosDe(def);
  const hayPisos = filas.length > 0;

  const insertar = (donde: "encima" | "abajo") => {
    const resultado = insertarPiso(def, elegido, donde);
    setDef(resultado.def);
    setElegido(resultado.indice);
  };

  const borrar = () => {
    const nueva = borrarPiso(def, elegido);
    setDef(nueva);
    setElegido(Math.min(elegido, Math.max(0, nueva.filas.length - 1)));
  };

  const confirmar = () => {
    iniciarGuardado(async () => {
      const resultado = await guardar(pisosDe(def));
      if (resultado.error) setError(resultado.error);
      else alCerrar();
    });
  };

  return (
    <div
      style={fondo}
      // Las teclas son del diálogo: Supr acá no borra un muro del plano.
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") alCerrar();
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Definición de pisos" style={caja}>
        <header style={cabecera}>
          <h2 style={titulo}>Definición de pisos</h2>
          {/* Lo único que hay que aclarar: de dónde a dónde es la altura. Es de
              piso terminado a piso terminado, no de piso a techo. */}
          <p style={bajada}>
            El nivel de piso terminado (NPT) de cada piso de la obra, y qué planta es la suya. La
            altura va de piso terminado a piso terminado.
          </p>
        </header>

        {error && <p style={errorBox}>{error}</p>}

        {hayPisos ? (
          <div style={tablaConBarra}>
            <table style={tabla}>
              <thead>
                <tr>
                  <th style={{ ...th, width: "44px" }}>N.º</th>
                  <th style={th}>Nombre</th>
                  <th style={{ ...th, width: "104px" }} title="Nivel de piso terminado">
                    Cota de nivel
                  </th>
                  <th
                    style={{ ...th, width: "104px" }}
                    title="De piso terminado a piso terminado"
                  >
                    Altura NPT a NPT
                  </th>
                  <th style={{ ...th, width: "170px" }}>Planta</th>
                </tr>
              </thead>
              <tbody>
                {/* De arriba hacia abajo, como se lee un corte. */}
                {filas
                  .map((piso, indice) => ({ piso, indice }))
                  .reverse()
                  .map(({ piso, indice }) => {
                    const activo = indice === elegido;
                    return (
                      <tr
                        key={indice}
                        onPointerDown={() => setElegido(indice)}
                        onFocus={() => setElegido(indice)}
                        style={activo ? filaElegida : undefined}
                      >
                        <td style={{ ...td, ...numero }}>{piso.numero}</td>
                        <td style={td}>
                          <input
                            type="text"
                            aria-label={`Nombre del piso ${piso.numero}`}
                            value={piso.nombre}
                            placeholder={nombreDePiso({ numero: piso.numero, nombre: "" })}
                            onChange={(e) =>
                              setDef(cambiarPiso(def, indice, { nombre: e.target.value }))
                            }
                            style={celda}
                          />
                        </td>
                        <td style={td}>
                          <CampoNumero
                            etiqueta={`Cota de nivel del piso ${piso.numero}`}
                            valor={piso.cota}
                            alCambiar={(cota) => setDef(ponerCota(def, indice, cota))}
                          />
                        </td>
                        <td style={td}>
                          <CampoNumero
                            etiqueta={`Altura del piso ${piso.numero}`}
                            valor={piso.altura}
                            positivo
                            alCambiar={(altura) => setDef(cambiarPiso(def, indice, { altura }))}
                          />
                        </td>
                        <td style={td}>
                          <select
                            aria-label={`Planta del piso ${piso.numero}`}
                            value={piso.plantaId ?? ""}
                            onChange={(e) =>
                              setDef(
                                cambiarPiso(def, indice, { plantaId: e.target.value || null })
                              )
                            }
                            style={celda}
                          >
                            <option value="">Sin planta</option>
                            {plantas.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={vacio}>Todavía no hay pisos definidos en esta obra.</p>
        )}

        {hayPisos && (
          <p style={resumen}>
            {filas.length} {filas.length === 1 ? "piso" : "pisos"}, de {formatNivel(filas[0].cota)}{" "}
            a{" "}
            {formatNivel(filas[filas.length - 1].cota + filas[filas.length - 1].altura)}
          </p>
        )}

        <footer style={pie}>
          <div style={grupo}>
            {hayPisos ? (
              <>
                <button type="button" onClick={() => insertar("encima")} style={boton}>
                  Insertar encima
                </button>
                <button type="button" onClick={() => insertar("abajo")} style={boton}>
                  Insertar abajo
                </button>
                <button type="button" onClick={borrar} style={botonBorrar}>
                  Borrar piso
                </button>
              </>
            ) : (
              <button type="button" onClick={() => insertar("encima")} style={boton}>
                Agregar la planta baja
              </button>
            )}
          </div>
          <div style={grupo}>
            <button type="button" onClick={alCerrar} style={boton}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={guardando}
              style={guardando ? botonFuerteQuieto : botonFuerte}
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * Un número de la tabla: una cota, que puede ser negativa, o una altura, que
 * no.
 *
 * Guarda el texto aparte del número: mientras se escribe "-" o "2," todavía
 * no hay un valor, y si el campo mostrara el guardado borraría lo tipeado.
 * Avisa sólo cuando lo escrito ya es un número que sirve, y sigue al valor
 * cuando cambia por afuera —la cota de un piso se mueve sola cuando se toca
 * la altura del de abajo—.
 */
function CampoNumero({
  etiqueta,
  valor,
  alCambiar,
  positivo = false,
}: {
  etiqueta: string;
  valor: number;
  alCambiar: (nuevo: number) => void;
  positivo?: boolean;
}) {
  const [texto, setTexto] = useState(String(valor));
  const [visto, setVisto] = useState(valor);

  if (visto !== valor) {
    setVisto(valor);
    if (Number(texto) !== valor) setTexto(String(valor));
  }

  return (
    <input
      type="number"
      step="0.01"
      aria-label={etiqueta}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        if (e.target.value === "") return;
        const n = Number(e.target.value);
        if (Number.isFinite(n) && (!positivo || n > 0)) alCambiar(n);
      }}
      // Al salir, lo que quedó a medio escribir vuelve a ser el valor.
      onBlur={() => setTexto(String(valor))}
      style={{ ...celda, textAlign: "right" as const }}
    />
  );
}

// ---- Estilos ----------------------------------------------------------------

const fondo = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 50,
  display: "grid",
  placeItems: "center",
  padding: "16px",
  background: "rgba(17, 17, 17, 0.35)",
};

const caja = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "14px",
  width: "min(720px, 100%)",
  maxHeight: "calc(100vh - 32px)",
  padding: "20px",
  background: "#ffffff",
  borderRadius: ui.RADIO,
  boxShadow: "0 20px 60px rgba(17, 17, 17, 0.25)",
};

const cabecera = {
  display: "grid",
  gap: "4px",
};

const titulo = {
  fontSize: "18px",
  fontWeight: 600,
  margin: 0,
};

const bajada = {
  fontSize: "13px",
  color: "#777777",
  margin: 0,
};

/** La tabla es lo único que se corre si la obra tiene muchos pisos. */
const tablaConBarra = {
  minHeight: 0,
  overflowY: "auto" as const,
  border: "1px solid #eeeeee",
  borderRadius: "12px",
};

const tabla = {
  width: "100%",
  borderCollapse: "collapse" as const,
  tableLayout: "fixed" as const,
  fontSize: "14px",
};

const th = {
  position: "sticky" as const,
  top: 0,
  background: "#fafafa",
  textAlign: "left" as const,
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  fontWeight: 600,
  color: "#666666",
  padding: "8px 8px",
  borderBottom: "1px solid #eeeeee",
};

const td = {
  padding: "3px 4px",
  borderBottom: "1px solid #f3f3f3",
};

const numero = {
  textAlign: "center" as const,
  fontVariantNumeric: "tabular-nums" as const,
  fontWeight: 600,
  color: "#111111",
};

const filaElegida = {
  background: "#eef2ff",
};

/** Un campo de la tabla: sin caja hasta que se lo toca, como una planilla. */
const celda = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "7px 8px",
  border: "1px solid transparent",
  borderRadius: "8px",
  background: "transparent",
  font: "inherit",
  color: "#111111",
  fontVariantNumeric: "tabular-nums" as const,
};

const vacio = {
  fontSize: "14px",
  color: "#777777",
  margin: "8px 0",
};

const resumen = {
  fontSize: "13px",
  color: "#555555",
  margin: 0,
};

const pie = {
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap" as const,
  gap: "10px",
};

const grupo = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "6px",
};

const boton = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  borderRadius: "999px",
  padding: "8px 14px",
  fontSize: "13px",
  cursor: "pointer",
};

const botonBorrar = {
  ...boton,
  color: ui.ROJO,
};

const botonFuerte = {
  ...boton,
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  fontWeight: 600,
};

const botonFuerteQuieto = {
  ...botonFuerte,
  background: "#999999",
  border: "1px solid #999999",
  cursor: "default",
};

const errorBox = {
  border: "1px solid #111111",
  borderRadius: "10px",
  padding: "10px 12px",
  fontSize: "13px",
  margin: 0,
};
