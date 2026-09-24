import * as ui from "@/components/ui";
import type { Ambiente, Dibujo, TipoAmbiente } from "@/lib/plantas-tipo";

/**
 * La planta tipo dibujada: la huella con la calle abajo, el núcleo y el
 * patio, y cada ambiente con su nombre y medidas. SVG puro, a escala.
 */
export default function PlantaTipo({ dibujo }: { dibujo: Dibujo }) {
  const ANCHO = 560;
  const MARGEN = 46;
  const escala = Math.min((ANCHO - 2 * MARGEN) / dibujo.ancho, 420 / dibujo.profundidad);
  const alto = dibujo.profundidad * escala + 2 * MARGEN;
  // La calle abajo: y crece hacia el fondo del lote, en pantalla hacia arriba.
  const X = (x: number) => MARGEN + x * escala;
  const Y = (y: number) => alto - MARGEN - y * escala;

  return (
    <div style={contenedor}>
      <svg viewBox={`0 0 ${ANCHO} ${alto}`} style={lienzo}>
        <defs>
          <pattern id="patio" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#bbbbbb" strokeWidth="1" />
          </pattern>
        </defs>

        {/* La huella. */}
        <rect
          x={X(0)}
          y={Y(dibujo.profundidad)}
          width={dibujo.ancho * escala}
          height={dibujo.profundidad * escala}
          fill="#fafafa"
          stroke="#111111"
          strokeWidth={2}
        />

        {dibujo.ambientes.map((a, i) => (
          <g key={i}>
            <rect
              x={X(a.x)}
              y={Y(a.y + a.alto)}
              width={a.ancho * escala}
              height={a.alto * escala}
              fill={relleno(a.tipo)}
              stroke="#555555"
              strokeWidth={0.8}
            />
            {a.tipo === "escalera" && <Escalera a={a} X={X} Y={Y} escala={escala} />}
            {a.tipo === "ascensor" && (
              <g stroke="#777777" strokeWidth={0.8}>
                <line x1={X(a.x)} y1={Y(a.y)} x2={X(a.x + a.ancho)} y2={Y(a.y + a.alto)} />
                <line x1={X(a.x)} y1={Y(a.y + a.alto)} x2={X(a.x + a.ancho)} y2={Y(a.y)} />
              </g>
            )}
            {a.ventana && <VentanaDe a={a} X={X} Y={Y} escala={escala} />}
            {/* El nombre si entra, y las medidas sólo en los ambientes
                anchos: en una cocina de 1,8 m se pisaban con el vecino. */}
            {a.ancho * escala > 30 && a.alto * escala > 22 && (
              <text
                x={X(a.x + a.ancho / 2)}
                y={Y(a.y + a.alto / 2) + (a.ancho * escala > 70 ? -2 : 4)}
                textAnchor="middle"
                style={textoNombre}
              >
                {a.nombre}
              </text>
            )}
            {a.ancho * escala > 70 && a.alto * escala > 30 && (
              <text x={X(a.x + a.ancho / 2)} y={Y(a.y + a.alto / 2) + 10} textAnchor="middle" style={textoMedida}>
                {formatear(a.ancho)} × {formatear(a.alto)} · {formatear(a.ancho * a.alto)} m²
              </text>
            )}
          </g>
        ))}

        {/* Las unidades, con borde grueso para verlas como conjunto. */}
        {dibujo.unidades.map((u) => (
          <rect
            key={u.nombre + u.x + u.y}
            x={X(u.x)}
            y={Y(u.y + u.alto)}
            width={u.ancho * escala}
            height={u.alto * escala}
            fill="none"
            stroke="#111111"
            strokeWidth={1.6}
          />
        ))}

        {/* Cotas y referencias. */}
        <text x={X(dibujo.ancho / 2)} y={alto - 12} textAnchor="middle" style={textoCalle}>
          calle · {formatear(dibujo.ancho)} m útiles entre medianeras
        </text>
        <text x={X(dibujo.ancho / 2)} y={Y(dibujo.profundidad) - 10} textAnchor="middle" style={textoCalle}>
          hacia el pulmón de manzana
        </text>
        <text
          x={X(dibujo.ancho) + 10}
          y={Y(dibujo.profundidad / 2)}
          style={textoMedida}
          transform={`rotate(90 ${X(dibujo.ancho) + 10} ${Y(dibujo.profundidad / 2)})`}
          textAnchor="middle"
        >
          {formatear(dibujo.profundidad)} m desde la Línea Oficial
        </text>
      </svg>

      {dibujo.notas.length > 0 && (
        <ul style={lista}>
          {dibujo.notas.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Escalera({ a, X, Y, escala }: { a: Ambiente; X: (x: number) => number; Y: (y: number) => number; escala: number }) {
  // Dos tramos: escalones como líneas cruzando cada mitad del ancho.
  const pasos = Math.max(4, Math.round(a.alto / 0.28));
  const lineas = [];
  for (let i = 1; i < pasos; i++) {
    const y = Y(a.y + (a.alto * i) / pasos);
    lineas.push(<line key={`a${i}`} x1={X(a.x)} y1={y} x2={X(a.x + a.ancho / 2)} y2={y} />);
    lineas.push(<line key={`b${i}`} x1={X(a.x + a.ancho / 2)} y1={y} x2={X(a.x + a.ancho)} y2={y} />);
  }
  return (
    <g stroke="#999999" strokeWidth={0.6}>
      {lineas}
      <line x1={X(a.x + a.ancho / 2)} y1={Y(a.y)} x2={X(a.x + a.ancho / 2)} y2={Y(a.y + a.alto)} stroke="#555555" />
      <text x={X(a.x + a.ancho / 2)} y={Y(a.y + a.alto / 2)} textAnchor="middle" style={{ ...textoMedida, fontSize: "9px" }} stroke="none">
        {escala > 0 ? "escalera" : ""}
      </text>
    </g>
  );
}

function VentanaDe({ a, X, Y, escala }: { a: Ambiente; X: (x: number) => number; Y: (y: number) => number; escala: number }) {
  // Un trazo grueso sobre el lado que ventila, con un margen para no tapar
  // la medianera.
  const m = Math.min(0.4 * escala, (a.ancho * escala) / 5);
  const props = { stroke: "#111111", strokeWidth: 4, strokeLinecap: "round" as const };
  switch (a.ventana) {
    case "abajo":
      return <line x1={X(a.x) + m} y1={Y(a.y)} x2={X(a.x + a.ancho) - m} y2={Y(a.y)} {...props} />;
    case "arriba":
      return <line x1={X(a.x) + m} y1={Y(a.y + a.alto)} x2={X(a.x + a.ancho) - m} y2={Y(a.y + a.alto)} {...props} />;
    case "izquierda":
      return <line x1={X(a.x)} y1={Y(a.y) - m} x2={X(a.x)} y2={Y(a.y + a.alto) + m} {...props} />;
    case "derecha":
      return <line x1={X(a.x + a.ancho)} y1={Y(a.y) - m} x2={X(a.x + a.ancho)} y2={Y(a.y + a.alto) + m} {...props} />;
    default:
      return null;
  }
}

function relleno(tipo: TipoAmbiente) {
  switch (tipo) {
    case "estar":
      return "#ffffff";
    case "dormitorio":
      return "#f4f4f4";
    case "cocina":
    case "bano":
      return "#e9e9e9";
    case "paso":
    case "palier":
      return "#f0f0f0";
    case "escalera":
    case "ascensor":
      return "#e2e2e2";
    case "patio":
      return "url(#patio)";
    case "libre":
      return "#fdf0dd";
  }
}

function formatear(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

const contenedor = {
  display: "grid",
  gap: "8px",
  marginTop: "12px",
};

const lienzo = {
  width: "100%",
  maxWidth: "560px",
  height: "auto",
  display: "block",
};

const textoNombre = {
  fontSize: "10px",
  fill: "#111111",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontWeight: 600,
};

const textoMedida = {
  fontSize: "9px",
  fill: "#666666",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const textoCalle = {
  fontSize: "11px",
  fill: "#999999",
  fontFamily: "Arial, Helvetica, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const lista = {
  ...ui.note,
  margin: 0,
  paddingLeft: "18px",
};
