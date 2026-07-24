import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import SubirDocumentoForm from "@/components/SubirDocumentoForm";
import * as ui from "@/components/ui";
import { proximaVersion } from "@/lib/ambitos";
import { getDocumento, getTitulosUsados } from "@/lib/documentos";
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

  // El documento que esta carga reemplaza, si vino uno. Se ignora si es de otra
  // obra: el id llega por la URL y no tiene por qué ser de acá.
  const previo = reemplaza ? await getDocumento(reemplaza) : null;
  const anterior = previo?.obraId === obra.id ? previo : null;

  const [rubros, titulosUsados] = await Promise.all([
    // El rubro del documento anterior viaja aunque esté desmarcado, para que la
    // versión nueva pueda quedar en el mismo lugar que la vieja.
    getRubrosActivos(obra.id, anterior?.rubro?.id ?? null),
    getTitulosUsados(obra.id),
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
            ? "Cargá la versión actualizada. La anterior queda marcada como obsoleta."
            : "Elegí de qué ámbito es y bajo qué rubro se archiva."}
        </p>
      </section>

      <SubirDocumentoForm
        action={subirDocumento}
        obraId={obra.id}
        slug={obra.slug}
        rubros={rubros.map((r) => ({ id: r.id, nombre: r.nombre }))}
        titulosUsados={titulosUsados}
        error={error}
        reemplaza={
          anterior
            ? {
                id: anterior.id,
                nombre: anterior.nombre,
                ambito: anterior.ambito,
                rubroId: anterior.rubro?.id ?? null,
                titulo: anterior.titulo,
                version: anterior.version,
              }
            : undefined
        }
        versionSugerida={
          anterior ? proximaVersion(anterior.version) : undefined
        }
      />
    </AppShell>
  );
}
