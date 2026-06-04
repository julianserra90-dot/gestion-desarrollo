import Link from "next/link";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#111111",
        fontFamily: "Arial, Helvetica, sans-serif",
        display: "grid",
        gridTemplateColumns: "240px 1fr",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid #e5e5e5",
          padding: "32px 24px",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#111111",
            textDecoration: "none",
          }}
        >
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 400,
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            Gestión de Desarrollo
          </h1>
        </Link>

        <nav
          style={{
            display: "grid",
            gap: "12px",
            marginTop: "48px",
            fontSize: "14px",
          }}
        >
          <Link href="/" style={navLink}>
            Obras
          </Link>
          <Link href="/" style={navLink}>
            Gastos
          </Link>
          <Link href="/" style={navLink}>
            Documentos
          </Link>
          <Link href="/" style={navLink}>
            Reportes
          </Link>
        </nav>
      </aside>

      <section style={{ padding: "40px" }}>{children}</section>
    </main>
  );
}

const navLink = {
  color: "#444444",
  textDecoration: "none",
  borderBottom: "1px solid #eeeeee",
  paddingBottom: "12px",
};