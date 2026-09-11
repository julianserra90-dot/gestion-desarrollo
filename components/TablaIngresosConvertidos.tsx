"use client";

import ColumnaFiltrable from "@/components/ColumnaFiltrable";
import * as ui from "@/components/ui";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { type ColumnaFiltro, useFiltrosDeColumna } from "@/lib/useFiltrosDeColumna";

export type FilaIngresoConvertido = {
  id: string;
  fecha: string;
  origen: string;
  quien: string;
  detalle: string;
  montoArs: number;
  cargadoEnDolares: boolean;
  cotizacion: number | null;
  usd: number | null;
};

const COLUMNAS: readonly ColumnaFiltro<FilaIngresoConvertido>[] = [
  { clave: "origen", rotulo: "Origen", valorDe: (f) => f.origen },
  { clave: "quien", rotulo: "Quién", valorDe: (f) => f.quien },
];

/** "Ingresos convertidos" de Dólares, con filtro estilo Excel en Origen y Quién. */
export default function TablaIngresosConvertidos({
  filas,
}: {
  filas: FilaIngresoConvertido[];
}) {
  const { opciones, filtros, abierto, setAbierto, alternar, limpiar, vaciar, coincide } =
    useFiltrosDeColumna(filas, COLUMNAS);

  const filtradas = filas.filter(coincide);

  return (
    <table style={ui.table}>
      <thead>
        <tr>
          <th style={ui.th}>Fecha</th>
          <ColumnaFiltrable
            clave="origen"
            rotulo="Origen"
            opciones={opciones.origen}
            filtro={filtros.origen}
            abierto={abierto === "origen"}
            onAbrir={() => setAbierto("origen")}
            onCerrar={() => setAbierto(null)}
            onAlternar={(v) => alternar("origen", v)}
            onLimpiar={() => limpiar("origen")}
            onVaciar={() => vaciar("origen")}
          />
          <ColumnaFiltrable
            clave="quien"
            rotulo="Quién"
            opciones={opciones.quien}
            filtro={filtros.quien}
            abierto={abierto === "quien"}
            onAbrir={() => setAbierto("quien")}
            onCerrar={() => setAbierto(null)}
            onAlternar={(v) => alternar("quien", v)}
            onLimpiar={() => limpiar("quien")}
            onVaciar={() => vaciar("quien")}
          />
          <th style={ui.th}>Detalle</th>
          <th style={ui.thRight}>Monto</th>
          <th style={ui.thRight}>Dólar del día</th>
          <th style={ui.thRight}>En dólares</th>
        </tr>
      </thead>
      <tbody>
        {filtradas.length === 0 ? (
          <tr>
            <td colSpan={6} style={celdaVacia}>
              Ningún ingreso coincide con el filtro.
            </td>
          </tr>
        ) : (
          filtradas.map((ingreso) => (
            <tr key={ingreso.id}>
              <td style={ui.td}>{formatDate(ingreso.fecha)}</td>
              <td style={ui.td}>{ingreso.origen}</td>
              <td style={ui.td}>{ingreso.quien}</td>
              <td style={ui.td}>{ingreso.detalle}</td>
              <td style={ui.tdRight}>
                {formatMoney(ingreso.montoArs)}
                {ingreso.cargadoEnDolares && (
                  <span style={tagMoneda}>cargado en USD</span>
                )}
              </td>
              <td style={ui.tdRight}>
                {ingreso.cotizacion ? formatMoney(ingreso.cotizacion) : "—"}
              </td>
              <td style={ui.tdRight}>
                <strong>{formatUSD(ingreso.usd)}</strong>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

const tagMoneda = {
  display: "block",
  fontSize: "11px",
  color: "#999999",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  marginTop: "2px",
};

const celdaVacia = {
  ...ui.td,
  textAlign: "center" as const,
  color: "#999999",
  padding: "24px 12px",
};
