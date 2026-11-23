"use client";

import { useState } from "react";
import * as ui from "@/components/ui";
import {
  CAPA_NUEVA,
  espesorTotal,
  type CapaDeMuro,
  type Composicion,
  type Lado,
} from "@/lib/tipos-de-muro";

export type TareaOpcion = { id: string; nombre: string; rubro: string; unidad: string };

/** Los rubros que van arriba en el desplegable de una capa. */
const PRIMERO = ["Mamposterías y Tabiquerías", "Revoques", "Aislaciones", "Revestimientos", "Pintura"];

/**
 * La pila de capas de un tipo de muro, de afuera hacia adentro: lo de la cara
 * exterior arriba, el núcleo al medio y lo de la cara interior abajo, como se
 * lee un corte. Cada fila: la tarea, el espesor y entre qué alturas va.
 *
 * Las capas se guardan del núcleo hacia afuera (\`lib/tipos-de-muro.ts\`); las
 * del exterior se muestran al revés para que arriba quede la más de afuera.
 */
export default function TipoDeMuroEditor({
  composicion,
  tareas,
  alCambiar,
}: {
  composicion: Composicion;
  tareas: TareaOpcion[];
  alCambiar: (nueva: Composicion) => void;
}) {
  const cambiarCapa = (lado: Lado, i: number, cambios: Partial<CapaDeMuro>) =>
    alCambiar({
      ...composicion,
      [lado]: composicion[lado].map((c, k) => (k === i ? { ...c, ...cambios } : c)),
    });
  const quitar = (lado: Lado, i: number) =>
    alCambiar({ ...composicion, [lado]: composicion[lado].filter((_, k) => k !== i) });
  const agregar = (lado: Lado) =>
    alCambiar({ ...composicion, [lado]: [...composicion[lado], { ...CAPA_NUEVA }] });

  const fila = (lado: Lado, i: number) => (
    <FilaDeCapa
      key={`${lado}:${i}`}
      capa={composicion[lado][i]}
      tareas={tareas}
      alCambiar={(cambios) => cambiarCapa(lado, i, cambios)}
      alQuitar={() => quitar(lado, i)}
    />
  );

  return (
    <div style={caja}>
      <div style={encabezado}>
        <span>Exterior</span>
        <button type="button" onClick={() => agregar("exterior")} style={botonAgregar}>
          + capa
        </button>
      </div>
      {composicion.exterior.map((_, i) => composicion.exterior.length - 1 - i).map((i) => fila("exterior", i))}

      <div style={nucleo}>
        <div style={grilla}>
          <SelectorTarea
            valor={composicion.nucleo.tarea}
            tareas={tareas}
            alCambiar={(tarea) => alCambiar({ ...composicion, nucleo: { ...composicion.nucleo, tarea } })}
          />
          <CampoCm
            valor={composicion.nucleo.espesor}
            alCambiar={(espesor) => {
              if (espesor > 0) alCambiar({ ...composicion, nucleo: { ...composicion.nucleo, espesor } });
            }}
          />
          <span style={etiquetaNucleo}>núcleo</span>
          <span />
        </div>
      </div>

      <div style={encabezado}>
        <span>Interior</span>
        <button type="button" onClick={() => agregar("interior")} style={botonAgregar}>
          + capa
        </button>
      </div>
      {composicion.interior.map((_, i) => fila("interior", i))}

      <div style={total}>
        <span>Espesor total</span>
        <span>{formatoCm(espesorTotal(composicion))} cm</span>
      </div>
    </div>
  );
}

/**
 * Una lista de capas suelta, de la primera a la última, con "+ capa": las
 * paredes de un ambiente que tiene terminación propia.
 */
export function ListaDeCapas({
  capas,
  tareas,
  alCambiar,
}: {
  capas: CapaDeMuro[];
  tareas: TareaOpcion[];
  alCambiar: (nuevas: CapaDeMuro[]) => void;
}) {
  return (
    <div style={caja}>
      {capas.map((capa, i) => (
        <FilaDeCapa
          key={i}
          capa={capa}
          tareas={tareas}
          alCambiar={(cambios) =>
            alCambiar(capas.map((c, k) => (k === i ? { ...c, ...cambios } : c)))
          }
          alQuitar={() => alCambiar(capas.filter((_, k) => k !== i))}
        />
      ))}
      <div style={{ ...encabezado, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => alCambiar([...capas, { ...CAPA_NUEVA }])}
          style={botonAgregar}
        >
          + capa
        </button>
      </div>
    </div>
  );
}

/** Una capa: tarea, espesor, altura —que se despliega abajo— y quitar. */
function FilaDeCapa({
  capa,
  tareas,
  alCambiar,
  alQuitar,
}: {
  capa: CapaDeMuro;
  tareas: TareaOpcion[];
  alCambiar: (cambios: Partial<CapaDeMuro>) => void;
  alQuitar: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div>
      <div style={grilla}>
        <SelectorTarea valor={capa.tarea} tareas={tareas} alCambiar={(tarea) => alCambiar({ tarea })} />
        <CampoCm valor={capa.espesor} alCambiar={(espesor) => alCambiar({ espesor })} />
        <button
          type="button"
          onClick={() => setAbierta(!abierta)}
          style={abierta ? botonAlturaAbierto : botonAltura}
          title="Altura"
        >
          {textoDeAltura(capa)}
        </button>
        <button type="button" onClick={alQuitar} style={botonQuitar} aria-label="Quitar capa">
          ×
        </button>
      </div>
      {abierta && (
        <div style={grillaAltura}>
          <span style={rotuloChico}>desde</span>
          <CampoMetros valor={capa.desde} alCambiar={(desde) => alCambiar({ desde })} />
          <span style={rotuloChico}>hasta</span>
          <select
            value={typeof capa.hasta === "number" ? "altura" : capa.hasta}
            onChange={(e) =>
              alCambiar({
                hasta: e.target.value === "altura" ? 2.1 : (e.target.value as "techo" | "cielorraso"),
              })
            }
            style={campoChico}
          >
            <option value="techo">techo</option>
            <option value="cielorraso">cielorraso</option>
            <option value="altura">altura</option>
          </select>
          {typeof capa.hasta === "number" ? (
            <CampoMetros
              valor={capa.hasta}
              alCambiar={(hasta) => alCambiar({ hasta: hasta > 0 ? hasta : "techo" })}
            />
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

const formatoCm = (metros: number) =>
  (Math.round(metros * 1000) / 10).toLocaleString("es-AR", { maximumFractionDigits: 1 });

const formatoM = (metros: number) =>
  metros.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "toda", "0–2,10", "2,10–techo". */
function textoDeAltura(c: CapaDeMuro): string {
  const hasta = typeof c.hasta === "number" ? formatoM(c.hasta) : c.hasta === "techo" ? "techo" : "cielorr.";
  if (c.desde === 0 && c.hasta === "techo") return "toda";
  return `${formatoM(c.desde)}–${hasta}`;
}

function SelectorTarea({
  valor,
  tareas,
  alCambiar,
}: {
  valor: string | null;
  tareas: TareaOpcion[];
  alCambiar: (tarea: string | null) => void;
}) {
  const orden = (rubro: string) => {
    const i = PRIMERO.findIndex((r) => r.toLowerCase() === rubro.toLowerCase());
    return i === -1 ? PRIMERO.length : i;
  };
  const nombre = tareas.find((t) => t.id === valor)?.nombre;
  const rubros = [...new Set(tareas.map((t) => t.rubro))].sort(
    (a, b) => orden(a) - orden(b) || a.localeCompare(b, "es")
  );
  return (
    <select
      value={valor ?? ""}
      onChange={(e) => alCambiar(e.target.value || null)}
      title={nombre}
      style={{ ...campoChico, minWidth: 0, textOverflow: "ellipsis" }}
    >
      <option value="">—</option>
      {valor !== null && !tareas.some((t) => t.id === valor) && (
        <option value={valor}>Tarea que ya no está</option>
      )}
      {rubros.map((rubro) => (
        <optgroup key={rubro} label={rubro}>
          {tareas
            .filter((t) => t.rubro === rubro)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Un espesor, escrito en centímetros y guardado en metros. */
function CampoCm({ valor, alCambiar }: { valor: number; alCambiar: (metros: number) => void }) {
  const enCm = (m: number) => String(Math.round(m * 100000) / 1000);
  const [texto, setTexto] = useState(enCm(valor));
  const [visto, setVisto] = useState(valor);
  if (visto !== valor) {
    setVisto(valor);
    if (Math.abs(Number(texto) / 100 - valor) > 1e-9) setTexto(enCm(valor));
  }
  return (
    <input
      type="number"
      min="0"
      step="0.5"
      value={texto}
      aria-label="Espesor en cm"
      onChange={(e) => {
        setTexto(e.target.value);
        const cm = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(cm) && cm >= 0) {
          alCambiar(Math.round(cm * 1000) / 100000);
        }
      }}
      style={{ ...campoChico, textAlign: "right" }}
    />
  );
}

/** Una altura en metros. */
function CampoMetros({ valor, alCambiar }: { valor: number; alCambiar: (metros: number) => void }) {
  const [texto, setTexto] = useState(String(valor));
  const [visto, setVisto] = useState(valor);
  if (visto !== valor) {
    setVisto(valor);
    if (Math.abs(Number(texto) - valor) > 1e-9) setTexto(String(valor));
  }
  return (
    <input
      type="number"
      min="0"
      step="0.05"
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(n) && n >= 0) alCambiar(n);
      }}
      style={{ ...campoChico, textAlign: "right" }}
    />
  );
}

// Una grilla para todas las filas: tarea, espesor, altura, quitar. Así las
// columnas quedan una abajo de la otra en toda la pila.
const COLUMNAS = "minmax(0, 1fr) 44px 66px 14px";

const caja = {
  display: "grid",
  gap: "4px",
};

const grilla = {
  display: "grid",
  gridTemplateColumns: COLUMNAS,
  gap: "4px",
  alignItems: "center",
};

const grillaAltura = {
  display: "grid",
  gridTemplateColumns: "auto 64px auto 92px 64px",
  gap: "6px",
  alignItems: "center",
  justifyContent: "end",
  padding: "4px 0 6px",
};

const campoChico = {
  ...ui.input,
  padding: "5px 6px",
  fontSize: "12px",
  width: "100%",
  boxSizing: "border-box" as const,
};

const encabezado = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#888888",
  padding: "4px 0",
};

const nucleo = {
  background: "#f4f1ec",
  borderRadius: "8px",
  padding: "4px",
  margin: "0 -4px",
};

const etiquetaNucleo = {
  fontSize: "11px",
  color: "#8a6d4a",
  textAlign: "center" as const,
};

const botonAltura = {
  ...campoChico,
  cursor: "pointer",
  background: "#ffffff",
  color: "#555555",
  textAlign: "center" as const,
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
};

const botonAlturaAbierto = {
  ...botonAltura,
  borderColor: "#111111",
};

const botonQuitar = {
  background: "none",
  border: "none",
  color: "#999999",
  fontSize: "15px",
  cursor: "pointer",
  padding: 0,
};

const botonAgregar = {
  background: "none",
  border: "none",
  color: "#555555",
  fontSize: "12px",
  cursor: "pointer",
  padding: "0 2px",
  textTransform: "none" as const,
  letterSpacing: 0,
  fontWeight: 400,
};

const rotuloChico = {
  fontSize: "11px",
  color: "#888888",
};

const total = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "6px",
  marginTop: "4px",
  fontSize: "13px",
  fontWeight: 600,
};
