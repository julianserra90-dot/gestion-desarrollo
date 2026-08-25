"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import { formatMoney, formatUSD } from "@/lib/format";

type Socio = { empresa_id: string; nombre: string; porcentaje: number };

const DE_SOCIA = "Empresa socia";
const ORIGENES = [DE_SOCIA, "Inversor", "Comprador"];

export type IngresoExistente = {
  id: string;
  fecha: string;
  origen: string;
  empresa_id: string | null;
  aportante: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  monto_usd: number | null;
  observaciones: string | null;
  comprobante_drive_id: string | null;
  comprobante_nombre: string | null;
};

export default function IngresoForm({
  action,
  obraId,
  slug,
  socios,
  saldosCaja,
  error,
  ingreso,
  cotizacion,
  textoBoton = "Guardar ingreso",
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  socios: Socio[];
  /** Los dos lados de la cuenta, para mostrar cómo queda después del ingreso. */
  saldosCaja: { ars: number; usd: number };
  error?: string;
  /** Si viene, el formulario edita ese ingreso en vez de crear uno nuevo. */
  ingreso?: IngresoExistente;
  /** Dólar blue de hoy, sólo para la vista previa de la conversión. */
  cotizacion?: number | null;
  textoBoton?: string;
}) {
  // Al editar se muestra el número tal como se cargó: si el ingreso se ingresó
  // en dólares, se ve en dólares, no su equivalente en pesos.
  const [monto, setMonto] = useState(
    ingreso ? String(ingreso.moneda === "USD" ? (ingreso.monto_usd ?? "") : ingreso.monto) : ""
  );
  const [moneda, setMoneda] = useState(ingreso?.moneda ?? "ARS");
  const [origen, setOrigen] = useState(ingreso?.origen ?? DE_SOCIA);
  const [empresaId, setEmpresaId] = useState(ingreso?.empresa_id ?? "");
  const [reemplazar, setReemplazar] = useState(false);

  const ingresado = Number(monto) || 0;

  // La caja se lleva en pesos, igual que el resto de la obra.
  const total =
    moneda === "USD" ? (cotizacion ? ingresado * cotizacion : 0) : ingresado;

  const esDeSocia = origen === DE_SOCIA;
  const esUsd = moneda === "USD";

  // Al editar, el monto viejo ya está contado en el saldo de su lado: se
  // descuenta para que la vista previa no lo sume dos veces.
  const antesArs =
    saldosCaja.ars -
    (ingreso && ingreso.moneda !== "USD" ? Number(ingreso.monto) : 0);
  const antesUsd =
    saldosCaja.usd -
    (ingreso && ingreso.moneda === "USD" ? Number(ingreso.monto_usd ?? 0) : 0);

  const nombreEmpresa = socios.find((s) => s.empresa_id === empresaId)?.nombre;

  return (
    <form action={action} style={layout}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      {ingreso && <input type="hidden" name="ingreso_id" value={ingreso.id} />}

      <div>
        {error && <p style={errorBox}>{error}</p>}

        <div style={ui.panel}>
          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Fecha</span>
              <input
                type="date"
                name="fecha"
                defaultValue={ingreso?.fecha ?? ""}
                required
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>De dónde viene</span>
              <select
                name="origen"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                style={ui.input}
              >
                {ORIGENES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>

            {esDeSocia ? (
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
                  {socios.map((socio) => (
                    <option key={socio.empresa_id} value={socio.empresa_id}>
                      {socio.nombre}
                    </option>
                  ))}
                </select>
                <span style={ayudaCampo}>
                  Cuenta como aporte suyo en el balance de la obra.
                </span>
              </label>
            ) : (
              <label style={field}>
                <span style={labelCampo}>
                  Nombre {origen === "Inversor" ? "del inversor" : "del comprador"}
                </span>
                <input
                  type="text"
                  name="aportante"
                  defaultValue={ingreso?.aportante ?? ""}
                  placeholder={
                    origen === "Inversor" ? "Ej: Juan Pérez" : "Ej: Familia García"
                  }
                  required
                  style={ui.input}
                />
              </label>
            )}

            <div style={fieldAncho}>
              <span style={labelCampo}>Detalle</span>
              <input
                type="text"
                name="concepto"
                defaultValue={ingreso?.concepto ?? ""}
                placeholder={
                  esDeSocia
                    ? "Ej: Fondos para cubrir gastos de agosto"
                    : origen === "Comprador"
                      ? "Ej: Seña departamento 3B"
                      : "Ej: Aporte de capital para la obra"
                }
                required
                style={ui.input}
              />
            </div>

            <label style={field}>
              <span style={labelCampo}>Monto</span>
              <input
                type="number"
                name="monto"
                min="0"
                step="0.01"
                placeholder="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
                style={ui.input}
              />
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
              {moneda === "USD" && (
                <span style={ayudaCampo}>
                  {cotizacion
                    ? `Se guarda también en pesos al dólar de la fecha del ingreso (hoy ≈ ${formatMoney(cotizacion)}).`
                    : "Se guarda también en pesos al dólar de la fecha del ingreso."}
                </span>
              )}
            </label>

            <div style={fieldAncho}>
              <span style={labelCampo}>Comprobante</span>

              {ingreso?.comprobante_drive_id && !reemplazar ? (
                <div style={comprobanteActual}>
                  <span style={{ flex: 1 }}>
                    {ingreso.comprobante_nombre ?? "Comprobante cargado"}
                  </span>

                  <a
                    href={`/ver/${ingreso.comprobante_drive_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={enlaceChico}
                  >
                    Ver
                  </a>

                  <button
                    type="button"
                    onClick={() => setReemplazar(true)}
                    style={ui.secondaryButton}
                  >
                    Reemplazar
                  </button>

                  <label style={quitarLabel}>
                    <input type="checkbox" name="quitar_comprobante" />
                    Quitar
                  </label>
                </div>
              ) : (
                <>
                  <input type="file" name="comprobante" style={ui.input} />
                  <span style={ayudaCampo}>
                    {ingreso?.comprobante_drive_id
                      ? "Al guardar reemplaza el comprobante anterior."
                      : "Opcional. Transferencia, recibo o boleto de compraventa."}
                  </span>
                </>
              )}
            </div>

            <label style={fieldAncho}>
              <span style={labelCampo}>Observaciones</span>
              <textarea
                name="observaciones"
                defaultValue={ingreso?.observaciones ?? ""}
                placeholder="Opcional"
                style={textarea}
              />
            </label>
          </div>
        </div>

        <div style={acciones}>
          <Link href={`/obras/${slug}/ingresos`} style={ui.secondaryButton}>
            Cancelar
          </Link>

          <button type="submit" style={ui.button}>
            {textoBoton}
          </button>
        </div>
      </div>

      <aside style={resumen}>
        <p style={ui.eyebrow}>Cálculo automático</p>
        <h3 style={tituloResumen}>Efecto del ingreso</h3>

        {/* Un aporte en dólares queda en dólares: entra al lado en dólares de
            la cuenta y sale de ahí cuando se vendan. */}
        <div style={filaDesglose}>
          <span>{esUsd ? "Dólares" : "Pesos"} en cuenta antes</span>
          <span>{esUsd ? formatUSD(antesUsd) : formatMoney(antesArs)}</span>
        </div>

        <div style={filaDesglose}>
          <span>Este ingreso</span>
          <span>+ {esUsd ? formatUSD(ingresado) : formatMoney(ingresado)}</span>
        </div>

        <div style={filaTotal}>
          <span>Quedan en cuenta</span>
          <strong>
            {esUsd
              ? formatUSD(antesUsd + ingresado)
              : formatMoney(antesArs + ingresado)}
          </strong>
        </div>

        {esUsd && (
          <div style={{ ...filaDesglose, paddingTop: "14px" }}>
            <span>El otro lado queda igual</span>
            <span>{formatMoney(antesArs)}</span>
          </div>
        )}

        <div style={caja}>
          <p style={tituloCaja}>En el balance entre socias</p>

          {esDeSocia ? (
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
              {empresaId ? (
                <>
                  Suma <strong>{formatMoney(total)}</strong> a lo que ya puso{" "}
                  <strong>{nombreEmpresa}</strong>, igual que si hubiera pagado
                  gastos por ese monto.
                </>
              ) : (
                "Elegí la empresa que aporta para ver el efecto."
              )}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
              Baja en <strong>{formatMoney(total)}</strong> el gasto que se
              reparten las socias. No cuenta como aporte de ninguna.
            </p>
          )}
        </div>

        <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
          {esUsd ? (
            <>
              Los dólares quedan como dólares hasta que se usen. Para el balance
              cuentan por {formatMoney(total)}, su valor al blue de la fecha
              del aporte. Si después se venden mejor, esa diferencia le rinde a
              la obra.
            </>
          ) : (
            <>
              La plata queda disponible en la obra. Al cargar un gasto se puede
              marcar que se pague con este dinero en cuenta.
            </>
          )}
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

// `alignContent: start` mantiene los campos alineados: sin eso, una celda con
// ayuda debajo estira a su vecina y el input de al lado queda flotando a media
// altura en vez de arrancar en la misma línea.
const field = {
  display: "grid",
  gap: "8px",
  alignContent: "start" as const,
};

const fieldAncho = {
  ...field,
  gridColumn: "1 / -1",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const ayudaCampo = {
  fontSize: "13px",
  color: "#999999",
};

const textarea = {
  ...ui.input,
  minHeight: "90px",
  resize: "vertical" as const,
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

const comprobanteActual = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  border: "1px solid #dcdcdc",
  padding: "10px 12px",
  fontSize: "14px",
  flexWrap: "wrap" as const,
};

const enlaceChico = {
  color: "#111111",
  fontSize: "14px",
};

const quitarLabel = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "14px",
  color: "#555555",
  cursor: "pointer",
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
