/**
 * Un gráfico de torta (dona) con su leyenda, en SVG. Sin librerías ni cliente:
 * son arcos calculados a mano.
 *
 * Recibe los datos ya sumados; asigna los colores de una paleta por orden. El
 * formato del monto lo pone quien lo usa (pesos o dólares).
 */

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

export type PorcionTorta = { etiqueta: string; valor: number };

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
    const fraccion = d.valor / total;
    // El offset es la suma de los arcos anteriores. Se calcula sin mutar nada
    // afuera: así el render no depende de un acumulador que cambia.
    const offset =
      positivos.slice(0, i).reduce((s, x) => s + x.valor, 0) / total * C;
    return {
      ...d,
      color: PALETA[i % PALETA.length],
      largo: fraccion * C,
      offset,
      porcentaje: Math.round(fraccion * 100),
    };
  });

  return (
    <div style={contenedor}>
      <svg viewBox="0 0 140 140" style={{ width: "140px", height: "140px", flexShrink: 0 }}>
        {/* Se arranca arriba (rotado -90) y cada arco se corre con el offset. */}
        <g transform="rotate(-90 70 70)">
          {porciones.map((p, i) => (
            <circle
              key={i}
              cx={70}
              cy={70}
              r={R}
              fill="none"
              stroke={p.color}
              strokeWidth={grosor}
              strokeDasharray={`${p.largo} ${C - p.largo}`}
              strokeDashoffset={-p.offset}
            />
          ))}
        </g>
      </svg>

      <ul style={leyenda}>
        {porciones.map((p, i) => (
          <li key={i} style={item}>
            <span style={{ ...swatch, background: p.color }} />
            <span style={etiqueta}>{p.etiqueta}</span>
            <span style={valor}>
              {formato(p.valor)} <span style={pct}>{p.porcentaje}%</span>
            </span>
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

const valor = {
  color: "#111111",
  whiteSpace: "nowrap" as const,
};

const pct = {
  color: "#999999",
  marginLeft: "4px",
};

const vacio = {
  color: "#777777",
  fontSize: "14px",
};
