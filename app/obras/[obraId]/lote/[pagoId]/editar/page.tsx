import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import PagoLoteForm from "@/components/PagoLoteForm";
import * as ui from "@/components/ui";
import { getPagoLote } from "@/lib/lote";
import { getObraPorSlug } from "@/lib/obras";
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

  const pago = await getPagoLote(obra.id, pagoId);

  if (!pago) {
    return <AppShell>Pago no encontrado</AppShell>;
  }

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
          pago={{
            id: pago.id,
            fecha: pago.fecha,
            categoria: pago.categoria,
            concepto: pago.concepto,
            monto: pago.monto,
            moneda: pago.moneda,
            observaciones: pago.observaciones,
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
