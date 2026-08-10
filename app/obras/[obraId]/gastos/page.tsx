import Link from "next/link";
import AppShell from "@/components/AppShell";
import GastosLista, { type GastoFila } from "@/components/GastosLista";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

export default async function GastosPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();
  const { data: gastos } = await supabase
    .from("gastos")
    .select(
      "id, fecha, concepto, monto, monto_caja, iva, tipo_factura, tipo_gasto, tipo_pago, estado, comprobante_drive_id, rubros(nombre), proveedores(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre), receptora:empresas!gastos_empresa_receptora_id_fkey(nombre)"
    )
    .eq("obra_id", obra.id)
    .order("fecha", { ascending: false });

  const lista = gastos ?? [];

  // Los ajustes de saldo no son gasto de obra: se muestran en el listado pero
  // no suman a los totales.
  const vigentes = lista.filter(
    (g) => g.estado !== "Anulado" && g.tipo_gasto !== "Ajuste de saldo"
  );

  const total = vigentes.reduce((acc, g) => acc + Number(g.monto), 0);

  const totalFacturado = vigentes
    .filter((g) => g.tipo_pago === "Facturado")
    .reduce((acc, g) => acc + Number(g.monto), 0);

  const totalEfectivo = vigentes
    .filter((g) => g.tipo_pago === "Efectivo")
    .reduce((acc, g) => acc + Number(g.monto), 0);

  const filas: GastoFila[] = lista.map((g) => ({
    id: g.id,
    fecha: g.fecha,
    concepto: g.concepto,
    monto: Number(g.monto),
    montoCaja: Number(g.monto_caja),
    iva: Number(g.iva ?? 0),
    tipoFactura: g.tipo_factura,
    tipoGasto: g.tipo_gasto,
    tipoPago: g.tipo_pago,
    estado: g.estado,
    comprobanteDriveId: g.comprobante_drive_id,
    rubro: g.rubros?.nombre ?? null,
    proveedor: g.proveedores?.nombre ?? null,
    pagadora: g.pagadora?.nombre ?? null,
    receptora: g.receptora?.nombre ?? null,
    compartido: false,
  }));

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="gastos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Gastos</h2>
        <p style={ui.subtitle}>
          Cada gasto se carga por el total y se reparte entre las empresas
          socias según su participación.
        </p>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Total gastado</p>
          <h3 style={ui.statNumber}>{formatMoney(total)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Facturado</p>
          <h3 style={ui.statNumber}>{formatMoney(totalFacturado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>En efectivo</p>
          <h3 style={ui.statNumber}>{formatMoney(totalEfectivo)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Gastos cargados</p>
          <h3 style={ui.statNumber}>{vigentes.length}</h3>
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Listado de gastos</h3>

        <Link href={`/obras/${obra.slug}/gastos/nuevo`} style={ui.button}>
          Nuevo gasto
        </Link>
      </div>

      <GastosLista gastos={filas} slug={obra.slug} />
    </AppShell>
  );
}
