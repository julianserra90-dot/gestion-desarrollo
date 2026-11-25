"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import ElegirFechas from "@/components/ElegirFechas";
import * as ui from "@/components/ui";
import { hechoDeTarea } from "@/lib/avance-del-plano";
import type { PisoDeTarea, TareaConAvance } from "@/lib/avance-del-rubro";

/**
 * La carga a mano del avance de un rubro, **tarea por tarea y piso por piso**,
 * con la misma lógica que marcar en el 3D. Cada tarea que el cómputo reparte
 * por piso se despliega como un acordeón con sus pisos, cada uno con lo que
 * tiene, lo hecho y un campo para el porcentaje que avanzó; en el 3D, lo de
 * ese piso que todavía no se marcó cosa por cosa se pinta en verde claro. Una
 * tarea sin pisos lleva un solo campo, en su unidad.
 *
 * En cada piso, lo hecho es lo marcado en el 3D más lo cargado a mano, con
 * tope en lo que tiene el piso (`hechoDeTarea`).
 */
export default function CargarAvancePorTarea({
  action,
  obraId,
  slug,
  rubroId,
  tareas,
  hoy,
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  rubroId: string;
  tareas: TareaConAvance[];
  hoy: string;
}) {
  /** Lo escrito: "tarea" (sin pisos, en su unidad) o "tarea|piso" (en %). */
  const [escrito, setEscrito] = useState<Record<string, string>>({});
  const [abiertas, setAbiertas] = useState<string[]>([]);
  const [fechas, setFechas] = useState<{ desde: string | null; hasta: string }>({ desde: null, hasta: hoy });

  const valor = (clave: string) => {
    const n = Number((escrito[clave] ?? "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  /** Lo nuevo de un piso, en la unidad de la tarea. */
  const nuevoEnPiso = (t: TareaConAvance, p: PisoDeTarea) =>
    (Math.min(valor(`${t.tareaId}|${p.piso}`), 100) / 100) * p.cantidad;
  /** Lo hecho de la tarea con lo que se está escribiendo. */
  const hechoCon = (t: TareaConAvance) => {
    if (t.pisos.length > 0) {
      return t.pisos.reduce(
        (s, p) =>
          s +
          hechoDeTarea(p.enEl3d, p.aMano + nuevoEnPiso(t, p), p.cantidad) -
          hechoDeTarea(p.enEl3d, p.aMano, p.cantidad),
        t.hecho
      );
    }
    return t.hecho - hechoDeTarea(t.enEl3d, t.aMano) + hechoDeTarea(t.enEl3d, t.aMano + valor(t.tareaId));
  };
  const parte = (hecho: number, cantidad: number) => (cantidad > 0 ? Math.min(1, hecho / cantidad) : 0);
  const suma = tareas.reduce(
    (s, t) => s + t.peso * (parte(hechoCon(t), t.cantidad) - parte(t.hecho, t.cantidad)),
    0
  );
  const algoEscrito = Object.keys(escrito).some((k) => valor(k) > 0);

  return (
    <form action={action}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rubro_id" value={rubroId} />

      <div style={ui.panel}>
        <table style={tabla}>
          <colgroup>
            <col style={{ width: "52px" }} />
            <col />
            <col style={{ width: "120px" }} />
            <col style={{ width: "170px" }} />
            <col style={{ width: "150px" }} />
            <col style={{ width: "90px" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={ui.th}>3D</th>
              <th style={ui.th}>Tarea</th>
              <th style={ui.thRight}>Cómputo</th>
              <th style={ui.thRight}>Hecho</th>
              <th style={ui.thRight}>Hoy</th>
              <th style={ui.thRight}>Queda en</th>
            </tr>
          </thead>
          <tbody>
            {tareas.map((t) => {
              const abierta = abiertas.includes(t.tareaId);
              const conPisos = t.pisos.length > 0;
              const nuevoHecho = hechoCon(t);
              return (
                <Fragment key={t.tareaId}>
                  <tr>
                    {/* A marcarla en el edificio, cosa por cosa. */}
                    <td style={ui.td}>
                      {t.enElPlano && (
                        <Link
                          href={`/obras/${slug}/plantas/3d?desde=avance:${rubroId}&tarea=${t.tareaId}`}
                          title="Marcar en el 3D"
                          style={boton3d}
                        >
                          3D
                        </Link>
                      )}
                    </td>
                    <td style={ui.td}>
                      {conPisos ? (
                        <button
                          type="button"
                          aria-expanded={abierta}
                          onClick={() =>
                            setAbiertas(abierta ? abiertas.filter((x) => x !== t.tareaId) : [...abiertas, t.tareaId])
                          }
                          style={botonTarea}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            aria-hidden="true"
                            style={{ flex: "0 0 auto", transform: abierta ? "rotate(90deg)" : undefined }}
                          >
                            <path d="M3.5 2 7 5 3.5 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span style={nombre}>{t.nombre}</span>
                        </button>
                      ) : (
                        <span style={nombre}>{t.nombre}</span>
                      )}
                    </td>
                    <td style={ui.tdRight}>
                      {numero(t.cantidad)} {t.unidad}
                    </td>
                    <td style={ui.tdRight}>
                      {t.hecho > 0 ? porciento(parte(t.hecho, t.cantidad)) : "—"}
                    </td>
                    <td style={ui.tdRight}>
                      {conPisos ? null : (
                        <div style={conUnidad}>
                          <input
                            type="text"
                            inputMode="decimal"
                            name={`cantidad_${t.tareaId}`}
                            value={escrito[t.tareaId] ?? ""}
                            onChange={(e) => setEscrito({ ...escrito, [t.tareaId]: e.target.value })}
                            aria-label={`Cuánto se hizo de ${t.nombre}`}
                            style={campoCantidad}
                          />
                          <span style={unidad}>{t.unidad}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ ...ui.tdRight, color: nuevoHecho > t.hecho ? "#111111" : "#9a9a9a" }}>
                      {porciento(parte(nuevoHecho, t.cantidad))}
                    </td>
                  </tr>

                  {/* Sus pisos: lo de cada uno y el porcentaje que avanzó. */}
                  {conPisos &&
                    t.pisos.map((p) => {
                      const hechoPiso = hechoDeTarea(p.enEl3d, p.aMano, p.cantidad);
                      const nuevoPiso = hechoDeTarea(p.enEl3d, p.aMano + nuevoEnPiso(t, p), p.cantidad);
                      const clave = `${t.tareaId}|${p.piso}`;
                      return (
                        <tr key={p.piso} style={abierta ? undefined : { display: "none" }}>
                          <td style={celdaDePiso} />
                          <td style={{ ...celdaDePiso, paddingLeft: "30px" }}>{p.nivel}</td>
                          <td style={{ ...celdaDePiso, textAlign: "right" }}>
                            {numero(p.cantidad)} {t.unidad}
                          </td>
                          <td style={{ ...celdaDePiso, textAlign: "right" }}>
                            {hechoPiso > 0 ? porciento(parte(hechoPiso, p.cantidad)) : "—"}
                          </td>
                          <td style={{ ...celdaDePiso, textAlign: "right" }}>
                            <div style={conUnidad}>
                              <input
                                type="text"
                                inputMode="decimal"
                                name={`pct_${t.tareaId}_${p.piso}`}
                                value={escrito[clave] ?? ""}
                                onChange={(e) => setEscrito({ ...escrito, [clave]: e.target.value })}
                                aria-label={`Cuánto avanzó ${t.nombre} en ${p.nivel}`}
                                style={campoCantidad}
                              />
                              <span style={unidad}>%</span>
                            </div>
                          </td>
                          <td
                            style={{
                              ...celdaDePiso,
                              textAlign: "right",
                              color: nuevoPiso > hechoPiso ? "#111111" : "#9a9a9a",
                            }}
                          >
                            {porciento(parte(nuevoPiso, p.cantidad))}
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        <div style={pie}>
          <ElegirFechas
            desde={fechas.desde}
            hasta={fechas.hasta}
            alCambiar={setFechas}
            nombres={{ desde: "fecha_inicio", hasta: "fecha" }}
          />
          <label style={{ ...campo, flex: "1 1 auto" }}>
            <span style={rotulo}>Qué se hizo</span>
            <input type="text" name="comentario" style={ui.input} />
          </label>
          <div style={total}>
            <span style={{ ...rotulo, justifyContent: "flex-end" }}>Suma al rubro</span>
            <strong style={totalNumero}>+{porciento(suma)}</strong>
          </div>
          <button type="submit" style={ui.button} disabled={!algoEscrito}>
            Cargar avance
          </button>
        </div>
      </div>
    </form>
  );
}

function numero(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

function porciento(fraccion: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(fraccion * 100)} %`;
}

const tabla = { ...ui.table, tableLayout: "fixed" as const };

const nombre = {
  display: "block",
  minWidth: 0,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
  whiteSpace: "nowrap" as const,
};

/** El nombre de una tarea con pisos: despliega el acordeón. */
const botonTarea = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  width: "100%",
  minWidth: 0,
  padding: 0,
  background: "none",
  border: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "left" as const,
  cursor: "pointer",
};

/** Una fila de piso: más chica y sobre un fondo apenas gris. */
const celdaDePiso = {
  ...ui.td,
  padding: "8px 12px",
  fontSize: "13px",
  background: "#fafafa",
};

/** El botón al 3D: negro con letra blanca, como el de la planta. */
const boton3d = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "34px",
  height: "26px",
  background: "#111111",
  color: "#ffffff",
  borderRadius: "7px",
  fontSize: "11px",
  fontWeight: 700,
  textDecoration: "none",
};


const conUnidad = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "6px",
};

const campoCantidad = {
  ...ui.input,
  width: "90px",
  padding: "7px 10px",
  textAlign: "right" as const,
};

const unidad = { width: "24px", fontSize: "12px", color: "#777777", textAlign: "left" as const };

const pie = {
  display: "flex",
  alignItems: "flex-end",
  gap: "16px",
  marginTop: "20px",
  flexWrap: "wrap" as const,
};

const campo = { display: "grid", gap: "6px" };

// La fila de los rótulos: del alto del selector de fechas, con el texto al
// medio, así los campos de abajo quedan alineados.
const rotulo = { fontSize: "12px", color: "#777777", height: "26px", display: "flex", alignItems: "center" };

const total = { display: "grid", gap: "6px", textAlign: "right" as const, minWidth: "110px" };

// Del alto de los campos y del botón: la fila de los campos, con el número al medio.
const totalNumero = {
  height: "47px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  fontSize: "20px",
  fontWeight: 600,
};
