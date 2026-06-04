import Link from "next/link";
import AppShell from "@/components/AppShell";
import { avances, obras } from "@/data/mockData";

export default async function AvancesPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = obras.find((item) => item.id === obraId);
  const avancesObra = avances.filter((avance) => avance.obraId === obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Avances</h2>
          <p style={subtitle}>Seguimiento físico por rubro o etapa.</p>
        </div>

        <Link href={`/obras/${obra.id}`} style={backLink}>
          Volver al resumen
        </Link>
      </header>

      <section style={panel}>
        {avancesObra.map((item) => (
          <div key={item.id} style={advanceRow}>
            <div>
              <h3 style={rowTitle}>{item.rubro}</h3>
              <p style={text}>Avance físico registrado</p>
            </div>

            <div style={{ minWidth: "280px" }}>
              <div style={progressBackground}>
                <div
                  style={{
                    ...progressFill,
                    width: `${item.avance}%`,
                  }}
                />
              </div>
              <p style={{ ...text, textAlign: "right" }}>{item.avance}%</p>
            </div>
          </div>
        ))}
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

const advanceRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #eeeeee",
  padding: "20px 0",
};

const rowTitle = {
  fontSize: "20px",
  fontWeight: 400,
  margin: 0,
};

const text = {
  color: "#666666",
  margin: "8px 0 0",
};

const progressBackground = {
  height: "8px",
  background: "#eeeeee",
};

const progressFill = {
  height: "8px",
  background: "#111111",
};