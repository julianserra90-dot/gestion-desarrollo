"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import { formatMoney } from "@/lib/format";

type Socio = { empresa_id: string; nombre: string; porcentaje: number };
type Rubro = { id: string; nombre: string };
export type Proveedor = { id: string; nombre: string; tipo: string };

const TIPOS_GASTO = ["Materiales", "Mano de obra", "Ajuste de saldo"];
const AJUSTE = "Ajuste de saldo";

/** Materiales se compran a un proveedor; la mano de obra la hace un contratista. */
const TIPO_PROVEEDOR: Record<string, string> = {
  Materiales: "Proveedor",
  "Mano de obra": "Contratista",
};

const NUEVO = "__nuevo__";

const TIPOS_PAGO = ["Facturado", "Efectivo"];

export type GastoExistente = {
  id: string;
  fecha: string;
  rubro_id: string | null;
  proveedor_id: string | null;
  empresa_receptora_id: string | null;
  tipo_gasto: string;
  concepto: string;
  tipo_pago: string;
  monto: number;
  moneda: string;
  monto_usd: number | null;
  observaciones: string | null;
  empresa_pagadora_id: string;
  comprobante_drive_id: string | null;
  comprobante_nombre: string | null;
};

export default function GastoForm({
  action,
  obraId,
  slug,
  rubros,
  socios,
  proveedores,
  error,
  empresaFija,
  gasto,
  cotizacion,
  textoBoton = "Guardar gasto",
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  rubros: Rubro[];
  socios: Socio[];
  proveedores: Proveedor[];
  error?: string;
  /** Si el usuario pertenece a una empresa, el gasto va siempre a su nombre. */
  empresaFija?: string;
  /** Si viene, el formulario edita ese gasto en vez de crear uno nuevo. */
  gasto?: GastoExistente;
  /** Dólar oficial de hoy, sólo para la vista previa de la conversión. */
  cotizacion?: number | null;
  textoBoton?: string;
}) {
  // Al editar se muestra el número tal como se cargó: si el gasto se ingresó en
  // dólares, se ve en dólares, no su equivalente en pesos.
  const [monto, setMonto] = useState(
    gasto ? String(gasto.moneda === "USD" ? (gasto.monto_usd ?? "") : gasto.monto) : ""
  );
  const [moneda, setMoneda] = useState(gasto?.moneda ?? "ARS");
  const [tipoPago, setTipoPago] = useState(gasto?.tipo_pago ?? "Facturado");
  const [pagadora, setPagadora] = useState(
    gasto?.empresa_pagadora_id ?? empresaFija ?? ""
  );
  const [reemplazar, setReemplazar] = useState(false);
  const [tipoGasto, setTipoGasto] = useState(gasto?.tipo_gasto ?? "Materiales");
  const [proveedorId, setProveedorId] = useState(gasto?.proveedor_id ?? "");
  const [receptora, setReceptora] = useState(gasto?.empresa_receptora_id ?? "");

  const ingresado = Number(monto) || 0;

  // El reparto entre socias se calcula siempre sobre el valor en pesos, que es
  // la moneda en la que se lleva la cuenta de la obra.
  const total =
    moneda === "USD" ? (cotizacion ? ingresado * cotizacion : 0) : ingresado;

  // Un ajuste de saldo no compra nada: es plata que pasa de una socia a otra.
  const esAjuste = tipoGasto === AJUSTE;

  // El desplegable muestra proveedores o contratistas según el tipo de gasto.
  const tipoProveedor = TIPO_PROVEEDOR[tipoGasto] ?? "Proveedor";
  const disponibles = proveedores.filter((p) => p.tipo === tipoProveedor);
  const agregandoNuevo = proveedorId === NUEVO;

  const otrasSocias = socios.filter((s) => s.empresa_id !== pagadora);

  function cambiarTipoGasto(nuevoTipo: string) {
    setTipoGasto(nuevoTipo);
    // Los campos del tipo anterior dejan de valer.
    setProveedorId("");
    setReceptora("");
  }

  const reparto = socios.map((socio) => {
    const leCorresponde = (total * socio.porcentaje) / 100;
    const esPagadora = socio.empresa_id === pagadora;

    return {
      ...socio,
      leCorresponde,
      // La que paga adelanta el total: su efecto neto es lo que puso de más.
      efecto: esPagadora ? total - leCorresponde : -leCorresponde,
      esPagadora,
    };
  });

  const nombrePagadora = socios.find((s) => s.empresa_id === pagadora)?.nombre;

  return (
    <form action={action} style={layout}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      {gasto && <input type="hidden" name="gasto_id" value={gasto.id} />}

      <div>
        {error && <p style={errorBox}>{error}</p>}

        <div style={ui.panel}>
          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Fecha</span>
              <input
                type="date"
                name="fecha"
                defaultValue={gasto?.fecha ?? ""}
                required
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>
                {esAjuste ? "Empresa que transfiere" : "Empresa que pagó"}
              </span>

              {empresaFija ? (
                <>
                  <input
                    type="hidden"
                    name="empresa_pagadora_id"
                    value={empresaFija}
                  />
                  <div style={campoFijo}>
                    {socios.find((s) => s.empresa_id === empresaFija)?.nombre ??
                      "Tu empresa"}
                  </div>
                  <span style={ayudaCampo}>
                    Los gastos que cargás quedan a nombre de tu empresa.
                  </span>
                </>
              ) : (
                <select
                  name="empresa_pagadora_id"
                  value={pagadora}
                  onChange={(e) => setPagadora(e.target.value)}
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
              )}
            </label>

            <label style={{ ...field, display: esAjuste ? "none" : "grid" }}>
              <span style={labelCampo}>Rubro</span>
              <select
                name="rubro_id"
                defaultValue={gasto?.rubro_id ?? ""}
                disabled={esAjuste}
                style={ui.input}
              >
                <option value="">Sin rubro</option>
                {rubros.map((rubro) => (
                  <option key={rubro.id} value={rubro.id}>
                    {rubro.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label style={field}>
              <span style={labelCampo}>Tipo de gasto</span>
              <select
                name="tipo_gasto"
                value={tipoGasto}
                onChange={(e) => cambiarTipoGasto(e.target.value)}
                style={ui.input}
              >
                {TIPOS_GASTO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </label>

            {esAjuste && (
              <label style={field}>
                <span style={labelCampo}>Empresa que recibe</span>
                <select
                  name="empresa_receptora_id"
                  value={receptora}
                  onChange={(e) => setReceptora(e.target.value)}
                  required
                  style={ui.input}
                >
                  <option value="">Seleccionar empresa</option>
                  {otrasSocias.map((socio) => (
                    <option key={socio.empresa_id} value={socio.empresa_id}>
                      {socio.nombre}
                    </option>
                  ))}
                </select>
                <span style={ayudaCampo}>
                  A quién se le transfiere para nivelar.
                </span>
              </label>
            )}

            <div style={{ ...field, display: esAjuste ? "none" : "grid" }}>
              <span style={labelCampo}>
                {tipoProveedor === "Proveedor" ? "Proveedor" : "Contratista"}
              </span>

              <select
                name="proveedor_id"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                disabled={esAjuste}
                style={ui.input}
              >
                <option value="">Sin especificar</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
                <option value={NUEVO}>
                  + Agregar {tipoProveedor.toLowerCase()} nuevo
                </option>
              </select>

              {agregandoNuevo && (
                <input
                  type="text"
                  name="proveedor_nuevo"
                  placeholder={
                    tipoProveedor === "Proveedor"
                      ? "Ej: Corralón Central"
                      : "Ej: Yesería Martínez"
                  }
                  required
                  autoFocus
                  style={{ ...ui.input, marginTop: "8px" }}
                />
              )}
            </div>

            <div style={fieldAncho}>
              <span style={labelCampo}>Detalle</span>

              {esAjuste ? (
                // Todos los ajustes se llaman igual: así son fáciles de
                // identificar y filtrar en el listado.
                <>
                  <input type="hidden" name="concepto" value={AJUSTE} />
                  <div style={campoFijo}>{AJUSTE}</div>
                </>
              ) : (
                <input
                  type="text"
                  name="concepto"
                  defaultValue={gasto?.concepto ?? ""}
                  placeholder="Ej: Hormigón para platea"
                  required
                  style={ui.input}
                />
              )}
            </div>

            <label style={{ ...field, display: esAjuste ? "none" : "grid" }}>
              <span style={labelCampo}>Tipo de pago</span>
              <select
                name="tipo_pago"
                value={tipoPago}
                onChange={(e) => setTipoPago(e.target.value)}
                style={ui.input}
              >
                {TIPOS_PAGO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
              <span style={ayudaCampo}>
                {tipoPago === "Facturado" ? "Con factura." : "Sin factura."}
              </span>
            </label>

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
                    ? `Se guarda también en pesos al dólar de la fecha del gasto (hoy ≈ ${formatMoney(cotizacion)}).`
                    : "Se guarda también en pesos al dólar de la fecha del gasto."}
                </span>
              )}
            </label>

            <div style={fieldAncho}>
              <span style={labelCampo}>Comprobante / factura</span>

              {gasto?.comprobante_drive_id && !reemplazar ? (
                <div style={comprobanteActual}>
                  <span style={{ flex: 1 }}>
                    {gasto.comprobante_nombre ?? "Comprobante cargado"}
                  </span>

                  <a
                    href={`/ver/${gasto.comprobante_drive_id}`}
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
                    {gasto?.comprobante_drive_id
                      ? "Al guardar reemplaza el comprobante anterior."
                      : "Opcional. PDF, foto o escaneo de la factura del gasto."}
                  </span>
                </>
              )}
            </div>

            <label style={fieldAncho}>
              <span style={labelCampo}>Observaciones</span>
              <textarea
                name="observaciones"
                defaultValue={gasto?.observaciones ?? ""}
                placeholder="Opcional"
                style={textarea}
              />
            </label>
          </div>
        </div>

        <div style={acciones}>
          <Link href={`/obras/${slug}/gastos`} style={ui.secondaryButton}>
            Cancelar
          </Link>

          <button type="submit" style={ui.button}>
            {textoBoton}
          </button>
        </div>
      </div>

      <aside style={resumen}>
        <p style={ui.eyebrow}>Cálculo automático</p>
        <h3 style={tituloResumen}>
          {esAjuste ? "Movimiento entre socias" : "Reparto entre socias"}
        </h3>

        {esAjuste ? (
          <>
            <div style={filaTotal}>
              <span>Monto a transferir</span>
              <strong>{formatMoney(total)}</strong>
            </div>

            <div style={caja}>
              <p style={tituloCaja}>Efecto en los saldos</p>

              {!pagadora || !receptora || total <= 0 ? (
                <p style={{ margin: 0, fontSize: "14px" }}>
                  Elegí quién transfiere, quién recibe y el monto.
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
                  <strong>{nombrePagadora}</strong> le transfiere{" "}
                  <strong>{formatMoney(total)}</strong> a{" "}
                  <strong>
                    {socios.find((s) => s.empresa_id === receptora)?.nombre}
                  </strong>
                  . La deuda entre ambas baja en ese monto.
                </p>
              )}
            </div>

            <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
              Un ajuste de saldo <strong>no es un gasto de la obra</strong>: no
              suma al total gastado. Sólo mueve plata de una socia a la otra
              para emparejar lo que cada una puso.
            </p>
          </>
        ) : (
          <>
        <div style={filaDesglose}>
          <span>Tipo de pago</span>
          <span>{tipoPago}</span>
        </div>

        {moneda === "USD" && (
          <div style={filaDesglose}>
            <span>Cargado en dólares</span>
            <span>US$ {ingresado.toLocaleString("es-AR")}</span>
          </div>
        )}

        <div style={filaTotal}>
          <span>{moneda === "USD" ? "Equivale a" : "Monto total"}</span>
          <strong>{formatMoney(total)}</strong>
        </div>

        <table style={{ ...ui.table, marginTop: "16px" }}>
          <thead>
            <tr>
              <th style={thChico}>Empresa</th>
              <th style={{ ...thChico, textAlign: "right" }}>Le toca</th>
            </tr>
          </thead>
          <tbody>
            {reparto.map((socio) => (
              <tr key={socio.empresa_id}>
                <td style={tdChico}>
                  {socio.nombre}{" "}
                  <span style={{ color: "#999999" }}>{socio.porcentaje}%</span>
                </td>
                <td style={{ ...tdChico, textAlign: "right" }}>
                  {formatMoney(socio.leCorresponde)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={caja}>
          <p style={tituloCaja}>Efecto en los saldos</p>

          {!pagadora || total <= 0 ? (
            <p style={{ margin: 0, fontSize: "14px" }}>
              Elegí la empresa que pagó y cargá el monto para ver la
              compensación.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", lineHeight: 1.7 }}>
              {reparto
                .filter((s) => !s.esPagadora)
                .map((socio) => (
                  <li key={socio.empresa_id}>
                    {socio.nombre} le debe{" "}
                    <strong>{formatMoney(socio.leCorresponde)}</strong> a{" "}
                    {nombrePagadora}.
                  </li>
                ))}
            </ul>
          )}
        </div>

        <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
          El gasto se registra por el 100%. El reparto sale del porcentaje de
          participación de cada socia en esta obra.
        </p>
          </>
        )}
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

const campoFijo = {
  border: "1px solid #eeeeee",
  background: "#fafafa",
  padding: "12px",
  fontSize: "14px",
  color: "#111111",
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

const thChico = {
  textAlign: "left" as const,
  fontSize: "11px",
  color: "#777777",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  borderBottom: "1px solid #e5e5e5",
  padding: "8px 0",
};

const tdChico = {
  borderBottom: "1px solid #f2f2f2",
  padding: "10px 0",
  fontSize: "14px",
  color: "#333333",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
