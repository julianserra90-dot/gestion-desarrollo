"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";

type Socio = { empresa_id: string; nombre: string };

const TODAS_LAS_SOCIAS = "todas";

/**
 * Misma fecha, n meses después. Si el día no existe en el mes de destino (31
 * de enero → febrero), cae en el último día de ese mes.
 */
function sumarMeses(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const mesesTotales = m - 1 + n;
  const anio = y + Math.floor(mesesTotales / 12);
  const mes = mesesTotales % 12;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${anio}-${pad(mes + 1)}-${pad(dia)}`;
}

type Cuota = { fecha: string; monto: string };

/**
 * Carga una serie de cuotas previstas de una vez.
 *
 * Se dan la cantidad, el monto habitual y la fecha de la primera, y la lista
 * se arma sola: una cuota por mes. Cada fila queda editable porque las series
 * reales no son parejas —11 de 4.000 y la última de 6.000—. El detalle no se
 * escribe: es "Cuota Nº x", con el concepto adelante si se puso uno.
 */
export default function CuotasPrevistasForm({
  action,
  obraId,
  slug,
  socios,
  error,
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  socios: Socio[];
  error?: string;
}) {
  const [empresaId, setEmpresaId] = useState("");
  const [concepto, setConcepto] = useState("");
  const [cantidad, setCantidad] = useState("12");
  const [montoBase, setMontoBase] = useState("");
  const [moneda, setMoneda] = useState("ARS");
  const [primera, setPrimera] = useState("");
  const [cuotas, setCuotas] = useState<Cuota[]>(armarCuotas(12, "", ""));

  function armarCuotas(n: number, desde: string, monto: string): Cuota[] {
    return Array.from({ length: n }, (_, i) => ({
      fecha: desde ? sumarMeses(desde, i) : "",
      monto,
    }));
  }

  // Cambiar la cantidad o la primera fecha vuelve a armar las fechas, pero
  // respeta los montos ya tocados: lo habitual es fijar la serie y después
  // corregir una o dos cuotas.
  function rearmar(n: number, desde: string) {
    setCuotas((prev) =>
      Array.from({ length: n }, (_, i) => ({
        fecha: desde ? sumarMeses(desde, i) : "",
        monto: prev[i]?.monto ?? montoBase,
      }))
    );
  }

  function cambiarCantidad(valor: string) {
    setCantidad(valor);
    const n = Math.max(0, Math.min(120, Math.floor(Number(valor) || 0)));
    rearmar(n, primera);
  }

  function cambiarPrimera(valor: string) {
    setPrimera(valor);
    rearmar(cuotas.length, valor);
  }

  // El monto habitual pisa todas las cuotas: es el punto de partida, y las
  // distintas se corrigen después, fila por fila.
  function cambiarMontoBase(valor: string) {
    setMontoBase(valor);
    setCuotas((prev) => prev.map((c) => ({ ...c, monto: valor })));
  }

  function cambiarCuota(i: number, cambio: Partial<Cuota>) {
    setCuotas((prev) => prev.map((c, j) => (j === i ? { ...c, ...cambio } : c)));
  }

  const sonTodas = empresaId === TODAS_LAS_SOCIAS;
  const esUsd = moneda === "USD";
  const formato = esUsd ? formatUSD : formatMoney;
  const total = cuotas.reduce((acc, c) => acc + (Number(c.monto) || 0), 0);
  const nombreEmpresa = socios.find((s) => s.empresa_id === empresaId)?.nombre;

  const detalleDe = (n: number) =>
    concepto.trim() ? `${concepto.trim()} · Cuota Nº ${n}` : `Cuota Nº ${n}`;

  return (
    <form action={action} style={layout}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="cantidad" value={cuotas.length} />

      <div>
        {error && <p style={errorBox}>{error}</p>}

        <div style={ui.panel}>
          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Empresa que aporta</span>
              <select
                name="empresa_id"
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                required
                style={ui.input}
              >
                <option value="">Seleccionar empresa</option>
                {socios.map((s) => (
                  <option key={s.empresa_id} value={s.empresa_id}>
                    {s.nombre}
                  </option>
                ))}
                {socios.length > 1 && (
                  <option value={TODAS_LAS_SOCIAS}>
                    {socios.length === 2 ? "Ambas empresas" : "Todas las socias"}
                  </option>
                )}
              </select>
              {sonTodas && (
                <span style={ayudaCampo}>
                  Cada cuota se divide en partes iguales y cada empresa queda
                  con su propia serie.
                </span>
              )}
            </label>

            <label style={field}>
              <span style={labelCampo}>
                Concepto <span style={opcional}>opcional</span>
              </span>
              <input
                type="text"
                name="concepto"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Cuotas emprendimiento Lar II"
                style={ui.input}
              />
              <span style={ayudaCampo}>
                Va adelante del número: “{detalleDe(1)}”.
              </span>
            </label>

            <label style={field}>
              <span style={labelCampo}>Cantidad de cuotas</span>
              <input
                type="number"
                min="1"
                max="120"
                step="1"
                value={cantidad}
                onChange={(e) => cambiarCantidad(e.target.value)}
                required
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Primera cuota</span>
              <input
                type="date"
                value={primera}
                onChange={(e) => cambiarPrimera(e.target.value)}
                required
                style={ui.input}
              />
              <span style={ayudaCampo}>Las demás caen una por mes.</span>
            </label>

            <label style={field}>
              <span style={labelCampo}>Monto de cada cuota</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={montoBase}
                onChange={(e) => cambiarMontoBase(e.target.value)}
                style={ui.input}
              />
              <span style={ayudaCampo}>
                Las que sean distintas se corrigen abajo.
              </span>
            </label>

            <label style={field}>
              <span style={labelCampo}>Moneda</span>
              <select
                name="moneda"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                style={ui.input}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>
        </div>

        <div style={{ ...ui.panel, marginTop: "20px" }}>
          {cuotas.length === 0 ? (
            <p style={ui.vacio}>Poné cuántas cuotas son.</p>
          ) : (
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Detalle</th>
                  <th style={ui.th}>Fecha prevista</th>
                  <th style={ui.th}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {cuotas.map((c, i) => (
                  <tr key={i}>
                    <td style={{ ...ui.td, whiteSpace: "nowrap" }}>
                      {detalleDe(i + 1)}
                    </td>
                    <td style={ui.td}>
                      <input
                        type="date"
                        name={`cuota_fecha_${i + 1}`}
                        value={c.fecha}
                        onChange={(e) => cambiarCuota(i, { fecha: e.target.value })}
                        required
                        style={inputChico}
                      />
                    </td>
                    <td style={ui.td}>
                      <input
                        type="number"
                        name={`cuota_monto_${i + 1}`}
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={c.monto}
                        onChange={(e) => cambiarCuota(i, { monto: e.target.value })}
                        required
                        style={inputChico}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={acciones}>
          <Link href={`/obras/${slug}/ingresos/agenda`} style={ui.secondaryButton}>
            Cancelar
          </Link>

          <button type="submit" style={ui.button}>
            Guardar cuotas
          </button>
        </div>
      </div>

      <aside style={resumen}>
        <p style={ui.eyebrow}>Cálculo automático</p>
        <h3 style={tituloResumen}>Lo que se espera</h3>

        <div style={filaDesglose}>
          <span>Cuotas</span>
          <span>{cuotas.length}</span>
        </div>

        {cuotas.length > 0 && cuotas[0].fecha && (
          <div style={filaDesglose}>
            <span>Entre</span>
            <span>
              {formatDate(cuotas[0].fecha)} y{" "}
              {formatDate(cuotas[cuotas.length - 1].fecha)}
            </span>
          </div>
        )}

        <div style={filaTotal}>
          <span>Total previsto</span>
          <strong>{formato(total)}</strong>
        </div>

        <div style={caja}>
          <p style={tituloCaja}>En la agenda</p>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
            {sonTodas ? (
              <>
                {socios.length} series de {cuotas.length} cuotas, una por
                empresa, por <strong>{formato(total / socios.length)}</strong>{" "}
                cada una.
              </>
            ) : nombreEmpresa ? (
              <>
                {cuotas.length} cuotas a nombre de <strong>{nombreEmpresa}</strong>.
                Cuando entre cada una, se registra desde la agenda y queda
                cumplida.
              </>
            ) : (
              "Elegí la empresa para ver cómo queda."
            )}
          </p>
        </div>

        <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
          Nada de esto entra en la cuenta ni en el balance: cuenta recién
          cuando la plata llega y se carga el ingreso.
        </p>
      </aside>
    </form>
  );
}

const layout = {
  display: "grid",
  gridTemplateColumns: "1fr 360px",
  gap: "24px",
  alignItems: "start",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
  alignContent: "start" as const,
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const opcional = {
  color: "#999999",
  marginLeft: "6px",
};

const ayudaCampo = {
  fontSize: "13px",
  color: "#999999",
};

const inputChico = {
  ...ui.input,
  padding: "8px 10px",
};

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};

const resumen = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  position: "sticky" as const,
  top: "24px",
};

const tituloResumen = {
  fontSize: "20px",
  fontWeight: 400,
  margin: "12px 0 20px",
};

const filaDesglose = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "14px",
  color: "#666666",
  paddingTop: "8px",
};

const filaTotal = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "14px",
  marginTop: "10px",
};

const caja = {
  border: "1px solid #111111",
  padding: "16px",
  marginTop: "20px",
};

const tituloCaja = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#555555",
  margin: "0 0 10px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
