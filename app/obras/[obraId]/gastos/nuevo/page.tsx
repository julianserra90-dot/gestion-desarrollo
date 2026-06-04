"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { formatMoney, obras } from "@/data/mockData";
import { useState } from "react";

export default function NuevoGastoPage() {
  const params = useParams();
  const obraId = params.obraId as string;

  const obra = obras.find((item) => item.id === obraId);

  const [monto, setMonto] = useState("");
  const [empresaPagadora, setEmpresaPagadora] = useState("");

  const montoNumerico = Number(monto) || 0;
  const parteEmpresaA = montoNumerico / 2;
  const parteEmpresaB = montoNumerico / 2;

  let compensacionTexto = "Seleccioná una empresa pagadora para ver la compensación.";

  if (empresaPagadora === "Empresa A" && montoNumerico > 0) {
    compensacionTexto = `Empresa B debe compensar ${formatMoney(
      parteEmpresaB
    )} a Empresa A.`;
  }

  if (empresaPagadora === "Empresa B" && montoNumerico > 0) {
    compensacionTexto = `Empresa A debe compensar ${formatMoney(
      parteEmpresaA
    )} a Empresa B.`;
  }

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Nuevo gasto</h2>
          <p style={subtitle}>
            Cargar un gasto al 100%. El sistema lo divide automáticamente 50/50.
          </p>
        </div>

        <Link href={`/obras/${obra.id}/gastos`} style={backLink}>
          Volver a gastos
        </Link>
      </header>

      <section style={layout}>
        <form style={formPanel}>
          <div style={formGrid}>
            <label style={field}>
              <span style={label}>Fecha</span>
              <input type="date" style={input} />
            </label>

            <label style={field}>
              <span style={label}>Empresa que pagó</span>
              <select
                style={input}
                value={empresaPagadora}
                onChange={(event) => setEmpresaPagadora(event.target.value)}
              >
                <option value="" disabled>
                  Seleccionar empresa
                </option>
                <option value="Empresa A">Empresa A</option>
                <option value="Empresa B">Empresa B</option>
              </select>
            </label>

            <label style={field}>
              <span style={label}>Rubro</span>
              <select style={input} defaultValue="">
                <option value="" disabled>
                  Seleccionar rubro
                </option>
                <option value="Terreno">Terreno</option>
                <option value="Proyecto">Proyecto</option>
                <option value="Permisos">Permisos / trámites</option>
                <option value="Demolición">Demolición</option>
                <option value="Movimiento de suelo">Movimiento de suelo</option>
                <option value="Hormigón armado">Hormigón armado</option>
                <option value="Albañilería">Albañilería</option>
                <option value="Instalación sanitaria">Instalación sanitaria</option>
                <option value="Instalación eléctrica">Instalación eléctrica</option>
                <option value="Carpinterías">Carpinterías</option>
                <option value="Terminaciones">Terminaciones</option>
                <option value="Honorarios">Honorarios</option>
                <option value="Imprevistos">Imprevistos</option>
              </select>
            </label>

            <label style={field}>
              <span style={label}>Proveedor</span>
              <input type="text" placeholder="Ej: Hormigonera Norte" style={input} />
            </label>

            <label style={fieldLarge}>
              <span style={label}>Concepto</span>
              <input
                type="text"
                placeholder="Ej: Hormigón para platea"
                style={input}
              />
            </label>

            <label style={field}>
              <span style={label}>Monto total</span>
              <input
                type="number"
                placeholder="0"
                style={input}
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
              />
            </label>

            <label style={field}>
              <span style={label}>Moneda</span>
              <select style={input} defaultValue="ARS">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </label>

            <label style={field}>
              <span style={label}>Estado</span>
              <select style={input} defaultValue="Pagado">
                <option value="Pagado">Pagado</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Observado">Observado</option>
                <option value="Anulado">Anulado</option>
              </select>
            </label>

            <label style={fieldLarge}>
              <span style={label}>Comprobante</span>
              <input type="file" style={input} />
            </label>

            <label style={fieldLarge}>
              <span style={label}>Observaciones</span>
              <textarea
                placeholder="Agregar una observación opcional"
                style={textarea}
              />
            </label>
          </div>

          <div style={actions}>
            <Link href={`/obras/${obra.id}/gastos`} style={secondaryButton}>
              Cancelar
            </Link>

            <button type="button" style={button}>
              Guardar gasto
            </button>
          </div>
        </form>

        <aside style={summaryPanel}>
          <p style={eyebrow}>Cálculo automático</p>
          <h3 style={summaryTitle}>División 50/50</h3>

          <div style={summaryRow}>
            <span>Monto total</span>
            <strong>{formatMoney(montoNumerico)}</strong>
          </div>

          <div style={summaryRow}>
            <span>Empresa A</span>
            <strong>{formatMoney(parteEmpresaA)}</strong>
          </div>

          <div style={summaryRow}>
            <span>Empresa B</span>
            <strong>{formatMoney(parteEmpresaB)}</strong>
          </div>

          <div style={resultBox}>
            <p style={resultTitle}>Compensación</p>
            <p style={resultText}>{compensacionTexto}</p>
          </div>

          <p style={note}>
            El gasto se registra por el 100%, pero internamente se reparte 50%
            para cada empresa.
          </p>
        </aside>
      </section>
    </AppShell>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #e5e5e5",
  paddingBottom: "24px",
  marginBottom: "32px",
};

const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

const title = {
  fontSize: "36px",
  fontWeight: 400,
  margin: "8px 0",
};

const subtitle = {
  color: "#666666",
  margin: 0,
};

const backLink = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
  paddingBottom: "4px",
};

const layout = {
  display: "grid",
  gridTemplateColumns: "1fr 340px",
  gap: "24px",
  alignItems: "start",
};

const formPanel = {
  border: "1px solid #e5e5e5",
  padding: "28px",
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
};

const fieldLarge = {
  display: "grid",
  gap: "8px",
  gridColumn: "1 / -1",
};

const label = {
  fontSize: "13px",
  color: "#555555",
};

const input = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  background: "#ffffff",
  padding: "12px",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111111",
};

const textarea = {
  width: "100%",
  minHeight: "100px",
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  background: "#ffffff",
  padding: "12px",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111111",
  resize: "vertical" as const,
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  borderTop: "1px solid #eeeeee",
  paddingTop: "24px",
  marginTop: "28px",
};

const button = {
  background: "#111111",
  color: "#ffffff",
  border: "none",
  padding: "12px 20px",
  fontSize: "14px",
  cursor: "pointer",
};

const secondaryButton = {
  color: "#111111",
  textDecoration: "none",
  border: "1px solid #dcdcdc",
  padding: "12px 20px",
  fontSize: "14px",
};

const summaryPanel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  position: "sticky" as const,
  top: "24px",
};

const summaryTitle = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "12px 0 24px",
};

const summaryRow = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "14px",
  marginTop: "14px",
};

const resultBox = {
  border: "1px solid #111111",
  padding: "16px",
  marginTop: "24px",
};

const resultTitle = {
  fontSize: "13px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#555555",
  margin: 0,
};

const resultText = {
  fontSize: "16px",
  lineHeight: 1.5,
  marginBottom: 0,
};

const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: "24px",
};