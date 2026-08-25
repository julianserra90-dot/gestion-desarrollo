import AppShell from "@/components/AppShell";
import GraficoTorta from "@/components/GraficoTorta";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCaja } from "@/lib/caja";
import { getConvertidor } from "@/lib/dolar";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { getLote } from "@/lib/lote";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { ordenarPorTipo } from "@/lib/tipos-gasto";

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

  const [{ data: gastos }, { data: ingresos }, { data: socias }, caja, lote] =
    await Promise.all([
      supabase
        .from("gastos")
        .select(
          "id, fecha, concepto, monto, caja_ars, caja_usd, monto_caja, monto_usd, cotizacion, cotizacion_manual, moneda, tipo_gasto, estado, compartido, rubros(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre)"
        )
        .eq("obra_id", obra.id)
        .order("fecha", { ascending: false }),
      supabase
        .from("ingresos")
        .select(
          "id, fecha, origen, aportante, concepto, monto, monto_usd, cotizacion, moneda, empresas(nombre)"
        )
        .eq("obra_id", obra.id)
        .order("fecha", { ascending: false }),
      // Para repartir entre todas lo que pusieron juntas.
      supabase
        .from("obra_socios")
        .select("empresas(nombre)")
        .eq("obra_id", obra.id),
      getCaja(obra.id),
      // El lote, en dólares, para reflejarlo también en el resumen en USD.
      getLote(obra.id, null, null, null, null),
    ]);

  // Los ajustes de saldo no son gasto de obra, así que quedan afuera.
  const vigentes = (gastos ?? []).filter(
    (g) => g.estado !== "Anulado" && g.tipo_gasto !== "Ajuste de saldo"
  );

  const entradas = ingresos ?? [];

  const convertidor = await getConvertidor([
    ...vigentes.map((g) => g.fecha),
    ...entradas.map((i) => i.fecha),
  ]);

  /**
   * Pasa un movimiento a dólares.
   *
   * Si se guardó con su conversión se usa esa; si es viejo y no la tiene, se
   * calcula al dólar de su fecha.
   */
  function aDolares(movimiento: {
    fecha: string;
    monto: number;
    monto_usd: number | null;
    cotizacion: number | null;
  }) {
    const montoArs = Number(movimiento.monto);
    const cotizacion =
      Number(movimiento.cotizacion) || convertidor.cotizacionDe(movimiento.fecha);

    const usd =
      movimiento.monto_usd !== null
        ? Number(movimiento.monto_usd)
        : cotizacion
          ? montoArs / cotizacion
          : null;

    return { montoArs, cotizacion, usd };
  }

  const convertidos = vigentes.map((gasto) => {
    const { montoArs, cotizacion, usd } = aDolares(gasto);
    const montoCaja = Number(gasto.monto_caja);

    // Un gasto puede haberse pagado en parte con la caja. Las dos puntas se
    // valúan al mismo dólar, prorrateadas sobre el total.
    const proporcion = montoArs > 0 ? montoCaja / montoArs : 0;

    return {
      ...gasto,
      montoArs,
      montoCaja,
      cajaArs: Number(gasto.caja_ars),
      cajaUsd: Number(gasto.caja_usd),
      cotizacion,
      usd,
      usdDeCaja: usd === null ? null : usd * proporcion,
      usdDeEmpresa: usd === null ? null : usd * (1 - proporcion),
      cargadoEnDolares: gasto.moneda === "USD",
      empresa: gasto.compartido
        ? "Entre las socias"
        : (gasto.pagadora?.nombre ??
          (montoCaja > 0 ? "Dinero en cuenta" : "—")),
    };
  });

  const convertidasEntradas = entradas.map((ingreso) => {
    const { montoArs, cotizacion, usd } = aDolares(ingreso);

    return {
      ...ingreso,
      montoArs,
      cotizacion,
      usd,
      cargadoEnDolares: ingreso.moneda === "USD",
      quien: ingreso.empresas?.nombre ?? ingreso.aportante ?? "—",
    };
  });

  const totalUsd = convertidos.reduce((acc, g) => acc + (g.usd ?? 0), 0);
  const totalArs = convertidos.reduce((acc, g) => acc + g.montoArs, 0);

  // "En qué se gastó", en dólares: cada rubro más el lote (que ya está en USD).
  // Es la misma lectura que en Economía, pero en la moneda en que se piensa.
  // Igual que en Economía, de cada rubro se guarda el desglose por tipo: el
  // gráfico lo dibuja en tonos del mismo color.
  const porRubroUsd = new Map<
    string,
    { total: number; porTipo: Map<string, number> }
  >();

  for (const g of convertidos) {
    const nombre = g.rubros?.nombre ?? "Sin rubro";
    const actual = porRubroUsd.get(nombre) ?? {
      total: 0,
      porTipo: new Map<string, number>(),
    };

    const tipo = g.tipo_gasto ?? "Sin tipo";
    actual.porTipo.set(tipo, (actual.porTipo.get(tipo) ?? 0) + (g.usd ?? 0));

    porRubroUsd.set(nombre, { ...actual, total: actual.total + (g.usd ?? 0) });
  }

  const tortaUsd = [
    ...[...porRubroUsd.entries()].map(([etiqueta, r]) => ({
      etiqueta,
      valor: r.total,
      partes: ordenarPorTipo(r.porTipo),
    })),
    ...(lote.totalUsd > 0
      ? [{ etiqueta: "Lote / Terreno", valor: lote.totalUsd, partes: [] }]
      : []),
  ];

  const inversionUsd = totalUsd + lote.totalUsd;
  const sinCotizar =
    convertidos.filter((g) => g.usd === null).length +
    convertidasEntradas.filter((i) => i.usd === null).length;

  // Cuántos pesos costó, en promedio, cada dólar gastado en esta obra.
  const cotizacionPromedio = totalUsd > 0 ? totalArs / totalUsd : null;

  // Al dólar de hoy, para comparar contra lo que efectivamente costó.
  const alDolarDeHoy = convertidor.actual
    ? totalArs / convertidor.actual.promedio
    : null;

  // -------------------------- Dinero en cuenta ------------------------------
  // El lado en dólares no necesita valuación: son dólares. El que sí conviene
  // mirar en dólares es el lado en pesos, porque ahí la devaluación muerde.
  const arsEntroUsd = convertidasEntradas
    .filter((i) => i.moneda !== "USD")
    .reduce((acc, i) => acc + (i.usd ?? 0), 0);

  const arsSalioUsd = convertidos.reduce(
    (acc, g) => acc + (g.cotizacion ? g.cajaArs / g.cotizacion : 0),
    0
  );

  // Lo que valían en dólares los pesos que hoy siguen en la cuenta, contados
  // al cambio del día en que entraron y salieron.
  const arsHistoricoUsd = arsEntroUsd - arsSalioUsd;
  // Lo que compran hoy esos mismos pesos.
  const arsHoyUsd = convertidor.actual
    ? caja.arsSaldo / convertidor.actual.promedio
    : null;

  // Total disponible medido en dólares de hoy.
  const cajaUsdHoy = arsHoyUsd === null ? null : caja.usdSaldo + arsHoyUsd;

  // Los dólares que salieron rindieron esto en pesos.
  const usdVendidosEnPesos = convertidos.reduce(
    (acc, g) => acc + g.cajaUsd * (g.cotizacion ?? 0),
    0
  );

  const salioUsd = convertidos.reduce((acc, g) => acc + (g.usdDeCaja ?? 0), 0);
  const hayCaja = entradas.length > 0;

  // Lo que puso cada socia: de su bolsillo en los gastos, más lo que metió en
  // la cuenta. La parte que pagó la caja no es de nadie en particular.
  const porEmpresa = new Map<string, { bolsillo: number; cuenta: number }>();

  const sumar = (empresa: string, campo: "bolsillo" | "cuenta", usd: number) => {
    const actual = porEmpresa.get(empresa) ?? { bolsillo: 0, cuenta: 0 };
    actual[campo] += usd;
    porEmpresa.set(empresa, actual);
  };

  // Los nombres de las socias, para repartir entre todas lo que pusieron juntas.
  const nombresSocias = (socias ?? [])
    .map((s) => s.empresas?.nombre)
    .filter((nombre): nombre is string => Boolean(nombre));

  for (const g of convertidos) {
    // Lo que pusieron entre todas se divide en partes iguales, igual que en el
    // balance de obra.
    if (g.compartido && nombresSocias.length > 0) {
      const porSocia = (g.usdDeEmpresa ?? 0) / nombresSocias.length;
      for (const nombre of nombresSocias) sumar(nombre, "bolsillo", porSocia);
    } else if (g.pagadora?.nombre) {
      sumar(g.pagadora.nombre, "bolsillo", g.usdDeEmpresa ?? 0);
    }
  }

  for (const i of convertidasEntradas) {
    if (i.origen === "Empresa socia" && i.empresas?.nombre) {
      sumar(i.empresas.nombre, "cuenta", i.usd ?? 0);
    }
  }

  const aportes = [...porEmpresa.entries()]
    .map(([empresa, valores]) => ({
      empresa,
      ...valores,
      total: valores.bolsillo + valores.cuenta,
    }))
    .sort((a, b) => b.total - a.total);

  const hayAportesEnCuenta = aportes.some((a) => a.cuenta > 0);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="dolares" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Dólares</h2>
        <p style={ui.subtitle}>
          Cada movimiento valuado al dólar blue de la fecha en que se hizo, no
          al de hoy. Así el total refleja lo que la obra costó de verdad en
          dólares, y lo que valían los aportes cuando entraron.
        </p>
      </section>

      {!convertidor.actual && (
        <p style={avisoBox}>
          No se pudo consultar la cotización en Ámbito Financiero. Los montos en
          dólares pueden estar incompletos. Probá de nuevo en un rato.
        </p>
      )}

      <section style={{ ...ui.statsGrid, gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div style={ui.statCard}>
          <p style={ui.label}>Total de obra</p>
          <h3 style={ui.statNumber}>{formatUSD(totalUsd)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>En pesos</p>
          <h3 style={ui.statNumber}>{formatMoney(totalArs)}</h3>
        </div>
        <div style={ui.statCard}>
          {/* Al dólar de hoy: es lo que esa plata compra ahora, que es lo que
              importa a la hora de decidir si alcanza para el próximo pago. */}
          <p style={ui.label}>Dinero en cuenta hoy</p>
          <h3 style={ui.statNumber}>{formatUSD(cajaUsdHoy)}</h3>
          <p style={{ ...ui.note, margin: "6px 0 0" }}>
            {formatMoney(caja.arsSaldo)} + {formatUSD(caja.usdSaldo)}
          </p>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Dólar promedio de la obra</p>
          <h3 style={ui.statNumber}>
            {cotizacionPromedio ? formatMoney(cotizacionPromedio) : "—"}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Dólar blue hoy</p>
          <h3 style={ui.statNumber}>
            {convertidor.actual ? formatMoney(convertidor.actual.promedio) : "—"}
          </h3>
          {/* Las dos puntas debajo del promedio: así se ve de dónde sale el
              número que se está usando, sin tener que ir a mirar Ámbito. */}
          {convertidor.actual && (
            <p style={{ ...ui.note, margin: "6px 0 0" }}>
              compra {formatMoney(convertidor.actual.compra)} · venta{" "}
              {formatMoney(convertidor.actual.venta)}
            </p>
          )}
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

      {tortaUsd.length > 0 && (
        <section style={ui.panelConMargen}>
          <h3 style={ui.sectionTitle}>En qué se gastó, en dólares</h3>
          <div style={{ marginTop: "20px" }}>
            <GraficoTorta datos={tortaUsd} formato={formatUSD} />

            {lote.totalUsd > 0 && (
              <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
                <strong>Inversión total: {formatUSD(inversionUsd)}</strong> (obra
                + lote). El lote ya está en dólares; los gastos se valúan al de
                cada fecha.
              </p>
            )}
          </div>
        </section>
      )}

      {hayCaja && (
        <section style={ui.panelConMargen}>
          <h3 style={ui.sectionTitle}>Dinero en cuenta en dólares</h3>

          <div style={row}>
            <span>Dólares en la cuenta</span>
            <strong>{formatUSD(caja.usdSaldo)}</strong>
          </div>

          <div style={row}>
            <span>
              Pesos en la cuenta ({formatMoney(caja.arsSaldo)}), al dólar de hoy
            </span>
            <strong>{formatUSD(arsHoyUsd)}</strong>
          </div>

          <div style={filaDestacada}>
            <span>Total disponible, medido hoy</span>
            <strong>{formatUSD(cajaUsdHoy)}</strong>
          </div>

          <p style={{ ...ui.note, marginTop: "16px", marginBottom: 0 }}>
            Los dólares no necesitan valuarse: son dólares y siguen ahí hasta
            que se usen.{" "}
            {arsHoyUsd !== null && arsHistoricoUsd - arsHoyUsd > 1 ? (
              <>
                Los pesos sí: los que quedan en la cuenta valían{" "}
                <strong>{formatUSD(arsHistoricoUsd)}</strong> cuando entraron y
                hoy compran <strong>{formatUSD(arsHoyUsd)}</strong>. La
                diferencia se la comió la devaluación.
              </>
            ) : (
              <>
                Los pesos que quedan en la cuenta valían{" "}
                {formatUSD(arsHistoricoUsd)} cuando entraron.
              </>
            )}
          </p>

          {usdVendidosEnPesos > 0 && (
            <p style={{ ...ui.note, marginTop: "12px", marginBottom: 0 }}>
              De la cuenta ya se vendieron {formatUSD(caja.usdUsado)}, que
              rindieron <strong>{formatMoney(usdVendidosEnPesos)}</strong> al
              cambio con que se cargó cada gasto.
            </p>
          )}
        </section>
      )}

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Aporte de cada empresa en dólares</h3>

        {aportes.length === 0 ? (
          <p style={ui.vacio}>Todavía no hay movimientos cargados.</p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Empresa</th>
                <th style={ui.thRight}>De su bolsillo</th>
                {hayAportesEnCuenta && <th style={ui.thRight}>Puso en cuenta</th>}
                <th style={ui.thRight}>Total</th>
              </tr>
            </thead>
            <tbody>
              {aportes.map((aporte) => (
                <tr key={aporte.empresa}>
                  <td style={ui.td}>{aporte.empresa}</td>
                  <td style={ui.tdRight}>
                    {aporte.bolsillo > 0 ? formatUSD(aporte.bolsillo) : "—"}
                  </td>
                  {hayAportesEnCuenta && (
                    <td style={ui.tdRight}>
                      {aporte.cuenta > 0 ? formatUSD(aporte.cuenta) : "—"}
                    </td>
                  )}
                  <td style={ui.tdRight}>
                    <strong>{formatUSD(aporte.total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {salioUsd > 0 && (
          <p style={{ ...ui.note, marginTop: "16px", marginBottom: 0 }}>
            No entran acá los {formatUSD(salioUsd)} que se pagaron con el dinero
            en cuenta: esa plata ya figura como aporte de quien la puso.
          </p>
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
                  <td style={ui.td}>
                    {gasto.empresa}
                    {(gasto.pagadora?.nombre || gasto.compartido) &&
                      gasto.montoCaja > 0 && (
                        <span style={tagMoneda}>
                          + {formatUSD(gasto.usdDeCaja)} de la cuenta
                        </span>
                      )}
                  </td>
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

      </section>

      {hayCaja && (
        <section style={ui.panelConMargen}>
          <h3 style={ui.sectionTitle}>Ingresos convertidos</h3>

          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Origen</th>
                <th style={ui.th}>Quién</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.thRight}>Monto</th>
                <th style={ui.thRight}>Dólar del día</th>
                <th style={ui.thRight}>En dólares</th>
              </tr>
            </thead>
            <tbody>
              {convertidasEntradas.map((ingreso) => (
                <tr key={ingreso.id}>
                  <td style={ui.td}>{formatDate(ingreso.fecha)}</td>
                  <td style={ui.td}>{ingreso.origen}</td>
                  <td style={ui.td}>{ingreso.quien}</td>
                  <td style={ui.td}>{ingreso.concepto}</td>
                  <td style={ui.tdRight}>
                    {formatMoney(ingreso.montoArs)}
                    {ingreso.cargadoEnDolares && (
                      <span style={tagMoneda}>cargado en USD</span>
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    {ingreso.cotizacion ? formatMoney(ingreso.cotizacion) : "—"}
                  </td>
                  <td style={ui.tdRight}>
                    <strong>{formatUSD(ingreso.usd)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p style={{ ...ui.note, marginTop: "20px" }}>
        Fuente: dólar blue de Ámbito Financiero, promedio entre compra y venta
        {convertidor.actual ? ` · última actualización ${convertidor.actual.fecha}` : ""}.
        Para movimientos de días sin cotización se usa la del día anterior más
        cercano.
      </p>
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

const filaDestacada = {
  ...row,
  borderTop: "2px solid #111111",
  paddingTop: "14px",
  marginTop: "14px",
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
