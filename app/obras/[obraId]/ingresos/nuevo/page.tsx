import AppShell from "@/components/AppShell";
import IngresoForm from "@/components/IngresoForm";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getCaja } from "@/lib/caja";
import { getDetalles } from "@/lib/detalles";
import { getIngresoPrevisto } from "@/lib/ingresos-previstos";
import { getInversores } from "@/lib/inversores";
import { getCotizacionActual } from "@/lib/dolar";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { crearIngreso } from "../actions";

export default async function NuevoIngresoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string; previsto?: string }>;
}) {
  const { obraId } = await params;
  const { error, previsto: previstoId } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: socios }, cotizacion, caja, inversores, previsto, detalles] =
    await Promise.all([
      supabase
        .from("obra_socios")
        .select("empresa_id, porcentaje, empresas(nombre)")
        .eq("obra_id", obra.id),
      getCotizacionActual(),
      getCaja(obra.id),
      getInversores(obra.id),
      // Desde la agenda se llega con la cuota a cumplir: se precarga todo.
      previstoId ? getIngresoPrevisto(obra.id, previstoId) : null,
      getDetalles("Ingreso"),
    ]);

  // Una cuota que ya entró no se cumple dos veces: se cae al alta común.
  const cuota =
    previsto && !previsto.ingreso
      ? {
          id: previsto.id,
          empresaId: previsto.empresaId,
          fechaPrevista: previsto.fechaPrevista,
          detalle: previsto.detalle,
          monto: previsto.monto,
          moneda: previsto.moneda,
        }
      : undefined;

  const listaSocios = (socios ?? [])
    .map((s) => ({
      empresa_id: s.empresa_id,
      nombre: s.empresas?.nombre ?? "—",
      porcentaje: Number(s.porcentaje),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="ingresos" />}
    >
      <ObraHeader obra={obra} activeSection="ingresos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Nuevo ingreso de fondos</h2>
      </section>

      {listaSocios.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Esta obra no tiene empresas socias cargadas, así que no se puede
            registrar un aporte. Agregalas desde <strong>Editar obra</strong>.
          </p>
        </section>
      ) : (
        <IngresoForm
          action={crearIngreso}
          obraId={obra.id}
          slug={obra.slug}
          socios={listaSocios}
          inversores={inversores}
          saldosCaja={{ ars: caja.arsSaldo, usd: caja.usdSaldo }}
          error={error}
          previsto={cuota}
          detallesPredefinidos={detalles}
          cotizacion={cotizacion?.promedio ?? null}
        />
      )}
    </AppShell>
  );
}
