import Link from "next/link";
import { formatMetros, formatNivel } from "@/lib/format";
import { nombreDePiso, type Piso } from "@/lib/pisos";

/**
 * El edificio de costado, en chiquito: los niveles de la definición de pisos
 * como cajas apiladas, cada una con su altura de piso a piso y un poco de
 * profundidad para que se lea como volumen.
 *
 * Va en una tarjeta como las de Plantas y Pisos, del mismo alto: el dibujo es
 * sutil y sin textos adentro. Lo de cada piso —nombre, nivel, altura y
 * planta— aparece al pasar el mouse, y un piso con planta se toca para
 * abrirla. Uno sin planta va punteado.
 */
export default function EsquemaDeNiveles({
  pisos,
  plantas,
  rutaDePlantas,
}: {
  pisos: Piso[];
  plantas: { id: string; nombre: string }[];
  /** `/obras/<obra>/plantas`: cada piso con planta abre la suya. */
  rutaDePlantas: string;
}) {
  if (pisos.length === 0) return null;

  // De abajo hacia arriba.
  const enOrden = [...pisos].sort((a, b) => a.cota - b.cota);
  const piso0 = enOrden[0].cota;
  const techo = Math.max(...enOrden.map((p) => p.cota + p.altura));
  const alto = Math.max(techo - piso0, 0.01);
  const nombreDePlanta = new Map(plantas.map((p) => [p.id, p.nombre]));

  // Del alto de lo que dice una tarjeta: el rótulo y el número.
  const ancho = 30;
  const fondo = 8;
  const altoDelEdificio = 40;
  const escala = altoDelEdificio / alto;
  const y = (cota: number) => fondo + (techo - cota) * escala;
  const anchoDibujo = ancho + fondo + 2;
  const altoDibujo = fondo + altoDelEdificio + 2;

  return (
    <svg
      viewBox={`-1 0 ${anchoDibujo} ${altoDibujo}`}
      width={anchoDibujo}
      height={altoDibujo}
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
      role="img"
      aria-label="Niveles del edificio"
    >
      {enOrden.map((piso) => {
        const base = y(piso.cota);
        const tope = y(piso.cota + piso.altura);
        const conPlanta = piso.plantaId !== null;
        const trazo = conPlanta ? "#3d3a35" : "#b4afa6";
        const punteado = conPlanta ? undefined : "2 2";
        const nombre = piso.plantaId ? nombreDePlanta.get(piso.plantaId) ?? "Planta" : "sin planta";
        const caja = (
          <g>
            <title>{`${nombreDePiso(piso)} · ${formatNivel(piso.cota)} · ${formatMetros(piso.altura)} · ${nombre}`}</title>
            <polygon
              points={`${ancho},${tope} ${ancho + fondo},${tope - fondo} ${ancho + fondo},${base - fondo} ${ancho},${base}`}
              fill={conPlanta ? "#e9e5dd" : "#f7f6f3"}
              stroke={trazo}
              strokeWidth={0.7}
              strokeDasharray={punteado}
            />
            <polygon
              points={`0,${tope} ${fondo},${tope - fondo} ${ancho + fondo},${tope - fondo} ${ancho},${tope}`}
              fill={conPlanta ? "#f3f0ea" : "#fbfaf8"}
              stroke={trazo}
              strokeWidth={0.7}
              strokeDasharray={punteado}
            />
            <rect
              x={0}
              y={tope}
              width={ancho}
              height={Math.max(base - tope, 0.5)}
              fill={conPlanta ? "#fbfaf7" : "#ffffff"}
              stroke={trazo}
              strokeWidth={0.8}
              strokeDasharray={punteado}
            />
          </g>
        );
        return piso.plantaId ? (
          <Link key={piso.numero} href={`${rutaDePlantas}/${piso.plantaId}`}>
            {caja}
          </Link>
        ) : (
          <g key={piso.numero}>{caja}</g>
        );
      })}
    </svg>
  );
}
