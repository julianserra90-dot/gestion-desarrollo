"use client";

import { useState } from "react";
import { UNIDADES_COMPUTO } from "@/lib/unidades-computo";

const OTRA = "__otra__";

/**
 * El desplegable de unidades del cómputo, con "Otra…" para la que falte.
 *
 * Elegir "Otra…" lo cambia por un campo de texto: se escribe la unidad y
 * queda guardada como cualquier otra. Las que ya se usan en la obra (`extras`)
 * aparecen en la lista, para no tener que escribir la misma dos veces.
 */
export default function SelectorUnidad({
  value,
  onChange,
  extras = [],
  corto = false,
  style,
}: {
  value: string;
  onChange: (unidad: string) => void;
  /** Unidades ya usadas en la obra que no están en la lista. */
  extras?: string[];
  /** Sólo la abreviatura, para columnas angostas. */
  corto?: boolean;
  style?: React.CSSProperties;
}) {
  const [escribiendo, setEscribiendo] = useState(false);
  const [anterior, setAnterior] = useState(value);

  const conocidas = new Set(UNIDADES_COMPUTO.map((u) => u.valor));
  const propias = [...new Set([...extras, value])]
    .map((u) => u.trim())
    .filter((u) => u && !conocidas.has(u))
    .sort((a, b) => a.localeCompare(b, "es"));

  if (escribiendo) {
    return (
      <input
        type="text"
        value={value}
        autoFocus
        placeholder="Unidad"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          // Vacía no sirve: vuelve a la que tenía.
          if (!value.trim()) onChange(anterior);
          setEscribiendo(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            onChange(anterior);
            setEscribiendo(false);
          }
        }}
        style={style}
      />
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === OTRA) {
          setAnterior(value);
          onChange("");
          setEscribiendo(true);
          return;
        }
        onChange(e.target.value);
      }}
      style={style}
    >
      {UNIDADES_COMPUTO.map((u) => (
        <option key={u.valor} value={u.valor}>
          {corto && !u.nombre.includes("/") ? u.valor : u.nombre}
        </option>
      ))}
      {propias.length > 0 && (
        <optgroup label="Agregadas">
          {propias.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </optgroup>
      )}
      <option value={OTRA}>Otra…</option>
    </select>
  );
}
