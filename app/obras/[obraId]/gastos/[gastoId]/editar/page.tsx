import AppShell from "@/components/AppShell";
import GastoForm from "@/components/GastoForm";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCaja } from "@/lib/caja";
import { getCotizacionActual } from "@/lib/dolar";
import { getObraPorSlug } from "@/lib/obras";
import { getPresupuestosDeObra } from "@/lib/presupuestos";
import { getRubrosActivos } from "@/lib/rubros";
import { createClient } from "@/lib/supabase/server";
import {
  actualizarGasto,
  anularGasto,
  eliminarGasto,
  restaurarGasto,
} from "../../actions";

export default async function EditarGastoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; gastoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, gastoId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const { data: gasto } = await supabase
    .from("gastos")
    .select(
      "id, fecha, rubro_id, proveedor_id, empresa_receptora_id, tipo_gasto, concepto, tipo_pago, monto, caja_ars, caja_usd, cotizacion, cotizacion_manual, monto_usd, moneda, observaciones, empresa_pagadora_id, comprobante_drive_id, comprobante_nombre, estado"
    )
    .eq("id", gastoId)
    .eq("obra_id", obra.id)
    .maybeSingle();

  if (!gasto) {
    return <AppShell>Gasto no encontrado</AppShell>;
  }

  const [rubros, { data: socios }, { data: proveedores }, presupuestos] =
    await Promise.all([
      // El rubro del gasto viaja aunque esté desmarcado: si no, desaparecería
      // del desplegable y se perdería al guardar.
      getRubrosActivos(obra.id, gasto.rubro_id),
      supabase
        .from("obra_socios")
        .select("empresa_id, porcentaje, empresas(nombre)")
        .eq("obra_id", obra.id),
      supabase.from("proveedores").select("id, nombre, tipo").order("nombre"),
      getPresupuestosDeObra(obra.id),
    ]);

  const cotizacion = await getCotizacionActual();
  const caja = await getCaja(obra.id);

  const listaSocios = (socios ?? [])
    .map((s) => ({
      empresa_id: s.empresa_id,
      nombre: s.empresas?.nombre ?? "—",
      porcentaje: Number(s.porcentaje),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const anulado = gasto.estado === "Anulado";

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="gastos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Editar gasto</h2>
        <p style={ui.subtitle}>
          Corregí los datos del gasto. Los totales y el saldo entre empresas se
          recalculan solos.
        </p>
      </section>

      {anulado && (
        <section style={avisoAnulado}>
          <div>
            <strong>Este gasto está anulado.</strong> No cuenta en los totales
            ni en el balance entre empresas, pero queda registrado.
          </div>

          <form action={restaurarGasto}>
            <input type="hidden" name="gasto_id" value={gasto.id} />
            <input type="hidden" name="slug" value={obra.slug} />
            <button type="submit" style={ui.secondaryButton}>
              Reactivar
            </button>
          </form>
        </section>
      )}

      <GastoForm
        action={actualizarGasto}
        obraId={obra.id}
        slug={obra.slug}
        rubros={rubros}
        socios={listaSocios}
        proveedores={proveedores ?? []}
        saldosCaja={{ ars: caja.arsSaldo, usd: caja.usdSaldo }}
        presupuestos={presupuestos}
        error={error}
        gasto={gasto}
        cotizacion={cotizacion?.promedio ?? null}
        textoBoton="Guardar cambios"
      />

      <section style={panelRiesgo}>
        <h3 style={ui.sectionTitle}>Dar de baja</h3>

        <p style={{ ...ui.text, marginBottom: "16px" }}>
          <strong>Anular</strong> saca el gasto de los totales pero deja el
          registro, que es lo recomendable cuando hay plata de por medio entre
          socios. <strong>Eliminar</strong> lo borra definitivamente junto con
          su comprobante.
        </p>

        <div style={acciones}>
          {!anulado && (
            <form action={anularGasto}>
              <input type="hidden" name="gasto_id" value={gasto.id} />
              <input type="hidden" name="slug" value={obra.slug} />
              <button type="submit" style={ui.secondaryButton}>
                Anular gasto
              </button>
            </form>
          )}

          <form action={eliminarGasto}>
            <input type="hidden" name="gasto_id" value={gasto.id} />
            <input type="hidden" name="slug" value={obra.slug} />
            <button type="submit" style={botonPeligro}>
              Eliminar definitivamente
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}

const avisoAnulado = {
  border: "1px solid #111111",
  padding: "16px 20px",
  marginBottom: "24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  fontSize: "14px",
};

const panelRiesgo = {
  border: "1px solid #111111",
  padding: "24px",
  marginTop: "32px",
};

const acciones = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap" as const,
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
