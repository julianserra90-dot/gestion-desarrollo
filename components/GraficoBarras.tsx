/**
 * Un gráfico de barras por período, en SVG. Sin librerías ni cliente, igual que
 * `GraficoTorta`: son rectángulos calculados a mano.
 *
 * Cada punto puede llevar más de una serie (gastos e ingresos, por ejemplo) y
 * se dibujan agrupadas, una al lado de la otra. Los montos exactos viven en la
 * tabla que acompaña: acá se viene a ver la forma —en qué meses se gastó más—,
 * así que las barras no llevan el número encima, que las ensuciaría. Cada una
 * tiene su `title`, que el navegador muestra al pasar el mouse.
 *
 * El `viewBox` es de ancho fijo y los grupos se reparten adentro: así el
 * tamaño de la letra no depende de cuántos meses tenga la obra. Con un ancho
 * proporcional a los meses, dos meses estirados al ancho de la pantalla
 * agrandaban la tipografía cuatro veces.
 */

export type SerieBarras = { nombre: string; color: string };
export type PuntoBarras = { etiqueta: string; valores: number[] };

const ANCHO = 900;
const ALTO_BARRAS = 170;
const ALTO = 210;
const PADDING = 10;

export default function GraficoBarras({
  datos,
  series,
  formato,
}: {
  datos: PuntoBarras[];
  series: SerieBarras[];
  formato: (valor: number) => string;
}) {
  const maximo = Math.max(
    0,
    ...datos.flatMap((d) => d.valores.map((v) => (Number.isFinite(v) ? v : 0)))
  );

  if (datos.length === 0 || maximo <= 0) {
    return <p style={vacio}>Todavía no hay movimientos para graficar.</p>;
  }

  const grupo = (ANCHO - PADDING * 2) / datos.length;
  const anchoBarra = Math.min(38, (grupo * 0.7) / series.length);
  const anchoGrupo = anchoBarra * series.length;

  // Con muchos meses las etiquetas se pisan: se muestra una sí y una no.
  const salteaEtiquetas = datos.length > 14;

  return (
    <div>
      <ul style={leyenda}>
        {series.map((s) => (
          <li key={s.nombre} style={itemLeyenda}>
            <span style={{ ...swatch, background: s.color }} />
            {s.nombre}
          </li>
        ))}
      </ul>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        style={{ width: "100%", height: "auto" }}
      >
        {/* La referencia de la escala: el techo del gráfico. Sin esto las
            barras se comparan entre sí pero no dicen cuánto miden. */}
        <text x={PADDING} y={12} style={textoEscala}>
          {formato(maximo)}
        </text>
        <line
          x1={PADDING}
          y1={18}
          x2={ANCHO - PADDING}
          y2={18}
          stroke="#eeeeee"
        />
        <line
          x1={PADDING}
          y1={ALTO_BARRAS + 20}
          x2={ANCHO - PADDING}
          y2={ALTO_BARRAS + 20}
          stroke="#dddddd"
        />

        {datos.map((punto, i) => {
          const centro = PADDING + grupo * i + grupo / 2;

          return (
            <g key={punto.etiqueta}>
              {punto.valores.map((valor, j) => {
                const alto = maximo > 0 ? (valor / maximo) * ALTO_BARRAS : 0;
                const x = centro - anchoGrupo / 2 + anchoBarra * j;

                return (
                  <rect
                    key={j}
                    x={x}
                    y={ALTO_BARRAS + 20 - alto}
                    width={Math.max(anchoBarra - 2, 1)}
                    height={alto}
                    fill={series[j]?.color ?? "#111827"}
                  >
                    {/* Un solo hijo de texto: partido en varios nodos, el
                        title del SVG no hidrata igual en cliente que en
                        servidor y React tira la pantalla abajo. */}
                    <title>{`${punto.etiqueta} · ${series[j]?.nombre}: ${formato(valor)}`}</title>
                  </rect>
                );
              })}

              {(!salteaEtiquetas || i % 2 === 0) && (
                <text x={centro} y={ALTO - 4} style={textoEtiqueta}>
                  {punto.etiqueta}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const leyenda = {
  listStyle: "none",
  margin: "0 0 12px",
  padding: 0,
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "18px",
};

const itemLeyenda = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  color: "#555555",
};

const swatch = {
  width: "12px",
  height: "12px",
  flexShrink: 0,
  borderRadius: "2px",
};

const textoEscala = {
  fontSize: "11px",
  fill: "#999999",
};

const textoEtiqueta = {
  fontSize: "11px",
  fill: "#777777",
  textAnchor: "middle" as const,
};

const vacio = {
  color: "#777777",
  fontSize: "14px",
};
