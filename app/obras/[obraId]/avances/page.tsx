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

  const avancePromedio = Math.round(
    avancesObra.reduce((acc, item) => acc + item.avance, 0) / avancesObra.length
  );

  const rubrosFinalizados = avancesObra.filter(
    (item) => item.estado === "Finalizado"
  ).length;

  const rubrosEnEjecucion = avancesObra.filter(
    (item) => item.estado === "En ejecución" || item.estado === "Inicial"
  ).length;

  const totalFotosAsociadas = avancesObra.reduce(
    (acc, item) => acc + item.fotosAsociadas,
    0
  );

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Avances</h2>
          <p style={subtitle}>
            Seguimiento físico por rubro, con comentarios técnicos y fotos
            asociadas.
          </p>
        </div>

        <Link href={`/obras/${obra.id}`} style={backLink}>
          Volver al resumen
        </Link>
      </header>

      <section style={statsGrid}>
        <div style={statCard}>
          <p style={label}>Avance general</p>
          <h3 style={number}>{avancePromedio}%</h3>
        </div>

        <div style={statCard}>
          <p style={label}>Rubros finalizados</p>
          <h3 style={number}>{rubrosFinalizados}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>Rubros activos</p>
          <h3 style={number}>{rubrosEnEjecucion}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>Fotos asociadas</p>
          <h3 style={number}>{totalFotosAsociadas}</h3>
        </div>
      </section>

      <section style={mainProgressPanel}>
        <div>
          <p style={eyebrow}>Avance físico promedio</p>
          <h3 style={mainProgressTitle}>{avancePromedio}% ejecutado</h3>
          <p style={subtitle}>
            Este porcentaje surge del promedio de avance registrado en los rubros
            cargados.
          </p>
        </div>

        <div style={mainProgressBar}>
          <div
            style={{
              ...mainProgressFill,
              width: `${avancePromedio}%`,
            }}
          />
        </div>
      </section>

      <section style={toolbar}>
        <div style={searchBox}>
          <span style={searchLabel}>Buscar</span>
          <input
            type="text"
            placeholder="Buscar por rubro, estado o comentario"
            style={searchInput}
          />
        </div>

        <button style={button}>Actualizar avance</button>
      </section>

      <section style={contentLayout}>
        <div>
          <h3 style={sectionTitle}>Avance por rubro</h3>

          <div style={advanceList}>
            {avancesObra.map((item) => (
              <article key={item.id} style={advanceCard}>
                <div style={advanceHeader}>
                  <div>
                    <p style={eyebrow}>{item.estado}</p>
                    <h3 style={advanceTitle}>{item.rubro}</h3>
                  </div>

                  <strong style={advanceNumber}>{item.avance}%</strong>
                </div>

                <div style={progressBackground}>
                  <div
                    style={{
                      ...progressFill,
                      width: `${item.avance}%`,
                    }}
                  />
                </div>

                <p style={comment}>{item.comentario}</p>

                <div style={metaGrid}>
                  <div style={metaItem}>
                    <span>Última actualización</span>
                    <strong>{item.fecha}</strong>
                  </div>

                  <div style={metaItem}>
                    <span>Actualizado por</span>
                    <strong>{item.actualizadoPor}</strong>
                  </div>

                  <div style={metaItem}>
                    <span>Fotos asociadas</span>
                    <strong>{item.fotosAsociadas}</strong>
                  </div>
                </div>

                <div style={cardActions}>
                  <Link
                    href={`/obras/${obra.id}/fotos`}
                    style={secondaryButton}
                  >
                    Ver fotos
                  </Link>

                  <Link
  href={`/obras/${obra.id}/avances/${item.id}/editar`}
  style={downloadButton}
>
  Editar avance
</Link>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside style={sidePanel}>
          <p style={eyebrow}>Lectura de obra</p>
          <h3 style={sideTitle}>Estado general</h3>

          <div style={sideProgressBox}>
            <span>Avance físico</span>
            <strong>{avancePromedio}%</strong>
          </div>

          <div style={sideProgressMini}>
            <div
              style={{
                ...sideProgressMiniFill,
                width: `${avancePromedio}%`,
              }}
            />
          </div>

          <div style={folderList}>
            {avancesObra.map((item) => (
              <div key={item.id} style={folderRow}>
                <div>
                  <span>{item.rubro}</span>
                  <p style={folderNote}>{item.estado}</p>
                </div>
                <strong>{item.avance}%</strong>
              </div>
            ))}
          </div>

          <p style={note}>
            Más adelante esta sección puede comparar avance físico contra avance
            financiero para detectar desvíos de costo o planificación.
          </p>
        </aside>
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
  maxWidth: "640px",
  lineHeight: 1.5,
};

const backLink = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
  paddingBottom: "4px",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "16px",
  marginBottom: "24px",
};

const statCard = {
  border: "1px solid #e5e5e5",
  padding: "22px",
};

const label = {
  fontSize: "13px",
  color: "#777777",
  margin: 0,
};

const number = {
  fontSize: "24px",
  fontWeight: 400,
  margin: "10px 0 0",
};

const mainProgressPanel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  marginBottom: "24px",
};

const mainProgressTitle = {
  fontSize: "28px",
  fontWeight: 400,
  margin: "10px 0",
};

const mainProgressBar = {
  height: "10px",
  background: "#eeeeee",
  marginTop: "24px",
};

const mainProgressFill = {
  height: "10px",
  background: "#111111",
};

const toolbar = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  border: "1px solid #e5e5e5",
  padding: "16px",
  marginBottom: "32px",
};

const searchBox = {
  display: "grid",
  gap: "8px",
  flex: 1,
};

const searchLabel = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#777777",
};

const searchInput = {
  border: "1px solid #dcdcdc",
  padding: "12px",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "14px",
};

const button = {
  alignSelf: "end",
  background: "#111111",
  color: "#ffffff",
  border: "none",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
};

const contentLayout = {
  display: "grid",
  gridTemplateColumns: "1fr 300px",
  gap: "24px",
  alignItems: "start",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
  marginTop: 0,
  marginBottom: "16px",
};

const advanceList = {
  display: "grid",
  gap: "18px",
};

const advanceCard = {
  border: "1px solid #e5e5e5",
  padding: "24px",
};

const advanceHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
};

const advanceTitle = {
  fontSize: "24px",
  fontWeight: 400,
  margin: "10px 0 0",
};

const advanceNumber = {
  fontSize: "28px",
  fontWeight: 400,
};

const progressBackground = {
  height: "8px",
  background: "#eeeeee",
  marginTop: "22px",
};

const progressFill = {
  height: "8px",
  background: "#111111",
};

const comment = {
  color: "#555555",
  lineHeight: 1.5,
  marginTop: "18px",
};

const metaGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "12px",
  marginTop: "20px",
};

const metaItem = {
  borderTop: "1px solid #eeeeee",
  paddingTop: "10px",
  display: "grid",
  gap: "6px",
  color: "#555555",
  fontSize: "14px",
};

const cardActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "24px",
};

const secondaryButton = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "10px 16px",
  cursor: "pointer",
  textDecoration: "none",
  fontSize: "14px",
};

const downloadButton = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "10px 16px",
  cursor: "pointer",
  textDecoration: "none",
};

const sidePanel = {
  border: "1px solid #e5e5e5",
  padding: "22px",
  position: "sticky" as const,
  top: "24px",
};

const sideTitle = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "10px 0 22px",
};

const sideProgressBox = {
  display: "flex",
  justifyContent: "space-between",
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "12px",
};

const sideProgressMini = {
  height: "8px",
  background: "#eeeeee",
  marginBottom: "24px",
};

const sideProgressMiniFill = {
  height: "8px",
  background: "#111111",
};

const folderList = {
  display: "grid",
  gap: "10px",
};

const folderRow = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "10px",
};

const folderNote = {
  color: "#777777",
  fontSize: "13px",
  margin: "4px 0 0",
};

const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: "24px",
};