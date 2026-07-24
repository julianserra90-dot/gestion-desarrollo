import AppShell from "@/components/AppShell";
import IngresoForm from "@/components/IngresoForm";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCaja } from "@/lib/caja";
import { getCotizacionActual } from "@/lib/dolar";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { crearIngreso } from "../actions";

export default async function NuevoIngresoPage({
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

  const [{ data: socios }, cotizacion, caja] = await Promise.all([
    supabase
      .from("obra_socios")
      .select("empresa_id, porcentaje, empresas(nombre)")
      .eq("obra_id", obra.id),
    getCotizacionActual(),
    getCaja(obra.id),
  ]);

  const listaSocios = (socios ?? [])
    .map((s) => ({
      empresa_id: s.empresa_id,
      nombre: s.empresas?.nombre ?? "—",
      porcentaje: Number(s.porcentaje),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="ingresos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Nuevo ingreso de fondos</h2>
        <p style={ui.subtitle}>
          Plata que entra a la obra. Queda disponible como dinero en cuenta
          para pagar gastos.
        </p>
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
          saldosCaja={{ ars: caja.arsSaldo, usd: caja.usdSaldo }}
          error={error}
          cotizacion={cotizacion?.promedio ?? null}
        />
      )}
    </AppShell>
  );
}
