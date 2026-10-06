"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import * as ui from "@/components/ui";

export type TareaCatalogo = {
  id: string;
  subrubro: string | null;
  nombre: string;
  unidad: string;
};

export type RubroCatalogo = {
  nombre: string;
  tareas: TareaCatalogo[];
};

/**
 * El catálogo de tareas, en un acordeón arriba de la planilla.
 *
 * Tildar agrega la tarea al cómputo en el momento —con su desglose de
 * modelo— y destildar la saca: no hay "guardar selección" ni otra pantalla.
 * La casilla cambia enseguida y la planilla se refresca cuando la base
 * confirma; si falla, la casilla vuelve a como estaba.
 */
export default function CatalogoComputo({
  obraId,
  rubros,
  elegidas,
  rubrosObra,
  alternar,
  crearPropia,
}: {
  obraId: string;
  rubros: RubroCatalogo[];
  elegidas: string[];
  /** Los rubros de la obra, para una tarea propia. */
  rubrosObra: { id: string; nombre: string }[];
  alternar: (obraId: string, tareaId: string, incluir: boolean) => Promise<{ error?: string }>;
  crearPropia: (
    obraId: string,
    rubroId: string,
    nombre: string,
    unidad: string
  ) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [tildadas, setTildadas] = useState(() => new Set(elegidas));
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState("");
  const [, iniciar] = useTransition();
  const [pendientes, setPendientes] = useState<Set<string>>(() => new Set());

  // Lo que llega del servidor manda (otra pestaña, el tacho de la planilla).
  const firma = elegidas.slice().sort().join(",");
  const [firmaPrevia, setFirmaPrevia] = useState(firma);
  if (firma !== firmaPrevia) {
    setFirmaPrevia(firma);
    setTildadas(new Set(elegidas));
  }

  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState({ rubroId: "", nombre: "", unidad: "gl" });

  const termino = buscar.trim().toLowerCase();
  const coincide = (texto: string) => !termino || texto.toLowerCase().includes(termino);

  const marcar = (ids: string[], incluir: boolean) => {
    setTildadas((antes) => {
      const nuevo = new Set(antes);
      for (const id of ids) {
        if (incluir) nuevo.add(id);
        else nuevo.delete(id);
      }
      return nuevo;
    });
    setPendientes((antes) => new Set([...antes, ...ids]));

    iniciar(async () => {
      for (const id of ids) {
        const r = await alternar(obraId, id, incluir);
        if (r.error) {
          setError(r.error);
          setTildadas((antes) => {
            const nuevo = new Set(antes);
            if (incluir) nuevo.delete(id);
            else nuevo.add(id);
            return nuevo;
          });
        }
      }
      setPendientes((antes) => {
        const nuevo = new Set(antes);
        for (const id of ids) nuevo.delete(id);
        return nuevo;
      });
      router.refresh();
    });
  };

  const crear = () =>
    iniciar(async () => {
      const r = await crearPropia(obraId, nueva.rubroId, nueva.nombre, nueva.unidad);
      if (r.error) {
        setError(r.error);
        return;
      }
      setError("");
      setNueva({ rubroId: nueva.rubroId, nombre: "", unidad: "gl" });
      setCreando(false);
      router.refresh();
    });

  return (
    // Un acordeón a lo ancho arriba de la planilla, con la misma lógica que
    // los rubros de abajo. Arranca abierto sólo si todavía no hay nada
    // elegido: con el cómputo armado, la planilla es lo que se mira.
    <details style={panel} open={elegidas.length === 0 ? true : undefined} data-no-imprimir>
      <summary style={resumenPanel}>
        <span style={tituloPanel}>Agregar tareas</span>
        <span style={tildadas.size > 0 ? cuentaPanelActiva : cuentaPanel}>
          {tildadas.size === 1 ? "1 tarea elegida" : `${tildadas.size} tareas elegidas`}
        </span>
      </summary>

      <div style={barraCatalogo}>
        <input
          type="search"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar tarea (ej: revoque, losa, porcelanato)"
          style={{ ...ui.input, padding: "9px 12px", maxWidth: "420px" }}
        />

        <button type="button" onClick={() => setCreando((c) => !c)} style={botonCrear}>
          {creando ? "Cerrar" : "+ Crear ítem propio"}
        </button>
      </div>

      {creando && (
        <div style={formCrear}>
          <select
            value={nueva.rubroId}
            onChange={(e) => setNueva({ ...nueva, rubroId: e.target.value })}
            style={{ ...campoChico, width: "220px" }}
          >
            <option value="" disabled>
              Rubro
            </option>
            {rubrosObra.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={nueva.nombre}
            onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
            placeholder="Nombre de la tarea"
            style={{ ...campoChico, flex: 1, minWidth: "200px" }}
          />
          <input
            type="text"
            value={nueva.unidad}
            onChange={(e) => setNueva({ ...nueva, unidad: e.target.value })}
            placeholder="Unidad"
            style={{ ...campoChico, width: "90px" }}
          />
          <button type="button" onClick={crear} style={botonAgregar}>
            Agregar
          </button>
        </div>
      )}

      {error && <p style={textoError}>{error}</p>}

      <div style={lista}>
        {rubros.map((rubro) => {
          const visibles = rubro.tareas.filter(
            (t) => coincide(t.nombre) || coincide(rubro.nombre)
          );
          if (visibles.length === 0) return null;

          const cuantas = rubro.tareas.filter((t) => tildadas.has(t.id)).length;
          const todas = visibles.every((t) => tildadas.has(t.id));

          return (
            <details key={rubro.nombre} open={termino ? true : undefined} style={bloque}>
              <summary style={resumenRubro}>
                <span>{rubro.nombre}</span>
                {cuantas > 0 && <span style={contador}>{cuantas}</span>}
              </summary>

              <div style={accionesRubro}>
                <button
                  type="button"
                  onClick={() =>
                    marcar(
                      visibles.filter((t) => tildadas.has(t.id) === todas).map((t) => t.id),
                      !todas
                    )
                  }
                  style={enlace}
                >
                  {todas ? "Quitar todas" : "Agregar todas"}
                </button>
              </div>

              {visibles.map((t, i) => {
                const nuevoSub = t.subrubro && t.subrubro !== visibles[i - 1]?.subrubro;
                const elegida = tildadas.has(t.id);
                return (
                  <div key={t.id}>
                    {nuevoSub && <p style={subrubro}>{t.subrubro}</p>}
                    <label style={elegida ? filaElegida : fila}>
                      <input
                        type="checkbox"
                        checked={elegida}
                        disabled={pendientes.has(t.id)}
                        onChange={() => marcar([t.id], !elegida)}
                      />
                      <span style={{ flex: 1 }}>{t.nombre}</span>
                      <span style={unidad}>{t.unidad}</span>
                    </label>
                  </div>
                );
              })}
            </details>
          );
        })}
      </div>
    </details>
  );
}

// Fijo al costado mientras se recorre la planilla, con su propio scroll: el
// catálogo es largo y la planilla también, y tienen que poder verse juntos.
const panel = {
  ...ui.panel,
  marginBottom: "20px",
};

const resumenPanel = {
  cursor: "pointer",
};

const tituloPanel = {
  fontSize: "18px",
  fontWeight: 400,
  marginRight: "14px",
};

const cuentaPanel = {
  fontSize: "13px",
  color: "#999999",
};

const cuentaPanelActiva = {
  ...cuentaPanel,
  color: "#111111",
  fontWeight: 600,
};

const barraCatalogo = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap" as const,
  margin: "16px 0",
};

// Los rubros en columnas de diario: cada uno ocupa lo que necesita y los
// cortos no dejan huecos, como pasaría con una grilla de filas parejas. Dos
// como máximo —con tres se veía todo pegado— y una sola si la ventana no da
// para dos de 380px.
const lista = {
  columnCount: 2,
  columnWidth: "380px",
  columnGap: "48px",
};

const bloque = {
  borderBottom: "1px solid #f0f0f0",
  paddingBottom: "6px",
  breakInside: "avoid" as const,
};

const resumenRubro = {
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
  color: "#111111",
  padding: "6px 0",
};

const contador = {
  display: "inline-block",
  marginLeft: "8px",
  background: "#111111",
  color: "#ffffff",
  borderRadius: "999px",
  fontSize: "11px",
  padding: "1px 7px",
  fontWeight: 600,
};

const accionesRubro = {
  margin: "2px 0 4px",
};

const fila = {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  padding: "6px 6px",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#333333",
  cursor: "pointer",
  lineHeight: 1.35,
};

const filaElegida = {
  ...fila,
  background: "#f3f3f3",
  fontWeight: 600,
  color: "#111111",
};

const unidad = {
  color: "#999999",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const subrubro = {
  fontSize: "10px",
  fontWeight: 600,
  color: "#888888",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  margin: "10px 0 2px 6px",
};

const enlace = {
  background: "none",
  border: "none",
  padding: "0 6px",
  color: "#111111",
  textDecoration: "underline",
  fontSize: "12px",
  cursor: "pointer",
};

const botonCrear = {
  ...ui.secondaryButton,
  padding: "8px 12px",
  fontSize: "13px",
};

const formCrear = {
  display: "flex",
  flexWrap: "wrap" as const,
  alignItems: "center",
  gap: "8px",
  marginBottom: "16px",
  background: "#fafafa",
  borderRadius: "10px",
  padding: "10px",
};

const campoChico = {
  ...ui.input,
  padding: "8px 10px",
  fontSize: "13px",
};

const botonAgregar = {
  ...ui.button,
  padding: "8px 14px",
  fontSize: "13px",
};

const textoError = {
  color: ui.ROJO,
  fontSize: "12px",
  margin: 0,
};
