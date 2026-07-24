import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCaja } from "@/lib/caja";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

type Movimiento = {
  id: string;
  fecha: string;
  orden: string;
  entrada: boolean;
  etiqueta: string;
  detalle: string;
  quien: string;
  /** Positivo si entra, negativo si sale. */
  ars: number;
  usd: number;
  href: string;
};

export default async function DineroEnCuentaPage({
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

  const [{ data: ingresos }, { data: gastos }, caja] = await Promise.all([
    supabase
      .from("ingresos")
      .select(
        "id, fecha, creado_en, origen, aportante, concepto, monto, monto_usd, moneda, empresas(nombre)"
      )
      .eq("obra_id", obra.id),
    // Sólo los gastos que efectivamente tocaron la cuenta.
    supabase
      .from("gastos")
      .select(
        "id, fecha, creado_en, concepto, monto, caja_ars, caja_usd, cotizacion, cotizacion_manual, monto_caja, proveedores(nombre)"
      )
      .eq("obra_id", obra.id)
      .eq("estado", "Pagado")
      .or("caja_ars.gt.0,caja_usd.gt.0"),
    getCaja(obra.id),
  ]);

  const movimientos: Movimiento[] = [
    ...(ingresos ?? []).map((i) => ({
      id: `i-${i.id}`,
      fecha: i.fecha,
      orden: i.creado_en,
      entrada: true,
      etiqueta: i.origen,
      detalle: i.concepto,
      quien: i.empresas?.nombre ?? i.aportante ?? "—",
      // Un aporte en dólares queda en dólares; uno en pesos, en pesos.
      ars: i.moneda === "USD" ? 0 : Number(i.monto),
      usd: i.moneda === "USD" ? Number(i.monto_usd ?? 0) : 0,
      href: `/obras/${obra.slug}/ingresos/${i.id}/editar`,
    })),
    ...(gastos ?? []).map((g) => ({
      id: `g-${g.id}`,
      fecha: g.fecha,
      orden: g.creado_en,
      entrada: false,
      // Un gasto pagado en parte con la cuenta se aclara, para que no parezca
      // que la cuenta se hizo cargo de todo.
      etiqueta:
        Number(g.monto_caja) < Number(g.monto) ? "Gasto (parcial)" : "Gasto",
      detalle: g.concepto,
      quien: g.proveedores?.nombre ?? "—",
      ars: -Number(g.caja_ars),
      usd: -Number(g.caja_usd),
      href: `/obras/${obra.slug}/gastos/${g.id}/editar`,
    })),
  ];

  // Se acumula del más viejo al más nuevo para poder mostrar cómo quedó la
  // cuenta después de cada movimiento, y recién ahí se da vuelta la lista.
  movimientos.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.orden.localeCompare(b.orden)
  );

  let corrienteArs = 0;
  let corrienteUsd = 0;
  const conSaldo = movimientos.map((m) => {
    corrienteArs += m.ars;
    corrienteUsd += m.usd;
    return { ...m, saldoArs: corrienteArs, saldoUsd: corrienteUsd };
  });

  conSaldo.reverse();

  // Los dólares que se vendieron para pagar gastos rindieron más (o menos) que
  // su valor de entrada. Esa diferencia le queda a la obra, no a quien los puso.
  const usadoDeDolares = (gastos ?? []).reduce(
    (acc, g) => acc + Number(g.caja_usd) * Number(g.cotizacion ?? 0),
    0
  );

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="caja" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Dinero en cuenta</h2>
        <p style={ui.subtitle}>
          Lo que hay disponible para gastar. La cuenta tiene dos lados: los
          pesos que entran quedan como pesos y los dólares como dólares, hasta
          que se usen.
        </p>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Pesos en cuenta</p>
          <h3 style={ui.statNumber}>{formatMoney(caja.arsSaldo)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Dólares en cuenta</p>
          <h3 style={ui.statNumber}>{formatUSD(caja.usdSaldo)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Se gastó de acá</p>
          <h3 style={ui.statNumber}>{formatMoney(caja.usado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Movimientos</p>
          <h3 style={ui.statNumber}>{conSaldo.length}</h3>
        </div>
      </section>

      <section style={{ ...ui.panelConMargen, ...columnas }}>
        <div>
          <h3 style={ui.sectionTitle}>Los dos lados de la cuenta</h3>

          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}></th>
                <th style={ui.thRight}>Pesos</th>
                <th style={ui.thRight}>Dólares</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={ui.td}>Entró</td>
                <td style={ui.tdRight}>{formatMoney(caja.arsIngresado)}</td>
                <td style={ui.tdRight}>{formatUSD(caja.usdIngresado)}</td>
              </tr>
              <tr>
                <td style={ui.td}>Se usó en gastos</td>
                <td style={ui.tdRight}>− {formatMoney(caja.arsUsado)}</td>
                <td style={ui.tdRight}>− {formatUSD(caja.usdUsado)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td style={tdTotal}>Disponible</td>
                <td style={tdTotalRight}>{formatMoney(caja.arsSaldo)}</td>
                <td style={tdTotalRight}>{formatUSD(caja.usdSaldo)}</td>
              </tr>
            </tfoot>
          </table>

          {caja.usdUsado > 0 && (
            <p style={{ ...ui.note, marginTop: "16px", marginBottom: 0 }}>
              Los {formatUSD(caja.usdUsado)} que salieron rindieron{" "}
              <strong>{formatMoney(usadoDeDolares)}</strong>, al cambio con que
              se cargó cada gasto.
            </p>
          )}
        </div>

        <div style={cajaNota}>
          <p style={tituloNota}>Cómo juega en el balance</p>
          <p style={{ ...ui.note, margin: "0 0 12px" }}>
            Lo que pone una socia cuenta como aporte suyo por el valor en pesos
            que tenía el día que entró: {formatMoney(caja.ingresosSocias)} en
            total.
          </p>
          <p style={{ ...ui.note, margin: "0 0 12px" }}>
            Lo que ponen inversores y compradores ({formatMoney(caja.ingresosTerceros)})
            baja el gasto que se reparten las socias: nadie se lo lleva como
            aporte propio.
          </p>
          <p style={{ ...ui.note, margin: 0 }}>
            Si los dólares se venden mejor que el día que entraron, esa
            diferencia le rinde a la obra y beneficia a todas según su
            porcentaje.
          </p>
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Movimientos</h3>

        <Link href={`/obras/${obra.slug}/ingresos/nuevo`} style={ui.button}>
          Nuevo ingreso
        </Link>
      </div>

      <section style={ui.panel}>
        {conSaldo.length === 0 ? (
          <p style={ui.vacio}>
            Todavía no entró ni salió plata de la cuenta de esta obra.
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Movimiento</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.th}>Quién</th>
                <th style={ui.thRight}>Pesos</th>
                <th style={ui.thRight}>Dólares</th>
                <th style={ui.thRight}>Quedan</th>
              </tr>
            </thead>
            <tbody>
              {conSaldo.map((mov) => (
                <tr key={mov.id}>
                  <td style={ui.td}>{formatDate(mov.fecha)}</td>
                  <td style={ui.td}>
                    <span style={mov.entrada ? tagEntrada : tagSalida}>
                      {mov.etiqueta}
                    </span>
                  </td>
                  <td style={ui.td}>
                    <Link href={mov.href} style={detalleLink}>
                      {mov.detalle}
                    </Link>
                  </td>
                  <td style={ui.td}>{mov.quien}</td>
                  <td style={ui.tdRight}>
                    {mov.ars === 0 ? (
                      <span style={{ color: "#bbbbbb" }}>—</span>
                    ) : (
                      `${mov.ars > 0 ? "+" : "−"} ${formatMoney(Math.abs(mov.ars))}`
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    {mov.usd === 0 ? (
                      <span style={{ color: "#bbbbbb" }}>—</span>
                    ) : (
                      `${mov.usd > 0 ? "+" : "−"} ${formatUSD(Math.abs(mov.usd))}`
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    <strong>{formatMoney(mov.saldoArs)}</strong>
                    <div style={saldoSecundario}>{formatUSD(mov.saldoUsd)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p style={{ ...ui.note, marginTop: "20px" }}>
        Los gastos anulados devuelven su plata a la cuenta y desaparecen de esta
        lista.
      </p>
    </AppShell>
  );
}

const columnas = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "32px",
  alignItems: "start",
};

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

const cajaNota = {
  border: "1px solid #111111",
  padding: "16px",
};

const tituloNota = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#555555",
  margin: "0 0 10px",
};

const tagEntrada = {
  border: "1px solid #111111",
  background: "#111111",
  color: "#ffffff",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tagSalida = {
  border: "1px solid #dcdcdc",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const saldoSecundario = {
  fontSize: "13px",
  color: "#999999",
  marginTop: "4px",
};

const detalleLink = {
  color: "#111111",
  textDecoration: "underline",
};
