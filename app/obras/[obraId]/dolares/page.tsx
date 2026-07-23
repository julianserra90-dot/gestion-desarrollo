import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getConvertidor, formatUSD } from "@/lib/dolar";
import { formatDate, formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

export default async function DolaresPage({
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
      "id, fecha, concepto, monto, monto_usd, cotizacion, moneda, tipo_gasto, estado, rubros(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre)"
    )
    .eq("obra_id", obra.id)
    .order("fecha", { ascending: false });

  // Los ajustes de saldo no son gasto de obra, así que quedan afuera.
  const vigentes = (gastos ?? []).filter(
    (g) => g.estado !== "Anulado" && g.tipo_gasto !== "Ajuste de saldo"
  );

  const convertidor = await getConvertidor(vigentes.map((g) => g.fecha));

  const convertidos = vigentes.map((gasto) => {
    // monto siempre está en pesos. Si el gasto se guardó con su conversión, se
    // usa esa; si es viejo y no la tiene, se calcula al dólar de su fecha.
    const montoArs = Number(gasto.monto);
    const cotizacion =
      Number(gasto.cotizacion) || convertidor.cotizacionDe(gasto.fecha);

    const usd =
      gasto.monto_usd !== null
        ? Number(gasto.monto_usd)
        : cotizacion
          ? montoArs / cotizacion
          : null;

    return {
      ...gasto,
      montoArs,
      cotizacion,
      usd,
      cargadoEnDolares: gasto.moneda === "USD",
      empresa: gasto.pagadora?.nombre ?? "—",
    };
  });

  const totalUsd = convertidos.reduce((acc, g) => acc + (g.usd ?? 0), 0);
  const totalArs = convertidos.reduce((acc, g) => acc + g.montoArs, 0);
  const sinCotizar = convertidos.filter((g) => g.usd === null).length;

  // Cuántos pesos costó, en promedio, cada dólar gastado en esta obra.
  const cotizacionPromedio = totalUsd > 0 ? totalArs / totalUsd : null;

  // Al dólar de hoy, para comparar contra lo que efectivamente costó.
  const alDolarDeHoy = convertidor.actual
    ? totalArs / convertidor.actual.promedio
    : null;

  const porEmpresa = new Map<string, number>();
  for (const g of convertidos) {
    porEmpresa.set(g.empresa, (porEmpresa.get(g.empresa) ?? 0) + (g.usd ?? 0));
  }

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="dolares" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Dólares</h2>
        <p style={ui.subtitle}>
          Cada gasto valuado al dólar oficial de la fecha en que se hizo, no al
          de hoy. Así el total refleja lo que la obra costó de verdad en dólares.
        </p>
      </section>

      {!convertidor.actual && (
        <p style={avisoBox}>
          No se pudo consultar la cotización en Ámbito Financiero. Los montos en
          dólares pueden estar incompletos. Probá de nuevo en un rato.
        </p>
      )}

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Total de obra</p>
          <h3 style={ui.statNumber}>{formatUSD(totalUsd)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>En pesos</p>
          <h3 style={ui.statNumber}>{formatMoney(totalArs)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Dólar promedio de la obra</p>
          <h3 style={ui.statNumber}>
            {cotizacionPromedio ? formatMoney(cotizacionPromedio) : "—"}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Dólar oficial hoy</p>
          <h3 style={ui.statNumber}>
            {convertidor.actual ? formatMoney(convertidor.actual.promedio) : "—"}
          </h3>
        </div>
      </section>

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Dos maneras de leerlo</h3>

        <div style={row}>
          <span>Lo que costó, al dólar de cada fecha</span>
          <strong>{formatUSD(totalUsd)}</strong>
        </div>

        <div style={row}>
          <span>Lo mismo en pesos, al dólar de hoy</span>
          <strong>{formatUSD(alDolarDeHoy)}</strong>
        </div>

        <p style={{ ...ui.note, marginTop: "16px", marginBottom: 0 }}>
          La primera cifra es cuántos dólares se fueron realmente. La segunda es
          cuántos dólares comprarían hoy esos mismos pesos: si es menor, el peso
          se devaluó desde que se hicieron los gastos.
        </p>
      </section>

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Aporte de cada empresa en dólares</h3>

        {porEmpresa.size === 0 ? (
          <p style={ui.vacio}>Todavía no hay gastos cargados.</p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Empresa</th>
                <th style={ui.thRight}>Puso</th>
              </tr>
            </thead>
            <tbody>
              {[...porEmpresa.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([empresa, usd]) => (
                  <tr key={empresa}>
                    <td style={ui.td}>{empresa}</td>
                    <td style={ui.tdRight}>
                      <strong>{formatUSD(usd)}</strong>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Gastos convertidos</h3>

        {sinCotizar > 0 && (
          <p style={{ ...ui.note, marginTop: 0 }}>
            {sinCotizar} {sinCotizar === 1 ? "gasto" : "gastos"} sin cotización
            disponible para su fecha.
          </p>
        )}

        {convertidos.length === 0 ? (
          <p style={ui.vacio}>Todavía no hay gastos cargados en esta obra.</p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Rubro</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.th}>Pagó</th>
                <th style={ui.thRight}>Monto</th>
                <th style={ui.thRight}>Dólar del día</th>
                <th style={ui.thRight}>En dólares</th>
              </tr>
            </thead>
            <tbody>
              {convertidos.map((gasto) => (
                <tr key={gasto.id}>
                  <td style={ui.td}>{formatDate(gasto.fecha)}</td>
                  <td style={ui.td}>{gasto.rubros?.nombre ?? "—"}</td>
                  <td style={ui.td}>{gasto.concepto}</td>
                  <td style={ui.td}>{gasto.empresa}</td>
                  <td style={ui.tdRight}>
                    {formatMoney(gasto.montoArs)}
                    {gasto.cargadoEnDolares && (
                      <span style={tagMoneda}>cargado en USD</span>
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    {gasto.cotizacion ? formatMoney(gasto.cotizacion) : "—"}
                  </td>
                  <td style={ui.tdRight}>
                    <strong>{formatUSD(gasto.usd)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
          Fuente: dólar oficial de Ámbito Financiero, promedio entre compra y
          venta{convertidor.actual ? ` · última actualización ${convertidor.actual.fecha}` : ""}.
          Para gastos de días no hábiles se usa la cotización del día hábil
          anterior.
        </p>
      </section>
    </AppShell>
  );
}

const row = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
  marginTop: "12px",
};

const tagMoneda = {
  display: "block",
  fontSize: "11px",
  color: "#999999",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  marginTop: "2px",
};

const avisoBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
