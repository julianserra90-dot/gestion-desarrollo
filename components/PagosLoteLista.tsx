"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BotonDescarga from "@/components/BotonDescarga";
import * as ui from "@/components/ui";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { CATEGORIAS_LOTE } from "@/lib/lote-tipos";

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
  comprobanteDriveId: string | null;
  comprobanteNombre: string | null;
};

export default function PagosLoteLista({
  pagos,
  slug,
  obraId,
  eliminar,
  categoriaInicial,
}: {
  pagos: PagoFila[];
  slug: string;
  obraId: string;
  eliminar: (formData: FormData) => void;
  /** Con qué categorías arranca tildado el filtro: llega de la tarjeta desde la
   *  que se entró ("Pago a la fecha" → Compra, "Gastos administrativos" → el
   *  resto). Sin esto, arrancan todas tildadas. */
  categoriaInicial?: readonly string[];
}) {
  const [busqueda, setBusqueda] = useState("");

  // Sólo las categorías que de verdad tiene esta obra: filtrar por una que no
  // aparece en ningún pago no tendría sentido.
  const categoriasPresentes = CATEGORIAS_LOTE.filter((c) =>
    pagos.some((p) => p.categoria === c)
  );

  const [activas, setActivas] = useState(
    () => new Set(categoriaInicial ?? categoriasPresentes)
  );

  function alternar(categoria: string) {
    setActivas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(categoria)) siguiente.delete(categoria);
      else siguiente.add(categoria);
      return siguiente;
    });
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return pagos.filter((p) => {
      if (!activas.has(p.categoria)) return false;
      if (!q) return true;

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
  }, [pagos, busqueda, activas]);

  if (pagos.length === 0) {
    return (
      <p style={ui.vacio}>Todavía no se cargó ningún pago del lote.</p>
    );
  }

  return (
    <>
      <div style={filtros}>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por concepto, tipo, quién pagó…"
          style={{ ...ui.input, maxWidth: "360px" }}
        />

        {/* Con una sola categoría cargada, tildar y destildar no filtra nada:
            no vale la pena mostrar el control. */}
        {categoriasPresentes.length > 1 && (
          <div style={chips}>
            {categoriasPresentes.map((categoria) => (
              <label
                key={categoria}
                style={activas.has(categoria) ? chipActivo : chip}
              >
                <input
                  type="checkbox"
                  checked={activas.has(categoria)}
                  onChange={() => alternar(categoria)}
                  style={chipCheckbox}
                />
                {categoria}
              </label>
            ))}
          </div>
        )}
      </div>

      {filtrados.length === 0 ? (
        <p style={ui.vacio}>Ningún pago coincide con el filtro.</p>
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
              <th style={ui.th}>Comprobante</th>
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
                  {pago.comprobanteDriveId ? (
                    <span style={chipComprobante}>
                      <Link
                        href={`/ver/${pago.comprobanteDriveId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={enlace}
                      >
                        Ver
                      </Link>
                      <BotonDescarga
                        fileId={pago.comprobanteDriveId}
                        variante="icono"
                        etiqueta={`Descargar ${pago.comprobanteNombre ?? "comprobante"}`}
                      />
                    </span>
                  ) : (
                    <span style={{ color: "#aaaaaa" }}>—</span>
                  )}
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

const chipComprobante = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  whiteSpace: "nowrap" as const,
};

const filtros = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap" as const,
  marginBottom: "16px",
};

const chips = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
};

const chip = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  color: "#999999",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const chipActivo = {
  ...chip,
  color: "#111111",
};

const chipCheckbox = {
  margin: 0,
};

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
