import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { carpetaEn, cuantosHay, getArchivo, type ArchivoDeCarpeta } from "@/lib/archivo";
import { formatDate } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";

/**
 * El Archivo de la obra, como un Drive: carpetas y archivos en mosaico, del
 * mismo tamaño, y arriba por dónde se va. Lo arma `getArchivo` con todo lo
 * que se fue cargando; un archivo se abre en otra pestaña.
 *
 * En qué carpeta se está va en la dirección (`?ruta=Obra/Albañilería`), así
 * se puede volver y compartir el enlace.
 */
export default async function ArchivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ ruta?: string }>;
}) {
  const { obraId } = await params;
  const { ruta } = await searchParams;
  const obra = await getObraPorSlug(obraId);
  if (!obra) return <AppShell>Obra no encontrada</AppShell>;

  const raiz = await getArchivo(obra.id);
  const camino = (ruta ?? "").split("/").filter(Boolean);
  const carpeta = carpetaEn(raiz, camino) ?? raiz;
  const enLaRaiz = carpeta === raiz;
  const base = `/obras/${obra.slug}/archivo`;
  const hasta = (n: number) => (n === 0 ? base : `${base}?ruta=${encodeURIComponent(camino.slice(0, n).join("/"))}`);

  return (
    <AppShell sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="documentos" />}>
      <ObraHeader obra={obra} activeSection="documentos" ocultarNav />

      <section style={cabecera}>
        <div>
          <p style={ui.eyebrow}>Documentación</p>
          <h2 style={ui.pageTitle}>Archivo</h2>
        </div>
        <Link href={`/obras/${obra.slug}/documentos/nuevo`} style={ui.button}>
          Subir documento
        </Link>
      </section>

      {/* Por dónde se va: Archivo › Obra › Albañilería. */}
      <nav style={migas} aria-label="Carpetas">
        <Link href={base} style={enLaRaiz ? migaActual : miga}>
          Archivo
        </Link>
        {camino.slice(0, enLaRaiz ? 0 : camino.length).map((nombre, i) => (
          <span key={i} style={{ display: "contents" }}>
            <span style={separador}>›</span>
            <Link href={hasta(i + 1)} style={i === camino.length - 1 ? migaActual : miga}>
              {conMayuscula(nombre)}
            </Link>
          </span>
        ))}
      </nav>

      {carpeta.carpetas.length + carpeta.archivos.length === 0 ? (
        <p style={ui.vacio}>Vacío.</p>
      ) : (
        <div style={mosaico}>
          {carpeta.carpetas.map((c) => (
            <Link
              key={c.nombre}
              href={`${base}?ruta=${encodeURIComponent([...camino, c.nombre].join("/"))}`}
              style={tarjeta}
            >
              <IconoCarpeta />
              <span style={nombreDeTarjeta}>{conMayuscula(c.nombre)}</span>
              <span style={detalle}>{cuantosHay(c)}</span>
            </Link>
          ))}
          {carpeta.archivos.map((a) => (
            <a
              key={a.id}
              href={`/archivos/${a.id}`}
              target="_blank"
              rel="noreferrer"
              style={tarjeta}
              title={a.nombre}
            >
              <IconoArchivo tipo={tipoDe(a)} />
              <span style={nombreDeTarjeta}>{a.nombre}</span>
              <span style={detalle}>{formatDate(a.fecha)}</span>
            </a>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function conMayuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Qué es un archivo, por su tipo o su extensión: un PDF, una imagen u otro. */
function tipoDe(a: ArchivoDeCarpeta): "pdf" | "imagen" | "otro" {
  const que = `${a.mime ?? ""} ${a.nombre}`.toLowerCase();
  if (/pdf/.test(que)) return "pdf";
  if (/image|\.(jpe?g|png|webp|gif|heic)\b/.test(que)) return "imagen";
  return "otro";
}

function IconoCarpeta() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="#f3efe8" stroke="#3d3a35" strokeWidth="1.2" strokeLinejoin="round">
      <path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9.5A1.5 1.5 0 0 0 19.5 8h-7.6l-2-2.5H4.5A1.5 1.5 0 0 0 3 7Z" />
    </svg>
  );
}

function IconoArchivo({ tipo }: { tipo: "pdf" | "imagen" | "otro" }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="#ffffff" stroke="#3d3a35" strokeWidth="1.2" strokeLinejoin="round">
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" fill="none" />
      {tipo === "pdf" && (
        <text x="11.5" y="16.5" textAnchor="middle" fontSize="5" fontWeight="700" fill="#b42318" stroke="none">
          PDF
        </text>
      )}
      {tipo === "imagen" && <path d="M7.5 17l3-3.5 2 2 1.5-1.5 2.5 3z" fill="#9aa1ad" stroke="none" />}
      {tipo === "otro" && <path d="M8 12h7M8 14.5h7M8 17h5" fill="none" />}
    </svg>
  );
}

const cabecera = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "20px",
};

const migas = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap" as const,
  gap: "8px",
  marginBottom: "20px",
  fontSize: "14px",
};

const miga = { color: "#777777", textDecoration: "none" };
const migaActual = { ...miga, color: "#111111", fontWeight: 600 };
const separador = { color: "#bbbbbb" };

/** Todas las tarjetas del mismo tamaño, en columnas que llenan el ancho. */
const mosaico = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: "16px",
};

const tarjeta = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  height: "150px",
  padding: "16px 12px",
  border: ui.BORDE,
  borderRadius: "14px",
  background: "#ffffff",
  boxShadow: ui.SOMBRA,
  color: "#111111",
  textDecoration: "none",
  textAlign: "center" as const,
};

const nombreDeTarjeta = {
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.3,
  maxWidth: "100%",
  overflow: "hidden" as const,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflowWrap: "anywhere" as const,
};

const detalle = { fontSize: "12px", color: "#8a8a8a" };
