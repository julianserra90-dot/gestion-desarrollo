import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import PresupuestoForm from "@/components/PresupuestoForm";
import * as ui from "@/components/ui";
import { getCotizacionActual } from "@/lib/dolar";
import { getObraPorSlug } from "@/lib/obras";
import { getRubrosActivos } from "@/lib/rubros";
import { createClient } from "@/lib/supabase/server";
import { crearPresupuesto } from "../actions";

export default async function NuevoPresupuestoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string; rubro?: string; tipo?: string }>;
}) {
  const { obraId } = await params;
  const { error, rubro, tipo } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [rubros, { data: proveedores }, cotizacion] = await Promise.all([
    getRubrosActivos(obra.id),
    supabase.from("proveedores").select("id, nombre, tipo").order("nombre"),
    getCotizacionActual(),
  ]);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="presupuestos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Nueva cotización</h2>
        <p style={ui.subtitle}>
          Cargá lo que cotizó un gremio para un rubro. Después se comparan
          todas y se aprueba la elegida.
        </p>
      </section>

      {rubros.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Esta obra no tiene rubros elegidos, así que no hay a qué asociar la
            cotización. Marcalos en la solapa{" "}
            <Link href={`/obras/${obra.slug}/rubros`} style={enlaceRubros}>
              Rubros
            </Link>
            .
          </p>
        </section>
      ) : (
        <PresupuestoForm
          action={crearPresupuesto}
          obraId={obra.id}
          slug={obra.slug}
          rubros={rubros}
          proveedores={proveedores ?? []}
          error={error}
          cotizacion={cotizacion?.promedio ?? null}
          rubroSugerido={rubro}
          tipoSugerido={tipo}
        />
      )}
    </AppShell>
  );
}

const enlaceRubros = {
  color: "#111111",
  textDecoration: "underline",
};
