import Link from "next/link";
import AppShell from "@/components/AppShell";
import { formatMoney, obras, gastos } from "@/data/mockData";

export default async function ObraDetalle({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = obras.find((item) => item.id === obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const gastosObra = gastos.filter((gasto) => gasto.obraId === obra.id);
  const correspondeCadaEmpresa = obra.gastoTotal / 2;
  const diferenciaEmpresaA = obra.empresaA - correspondeCadaEmpresa;

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.estado}</p>
          <h2 style={title}>{obra.nombre}</h2>
          <p style={subtitle}>{obra.ubicacion}</p>
        </div>

        <Link href="/" style={backLink}>
          Volver a obras
        </Link>
      </header>

      <nav style={tabs}>
        <Link href={`/obras/${obra.id}`} style={tab}>
          Resumen
        </Link>
        <Link href={`/obras/${obra.id}/gastos`} style={tab}>
          Gastos
        </Link>
        <Link href={`/obras/${obra.id}/documentos`} style={tab}>
          Documentos
        </Link>
        <Link href={`/obras/${obra.id}/fotos`} style={tab}>
          Fotos
        </Link>
        <Link href={`/obras/${obra.id}/avances`} style={tab}>
          Avances
        </Link>
        <Link href={`/obras/${obra.id}/reportes`} style={tab}>
  Reportes
</Link>
      </nav>

      <section style={statsGrid}>
        <div style={card}>
          <p style={label}>Total gastado</p>
          <h3 style={number}>{formatMoney(obra.gastoTotal)}</h3>
        </div>
        <div style={card}>
          <p style={label}>Pagado Empresa A</p>
          <h3 style={number}>{formatMoney(obra.empresaA)}</h3>
        </div>
        <div style={card}>
          <p style={label}>Pagado Empresa B</p>
          <h3 style={number}>{formatMoney(obra.empresaB)}</h3>
        </div>
        <div style={card}>
          <p style={label}>Avance físico</p>
          <h3 style={number}>{obra.avance}%</h3>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "20px", marginTop: "32px" }}>
        <div style={panel}>
          <h3 style={sectionTitle}>Balance entre empresas</h3>
          <p style={text}>
            Cada empresa debería aportar el 50% del gasto total:
          </p>

          <div style={row}>
            <span>Corresponde a cada empresa</span>
            <strong>{formatMoney(correspondeCadaEmpresa)}</strong>
          </div>

          <div style={row}>
            <span>Saldo Empresa A</span>
            <strong>{formatMoney(diferenciaEmpresaA)}</strong>
          </div>

          <p style={note}>
            Si el saldo es positivo, Empresa A aportó de más. Si es negativo,
            Empresa A debe compensar.
          </p>
        </div>

        <div style={panel}>
          <h3 style={sectionTitle}>Tiempo de obra</h3>
          <div style={row}>
            <span>Inicio</span>
            <strong>{obra.fechaInicio}</strong>
          </div>
          <div style={row}>
            <span>Fin estimado</span>
            <strong>{obra.fechaFin}</strong>
          </div>
          <div style={row}>
            <span>Avance</span>
            <strong>{obra.avance}%</strong>
          </div>
        </div>
      </section>

      <section style={panelWithMargin}>
        <h3 style={sectionTitle}>Últimos gastos</h3>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Rubro</th>
              <th style={th}>Concepto</th>
              <th style={th}>Pagó</th>
              <th style={th}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {gastosObra.map((gasto) => (
              <tr key={gasto.id}>
                <td style={td}>{gasto.fecha}</td>
                <td style={td}>{gasto.rubro}</td>
                <td style={td}>{gasto.concepto}</td>
                <td style={td}>{gasto.empresaPagadora}</td>
                <td style={td}>{formatMoney(gasto.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  marginBottom: "24px",
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

const tabs = {
  display: "flex",
  gap: "8px",
  marginBottom: "32px",
};

const tab = {
  color: "#111111",
  textDecoration: "none",
  border: "1px solid #e5e5e5",
  padding: "10px 14px",
  fontSize: "14px",
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

const panel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
};

const panelWithMargin = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  marginTop: "32px",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
  marginTop: 0,
};

const text = {
  color: "#555555",
};

const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
  marginTop: "12px",
};

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const th = {
  textAlign: "left" as const,
  fontSize: "12px",
  color: "#777777",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  borderBottom: "1px solid #e5e5e5",
  padding: "12px",
};

const td = {
  borderBottom: "1px solid #eeeeee",
  padding: "14px 12px",
  color: "#333333",
};