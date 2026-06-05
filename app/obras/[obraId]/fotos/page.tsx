"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { fotos, obras } from "@/data/mockData";

export default function FotosPage() {
  const params = useParams();
  const obraId = params.obraId as string;

  const obra = obras.find((item) => item.id === obraId);
  const fotosObra = fotos.filter((foto) => foto.obraId === obraId);

  const rubros = [
    "Todos",
    "Movimiento de suelo",
    "Hormigón armado",
    "Albañilería",
    "Instalación sanitaria",
    "Instalación eléctrica",
    "Carpinterías",
    "Terminaciones",
  ];

  const [rubroActivo, setRubroActivo] = useState("Todos");

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const fotosFiltradas =
    rubroActivo === "Todos"
      ? fotosObra
      : fotosObra.filter((foto) => foto.rubro === rubroActivo);

  const totalRegistros = fotosFiltradas.length;
  const totalFotos = fotosFiltradas.reduce((acc, foto) => acc + foto.cantidad, 0);
  const pendientes = fotosFiltradas.filter(
    (foto) => foto.estado === "Pendiente de revisión"
  ).length;

  const rubrosConFotos = new Set(fotosFiltradas.map((foto) => foto.rubro)).size;

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Fotos de obra</h2>
          <p style={subtitle}>
            Registro visual de avances, ordenado por fecha, rubro y etapa de obra.
          </p>
        </div>

        <Link href={`/obras/${obra.id}`} style={backLink}>
          Volver al resumen
        </Link>
      </header>

      <section style={statsGrid}>
        <div style={statCard}>
          <p style={label}>Registros</p>
          <h3 style={number}>{totalRegistros}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>Fotos cargadas</p>
          <h3 style={number}>{totalFotos}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>Rubros visibles</p>
          <h3 style={number}>{rubrosConFotos}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>Pendientes</p>
          <h3 style={number}>{pendientes}</h3>
        </div>
      </section>

      <section style={toolbar}>
        <div style={searchBox}>
          <span style={searchLabel}>Buscar</span>
          <input
            type="text"
            placeholder="Buscar por rubro, fecha o descripción"
            style={searchInput}
          />
        </div>

        <button style={button}>Subir fotos</button>
      </section>

      <section style={filters}>
        {rubros.map((rubro) => {
          const count =
            rubro === "Todos"
              ? fotosObra.length
              : fotosObra.filter((foto) => foto.rubro === rubro).length;

          return (
            <button
              key={rubro}
              type="button"
              onClick={() => setRubroActivo(rubro)}
              style={rubroActivo === rubro ? filterButtonActive : filterButton}
            >
              {rubro} <span style={filterCount}>{count}</span>
            </button>
          );
        })}
      </section>

      <section style={activeFilterBar}>
        <span>Filtro activo</span>
        <strong>{rubroActivo}</strong>
      </section>

      <section style={contentLayout}>
        <div>
          <h3 style={sectionTitle}>Galería por rubro</h3>

          {fotosFiltradas.length === 0 ? (
            <div style={emptyState}>
              <h3 style={emptyTitle}>No hay fotos cargadas en este rubro</h3>
              <p style={emptyText}>
                Cuando se carguen imágenes de esta etapa, van a aparecer en esta
                sección.
              </p>
            </div>
          ) : (
            <div style={galleryGrid}>
              {fotosFiltradas.map((foto) => (
                <article key={foto.id} style={photoCard}>
                  <div style={imagePlaceholder}>
                    <div style={imageText}>
                      <span>{foto.rubro}</span>
                      <strong>{foto.cantidad} fotos</strong>
                    </div>
                  </div>

                  <div style={cardContent}>
                    <div style={cardHeader}>
                      <p style={eyebrow}>{foto.fecha}</p>
                      <p
                        style={
                          foto.estado === "Registrado"
                            ? statusRegistrado
                            : statusPendiente
                        }
                      >
                        {foto.estado}
                      </p>
                    </div>

                    <h3 style={photoTitle}>{foto.rubro}</h3>
                    <p style={description}>{foto.descripcion}</p>

                    <div style={meta}>
                      <div style={metaRow}>
                        <span>Subido por</span>
                        <strong>{foto.subidoPor}</strong>
                      </div>

                      <div style={metaRow}>
                        <span>Cantidad</span>
                        <strong>{foto.cantidad} imágenes</strong>
                      </div>
                    </div>

                    <div style={cardActions}>
                      <button style={secondaryButton}>Ver galería</button>
                      <button style={downloadButton}>Descargar</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside style={sidePanel}>
          <p style={eyebrow}>Filtro por rubro</p>
          <h3 style={sideTitle}>Resumen fotográfico</h3>

          <div style={folderList}>
            {rubros
              .filter((rubro) => rubro !== "Todos")
              .map((rubro) => {
                const registros = fotosObra.filter(
                  (foto) => foto.rubro === rubro
                );
                const cantidadFotos = registros.reduce(
                  (acc, foto) => acc + foto.cantidad,
                  0
                );

                return (
                  <button
                    key={rubro}
                    type="button"
                    onClick={() => setRubroActivo(rubro)}
                    style={
                      rubroActivo === rubro ? folderRowActive : folderRowButton
                    }
                  >
                    <div>
                      <span>{rubro}</span>
                      <p style={folderNote}>{registros.length} registros</p>
                    </div>
                    <strong>{cantidadFotos}</strong>
                  </button>
                );
              })}
          </div>

          <button
            type="button"
            onClick={() => setRubroActivo("Todos")}
            style={clearFilterButton}
          >
            Ver todos los rubros
          </button>

          <p style={note}>
            Este filtro ya funciona visualmente. Más adelante las imágenes reales
            se van a guardar en Google Drive y se van a vincular desde Google
            Sheets.
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
  marginBottom: "16px",
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

const filterCount = {
  marginLeft: "6px",
  color: "inherit",
  opacity: 0.65,
};

const activeFilterBar = {
  display: "flex",
  justifyContent: "space-between",
  border: "1px solid #e5e5e5",
  padding: "12px 16px",
  marginBottom: "32px",
  color: "#555555",
  fontSize: "14px",
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

const galleryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "18px",
};

const photoCard = {
  border: "1px solid #e5e5e5",
  background: "#ffffff",
};

const imagePlaceholder = {
  height: "220px",
  background:
    "linear-gradient(135deg, #f3f3f3 0%, #f9f9f9 50%, #eeeeee 100%)",
  borderBottom: "1px solid #e5e5e5",
  display: "flex",
  alignItems: "flex-end",
  padding: "18px",
  boxSizing: "border-box" as const,
};

const imageText = {
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  color: "#555555",
  fontSize: "13px",
};

const cardContent = {
  padding: "22px",
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const statusRegistrado = {
  margin: 0,
  fontSize: "13px",
  color: "#111111",
};

const statusPendiente = {
  margin: 0,
  fontSize: "13px",
  color: "#777777",
};

const photoTitle = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "14px 0 0",
};

const description = {
  color: "#666666",
  lineHeight: 1.5,
  minHeight: "48px",
};

const meta = {
  marginTop: "20px",
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

const folderRowButton = {
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  background: "#ffffff",
  color: "#111111",
  border: "none",
  borderTop: "1px solid #eeeeee",
  padding: "10px 0 0",
  textAlign: "left" as const,
  cursor: "pointer",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const folderRowActive = {
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  background: "#f7f7f7",
  color: "#111111",
  border: "1px solid #111111",
  padding: "10px",
  textAlign: "left" as const,
  cursor: "pointer",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const folderNote = {
  color: "#777777",
  fontSize: "13px",
  margin: "4px 0 0",
};

const clearFilterButton = {
  width: "100%",
  marginTop: "18px",
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "10px",
  cursor: "pointer",
};

const emptyState = {
  border: "1px solid #e5e5e5",
  padding: "32px",
};

const emptyTitle = {
  fontSize: "22px",
  fontWeight: 400,
  marginTop: 0,
};

const emptyText = {
  color: "#666666",
  lineHeight: 1.5,
};

const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: "24px",
};