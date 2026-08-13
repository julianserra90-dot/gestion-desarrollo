/**
 * Un gráfico de torta (dona) con su leyenda, en SVG. Sin librerías ni cliente:
 * son arcos calculados a mano.
 *
 * Recibe los datos ya sumados; asigna los colores de una paleta por orden. El
 * formato del monto lo pone quien lo usa (pesos o dólares).
 *
 * Una porción puede llevar `href`: ahí la leyenda se vuelve la puerta de entrada
 * al detalle de ese rubro. Sin `href` es texto y listo —hay porciones que no
 * tienen adónde llevar, como los gastos sin rubro—.
 *
 * Y puede llevar `partes`: el desglose interno del rubro (materiales, mano de
 * obra, administrativo). Se dibujan como arcos separados en **tonos del mismo
 * color**, no en colores distintos: el tono dice "esto sigue siendo albañilería"
 * y el corte dice "hasta acá fue material". Con un solo tipo no se desglosa, que
 * sería partir una porción en una sola parte.
 */

import Link from "next/link";

const PALETA = [
  "#111827",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#6b7280",
];

/** Cuánto se aclara cada parte respecto de la anterior. */
const PASO_DE_TONO = 0.34;

export type ParteTorta = {
  etiqueta: string;
  valor: number;
};

export type PorcionTorta = {
  etiqueta: string;
  valor: number;
  /** Adónde lleva la etiqueta, si tiene detalle para mostrar. */
  href?: string;
  /** Desglose del rubro por tipo de gasto, en tonos del color de la porción. */
  partes?: ParteTorta[];
};

/** Mezcla el color con blanco. 0 lo deja igual; 1 lo vuelve blanco. */
function aclarar(hex: string, factor: number) {
  const n = parseInt(hex.slice(1), 16);
  const canales = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mezclado = canales.map((c) => Math.round(c + (255 - c) * factor));
  return `rgb(${mezclado.join(", ")})`;
}

export default function GraficoTorta({
  datos,
  formato,
}: {
  datos: PorcionTorta[];
  formato: (valor: number) => string;
}) {
  const positivos = datos.filter((d) => d.valor > 0);
  const total = positivos.reduce((s, d) => s + d.valor, 0);

  if (total <= 0) {
    return <p style={vacio}>Todavía no hay gastos para graficar.</p>;
  }

  const R = 54;
  const grosor = 26;
  const C = 2 * Math.PI * R;

  const porciones = positivos.map((d, i) => {
    const base = PALETA[i % PALETA.length];
    const conValor = (d.partes ?? []).filter((p) => p.valor > 0);

    // Una sola parte es el rubro entero: desglosarlo no diría nada.
    const partes =
      conValor.length > 1
        ? conValor.map((p, j) => ({ ...p, color: aclarar(base, j * PASO_DE_TONO) }))
        : [];

    return {
      ...d,
      base,
      partes,
      porcentaje: Math.round((d.valor / total) * 100),
    };
  });

  // Los arcos salen de recorrer las porciones en orden: una por rubro, o una
  // por parte si el rubro se desglosa. Lo que las partes no cubran (un ajuste
  // de saldo, por ejemplo) se dibuja al final en el color base, para que el
  // anillo no quede con un hueco.
  const arcos: { color: string; valor: number }[] = [];

  for (const p of porciones) {
    if (p.partes.length === 0) {
      arcos.push({ color: p.base, valor: p.valor });
      continue;
    }

    for (const parte of p.partes) {
      arcos.push({ color: parte.color, valor: parte.valor });
    }

    const resto = p.valor - p.partes.reduce((s, x) => s + x.valor, 0);
    if (resto > 0.01) arcos.push({ color: p.base, valor: resto });
  }

  return (
    <div style={contenedor}>
      <svg viewBox="0 0 140 140" style={{ width: "140px", height: "140px", flexShrink: 0 }}>
        {/* Se arranca arriba (rotado -90) y cada arco se corre con el offset:
            la suma de los arcos anteriores. Se calcula sin acumulador mutable,
            así el render no depende del orden en que corra. */}
        <g transform="rotate(-90 70 70)">
          {arcos.map((a, i) => {
            const largo = (a.valor / total) * C;
            const offset =
              (arcos.slice(0, i).reduce((s, x) => s + x.valor, 0) / total) * C;

            return (
              <circle
                key={i}
                cx={70}
                cy={70}
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={grosor}
                strokeDasharray={`${largo} ${C - largo}`}
                strokeDashoffset={-offset}
              />
            );
          })}
        </g>
      </svg>

      <ul style={leyenda}>
        {porciones.map((p, i) => (
          <li key={i}>
            <div style={item}>
              <span style={{ ...swatch, background: p.base }} />
              <span style={etiqueta}>
                {p.href ? (
                  <Link href={p.href} style={enlace}>
                    {p.etiqueta}
                  </Link>
                ) : (
                  p.etiqueta
                )}
              </span>
              <span style={valor}>
                {formato(p.valor)} <span style={pct}>{p.porcentaje}%</span>
              </span>
            </div>

            {p.partes.map((parte) => (
              <div key={parte.etiqueta} style={subItem}>
                <span style={{ ...swatch, background: parte.color }} />
                <span style={subEtiqueta}>{parte.etiqueta}</span>
                <span style={subValor}>{formato(parte.valor)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

const contenedor = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "28px",
  alignItems: "center",
};

const leyenda = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  flex: "1 1 220px",
  display: "grid",
  gap: "10px",
};

const item = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "14px",
};

// El desglose se lee como parte del rubro, no como otra fila del mismo rango:
// va indentado, más chico y en gris.
const subItem = {
  ...item,
  fontSize: "13px",
  color: "#777777",
  paddingLeft: "22px",
  marginTop: "6px",
};

const swatch = {
  width: "12px",
  height: "12px",
  flexShrink: 0,
  borderRadius: "2px",
};

const etiqueta = {
  flex: "1 1 auto",
  color: "#333333",
};

const enlace = {
  color: "#333333",
  textDecoration: "underline",
};

const subEtiqueta = {
  ...etiqueta,
  color: "#777777",
};

const valor = {
  color: "#111111",
  whiteSpace: "nowrap" as const,
};

const subValor = {
  ...valor,
  color: "#777777",
};

const pct = {
  color: "#999999",
  marginLeft: "4px",
};

const vacio = {
  color: "#777777",
  fontSize: "14px",
};
