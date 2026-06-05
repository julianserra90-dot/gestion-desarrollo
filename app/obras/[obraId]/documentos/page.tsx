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

  const totalDocumentos = documentosObra.length;
  const totalPdf = documentosObra.filter((doc) => doc.tipo === "PDF").length;
  const totalDwg = documentosObra.filter((doc) => doc.tipo === "DWG").length;
  const totalRevision = documentosObra.filter(
    (doc) => doc.estado === "En revisión"
  ).length;

  const categorias = [
    "Todos",
    "Arquitectura",
    "Estructura",
    "Instalaciones",
    "Presupuestos",
    "Permisos",
    "Contratos",
  ];

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Documentación</h2>
          <p style={subtitle}>
            Biblioteca de planos, contratos, presupuestos y archivos técnicos de
            obra.
          </p>
        </div>

        <Link href={`/obras/${obra.id}`} style={backLink}>
          Volver al resumen
        </Link>
      </header>

      <section style={statsGrid}>
        <div style={statCard}>
          <p style={label}>Archivos</p>
          <h3 style={number}>{totalDocumentos}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>PDF</p>
          <h3 style={number}>{totalPdf}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>DWG</p>
          <h3 style={number}>{totalDwg}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>En revisión</p>
          <h3 style={number}>{totalRevision}</h3>
        </div>
      </section>

      <section style={toolbar}>
        <div style={searchBox}>
          <span style={searchLabel}>Buscar</span>
          <input
            type="text"
            placeholder="Nombre, categoría o tipo de archivo"
            style={searchInput}
          />
        </div>

        <button style={button}>Subir documento</button>
      </section>

      <section style={filters}>
        {categorias.map((categoria) => (
          <button
            key={categoria}
            style={categoria === "Todos" ? filterButtonActive : filterButton}
          >
            {categoria}
          </button>
        ))}
      </section>

      <section style={contentLayout}>
        <div>
          <h3 style={sectionTitle}>Archivos recientes</h3>

          <div style={documentsGrid}>
            {documentosObra.map((doc) => (
              <article key={doc.id} style={documentCard}>
                <div style={cardHeader}>
                  <div style={fileIcon}>{doc.tipo}</div>

                  <div style={{ textAlign: "right" }}>
                    <p style={version}>{doc.version}</p>
                    <p
                      style={
                        doc.estado === "Vigente"
                          ? statusVigente
                          : statusRevision
                      }
                    >
                      {doc.estado}
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: "28px" }}>
                  <p style={eyebrow}>{doc.categoria}</p>
                  <h3 style={documentTitle}>{doc.nombre}</h3>
                </div>

                <div style={documentMeta}>
                  <div style={metaRow}>
                    <span>Fecha</span>
                    <strong>{doc.fecha}</strong>
                  </div>

                  <div style={metaRow}>
                    <span>Subido por</span>
                    <strong>{doc.subidoPor}</strong>
                  </div>
                </div>

                <div style={cardActions}>
                  <button style={secondaryButton}>Ver detalle</button>
                  <button style={downloadButton}>Descargar</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside style={sidePanel}>
          <p style={eyebrow}>Organización sugerida</p>
          <h3 style={sideTitle}>Carpetas de obra</h3>

          <div style={folderList}>
            {categorias
              .filter((categoria) => categoria !== "Todos")
              .map((categoria) => (
                <div key={categoria} style={folderRow}>
                  <span>{categoria}</span>
                  <strong>
                    {
                      documentosObra.filter(
                        (doc) => doc.categoria === categoria
                      ).length
                    }
                  </strong>
                </div>
              ))}
          </div>

          <p style={note}>
            Más adelante cada documento se puede guardar en Google Drive y la
            app almacena el enlace de descarga en Google Sheets.
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

const toolbar = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  border: "1px solid #e5e5e5",
  padding: "16px",
  marginBottom: "16px",
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

const filters = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px",
  marginBottom: "32px",
};

const filterButton = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "9px 12px",
  fontSize: "13px",
  cursor: "pointer",
};

const filterButtonActive = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "9px 12px",
  fontSize: "13px",
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

const documentsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "18px",
};

const documentCard = {
  border: "1px solid #e5e5e5",
  padding: "22px",
  minHeight: "280px",
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const fileIcon = {
  width: "58px",
  height: "58px",
  border: "1px solid #111111",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "13px",
  letterSpacing: "0.08em",
};

const version = {
  margin: 0,
  color: "#555555",
  fontSize: "13px",
};

const statusVigente = {
  margin: "8px 0 0",
  fontSize: "13px",
  color: "#111111",
};

const statusRevision = {
  margin: "8px 0 0",
  fontSize: "13px",
  color: "#777777",
};

const documentTitle = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "10px 0 0",
};

const documentMeta = {
  marginTop: "24px",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "10px",
  marginTop: "10px",
  color: "#555555",
  fontSize: "14px",
};

const cardActions = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  marginTop: "24px",
};

const secondaryButton = {
  flex: 1,
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "10px",
  cursor: "pointer",
};

const downloadButton = {
  flex: 1,
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "10px",
  cursor: "pointer",
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

const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: "24px",
};