import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import PrevistoForm from "@/components/PrevistoForm";
import * as ui from "@/components/ui";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { getIngresoPrevisto } from "@/lib/ingresos-previstos";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { actualizarPrevisto, eliminarPrevisto } from "../../actions";

export default async function EditarPrevistoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; previstoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, previstoId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const previsto = await getIngresoPrevisto(obra.id, previstoId);

  if (!previsto) {
    return <AppShell>Cuota no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const { data: socios } = await supabase
    .from("obra_socios")
    .select("empresa_id, empresas(nombre)")
    .eq("obra_id", obra.id);

  const listaSocios = (socios ?? [])
    .map((s) => ({ empresa_id: s.empresa_id, nombre: s.empresas?.nombre ?? "—" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const base = `/obras/${obra.slug}/ingresos`;

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="ingresos" />}
    >
      <ObraHeader obra={obra} activeSection="ingresos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Editar cuota prevista</h2>
      </section>

      {/* Una cuota ya cumplida se puede corregir igual, pero conviene saber
          que hay un ingreso real colgando de ella antes de tocarla. */}
      {previsto.ingreso && (
        <p style={aviso}>
          Esta cuota ya entró el {formatDate(previsto.ingreso.fecha)} por{" "}
          {previsto.ingreso.moneda === "USD"
            ? formatUSD(previsto.ingreso.monto)
            : formatMoney(previsto.ingreso.monto)}
          .{" "}
          <Link href={`${base}/${previsto.ingreso.id}/editar`} style={enlace}>
            Ver el ingreso
          </Link>
        </p>
      )}

      <PrevistoForm
        action={actualizarPrevisto}
        slug={obra.slug}
        socios={listaSocios}
        previsto={{
          id: previsto.id,
          empresa_id: previsto.empresaId,
          fecha_prevista: previsto.fechaPrevista,
          monto: previsto.monto,
          moneda: previsto.moneda,
          detalle: previsto.detalle,
          observaciones: previsto.observaciones,
        }}
        error={error}
      />

      <section style={panelRiesgo}>
        <h3 style={ui.sectionTitle}>Dar de baja</h3>

        <p style={{ ...ui.text, marginBottom: "16px" }}>
          Se borra la cuota de la agenda. Si ya entró, el ingreso real queda
          como está: sólo pierde el enganche con la cuota.
        </p>

        <form action={eliminarPrevisto}>
          <input type="hidden" name="previsto_id" value={previsto.id} />
          <input type="hidden" name="slug" value={obra.slug} />
          <button type="submit" style={botonPeligro}>
            Eliminar cuota
          </button>
        </form>
      </section>
    </AppShell>
  );
}

const aviso = {
  border: "1px solid #e5e5e5",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
  color: "#555555",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};

const panelRiesgo = {
  border: "1px solid #111111",
  padding: "24px",
  marginTop: "32px",
};

const botonPeligro = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};
