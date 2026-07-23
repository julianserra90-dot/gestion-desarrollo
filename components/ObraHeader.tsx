import Link from "next/link";

type Obra = {
  /** Identificador que va en la URL. */
  slug: string;
  nombre: string;
  ubicacion: string | null;
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
    { label: "Economía", href: `/obras/${obra.slug}`, key: "economia" },
    { label: "Gastos", href: `/obras/${obra.slug}/gastos`, key: "gastos" },
    { label: "Dólares", href: `/obras/${obra.slug}/dolares`, key: "dolares" },
    { label: "Avances", href: `/obras/${obra.slug}/avances`, key: "avances" },
    { label: "Fotos", href: `/obras/${obra.slug}/fotos`, key: "fotos" },
    { label: "Documentos", href: `/obras/${obra.slug}/documentos`, key: "documentos" },
    { label: "Rubros", href: `/obras/${obra.slug}/rubros`, key: "rubros" },
  ];

  return (
    <>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.estado}</p>
          <h2 style={title}>{obra.nombre}</h2>
          <p style={subtitle}>{obra.ubicacion}</p>
        </div>

        <div style={headerActions}>
          <Link href={`/obras/${obra.slug}/editar`} style={editLink}>
            Editar obra
          </Link>

          <Link href="/" style={backLink}>
            Volver a obras
          </Link>
        </div>
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

const headerActions = {
  display: "flex",
  gap: "16px",
  alignItems: "center",
};

const editLink = {
  color: "#111111",
  textDecoration: "none",
  border: "1px solid #dcdcdc",
  padding: "10px 14px",
  fontSize: "14px",
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