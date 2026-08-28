"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import { CATEGORIAS_LOTE, PAGO_COMPARTIDO } from "@/lib/lote-tipos";

export type PagoEnEdicion = {
  id: string;
  fecha: string;
  categoria: string;
  concepto: string;
  monto: number;
  moneda: string;
  observaciones: string | null;
  empresaId: string | null;
  compartido: boolean;
  comprobanteDriveId: string | null;
  comprobanteNombre: string | null;
};

export type SocioOpcion = { id: string; nombre: string };

export default function PagoLoteForm({
  action,
  obraId,
  slug,
  hoy,
  socios,
  pago,
  textoBoton,
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  hoy: string;
  socios: SocioOpcion[];
  pago?: PagoEnEdicion;
  textoBoton?: string;
}) {
  const [moneda, setMoneda] = useState(pago?.moneda ?? "USD");
  const [reemplazar, setReemplazar] = useState(false);

  return (
    <form action={action}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      {pago && <input type="hidden" name="pago_id" value={pago.id} />}

      <div style={grid}>
        <label style={field}>
          <span style={labelCampo}>Tipo</span>
          <select
            name="categoria"
            defaultValue={pago?.categoria ?? "Compra"}
            style={ui.input}
          >
            {CATEGORIAS_LOTE.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span style={ayuda}>
            &quot;Compra&quot; abona el valor del lote y baja el saldo; el resto
            son gastos administrativos de la operación, que van aparte.
          </span>
        </label>

        <label style={field}>
          <span style={labelCampo}>Concepto</span>
          <input
            type="text"
            name="concepto"
            defaultValue={pago?.concepto ?? ""}
            placeholder="Ej: Seña, Escritura, Cuota 3"
            required
            style={ui.input}
          />
        </label>

        <label style={field}>
          <span style={labelCampo}>Pagó</span>
          <select
            name="empresa_id"
            defaultValue={pago?.compartido ? PAGO_COMPARTIDO : pago?.empresaId ?? ""}
            required
            style={ui.input}
          >
            <option value="">Elegir empresa</option>
            {socios.length > 1 && (
              <option value={PAGO_COMPARTIDO}>
                Entre las socias (partes iguales)
              </option>
            )}
            {socios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <span style={ayuda}>
            {socios.length === 0
              ? "Esta obra todavía no tiene socias cargadas."
              : "Quién hizo el pago. “Entre las socias” reparte el monto en partes iguales."}
          </span>
        </label>

        <label style={field}>
          <span style={labelCampo}>Fecha</span>
          <input
            type="date"
            name="fecha"
            defaultValue={pago?.fecha ?? hoy}
            required
            style={ui.input}
          />
        </label>

        <label style={field}>
          <span style={labelCampo}>Monto</span>
          <input
            type="number"
            name="monto"
            min="0"
            step="0.01"
            defaultValue={pago?.monto ?? ""}
            placeholder="0"
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
            <option value="USD">Dólares (USD)</option>
            <option value="ARS">Pesos (ARS)</option>
          </select>
          <span style={ayuda}>
            {moneda === "ARS"
              ? "Se valúa al dólar de la fecha del pago."
              : "El lote se mide en dólares."}
          </span>
        </label>

        <div style={fieldAncho}>
          <span style={labelCampo}>
            Comprobante <span style={opcional}>opcional</span>
          </span>

          {pago?.comprobanteDriveId && !reemplazar ? (
            <div style={comprobanteActual}>
              <span style={{ flex: 1 }}>
                {pago.comprobanteNombre ?? "Archivo cargado"}
              </span>

              <a
                href={`/ver/${pago.comprobanteDriveId}`}
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
              {pago?.comprobanteDriveId && (
                <span style={ayuda}>Al guardar reemplaza el archivo anterior.</span>
              )}
            </>
          )}
        </div>

        <label style={fieldAncho}>
          <span style={labelCampo}>Observaciones</span>
          <input
            type="text"
            name="observaciones"
            defaultValue={pago?.observaciones ?? ""}
            placeholder="Opcional"
            style={ui.input}
          />
        </label>
      </div>

      <div style={acciones}>
        <Link href={`/obras/${slug}/lote`} style={ui.secondaryButton}>
          Cancelar
        </Link>
        <button type="submit" style={ui.button}>
          {textoBoton ?? "Agregar pago"}
        </button>
      </div>
    </form>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "20px",
};

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

const ayuda = {
  fontSize: "13px",
  color: "#999999",
};

const opcional = {
  color: "#aaaaaa",
  fontWeight: 400 as const,
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

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};
