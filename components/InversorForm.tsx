"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import { formatMoney, formatUSD } from "@/lib/format";

const TIPOS = ["Inversor", "Comprador"];

export type InversorExistente = {
  id: string;
  tipo: string;
  nombre: string;
  apellido: string | null;
  comprometido_ars: number;
  comprometido_usd: number;
  observaciones: string | null;
};

export default function InversorForm({
  action,
  obraId,
  slug,
  error,
  inversor,
  aportado,
  textoBoton = "Guardar ficha",
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  error?: string;
  /** Si viene, el formulario corrige esa ficha en vez de crear una nueva. */
  inversor?: InversorExistente;
  /** Lo que ya puso, para mostrar en el acto cuánto le quedaría faltando. */
  aportado: { ars: number; usd: number };
  textoBoton?: string;
}) {
  const [tipo, setTipo] = useState(inversor?.tipo ?? "Inversor");
  const [ars, setArs] = useState(
    inversor ? String(inversor.comprometido_ars) : ""
  );
  const [usd, setUsd] = useState(
    inversor ? String(inversor.comprometido_usd) : ""
  );

  const comprometidoArs = Number(ars) || 0;
  const comprometidoUsd = Number(usd) || 0;

  // Poner de más no deja una deuda negativa: queda saldado.
  const restaArs = Math.max(0, comprometidoArs - aportado.ars);
  const restaUsd = Math.max(0, comprometidoUsd - aportado.usd);

  const sinCompromiso = comprometidoArs === 0 && comprometidoUsd === 0;

  return (
    <form action={action} style={layout}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      {inversor && (
        <input type="hidden" name="inversor_id" value={inversor.id} />
      )}

      <div>
        {error && <p style={errorBox}>{error}</p>}

        <div style={ui.panel}>
          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Qué es</span>
              <select
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                style={ui.input}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <div style={field} />

            <label style={field}>
              <span style={labelCampo}>Nombre</span>
              <input
                type="text"
                name="nombre"
                defaultValue={inversor?.nombre ?? ""}
                placeholder={tipo === "Inversor" ? "Ej: Juan" : "Ej: Familia García"}
                required
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>
                Apellido <span style={opcional}>opcional</span>
              </span>
              <input
                type="text"
                name="apellido"
                defaultValue={inversor?.apellido ?? ""}
                placeholder="Ej: Pérez"
                style={ui.input}
              />
            </label>

            {/* Los dos montos y no uno con su moneda: se puede firmar por las
                dos cosas a la vez, y cada lado se sigue por su cuenta. */}
            <label style={field}>
              <span style={labelCampo}>
                Comprometido en pesos <span style={opcional}>opcional</span>
              </span>
              <input
                type="number"
                name="comprometido_ars"
                min="0"
                step="0.01"
                placeholder="0"
                value={ars}
                onChange={(e) => setArs(e.target.value)}
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>
                Comprometido en dólares <span style={opcional}>opcional</span>
              </span>
              <input
                type="number"
                name="comprometido_usd"
                min="0"
                step="0.01"
                placeholder="0"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
                style={ui.input}
              />
              <span style={ayudaCampo}>
                Los dos lados no se mezclan: aportar pesos no baja lo que se
                debe en dólares.
              </span>
            </label>

            <div style={fieldAncho}>
              <span style={labelCampo}>
                Observaciones <span style={opcional}>opcional</span>
              </span>
              <textarea
                name="observaciones"
                defaultValue={inversor?.observaciones ?? ""}
                placeholder="Ej: firmó boleto el 3/8, paga en 12 cuotas"
                style={textarea}
              />
            </div>
          </div>

          <div style={acciones}>
            <Link href={`/obras/${slug}/inversores`} style={ui.secondaryButton}>
              Cancelar
            </Link>
            <button type="submit" style={ui.button}>
              {textoBoton}
            </button>
          </div>
        </div>
      </div>

      <aside style={resumen}>
        <p style={ui.eyebrow}>Cálculo automático</p>
        <h3 style={tituloResumen}>Cuánto falta</h3>

        {sinCompromiso ? (
          <p style={ui.note}>
            Sin monto comprometido no hay saldo que seguir. La ficha sirve igual
            para juntar los aportes en un solo lugar.
          </p>
        ) : (
          <>
            {comprometidoArs > 0 && (
              <div style={caja}>
                <p style={tituloCaja}>En pesos</p>
                <div style={filaDesglose}>
                  <span>Comprometido</span>
                  <span>{formatMoney(comprometidoArs)}</span>
                </div>
                <div style={filaDesglose}>
                  <span>Ya puso</span>
                  <span>{formatMoney(aportado.ars)}</span>
                </div>
                <div style={filaTotal}>
                  <strong>Resta poner</strong>
                  <strong style={{ color: restaArs > 0 ? ui.ROJO : ui.VERDE }}>
                    {formatMoney(restaArs)}
                  </strong>
                </div>
              </div>
            )}

            {comprometidoUsd > 0 && (
              <div style={caja}>
                <p style={tituloCaja}>En dólares</p>
                <div style={filaDesglose}>
                  <span>Comprometido</span>
                  <span>{formatUSD(comprometidoUsd)}</span>
                </div>
                <div style={filaDesglose}>
                  <span>Ya puso</span>
                  <span>{formatUSD(aportado.usd)}</span>
                </div>
                <div style={filaTotal}>
                  <strong>Resta poner</strong>
                  <strong style={{ color: restaUsd > 0 ? ui.ROJO : ui.VERDE }}>
                    {formatUSD(restaUsd)}
                  </strong>
                </div>
              </div>
            )}
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

const opcional = {
  color: "#aaaaaa",
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
