import Link from "next/link";
import AppShell from "@/components/AppShell";
import GastosLista, {
  type GastoFila,
  type VistaGastos,
} from "@/components/GastosLista";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import Volver from "@/components/Volver";
import { formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

// Tres y no cuatro: con la grilla de cuatro columnas de `ui` quedaba un hueco
// al costado donde estaba la tarjeta que se sacó.
const tresTarjetas = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
};

/** Los atajos que llegan desde las tarjetas del Balance. */
const VISTAS: VistaGastos[] = [
  "todos",
  "efectivo",
  "facturado",
  "credito-fiscal",
];

export default async function GastosPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const { obraId } = await params;
  const { ver } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  // Lo que venga de más en la URL se ignora: la pantalla abre sin filtro.
  const vista = VISTAS.find((v) => v === ver);

  const supabase = await createClient();
  const [{ data: gastos }, { data: socias }] = await Promise.all([
    supabase
      .from("gastos")
      .select(
        "id, fecha, concepto, monto, monto_caja, iva, tipo_factura, tipo_gasto, tipo_pago, estado, compartido, empresa_factura_id, empresa_pagadora_id, comprobante_drive_id, proveedor_id, rubros(nombre), proveedores(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre), receptora:empresas!gastos_empresa_receptora_id_fkey(nombre)"
      )
      .eq("obra_id", obra.id)
      .order("fecha", { ascending: false }),
    // Las socias, para poder decir a nombre de quién salió cada comprobante de
    // lo que se está viendo.
    supabase
      .from("obra_socios")
      .select("empresa_id, empresas(nombre)")
      .eq("obra_id", obra.id),
  ]);

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
    empresaFacturaId: g.empresa_factura_id,
    empresaPagadoraId: g.empresa_pagadora_id,
    tipoFactura: g.tipo_factura,
    tipoGasto: g.tipo_gasto,
    tipoPago: g.tipo_pago,
    estado: g.estado,
    comprobanteDriveId: g.comprobante_drive_id,
    rubro: g.rubros?.nombre ?? null,
    proveedor: g.proveedores?.nombre ?? null,
    proveedorId: g.proveedor_id,
    pagadora: g.pagadora?.nombre ?? null,
    receptora: g.receptora?.nombre ?? null,
    compartido: g.compartido ?? false,
  }));

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="gastos" />

      {/* Gastos es una solapa, así que normalmente no lleva "volver": se sale
          por las mismas solapas. Pero entrando desde una tarjeta del Balance
          funciona como pantalla de detalle, y ahí sí hace falta la vuelta. */}
      <section style={ui.sectionHeader}>
        {vista && <Volver href={`/obras/${obra.slug}`}>Balance</Volver>}
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Gastos</h2>
      </section>

      {/* Sin la tarjeta "Gastos cargados": contar gastos no dice nada, y el
          contador del listado ya lo tiene al lado del total de lo filtrado. */}
      <section style={tresTarjetas}>
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
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Listado de gastos</h3>

        <Link href={`/obras/${obra.slug}/gastos/nuevo`} style={ui.button}>
          Nuevo gasto
        </Link>
      </div>

      {/* La `key` fuerza a rearmar la lista cuando cambia el atajo: el filtro
          inicial se calcula al montar, y sin esto volver a entrar desde otra
          tarjeta dejaba el filtro anterior puesto. */}
      <GastosLista
        key={vista ?? "todos"}
        gastos={filas}
        slug={obra.slug}
        inicioObra={obra.fecha_inicio}
        ver={vista}
        socias={(socias ?? [])
          .filter((s) => s.empresa_id)
          .map((s) => ({
            id: s.empresa_id as string,
            nombre: s.empresas?.nombre ?? "—",
          }))
          // Alfabético, igual que el balance entre empresas: las dos pantallas
          // muestran los mismos números y conviene que los muestren en el
          // mismo orden.
          .sort((a, b) => a.nombre.localeCompare(b.nombre))}
      />
    </AppShell>
  );
}
