import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import PagoLoteForm from "@/components/PagoLoteForm";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { crearPagoLote } from "../actions";

/**
 * Alta de un pago del lote, en su propia pantalla.
 *
 * Antes el formulario vivía desplegado al pie de la solapa Lote, y era lo más
 * largo de una página que se abre para mirar cómo viene la compra, no para
 * cargar. Ahora se entra por el botón de arriba, igual que en Gastos.
 */
export default async function NuevoPagoLotePage({
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
    .map((s) => ({ id: s.empresa_id, nombre: s.empresas?.nombre ?? "—" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="lote" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Lote · {obra.nombre}</p>
        <h2 style={ui.pageTitle}>Agregar pago</h2>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      <div style={ui.panel}>
        <PagoLoteForm
          action={crearPagoLote}
          obraId={obra.id}
          slug={obra.slug}
          hoy={hoy}
          socios={listaSocios}
        />
      </div>
    </AppShell>
  );
}

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
