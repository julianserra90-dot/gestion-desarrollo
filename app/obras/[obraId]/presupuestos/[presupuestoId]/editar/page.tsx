import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import PresupuestoForm from "@/components/PresupuestoForm";
import * as ui from "@/components/ui";
import { getCotizacionActual } from "@/lib/dolar";
import { getObraPorSlug } from "@/lib/obras";
import { getRubrosActivos } from "@/lib/rubros";
import { createClient } from "@/lib/supabase/server";
import { actualizarPresupuesto, eliminarPresupuesto } from "../../actions";

export default async function EditarPresupuestoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; presupuestoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, presupuestoId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const { data: presupuesto } = await supabase
    .from("presupuestos")
    .select(
      "id, rubro_id, tipo, proveedor_id, fecha, validez_hasta, monto, moneda, monto_usd, detalle, observaciones, comprobante_drive_id, comprobante_nombre, estado"
    )
    .eq("id", presupuestoId)
    .eq("obra_id", obra.id)
    .maybeSingle();

  if (!presupuesto) {
    return <AppShell>Cotización no encontrada</AppShell>;
  }

  const [rubros, { data: proveedores }, cotizacion] = await Promise.all([
    // El rubro de la cotización viaja aunque esté desmarcado, si no
    // desaparecería del desplegable y se perdería al guardar.
    getRubrosActivos(obra.id, presupuesto.rubro_id),
    supabase.from("proveedores").select("id, nombre, tipo").order("nombre"),
    getCotizacionActual(),
  ]);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="presupuestos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Editar cotización</h2>
        <p style={ui.subtitle}>
          Corregí los datos de la cotización. Si está aprobada, el presupuesto
          del rubro se actualiza solo.
        </p>
      </section>

      {presupuesto.estado === "Aprobado" && (
        <section style={avisoAprobada}>
          <strong>Esta es la cotización aprobada del rubro.</strong> Lo que
          cambies acá cambia el presupuesto contra el que se comparan los
          gastos.
        </section>
      )}

      <PresupuestoForm
        action={actualizarPresupuesto}
        obraId={obra.id}
        slug={obra.slug}
        rubros={rubros}
        proveedores={proveedores ?? []}
        error={error}
        presupuesto={presupuesto}
        cotizacion={cotizacion?.promedio ?? null}
        textoBoton="Guardar cambios"
      />

      <section style={panelRiesgo}>
        <h3 style={ui.sectionTitle}>Dar de baja</h3>

        <p style={{ ...ui.text, marginBottom: "16px" }}>
          Se borra la cotización junto con su archivo. Los gastos ya cargados en
          este rubro no se tocan: sólo se pierde el precio contra el que se
          comparaban.
        </p>

        <form action={eliminarPresupuesto}>
          <input type="hidden" name="presupuesto_id" value={presupuesto.id} />
          <input type="hidden" name="slug" value={obra.slug} />
          <button type="submit" style={botonPeligro}>
            Eliminar definitivamente
          </button>
        </form>
      </section>
    </AppShell>
  );
}

const avisoAprobada = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
  lineHeight: 1.5,
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
