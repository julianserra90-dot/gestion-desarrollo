"use client";

import ColumnaFiltrable from "@/components/ColumnaFiltrable";
import EtiquetaComprobante from "@/components/EtiquetaComprobante";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { type ColumnaFiltro, useFiltrosDeColumna } from "@/lib/useFiltrosDeColumna";

export type FilaPagoProveedor = {
  id: string;
  fecha: string;
  rubro: string;
  tipo: string;
  detalle: string | null;
  tipoFactura: string | null;
  comprobanteDriveId: string | null;
  pago: string;
  monto: number;
};

const COLUMNAS: readonly ColumnaFiltro<FilaPagoProveedor>[] = [
  { clave: "rubro", rotulo: "Rubro", valorDe: (f) => f.rubro },
  { clave: "tipo", rotulo: "Tipo", valorDe: (f) => f.tipo },
  {
    clave: "comprobante",
    rotulo: "Comprobante",
    valorDe: (f) => (f.tipoFactura ? `Factura ${f.tipoFactura}` : "Efectivo"),
  },
  { clave: "pago", rotulo: "Pagó", valorDe: (f) => f.pago },
];

/** "Pagos" de la cuenta corriente de un proveedor, con filtro estilo Excel
 *  en Rubro, Tipo, Comprobante y Pagó. El total del pie sigue al filtro. */
export default function TablaPagosProveedor({
  filas,
  volverHref,
}: {
  filas: FilaPagoProveedor[];
  volverHref: string;
}) {
  const { opciones, filtros, abierto, setAbierto, alternar, limpiar, vaciar, coincide } =
    useFiltrosDeColumna(filas, COLUMNAS);

  const filtradas = filas.filter(coincide);
  const totalFiltrado = filtradas.reduce((acc, f) => acc + f.monto, 0);

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
          <ColumnaFiltrable
            clave="tipo"
            rotulo="Tipo"
            opciones={opciones.tipo}
            filtro={filtros.tipo}
            abierto={abierto === "tipo"}
            onAbrir={() => setAbierto("tipo")}
            onCerrar={() => setAbierto(null)}
            onAlternar={(v) => alternar("tipo", v)}
            onLimpiar={() => limpiar("tipo")}
            onVaciar={() => vaciar("tipo")}
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
            <td colSpan={7} style={celdaVacia}>
              Ningún pago coincide con el filtro.
            </td>
          </tr>
        ) : (
          filtradas.map((f) => (
            <tr key={f.id}>
              <td style={ui.td}>{formatDate(f.fecha)}</td>
              <td style={ui.td}>{f.rubro}</td>
              <td style={ui.td}>{f.tipo}</td>
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
      <tfoot>
        <tr>
          <td style={tdTotal} colSpan={6}>
            Total pagado
          </td>
          <td style={tdTotalRight}>{formatMoney(totalFiltrado)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

const tdTotal = {
  padding: "14px 12px",
  borderTop: "2px solid #111111",
  color: "#111111",
  fontWeight: 600,
};

const tdTotalRight = {
  ...tdTotal,
  textAlign: "right" as const,
};

const celdaVacia = {
  ...ui.td,
  textAlign: "center" as const,
  color: "#999999",
  padding: "24px 12px",
};
