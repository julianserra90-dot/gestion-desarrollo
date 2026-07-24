import Link from "next/link";

type Obra = {
  /** Identificador que va en la URL. */
  slug: string;
  nombre: string;
  ubicacion: string | null;
  estado: string;
};

type Solapa = { key: string; label: string; path: string };

/**
 * Las secciones de una obra, en dos niveles y dos grupos: la plata y la obra.
 *
 * Diez solapas en una fila obligaban a leerlas todas para encontrar una, y
 * ponían Dólares al mismo nivel que Rubros, que no se parecen en nada. Partido
 * en dos, la pregunta que se hace primero —¿vengo a mirar plata o a mirar cómo
 * va la obra?— se contesta antes de buscar.
 *
 * Cada grupo entra por su resumen: Economía por el balance entre socias, Obra
 * por el estado general —avance contra calendario—. Las dos portadas contestan
 * "¿cómo venimos?" antes de que haya que abrir nada.
 */
const SECCIONES: (Solapa & { hijas?: Solapa[] })[] = [
  {
    key: "economia",
    label: "Economía",
    path: "",
    hijas: [
      { key: "economia", label: "Balance", path: "" },
      { key: "gastos", label: "Gastos", path: "/gastos" },
      { key: "ingresos", label: "Ingresos", path: "/ingresos" },
      { key: "caja", label: "Dinero en cuenta", path: "/dinero-en-cuenta" },
      { key: "dolares", label: "Dólares", path: "/dolares" },
    ],
  },
  {
    key: "obra",
    label: "Obra",
    path: "/estado",
    hijas: [
      { key: "estado", label: "Estado", path: "/estado" },
      { key: "presupuestos", label: "Presupuestos", path: "/presupuestos" },
      { key: "avances", label: "Avances", path: "/avances" },
      { key: "fotos", label: "Fotos", path: "/fotos" },
      { key: "documentos", label: "Documentos", path: "/documentos" },
      { key: "rubros", label: "Rubros", path: "/rubros" },
    ],
  },
];

export default function ObraHeader({
  obra,
  activeSection,
}: {
  obra: Obra;
  activeSection: string;
}) {
  const href = (path: string) => `/obras/${obra.slug}${path}`;

  // La sección de arriba que corresponde: la propia, o la madre de la activa.
  const seccion = SECCIONES.find(
    (s) => s.key === activeSection || s.hijas?.some((h) => h.key === activeSection)
  );

  return (
    <>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.estado}</p>
          <h2 style={title}>{obra.nombre}</h2>
          <p style={subtitle}>{obra.ubicacion}</p>
        </div>

        <div style={headerActions}>
          <Link href={href("/editar")} style={editLink}>
            Editar obra
          </Link>

          <Link href="/" style={backLink}>
            Volver a obras
          </Link>
        </div>
      </header>

      <nav style={tabsContainer}>
        {SECCIONES.map((s) => (
          <Link
            key={s.key}
            href={href(s.path)}
            style={seccion?.key === s.key ? tabActive : tabItem}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {seccion?.hijas && (
        <nav style={subTabsContainer}>
          {seccion.hijas.map((h) => (
            <Link
              key={h.key}
              href={href(h.path)}
              style={activeSection === h.key ? subTabActive : subTabItem}
            >
              {h.label}
            </Link>
          ))}
        </nav>
      )}
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
  ...tabItem,
  color: "#ffffff",
  border: "1px solid #111111",
  background: "#111111",
};

// El segundo nivel no repite las cajas del primero: si las dos filas se ven
// igual, no se entiende cuál cuelga de cuál.
const subTabsContainer = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "20px",
  marginTop: "-16px",
  marginBottom: "32px",
  paddingBottom: "12px",
  borderBottom: "1px solid #e5e5e5",
};

const subTabItem = {
  color: "#777777",
  textDecoration: "none",
  fontSize: "14px",
  paddingBottom: "4px",
  borderBottom: "2px solid transparent",
};

const subTabActive = {
  ...subTabItem,
  color: "#111111",
  borderBottom: "2px solid #111111",
};
