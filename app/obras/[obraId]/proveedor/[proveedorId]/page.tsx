import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

/**
 * Los pagos de una obra a un destino puntual (proveedor, contratista o
 * varios), contra lo que tiene cotizado acá.
 *
 * Se entra tocando el destino en el listado de Gastos o en el detalle de un
 * rubro. Responde la cuenta corriente con esa persona: cuánto cotizó, cuánto
 * se le pagó y cuánto falta. Acá la comparación cierra porque los dos lados
 * son del mismo destino —no como los totales por rubro, que mezclaban la
 * cotización de uno con los gastos de todos—.
 *
 * El catálogo de proveedores es uno para todas las obras, pero esta pantalla
 * mira una sola: la ruta es de la obra y los pagos de otra no dicen nada acá.
 */

export default async function ProveedorDetalle({
  params,
}: {
  params: Promise<{ obraId: string; proveedorId: string }>;
}) {
  const { obraId, proveedorId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: proveedor }, { data: gastos }, { data: cotizaciones }] =
    await Promise.all([
      supabase
        .from("proveedores")
        .select("id, nombre, tipo, telefono, rubros(nombre)")
        .eq("id", proveedorId)
        .maybeSingle(),
      supabase
        .from("gastos")
        .select(
          "id, fecha, concepto, monto, monto_caja, tipo_gasto, tipo_factura, estado, compartido, rubros(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre)"
        )
        .eq("obra_id", obra.id)
        .eq("proveedor_id", proveedorId)
        .order("fecha", { ascending: false }),
      supabase
        .from("obra_presupuesto")
        .select("rubro_id, tipo, cotizado")
        .eq("obra_id", obra.id)
        .eq("proveedor_id", proveedorId)
        .gt("cotizado", 0),
    ]);

  if (!proveedor) {
    return <AppShell>Proveedor no encontrado</AppShell>;
  }

  // Los anulados no se le pagaron: quedan afuera, igual que en todos los
  // totales de la app.
  const vigentes = (gastos ?? []).filter((g) => g.estado !== "Anulado");
  const pagado = vigentes.reduce((acc, g) => acc + Number(g.monto), 0);

  const aprobadas = cotizaciones ?? [];
  const cotizado = aprobadas.reduce((acc, c) => acc + Number(c.cotizado ?? 0), 0);
  const hayCotizacion = cotizado > 0;

  // Los nombres de los rubros cotizados se piden aparte: puede haber una
  // cotización en un rubro donde todavía no hay ningún gasto.
  const idsRubros = [
    ...new Set(aprobadas.map((c) => c.rubro_id).filter(Boolean)),
  ] as string[];

  const { data: rubros } = idsRubros.length
    ? await supabase.from("rubros").select("id, nombre").in("id", idsRubros)
    : { data: [] };

  const nombreRubro = new Map((rubros ?? []).map((r) => [r.id, r.nombre]));

  /** Quién puso la plata, con las mismas reglas que el listado de gastos. */
  const quienPago = (gasto: (typeof vigentes)[number]) => {
    if (gasto.compartido) return "Entre las socias";
    if (gasto.pagadora?.nombre) return gasto.pagadora.nombre;
    return Number(gasto.monto_caja) > 0 ? "Dinero en cuenta" : "—";
  };

  // La ficha compacta del catálogo: sólo lo que esté cargado.
  const ficha = [proveedor.rubros?.nombre, proveedor.telefono]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="gastos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{proveedor.tipo}</p>
        <h2 style={ui.pageTitle}>{proveedor.nombre}</h2>
        {ficha && <p style={ui.subtitle}>{ficha}</p>}
      </section>

      {/* Lo que no se puede calcular es un guión, no un cero: sin cotización
          aprobada no hay contra qué comparar el "falta pagar". */}
      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Cotizado</p>
          <h3 style={ui.statNumber}>
            {hayCotizacion ? formatMoney(cotizado) : "—"}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Pagado</p>
          <h3 style={ui.statNumber}>{formatMoney(pagado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Falta pagar</p>
          <h3 style={{ ...ui.statNumber, ...(hayCotizacion ? estiloFalta : {}) }}>
            {hayCotizacion ? formatMoney(cotizado - pagado) : "—"}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Pagos</p>
          <h3 style={ui.statNumber}>{vigentes.length}</h3>
        </div>
      </section>

      {aprobadas.length > 0 && (
        <section style={ui.panelConMargen}>
          <h3 style={ui.sectionTitle}>Cotizaciones aprobadas</h3>

          {aprobadas.map((c) => (
            <div key={`${c.rubro_id}-${c.tipo}`} style={ui.row}>
              <span>
                {nombreRubro.get(c.rubro_id ?? "") ?? "—"} — {c.tipo}
              </span>
              <strong>{formatMoney(Number(c.cotizado ?? 0))}</strong>
            </div>
          ))}
        </section>
      )}

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Pagos</h3>

        {vigentes.length === 0 ? (
          <p style={ui.vacio}>Sin pagos en esta obra todavía.</p>
        ) : (
          /* Las columnas van en el mismo orden que en Gastos; falta Destino,
             que acá sería la misma respuesta en todas las filas. */
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Rubro</th>
                <th style={ui.th}>Tipo</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.th}>Comprobante</th>
                <th style={ui.th}>Pagó</th>
                <th style={ui.thRight}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {vigentes.map((gasto) => (
                <tr key={gasto.id}>
                  <td style={ui.td}>{formatDate(gasto.fecha)}</td>
                  <td style={ui.td}>{gasto.rubros?.nombre ?? "—"}</td>
                  <td style={ui.td}>{gasto.tipo_gasto}</td>
                  <td style={ui.td}>{gasto.concepto}</td>
                  <td style={ui.td}>
                    {gasto.tipo_factura
                      ? `Factura ${gasto.tipo_factura}`
                      : "Efectivo"}
                  </td>
                  <td style={ui.td}>{quienPago(gasto)}</td>
                  <td style={ui.tdRight}>
                    <strong>{formatMoney(Number(gasto.monto))}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={tdTotal} colSpan={6}>
                  Total pagado
                </td>
                <td style={tdTotalRight}>{formatMoney(pagado)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <p style={{ ...ui.note, marginTop: "24px" }}>
        <Link href={`/obras/${obra.slug}/gastos`} style={enlace}>
          Volver a Gastos
        </Link>
        .
      </p>
    </AppShell>
  );
}

// El mismo rojo pleno del "falta pagar" del detalle por rubro: es plata que
// todavía hay que poner, y suave quedaba desdibujado.
const estiloFalta = { color: "#b91c1c" };

const tdTotal = {
  padding: "14px 12px",
  borderTop: "2px solid #111111",
  color: "#111111",
  fontWeight: 600,
};

const tdTotalRight = {
  ...tdTotal,
  textAlign: "right" as const,
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};
