import Link from "next/link";
import AppShell from "@/components/AppShell";
import GraficoTorta from "@/components/GraficoTorta";
import ObraHeader from "@/components/ObraHeader";
import { getCaja } from "@/lib/caja";
import { formatMoney, formatUSD } from "@/lib/format";
import { calcularLiquidacion } from "@/lib/liquidacion";
import { getLote } from "@/lib/lote";
import { createClient } from "@/lib/supabase/server";
import { ordenarPorTipo } from "@/lib/tipos-gasto";

export default async function ObraDetalle({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const { data: obra } = await supabase
    .from("obras")
    .select("id, slug, nombre, ubicacion, estado, presupuesto, lote_valor_usd")
    .eq("slug", obraId)
    .maybeSingle();

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const [{ data: balance }, { data: resumen }, { data: gastos }, caja, lote] = await Promise.all([
    supabase
      .from("obra_balance")
      .select(
        "empresa_id, empresa, porcentaje, pagado, le_corresponde, saldo, pagado_facturado, pagado_efectivo, ajustes, aportes, total_a_repartir"
      )
      .eq("obra_id", obra.id),
    supabase
      .from("obra_resumen")
      .select(
        "total_gastado, avance_financiero, total_facturado, total_efectivo, presupuesto_aprobado"
      )
      .eq("obra_id", obra.id)
      .maybeSingle(),
    supabase
      .from("gastos")
      .select(
        "monto, iva, empresa_factura_id, estado, tipo_gasto, rubro_id, rubros(nombre)"
      )
      .eq("obra_id", obra.id),
    getCaja(obra.id),
    // El valor pactado del lote hace falta para calcular cuánto le resta pagar
    // a cada socia; el resto de la ficha acá no se usa.
    getLote(obra.id, obra.lote_valor_usd, null, null, null),
  ]);

  // El crédito fiscal es de la empresa que figura en cada factura A. La columna
  // `iva` ya da 0 en el resto, así que se agrupa por el titular de la factura.
  const creditoPorEmpresa = new Map<string, number>();
  for (const g of gastos ?? []) {
    if (g.estado === "Anulado" || !g.empresa_factura_id) continue;
    const iva = Number(g.iva ?? 0);
    if (iva > 0) {
      creditoPorEmpresa.set(
        g.empresa_factura_id,
        (creditoPorEmpresa.get(g.empresa_factura_id) ?? 0) + iva
      );
    }
  }

  const socios = (balance ?? []).map((item) => ({
    empresaId: item.empresa_id,
    empresa: item.empresa ?? "—",
    porcentaje: Number(item.porcentaje ?? 0),
    pagado: Number(item.pagado ?? 0),
    leCorresponde: Number(item.le_corresponde ?? 0),
    saldo: Number(item.saldo ?? 0),
    facturado: Number(item.pagado_facturado ?? 0),
    efectivo: Number(item.pagado_efectivo ?? 0),
    ajustes: Number(item.ajustes ?? 0),
    aportes: Number(item.aportes ?? 0),
    creditoFiscal: item.empresa_id
      ? (creditoPorEmpresa.get(item.empresa_id) ?? 0)
      : 0,
  }));

  // Las columnas de ajustes, aportes y crédito fiscal sólo aparecen si alguna
  // socia tiene.
  const hayAjustes = socios.some((s) => s.ajustes !== 0);
  const hayAportes = socios.some((s) => s.aportes !== 0);
  const hayCreditoFiscal = socios.some((s) => s.creditoFiscal > 0);

  const aRepartir = Number(balance?.[0]?.total_a_repartir ?? 0);

  const suma = (campo: (s: (typeof socios)[number]) => number) =>
    socios.reduce((acc, s) => acc + campo(s), 0);

  const liquidacion = calcularLiquidacion(socios);

  // Desglose de en qué se gastó. No cuentan los anulados ni los ajustes de
  // saldo: un ajuste mueve plata entre socias, no compra nada para la obra.
  const vigentes = (gastos ?? []).filter(
    (g) => g.estado !== "Anulado" && g.tipo_gasto !== "Ajuste de saldo"
  );
  const totalVigente = vigentes.reduce((acc, g) => acc + Number(g.monto), 0);

  // El IVA que se puede recuperar: la columna `iva` ya da 0 en todo lo que no
  // sea factura A, así que alcanza con sumarla.
  const creditoFiscal = vigentes.reduce((acc, g) => acc + Number(g.iva ?? 0), 0);

  // Cada rubro se guarda con su id para poder entrar al detalle desde la
  // leyenda, y con cuánto fue de cada tipo de gasto: eso es lo que el gráfico
  // dibuja en tonos del mismo color. Los gastos sin rubro no llevan enlace.
  const porRubro = new Map<
    string,
    {
      nombre: string;
      id: string | null;
      total: number;
      porTipo: Map<string, number>;
    }
  >();

  for (const gasto of vigentes) {
    const clave = gasto.rubro_id ?? "sin-rubro";
    const actual = porRubro.get(clave) ?? {
      nombre: gasto.rubros?.nombre ?? "Sin rubro",
      id: gasto.rubro_id,
      total: 0,
      porTipo: new Map<string, number>(),
    };

    const tipo = gasto.tipo_gasto ?? "Sin tipo";
    actual.porTipo.set(tipo, (actual.porTipo.get(tipo) ?? 0) + Number(gasto.monto));

    porRubro.set(clave, { ...actual, total: actual.total + Number(gasto.monto) });
  }

  // El lote (en dólares) valuado en pesos entra como una porción más: es una
  // inversión aparte de la obra, pero también es plata que salió. No se
  // desglosa porque es una compra sola.
  const loteArs = Math.round(lote.totalArs);
  const totalConLote = totalVigente + loteArs;

  const torta = [
    ...[...porRubro.values()].map((r) => ({
      etiqueta: r.nombre,
      valor: r.total,
      href: r.id ? `/obras/${obra.slug}/rubro/${r.id}` : undefined,
      partes: ordenarPorTipo(r.porTipo),
    })),
    ...(loteArs > 0
      ? [
          {
            etiqueta: "Lote / Terreno",
            valor: loteArs,
            href: `/obras/${obra.slug}/lote`,
            partes: [],
          },
        ]
      : []),
  ].sort((a, b) => b.valor - a.valor);

  // Sin presupuesto cargado no hay contra qué comparar: mostrar "0% consumido"
  // haría creer que no se gastó nada.
  const hayPresupuesto = Number(obra.presupuesto ?? 0) > 0;
  const aprobado = Number(resumen?.presupuesto_aprobado ?? 0);
  const consumido = hayPresupuesto ? `${resumen?.avance_financiero ?? 0}%` : "—";

  // El terreno va aparte de la obra: es una compra de inmueble y no entra en el
  // balance de arriba. Acá va sólo quién puso cuánto y, si el precio pactado no
  // está saldado, cuánto le resta a cada socia según su porcentaje. El detalle
  // vive en la solapa Lote.
  const hayTerreno = lote.pagos.length > 0 || (lote.valorUsd ?? 0) > 0;
  const faltaPagar = lote.saldoUsd !== null && lote.saldoUsd > 0.005;
  const puestoTerreno = lote.socios.reduce((acc, s) => acc + s.puestoUsd, 0);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="economia" />

      <section style={encabezado}>
        <p style={eyebrowSeccion}>Situación económica</p>
        <h2 style={tituloSeccion}>Economía</h2>
      </section>

      <section style={statsGrid}>
        <div style={card}>
          <p style={label}>Total gastado</p>
          <h3 style={number}>{formatMoney(resumen?.total_gastado)}</h3>
        </div>
        <div style={card}>
          <p style={label}>Facturado</p>
          <h3 style={number}>{formatMoney(resumen?.total_facturado)}</h3>
        </div>
        <div style={card}>
          <p style={label}>En efectivo</p>
          <h3 style={number}>{formatMoney(resumen?.total_efectivo)}</h3>
        </div>
        <Link href={`/obras/${obra.slug}/ingresos`} style={cardEnlace}>
          <p style={label}>Dinero en cuenta</p>
          <h3 style={number}>{formatMoney(caja.arsSaldo)}</h3>
          <p style={{ ...note, margin: "6px 0 0" }}>
            {formatUSD(caja.usdSaldo)}
          </p>
        </Link>
        <div style={card}>
          <p style={label}>Crédito fiscal (IVA)</p>
          <h3 style={number}>{formatMoney(creditoFiscal)}</h3>
        </div>
      </section>

      <section style={panelWithMargin}>
        <h3 style={sectionTitle}>En qué se gastó</h3>

        <GraficoTorta datos={torta} formato={formatMoney} />

        {loteArs > 0 && (
          <p style={notaTorta}>
            <strong>Inversión total: {formatMoney(totalConLote)}</strong> (obra
            + lote)
          </p>
        )}
      </section>

      <section style={panelWithMargin}>
        <h3 style={sectionTitle}>Ejecución presupuestaria</h3>

        <div style={ejecucionGrid}>
          <div>
            <p style={label}>Presupuesto estimado</p>
            <p style={number}>
              {hayPresupuesto ? formatMoney(obra.presupuesto) : "—"}
            </p>
          </div>
          {/* El estimado se calculó antes de arrancar; el real lo van armando
              las cotizaciones que se aprueban a medida que avanza la obra. */}
          <div>
            <p style={label}>Presupuesto real</p>
            <p style={number}>
              {aprobado > 0 ? (
                <Link
                  href={`/obras/${obra.slug}/presupuestos`}
                  style={{ color: "#111111" }}
                >
                  {formatMoney(aprobado)}
                </Link>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p style={label}>Gastado</p>
            <p style={number}>{formatMoney(resumen?.total_gastado)}</p>
          </div>
          <div>
            <p style={label}>Consumido</p>
            <p style={number}>{consumido}</p>
          </div>
        </div>
      </section>

      <section style={panelWithMargin}>
        <h3 style={sectionTitle}>Balance entre empresas</h3>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Empresa</th>
              <th style={th}>Particip.</th>
              <th style={thRight}>Facturado</th>
              <th style={thRight}>Efectivo</th>
              {hayAportes && <th style={thRight}>Puso en cuenta</th>}
              {hayAjustes && <th style={thRight}>Ajustes</th>}
              <th style={thRight}>Total obra</th>
              {hayCreditoFiscal && <th style={thRight}>Crédito fiscal</th>}
              <th style={thRight}>Le corresponde</th>
              <th style={thRight}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {socios.map((socio) => (
              <tr key={socio.empresa}>
                <td style={td}>{socio.empresa}</td>
                <td style={td}>{socio.porcentaje}%</td>
                <td style={tdRight}>
                  {socio.facturado > 0 ? formatMoney(socio.facturado) : "—"}
                </td>
                <td style={tdRight}>
                  {socio.efectivo > 0 ? formatMoney(socio.efectivo) : "—"}
                </td>
                {hayAportes && (
                  <td style={tdRight}>
                    {socio.aportes > 0 ? formatMoney(socio.aportes) : "—"}
                  </td>
                )}
                {hayAjustes && (
                  <td style={tdRight}>
                    {socio.ajustes !== 0 ? (
                      <span>
                        {socio.ajustes > 0 ? "+" : ""}
                        {formatMoney(socio.ajustes)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td style={tdRight}>
                  <strong>{formatMoney(socio.pagado)}</strong>
                </td>
                {hayCreditoFiscal && (
                  <td style={tdRight}>
                    {socio.creditoFiscal > 0
                      ? formatMoney(socio.creditoFiscal)
                      : "—"}
                  </td>
                )}
                <td style={tdRight}>{formatMoney(socio.leCorresponde)}</td>
                <td style={tdRight}>
                  {/* El signo acompaña al color: así se entiende igual en una
                      impresión en blanco y negro o con daltonismo. */}
                  <strong style={estiloSaldo(socio.saldo)}>
                    {socio.saldo > 0 ? "+" : ""}
                    {formatMoney(socio.saldo)}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={tdTotal} colSpan={2}>
                Puesto por las socias
              </td>
              <td style={tdTotalRight}>{formatMoney(suma((s) => s.facturado))}</td>
              <td style={tdTotalRight}>{formatMoney(suma((s) => s.efectivo))}</td>
              {hayAportes && (
                <td style={tdTotalRight}>{formatMoney(suma((s) => s.aportes))}</td>
              )}
              {hayAjustes && <td style={tdTotalRight}>—</td>}
              <td style={tdTotalRight}>{formatMoney(suma((s) => s.pagado))}</td>
              {hayCreditoFiscal && (
                <td style={tdTotalRight}>
                  {formatMoney(suma((s) => s.creditoFiscal))}
                </td>
              )}
              <td style={tdTotalRight}>{formatMoney(aRepartir)}</td>
              <td style={tdTotalRight}>{formatMoney(suma((s) => s.saldo))}</td>
            </tr>
          </tfoot>
        </table>

        <div style={resultBox}>
          <p style={resultTitle}>Liquidación sugerida</p>

          {liquidacion.length === 0 ? (
            <p style={resultText}>Las empresas están equilibradas.</p>
          ) : (
            <ul style={resultList}>
              {liquidacion.map((mov, i) => (
                <li key={i} style={resultText}>
                  <strong>{mov.de}</strong> le transfiere{" "}
                  <strong>{formatMoney(mov.monto)}</strong> a{" "}
                  <strong>{mov.a}</strong>.
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {hayTerreno && (
        <section style={panelWithMargin}>
          <h3 style={sectionTitle}>Terreno</h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Empresa</th>
                <th style={thRight}>Puso</th>
                {faltaPagar && <th style={thRight}>Resta pagar</th>}
              </tr>
            </thead>
            <tbody>
              {lote.socios.map((socio) => (
                <tr key={socio.empresaId}>
                  <td style={td}>{socio.empresa}</td>
                  <td style={tdRight}>
                    {socio.puestoUsd > 0 ? formatUSD(socio.puestoUsd) : "—"}
                  </td>
                  {/* Lo que falta del precio pactado, repartido por el
                      porcentaje de cada socia. */}
                  {faltaPagar && (
                    <td style={tdRight}>
                      {formatUSD((socio.porcentaje / 100) * (lote.saldoUsd ?? 0))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={tdTotal}>Total</td>
                <td style={tdTotalRight}>{formatUSD(puestoTerreno)}</td>
                {faltaPagar && (
                  <td style={tdTotalRight}>{formatUSD(lote.saldoUsd ?? 0)}</td>
                )}
              </tr>
            </tfoot>
          </table>

          {/* Un pago sin socia no se le atribuye a nadie: la columna "Puso"
              queda corta contra lo desembolsado y hay que decirlo. */}
          {lote.sinAsignarUsd > 0 && (
            <p style={note}>
              {formatUSD(lote.sinAsignarUsd)} en pagos sin socia asignada — se
              asignan editando el pago en la solapa{" "}
              <Link href={`/obras/${obra.slug}/lote`} style={enlaceNota}>
                Lote
              </Link>
              .
            </p>
          )}
        </section>
      )}
    </AppShell>
  );
}

const encabezado = {
  marginBottom: "28px",
};

const eyebrowSeccion = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

const tituloSeccion = {
  fontSize: "36px",
  fontWeight: 400,
  margin: "8px 0",
};

// Las cinco tarjetas en una misma línea; si la ventana no da, bajan de a fila
// en vez de desbordar con scroll horizontal.
const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
};

const card = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  background: "#ffffff",
};

// Misma tarjeta, pero lleva a la solapa donde está el detalle de la cuenta.
const cardEnlace = {
  ...card,
  display: "block",
  color: "#111111",
  textDecoration: "none",
};

const label = {
  fontSize: "13px",
  color: "#777777",
  margin: 0,
};

const number = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "12px 0 0",
};

const panelWithMargin = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  marginTop: "32px",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
  marginTop: 0,
};

const ejecucionGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
};

const notaTorta = {
  fontSize: "14px",
  color: "#555555",
  marginTop: "20px",
  marginBottom: 0,
};

const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
  marginBottom: 0,
};

const enlaceNota = {
  color: "#111111",
  textDecoration: "underline",
};

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const th = {
  textAlign: "left" as const,
  fontSize: "12px",
  color: "#777777",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  borderBottom: "1px solid #e5e5e5",
  padding: "12px",
};

const thRight = {
  ...th,
  textAlign: "right" as const,
};

const td = {
  borderBottom: "1px solid #eeeeee",
  padding: "14px 12px",
  color: "#333333",
};

const tdRight = {
  ...td,
  textAlign: "right" as const,
};

// Verde: puso de más y le deben. Rojo: debe compensar. Negro: está en cero.
const VERDE = "#15803d";
const ROJO = "#b91c1c";

function estiloSaldo(saldo: number) {
  if (saldo > 0) return { color: VERDE };
  if (saldo < 0) return { color: ROJO };
  return undefined;
}

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

const resultBox = {
  border: "1px solid #111111",
  padding: "16px",
  marginTop: "24px",
};

const resultTitle = {
  fontSize: "13px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#555555",
  margin: "0 0 10px",
};

const resultText = {
  fontSize: "16px",
  lineHeight: 1.6,
  margin: 0,
};

const resultList = {
  margin: 0,
  paddingLeft: "20px",
};
