import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { getPresupuestosDeObra } from "@/lib/presupuestos";
import { createClient } from "@/lib/supabase/server";

/**
 * En qué se fue la plata de un rubro, contra lo que se había cotizado.
 *
 * Se entra desde "En qué se gastó" en Economía, tocando el rubro. Responde la
 * pregunta que sigue naturalmente a ver el total: cuánto fue material y cuánto
 * mano de obra, cuánto de eso estaba cotizado y cuánto falta pagar.
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

  const [{ data: rubro }, { data: gastos }, presupuestos] = await Promise.all([
    supabase.from("rubros").select("id, nombre").eq("id", rubroId).maybeSingle(),
    supabase
      .from("gastos")
      .select(
        "id, fecha, concepto, monto, monto_caja, tipo_gasto, tipo_factura, tipo_pago, estado, compartido, proveedores(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre)"
      )
      .eq("obra_id", obra.id)
      .eq("rubro_id", rubroId)
      .order("fecha", { ascending: false }),
    getPresupuestosDeObra(obra.id),
  ]);

  if (!rubro) {
    return <AppShell>Rubro no encontrado</AppShell>;
  }

  // Los anulados no son plata que se gastó: quedan afuera, igual que en el
  // total de Economía desde donde se llegó acá.
  const vigentes = (gastos ?? []).filter((g) => g.estado !== "Anulado");
  const gastado = vigentes.reduce((acc, g) => acc + Number(g.monto), 0);

  const cotizacionesDelRubro = presupuestos.filter((p) => p.rubro_id === rubroId);

  // Un tipo entra si tiene gastos o si tiene una cotización aprobada: un rubro
  // cotizado y todavía sin gastar es justamente lo que hay que poder mirar.
  const bloques = TIPOS.map((tipo) => {
    const items = vigentes.filter((g) => g.tipo_gasto === tipo);
    const cotizacion = cotizacionesDelRubro.find((p) => p.tipo === tipo);

    return {
      tipo,
      items,
      gastado: items.reduce((acc, g) => acc + Number(g.monto), 0),
      cotizado: cotizacion?.cotizado ?? 0,
      proveedor: cotizacion?.proveedor ?? null,
    };
  }).filter((bloque) => bloque.items.length > 0 || bloque.cotizado > 0);

  const cotizado = bloques.reduce((acc, b) => acc + b.cotizado, 0);
  const falta = cotizado - gastado;

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
          Lo gastado en este rubro contra lo cotizado, separado en materiales y
          mano de obra.
        </p>
      </section>

      {/* Sin cotizaciones aprobadas no hay contra qué comparar: se muestra sólo
          lo gastado, en vez de un "falta" que sería el gasto cambiado de signo. */}
      <section style={ui.statsGrid}>
        {cotizado > 0 && (
          <div style={ui.statCard}>
            <p style={ui.label}>Cotizado y aprobado</p>
            <h3 style={ui.statNumber}>{formatMoney(cotizado)}</h3>
          </div>
        )}

        <div style={ui.statCard}>
          <p style={ui.label}>Gastado</p>
          <h3 style={ui.statNumber}>{formatMoney(gastado)}</h3>
        </div>

        {cotizado > 0 && (
          <div style={ui.statCard}>
            <p style={ui.label}>{falta >= 0 ? "Falta pagar" : "Se pasó"}</p>
            <h3 style={{ ...ui.statNumber, ...estiloSaldo(falta) }}>
              {formatMoney(Math.abs(falta))}
            </h3>
            <p style={{ ...ui.note, margin: "6px 0 0" }}>
              {falta >= 0
                ? "Sobre lo cotizado y aprobado."
                : "Por encima de lo cotizado."}
            </p>
          </div>
        )}
      </section>

      {bloques.length === 0 ? (
        <section style={ui.panelConMargen}>
          <p style={ui.vacio}>
            Todavía no hay gastos ni cotizaciones en {rubro.nombre}.
          </p>
        </section>
      ) : (
        bloques.map((bloque) => {
          const faltaBloque = bloque.cotizado - bloque.gastado;

          return (
            <section key={bloque.tipo} style={ui.panelConMargen}>
              <div style={ui.toolbar}>
                <h3 style={ui.sectionTitle}>{bloque.tipo}</h3>
                <strong>{formatMoney(bloque.gastado)}</strong>
              </div>

              {bloque.cotizado > 0 && (
                <div style={comparacion}>
                  <div style={dato}>
                    <span style={datoLabel}>
                      Cotizado
                      {bloque.proveedor && ` · ${bloque.proveedor}`}
                    </span>
                    <strong>{formatMoney(bloque.cotizado)}</strong>
                  </div>
                  <div style={dato}>
                    <span style={datoLabel}>Gastado</span>
                    <strong>{formatMoney(bloque.gastado)}</strong>
                  </div>
                  <div style={dato}>
                    <span style={datoLabel}>
                      {faltaBloque >= 0 ? "Falta pagar" : "Se pasó"}
                    </span>
                    <strong style={estiloSaldo(faltaBloque)}>
                      {formatMoney(Math.abs(faltaBloque))}
                    </strong>
                  </div>
                </div>
              )}

              {bloque.items.length === 0 ? (
                <p style={ui.vacio}>
                  Cotizado, sin gastos cargados todavía.
                </p>
              ) : (
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
                        <td style={ui.td}>
                          {gasto.proveedores?.nombre ?? "—"}
                        </td>
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
              )}
            </section>
          );
        })
      )}

      <p style={{ ...ui.note, marginTop: "24px" }}>
        Lo cotizado sale de las cotizaciones aprobadas en{" "}
        <Link href={`/obras/${obra.slug}/presupuestos`} style={enlace}>
          Presupuestos
        </Link>
        .{" "}
        <Link href={`/obras/${obra.slug}`} style={enlace}>
          Volver a Economía
        </Link>
        .
      </p>
    </AppShell>
  );
}

// Pasarse de lo cotizado no es un error, pero tiene que saltar a la vista.
function estiloSaldo(falta: number) {
  return falta < -0.01 ? { color: "#b91c1c" } : undefined;
}

const comparacion = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "32px",
  padding: "14px 0 18px",
  borderTop: "1px solid #eeeeee",
  marginBottom: "8px",
};

const dato = {
  display: "grid",
  gap: "4px",
};

const datoLabel = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#777777",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};
