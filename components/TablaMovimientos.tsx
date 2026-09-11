"use client";

import Link from "next/link";
import ColumnaFiltrable from "@/components/ColumnaFiltrable";
import EtiquetaComprobante from "@/components/EtiquetaComprobante";
import * as ui from "@/components/ui";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { type ColumnaFiltro, useFiltrosDeColumna } from "@/lib/useFiltrosDeColumna";

export type FilaMovimiento = {
  id: string;
  fecha: string;
  entrada: boolean;
  etiqueta: string;
  detalle: string;
  quien: string;
  quienHref: string | null;
  ars: number;
  usd: number;
  href: string;
  tipoFactura: string | null;
  comprobanteDriveId: string | null;
};

const COLUMNAS: readonly ColumnaFiltro<FilaMovimiento>[] = [
  { clave: "movimiento", rotulo: "Movimiento", valorDe: (f) => f.etiqueta },
  { clave: "quien", rotulo: "Quién", valorDe: (f) => f.quien },
  {
    clave: "comprobante",
    rotulo: "Comprobante",
    valorDe: (f) =>
      f.entrada
        ? f.comprobanteDriveId
          ? "Comprobante"
          : "Sin comprobante"
        : f.tipoFactura
          ? `Factura ${f.tipoFactura}`
          : "Efectivo",
  },
];

/** "Movimientos" de Ingresos, con filtro estilo Excel en Movimiento, Quién y
 *  Comprobante. */
export default function TablaMovimientos({
  filas,
  volver,
}: {
  filas: FilaMovimiento[];
  volver: string;
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
            clave="movimiento"
            rotulo="Movimiento"
            opciones={opciones.movimiento}
            filtro={filtros.movimiento}
            abierto={abierto === "movimiento"}
            onAbrir={() => setAbierto("movimiento")}
            onCerrar={() => setAbierto(null)}
            onAlternar={(v) => alternar("movimiento", v)}
            onLimpiar={() => limpiar("movimiento")}
            onVaciar={() => vaciar("movimiento")}
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
          <ColumnaFiltrable
            clave="comprobante"
            rotulo="Comprobante"
            opciones={opciones.comprobante}
            filtro={filtros.comprobante}
            abierto={abierto === "comprobante"}
            onAbrir={() => setAbierto("comprobante")}
            onCerrar={() => setAbierto(null)}
            onAlternar={(v) => alternar("comprobante", v)}
            onLimpiar={() => limpiar("comprobante")}
            onVaciar={() => vaciar("comprobante")}
          />
          <th style={ui.thRight}>Pesos</th>
          <th style={ui.thRight}>Dólares</th>
          <th style={ui.th}></th>
        </tr>
      </thead>
      <tbody>
        {filtradas.length === 0 ? (
          <tr>
            <td colSpan={8} style={celdaVacia}>
              Ningún movimiento coincide con el filtro.
            </td>
          </tr>
        ) : (
          filtradas.map((mov) => (
            <tr key={mov.id}>
              <td style={{ ...ui.td, ...compacta }}>{formatDate(mov.fecha)}</td>
              <td style={{ ...ui.td, ...compacta }}>
                <span style={mov.entrada ? tagEntrada : tagSalida}>
                  {mov.etiqueta}
                </span>
              </td>
              <td style={ui.td}>
                {mov.quienHref ? (
                  <Link href={mov.quienHref} style={quienLink}>
                    {mov.quien}
                  </Link>
                ) : (
                  mov.quien
                )}
              </td>
              <td style={ui.td}>{mov.detalle}</td>
              <td style={{ ...ui.td, ...compacta }}>
                {mov.entrada ? (
                  mov.comprobanteDriveId ? (
                    <Link
                      href={`/ver/${mov.comprobanteDriveId}?volver=${encodeURIComponent(volver)}`}
                      style={comprobanteLink}
                    >
                      Comprobante
                    </Link>
                  ) : (
                    <span style={{ color: "#bbbbbb" }}>—</span>
                  )
                ) : (
                  <EtiquetaComprobante
                    tipoFactura={mov.tipoFactura}
                    driveId={mov.comprobanteDriveId}
                    volver={volver}
                  />
                )}
              </td>
              <td style={ui.tdRight}>
                {mov.ars === 0 ? (
                  <span style={{ color: "#bbbbbb" }}>—</span>
                ) : (
                  `${mov.ars > 0 ? "+" : "−"} ${formatMoney(Math.abs(mov.ars))}`
                )}
              </td>
              <td style={ui.tdRight}>
                {mov.usd === 0 ? (
                  <span style={{ color: "#bbbbbb" }}>—</span>
                ) : (
                  `${mov.usd > 0 ? "+" : "−"} ${formatUSD(Math.abs(mov.usd))}`
                )}
              </td>
              <td style={ui.td}>
                <Link href={mov.href} style={editarLink}>
                  Editar
                </Link>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

const tagBase = {
  display: "inline-block",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tagEntrada = {
  ...tagBase,
  background: "#f2f2f2",
  color: "#555555",
};

const tagSalida = {
  ...tagBase,
  border: "1px solid #e5e5e5",
  color: "#777777",
};

const compacta = { whiteSpace: "nowrap" as const };

const editarLink = {
  color: "#111111",
  fontSize: "14px",
  textDecoration: "underline",
};

const quienLink = {
  color: "#111111",
  textDecoration: "underline",
};

const comprobanteLink = {
  color: "#333333",
  textDecoration: "underline",
  fontSize: "13px",
};

const celdaVacia = {
  ...ui.td,
  textAlign: "center" as const,
  color: "#999999",
  padding: "24px 12px",
};
