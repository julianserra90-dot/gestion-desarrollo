"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import { avances, obras } from "@/data/mockData";

export default function EditarAvancePage() {
  const params = useParams();
  const obraId = params.obraId as string;
  const avanceId = params.avanceId as string;

  const obra = obras.find((item) => item.id === obraId);
  const avance = avances.find((item) => item.id === avanceId);

  const [porcentaje, setPorcentaje] = useState(avance?.avance ?? 0);
  const [estado, setEstado] = useState(avance?.estado ?? "");
  const [comentario, setComentario] = useState(avance?.comentario ?? "");

  if (!obra || !avance) {
    return <AppShell>Avance no encontrado</AppShell>;
  }

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="avances" />

      <section style={pageHeader}>
        <div>
          <p style={eyebrow}>Editar avance</p>
          <h2 style={title}>{avance.rubro}</h2>
          <p style={subtitle}>
            Actualizar el porcentaje de avance, estado y comentario técnico del
            rubro.
          </p>
        </div>

        <Link href={`/obras/${obra.id}/avances`} style={backLink}>
          Volver a avances
        </Link>
      </section>

      <section style={layout}>
        <form style={formPanel}>
          <div style={rubroHeader}>
            <p style={eyebrow}>Rubro</p>
            <h3 style={rubroTitle}>{avance.rubro}</h3>
          </div>

          <div style={formGrid}>
            <label style={field}>
              <span style={label}>Porcentaje de avance</span>
              <input
                type="number"
                min="0"
                max="100"
                value={porcentaje}
                onChange={(event) => setPorcentaje(Number(event.target.value))}
                style={input}
              />
            </label>

            <label style={field}>
              <span style={label}>Estado</span>
              <select
                value={estado}
                onChange={(event) => setEstado(event.target.value)}
                style={input}
              >
                <option value="Sin iniciar">Sin iniciar</option>
                <option value="Replanteo">Replanteo</option>
                <option value="Inicial">Inicial</option>
                <option value="En ejecución">En ejecución</option>
                <option value="Finalizado">Finalizado</option>
              </select>
            </label>

            <label style={field}>
              <span style={label}>Fecha de actualización</span>
              <input type="date" style={input} />
            </label>

            <div style={readOnlyField}>
              <span style={label}>Fotos asociadas</span>
              <strong>{avance.fotosAsociadas}</strong>
              <p style={readOnlyNote}>
                Se calculan automáticamente según las fotos cargadas en este
                rubro.
              </p>
            </div>

            <label style={fieldLarge}>
              <span style={label}>Comentario técnico</span>
              <textarea
                value={comentario}
                onChange={(event) => setComentario(event.target.value)}
                style={textarea}
              />
            </label>
          </div>

          <div style={actions}>
            <Link href={`/obras/${obra.id}/avances`} style={secondaryButton}>
              Cancelar
            </Link>

            <button type="button" style={button}>
              Guardar avance
            </button>
          </div>
        </form>

        <aside style={summaryPanel}>
          <p style={eyebrow}>Vista previa</p>
          <h3 style={summaryTitle}>{avance.rubro}</h3>

          <div style={progressBox}>
            <div style={progressHeader}>
              <span>Avance actualizado</span>
              <strong>{porcentaje}%</strong>
            </div>

            <div style={progressBackground}>
              <div
                style={{
                  ...progressFill,
                  width: `${porcentaje}%`,
                }}
              />
            </div>
          </div>

          <div style={summaryRow}>
            <span>Estado</span>
            <strong>{estado}</strong>
          </div>

          <div style={summaryRow}>
            <span>Fotos asociadas</span>
            <strong>{avance.fotosAsociadas}</strong>
          </div>

          <div style={commentBox}>
            <p style={eyebrow}>Comentario</p>
            <p style={commentPreview}>{comentario}</p>
          </div>

          <p style={note}>
            Las fotos asociadas se calculan automáticamente según las imágenes
            cargadas en este rubro. Más adelante el botón Guardar avance enviará
            estos datos a Google Sheets.
          </p>
        </aside>
      </section>
    </AppShell>
  );
}

const pageHeader = {
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
  fontSize: "32px",
  fontWeight: 400,
  margin: "8px 0",
};

const subtitle = {
  color: "#666666",
  margin: 0,
  maxWidth: "620px",
  lineHeight: 1.5,
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

const rubroHeader = {
  borderBottom: "1px solid #eeeeee",
  paddingBottom: "20px",
  marginBottom: "24px",
};

const rubroTitle = {
  fontSize: "28px",
  fontWeight: 400,
  margin: "10px 0 0",
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

const readOnlyField = {
  display: "grid",
  gap: "6px",
  border: "1px solid #eeeeee",
  padding: "12px",
  background: "#fafafa",
};

const readOnlyNote = {
  color: "#777777",
  fontSize: "13px",
  lineHeight: 1.4,
  margin: 0,
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
  minHeight: "140px",
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

const progressBox = {
  border: "1px solid #eeeeee",
  padding: "16px",
};

const progressHeader = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "12px",
};

const progressBackground = {
  height: "8px",
  background: "#eeeeee",
};

const progressFill = {
  height: "8px",
  background: "#111111",
};

const summaryRow = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "14px",
  marginTop: "14px",
};

const commentBox = {
  borderTop: "1px solid #eeeeee",
  marginTop: "18px",
  paddingTop: "18px",
};

const commentPreview = {
  color: "#555555",
  lineHeight: 1.5,
};

const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: "24px",
};