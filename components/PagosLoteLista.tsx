"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as ui from "@/components/ui";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";

export type PagoFila = {
  id: string;
  fecha: string;
  categoria: string;
  concepto: string;
  monto: number;
  moneda: "ARS" | "USD";
  usd: number | null;
  empresa: string | null;
  compartido: boolean;
};

export default function PagosLoteLista({
  pagos,
  slug,
  obraId,
  eliminar,
}: {
  pagos: PagoFila[];
  slug: string;
  obraId: string;
  eliminar: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return pagos;

    return pagos.filter((p) => {
      const quien = p.compartido ? "entre las socias" : p.empresa ?? "";
      const campos = [
        p.concepto,
        p.categoria,
        quien,
        formatDate(p.fecha),
        String(p.monto),
      ];
      return campos.some((c) => c?.toLowerCase().includes(q));
    });
  }, [pagos, busqueda]);

  if (pagos.length === 0) {
    return (
      <p style={ui.vacio}>Todavía no se cargó ningún pago del lote.</p>
    );
  }

  return (
    <>
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por concepto, tipo, quién pagó…"
        style={{ ...ui.input, marginBottom: "16px", maxWidth: "360px" }}
      />

      {filtrados.length === 0 ? (
        <p style={ui.vacio}>Ningún pago coincide con la búsqueda.</p>
      ) : (
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Fecha</th>
              <th style={ui.th}>Tipo</th>
              <th style={ui.th}>Concepto</th>
              <th style={ui.th}>Pagado por</th>
              <th style={ui.thRight}>Monto en $</th>
              <th style={ui.thRight}>Monto en U$D</th>
              <th style={ui.th} />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((pago) => (
              <tr key={pago.id}>
                <td style={ui.td}>{formatDate(pago.fecha)}</td>
                <td style={ui.td}>{pago.categoria}</td>
                <td style={ui.td}>{pago.concepto}</td>
                <td style={ui.td}>
                  {pago.compartido ? (
                    "Entre las socias"
                  ) : (
                    pago.empresa ?? (
                      <span style={{ color: "#b00020" }}>Sin asignar</span>
                    )
                  )}
                </td>
                {/* Cada pago ocupa una sola columna de moneda: la que se cargó.
                    Un pago en dólares repetido en las dos era el mismo número
                    dos veces. La de dólares siempre tiene algo, porque el lote
                    se mide en dólares. */}
                <td style={ui.tdRight}>
                  {pago.moneda === "ARS" ? formatMoney(pago.monto) : "—"}
                </td>
                <td style={ui.tdRight}>
                  {pago.usd === null ? "—" : formatUSD(pago.usd)}
                </td>
                <td style={ui.td}>
                  <div style={acciones}>
                    <Link
                      href={`/obras/${slug}/lote/${pago.id}/editar`}
                      style={enlace}
                    >
                      Editar
                    </Link>
                    <form action={eliminar}>
                      <input type="hidden" name="obra_id" value={obraId} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="pago_id" value={pago.id} />
                      <button type="submit" style={botonQuitar}>
                        Quitar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

const acciones = {
  display: "flex",
  gap: "14px",
  alignItems: "center",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
};

const botonQuitar = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
  cursor: "pointer",
};
