/**
 * Un gráfico de torta (dona) con su leyenda, en SVG. Sin librerías ni cliente:
 * son arcos calculados a mano.
 *
 * Recibe los datos ya sumados; asigna los colores de una paleta por orden. El
 * formato del monto lo pone quien lo usa (pesos o dólares).
 *
 * La leyenda se lee como una tabla: color · porcentaje · rubro en una línea, y
 * los montos alineados en su propia columna. Una porción puede llevar `href`:
 * ahí el nombre se vuelve la puerta de entrada al detalle de ese rubro. Sin
 * `href` es texto y listo —hay porciones que no tienen adónde llevar, como los
 * gastos sin rubro—.
 *
 * Y puede llevar `partes`: el desglose interno del rubro (materiales, mano de
 * obra, administrativo). En el anillo se dibujan como arcos en **tonos del
 * mismo color** —el tono dice "esto sigue siendo albañilería" y el corte dice
 * "hasta acá fue material"—. En la leyenda el desglose arranca cerrado, atrás
 * de un "+": es detalle, no compite con la lectura principal. Es un `details`
 * nativo porque este componente corre en el servidor. Con un solo tipo no se
 * desglosa, que sería partir una porción en una sola parte.
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

  const fila = (p: (typeof porciones)[number]) => (
    <span style={filaLeyenda}>
      <span style={{ ...swatch, background: p.base }} />
      <span style={pct}>{p.porcentaje}%</span>
      <span style={etiqueta}>
        {p.href ? (
          <Link href={p.href} style={enlace}>
            {p.etiqueta}
          </Link>
        ) : (
          p.etiqueta
        )}
        {p.partes.length > 0 && <span style={mas} className="torta-mas" />}
      </span>
      <span style={monto}>{formato(p.valor)}</span>
    </span>
  );

  return (
    <div style={contenedor}>
      {/* El marcador nativo del details se esconde a propósito: acá la señal
          de que hay más es el "+", que pasa a "−" al abrir. Ese cambio de
          estado sólo se puede con CSS, por eso el <style> en un archivo de
          estilos inline. */}
      <style>{`
        details.torta-detalle > summary { cursor: pointer; list-style: none; }
        details.torta-detalle > summary::-webkit-details-marker { display: none; }
        .torta-mas::before { content: "+"; }
        details.torta-detalle[open] > summary .torta-mas::before { content: "\\2212"; }
      `}</style>

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
            {p.partes.length === 0 ? (
              fila(p)
            ) : (
              <details className="torta-detalle">
                <summary>{fila(p)}</summary>

                {p.partes.map((parte) => (
                  <span key={parte.etiqueta} style={filaParte}>
                    <span />
                    <span />
                    <span style={parteEtiqueta}>
                      <span style={{ ...swatch, background: parte.color }} />
                      {parte.etiqueta}
                    </span>
                    <span style={parteMonto}>{formato(parte.valor)}</span>
                  </span>
                ))}
              </details>
            )}
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

// Un tope de ancho para que el nombre y su monto no queden a media pantalla de
// distancia en un panel a lo ancho de la hoja.
const leyenda = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  flex: "1 1 300px",
  maxWidth: "760px",
  display: "grid",
  gap: "12px",
};

// Cada fila es su propia grilla con columnas fijas: así los porcentajes, los
// nombres y los montos arrancan en la misma vertical en todas las filas.
const filaLeyenda = {
  display: "grid",
  gridTemplateColumns: "12px 40px minmax(0, 1fr) auto",
  gap: "10px",
  alignItems: "center",
  fontSize: "14px",
};

// El desglose se lee como parte del rubro: mismo esqueleto de columnas, en
// gris y con su tono, arrancando bajo el nombre.
const filaParte = {
  ...filaLeyenda,
  fontSize: "13px",
  color: "#777777",
  marginTop: "8px",
};

const swatch = {
  width: "12px",
  height: "12px",
  flexShrink: 0,
  borderRadius: "2px",
};

const pct = {
  color: "#777777",
};

const etiqueta = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: "#333333",
  whiteSpace: "nowrap" as const,
};

const enlace = {
  color: "#333333",
  textDecoration: "underline",
};

const mas = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "18px",
  height: "18px",
  border: "1px solid #dddddd",
  borderRadius: "3px",
  color: "#888888",
  fontSize: "13px",
  lineHeight: 1,
};

const monto = {
  color: "#111111",
  whiteSpace: "nowrap" as const,
  textAlign: "right" as const,
};

const parteEtiqueta = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  color: "#777777",
};

const parteMonto = {
  ...monto,
  color: "#777777",
};

const vacio = {
  color: "#777777",
  fontSize: "14px",
};
