import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import RetiroForm from "@/components/RetiroForm";
import * as ui from "@/components/ui";
import { getMaterialesCatalogo } from "@/lib/materiales";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { crearRetiro } from "../actions";

export default async function NuevoRetiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; gastoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, gastoId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: acopio }, materiales] = await Promise.all([
    supabase
      .from("gastos")
      .select("id, concepto, es_acopio, proveedores(nombre), rubros(nombre)")
      .eq("id", gastoId)
      .eq("obra_id", obra.id)
      .maybeSingle(),
    getMaterialesCatalogo(),
  ]);

  if (!acopio?.es_acopio) {
    return <AppShell>Acopio no encontrado</AppShell>;
  }

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="gastos" />}
    >
      <ObraHeader obra={obra} activeSection="gastos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>
          Acopio · {acopio.concepto ?? acopio.proveedores?.nombre ?? "—"}
        </p>
        <h2 style={ui.pageTitle}>Nuevo retiro</h2>
      </section>

      <RetiroForm
        action={crearRetiro}
        slug={obra.slug}
        gastoId={acopio.id}
        rubroNombre={acopio.rubros?.nombre ?? ""}
        materiales={materiales}
        error={error}
      />
    </AppShell>
  );
}
