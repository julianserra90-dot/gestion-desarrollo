import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import PagoLoteForm from "@/components/PagoLoteForm";
import * as ui from "@/components/ui";
import { getPagoLote } from "@/lib/lote";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { actualizarPagoLote } from "../../actions";

export default async function EditarPagoLotePage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; pagoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, pagoId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [pago, { data: socios }] = await Promise.all([
    getPagoLote(obra.id, pagoId),
    supabase
      .from("obra_socios")
      .select("empresa_id, empresas(nombre)")
      .eq("obra_id", obra.id),
  ]);

  if (!pago) {
    return <AppShell>Pago no encontrado</AppShell>;
  }

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
        <h2 style={ui.pageTitle}>Editar pago</h2>
        <p style={ui.subtitle}>Corregí los datos de este pago del lote.</p>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      <div style={ui.panel}>
        <PagoLoteForm
          action={actualizarPagoLote}
          obraId={obra.id}
          slug={obra.slug}
          hoy={hoy}
          socios={listaSocios}
          pago={{
            id: pago.id,
            fecha: pago.fecha,
            categoria: pago.categoria,
            concepto: pago.concepto,
            monto: pago.monto,
            moneda: pago.moneda,
            observaciones: pago.observaciones,
            empresaId: pago.empresaId,
          }}
          textoBoton="Guardar cambios"
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
