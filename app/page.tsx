import Link from "next/link";
import { formatMoney, obras } from "@/data/mockData";

export default function Home() {
  return (
    <main style={page}>
      <header style={header}>
        <div>
          <p style={eyebrow}>Gestión de desarrollo</p>
          <h1 style={title}>Obras</h1>
          <p style={subtitle}>
            Seleccioná una obra para ingresar a su información.
          </p>
        </div>

        <button style={button}>Nueva obra</button>
      </header>

      <section style={obraGrid}>
        {obras.map((obra) => (
          <Link key={obra.id} href={`/obras/${obra.id}`} style={obraCard}>
            <div>
              <p style={eyebrow}>{obra.estado}</p>
              <h2 style={obraTitle}>{obra.nombre}</h2>
              <p style={obraLocation}>{obra.ubicacion}</p>
            </div>

            <div style={progressBlock}>
              <div style={progressTop}>
                <span>Avance</span>
                <strong>{obra.avance}%</strong>
              </div>

              <div style={progressBackground}>
                <div
                  style={{
                    ...progressFill,
                    width: `${obra.avance}%`,
                  }}
                />
              </div>
            </div>

            <div style={meta}>
              <div style={metaRow}>
                <span>Gasto total</span>
                <strong>{formatMoney(obra.gastoTotal)}</strong>
              </div>

              <div style={metaRow}>
                <span>Inicio</span>
                <strong>{obra.fechaInicio}</strong>
              </div>

              <div style={metaRow}>
                <span>Fin estimado</span>
                <strong>{obra.fechaFin}</strong>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "#ffffff",
  color: "#111111",
  fontFamily: "Arial, Helvetica, sans-serif",
  padding: "56px",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #e5e5e5",
  paddingBottom: "32px",
  marginBottom: "40px",
};

const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

const title = {
  fontSize: "42px",
  fontWeight: 400,
  margin: "10px 0",
};

const subtitle = {
  color: "#666666",
  margin: 0,
  fontSize: "16px",
};

const button = {
  background: "#111111",
  color: "#ffffff",
  border: "none",
  padding: "12px 20px",
  fontSize: "14px",
  cursor: "pointer",
};

const obraGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "24px",
};

const obraCard = {
  border: "1px solid #e5e5e5",
  padding: "28px",
  minHeight: "320px",
  textDecoration: "none",
  color: "#111111",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  background: "#ffffff",
};

const obraTitle = {
  fontSize: "26px",
  fontWeight: 400,
  margin: "14px 0 8px",
};

const obraLocation = {
  color: "#666666",
  margin: 0,
};

const progressBlock = {
  marginTop: "36px",
};

const progressTop = {
  display: "flex",
  justifyContent: "space-between",
  color: "#555555",
  fontSize: "14px",
  marginBottom: "10px",
};

const progressBackground = {
  height: "8px",
  background: "#eeeeee",
};

const progressFill = {
  height: "8px",
  background: "#111111",
};

const meta = {
  marginTop: "32px",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
  marginTop: "12px",
  color: "#444444",
  fontSize: "14px",
};