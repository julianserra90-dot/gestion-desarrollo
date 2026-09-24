"use client";

import { useState } from "react";
import type { Frente, Punto } from "@/lib/geometria";
import { ALTURA_PB_M, ALTURA_PISO_M } from "@/lib/prefactibilidad";

/**
 * El volumen que la normativa deja construir, en tres dimensiones: el lote
 * en el piso, la huella edificable levantada hasta la altura máxima con una
 * línea por planta, y el plano límite punteado si está más arriba.
 *
 * Es geometría a secas, sin librería ni modelo: se proyectan los puntos
 * (giro alrededor de la vertical más una inclinación fija) y se pintan las
 * caras de atrás hacia adelante. Se gira arrastrando, porque una sola vista
 * esconde siempre un lado.
 */
export default function VolumenLote({
  lote,
  huella,
  frente,
  alturaMaxima,
  planoLimite,
  plantasSobrePb,
  etiquetaFrente,
  etiquetaProfundidad,
}: {
  lote: Punto[];
  huella: Punto[];
  frente: Frente;
  alturaMaxima: number | null;
  planoLimite: number | null;
  plantasSobrePb: number | null;
  etiquetaFrente?: string;
  etiquetaProfundidad?: string;
}) {
  const [azimut, setAzimut] = useState(-35);
  const [arrastre, setArrastre] = useState<{ x: number; azimut: number } | null>(null);

  const altura = alturaMaxima ?? 0;
  const elevacion = (28 * Math.PI) / 180;
  const giro = (azimut * Math.PI) / 180;

  // Proyección: giro alrededor de la vertical, inclinación fija, y la
  // pantalla mira hacia abajo en y.
  const proyectar = (p: Punto, z: number) => {
    const x = p.x * Math.cos(giro) - p.y * Math.sin(giro);
    const y = p.x * Math.sin(giro) + p.y * Math.cos(giro);
    return { x, y: -(y * Math.sin(elevacion) + z * Math.cos(elevacion)), prof: y };
  };

  const alturaTecho = Math.max(altura, planoLimite ?? 0, 3);
  const todos = [
    ...lote.map((p) => proyectar(p, 0)),
    ...huella.map((p) => proyectar(p, alturaTecho)),
  ];
  const minX = Math.min(...todos.map((p) => p.x));
  const maxX = Math.max(...todos.map((p) => p.x));
  const minY = Math.min(...todos.map((p) => p.y));
  const maxY = Math.max(...todos.map((p) => p.y));
  const ANCHO = 560;
  const ALTO = 360;
  const MARGEN = 44;
  const escala = Math.min(
    (ANCHO - 2 * MARGEN) / Math.max(maxX - minX, 1),
    (ALTO - 2 * MARGEN) / Math.max(maxY - minY, 1)
  );
  const aPantalla = (p: { x: number; y: number }) => ({
    x: MARGEN + (p.x - minX) * escala + ((ANCHO - 2 * MARGEN) - (maxX - minX) * escala) / 2,
    y: MARGEN + (p.y - minY) * escala + ((ALTO - 2 * MARGEN) - (maxY - minY) * escala) / 2,
  });
  const camino = (puntos: { x: number; y: number }[]) =>
    puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  // Las caras laterales del prisma: una por lado de la huella, ordenadas de
  // atrás hacia adelante para que las de adelante tapen a las de atrás.
  const horario = sentidoHorario(huella);
  const caras = huella.map((p, i) => {
    const q = huella[(i + 1) % huella.length];
    const base = [proyectar(p, 0), proyectar(q, 0), proyectar(q, altura), proyectar(p, altura)];
    // Visible si, mirada desde la cámara, la cara gira en el sentido que
    // corresponde a una normal hacia afuera.
    const a = base[0];
    const b = base[1];
    const c = base[3];
    const orientacion = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return {
      lado: [p, q] as [Punto, Punto],
      puntos: base.map(aPantalla),
      profundidad: (base[0].prof + base[1].prof) / 2,
      visible: orientacion < 0 === horario,
    };
  });
  caras.sort((u, v) => v.profundidad - u.profundidad);

  // Una línea por planta, sobre las caras visibles: PB de 3,4 m y pisos de
  // 2,8, hasta la altura máxima.
  const niveles: number[] = [];
  if (altura > 0) {
    for (let z = ALTURA_PB_M; z < altura - 0.3; z += ALTURA_PISO_M) niveles.push(z);
  }

  const frenteA = aPantalla(proyectar(frente.a, 0));
  const frenteB = aPantalla(proyectar(frente.b, 0));
  const medioFrente = { x: (frenteA.x + frenteB.x) / 2, y: (frenteA.y + frenteB.y) / 2 };
  // "Calle" del lado de afuera del frente: el opuesto al centro del lote.
  const centroLote = aPantalla(proyectar(centro(lote), 0));
  const haciaAfuera = normalizar({ x: medioFrente.x - centroLote.x, y: medioFrente.y - centroLote.y });
  // Acotada al lienzo: con el frente contra un borde, el texto se cortaba.
  const calle = {
    x: Math.min(ANCHO - 80, Math.max(80, medioFrente.x + haciaAfuera.x * 22)),
    y: Math.min(ALTO - 10, Math.max(12, medioFrente.y + haciaAfuera.y * 22 + 4)),
  };

  const tope = altura > 0 ? huella.map((p) => aPantalla(proyectar(p, altura))) : null;
  const limite =
    planoLimite && planoLimite > altura + 0.05
      ? huella.map((p) => aPantalla(proyectar(p, planoLimite)))
      : null;

  // La altura se acota sobre la arista vertical más a la derecha en pantalla.
  const aristaAltura = altura > 0 ? huella
    .map((p) => ({ base: aPantalla(proyectar(p, 0)), tope: aPantalla(proyectar(p, altura)) }))
    .reduce((mejor, e) => (e.base.x > mejor.base.x ? e : mejor)) : null;

  return (
    <div style={contenedor}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        style={{ ...lienzo, cursor: arrastre ? "grabbing" : "grab" }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setArrastre({ x: e.clientX, azimut });
        }}
        onPointerMove={(e) => {
          if (arrastre) setAzimut(arrastre.azimut + (e.clientX - arrastre.x) * 0.6);
        }}
        onPointerUp={() => setArrastre(null)}
        onPointerLeave={() => setArrastre(null)}
      >
        {/* El lote en el piso. */}
        <path d={camino(lote.map((p) => aPantalla(proyectar(p, 0))))} fill="#f2f2f2" stroke="#9a9a9a" strokeWidth={1} />

        {/* La huella en el piso, más oscura: lo que queda afuera es lo que la LFI deja libre. */}
        <path d={camino(huella.map((p) => aPantalla(proyectar(p, 0))))} fill="#e0e0e0" stroke="#666666" strokeWidth={1} />

        {/* Caras del prisma, de atrás hacia adelante. Las de atrás también se
            pintan, más claras, para que el volumen no quede hueco al girar. */}
        {altura > 0 &&
          caras.map((cara, i) => (
            <g key={i}>
              <path
                d={camino(cara.puntos)}
                fill={cara.visible ? "#ffffff" : "#f7f7f7"}
                fillOpacity={cara.visible ? 0.96 : 0.6}
                stroke="#111111"
                strokeWidth={cara.visible ? 1.2 : 0.6}
                strokeOpacity={cara.visible ? 1 : 0.35}
              />
              {cara.visible &&
                niveles.map((z) => {
                  const a = aPantalla(proyectar(cara.lado[0], z));
                  const b = aPantalla(proyectar(cara.lado[1], z));
                  return (
                    <line key={z} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#bbbbbb" strokeWidth={0.8} />
                  );
                })}
            </g>
          ))}

        {/* El techo. */}
        {tope && <path d={camino(tope)} fill="#dcdcdc" stroke="#111111" strokeWidth={1.2} />}

        {/* El plano límite, punteado, si está más arriba que la altura máxima. */}
        {limite && (
          <g stroke="#b91c1c" strokeWidth={0.9} strokeDasharray="4 3" fill="none">
            <path d={camino(limite)} />
            {huella.map((p, i) => {
              const a = aPantalla(proyectar(p, altura));
              const b = aPantalla(proyectar(p, planoLimite ?? altura));
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
            })}
          </g>
        )}

        {/* El frente, con la calle en la misma etiqueta: dos textos sobre
            el mismo lado se pisaban según el ángulo. */}
        <text x={calle.x} y={calle.y} textAnchor="middle" dominantBaseline="middle" style={textoCalle}>
          {etiquetaFrente ? `calle · ${etiquetaFrente}` : "calle"}
        </text>

        {/* Cotas: altura y plantas al lado de una arista —del lado que tenga
            lugar—; profundidad edificable al pie. */}
        {aristaAltura && (
          <text
            x={aristaAltura.tope.x + (aristaAltura.tope.x > ANCHO - 110 ? -8 : 8)}
            y={(aristaAltura.tope.y + aristaAltura.base.y) / 2}
            textAnchor={aristaAltura.tope.x > ANCHO - 110 ? "end" : "start"}
            style={textoCota}
          >
            {formatear(altura)} m{plantasSobrePb !== null ? ` · PB + ${plantasSobrePb}` : ""}
          </text>
        )}
        {etiquetaProfundidad && (
          <text x={ANCHO - MARGEN + 30} y={ALTO - 14} textAnchor="end" style={textoCota}>
            {etiquetaProfundidad}
          </text>
        )}
        {limite && planoLimite && (
          <text x={MARGEN - 30} y={MARGEN - 14} style={{ ...textoCota, fill: "#b91c1c" }}>
            plano límite {formatear(planoLimite)} m
          </text>
        )}
      </svg>
      <p style={ayuda}>Arrastrá para girar.</p>
    </div>
  );
}

function sentidoHorario(poligono: Punto[]) {
  let suma = 0;
  for (let i = 0; i < poligono.length; i++) {
    const p = poligono[i];
    const q = poligono[(i + 1) % poligono.length];
    suma += (q.x - p.x) * (q.y + p.y);
  }
  return suma > 0;
}

function centro(poligono: Punto[]): Punto {
  return {
    x: poligono.reduce((s, p) => s + p.x, 0) / poligono.length,
    y: poligono.reduce((s, p) => s + p.y, 0) / poligono.length,
  };
}

function normalizar(v: { x: number; y: number }) {
  const largo = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / largo, y: v.y / largo };
}

function formatear(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

const contenedor = {
  display: "grid",
  gap: "8px",
};

const lienzo = {
  width: "100%",
  maxWidth: "560px",
  height: "auto",
  display: "block",
  touchAction: "none" as const,
  userSelect: "none" as const,
};

const textoCota = {
  fontSize: "11px",
  fill: "#555555",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const textoCalle = {
  fontSize: "11px",
  fill: "#999999",
  fontFamily: "Arial, Helvetica, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const ayuda = {
  margin: 0,
  fontSize: "12px",
  color: "#999999",
};
