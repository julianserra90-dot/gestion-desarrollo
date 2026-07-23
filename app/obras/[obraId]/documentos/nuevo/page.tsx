import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import SubirDocumentoForm from "@/components/SubirDocumentoForm";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { subirDocumento } from "../actions";

export default async function NuevoDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="documentos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Subir documento</h2>
        <p style={ui.subtitle}>
          Cargá un plano, contrato, presupuesto o archivo técnico de la obra.
        </p>
      </section>

      <SubirDocumentoForm
        action={subirDocumento}
        obraId={obra.id}
        slug={obra.slug}
        error={error}
      />
    </AppShell>
  );
}
