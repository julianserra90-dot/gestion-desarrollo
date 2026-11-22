import { ANCHO_SIDEBAR_CERRADO } from "@/lib/layout";

export default function AppShell({
  children,
  sidebar,
  pantallaCompleta = false,
}: {
  children: React.ReactNode;
  /** La franja lateral fija (`ObraSidebar`). Al ser `position: fixed` no
   *  empuja el contenido sola — el padding de acá abajo es lo que le deja
   *  el lugar, siempre del ancho cerrado: abrirse es una superposición. */
  sidebar?: React.ReactNode;
  /**
   * Para una pantalla que es una mesa de trabajo y no una página que se lee
   * —el editor de plantas—: usa todo el ancho de la ventana y casi no deja
   * margen, así lo que hay adentro puede medir justo el alto de la ventana y
   * no hace falta correr la página para verlo entero.
   */
  pantallaCompleta?: boolean;
}) {
  const borde = pantallaCompleta ? 16 : 40;
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
          maxWidth: pantallaCompleta ? "none" : "1480px",
          margin: "0 auto",
          padding: `${borde}px ${borde}px ${pantallaCompleta ? borde : 80}px ${
            (sidebar ? ANCHO_SIDEBAR_CERRADO : 0) + borde
          }px`,
        }}
      >
        {children}
      </section>
    </main>
  );
}
