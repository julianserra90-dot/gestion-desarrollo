import Link from "next/link";
import AppShell from "@/components/AppShell";
import { fotos, obras } from "@/data/mockData";

export default async function FotosPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = obras.find((item) => item.id === obraId);
  const fotosObra = fotos.filter((foto) => foto.obraId === obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Fotos</h2>
          <p style={subtitle}>Registro visual de avances y etapas de obra.</p>
        </div>

        <Link href={`/obras/${obra.id}`} style={backLink}>
          Volver al resumen
        </Link>
      </header>

      <section style={grid}>
        {fotosObra.map((foto) => (
          <article key={foto.id} style={card}>
            <div style={imagePlaceholder}>Imagen</div>
            <p style={eyebrow}>{foto.fecha}</p>
            <h3 style={cardTitle}>{foto.etapa}</h3>
            <p style={text}>{foto.descripcion}</p>
          </article>
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

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "20px",
};

const card = {
  border: "1px solid #e5e5e5",
  padding: "20px",
};

const imagePlaceholder = {
  height: "180px",
  border: "1px solid #e5e5e5",
  background: "#f7f7f7",
  color: "#999999",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "20px",
};

const cardTitle = {
  fontSize: "20px",
  fontWeight: 400,
};

const text = {
  color: "#666666",
};