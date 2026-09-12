import Link from "next/link";
import AppShell from "@/components/AppShell";
import EtiquetaComprobante from "@/components/EtiquetaComprobante";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getFacturasVinculadas, textoComprobante } from "@/lib/compras";
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
        "id, fecha, concepto, tipo_gasto, tipo_pago, tipo_factura, numero_factura, compra_de_gasto_id, alicuota_iva, iva, precios_con_iva, monto, monto_usd, moneda, cotizacion, cotizacion_manual, caja_ars, caja_usd, monto_caja, compartido, estado, observaciones, comprobante_drive_id, comprobante_nombre, rubros(nombre), proveedores(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre), receptora:empresas!gastos_empresa_receptora_id_fkey(nombre), titular:empresas!gastos_empresa_factura_id_fkey(nombre)"
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

  // Una compra partida en varias facturas: si ésta es la principal, las
  // otras se listan; si es una enganchada, los materiales se muestran desde la
  // principal, que es donde están cargados.
  const [vinculadas, { data: principal }] = await Promise.all([
    getFacturasVinculadas(gasto.id),
    gasto.compra_de_gasto_id
      ? supabase
          .from("gastos")
          .select(
            "id, fecha, monto, tipo_factura, numero_factura, gasto_materiales(cantidad, precio_unitario, materiales(nombre, unidad))"
          )
          .eq("id", gasto.compra_de_gasto_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

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

  // Enganchada a otra factura, los materiales son los de la principal.
  const detalle = principal ? principal.gasto_materiales : (items ?? []);
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
                  numero={gasto.numero_factura}
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

      {/* La compra en varias facturas: desde cualquiera se ven las otras. */}
      {(vinculadas.length > 0 || principal) && (
        <section style={{ ...ui.panel, marginTop: "20px" }}>
          <h3 style={{ ...ui.sectionTitle, marginBottom: "12px" }}>
            Compra en {vinculadas.length + (principal ? 2 : 1)} facturas
          </h3>
          <p style={{ ...ui.note, margin: "0 0 12px" }}>
            {principal
              ? "Los materiales de esta compra están cargados en la factura principal, abajo se muestran desde allá."
              : "Los materiales se cargaron una sola vez, en esta factura; las otras son de la misma compra."}
          </p>
          <ul style={listaFacturas}>
            {principal && (
              <li>
                <Link href={`${base}/${principal.id}`} style={enlaceFactura}>
                  {textoComprobante(principal.tipo_factura, principal.numero_factura)} del{" "}
                  {formatDate(principal.fecha)}
                </Link>{" "}
                · {formatMoney(Number(principal.monto))} · principal
              </li>
            )}
            {vinculadas.map((f) => (
              <li key={f.id}>
                <Link href={`${base}/${f.id}`} style={enlaceFactura}>
                  {f.comprobante} del {formatDate(f.fecha)}
                </Link>{" "}
                · {formatMoney(f.monto)}
                {f.pagadora ? ` · pagó ${f.pagadora}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detalle.length > 0 && (
        <section style={{ ...ui.panel, marginTop: "20px" }}>
          <h3 style={{ ...ui.sectionTitle, marginBottom: "12px" }}>
            Materiales de la compra
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

const listaFacturas = {
  margin: 0,
  paddingLeft: "18px",
  fontSize: "14px",
  color: "#555555",
  lineHeight: 1.8,
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
