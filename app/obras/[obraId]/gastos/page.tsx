import Link from "next/link";
import AppShell from "@/components/AppShell";
import { formatMoney, gastos, obras } from "@/data/mockData";

export default async function GastosPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = obras.find((item) => item.id === obraId);
  const gastosObra = gastos.filter((gasto) => gasto.obraId === obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Gastos</h2>
          <p style={subtitle}>Carga y control de gastos de la obra.</p>
        </div>

        <Link href={`/obras/${obra.id}`} style={backLink}>
          Volver al resumen
        </Link>
      </header>

      <section style={panel}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "20px",
            alignItems: "center",
          }}
        >
          <h3 style={sectionTitle}>Listado de gastos</h3>

          <Link href={`/obras/${obra.id}/gastos/nuevo`} style={button}>
            Nuevo gasto
          </Link>
        </div>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Rubro</th>
              <th style={th}>Concepto</th>
              <th style={th}>Proveedor</th>
              <th style={th}>Pagó</th>
              <th style={th}>Monto</th>
              <th style={th}>50%</th>
              <th style={th}>Estado</th>
            </tr>
          </thead>

          <tbody>
            {gastosObra.map((gasto) => (
              <tr key={gasto.id}>
                <td style={td}>{gasto.fecha}</td>
                <td style={td}>{gasto.rubro}</td>
                <td style={td}>{gasto.concepto}</td>
                <td style={td}>{gasto.proveedor}</td>
                <td style={td}>{gasto.empresaPagadora}</td>
                <td style={td}>{formatMoney(gasto.monto)}</td>
                <td style={td}>{formatMoney(gasto.monto / 2)}</td>
                <td style={td}>{gasto.estado}</td>
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

const panel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
  margin: 0,
};

const button = {
  background: "#111111",
  color: "#ffffff",
  border: "none",
  padding: "10px 16px",
  fontSize: "14px",
  cursor: "pointer",
  textDecoration: "none",
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