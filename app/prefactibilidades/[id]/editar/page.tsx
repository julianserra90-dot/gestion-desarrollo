import AppShell from "@/components/AppShell";
import AppSidebar from "@/components/AppSidebar";
import PrefactibilidadForm from "@/components/PrefactibilidadForm";
import Volver from "@/components/Volver";
import * as ui from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { actualizarPrefactibilidad } from "../../actions";

export default async function EditarPrefactibilidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: estudio } = await supabase
    .from("prefactibilidades")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!estudio) {
    return <AppShell>Estudio no encontrado</AppShell>;
  }

  return (
    <AppShell sidebar={<AppSidebar activo="prefactibilidades" />}>
      <Volver href={`/prefactibilidades/${estudio.id}`}>{estudio.direccion}</Volver>

      <header style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Prefactibilidad</p>
        <h2 style={ui.pageTitle}>Editar estudio</h2>
      </header>

      <PrefactibilidadForm
        action={actualizarPrefactibilidad}
        estudio={estudio}
        error={error}
        cancelarHref={`/prefactibilidades/${estudio.id}`}
        textoBoton="Guardar cambios"
      />

    </AppShell>
  );
}
