import AppShell from "@/components/AppShell";
import InversorForm from "@/components/InversorForm";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { crearInversor } from "../actions";

export default async function NuevoInversorPage({
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
      <ObraHeader obra={obra} activeSection="inversores" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Nuevo inversor</h2>
      </section>

      <InversorForm
        action={crearInversor}
        obraId={obra.id}
        slug={obra.slug}
        error={error}
        aportado={{ ars: 0, usd: 0 }}
      />
    </AppShell>
  );
}
