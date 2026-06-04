export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#ffffff",
      color: "#111111",
      fontFamily: "Arial, Helvetica, sans-serif",
      padding: "48px"
    }}>
      <section style={{
        maxWidth: "1200px",
        margin: "0 auto"
      }}>
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e5e5e5",
          paddingBottom: "24px",
          marginBottom: "40px"
        }}>
          <div>
            <h1 style={{
              fontSize: "32px",
              fontWeight: 400,
              margin: 0
            }}>
              Gestión de Desarrollo
            </h1>
            <p style={{
              color: "#666666",
              marginTop: "8px"
            }}>
              Obras, gastos, documentación y avances.
            </p>
          </div>

          <button style={{
            background: "#111111",
            color: "#ffffff",
            border: "none",
            padding: "12px 20px",
            fontSize: "14px",
            cursor: "pointer"
          }}>
            Nueva obra
          </button>
        </header>

        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "40px"
        }}>
          <div style={cardStyle}>
            <p style={labelStyle}>Total gastado</p>
            <h2 style={numberStyle}>$128.750.000</h2>
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Empresa A</p>
            <h2 style={numberStyle}>$70.000.000</h2>
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Empresa B</p>
            <h2 style={numberStyle}>$58.750.000</h2>
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Compensación</p>
            <h2 style={numberStyle}>$5.625.000</h2>
          </div>
        </section>

        <section>
          <h3 style={{
            fontSize: "18px",
            fontWeight: 400,
            marginBottom: "16px"
          }}>
            Obras
          </h3>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px"
          }}>
            <article style={obraStyle}>
              <p style={labelStyle}>En ejecución</p>
              <h2 style={{ fontWeight: 400 }}>Edificio San Isidro</h2>
              <p style={{ color: "#666666" }}>San Isidro, Buenos Aires</p>

              <div style={{ marginTop: "24px" }}>
                <p style={smallRow}>Avance: 42%</p>
                <p style={smallRow}>Gasto: $84.500.000</p>
                <p style={smallRow}>Inicio: 01/06/2026</p>
              </div>
            </article>

            <article style={obraStyle}>
              <p style={labelStyle}>Proyecto</p>
              <h2 style={{ fontWeight: 400 }}>Viviendas Tigre</h2>
              <p style={{ color: "#666666" }}>Tigre, Buenos Aires</p>

              <div style={{ marginTop: "24px" }}>
                <p style={smallRow}>Avance: 12%</p>
                <p style={smallRow}>Gasto: $22.100.000</p>
                <p style={smallRow}>Inicio: 15/07/2026</p>
              </div>
            </article>

            <article style={obraStyle}>
              <p style={labelStyle}>Finalizada</p>
              <h2 style={{ fontWeight: 400 }}>Reforma Belgrano</h2>
              <p style={{ color: "#666666" }}>CABA</p>

              <div style={{ marginTop: "24px" }}>
                <p style={smallRow}>Avance: 100%</p>
                <p style={smallRow}>Gasto: $38.150.000</p>
                <p style={smallRow}>Inicio: 10/02/2026</p>
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}

const cardStyle = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  background: "#ffffff"
};

const obraStyle = {
  border: "1px solid #e5e5e5",
  padding: "28px",
  background: "#ffffff",
  minHeight: "240px"
};

const labelStyle = {
  fontSize: "13px",
  color: "#777777",
  margin: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em"
};

const numberStyle = {
  fontSize: "24px",
  fontWeight: 400,
  marginTop: "12px",
  marginBottom: 0
};

const smallRow = {
  color: "#444444",
  borderTop: "1px solid #eeeeee",
  paddingTop: "10px",
  marginTop: "10px"
};