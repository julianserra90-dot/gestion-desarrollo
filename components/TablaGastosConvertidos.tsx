"use client";

import ColumnaFiltrable from "@/components/ColumnaFiltrable";
import * as ui from "@/components/ui";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { type ColumnaFiltro, useFiltrosDeColumna } from "@/lib/useFiltrosDeColumna";

export type FilaGastoConvertido = {
  id: string;
  fecha: string;
  rubro: string;
  detalle: string | null;
  empresa: string;
  usdDeCajaVisible: number | null;
  montoArs: number;
  cargadoEnDolares: boolean;
  cotizacion: number | null;
  usd: number | null;
};

const COLUMNAS: readonly ColumnaFiltro<FilaGastoConvertido>[] = [
  { clave: "rubro", rotulo: "Rubro", valorDe: (f) => f.rubro },
  { clave: "pago", rotulo: "Pagó", valorDe: (f) => f.empresa },
];

/** "Gastos convertidos" de Dólares, con filtro estilo Excel en Rubro y Pagó. */
export default function TablaGastosConvertidos({
  filas,
}: {
  filas: FilaGastoConvertido[];
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
            clave="rubro"
            rotulo="Rubro"
            opciones={opciones.rubro}
            filtro={filtros.rubro}
            abierto={abierto === "rubro"}
            onAbrir={() => setAbierto("rubro")}
            onCerrar={() => setAbierto(null)}
            onAlternar={(v) => alternar("rubro", v)}
            onLimpiar={() => limpiar("rubro")}
            onVaciar={() => vaciar("rubro")}
          />
          <th style={ui.th}>Detalle</th>
          <ColumnaFiltrable
            clave="pago"
            rotulo="Pagó"
            opciones={opciones.pago}
            filtro={filtros.pago}
            abierto={abierto === "pago"}
            onAbrir={() => setAbierto("pago")}
            onCerrar={() => setAbierto(null)}
            onAlternar={(v) => alternar("pago", v)}
            onLimpiar={() => limpiar("pago")}
            onVaciar={() => vaciar("pago")}
          />
          <th style={ui.thRight}>Monto</th>
          <th style={ui.thRight}>Dólar del día</th>
          <th style={ui.thRight}>En dólares</th>
        </tr>
      </thead>
      <tbody>
        {filtradas.length === 0 ? (
          <tr>
            <td colSpan={7} style={celdaVacia}>
              Ningún gasto coincide con el filtro.
            </td>
          </tr>
        ) : (
          filtradas.map((gasto) => (
            <tr key={gasto.id}>
              <td style={ui.td}>{formatDate(gasto.fecha)}</td>
              <td style={ui.td}>{gasto.rubro}</td>
              <td style={ui.td}>{gasto.detalle}</td>
              <td style={ui.td}>
                {gasto.empresa}
                {gasto.usdDeCajaVisible !== null && (
                  <span style={tagMoneda}>
                    + {formatUSD(gasto.usdDeCajaVisible)} de la cuenta
                  </span>
                )}
              </td>
              <td style={ui.tdRight}>
                {formatMoney(gasto.montoArs)}
                {gasto.cargadoEnDolares && (
                  <span style={tagMoneda}>cargado en USD</span>
                )}
              </td>
              <td style={ui.tdRight}>
                {gasto.cotizacion ? formatMoney(gasto.cotizacion) : "—"}
              </td>
              <td style={ui.tdRight}>
                <strong>{formatUSD(gasto.usd)}</strong>
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
