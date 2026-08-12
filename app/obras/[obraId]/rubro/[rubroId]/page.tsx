import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

/**
 * En qué se fue la plata de un rubro.
 *
 * Se entra desde "En qué se gastó" en Economía, tocando el rubro. Responde la
 * pregunta que sigue naturalmente a ver el total: cuánto fue material y cuánto
 * mano de obra, y contra qué comprobante.
 */

// El orden en que se muestran los bloques. Administrativo va último porque no
// todos los rubros lo tienen: son impuestos y honorarios, no obra.
const TIPOS = ["Materiales", "Mano de obra", "Administrativo"];

export default async function RubroDetalle({
  params,
}: {
  params: Promise<{ obraId: string; rubroId: string }>;
}) {
  const { obraId, rubroId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: rubro }, { data: gastos }] = await Promise.all([
    supabase.from("rubros").select("id, nombre").eq("id", rubroId).maybeSingle(),
    supabase
      .from("gastos")
      .select(
        "id, fecha, concepto, monto, monto_caja, tipo_gasto, tipo_factura, tipo_pago, estado, compartido, proveedores(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre)"
      )
      .eq("obra_id", obra.id)
      .eq("rubro_id", rubroId)
      .order("fecha", { ascending: false }),
  ]);

  if (!rubro) {
    return <AppShell>Rubro no encontrado</AppShell>;
  }

  // Los anulados no son plata que se gastó: quedan afuera, igual que en el
  // total de Economía desde donde se llegó acá.
  const vigentes = (gastos ?? []).filter((g) => g.estado !== "Anulado");
  const total = vigentes.reduce((acc, g) => acc + Number(g.monto), 0);

  const bloques = TIPOS.map((tipo) => {
    const items = vigentes.filter((g) => g.tipo_gasto === tipo);

    return {
      tipo,
      items,
      total: items.reduce((acc, g) => acc + Number(g.monto), 0),
    };
  }).filter((bloque) => bloque.items.length > 0);

  /** Quién puso la plata, con las mismas reglas que el listado de gastos. */
  const quienPago = (gasto: (typeof vigentes)[number]) => {
    if (gasto.compartido) return "Entre las socias";
    if (gasto.pagadora?.nombre) return gasto.pagadora.nombre;
    return Number(gasto.monto_caja) > 0 ? "Dinero en cuenta" : "—";
  };

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="economia" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>En qué se gastó</p>
        <h2 style={ui.pageTitle}>{rubro.nombre}</h2>
        <p style={ui.subtitle}>
          Todo lo que se gastó en este rubro, separado en materiales y mano de
          obra.
        </p>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Total del rubro</p>
          <h3 style={ui.statNumber}>{formatMoney(total)}</h3>
        </div>

        {bloques.map((bloque) => (
          <div key={bloque.tipo} style={ui.statCard}>
            <p style={ui.label}>{bloque.tipo}</p>
            <h3 style={ui.statNumber}>{formatMoney(bloque.total)}</h3>
          </div>
        ))}
      </section>

      {bloques.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Todavía no hay gastos cargados en {rubro.nombre}.
          </p>
        </section>
      ) : (
        bloques.map((bloque) => (
          <section key={bloque.tipo} style={ui.panelConMargen}>
            <div style={ui.toolbar}>
              <h3 style={ui.sectionTitle}>{bloque.tipo}</h3>
              <strong>{formatMoney(bloque.total)}</strong>
            </div>

            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Fecha</th>
                  <th style={ui.th}>Detalle</th>
                  <th style={ui.th}>Proveedor / Contratista</th>
                  <th style={ui.th}>Pagó</th>
                  <th style={ui.th}>Comprobante</th>
                  <th style={ui.thRight}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {bloque.items.map((gasto) => (
                  <tr key={gasto.id}>
                    <td style={ui.td}>{formatDate(gasto.fecha)}</td>
                    <td style={ui.td}>
                      <Link
                        href={`/obras/${obra.slug}/gastos/${gasto.id}/editar`}
                        style={enlace}
                      >
                        {gasto.concepto}
                      </Link>
                    </td>
                    <td style={ui.td}>{gasto.proveedores?.nombre ?? "—"}</td>
                    <td style={ui.td}>{quienPago(gasto)}</td>
                    <td style={ui.td}>
                      {gasto.tipo_factura
                        ? `Factura ${gasto.tipo_factura}`
                        : "Efectivo"}
                    </td>
                    <td style={ui.tdRight}>
                      <strong>{formatMoney(Number(gasto.monto))}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      <p style={{ ...ui.note, marginTop: "24px" }}>
        <Link href={`/obras/${obra.slug}`} style={enlace}>
          Volver a Economía
        </Link>
      </p>
    </AppShell>
  );
}

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};
