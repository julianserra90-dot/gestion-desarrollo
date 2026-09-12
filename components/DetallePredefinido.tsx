"use client";

import { useState } from "react";
import * as ui from "@/components/ui";

const NUEVO = "__nuevo__";

/**
 * El campo Detalle de gastos e ingresos, con la casilla "Predefinido".
 *
 * Sin marcar es el texto libre de siempre. Marcada, el texto se vuelve un
 * desplegable con el catálogo —para que "Jornales" se cargue siempre igual y
 * después se pueda agrupar— y una opción para escribir uno nuevo, que queda en
 * el catálogo al guardar. El catálogo es el mismo en todas las obras.
 *
 * Manda siempre `concepto`, venga de donde venga, y `agregar_detalle` cuando
 * lo escrito hay que sumarlo al catálogo. Arranca en la lista si el detalle
 * guardado está en ella: fue elegido de ahí.
 */
export default function DetallePredefinido({
  catalogo,
  defaultValue = "",
  placeholder,
  required = false,
}: {
  catalogo: string[];
  defaultValue?: string;
  placeholder: string;
  required?: boolean;
}) {
  const enCatalogo = defaultValue !== "" && catalogo.includes(defaultValue);
  const [predefinido, setPredefinido] = useState(enCatalogo);
  const [elegido, setElegido] = useState(enCatalogo ? defaultValue : "");
  const agregando = predefinido && elegido === NUEVO;

  return (
    <>
      <div style={filaEtiqueta}>
        <span style={labelCampo}>Detalle</span>
        <label style={casilla}>
          <input
            type="checkbox"
            checked={predefinido}
            onChange={(e) => {
              setPredefinido(e.target.checked);
              setElegido("");
            }}
          />
          Predefinido
        </label>
      </div>

      {!predefinido ? (
        <input
          type="text"
          name="concepto"
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          style={ui.input}
        />
      ) : agregando ? (
        <>
          <input type="hidden" name="agregar_detalle" value="on" />
          <div style={filaNuevo}>
            <input
              type="text"
              name="concepto"
              placeholder="Nuevo detalle"
              autoFocus
              required
              style={ui.input}
            />
            <button
              type="button"
              onClick={() => setElegido("")}
              style={ui.secondaryButton}
            >
              Volver a la lista
            </button>
          </div>
          <span style={ayudaCampo}>
            Se agrega al catálogo, el mismo en todas las obras.
          </span>
        </>
      ) : (
        <select
          name="concepto"
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          required
          style={ui.input}
        >
          <option value="">Seleccionar detalle</option>
          {catalogo.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          <option value={NUEVO}>+ Agregar uno nuevo…</option>
        </select>
      )}
    </>
  );
}

// La etiqueta y la casilla en la misma línea: la casilla es una forma de
// cargar el mismo campo, no otro campo.
const filaEtiqueta = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const ayudaCampo = {
  fontSize: "13px",
  color: "#999999",
};

const casilla = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  color: "#555555",
  cursor: "pointer",
};

const filaNuevo = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "12px",
  alignItems: "center",
};
