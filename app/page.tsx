import Link from "next/link";
import AppShell from "@/components/AppShell";
import { formatMoney, obras } from "@/data/mockData";

export default function Home() {
  const totalGastado = obras.reduce((acc, obra) => acc + obra.gastoTotal, 0);
  const totalEmpresaA = obras.reduce((acc, obra) => acc + obra.empresaA, 0);
  const totalEmpresaB = obras.reduce((acc, obra) => acc + obra.empresaB, 0);
  const compensacion = Math.abs(totalEmpresaA - totalGastado / 2);

  return (
    <AppShell>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "1px solid #e5e5e5",
          paddingBottom: "24px",
          marginBottom: "32px",
        }}
      >
        <div>
          <p style={eyebrow}>Panel general</p>
          <h2 style={title}>Obras</h2>
          <p style={subtitle}>
            Resumen de gastos, avances y documentación de los desarrollos.
          </p>
        </div>

        <button style={button}>Nueva obra</button>
      </header>

      <section style={statsGrid}>
        <div style={card}>
          <p style={label}>Total gastado</p>
          <h3 style={number}>{formatMoney(totalGastado)}</h3>
        </div>
        <div style={card}>
          <p style={label}>Empresa A</p>
          <h3 style={number}>{formatMoney(totalEmpresaA)}</h3>
        </div>
        <div style={card}>
          <p style={label}>Empresa B</p>
          <h3 style={number}>{formatMoney(totalEmpresaB)}</h3>
        </div>
        <div style={card}>
          <p style={label}>Compensación estimada</p>
          <h3 style={number}>{formatMoney(compensacion)}</h3>
        </div>
      </section>

      <section style={{ marginTop: "40px" }}>
        <h3 style={sectionTitle}>Listado de obras</h3>

        <div style={obraGrid}>
          {obras.map((obra) => (
            <Link
              key={obra.id}
              href={`/obras/${obra.id}`}
              style={{
                ...obraCard,
                textDecoration: "none",
                color: "#111111",
              }}
            >
              <p style={eyebrow}>{obra.estado}</p>
              <h3 style={{ fontWeight: 400, fontSize: "22px", margin: "12px 0" }}>
                {obra.nombre}
              </h3>
              <p style={{ color: "#666666", margin: 0 }}>{obra.ubicacion}</p>

              <div style={{ marginTop: "28px" }}>
                <p style={smallRow}>Avance: {obra.avance}%</p>
                <p style={smallRow}>Gasto: {formatMoney(obra.gastoTotal)}</p>
                <p style={smallRow}>Inicio: {obra.fechaInicio}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

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

const button = {
  background: "#111111",
  color: "#ffffff",
  border: "none",
  padding: "12px 20px",
  fontSize: "14px",
  cursor: "pointer",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "16px",
};

const card = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  background: "#ffffff",
};

const label = {
  fontSize: "13px",
  color: "#777777",
  margin: 0,
};

const number = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "12px 0 0",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
  marginBottom: "16px",
};

const obraGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "20px",
};

const obraCard = {
  border: "1px solid #e5e5e5",
  padding: "28px",
  background: "#ffffff",
  minHeight: "250px",
};

const smallRow = {
  color: "#444444",
  borderTop: "1px solid #eeeeee",
  paddingTop: "10px",
  marginTop: "10px",
};