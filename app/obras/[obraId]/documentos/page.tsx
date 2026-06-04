import Link from "next/link";
import AppShell from "@/components/AppShell";
import { documentos, obras } from "@/data/mockData";

export default async function DocumentosPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = obras.find((item) => item.id === obraId);
  const documentosObra = documentos.filter((doc) => doc.obraId === obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  return (
    <AppShell>
      <Header obraNombre={obra.nombre} titulo="Documentación" obraId={obra.id} />

      <section style={grid}>
        {documentosObra.map((doc) => (
          <article key={doc.id} style={card}>
            <p style={eyebrow}>{doc.tipo}</p>
            <h3 style={cardTitle}>{doc.nombre}</h3>
            <p style={text}>{doc.categoria}</p>
            <p style={text}>{doc.fecha}</p>
            <button style={button}>Descargar</button>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

function Header({
  obraNombre,
  titulo,
  obraId,
}: {
  obraNombre: string;
  titulo: string;
  obraId: string;
}) {
  return (
    <header style={header}>
      <div>
        <p style={eyebrow}>{obraNombre}</p>
        <h2 style={title}>{titulo}</h2>
        <p style={subtitle}>Archivos PDF, DWG y documentación de obra.</p>
      </div>

      <Link href={`/obras/${obraId}`} style={backLink}>
        Volver al resumen
      </Link>
    </header>
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
  padding: "24px",
};

const cardTitle = {
  fontSize: "20px",
  fontWeight: 400,
};

const text = {
  color: "#666666",
};

const button = {
  background: "#111111",
  color: "#ffffff",
  border: "none",
  padding: "10px 16px",
  fontSize: "14px",
  cursor: "pointer",
  marginTop: "16px",
};