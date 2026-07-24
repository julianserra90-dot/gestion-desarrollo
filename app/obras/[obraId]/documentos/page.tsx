import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonDescarga from "@/components/BotonDescarga";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { AMBITOS, esAmbito } from "@/lib/ambitos";
import {
  carpetaDelDocumento,
  getDocumentos,
  type Documento,
} from "@/lib/documentos";
import { formatDate } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";

export default async function DocumentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ ambito?: string; obsoletos?: string; error?: string }>;
}) {
  const { obraId } = await params;
  const { ambito, obsoletos, error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const todos = await getDocumentos(obra.id);

  const ambitoActivo = ambito && esAmbito(ambito) ? ambito : null;
  const verObsoletos = obsoletos === "1";

  // Lo obsoleto se esconde por defecto: la pregunta de siempre es cuál es el
  // plano que vale hoy, no cuáles hubo.
  const visibles = todos
    .filter((d) => (ambitoActivo ? d.ambito === ambitoActivo : true))
    .filter((d) => (verObsoletos ? true : d.estado !== "Obsoleto"));

  const carpetas = agrupar(visibles);

  const cantArchivos = todos.reduce((t, d) => t + d.archivos.length, 0);
  const cantObsoletos = todos.filter((d) => d.estado === "Obsoleto").length;
  const cantRevision = todos.filter((d) => d.estado === "En revisión").length;

  const linkAmbito = (a: string | null) => {
    const query = new URLSearchParams();
    if (a) query.set("ambito", a);
    if (verObsoletos) query.set("obsoletos", "1");
    const qs = query.toString();
    return `/obras/${obra.slug}/documentos${qs ? `?${qs}` : ""}`;
  };

  const linkObsoletos = () => {
    const query = new URLSearchParams();
    if (ambitoActivo) query.set("ambito", ambitoActivo);
    if (!verObsoletos) query.set("obsoletos", "1");
    const qs = query.toString();
    return `/obras/${obra.slug}/documentos${qs ? `?${qs}` : ""}`;
  };

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="documentos" />

      <section style={cabeceraPagina}>
        <div>
          <p style={ui.eyebrow}>Documentación</p>
          <h2 style={ui.pageTitle}>Documentos</h2>
          <p style={ui.subtitle}>
            Planos, permisos y archivos técnicos, ordenados por ámbito y rubro.
          </p>
        </div>

        <Link href={`/obras/${obra.slug}/documentos/nuevo`} style={ui.button}>
          Subir documento
        </Link>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Documentos</p>
          <h3 style={ui.statNumber}>{todos.length}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Archivos</p>
          <h3 style={ui.statNumber}>{cantArchivos}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>En revisión</p>
          <h3 style={ui.statNumber}>{cantRevision}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Obsoletos</p>
          <h3 style={ui.statNumber}>{cantObsoletos}</h3>
        </div>
      </section>

      <section style={filtros}>
        <Link href={linkAmbito(null)} style={!ambitoActivo ? filtroActivo : filtro}>
          Todos{" "}
          <span style={contador}>
            {todos.filter((d) => verObsoletos || d.estado !== "Obsoleto").length}
          </span>
        </Link>

        {AMBITOS.map((a) => (
          <Link
            key={a}
            href={linkAmbito(a)}
            style={ambitoActivo === a ? filtroActivo : filtro}
          >
            {a === "Administrativa" ? "Administrativa" : `De ${a.toLowerCase()}`}{" "}
            <span style={contador}>
              {
                todos.filter(
                  (d) =>
                    d.ambito === a && (verObsoletos || d.estado !== "Obsoleto")
                ).length
              }
            </span>
          </Link>
        ))}

        {cantObsoletos > 0 && (
          <Link href={linkObsoletos()} style={verObsoletos ? filtroActivo : filtro}>
            {verObsoletos ? "Ocultar obsoletos" : "Ver obsoletos"}
          </Link>
        )}
      </section>

      {carpetas.length === 0 ? (
        <section style={ui.panelConMargen}>
          <p style={ui.vacio}>
            {todos.length === 0
              ? "Todavía no hay documentos cargados en esta obra."
              : "No hay documentos vigentes en este ámbito."}
          </p>
        </section>
      ) : (
        carpetas.map(([carpeta, docs]) => (
          <section key={carpeta} style={ui.panelConMargen}>
            <div style={cabeceraCarpeta}>
              <h3 style={tituloCarpeta}>{carpeta}</h3>
              <span style={contadorCarpeta}>
                {docs.length} {docs.length === 1 ? "documento" : "documentos"}
              </span>
            </div>

            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Documento</th>
                  {!ambitoActivo && <th style={ui.th}>Ámbito</th>}
                  <th style={ui.th}>Versión</th>
                  <th style={ui.th}>Estado</th>
                  <th style={ui.th}>Fecha</th>
                  <th style={ui.th}>Subido por</th>
                  <th style={ui.th}>Archivos</th>
                  <th style={ui.th} />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} style={doc.estado === "Obsoleto" ? filaObsoleta : undefined}>
                    <td style={ui.td}>{doc.nombre}</td>
                    {!ambitoActivo && <td style={ui.td}>{doc.ambito}</td>}
                    <td style={ui.td}>{doc.version ?? "—"}</td>
                    <td style={ui.td}>{doc.estado}</td>
                    <td style={ui.td}>{formatDate(doc.fecha)}</td>
                    <td style={ui.td}>{doc.subidoPor ?? "—"}</td>
                    <td style={ui.td}>
                      {doc.archivos.length === 0 ? (
                        <span style={{ color: "#aaaaaa" }}>Sin archivo</span>
                      ) : (
                        <div style={listaArchivos}>
                          {doc.archivos.map((archivo) => (
                            <span key={archivo.id} style={chipArchivo}>
                              <Link
                                href={`/ver/${archivo.driveFileId}?volver=${encodeURIComponent(
                                  `/obras/${obra.slug}/documentos`
                                )}`}
                                style={verLink}
                              >
                                {archivo.tipo ?? "Ver"}
                              </Link>
                              <BotonDescarga
                                fileId={archivo.driveFileId}
                                variante="icono"
                                etiqueta={`Descargar ${archivo.nombre}`}
                              />
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={ui.td}>
                      <div style={accionesFila}>
                        {doc.estado !== "Obsoleto" && (
                          <Link
                            href={`/obras/${obra.slug}/documentos/nuevo?reemplaza=${doc.id}`}
                            style={verLink}
                          >
                            Nueva versión
                          </Link>
                        )}
                        <Link
                          href={`/obras/${obra.slug}/documentos/${doc.id}/editar`}
                          style={verLink}
                        >
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </AppShell>
  );
}

/**
 * Agrupa por carpeta —el rubro, o el título si es administrativo— y ordena
 * alfabéticamente. Dentro de cada una los documentos ya vienen por fecha.
 */
function agrupar(docs: Documento[]): [string, Documento[]][] {
  const carpetas = new Map<string, Documento[]>();

  for (const doc of docs) {
    const carpeta = carpetaDelDocumento(doc);
    const actuales = carpetas.get(carpeta);

    if (actuales) actuales.push(doc);
    else carpetas.set(carpeta, [doc]);
  }

  return Array.from(carpetas.entries()).sort(([a], [b]) =>
    a.localeCompare(b, "es")
  );
}

const cabeceraPagina = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "28px",
};

const cabeceraCarpeta = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "12px",
  marginBottom: "16px",
};

const tituloCarpeta = {
  fontSize: "16px",
  fontWeight: 600,
  margin: 0,
};

const contadorCarpeta = {
  fontSize: "13px",
  color: "#999999",
};

const accionesFila = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "4px",
  whiteSpace: "nowrap" as const,
};

const listaArchivos = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "10px",
};

const chipArchivo = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const filaObsoleta = {
  opacity: 0.55,
};

const verLink = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
};

const filtros = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px",
  marginTop: "32px",
};

const filtro = {
  color: "#111111",
  textDecoration: "none",
  border: "1px solid #e5e5e5",
  padding: "10px 14px",
  fontSize: "14px",
  background: "#ffffff",
};

const filtroActivo = {
  ...filtro,
  color: "#ffffff",
  border: "1px solid #111111",
  background: "#111111",
};

const contador = {
  color: "inherit",
  opacity: 0.6,
  marginLeft: "4px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
