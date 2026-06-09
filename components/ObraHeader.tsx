import Link from "next/link";

type Obra = {
  id: string;
  nombre: string;
  ubicacion: string;
  estado: string;
};

export default function ObraHeader({
  obra,
  activeSection,
}: {
  obra: Obra;
  activeSection: string;
}) {
  const tabs = [
    { label: "Resumen", href: `/obras/${obra.id}`, key: "resumen" },
    { label: "Gastos", href: `/obras/${obra.id}/gastos`, key: "gastos" },
    { label: "Documentos", href: `/obras/${obra.id}/documentos`, key: "documentos" },
    { label: "Fotos", href: `/obras/${obra.id}/fotos`, key: "fotos" },
    { label: "Avances", href: `/obras/${obra.id}/avances`, key: "avances" },
    { label: "Reportes", href: `/obras/${obra.id}/reportes`, key: "reportes" },
  ];

  return (
    <>
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

      <nav style={tabsContainer}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            style={activeSection === tab.key ? tabActive : tabItem}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
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

const tabsContainer = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px",
  marginBottom: "32px",
};

const tabItem = {
  color: "#111111",
  textDecoration: "none",
  border: "1px solid #e5e5e5",
  padding: "10px 14px",
  fontSize: "14px",
  background: "#ffffff",
};

const tabActive = {
  color: "#ffffff",
  textDecoration: "none",
  border: "1px solid #111111",
  padding: "10px 14px",
  fontSize: "14px",
  background: "#111111",
};