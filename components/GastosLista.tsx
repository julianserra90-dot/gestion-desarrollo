"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BotonDescarga from "@/components/BotonDescarga";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";

export type GastoFila = {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  montoCaja: number;
  iva: number;
  tipoFactura: string | null;
  tipoGasto: string;
  tipoPago: string | null;
  estado: string;
  comprobanteDriveId: string | null;
  rubro: string | null;
  proveedor: string | null;
  pagadora: string | null;
  receptora: string | null;
  compartido: boolean;
};

export default function GastosLista({
  gastos,
  slug,
}: {
  gastos: GastoFila[];
  slug: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [rubro, setRubro] = useState("");
  const [ocultarAnulados, setOcultarAnulados] = useState(false);

  const rubros = useMemo(
    () =>
      Array.from(new Set(gastos.map((g) => g.rubro).filter(Boolean))).sort() as string[],
    [gastos]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return gastos.filter((g) => {
      if (rubro && g.rubro !== rubro) return false;
      if (ocultarAnulados && g.estado === "Anulado") return false;
      if (!q) return true;

      // Un solo texto busca en todo lo que se ve de un gasto.
      const quien = g.compartido ? "entre las socias" : g.pagadora ?? "";
      const campos = [
        g.concepto,
        g.rubro,
        g.proveedor,
        quien,
        g.receptora,
        g.tipoGasto,
        g.tipoFactura ? `factura ${g.tipoFactura}` : g.tipoPago,
        formatDate(g.fecha),
        String(g.monto),
      ];

      return campos.some((c) => c?.toLowerCase().includes(q));
    });
  }, [gastos, busqueda, rubro, ocultarAnulados]);

  return (
    <section style={ui.panel}>
      {gastos.length > 0 && (
        <div style={barra}>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por concepto, proveedor, quién pagó…"
            style={{ ...ui.input, flex: "1 1 240px" }}
          />

          <select
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            style={{ ...ui.input, flex: "0 0 auto" }}
          >
            <option value="">Todos los rubros</option>
            {rubros.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <label style={toggle}>
            <input
              type="checkbox"
              checked={ocultarAnulados}
              onChange={(e) => setOcultarAnulados(e.target.checked)}
            />
            Ocultar anulados
          </label>
        </div>
      )}

      {gastos.length === 0 ? (
        <p style={ui.vacio}>Todavía no hay gastos cargados en esta obra.</p>
      ) : filtrados.length === 0 ? (
        <p style={ui.vacio}>Ningún gasto coincide con la búsqueda.</p>
      ) : (
        <>
          <p style={contador}>
            {filtrados.length}{" "}
            {filtrados.length === 1 ? "gasto" : "gastos"}
            {(busqueda || rubro || ocultarAnulados) &&
              ` de ${gastos.length}`}
          </p>

          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Rubro</th>
                <th style={ui.th}>Tipo</th>
                <th style={ui.th}>Proveedor / Contratista</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.th}>Comprobante</th>
                <th style={ui.th}>Pagó</th>
                <th style={ui.th}>Comprob.</th>
                <th style={ui.thRight}>Monto</th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((gasto) => {
                const anulado = gasto.estado === "Anulado";
                const ajuste = gasto.tipoGasto === "Ajuste de saldo";
                const celda = anulado ? tdAnulado : ajuste ? tdAjuste : ui.td;

                return (
                  <tr
                    key={gasto.id}
                    style={ajuste && !anulado ? filaAjuste : undefined}
                  >
                    <td style={celda}>{formatDate(gasto.fecha)}</td>
                    <td style={celda}>{gasto.rubro ?? "—"}</td>
                    <td style={celda}>
                      {ajuste ? (
                        <span style={tagAjuste}>Ajuste de saldo</span>
                      ) : (
                        gasto.tipoGasto
                      )}
                    </td>
                    <td style={celda}>
                      {ajuste
                        ? `→ ${gasto.receptora ?? "—"}`
                        : gasto.proveedor ?? "—"}
                    </td>
                    <td style={celda}>
                      {gasto.concepto}
                      {anulado && <span style={tagAnulado}>Anulado</span>}
                    </td>
                    <td style={celda}>
                      {ajuste ? (
                        "—"
                      ) : (
                        <span
                          style={
                            gasto.tipoPago === "Efectivo"
                              ? tagEfectivo
                              : tagFacturado
                          }
                        >
                          {gasto.tipoFactura
                            ? `Factura ${gasto.tipoFactura}`
                            : "Efectivo"}
                        </span>
                      )}
                    </td>
                    <td style={celda}>
                      {gasto.compartido ? (
                        "Entre las socias"
                      ) : gasto.montoCaja >= gasto.monto ? (
                        <span style={tagCuenta}>Dinero en cuenta</span>
                      ) : gasto.montoCaja > 0 ? (
                        <>
                          {gasto.pagadora ?? "—"}
                          <div style={aporteCuenta}>
                            + {formatMoney(gasto.montoCaja)} de la cuenta
                          </div>
                        </>
                      ) : (
                        gasto.pagadora ?? "—"
                      )}
                    </td>
                    <td style={celda}>
                      {gasto.comprobanteDriveId ? (
                        <div style={accionesArchivo}>
                          <Link
                            href={`/ver/${gasto.comprobanteDriveId}?volver=${encodeURIComponent(
                              `/obras/${slug}/gastos`
                            )}`}
                            style={comprobanteLink}
                          >
                            Ver
                          </Link>
                          <BotonDescarga
                            fileId={gasto.comprobanteDriveId}
                            variante="icono"
                            etiqueta={`Descargar comprobante de ${gasto.concepto}`}
                          />
                        </div>
                      ) : (
                        <span style={{ color: "#bbbbbb" }}>—</span>
                      )}
                    </td>
                    <td style={anulado ? tdAnuladoRight : ui.tdRight}>
                      <strong>{formatMoney(gasto.monto)}</strong>
                      {gasto.iva > 0 && (
                        <div style={ivaChico}>IVA {formatMoney(gasto.iva)}</div>
                      )}
                    </td>
                    <td style={celda}>
                      <Link
                        href={`/obras/${slug}/gastos/${gasto.id}/editar`}
                        style={editarLink}
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

const barra = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "12px",
  alignItems: "center",
  marginBottom: "20px",
};

const toggle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "14px",
  color: "#555555",
  whiteSpace: "nowrap" as const,
};

const contador = {
  fontSize: "13px",
  color: "#999999",
  margin: "0 0 12px",
};

const accionesArchivo = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const filaAjuste = { background: "#fafafa" };

const tdAjuste = { ...ui.td, borderBottom: "1px solid #e0e0e0" };

const tagAjuste = {
  border: "1px solid #111111",
  background: "#111111",
  color: "#ffffff",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tagCuenta = {
  border: "1px solid #dcdcdc",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const aporteCuenta = {
  fontSize: "13px",
  color: "#999999",
  marginTop: "4px",
};

const tdAnulado = {
  ...ui.td,
  color: "#aaaaaa",
  textDecoration: "line-through" as const,
};

const tdAnuladoRight = { ...tdAnulado, textAlign: "right" as const };

const tagAnulado = {
  marginLeft: "8px",
  border: "1px solid #aaaaaa",
  color: "#aaaaaa",
  padding: "2px 6px",
  fontSize: "11px",
  textDecoration: "none" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const editarLink = {
  color: "#111111",
  fontSize: "14px",
  textDecoration: "underline",
};

const ivaChico = { fontSize: "12px", color: "#999999", marginTop: "4px" };

const tagFacturado = {
  border: "1px solid #dcdcdc",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tagEfectivo = {
  ...tagFacturado,
  border: "1px solid #111111",
  background: "#111111",
  color: "#ffffff",
};

const comprobanteLink = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
};
