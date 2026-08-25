import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonDescarga from "@/components/BotonDescarga";
import ObraHeader from "@/components/ObraHeader";
import SubirDocumentoForm from "@/components/SubirDocumentoForm";
import * as ui from "@/components/ui";
import {
  getDocumento,
  getDocumentosBreves,
  getTitulosUsados,
} from "@/lib/documentos";
import { getObraPorSlug } from "@/lib/obras";
import { getRubrosActivos } from "@/lib/rubros";
import {
  actualizarDocumento,
  eliminarArchivoDeDocumento,
  eliminarDocumento,
} from "../../actions";

export default async function EditarDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; documentoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, documentoId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const documento = await getDocumento(documentoId);

  if (!documento || documento.obraId !== obra.id) {
    return <AppShell>Documento no encontrado</AppShell>;
  }

  const [rubros, titulosUsados, documentos] = await Promise.all([
    // El rubro actual viaja aunque esté desmarcado: si no, al guardar se
    // perdería por no estar en el desplegable.
    getRubrosActivos(obra.id, documento.rubro?.id ?? null),
    getTitulosUsados(obra.id),
    getDocumentosBreves(obra.id),
  ]);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="documentos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Editar documento</h2>
        <p style={ui.subtitle}>
          Cambiarle el nombre lo mueve de línea: pasa a ser versión de los que
          ya se llaman así.
        </p>
      </section>

      <SubirDocumentoForm
        action={actualizarDocumento}
        obraId={obra.id}
        slug={obra.slug}
        rubros={rubros.map((r) => ({ id: r.id, nombre: r.nombre }))}
        titulosUsados={titulosUsados}
        documentos={documentos.map((d) => ({
          nombre: d.nombre,
          ambito: d.ambito,
          rubroId: d.rubroId,
          titulo: d.titulo,
          version: d.version,
          estado: d.estado,
        }))}
        error={error}
        documento={{
          id: documento.id,
          nombre: documento.nombre,
          ambito: documento.ambito,
          rubroId: documento.rubro?.id ?? null,
          titulo: documento.titulo,
          version: documento.version,
          estado: documento.estado,
          fecha: documento.fecha,
        }}
        textoBoton="Guardar cambios"
      />

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Archivos</h3>

        {documento.archivos.length === 0 ? (
          <p style={ui.vacio}>Este documento no tiene archivos cargados.</p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Archivo</th>
                <th style={ui.th}>Formato</th>
                <th style={ui.th} />
              </tr>
            </thead>
            <tbody>
              {documento.archivos.map((archivo) => (
                <tr key={archivo.id}>
                  <td style={ui.td}>
                    <Link
                      href={`/ver/${archivo.driveFileId}?volver=${encodeURIComponent(
                        `/obras/${obra.slug}/documentos/${documento.id}/editar`
                      )}`}
                      style={verLink}
                    >
                      {archivo.nombre}
                    </Link>
                  </td>
                  <td style={ui.td}>{archivo.tipo ?? "—"}</td>
                  <td style={ui.td}>
                    <div style={accionesArchivo}>
                      <BotonDescarga
                        fileId={archivo.driveFileId}
                        variante="icono"
                        etiqueta={`Descargar ${archivo.nombre}`}
                      />
                      <form action={eliminarArchivoDeDocumento}>
                        <input type="hidden" name="slug" value={obra.slug} />
                        <input
                          type="hidden"
                          name="documento_id"
                          value={documento.id}
                        />
                        <input
                          type="hidden"
                          name="archivo_id"
                          value={archivo.id}
                        />
                        <button type="submit" style={botonQuitar}>
                          Quitar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={panelRiesgo}>
        <h3 style={ui.sectionTitle}>Dar de baja</h3>

        <p style={{ ...ui.text, marginBottom: "16px" }}>
          Se borra el documento con todos sus archivos, también de Drive. Si es
          la versión vigente y hay versiones anteriores, la más alta vuelve a
          quedar vigente, para que el rubro no se quede sin plano actual.
        </p>

        <form action={eliminarDocumento}>
          <input type="hidden" name="documento_id" value={documento.id} />
          <input type="hidden" name="slug" value={obra.slug} />
          <button type="submit" style={botonPeligro}>
            Eliminar definitivamente
          </button>
        </form>
      </section>
    </AppShell>
  );
}

const accionesArchivo = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const verLink = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
};

const botonQuitar = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
  cursor: "pointer",
};

const panelRiesgo = {
  border: "1px solid #111111",
  padding: "24px",
  marginTop: "32px",
};

const botonPeligro = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};
