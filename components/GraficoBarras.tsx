/**
 * Un gráfico de barras por período, en SVG. Sin librerías ni cliente, igual que
 * `GraficoTorta`: son rectángulos calculados a mano.
 *
 * Cada punto puede llevar más de una serie (gastos e ingresos, por ejemplo) y
 * se dibujan agrupadas, una al lado de la otra.
 *
 * **Los montos no se escriben sobre las barras**: se ven al pasar el mouse, en
 * el `title` de cada una. Se probó ponerlos adentro, girados, y el gráfico se
 * ensuciaba justo donde tiene que leerse de un vistazo. Lo que da la magnitud es
 * el **eje de la izquierda**, con sus líneas de referencia.
 *
 * Una barra puede venir **partida** (`partes`): el período desglosado por rubro,
 * en los colores de `lib/paleta-rubros`. Y un punto puede llevar `href`: ahí todo
 * su grupo se vuelve la puerta de entrada al detalle de ese período.
 *
 * El `viewBox` es de ancho fijo y los grupos se reparten adentro: así el
 * tamaño de la letra no depende de cuántos meses tenga la obra. Con un ancho
 * proporcional a los meses, dos meses estirados al ancho de la pantalla
 * agrandaban la tipografía cuatro veces.
 */

import Link from "next/link";

export type SerieBarras = { nombre: string; color: string };
export type ParteBarra = { etiqueta: string; color: string; valor: number };
export type PuntoBarras = {
  etiqueta: string;
  valores: number[];
  /**
   * El desglose de cada valor, en el mismo orden que `valores`. Sin desglose la
   * barra va entera del color de su serie.
   */
  partes?: (ParteBarra[] | undefined)[];
  /** Adónde lleva el grupo, si ese período tiene detalle para mostrar. */
  href?: string;
  /**
   * Un hito que se dibuja **antes** de este grupo, como línea de puntos con su
   * rótulo. Se usa para el arranque de la obra: sin eso, lo que quedó a la
   * izquierda parece obra y son acopios, anticipos e impuestos del terreno que
   * a veces se vienen pagando de mucho antes.
   */
  marca?: string;
};

const ANCHO = 900;
const ALTO_BARRAS = 200;
const TOPE = 14;
const BASE = TOPE + ALTO_BARRAS;
const ALTO = BASE + 28;
const MARGEN_IZQ = 66;
const MARGEN_DER = 8;
const DIVISIONES = 4;

/**
 * Un techo redondo para el eje. Con el máximo crudo las marcas quedaban en
 * números como "$ 12.904.662", que no se leen de reojo; redondeando para arriba
 * al múltiplo lindo más cercano quedan "$ 4 M", "$ 8 M", "$ 12 M", "$ 16 M".
 */
function escalaDe(maximo: number) {
  if (maximo <= 0) return { techo: 0, paso: 0 };

  const bruto = maximo / DIVISIONES;
  const magnitud = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = Math.ceil(bruto / magnitud) * magnitud;

  return { techo: paso * DIVISIONES, paso };
}

export default function GraficoBarras({
  datos,
  series,
  formato,
  formatoEje,
}: {
  datos: PuntoBarras[];
  series: SerieBarras[];
  formato: (valor: number) => string;
  /** El formato de las marcas del eje, si conviene uno más corto. */
  formatoEje?: (valor: number) => string;
}) {
  const maximo = Math.max(
    0,
    ...datos.flatMap((d) => d.valores.map((v) => (Number.isFinite(v) ? v : 0)))
  );

  if (datos.length === 0 || maximo <= 0) {
    return <p style={vacio}>Todavía no hay movimientos para graficar.</p>;
  }

  const { techo, paso } = escalaDe(maximo);
  const marcaEje = formatoEje ?? formato;

  const util = ANCHO - MARGEN_IZQ - MARGEN_DER;
  const grupo = util / datos.length;
  const anchoBarra = Math.min(30, (grupo * 0.62) / series.length);
  const anchoGrupo = anchoBarra * series.length;

  // Con muchos meses las etiquetas se pisan: se muestra una sí y una no.
  const salteaEtiquetas = datos.length > 14;

  // Los rubros de la leyenda salen de los datos, en el orden en que aparecen:
  // quien llama ya los ordenó por lo que pesan, y repetir ese orden acá hace que
  // la leyenda se lea igual que la barra, de abajo hacia arriba.
  const rubros: ParteBarra[] = [];
  for (const punto of datos) {
    for (const desglose of punto.partes ?? []) {
      for (const parte of desglose ?? []) {
        if (!rubros.some((r) => r.etiqueta === parte.etiqueta)) rubros.push(parte);
      }
    }
  }

  // Una serie que viene partida no va a la leyenda: su color no se dibuja en
  // ningún lado, lo reemplazan los rubros.
  const seriesEnteras = series.filter(
    (_, j) => !datos.some((d) => (d.partes?.[j] ?? []).length > 0)
  );

  const leyendaCompleta = [
    ...seriesEnteras.map((s) => ({ etiqueta: s.nombre, color: s.color })),
    ...rubros.map((r) => ({ etiqueta: r.etiqueta, color: r.color })),
  ];

  return (
    <div>
      {leyendaCompleta.length > 0 && (
        <ul style={leyenda}>
          {leyendaCompleta.map((item) => (
            <li key={item.etiqueta} style={itemLeyenda}>
              <span style={{ ...punto, background: item.color }} />
              {item.etiqueta}
            </li>
          ))}
        </ul>
      )}

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        style={{ width: "100%", height: "auto" }}
      >
        {/* El eje: una línea por división, con su monto a la izquierda. Es lo
            que reemplaza a los números sobre las barras. */}
        {Array.from({ length: DIVISIONES + 1 }, (_, i) => {
          const y = BASE - (i / DIVISIONES) * ALTO_BARRAS;

          return (
            <g key={i}>
              <line
                x1={MARGEN_IZQ}
                y1={y}
                x2={ANCHO - MARGEN_DER}
                y2={y}
                stroke={i === 0 ? "#dddddd" : "#f2f2f2"}
              />
              <text x={MARGEN_IZQ - 10} y={y + 3} style={textoEje}>
                {marcaEje(paso * i)}
              </text>
            </g>
          );
        })}

        {/* Los hitos van en su propia pasada y antes de las barras: quedan por
            debajo, y sobre todo fuera del enlace de cada grupo —una línea que
            se pueda clickear y lleve a otro lado sería una trampa—. */}
        {datos.map((dato, i) =>
          dato.marca ? (
            <g key={`marca-${dato.etiqueta}`}>
              <line
                x1={MARGEN_IZQ + grupo * i}
                y1={TOPE}
                x2={MARGEN_IZQ + grupo * i}
                y2={BASE}
                stroke="#c58b1a"
                strokeDasharray="4 4"
              />
              <text
                x={MARGEN_IZQ + grupo * i + 6}
                y={TOPE + 9}
                style={textoMarca}
              >
                {dato.marca}
              </text>
            </g>
          ) : null
        )}

        {datos.map((dato, i) => {
          const centro = MARGEN_IZQ + grupo * i + grupo / 2;

          const contenido = (
            <>
              {/* Una zona transparente que cubre toda la columna: con el enlace
                  puesto sólo en las barras habría que apuntarle a un rectángulo
                  de treinta píxeles, y los meses flacos serían imposibles. */}
              {dato.href && (
                <rect
                  x={MARGEN_IZQ + grupo * i}
                  y={TOPE}
                  width={grupo}
                  height={ALTO - TOPE}
                  fill="transparent"
                />
              )}

              {dato.valores.map((valor, j) => {
                const alto = techo > 0 ? (valor / techo) * ALTO_BARRAS : 0;
                const x = centro - anchoGrupo / 2 + anchoBarra * j;
                const ancho = Math.max(anchoBarra - 3, 1);
                const desglose = dato.partes?.[j] ?? [];

                if (desglose.length > 0) {
                  // Apilado de abajo hacia arriba, en el orden en que vienen: el
                  // rubro que más pesa queda abajo, apoyado en el eje, que es
                  // donde el ojo lo compara entre períodos.
                  return desglose.map((parte, k) => {
                    const altoParte = (parte.valor / techo) * ALTO_BARRAS;
                    const previas = desglose
                      .slice(0, k)
                      .reduce((s, p) => s + p.valor, 0);
                    const y = BASE - (previas / techo) * ALTO_BARRAS - altoParte;

                    return (
                      <rect
                        key={`${j}-${parte.etiqueta}`}
                        x={x}
                        y={y}
                        width={ancho}
                        height={altoParte}
                        fill={parte.color}
                      >
                        <title>{`${dato.etiqueta} · ${parte.etiqueta}: ${formato(parte.valor)}`}</title>
                      </rect>
                    );
                  });
                }

                return (
                  <rect
                    key={j}
                    x={x}
                    y={BASE - alto}
                    width={ancho}
                    height={alto}
                    fill={series[j]?.color ?? "#111827"}
                  >
                    {/* Un solo hijo de texto: partido en varios nodos, el title
                        del SVG no hidrata igual en cliente que en servidor y
                        React tira la pantalla abajo. */}
                    <title>{`${dato.etiqueta} · ${series[j]?.nombre}: ${formato(valor)}`}</title>
                  </rect>
                );
              })}

              {(!salteaEtiquetas || i % 2 === 0) && (
                <text x={centro} y={ALTO - 6} style={textoEtiqueta}>
                  {dato.etiqueta}
                </text>
              )}
            </>
          );

          return dato.href ? (
            <Link key={dato.etiqueta} href={dato.href} style={grupoConEnlace}>
              {contenido}
            </Link>
          ) : (
            <g key={dato.etiqueta}>{contenido}</g>
          );
        })}
      </svg>
    </div>
  );
}

const leyenda = {
  listStyle: "none",
  margin: "0 0 16px",
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

const punto = {
  width: "10px",
  height: "10px",
  flexShrink: 0,
  borderRadius: "50%",
};

const textoEje = {
  fontSize: "12px",
  fill: "#aaaaaa",
  textAnchor: "end" as const,
};

const textoEtiqueta = {
  fontSize: "12px",
  fill: "#888888",
  textAnchor: "middle" as const,
};

// El mismo ámbar de la etiqueta "Previo al arranque": es el mismo concepto
// contado de otra manera.
const textoMarca = {
  fontSize: "11px",
  fill: "#8a5a12",
};

const grupoConEnlace = {
  cursor: "pointer",
};

const vacio = {
  color: "#777777",
  fontSize: "14px",
};
