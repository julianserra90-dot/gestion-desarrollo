import AppShell from "@/components/AppShell";
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
import { subirDocumento } from "../actions";

export default async function NuevoDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string; reemplaza?: string }>;
}) {
  const { obraId } = await params;
  const { error, reemplaza } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  // El documento del que se precarga, si se vino desde uno. No define la
  // versión —ésa sale del nombre— pero ahorra tipear y evita que un typo abra
  // una línea nueva por error. Se ignora si es de otra obra: el id llega por la
  // URL y no tiene por qué ser de acá.
  const previo = reemplaza ? await getDocumento(reemplaza) : null;
  const anterior = previo?.obraId === obra.id ? previo : null;

  const [rubros, titulosUsados, documentos] = await Promise.all([
    // El rubro del documento anterior viaja aunque esté desmarcado, para que la
    // versión nueva pueda quedar en el mismo lugar que la vieja.
    getRubrosActivos(obra.id, anterior?.rubro?.id ?? null),
    getTitulosUsados(obra.id),
    getDocumentosBreves(obra.id),
  ]);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="documentos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>
          {anterior ? "Nueva versión" : "Subir documento"}
        </h2>
        <p style={ui.subtitle}>
          {anterior
            ? `Cargá la versión actualizada de ${anterior.nombre}.`
            : "Elegí dónde se archiva y con qué nombre. La versión se calcula sola."}
        </p>
      </section>

      <SubirDocumentoForm
        action={subirDocumento}
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
        precarga={
          anterior
            ? {
                id: anterior.id,
                nombre: anterior.nombre,
                ambito: anterior.ambito,
                rubroId: anterior.rubro?.id ?? null,
                titulo: anterior.titulo,
              }
            : undefined
        }
      />
    </AppShell>
  );
}
