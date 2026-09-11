import { ANCHO_SIDEBAR_CERRADO } from "@/lib/layout";

export default function AppShell({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  /** La franja lateral fija (`ObraSidebar`). Al ser `position: fixed` no
   *  empuja el contenido sola — el padding de acá abajo es lo que le deja
   *  el lugar, siempre del ancho cerrado: abrirse es una superposición. */
  sidebar?: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#111111",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {sidebar}

      <section
        style={{
          maxWidth: "1480px",
          margin: "0 auto",
          padding: sidebar
            ? `40px 40px 80px ${ANCHO_SIDEBAR_CERRADO + 40}px`
            : "40px 40px 80px",
        }}
      >
        {children}
      </section>
    </main>
  );
}
