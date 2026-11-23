"use client";

/**
 * Las piezas del panel de propiedades del editor de plantas.
 *
 * Un panel es una cabecera —qué es, con su color y su ícono— y secciones que
 * se pliegan. Cada renglón: un ícono, un nombre corto y el valor en una
 * pastilla gris, todos en las mismas tres columnas para que la lectura baje
 * derecha. Donde un número solo no alcanza, un dibujo: la altura de una capa
 * sobre el muro, la pila, los tramos en planta, el corte del muro.
 *
 * Sin estado de la planta: reciben datos y avisan cambios.
 */

import { useRef, useState } from "react";
import type { Punto } from "@/lib/planta-dibujo";

// ---- Íconos ----------------------------------------------------------------

const TRAZOS = {
  muro: "M3 6h18v12H3zM3 12h18M9 6v6M15 6v6M12 12v6",
  capa: "M4 20V4h16M8 20V8h12",
  tarea: "M4 6h16M4 12h10M4 18h7",
  espesor: "M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3M3 5v14M21 5v14",
  altura: "M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3",
  agarre: "M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  tipo: "M4 7h16M4 12h16M4 17h16",
  zocalo: "M4 4v16h16M4 16h16",
  nombre: "M4 7V5h16v2M12 5v14M9 19h6",
  borrar: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  escuadrar: "M5 19V5h14M5 15h4v4",
  unir: "M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1",
  quitar: "M6 6l12 12M18 6L6 18",
  chevron: "M6 9l6 6 6-6",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  mas: "M12 5v14M5 12h14",
  abertura: "M3 20h3M18 20h3M6 20V8M6 8a12 12 0 0 1 12 12",
  ambiente: "M4 4h16v9h-7v7H4z",
  copiar: "M4 3.5h13v6H4zM17 6.5h3v5h-8v3M10.2 14.5h3.6v6h-3.6z",
  piso: "M3 17l9-5 9 5-9 5zM3 12l9-5 9 5",
  cajon: "M3 5h18M3 5v8h11V5",
};

export type NombreDeIcono = keyof typeof TRAZOS;

export function Icono({ nombre, size = 16 }: { nombre: NombreDeIcono; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={nombre === "grip" ? 3 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "0 0 auto" }}
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}

// ---- La cabecera, las secciones y los renglones ----------------------------

export function Encabezado({
  icono,
  color,
  titulo,
  detalle,
  children,
}: {
  icono: NombreDeIcono;
  /** El color de lo que es: el de la tarea de una capa, el del ladrillo. */
  color: string;
  titulo: string;
  detalle?: string;
  /** Las acciones, como botones de ícono (`BotonIcono`). */
  children?: React.ReactNode;
}) {
  return (
    <div style={encabezado}>
      <span style={{ ...tesela, background: color }}>
        <Icono nombre={icono} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={tituloDeEncabezado} title={titulo}>
          {titulo}
        </p>
        {detalle && <p style={detalleDeEncabezado}>{detalle}</p>}
      </div>
      <div style={acciones}>{children}</div>
    </div>
  );
}

export function BotonIcono({
  icono,
  nombre,
  onClick,
  peligro = false,
}: {
  icono: NombreDeIcono;
  nombre: string;
  onClick: () => void;
  peligro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={nombre}
      aria-label={nombre}
      style={{ ...botonIcono, color: peligro ? "#b42318" : "#666666" }}
    >
      <Icono nombre={icono} />
    </button>
  );
}

/** Una sección que se pliega, con cuántas cosas tiene. */
export function Seccion({
  titulo,
  cuenta,
  cerrada = false,
  children,
}: {
  titulo: string;
  cuenta?: number;
  cerrada?: boolean;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(!cerrada);
  return (
    <section style={seccion}>
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        style={cabezaDeSeccion}
      >
        <span style={{ display: "flex", transform: abierta ? "none" : "rotate(-90deg)" }}>
          <Icono nombre="chevron" size={14} />
        </span>
        {titulo}
        {cuenta !== undefined && <span style={cuentaDeSeccion}>{cuenta}</span>}
      </button>
      {abierta && <div style={cuerpoDeSeccion}>{children}</div>}
    </section>
  );
}

/** Un renglón: ícono, nombre corto y el valor. */
export function Fila({
  icono,
  nombre,
  children,
}: {
  icono: NombreDeIcono;
  nombre: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fila}>
      <span style={{ color: "#888888", display: "flex" }}>
        <Icono nombre={icono} />
      </span>
      <span style={nombreDeFila}>{nombre}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Un valor que se lee y no se edita, en su pastilla. */
export function Pastilla({ children, apagada = false }: { children: React.ReactNode; apagada?: boolean }) {
  return <span style={{ ...pastilla, color: apagada ? "#999999" : "#222222" }}>{children}</span>;
}

/** Opciones que se eligen con un ícono o una figura. */
export function Segmentado<T extends string>({
  valor,
  opciones,
  alCambiar,
}: {
  valor: T;
  opciones: { valor: T; nombre: string; figura: React.ReactNode }[];
  alCambiar: (nuevo: T) => void;
}) {
  return (
    <div style={segmentado} role="radiogroup">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          title={o.nombre}
          aria-label={o.nombre}
          onClick={() => alCambiar(o.valor)}
          style={o.valor === valor ? segmentoElegido : segmento}
        >
          {o.figura}
        </button>
      ))}
    </div>
  );
}

/** Las medidas de lo elegido, en tres cajas. */
export function Medidas({ valores }: { valores: { valor: string; nombre: string }[] }) {
  return (
    <div style={medidas}>
      {valores.map((v) => (
        <div key={v.nombre} style={cajaDeMedida}>
          <span style={valorDeMedida}>{v.valor}</span>
          <span style={nombreDeMedida}>{v.nombre}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Campos en pastilla -----------------------------------------------------

/** Un número que se escribe en una unidad y se guarda en otra. */
export function CampoNumero({
  valor,
  unidad,
  factor = 1,
  paso = 0.5,
  alCambiar,
  vacio,
}: {
  /** En la unidad de guardar (metros); null: sin cargar. */
  valor: number | null;
  /** Lo que se lee al lado: "cm", "m". */
  unidad: string;
  /** Cuántas de la unidad de pantalla hay en una de guardar: 100 de m a cm. */
  factor?: number;
  paso?: number;
  alCambiar: (nuevo: number | null) => void;
  /** Lo que se lee sin valor. */
  vacio?: string;
}) {
  const aTexto = (v: number | null) => (v === null ? "" : String(Math.round(v * factor * 1000) / 1000));
  const [texto, setTexto] = useState(aTexto(valor));
  const [visto, setVisto] = useState(valor);
  if (visto !== valor) {
    setVisto(valor);
    if (texto === "" || Math.abs(Number(texto) / factor - (valor ?? NaN)) > 1e-9) setTexto(aTexto(valor));
  }
  return (
    <label style={{ ...pastilla, padding: "0 8px 0 0" }}>
      <input
        type="number"
        step={paso}
        min="0"
        value={texto}
        placeholder={vacio}
        onChange={(e) => {
          setTexto(e.target.value);
          if (e.target.value === "") {
            alCambiar(null);
            return;
          }
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= 0) alCambiar(Math.round((n / factor) * 100000) / 100000);
        }}
        style={entradaEnPastilla}
      />
      <span style={{ color: "#999999" }}>{unidad}</span>
    </label>
  );
}

export type OpcionDeTarea = { id: string; nombre: string; rubro: string };

/** Una tarea del catálogo, agrupada por rubro, con los rubros de `primero` arriba. */
export function SelectorDeTarea({
  valor,
  tareas,
  alCambiar,
  primero = [],
  vacio = "—",
}: {
  valor: string | null;
  tareas: OpcionDeTarea[];
  alCambiar: (tarea: string | null) => void;
  primero?: string[];
  vacio?: string;
}) {
  const orden = (rubro: string) => {
    const i = primero.findIndex((r) => r.toLowerCase() === rubro.toLowerCase());
    return i === -1 ? primero.length : i;
  };
  const rubros = [...new Set(tareas.map((t) => t.rubro))].sort(
    (a, b) => orden(a) - orden(b) || a.localeCompare(b, "es")
  );
  return (
    <select
      value={valor ?? ""}
      onChange={(e) => alCambiar(e.target.value || null)}
      title={tareas.find((t) => t.id === valor)?.nombre}
      style={selectorEnPastilla}
    >
      <option value="">{vacio}</option>
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

/** Un desplegable cualquiera, en pastilla. */
export function Desplegable<T extends string>({
  valor,
  opciones,
  alCambiar,
}: {
  valor: T;
  opciones: { valor: T; nombre: string }[];
  alCambiar: (nuevo: T) => void;
}) {
  return (
    <select value={valor} onChange={(e) => alCambiar(e.target.value as T)} style={selectorEnPastilla}>
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.nombre}
        </option>
      ))}
    </select>
  );
}

// ---- Dibujos -----------------------------------------------------------------

/**
 * Hasta dónde va una capa sobre el muro: el muro de piso a techo y la franja
 * de la capa, con sus dos bordes para arrastrar. Al lado, lo mismo escrito.
 * Es un renglón más: el dibujo va donde los otros llevan su nombre.
 */
export function AlturaDeCapa({
  alto,
  cielorraso,
  desde,
  hasta,
  color,
  alCambiar,
}: {
  /** De piso a techo, en metros. */
  alto: number;
  /** Dónde está el cielorraso, si hay uno: "cielorraso" llega ahí. */
  cielorraso: number | null;
  desde: number;
  hasta: "techo" | "cielorraso" | number;
  color: string;
  alCambiar: (cambios: { desde?: number; hasta?: "techo" | "cielorraso" | number }) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [arrastrando, setArrastrando] = useState<"desde" | "hasta" | null>(null);
  const tope = alto > 0 ? alto : 2.6;
  const arriba = Math.min(
    tope,
    hasta === "techo" ? tope : hasta === "cielorraso" ? cielorraso ?? tope : hasta
  );
  const abajo = Math.min(desde, arriba);
  const ALTO = 88;
  const y = (m: number) => 4 + (1 - m / tope) * ALTO;
  const aMetros = (clientY: number) => {
    const caja = svg.current?.getBoundingClientRect();
    if (!caja) return 0;
    const fraccion = 1 - (clientY - caja.top - (4 * caja.height) / (ALTO + 8)) / ((ALTO * caja.height) / (ALTO + 8));
    return Math.round(Math.min(1, Math.max(0, fraccion)) * tope * 20) / 20;
  };
  const tipoDeHasta = typeof hasta === "number" ? "altura" : hasta;
  return (
    <div style={{ ...fila, alignItems: "center" }}>
      <span style={{ color: "#888888", display: "flex" }}>
        <Icono nombre="altura" />
      </span>
      <svg
        ref={svg}
        viewBox={`0 0 44 ${ALTO + 8}`}
        width={44}
        height={ALTO + 8}
        style={{ touchAction: "none" }}
        onPointerMove={(e) => {
          if (!arrastrando) return;
          const m = aMetros(e.clientY);
          if (arrastrando === "hasta") alCambiar({ hasta: m >= tope - 1e-9 ? "techo" : Math.max(m, abajo + 0.05) });
          else alCambiar({ desde: Math.min(m, arriba - 0.05) });
        }}
        onPointerUp={() => setArrastrando(null)}
        role="img"
        aria-label="Altura de la capa sobre el muro"
      >
        <rect x={8} y={4} width={22} height={ALTO} fill="#ffffff" stroke="#cfcfcf" />
        <rect x={8} y={y(arriba)} width={22} height={Math.max(1, y(abajo) - y(arriba))} fill={color} opacity={0.85} />
        {(["hasta", "desde"] as const).map((borde) => (
          <circle
            key={borde}
            cx={19}
            cy={y(borde === "hasta" ? arriba : abajo)}
            r={4.5}
            fill="#ffffff"
            stroke="#333333"
            strokeWidth={1.2}
            style={{ cursor: "ns-resize" }}
            onPointerDown={(e) => {
              e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
              setArrastrando(borde);
            }}
          />
        ))}
      </svg>
      <div style={columnaDeAltura}>
        <div style={filaDeAltura}>
          <span style={rotuloChico}>hasta</span>
          <Desplegable
            valor={tipoDeHasta}
            opciones={[
              { valor: "techo", nombre: "techo" },
              { valor: "cielorraso", nombre: "cielorraso" },
              { valor: "altura", nombre: "altura" },
            ]}
            alCambiar={(t) => alCambiar({ hasta: t === "altura" ? Math.min(2.1, tope) : t })}
          />
        </div>
        {typeof hasta === "number" && (
          <div style={filaDeAltura}>
            <span />
            <CampoNumero valor={hasta} unidad="m" paso={0.05} alCambiar={(v) => v !== null && v > 0 && alCambiar({ hasta: v })} />
          </div>
        )}
        <div style={filaDeAltura}>
          <span style={rotuloChico}>desde</span>
          <CampoNumero valor={desde} unidad="m" paso={0.05} alCambiar={(v) => alCambiar({ desde: v ?? 0 })} />
        </div>
      </div>
    </div>
  );
}

/** Las capas de una pila, de contra el muro a la de afuera; se arrastran para reordenarlas. */
export function Pila({
  capas,
  elegida,
  alElegir,
  alMover,
}: {
  capas: { id: string; color: string; nombre: string; espesor: string }[];
  elegida: string;
  alElegir: (id: string) => void;
  /** Lleva una capa al lugar de otra. */
  alMover: (id: string, aDonde: string) => void;
}) {
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: "2px" }}>
      {capas.map((c) => (
        <div
          key={c.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            setArrastrada(c.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(c.id);
          }}
          onDragLeave={() => setEncima(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (arrastrada && arrastrada !== c.id) alMover(arrastrada, c.id);
            setArrastrada(null);
            setEncima(null);
          }}
          onDragEnd={() => {
            setArrastrada(null);
            setEncima(null);
          }}
          onClick={() => alElegir(c.id)}
          style={{
            ...filaDePila,
            background: c.id === elegida ? "#f1f0ec" : "transparent",
            outline: encima === c.id && arrastrada !== c.id ? "1px dashed #999999" : "none",
            opacity: arrastrada === c.id ? 0.5 : 1,
          }}
        >
          <span style={{ color: "#aaaaaa", display: "flex", cursor: "grab" }}>
            <Icono nombre="grip" size={14} />
          </span>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color }} />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: c.id === elegida ? 600 : 400,
              color: c.id === elegida ? "#111111" : "#555555",
            }}
            title={c.nombre}
          >
            {c.nombre}
          </span>
          <span style={{ textAlign: "right", color: "#888888" }}>{c.espesor}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Una capa vista en planta, de cerca: los muros alrededor en gris y sus
 * piezas en su color. Tocar una pieza elige su tramo.
 */
export function MiniPlanta({
  fondo,
  piezas,
  alElegir,
}: {
  /** Los muros de alrededor, como polígonos. */
  fondo: Punto[][];
  piezas: { puntos: Punto[]; color: string; elegida: boolean; linea: boolean; tramo: number }[];
  alElegir: (tramo: number) => void;
}) {
  const todos = piezas.flatMap((p) => p.puntos);
  if (todos.length === 0) return null;
  const xs = todos.map((p) => p.x);
  const ys = todos.map((p) => p.y);
  const ancho = Math.max(...xs) - Math.min(...xs);
  const alto = Math.max(...ys) - Math.min(...ys);
  const margen = Math.max(ancho, alto) * 0.08 + 4;
  const caja = {
    x: Math.min(...xs) - margen,
    y: Math.min(...ys) - margen,
    w: ancho + 2 * margen,
    h: alto + 2 * margen,
  };
  const puntos = (pp: Punto[]) => pp.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg
      viewBox={`${caja.x} ${caja.y} ${caja.w} ${caja.h}`}
      width="100%"
      height={130}
      preserveAspectRatio="xMidYMid meet"
      style={{ background: "#f7f6f3", borderRadius: 8, display: "block" }}
      role="img"
      aria-label="La capa en planta"
    >
      {fondo.map((f, i) => (
        <polygon key={i} points={puntos(f)} fill="#bdbab3" />
      ))}
      {piezas.map((p, i) =>
        p.linea ? (
          <line
            key={i}
            x1={p.puntos[0].x}
            y1={p.puntos[0].y}
            x2={p.puntos[1].x}
            y2={p.puntos[1].y}
            stroke={p.color}
            strokeWidth={p.elegida ? 5 : 3}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: "pointer" }}
            onClick={() => alElegir(p.tramo)}
          />
        ) : (
          <polygon
            key={i}
            points={puntos(p.puntos)}
            fill={p.color}
            stroke={p.elegida ? "#111111" : p.color}
            strokeWidth={p.elegida ? 2 : 3}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: "pointer" }}
            onClick={() => alElegir(p.tramo)}
          />
        )
      )}
    </svg>
  );
}

/** Una capa del corte de un muro. Con id, es una capa dibujada y se elige. */
export type CapaDeCorte = { color: string; espesor: number; nombre: string; id?: string };

/**
 * El corte de un muro: el núcleo al medio, lo de afuera a la izquierda y lo de
 * adentro a la derecha, cada capa con su espesor. Una pintura, que no tiene,
 * se ve como una raya.
 *
 * Arriba, a qué da cada lado con su "+": es de donde se le agrega una capa a
 * esa cara, sabiendo de qué lado es. Tocar una capa dibujada la marca, y
 * abajo aparece con dos acciones: abrirla, o quitarla de este muro —sólo de
 * éste: la misma capa sigue en los otros muros que la llevan—.
 */
export function CorteDeMuro({
  exterior,
  nucleo,
  interior,
  afuera,
  adentro,
  alAbrir,
  alQuitar,
  alAgregar,
}: {
  /** Del núcleo hacia afuera. */
  exterior: CapaDeCorte[];
  nucleo: CapaDeCorte;
  /** Del núcleo hacia adentro. */
  interior: CapaDeCorte[];
  /** A qué da cada lado: "Baño", "Afuera". */
  afuera: string;
  adentro: string;
  /** Abre una capa dibujada, para editarla. */
  alAbrir?: (id: string) => void;
  /** Saca una capa dibujada de este muro. */
  alQuitar?: (id: string) => void;
  /** Agrega una capa del lado de afuera (-1) o del de adentro (1). */
  alAgregar?: (lado: -1 | 1) => void;
}) {
  const [marcada, setMarcada] = useState<string | null>(null);
  const total = [...exterior, nucleo, ...interior].reduce((t, c) => t + c.espesor, 0);
  const escala = total > 0 ? 170 / total : 0;
  const anchoDe = (c: CapaDeCorte) => Math.max(c.espesor * escala, 4);
  const enOrden = [...[...exterior].reverse(), nucleo, ...interior];
  let x = 2;
  const franjas = enOrden.map((c) => {
    const f = { ...c, x, ancho: anchoDe(c) };
    x += f.ancho;
    return f;
  });
  const cm = (m: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(m * 100);
  const lado = (texto: string, cual: -1 | 1) =>
    alAgregar ? (
      <button
        type="button"
        onClick={() => alAgregar(cual)}
        title={`Agregar una capa del lado de ${texto}`}
        style={{ ...ladoDeCorte, flexDirection: cual === -1 ? "row" : "row-reverse" }}
      >
        <Icono nombre="mas" size={13} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{texto}</span>
      </button>
    ) : (
      <span style={{ ...ladoDeCorte, cursor: "default" }}>{texto}</span>
    );
  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <div style={cabezaDeCorte}>
        {lado(afuera, -1)}
        {lado(adentro, 1)}
      </div>
      <svg viewBox={`0 0 ${x + 60} 52`} width="100%" role="img" aria-label="Corte del muro">
        {franjas.map((f, i) => {
          const esElegida = f.id !== undefined && f.id === marcada;
          return (
            <g
              key={i}
              onClick={f.id ? () => setMarcada(esElegida ? null : (f.id as string)) : undefined}
              style={{ cursor: f.id ? "pointer" : "default" }}
            >
              <title>{`${f.nombre} · ${cm(f.espesor)} cm`}</title>
              <rect
                x={f.x}
                y={2}
                width={f.ancho}
                height={34}
                fill={f.color}
                stroke={esElegida ? "#111111" : "#ffffff"}
                strokeWidth={esElegida ? 1.5 : 0.5}
              />
              {i === exterior.length &&
                [10, 18, 26].map((yy) => (
                  <line key={yy} x1={f.x} x2={f.x + f.ancho} y1={yy} y2={yy} stroke="#ffffff" strokeOpacity={0.35} />
                ))}
              {f.espesor > 0 && f.ancho >= 12 && (
                <text x={f.x + f.ancho / 2} y={50} textAnchor="middle" fontSize={10} fill="#777777">
                  {cm(f.espesor)}
                </text>
              )}
            </g>
          );
        })}
        <text x={x + 8} y={23} fontSize={12} fill="#222222">
          {cm(total)} cm
        </text>
      </svg>
      {(() => {
        const capa = franjas.find((f) => f.id !== undefined && f.id === marcada);
        if (!capa || !capa.id) return null;
        const id = capa.id;
        return (
          <div style={capaMarcada}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: capa.color }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={capa.nombre}>
              {capa.nombre}
            </span>
            <span style={{ color: "#888888", textAlign: "right" }}>{cm(capa.espesor)} cm</span>
            <span style={{ display: "flex", gap: "2px" }}>
              {alAbrir && <BotonIcono icono="capa" nombre="Abrir la capa" onClick={() => alAbrir(id)} />}
              {alQuitar && (
                <BotonIcono
                  icono="quitar"
                  nombre="Quitarla de este muro"
                  peligro
                  onClick={() => {
                    alQuitar(id);
                    setMarcada(null);
                  }}
                />
              )}
            </span>
          </div>
        );
      })()}
    </div>
  );
}

// ---- Estilos -------------------------------------------------------------------

const capaMarcada = {
  display: "grid",
  gridTemplateColumns: "10px minmax(0, 1fr) 48px auto",
  gap: "8px",
  alignItems: "center",
  fontSize: "13px",
  background: "#f1f0ec",
  borderRadius: "6px",
  padding: "2px 4px 2px 8px",
};

const cabezaDeCorte = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: "8px",
};

const ladoDeCorte = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  minWidth: 0,
  border: "none",
  background: "none",
  padding: "2px 0",
  fontSize: "12px",
  fontFamily: "inherit",
  color: "#777777",
  cursor: "pointer",
};

const encabezado = {
  display: "grid",
  gridTemplateColumns: "30px minmax(0, 1fr) auto",
  gap: "10px",
  alignItems: "center",
  paddingBottom: "10px",
};

const tesela = {
  width: "30px",
  height: "30px",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ffffff",
};

const tituloDeEncabezado = {
  margin: 0,
  fontSize: "14px",
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

const detalleDeEncabezado = {
  margin: 0,
  fontSize: "12px",
  color: "#999999",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

const acciones = { display: "flex", gap: "2px" };

const botonIcono = {
  width: "28px",
  height: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  borderRadius: "6px",
  background: "transparent",
  cursor: "pointer",
};

const seccion = { borderTop: "1px solid #eeeeee" };

const cabezaDeSeccion = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  width: "100%",
  padding: "10px 0 8px",
  background: "none",
  border: "none",
  fontSize: "13px",
  fontWeight: 600,
  color: "#222222",
  cursor: "pointer",
};

const cuentaDeSeccion = { color: "#aaaaaa", fontWeight: 400 };

const cuerpoDeSeccion = { display: "grid", gap: "4px", paddingBottom: "12px" };

const fila = {
  display: "grid",
  gridTemplateColumns: "18px 72px minmax(0, 1fr)",
  gap: "8px",
  alignItems: "center",
  minHeight: "30px",
};

const nombreDeFila = { fontSize: "13px", color: "#777777" };

const pastilla = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "6px",
  background: "#f1f0ec",
  borderRadius: "6px",
  padding: "0 8px",
  height: "28px",
  fontSize: "13px",
  boxSizing: "border-box" as const,
  width: "100%",
};

const entradaEnPastilla = {
  flex: 1,
  minWidth: 0,
  height: "28px",
  border: "none",
  background: "transparent",
  padding: "0 0 0 8px",
  fontSize: "13px",
  fontFamily: "inherit",
  outline: "none",
};

const selectorEnPastilla = {
  ...pastilla,
  border: "none",
  fontFamily: "inherit",
  color: "#222222",
  cursor: "pointer",
  textOverflow: "ellipsis",
};

const segmentado = {
  display: "inline-flex",
  gap: "2px",
  background: "#f1f0ec",
  borderRadius: "6px",
  padding: "2px",
};

const segmento = {
  width: "30px",
  height: "24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid transparent",
  borderRadius: "4px",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
};

const segmentoElegido = { ...segmento, background: "#ffffff", borderColor: "#cccccc" };

const medidas = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "6px",
  paddingTop: "10px",
  borderTop: "1px solid #eeeeee",
};

const cajaDeMedida = {
  display: "grid",
  background: "#f1f0ec",
  borderRadius: "6px",
  padding: "6px 8px",
};

const valorDeMedida = { fontSize: "13px", fontWeight: 600 };

const nombreDeMedida = { fontSize: "11px", color: "#999999" };

const columnaDeAltura = { display: "grid", gap: "4px" };

const filaDeAltura = {
  display: "grid",
  gridTemplateColumns: "40px minmax(0, 1fr)",
  gap: "6px",
  alignItems: "center",
};

const rotuloChico = { fontSize: "12px", color: "#999999" };

const filaDePila = {
  display: "grid",
  gridTemplateColumns: "14px 10px minmax(0, 1fr) 44px",
  gap: "8px",
  alignItems: "center",
  fontSize: "13px",
  padding: "4px 6px",
  borderRadius: "6px",
  cursor: "pointer",
};
