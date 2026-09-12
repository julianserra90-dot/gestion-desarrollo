"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as ui from "@/components/ui";

export type MaterialOpcion = {
  id: string;
  nombre: string;
  unidad: string;
  /** El rubro del catálogo, por nombre: es lo que comparte con el de la obra. */
  rubroNombre: string | null;
};

const SIN_RUBRO = "Sin rubro";

/**
 * El desplegable de material, agrupado por rubro en acordeones.
 *
 * Un `<select>` nativo no pliega grupos, y con el catálogo entero en una lista
 * se hacía infinito. Acá cada rubro es un acordeón: el del gasto arranca
 * abierto y primero —es donde casi siempre está lo que se busca— y los demás
 * cerrados pero a mano, porque una compra de albañilería puede traer un
 * material de impermeabilización. Escribiendo arriba se busca en todos.
 *
 * Manda el id por un input oculto con el `name` que le den, así el server
 * action lo lee igual que antes.
 */
export default function SelectorMaterial({
  name,
  materiales,
  rubroNombre,
  value,
  onChange,
}: {
  name: string;
  materiales: MaterialOpcion[];
  /** El rubro elegido arriba en el formulario, por nombre. */
  rubroNombre: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  // Los rubros desplegados. Arranca con el del gasto; si cambia el rubro
  // arriba, se vuelve a arrancar con el nuevo.
  const [desplegados, setDesplegados] = useState<Set<string>>(
    () => new Set(rubroNombre ? [rubroNombre] : [])
  );
  const contenedor = useRef<HTMLDivElement>(null);

  // Ajuste durante el render, no en un efecto: al cambiar el rubro arriba se
  // vuelve a arrancar con ése abierto y los demás cerrados.
  const [rubroPrevio, setRubroPrevio] = useState(rubroNombre);
  if (rubroPrevio !== rubroNombre) {
    setRubroPrevio(rubroNombre);
    setDesplegados(new Set(rubroNombre ? [rubroNombre] : []));
  }

  // Clic afuera o Escape cierran, como cualquier desplegable.
  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTecla);
    };
  }, [abierto]);

  // Los grupos: el rubro del gasto primero, el resto alfabético, los sueltos
  // al final. Un rubro sin materiales no aparece: sería un acordeón vacío.
  const grupos = useMemo(() => {
    const porRubro = new Map<string, MaterialOpcion[]>();
    for (const m of materiales) {
      const clave = m.rubroNombre ?? SIN_RUBRO;
      porRubro.set(clave, [...(porRubro.get(clave) ?? []), m]);
    }
    return [...porRubro.entries()]
      .map(([titulo, lista]) => ({ titulo, materiales: lista }))
      .sort((a, b) => {
        if (a.titulo === rubroNombre) return -1;
        if (b.titulo === rubroNombre) return 1;
        if (a.titulo === SIN_RUBRO) return 1;
        if (b.titulo === SIN_RUBRO) return -1;
        return a.titulo.localeCompare(b.titulo);
      });
  }, [materiales, rubroNombre]);

  const texto = busqueda.trim().toLowerCase();
  const buscando = texto !== "";

  // Buscando se filtra en todos los rubros y se abren los que tienen algo: si
  // no, el resultado quedaría escondido en un acordeón cerrado.
  const visibles = grupos
    .map((g) => ({
      ...g,
      materiales: buscando
        ? g.materiales.filter((m) => m.nombre.toLowerCase().includes(texto))
        : g.materiales,
    }))
    .filter((g) => g.materiales.length > 0);

  const elegido = materiales.find((m) => m.id === value);

  const elegir = (id: string) => {
    onChange(id);
    setAbierto(false);
    setBusqueda("");
  };

  const alternar = (titulo: string) =>
    setDesplegados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(titulo)) siguiente.delete(titulo);
      else siguiente.add(titulo);
      return siguiente;
    });

  return (
    <div ref={contenedor} style={raiz}>
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        style={{ ...disparador, color: elegido ? "#111111" : "#777777" }}
      >
        <span style={textoDisparador}>
          {elegido ? elegido.nombre : "Elegí el material"}
        </span>
        <span style={flecha}>{abierto ? "▴" : "▾"}</span>
      </button>

      {abierto && (
        <div style={panel}>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              // Enter acá adentro no manda el formulario del gasto.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Buscar en todos los rubros"
            autoFocus
            style={buscador}
          />

          <div style={lista}>
            {visibles.length === 0 && (
              <p style={vacio}>
                {buscando ? "Ningún material con ese nombre." : "El catálogo está vacío."}
              </p>
            )}

            {visibles.map((g) => {
              const desplegado = buscando || desplegados.has(g.titulo);
              const esDelGasto = g.titulo === rubroNombre;
              return (
                <div key={g.titulo}>
                  <button
                    type="button"
                    onClick={() => alternar(g.titulo)}
                    style={cabeceraGrupo}
                  >
                    <span style={flechaGrupo}>{desplegado ? "▾" : "▸"}</span>
                    <span style={{ fontWeight: esDelGasto ? 600 : 400 }}>
                      {g.titulo}
                    </span>
                    <span style={cantidad}>{g.materiales.length}</span>
                  </button>

                  {desplegado &&
                    g.materiales.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => elegir(m.id)}
                        style={{
                          ...opcion,
                          background: m.id === value ? "#f2f2f2" : "transparent",
                        }}
                      >
                        <span>{m.nombre}</span>
                        <span style={unidad}>{m.unidad}</span>
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const raiz = {
  position: "relative" as const,
  minWidth: 0,
};

const disparador = {
  ...ui.input,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  textAlign: "left" as const,
  cursor: "pointer",
};

const textoDisparador = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

const flecha = {
  fontSize: "12px",
  color: "#777777",
  flexShrink: 0,
};

const panel = {
  position: "absolute" as const,
  top: "calc(100% + 4px)",
  left: 0,
  // Más ancho que el campo: los nombres de materiales no entran en la columna
  // del renglón y acá hay lugar para leerlos enteros.
  minWidth: "100%",
  width: "360px",
  maxWidth: "80vw",
  background: "#ffffff",
  border: "1px solid #dcdcdc",
  borderRadius: "10px",
  boxShadow: "0 12px 28px -12px rgba(17, 17, 17, 0.25)",
  zIndex: 20,
  display: "grid",
  gap: "8px",
  padding: "10px",
};

const buscador = {
  ...ui.input,
  padding: "8px 10px",
};

const lista = {
  maxHeight: "320px",
  overflowY: "auto" as const,
  display: "grid",
  gap: "2px",
};

const cabeceraGrupo = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "none",
  border: "none",
  borderTop: "1px solid #f0f0f0",
  padding: "8px 6px",
  fontSize: "13px",
  color: "#111111",
  cursor: "pointer",
  textAlign: "left" as const,
  fontFamily: "inherit",
};

const flechaGrupo = {
  fontSize: "11px",
  color: "#777777",
  width: "10px",
};

const cantidad = {
  marginLeft: "auto",
  fontSize: "12px",
  color: "#999999",
};

const opcion = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  border: "none",
  borderRadius: "6px",
  padding: "7px 10px 7px 24px",
  fontSize: "14px",
  color: "#111111",
  cursor: "pointer",
  textAlign: "left" as const,
  fontFamily: "inherit",
};

const unidad = {
  fontSize: "12px",
  color: "#999999",
  flexShrink: 0,
};

const vacio = {
  margin: 0,
  padding: "8px 6px",
  fontSize: "13px",
  color: "#777777",
};
