import Link from "next/link";
import AppShell from "@/components/AppShell";
import EtiquetaComprobante from "@/components/EtiquetaComprobante";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getRetirosDeAcopio } from "@/lib/acopios";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

/**
 * La ficha de un gasto: todo lo cargado, sin ningún campo editable.
 *
 * Desde Materiales (y desde donde haga falta mirar un gasto) se llegaba
 * directo a la edición, y una pantalla llena de campos invita a tocar algo
 * sin querer. Acá se mira; para cambiar algo está el botón Editar, que es una
 * decisión aparte. Y si la factura está cargada, se abre desde acá.
 */
export default async function FichaGastoPage({
  params,
}: {
  params: Promise<{ obraId: string; gastoId: string }>;
}) {
  const { obraId, gastoId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: gasto }, { data: items }] = await Promise.all([
    supabase
      .from("gastos")
      .select(
        "id, fecha, concepto, tipo_gasto, es_acopio, tipo_pago, tipo_factura, numero_factura, alicuota_iva, iva, precios_con_iva, monto, monto_usd, moneda, cotizacion, cotizacion_manual, caja_ars, caja_usd, monto_caja, compartido, estado, observaciones, comprobante_drive_id, comprobante_nombre, rubros(nombre), proveedores(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre), receptora:empresas!gastos_empresa_receptora_id_fkey(nombre), titular:empresas!gastos_empresa_factura_id_fkey(nombre), gasto_facturas(empresa_id, monto, numero, comprobante_drive_id, orden, empresas(nombre))"
      )
      .eq("id", gastoId)
      .eq("obra_id", obra.id)
      .maybeSingle(),
    supabase
      .from("gasto_materiales")
      .select("cantidad, precio_unitario, materiales(nombre, unidad)")
      .eq("gasto_id", gastoId)
      .order("orden"),
  ]);

  if (!gasto) {
    return <AppShell>Gasto no encontrado</AppShell>;
  }

  // Un acopio: lo que entró a la obra son sus retiros, con fecha.
  const retiros = gasto.es_acopio ? await getRetirosDeAcopio(gasto.id) : [];
  const retirado = retiros.reduce((acc, r) => acc + r.valor, 0);

  const base = `/obras/${obra.slug}/gastos`;
  const esAjuste = gasto.tipo_gasto === "Ajuste de saldo";
  const esUsd = gasto.moneda === "USD";
  const pagoConCuenta = Number(gasto.caja_ars) > 0 || Number(gasto.caja_usd) > 0;

  // Quién puso la plata, en una frase: la cuenta, una socia, todas, o una
  // mezcla de la cuenta y una socia cuando el saldo no alcanzó.
  const deEmpresa = Number(gasto.monto) - Number(gasto.monto_caja ?? 0);
  const quienPago = esAjuste
    ? `${gasto.pagadora?.nombre ?? "—"} → ${gasto.receptora?.nombre ?? "—"}`
    : gasto.compartido
      ? "Entre las socias"
      : pagoConCuenta && deEmpresa > 0.005
        ? `Dinero en cuenta y ${gasto.pagadora?.nombre ?? "—"} (${formatMoney(deEmpresa)})`
        : pagoConCuenta
          ? "Dinero en cuenta"
          : (gasto.pagadora?.nombre ?? "—");

  const detalle = items ?? [];
  // Facturado en varias facturas: cada una con su titular y su parte del IVA,
  // proporcional a su monto.
  const facturas = [...(gasto.gasto_facturas ?? [])].sort((a, b) => a.orden - b.orden);
  const ivaDe = (montoFactura: number) =>
    Number(gasto.monto) > 0 ? (Number(gasto.iva ?? 0) * montoFactura) / Number(gasto.monto) : 0;
  // Los precios del detalle se muestran como se cargaron; si son netos se
  // dice, para que no se comparen a ojo con el monto, que lleva el IVA.
  const preciosNetos = gasto.tipo_factura === "A" && gasto.precios_con_iva === false;
  const sumaDetalle = detalle.reduce(
    (acc, i) => acc + Number(i.cantidad) * Number(i.precio_unitario ?? 0),
    0
  );

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="gastos" />}
    >
      <ObraHeader obra={obra} activeSection="gastos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        {/* El detalle es opcional: sin él, el proveedor es lo que identifica
            la compra. */}
        <h2 style={ui.pageTitle}>
          {esAjuste
            ? "Ajuste de saldo"
            : (gasto.concepto ??
              (gasto.proveedores?.nombre
                ? `Compra a ${gasto.proveedores.nombre}`
                : "Gasto"))}
        </h2>
      </section>

      {/* Las dos acciones, y nada más: mirar la factura o ir a editar. Lo
          demás de esta pantalla no se toca. */}
      <div style={acciones}>
        {gasto.comprobante_drive_id && (
          <Link
            href={`/ver/${gasto.comprobante_drive_id}?volver=${encodeURIComponent(`${base}/${gasto.id}`)}`}
            style={ui.secondaryButton}
          >
            Ver factura
          </Link>
        )}
        {/* Facturado en varias: un botón por factura, con el titular. */}
        {facturas.map(
          (f) =>
            f.comprobante_drive_id && (
              <Link
                key={f.empresa_id}
                href={`/ver/${f.comprobante_drive_id}?volver=${encodeURIComponent(`${base}/${gasto.id}`)}`}
                style={ui.secondaryButton}
              >
                Ver factura de {f.empresas?.nombre ?? "—"}
              </Link>
            )
        )}
        <Link href={`${base}/${gasto.id}/editar`} style={ui.button}>
          Editar gasto
        </Link>
      </div>

      <section style={ui.panel}>
        <div style={grilla}>
          <Dato etiqueta="Fecha">{formatDate(gasto.fecha)}</Dato>
          <Dato etiqueta="Estado">
            {gasto.estado === "Anulado" ? (
              <span style={{ color: ui.ROJO }}>Anulado</span>
            ) : (
              gasto.estado
            )}
          </Dato>
          {!esAjuste && (
            <>
              <Dato etiqueta="Rubro">{gasto.rubros?.nombre ?? "Sin rubro"}</Dato>
              <Dato etiqueta="Tipo de gasto">{gasto.tipo_gasto}</Dato>
              <Dato etiqueta="Proveedor">{gasto.proveedores?.nombre ?? "—"}</Dato>
              <Dato etiqueta="Comprobante">
                <EtiquetaComprobante
                  tipoFactura={gasto.tipo_factura}
                  numero={
                    facturas.length > 0
                      ? facturas.map((f) => f.numero).filter(Boolean).join(" + ") ||
                        `${facturas.length} facturas`
                      : gasto.numero_factura
                  }
                  driveId={gasto.comprobante_drive_id}
                  volver={`${base}/${gasto.id}`}
                />
              </Dato>
            </>
          )}
          <Dato etiqueta="Monto">
            <strong style={{ fontSize: "18px" }}>
              {esUsd
                ? formatUSD(Number(gasto.monto_usd ?? 0))
                : formatMoney(Number(gasto.monto))}
            </strong>
            {esUsd && (
              <span style={ui.note}>
                {" "}
                · {formatMoney(Number(gasto.monto))} al cambio de{" "}
                {formatMoney(Number(gasto.cotizacion ?? 0))}
                {gasto.cotizacion_manual ? " (personalizado)" : ""}
              </span>
            )}
          </Dato>
          {gasto.tipo_factura === "A" && (
            <Dato etiqueta={`IVA ${String(gasto.alicuota_iva ?? 21).replace(".", ",")}%`}>
              {formatMoney(Number(gasto.iva ?? 0))}
              {gasto.titular?.nombre && (
                <span style={ui.note}> · crédito fiscal de {gasto.titular.nombre}</span>
              )}
            </Dato>
          )}
          <Dato etiqueta={esAjuste ? "De quién a quién" : "Quién pagó"}>{quienPago}</Dato>
          {pagoConCuenta && (
            <Dato etiqueta="Salió de la cuenta">
              {[
                Number(gasto.caja_ars) > 0 ? formatMoney(Number(gasto.caja_ars)) : null,
                Number(gasto.caja_usd) > 0 ? formatUSD(Number(gasto.caja_usd)) : null,
              ]
                .filter(Boolean)
                .join(" y ")}
            </Dato>
          )}
          {gasto.observaciones && (
            <Dato etiqueta="Observaciones" ancho>
              {gasto.observaciones}
            </Dato>
          )}
        </div>
      </section>

      {/* Facturado en varias: el gasto es uno, el comprobante está partido.
          Cada factura con su titular, su monto, su número y su parte del IVA,
          que es el crédito fiscal de esa socia. */}
      {facturas.length > 0 && (
        <section style={{ ...ui.panel, marginTop: "20px" }}>
          <h3 style={{ ...ui.sectionTitle, marginBottom: "12px" }}>
            Facturado en {facturas.length} facturas
          </h3>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>A nombre de</th>
                <th style={ui.th}>Nº</th>
                <th style={ui.thRight}>Monto</th>
                {gasto.tipo_factura === "A" && <th style={ui.thRight}>Crédito fiscal</th>}
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.empresa_id}>
                  <td style={ui.td}>{f.empresas?.nombre ?? "—"}</td>
                  <td style={ui.td}>{f.numero ?? "—"}</td>
                  <td style={ui.tdRight}>{formatMoney(Number(f.monto))}</td>
                  {gasto.tipo_factura === "A" && (
                    <td style={ui.tdRight}>{formatMoney(ivaDe(Number(f.monto)))}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* El acopio: se pagó de una vez y el material entra a la obra en
          retiros con fecha. Acá se ve cuánto ya entró y se carga el próximo. */}
      {gasto.es_acopio && (
        <section style={{ ...ui.panel, marginTop: "20px" }}>
          <div style={cabeceraAcopio}>
            <div>
              <h3 style={{ ...ui.sectionTitle, marginBottom: "4px" }}>Acopio</h3>
              <p style={{ ...ui.note, margin: 0 }}>
                Pagado {formatMoney(Number(gasto.monto))}
                {retirado > 0 && ` · ya entró a la obra ${formatMoney(retirado)}`}
                {retirado > 0 &&
                  Number(gasto.monto) - retirado > 0.005 &&
                  ` · quedan ${formatMoney(Number(gasto.monto) - retirado)}`}
              </p>
            </div>
            <Link href={`${base}/${gasto.id}/retiros/nuevo`} style={ui.button}>
              Nuevo retiro
            </Link>
          </div>

          {retiros.length === 0 ? (
            <p style={{ ...ui.vacio, marginTop: "12px" }}>
              Todavía no se registró ningún retiro: nada de este acopio entró a
              la obra por ahora.
            </p>
          ) : (
            <table style={{ ...ui.table, marginTop: "12px" }}>
              <thead>
                <tr>
                  <th style={ui.th}>Fecha</th>
                  <th style={ui.th}>Materiales</th>
                  <th style={ui.thRight}>Valor</th>
                  <th style={ui.th}></th>
                </tr>
              </thead>
              <tbody>
                {retiros.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...ui.td, whiteSpace: "nowrap" }}>{formatDate(r.fecha)}</td>
                    <td style={ui.td}>
                      {r.items
                        .map((i) => `${formatCantidad(i.cantidad)} ${i.unidad} ${i.material}`)
                        .join(" · ")}
                      {r.observaciones && (
                        <div style={{ ...ui.note, marginTop: "4px" }}>{r.observaciones}</div>
                      )}
                    </td>
                    <td style={ui.tdRight}>{r.valor > 0 ? formatMoney(r.valor) : "—"}</td>
                    <td style={{ ...ui.td, whiteSpace: "nowrap" }}>
                      <Link
                        href={`${base}/${gasto.id}/retiros/${r.id}/editar`}
                        style={enlaceFactura}
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {detalle.length > 0 && (
        <section style={{ ...ui.panel, marginTop: "20px" }}>
          <h3 style={{ ...ui.sectionTitle, marginBottom: "12px" }}>
            {gasto.es_acopio ? "Materiales acopiados" : "Materiales de la compra"}
          </h3>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Material</th>
                <th style={ui.thRight}>Cantidad</th>
                <th style={ui.th}>Unidad</th>
                <th style={ui.thRight}>
                  Precio unitario{preciosNetos ? " (sin IVA)" : ""}
                </th>
                <th style={ui.thRight}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {detalle.map((i, n) => (
                <tr key={n}>
                  <td style={ui.td}>{i.materiales?.nombre ?? "—"}</td>
                  <td style={ui.tdRight}>{formatCantidad(Number(i.cantidad))}</td>
                  <td style={ui.td}>{i.materiales?.unidad ?? ""}</td>
                  <td style={ui.tdRight}>
                    {i.precio_unitario === null ? "—" : formatMoney(Number(i.precio_unitario))}
                  </td>
                  <td style={ui.tdRight}>
                    {i.precio_unitario === null
                      ? "—"
                      : formatMoney(Number(i.cantidad) * Number(i.precio_unitario))}
                  </td>
                </tr>
              ))}
            </tbody>
            {sumaDetalle > 0 && (
              <tfoot>
                <tr>
                  <td style={tdTotal} colSpan={4}>
                    Suma del detalle{preciosNetos ? " (sin IVA)" : ""}
                  </td>
                  <td style={tdTotalRight}>{formatMoney(sumaDetalle)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>
      )}
    </AppShell>
  );
}

/** Un dato de la ficha: etiqueta chica arriba, valor abajo. */
function Dato({
  etiqueta,
  ancho = false,
  children,
}: {
  etiqueta: string;
  ancho?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={ancho ? { ...dato, gridColumn: "1 / -1" } : dato}>
      <p style={ui.label}>{etiqueta}</p>
      <div style={valor}>{children}</div>
    </div>
  );
}

function formatCantidad(valor: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(valor);
}

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginBottom: "20px",
};

const grilla = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "20px 28px",
};

const dato = {
  display: "grid",
  gap: "6px",
  alignContent: "start" as const,
};

const valor = {
  fontSize: "15px",
  color: "#111111",
  lineHeight: 1.5,
};

const cabeceraAcopio = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
};

const enlaceFactura = {
  color: "#111111",
  textDecoration: "underline",
};

const tdTotal = {
  ...ui.td,
  fontWeight: 600,
  borderTop: "1px solid #111111",
};

const tdTotalRight = {
  ...ui.tdRight,
  fontWeight: 600,
  borderTop: "1px solid #111111",
};
