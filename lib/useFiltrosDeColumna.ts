"use client";

import { useMemo, useState } from "react";

/**
 * El filtro estilo Excel que ya tenía Gastos (`components/GastosLista.tsx`),
 * sacado para que cualquier tabla lo pueda usar: el desplegable de una
 * columna lista sus valores con una casilla cada uno, y "Todos"/"Ninguno" son
 * los dos extremos para no tener que tildar o destildar uno por uno.
 *
 * No filtra las filas por sí solo: devuelve `coincide(fila)` para que cada
 * pantalla lo combine con lo suyo (buscador de texto, otros toggles).
 */

export type ColumnaFiltro<T> = {
  clave: string;
  rotulo: string;
  /** El mismo texto que muestra la celda, así el desplegable ofrece
   *  exactamente lo que se ve en pantalla. */
  valorDe: (fila: T) => string;
};

export function useFiltrosDeColumna<T>(
  filas: T[],
  columnas: readonly ColumnaFiltro<T>[]
) {
  const [filtros, setFiltros] = useState<Record<string, Set<string>>>({});
  const [abierto, setAbierto] = useState<string | null>(null);

  const opciones = useMemo(() => {
    const mapa: Record<string, string[]> = {};
    for (const col of columnas) {
      mapa[col.clave] = [...new Set(filas.map((f) => col.valorDe(f)))].sort(
        (a, b) => a.localeCompare(b)
      );
    }
    return mapa;
  }, [filas, columnas]);

  // Sin filtro guardado, todas las casillas están tildadas. Destildar una
  // crea el filtro con el resto; volver a tildarlas todas lo borra, así "sin
  // filtro" queda como el estado natural de la columna.
  const alternar = (clave: string, valor: string) => {
    setFiltros((prev) => {
      const nuevo = new Set(prev[clave] ?? opciones[clave]);
      if (nuevo.has(valor)) {
        nuevo.delete(valor);
      } else {
        nuevo.add(valor);
      }

      const copia = { ...prev };
      if (nuevo.size === opciones[clave].length) {
        delete copia[clave];
      } else {
        copia[clave] = nuevo;
      }
      return copia;
    });
  };

  const limpiar = (clave: string) => {
    setFiltros((prev) => {
      const copia = { ...prev };
      delete copia[clave];
      return copia;
    });
  };

  // Vaciar y tildar a mano las que interesan es más rápido que destildar
  // todas las demás una por una.
  const vaciar = (clave: string) => {
    setFiltros((prev) => ({ ...prev, [clave]: new Set<string>() }));
  };

  const hayFiltros = Object.keys(filtros).length > 0;

  const coincide = (fila: T) => {
    for (const col of columnas) {
      const elegidos = filtros[col.clave];
      if (elegidos && !elegidos.has(col.valorDe(fila))) return false;
    }
    return true;
  };

  return {
    filtros,
    opciones,
    abierto,
    setAbierto,
    alternar,
    limpiar,
    vaciar,
    hayFiltros,
    coincide,
  };
}
