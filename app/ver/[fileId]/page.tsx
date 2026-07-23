import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonDescarga from "@/components/BotonDescarga";
import * as ui from "@/components/ui";
import { buscarArchivoVisible } from "@/lib/archivos";

/**
 * Visor de archivos dentro de la app.
 *
 * Por qué existe: aunque el servidor mande el archivo con Content-Disposition
 * inline, muchos navegadores igual descargan los PDF en vez de mostrarlos
 * (depende de la configuración de cada uno). Embebido en un iframe, en cambio,
 * se abre el visor integrado y el usuario no pierde el contexto de la app.
 */
export default async function VerArchivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ fileId: string }>;
  searchParams: Promise<{ volver?: string }>;
}) {
  const { fileId } = await params;
  const { volver } = await searchParams;

  const archivo = await buscarArchivoVisible(fileId);

  if (!archivo) {
    return (
      <AppShell>
        <p style={ui.vacio}>
          Este archivo no existe o no tenés permiso para verlo.
        </p>
      </AppShell>
    );
  }

  const mime = archivo.mimeType ?? "";
  const esPdf = mime.includes("pdf") || archivo.nombre.toLowerCase().endsWith(".pdf");
  const esImagen = mime.startsWith("image/");
  const url = `/archivos/${fileId}`;

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={ui.eyebrow}>Archivo</p>
          <h2 style={titulo}>{archivo.nombre}</h2>
        </div>

        <div style={acciones}>
          <BotonDescarga fileId={fileId} etiqueta="Descargar" />

          <Link href={volver ?? "/"} style={ui.secondaryButton}>
            Volver
          </Link>
        </div>
      </header>

      {esPdf && (
        <iframe
          src={url}
          title={archivo.nombre}
          style={marco}
        />
      )}

      {esImagen && (
        <div style={marcoImagen}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={archivo.nombre} style={imagen} />
        </div>
      )}

      {!esPdf && !esImagen && (
        <div style={ui.panel}>
          <p style={{ ...ui.text, marginTop: 0 }}>
            Este tipo de archivo no se puede previsualizar en el navegador
            (por ejemplo un DWG o una planilla). Descargalo para abrirlo con el
            programa correspondiente.
          </p>

          <BotonDescarga fileId={fileId} etiqueta="Descargar archivo" />
        </div>
      )}
    </AppShell>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  borderBottom: "1px solid #e5e5e5",
  paddingBottom: "20px",
  marginBottom: "20px",
};

const titulo = {
  fontSize: "26px",
  fontWeight: 400,
  margin: "8px 0 0",
  wordBreak: "break-word" as const,
};

const acciones = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const marco = {
  width: "100%",
  height: "calc(100vh - 220px)",
  minHeight: "500px",
  border: "1px solid #e5e5e5",
  background: "#f5f5f5",
};

const marcoImagen = {
  border: "1px solid #e5e5e5",
  background: "#f5f5f5",
  padding: "16px",
  display: "flex",
  justifyContent: "center",
};

const imagen = {
  maxWidth: "100%",
  maxHeight: "calc(100vh - 260px)",
  objectFit: "contain" as const,
};
