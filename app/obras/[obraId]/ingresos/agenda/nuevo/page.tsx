import AppShell from "@/components/AppShell";
import CuotasPrevistasForm from "@/components/CuotasPrevistasForm";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { crearCuotas } from "../actions";

export default async function NuevasCuotasPage({
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

  const supabase = await createClient();

  const { data: socios } = await supabase
    .from("obra_socios")
    .select("empresa_id, empresas(nombre)")
    .eq("obra_id", obra.id);

  const listaSocios = (socios ?? [])
    .map((s) => ({ empresa_id: s.empresa_id, nombre: s.empresas?.nombre ?? "—" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="ingresos" />}
    >
      <ObraHeader obra={obra} activeSection="ingresos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Nuevas cuotas previstas</h2>
      </section>

      {listaSocios.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Esta obra no tiene empresas socias cargadas, así que no hay a quién
            anotarle cuotas. Agregalas desde <strong>Editar obra</strong>.
          </p>
        </section>
      ) : (
        <CuotasPrevistasForm
          action={crearCuotas}
          obraId={obra.id}
          slug={obra.slug}
          socios={listaSocios}
          error={error}
        />
      )}
    </AppShell>
  );
}
