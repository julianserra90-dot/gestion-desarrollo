import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonDescarga from "@/components/BotonDescarga";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { obraId } = await params;
  const { categoria } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();
  const { data: documentos } = await supabase
    .from("documentos")
    .select(
      "id, nombre, tipo, categoria, version, estado, fecha, subido_por_nombre, drive_file_id"
    )
    .eq("obra_id", obra.id)
    .order("fecha", { ascending: false });

  const lista = documentos ?? [];

  const categorias = Array.from(
    new Set(lista.map((d) => d.categoria).filter(Boolean))
  ).sort() as string[];

  const filtrados = categoria
    ? lista.filter((d) => d.categoria === categoria)
    : lista;

  const enRevision = lista.filter((d) => d.estado === "En revisión").length;
  const sinArchivo = lista.filter((d) => !d.drive_file_id).length;

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="documentos" />

      <section style={cabeceraPagina}>
        <div>
          <p style={ui.eyebrow}>Documentación</p>
          <h2 style={ui.pageTitle}>Documentos</h2>
          <p style={ui.subtitle}>
            Planos, contratos, presupuestos y archivos técnicos de la obra.
          </p>
        </div>

        <Link href={`/obras/${obra.slug}/documentos/nuevo`} style={ui.button}>
          Subir documento
        </Link>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Archivos</p>
          <h3 style={ui.statNumber}>{lista.length}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Categorías</p>
          <h3 style={ui.statNumber}>{categorias.length}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>En revisión</p>
          <h3 style={ui.statNumber}>{enRevision}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Sin archivo subido</p>
          <h3 style={ui.statNumber}>{sinArchivo}</h3>
        </div>
      </section>

      {categorias.length > 0 && (
        <section style={filtros}>
          <Link
            href={`/obras/${obra.slug}/documentos`}
            style={!categoria ? filtroActivo : filtro}
          >
            Todos <span style={contador}>{lista.length}</span>
          </Link>

          {categorias.map((cat) => (
            <Link
              key={cat}
              href={`/obras/${obra.slug}/documentos?categoria=${encodeURIComponent(cat)}`}
              style={categoria === cat ? filtroActivo : filtro}
            >
              {cat}{" "}
              <span style={contador}>
                {lista.filter((d) => d.categoria === cat).length}
              </span>
            </Link>
          ))}
        </section>
      )}

      <section style={ui.panelConMargen}>
        {filtrados.length === 0 ? (
          <p style={ui.vacio}>
            {lista.length === 0
              ? "Todavía no hay documentos cargados en esta obra."
              : "No hay documentos en esta categoría."}
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Nombre</th>
                <th style={ui.th}>Categoría</th>
                <th style={ui.th}>Tipo</th>
                <th style={ui.th}>Versión</th>
                <th style={ui.th}>Subido por</th>
                <th style={ui.th}>Estado</th>
                <th style={ui.th}>Archivo</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((doc) => (
                <tr key={doc.id}>
                  <td style={ui.td}>{formatDate(doc.fecha)}</td>
                  <td style={ui.td}>{doc.nombre}</td>
                  <td style={ui.td}>{doc.categoria ?? "—"}</td>
                  <td style={ui.td}>{doc.tipo ?? "—"}</td>
                  <td style={ui.td}>{doc.version ?? "—"}</td>
                  <td style={ui.td}>{doc.subido_por_nombre ?? "—"}</td>
                  <td style={ui.td}>{doc.estado}</td>
                  <td style={ui.td}>
                    {doc.drive_file_id ? (
                      <div style={accionesArchivo}>
                        <Link
                          href={`/ver/${doc.drive_file_id}?volver=${encodeURIComponent(
                            `/obras/${obra.slug}/documentos`
                          )}`}
                          style={verLink}
                        >
                          Ver
                        </Link>
                        <BotonDescarga
                          fileId={doc.drive_file_id}
                          variante="icono"
                          etiqueta={`Descargar ${doc.nombre}`}
                        />
                      </div>
                    ) : (
                      <span style={{ color: "#aaaaaa" }}>Sin archivo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}

const cabeceraPagina = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "28px",
};

const accionesArchivo = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
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
