import AppShell from "@/components/AppShell";
import NuevaPlantaForm from "@/components/NuevaPlantaForm";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { crearPlanta } from "../actions";

export default async function NuevaPlantaPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="plantas" />}
    >
      <ObraHeader obra={obra} activeSection="plantas" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Nueva planta</h2>
      </section>

      <NuevaPlantaForm action={crearPlanta} obraId={obra.id} slug={obra.slug} />
    </AppShell>
  );
}
