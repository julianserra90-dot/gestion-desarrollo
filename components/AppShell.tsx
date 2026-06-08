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
      }}
    >
      <section
        style={{
          maxWidth: "1480px",
          margin: "0 auto",
          padding: "40px",
        }}
      >
        {children}
      </section>
    </main>
  );
}