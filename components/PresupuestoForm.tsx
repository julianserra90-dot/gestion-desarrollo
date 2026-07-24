"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import { formatMoney } from "@/lib/format";

type Rubro = {
  id: string;
  nombre: string;
  usaMateriales: boolean;
  usaManoObra: boolean;
};
export type Proveedor = { id: string; nombre: string; tipo: string };

const TIPOS = ["Materiales", "Mano de obra"];

/** Los materiales los cotiza un proveedor; la mano de obra, un contratista. */
const TIPO_PROVEEDOR: Record<string, string> = {
  Materiales: "Proveedor",
  "Mano de obra": "Contratista",
};

const NUEVO = "__nuevo__";

export type PresupuestoExistente = {
  id: string;
  rubro_id: string;
  tipo: string;
  proveedor_id: string;
  fecha: string;
  validez_hasta: string | null;
  monto: number;
  moneda: string;
  monto_usd: number | null;
  detalle: string | null;
  observaciones: string | null;
  comprobante_drive_id: string | null;
  comprobante_nombre: string | null;
};

export default function PresupuestoForm({
  action,
  obraId,
  slug,
  rubros,
  proveedores,
  error,
  presupuesto,
  cotizacion,
  rubroSugerido,
  tipoSugerido,
  textoBoton = "Guardar cotización",
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  rubros: Rubro[];
  proveedores: Proveedor[];
  error?: string;
  /** Si viene, el formulario edita esa cotización en vez de crear una. */
  presupuesto?: PresupuestoExistente;
  /** Dólar oficial de hoy, sólo para la vista previa de la conversión. */
  cotizacion?: number | null;
  /** Vienen de la solapa cuando se entra por "Cotizar" de un rubro puntual. */
  rubroSugerido?: string;
  tipoSugerido?: string;
  textoBoton?: string;
}) {
  const [rubroId, setRubroId] = useState(
    presupuesto?.rubro_id ?? rubroSugerido ?? ""
  );
  const [tipo, setTipo] = useState(presupuesto?.tipo ?? tipoSugerido ?? "Materiales");
  const [proveedorId, setProveedorId] = useState(presupuesto?.proveedor_id ?? "");
  const [monto, setMonto] = useState(
    presupuesto
      ? String(
          presupuesto.moneda === "USD" ? (presupuesto.monto_usd ?? "") : presupuesto.monto
        )
      : ""
  );
  const [moneda, setMoneda] = useState(presupuesto?.moneda ?? "ARS");
  const [reemplazar, setReemplazar] = useState(false);

  const ingresado = Number(monto) || 0;
  const total =
    moneda === "USD" ? (cotizacion ? ingresado * cotizacion : 0) : ingresado;

  // El desplegable muestra proveedores o contratistas según lo que se cotiza.
  const tipoProveedor = TIPO_PROVEEDOR[tipo] ?? "Proveedor";
  const disponibles = proveedores.filter((p) => p.tipo === tipoProveedor);
  const agregandoNuevo = proveedorId === NUEVO;

  function cambiarTipo(nuevoTipo: string) {
    setTipo(nuevoTipo);
    // El proveedor elegido era del otro tipo: deja de valer.
    setProveedorId("");
  }

  // Sólo se ofrece lo que el rubro admite: el terreno se compra y listo, una
  // demolición es puro trabajo.
  const rubroElegido = rubros.find((r) => r.id === rubroId);
  const tiposDisponibles = rubroElegido
    ? TIPOS.filter((t) =>
        t === "Materiales" ? rubroElegido.usaMateriales : rubroElegido.usaManoObra
      )
    : TIPOS;

  function cambiarRubro(nuevoRubro: string) {
    setRubroId(nuevoRubro);

    const r = rubros.find((x) => x.id === nuevoRubro);
    if (!r) return;

    // Cambiar de rubro puede dejar el tipo elegido sin sentido.
    if (tipo === "Materiales" && !r.usaMateriales) cambiarTipo("Mano de obra");
    else if (tipo === "Mano de obra" && !r.usaManoObra) cambiarTipo("Materiales");
  }

  return (
    <form action={action} style={layout}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      {presupuesto && (
        <input type="hidden" name="presupuesto_id" value={presupuesto.id} />
      )}

      <div>
        {error && <p style={errorBox}>{error}</p>}

        <div style={ui.panel}>
          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Rubro</span>
              <select
                name="rubro_id"
                value={rubroId}
                onChange={(e) => cambiarRubro(e.target.value)}
                required
                style={ui.input}
              >
                <option value="">Seleccionar rubro</option>
                {rubros.map((rubro) => (
                  <option key={rubro.id} value={rubro.id}>
                    {rubro.nombre}
                  </option>
                ))}
              </select>
              <span style={ayudaCampo}>
                Sólo los rubros marcados en esta obra.
              </span>
            </label>

            <label style={field}>
              <span style={labelCampo}>Qué se cotiza</span>
              <select
                name="tipo"
                value={tipo}
                onChange={(e) => cambiarTipo(e.target.value)}
                style={ui.input}
              >
                {tiposDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span style={ayudaCampo}>
                {tiposDisponibles.length === 1 && rubroElegido
                  ? `En ${rubroElegido.nombre} sólo se cotiza ${tiposDisponibles[0].toLowerCase()}.`
                  : "Un mismo rubro puede cotizarse por separado para las dos cosas."}
              </span>
            </label>

            <div style={fieldAncho}>
              <span style={labelCampo}>
                {tipoProveedor === "Proveedor"
                  ? "Proveedor que cotiza"
                  : "Contratista que cotiza"}
              </span>

              <select
                name="proveedor_id"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                required
                style={ui.input}
              >
                <option value="">Seleccionar</option>
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

              <span style={ayudaCampo}>
                Queda en el mismo listado que usan los gastos, así que después
                se puede elegir al cargar la factura.
              </span>
            </div>

            <label style={field}>
              <span style={labelCampo}>Fecha de la cotización</span>
              <input
                type="date"
                name="fecha"
                defaultValue={presupuesto?.fecha ?? ""}
                required
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Válida hasta</span>
              <input
                type="date"
                name="validez_hasta"
                defaultValue={presupuesto?.validez_hasta ?? ""}
                style={ui.input}
              />
              <span style={ayudaCampo}>
                Opcional. Hasta cuándo sostienen el precio.
              </span>
            </label>

            <label style={field}>
              <span style={labelCampo}>Monto cotizado</span>
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
                    ? `Se guarda también en pesos al dólar de la fecha (hoy ≈ ${formatMoney(cotizacion)}).`
                    : "Se guarda también en pesos al dólar de la fecha."}
                </span>
              )}
            </label>

            <div style={fieldAncho}>
              <span style={labelCampo}>Detalle</span>
              <input
                type="text"
                name="detalle"
                defaultValue={presupuesto?.detalle ?? ""}
                placeholder="Ej: Mano de obra completa, materiales por cuenta de la obra"
                style={ui.input}
              />
              <span style={ayudaCampo}>
                Opcional. Qué incluye y qué no: es lo que hace comparables dos
                cotizaciones.
              </span>
            </div>

            <div style={fieldAncho}>
              <span style={labelCampo}>Cotización en PDF</span>

              {presupuesto?.comprobante_drive_id && !reemplazar ? (
                <div style={comprobanteActual}>
                  <span style={{ flex: 1 }}>
                    {presupuesto.comprobante_nombre ?? "Archivo cargado"}
                  </span>

                  <a
                    href={`/ver/${presupuesto.comprobante_drive_id}`}
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
                    {presupuesto?.comprobante_drive_id
                      ? "Al guardar reemplaza el archivo anterior."
                      : "Opcional. El presupuesto que mandó el gremio."}
                  </span>
                </>
              )}
            </div>

            <label style={fieldAncho}>
              <span style={labelCampo}>Observaciones</span>
              <textarea
                name="observaciones"
                defaultValue={presupuesto?.observaciones ?? ""}
                placeholder="Opcional"
                style={textarea}
              />
            </label>
          </div>
        </div>

        <div style={acciones}>
          <Link href={`/obras/${slug}/presupuestos`} style={ui.secondaryButton}>
            Cancelar
          </Link>

          <button type="submit" style={ui.button}>
            {textoBoton}
          </button>
        </div>
      </div>

      <aside style={resumen}>
        <p style={ui.eyebrow}>Cálculo automático</p>
        <h3 style={tituloResumen}>La cotización</h3>

        {moneda === "USD" && (
          <div style={filaDesglose}>
            <span>Cotizado en dólares</span>
            <span>US$ {ingresado.toLocaleString("es-AR")}</span>
          </div>
        )}

        <div style={filaDesglose}>
          <span>Qué se cotiza</span>
          <span>{tipo}</span>
        </div>

        <div style={filaTotal}>
          <span>{moneda === "USD" ? "Equivale a" : "Monto"}</span>
          <strong>{formatMoney(total)}</strong>
        </div>

        <div style={caja}>
          <p style={tituloCaja}>Qué pasa al guardarla</p>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
            Queda como <strong>pendiente</strong>, al lado de las otras
            cotizaciones del mismo rubro. Recién cuando la aprobés pasa a ser la
            elegida y los gastos de ese rubro se comparan contra este monto.
          </p>
        </div>

        <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
          Aprobar una cotización no obliga a nada: si después hay una compra de
          urgencia que nadie cotizó, el gasto se carga igual eligiendo otro
          proveedor.
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
