"use client";

import Link from "next/link";
import ColumnaFiltrable from "@/components/ColumnaFiltrable";
import EtiquetaComprobante from "@/components/EtiquetaComprobante";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { type ColumnaFiltro, useFiltrosDeColumna } from "@/lib/useFiltrosDeColumna";

export type FilaGastoRubro = {
  id: string;
  fecha: string;
  destino: string;
  destinoHref: string | null;
  detalle: string | null;
  tipoFactura: string | null;
  comprobanteDriveId: string | null;
  pago: string;
  monto: number;
};

const COLUMNAS: readonly ColumnaFiltro<FilaGastoRubro>[] = [
  { clave: "destino", rotulo: "Destino", valorDe: (f) => f.destino },
  {
    clave: "comprobante",
    rotulo: "Comprobante",
    valorDe: (f) => (f.tipoFactura ? `Factura ${f.tipoFactura}` : "Efectivo"),
  },
  { clave: "pago", rotulo: "Pagó", valorDe: (f) => f.pago },
];

/** La tabla de un bloque de "Detalle por rubro", con las mismas columnas
 *  filtrables que Gastos (menos Rubro y Tipo, que acá ya son fijos). */
export default function TablaGastosRubro({
  filas,
  volverHref,
}: {
  filas: FilaGastoRubro[];
  volverHref: string;
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
            clave="destino"
            rotulo="Destino"
            opciones={opciones.destino}
            filtro={filtros.destino}
            abierto={abierto === "destino"}
            onAbrir={() => setAbierto("destino")}
            onCerrar={() => setAbierto(null)}
            onAlternar={(v) => alternar("destino", v)}
            onLimpiar={() => limpiar("destino")}
            onVaciar={() => vaciar("destino")}
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
        </tr>
      </thead>
      <tbody>
        {filtradas.length === 0 ? (
          <tr>
            <td colSpan={6} style={celdaVacia}>
              Ningún gasto coincide con el filtro.
            </td>
          </tr>
        ) : (
          filtradas.map((f) => (
            <tr key={f.id}>
              <td style={ui.td}>{formatDate(f.fecha)}</td>
              <td style={ui.td}>
                {f.destinoHref ? (
                  <Link href={f.destinoHref} style={enlace}>
                    {f.destino}
                  </Link>
                ) : (
                  f.destino
                )}
              </td>
              <td style={ui.td}>{f.detalle}</td>
              <td style={ui.td}>
                <EtiquetaComprobante
                  tipoFactura={f.tipoFactura}
                  driveId={f.comprobanteDriveId}
                  volver={volverHref}
                />
              </td>
              <td style={ui.td}>{f.pago}</td>
              <td style={ui.tdRight}>
                <strong>{formatMoney(f.monto)}</strong>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};

const celdaVacia = {
  ...ui.td,
  textAlign: "center" as const,
  color: "#999999",
  padding: "24px 12px",
};
