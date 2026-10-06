"use client";

import { useState } from "react";
import * as ui from "@/components/ui";

export type TareaOpcion = {
  id: string;
  subrubro: string | null;
  nombre: string;
  unidad: string;
};

export type RubroConTareas = {
  nombre: string;
  tareas: TareaOpcion[];
  /** Las tareas propias de la obra en este rubro: el id es el del item. */
  propias: { id: string; nombre: string; unidad: string }[];
};

/**
 * Las tareas del catálogo, rubro por rubro, con una casilla cada una.
 *
 * Acá sólo se arma **qué** lleva la obra: tarea y unidad. Los números salen
 * del desglose de cada tarea —materiales, mano de obra o integrado—, que
 * llega armado desde el modelo del catálogo y se ajusta en la planilla.
 */
export default function SelectorTareas({
  slug,
  obraId,
  rubros,
  elegidasIniciales,
  guardar,
}: {
  slug: string;
  obraId: string;
  rubros: RubroConTareas[];
  elegidasIniciales: string[];
  guardar: (formData: FormData) => void;
}) {
  const [elegidas, setElegidas] = useState(() => new Set(elegidasIniciales));
  const [propias, setPropias] = useState(
    () => new Set(rubros.flatMap((r) => r.propias.map((p) => p.id)))
  );
  const [buscar, setBuscar] = useState("");

  const termino = buscar.trim().toLowerCase();
  const coincide = (texto: string) => !termino || texto.toLowerCase().includes(termino);

  const alternarEn = (setter: typeof setElegidas, id: string) =>
    setter((antes) => {
      const nuevo = new Set(antes);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  const marcarRubro = (tareas: TareaOpcion[], valor: boolean) =>
    setElegidas((antes) => {
      const nuevo = new Set(antes);
      for (const t of tareas) {
        if (valor) nuevo.add(t.id);
        else nuevo.delete(t.id);
      }
      return nuevo;
    });

  const total = elegidas.size + propias.size;

  return (
    <form action={guardar}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="obra_id" value={obraId} />
      {[...elegidas].map((id) => (
        <input key={id} type="hidden" name="tarea" value={id} />
      ))}
      {[...propias].map((id) => (
        <input key={id} type="hidden" name="propia" value={id} />
      ))}

      <div style={barra}>
        <input
          type="search"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar tarea (ej: porcelanato, revoque, losa)"
          style={{ ...ui.input, maxWidth: "420px" }}
        />
        <span style={cuenta}>
          {total === 1 ? "1 tarea elegida" : `${total} tareas elegidas`}
        </span>
        <button type="submit" style={ui.button}>
          Guardar selección
        </button>
      </div>

      <div style={lista}>
        {rubros.map((rubro) => {
          const visibles = rubro.tareas.filter(
            (t) => coincide(t.nombre) || coincide(rubro.nombre)
          );
          const propiasVisibles = rubro.propias.filter(
            (p) => coincide(p.nombre) || coincide(rubro.nombre)
          );
          if (visibles.length === 0 && propiasVisibles.length === 0) return null;

          const tildadas =
            rubro.tareas.filter((t) => elegidas.has(t.id)).length +
            rubro.propias.filter((p) => propias.has(p.id)).length;
          const todas = visibles.length > 0 && visibles.every((t) => elegidas.has(t.id));

          // Con una búsqueda escrita, los rubros con resultados se abren solos:
          // buscar y tener que abrir cada acordeón para ver qué encontró no sirve.
          return (
            <details
              key={rubro.nombre}
              style={{ ...ui.panel, minWidth: 0 }}
              open={termino ? true : undefined}
            >
              <summary style={resumen}>
                <span style={tituloRubro}>{rubro.nombre}</span>
                <span style={tildadas > 0 ? cuentaActiva : cuenta}>
                  {tildadas} de {rubro.tareas.length + rubro.propias.length}
                </span>
              </summary>

              <div style={contenido}>
                {visibles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => marcarRubro(visibles, !todas)}
                    style={enlace}
                  >
                    {todas ? "Destildar todas" : "Tildar todas"}
                  </button>
                )}

                <div style={encabezado}>
                  <span />
                  <span>Tarea</span>
                  <span>Unidad</span>
                </div>

                {visibles.map((tarea, i) => {
                  const nuevoSub =
                    tarea.subrubro && tarea.subrubro !== visibles[i - 1]?.subrubro;
                  const elegida = elegidas.has(tarea.id);

                  return (
                    <div key={tarea.id}>
                      {nuevoSub && <p style={subrubro}>{tarea.subrubro}</p>}
                      <div style={elegida ? filaElegida : fila}>
                        <input
                          type="checkbox"
                          checked={elegida}
                          onChange={() => alternarEn(setElegidas, tarea.id)}
                          aria-label={`Incluir ${tarea.nombre}`}
                        />
                        <span
                          style={{ cursor: "pointer" }}
                          onClick={() => alternarEn(setElegidas, tarea.id)}
                        >
                          {tarea.nombre}
                        </span>
                        <span style={gris}>{tarea.unidad}</span>
                      </div>
                    </div>
                  );
                })}

                {propiasVisibles.length > 0 && (
                  <p style={subrubro}>Propias de esta obra</p>
                )}
                {propiasVisibles.map((p) => {
                  const elegida = propias.has(p.id);
                  return (
                    <div key={p.id} style={elegida ? filaElegida : fila}>
                      <input
                        type="checkbox"
                        checked={elegida}
                        onChange={() => alternarEn(setPropias, p.id)}
                        aria-label={`Incluir ${p.nombre}`}
                      />
                      <span>{p.nombre}</span>
                      <span style={gris}>{p.unidad}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      <div style={{ ...barra, justifyContent: "flex-end", marginTop: "24px" }}>
        <button type="submit" style={ui.button}>
          Guardar selección
        </button>
      </div>
    </form>
  );
}

const barra = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap" as const,
  marginBottom: "20px",
};

const lista = {
  display: "grid",
  gap: "14px",
};

const resumen = {
  cursor: "pointer",
};

const tituloRubro = {
  fontSize: "18px",
  fontWeight: 400,
  marginRight: "12px",
};

const cuenta = {
  fontSize: "13px",
  color: "#999999",
};

const cuentaActiva = {
  ...cuenta,
  color: "#111111",
  fontWeight: 600,
};

const contenido = {
  marginTop: "16px",
};

const columnas = "24px minmax(0, 1fr) 80px";

const encabezado = {
  display: "grid",
  gridTemplateColumns: columnas,
  gap: "12px",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#111111",
  borderBottom: "1px solid #eeeeee",
  padding: "10px 0",
};

const fila = {
  display: "grid",
  gridTemplateColumns: columnas,
  gap: "12px",
  alignItems: "center",
  padding: "9px 0",
  borderBottom: "1px solid #f2f2f2",
  fontSize: "14px",
  color: "#333333",
};

const filaElegida = {
  ...fila,
  background: "#f7f7f7",
};

const subrubro = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#777777",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  margin: "16px 0 4px",
};

const gris = {
  color: "#888888",
};

const enlace = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#111111",
  textDecoration: "underline",
  fontSize: "13px",
  cursor: "pointer",
  marginBottom: "8px",
};

