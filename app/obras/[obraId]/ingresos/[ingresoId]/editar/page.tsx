import AppShell from "@/components/AppShell";
import IngresoForm from "@/components/IngresoForm";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCaja } from "@/lib/caja";
import { getInversores } from "@/lib/inversores";
import { getCotizacionActual } from "@/lib/dolar";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { actualizarIngreso, eliminarIngreso } from "../../actions";

export default async function EditarIngresoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; ingresoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, ingresoId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const { data: ingreso } = await supabase
    .from("ingresos")
    .select(
      "id, fecha, origen, empresa_id, aportante, inversor_id, concepto, monto, monto_usd, moneda, observaciones, comprobante_drive_id, comprobante_nombre"
    )
    .eq("id", ingresoId)
    .eq("obra_id", obra.id)
    .maybeSingle();

  if (!ingreso) {
    return <AppShell>Ingreso no encontrado</AppShell>;
  }

  const [{ data: socios }, cotizacion, caja, inversores] = await Promise.all([
    supabase
      .from("obra_socios")
      .select("empresa_id, porcentaje, empresas(nombre)")
      .eq("obra_id", obra.id),
    getCotizacionActual(),
    getCaja(obra.id),
    getInversores(obra.id),
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
        <h2 style={ui.pageTitle}>Editar ingreso</h2>
      </section>

      <IngresoForm
        action={actualizarIngreso}
        obraId={obra.id}
        slug={obra.slug}
        socios={listaSocios}
        inversores={inversores}
        saldosCaja={{ ars: caja.arsSaldo, usd: caja.usdSaldo }}
        error={error}
        ingreso={ingreso}
        cotizacion={cotizacion?.promedio ?? null}
        textoBoton="Guardar cambios"
      />

      <section style={panelRiesgo}>
        <h3 style={ui.sectionTitle}>Dar de baja</h3>

        <p style={{ ...ui.text, marginBottom: "16px" }}>
          Se borra el ingreso junto con su comprobante. Si esa plata ya se usó
          para pagar gastos, la base no deja borrarlo: primero hay que corregir
          los gastos que salieron del dinero en cuenta.
        </p>

        <form action={eliminarIngreso}>
          <input type="hidden" name="ingreso_id" value={ingreso.id} />
          <input type="hidden" name="slug" value={obra.slug} />
          <button type="submit" style={botonPeligro}>
            Eliminar definitivamente
          </button>
        </form>
      </section>
    </AppShell>
  );
}

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
