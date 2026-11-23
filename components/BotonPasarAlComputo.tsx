"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import SignoDelPlano, { AMBAR } from "@/components/SignoDelPlano";
import * as ui from "@/components/ui";
import type { Pase } from "@/lib/pase-al-computo";

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const cantidad = (n: number, unidad: string) => `${numero.format(n)} ${unidad}`.trim();

/**
 * Pasa al cómputo lo que miden las plantas, mostrando antes qué cambia.
 *
 * Con un botón y no solo al guardar cada planta: la cantidad de una tarea
 * multiplica todos los precios del cómputo, y un dibujo a medio hacer no tiene
 * por qué moverlos. Se pasa cuando el dibujo está para pasar, y se ve tarea
 * por tarea lo que tenía y con lo que queda antes de escribir nada.
 *
 * La vista previa se pide al abrir: sale de lo guardado, no de lo que haya en
 * un editor abierto con cambios sin guardar.
 */
export default function BotonPasarAlComputo({
  ver,
  pasar,
  rutaDelComputo,
}: {
  ver: () => Promise<{ pase?: Pase; error?: string }>;
  pasar: () => Promise<{ error?: string; tareas?: number; agregadas?: number }>;
  rutaDelComputo: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pase, setPase] = useState<Pase | null>(null);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const abrir = () => {
    setAbierto(true);
    setPase(null);
    setError("");
    setHecho(null);
    iniciar(async () => {
      const r = await ver();
      if (r.error || !r.pase) setError(r.error ?? "No se pudo leer el cómputo.");
      else setPase(r.pase);
    });
  };

  const confirmar = () =>
    iniciar(async () => {
      const r = await pasar();
      if (r.error) {
        setError(r.error);
        return;
      }
      setError("");
      const tareas = r.tareas ?? 0;
      const agregadas = r.agregadas ?? 0;
      setHecho(
        (tareas === 1 ? "Se actualizó 1 tarea" : `Se actualizaron ${tareas} tareas`) +
          (agregadas > 0
            ? agregadas === 1
              ? ", una de ellas nueva en el cómputo."
              : `, ${agregadas} de ellas nuevas en el cómputo.`
            : ".")
      );
      router.refresh();
    });

  const cerrar = () => setAbierto(false);

  const cambian = pase?.lineas.filter((l) => l.cambia) ?? [];
  const iguales = (pase?.lineas.length ?? 0) - cambian.length;
  const conviven = cambian.filter((l) => l.aMano > 0 && l.delPlano > 0).length;
  const p = pase?.pendientes;
  const pendientes = p
    ? [
        p.murosSinTipo > 0.005 && `${numero.format(p.murosSinTipo)} m² de muro sin tipo`,
        p.sinTerminacion > 0.005 && `${numero.format(p.sinTerminacion)} m² de pared sin terminación`,
        p.sinPiso > 0.005 && `${numero.format(p.sinPiso)} m² de ambiente sin piso`,
        p.sinCielorraso > 0.005 && `${numero.format(p.sinCielorraso)} m² sin cielorraso`,
      ].filter(Boolean)
    : [];

  return (
    <>
      <button type="button" onClick={abrir} style={ui.secondaryButton}>
        Pasar al cómputo
      </button>

      {abierto && (
        <div
          style={fondo}
          onKeyDown={(e) => {
            if (e.key === "Escape") cerrar();
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) cerrar();
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="Pasar el plano al cómputo" style={caja}>
            <header style={cabecera}>
              <h2 style={titulo}>Pasar el plano al cómputo</h2>
              <p style={bajada}>
                Lo que miden las plantas guardadas, por tarea y por piso. Se reemplaza sólo lo que
                había venido del plano: lo medido a mano queda como está. En el cómputo, esas
                cantidades llevan la marca <SignoDelPlano />.
              </p>
            </header>

            {error && <p style={errorBox}>{error}</p>}

            {hecho ? (
              <p style={listo}>{hecho}</p>
            ) : !pase ? (
              !error && <p style={ui.note}>Midiendo las plantas…</p>
            ) : pase.lineas.length === 0 ? (
              <p style={ui.note}>
                Las plantas todavía no miden nada que vaya al cómputo: falta darles tipo a los
                muros o capas a los ambientes.
              </p>
            ) : cambian.length === 0 ? (
              <p style={ui.note}>
                El cómputo ya tiene lo que miden las plantas: no hay nada que pasar.
              </p>
            ) : (
              <div style={tablaConBarra}>
                <table style={tabla}>
                  <thead>
                    <tr>
                      <th style={th}>Tarea</th>
                      <th style={thDer}>Hoy</th>
                      <th style={thDer}>Del plano</th>
                      <th style={thDer}>Queda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cambian.map((l) => (
                      <tr key={l.tareaId}>
                        <td style={td}>
                          <span style={nombreDeTarea}>{l.nombre}</span>
                          <span style={detalle}>
                            {l.rubro}
                            {l.itemId === null && " · se agrega al cómputo"}
                            {l.pisaLaEscrita && " · reemplaza la cantidad escrita a mano"}
                            {l.renglones.length === 0 && " · el plano ya no la mide"}
                          </span>
                          {l.aMano > 0 && l.delPlano > 0 && (
                            <span style={convive}>
                              Tiene {cantidad(l.aMano, l.unidad)} medidos a mano, que se suman. Si
                              son lo mismo, borrá los que sobran en su medición.
                            </span>
                          )}
                        </td>
                        <td style={tdDer}>{l.itemId === null ? "—" : cantidad(l.hoy, l.unidad)}</td>
                        <td style={tdDer}>{cantidad(l.delPlano, l.unidad)}</td>
                        <td style={tdFuerte}>{cantidad(l.queda, l.unidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pase && !hecho && (
              <div style={notas}>
                {iguales > 0 && cambian.length > 0 && (
                  <p style={nota}>
                    {iguales === 1
                      ? "Otra tarea ya está al día y no se toca."
                      : `Otras ${iguales} tareas ya están al día y no se tocan.`}
                  </p>
                )}
                {conviven > 0 && (
                  <p style={{ ...nota, color: AMBAR }}>
                    {conviven === 1
                      ? "Una tarea queda con medición a mano y del plano a la vez."
                      : `${conviven} tareas quedan con medición a mano y del plano a la vez.`}
                  </p>
                )}
                {!pase.hayComputo && cambian.length > 0 && (
                  <p style={nota}>Esta obra todavía no tiene cómputo: se crea al pasar.</p>
                )}
                {pase.noSeMiden.length > 0 && (
                  <p style={nota}>
                    No se pasan, porque el plano da m² y m³:{" "}
                    {pase.noSeMiden
                      .map((n) => (n.unidad ? `${n.nombre} (${n.unidad})` : n.nombre))
                      .join(", ")}
                    .
                  </p>
                )}
                {pase.sinEscala.length > 0 && (
                  <p style={nota}>Sin escala, no miden: {pase.sinEscala.join(", ")}.</p>
                )}
                {pendientes.length > 0 && (
                  <p style={nota}>Todavía sin definir en el dibujo: {pendientes.join(", ")}.</p>
                )}
              </div>
            )}

            <footer style={pie}>
              {hecho ? (
                <>
                  <button type="button" onClick={cerrar} style={boton}>
                    Cerrar
                  </button>
                  <Link href={rutaDelComputo} style={botonFuerte}>
                    Ver el cómputo
                  </Link>
                </>
              ) : (
                <>
                  <button type="button" onClick={cerrar} style={boton}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={ocupado || cambian.length === 0}
                    style={ocupado || cambian.length === 0 ? botonFuerteQuieto : botonFuerte}
                  >
                    {ocupado && pase ? "Pasando…" : "Pasar al cómputo"}
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
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
  width: "min(760px, 100%)",
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

/** La tabla es lo único que se corre si son muchas tareas. */
const tablaConBarra = {
  minHeight: 0,
  overflowY: "auto" as const,
  border: "1px solid #eeeeee",
  borderRadius: "12px",
};

const tabla = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: "13px",
};

const th = {
  position: "sticky" as const,
  top: 0,
  background: "#fafafa",
  textAlign: "left" as const,
  fontWeight: 600,
  fontSize: "12px",
  color: "#777777",
  padding: "9px 12px",
  borderBottom: "1px solid #eeeeee",
  whiteSpace: "nowrap" as const,
};

const thDer = {
  ...th,
  textAlign: "right" as const,
};

const td = {
  padding: "9px 12px",
  borderBottom: "1px solid #f2f2f2",
  verticalAlign: "top" as const,
};

const tdDer = {
  ...td,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
  color: "#555555",
};

const tdFuerte = {
  ...tdDer,
  color: "#111111",
  fontWeight: 600,
};

const nombreDeTarea = {
  display: "block",
};

const detalle = {
  display: "block",
  fontSize: "12px",
  color: "#999999",
};

const convive = {
  display: "block",
  fontSize: "12px",
  color: AMBAR,
  marginTop: "2px",
};

const notas = {
  display: "grid",
  gap: "4px",
};

const nota = {
  fontSize: "12px",
  color: "#777777",
  margin: 0,
};

const listo = {
  fontSize: "14px",
  margin: 0,
};

const pie = {
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap" as const,
  gap: "10px",
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

const botonFuerte = {
  ...boton,
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  fontWeight: 600,
  textDecoration: "none",
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
