import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import { formatDate, formatMoney } from "@/lib/format";
import { calcularLiquidacion } from "@/lib/liquidacion";
import { createClient } from "@/lib/supabase/server";

export default async function ObraDetalle({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const { data: obra } = await supabase
    .from("obras")
    .select("id, slug, nombre, ubicacion, estado, fecha_inicio, fecha_fin_estimada, presupuesto")
    .eq("slug", obraId)
    .maybeSingle();

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const [{ data: balance }, { data: resumen }, { data: gastos }] = await Promise.all([
    supabase
      .from("obra_balance")
      .select(
        "empresa, porcentaje, pagado, le_corresponde, saldo, pagado_facturado, pagado_efectivo, ajustes"
      )
      .eq("obra_id", obra.id),
    supabase
      .from("obra_resumen")
      .select(
        "total_gastado, avance_fisico, avance_financiero, total_facturado, total_efectivo"
      )
      .eq("obra_id", obra.id)
      .maybeSingle(),
    // Se traen todos los gastos: sirven tanto para el desglose por rubro como
    // para la lista de los últimos movimientos.
    supabase
      .from("gastos")
      .select(
        "id, fecha, concepto, monto, estado, tipo_gasto, rubros(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre)"
      )
      .eq("obra_id", obra.id)
      .order("fecha", { ascending: false }),
  ]);

  const socios = (balance ?? []).map((item) => ({
    empresa: item.empresa ?? "—",
    porcentaje: Number(item.porcentaje ?? 0),
    pagado: Number(item.pagado ?? 0),
    leCorresponde: Number(item.le_corresponde ?? 0),
    saldo: Number(item.saldo ?? 0),
    facturado: Number(item.pagado_facturado ?? 0),
    efectivo: Number(item.pagado_efectivo ?? 0),
    ajustes: Number(item.ajustes ?? 0),
  }));

  // La columna de ajustes sólo aparece si alguna socia hizo alguno.
  const hayAjustes = socios.some((s) => s.ajustes !== 0);

  const liquidacion = calcularLiquidacion(socios);

  const todos = gastos ?? [];
  const ultimos = todos.slice(0, 8);

  // Desglose de en qué se gastó. No cuentan los anulados ni los ajustes de
  // saldo: un ajuste mueve plata entre socias, no compra nada para la obra.
  const vigentes = todos.filter(
    (g) => g.estado !== "Anulado" && g.tipo_gasto !== "Ajuste de saldo"
  );
  const totalVigente = vigentes.reduce((acc, g) => acc + Number(g.monto), 0);

  const porRubro = new Map<string, number>();
  for (const gasto of vigentes) {
    const nombre = gasto.rubros?.nombre ?? "Sin rubro";
    porRubro.set(nombre, (porRubro.get(nombre) ?? 0) + Number(gasto.monto));
  }

  // Sin presupuesto cargado no hay contra qué comparar: mostrar "0% consumido"
  // haría creer que no se gastó nada.
  const hayPresupuesto = Number(obra.presupuesto ?? 0) > 0;
  const consumido = hayPresupuesto ? `${resumen?.avance_financiero ?? 0}%` : "—";

  const gastoPorRubro = [...porRubro.entries()]
    .map(([rubro, total]) => ({
      rubro,
      total,
      porcentaje: totalVigente > 0 ? Math.round((total / totalVigente) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Materiales vs mano de obra: la otra lectura útil de en qué se va la plata.
  const porTipo = ["Materiales", "Mano de obra"].map((tipo) => {
    const total = vigentes
      .filter((g) => g.tipo_gasto === tipo)
      .reduce((acc, g) => acc + Number(g.monto), 0);

    return {
      tipo,
      total,
      porcentaje: totalVigente > 0 ? Math.round((total / totalVigente) * 100) : 0,
    };
  });

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="economia" />

      <section style={encabezado}>
        <p style={eyebrowSeccion}>Situación económica</p>
        <h2 style={tituloSeccion}>Economía</h2>
        <p style={subtituloSeccion}>
          Cuánto se gastó, en qué, y cómo queda el saldo entre las empresas
          socias.
        </p>
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
        <div style={card}>
          <p style={label}>Presupuesto consumido</p>
          <h3 style={number}>{consumido}</h3>
        </div>
      </section>

      <section style={panelWithMargin}>
        <h3 style={sectionTitle}>Balance entre empresas</h3>
        <p style={text}>
          Cada empresa aporta según su porcentaje de participación en la obra.
        </p>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Empresa</th>
              <th style={th}>Particip.</th>
              <th style={thRight}>Facturado</th>
              <th style={thRight}>Efectivo</th>
              {hayAjustes && <th style={thRight}>Ajustes</th>}
              <th style={thRight}>Total</th>
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
                Total de obra
              </td>
              <td style={tdTotalRight}>
                {formatMoney(resumen?.total_facturado)}
              </td>
              <td style={tdTotalRight}>
                {formatMoney(resumen?.total_efectivo)}
              </td>
              {hayAjustes && <td style={tdTotalRight}>—</td>}
              <td style={tdTotalRight}>{formatMoney(resumen?.total_gastado)}</td>
              <td style={tdTotalRight}>—</td>
              <td style={tdTotalRight}>—</td>
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

        <p style={note}>
          Saldo positivo significa que la empresa aportó de más y le deben.
          Negativo, que tiene que compensar.
        </p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "32px" }}>
        <div style={panel}>
          <h3 style={sectionTitle}>En qué se gastó</h3>

          {totalVigente > 0 && (
            <div style={bloqueTipos}>
              {porTipo.map((item) => (
                <div key={item.tipo} style={tarjetaTipo}>
                  <p style={{ ...label, marginBottom: "6px" }}>{item.tipo}</p>
                  <strong>{formatMoney(item.total)}</strong>{" "}
                  <span style={porcentajeRubro}>{item.porcentaje}%</span>
                </div>
              ))}
            </div>
          )}

          {gastoPorRubro.length === 0 ? (
            <p style={text}>Sin gastos cargados todavía.</p>
          ) : (
            gastoPorRubro.map((item) => (
              <div key={item.rubro} style={{ marginTop: "18px" }}>
                <div style={filaRubro}>
                  <span>{item.rubro}</span>
                  <strong>
                    {formatMoney(item.total)}{" "}
                    <span style={porcentajeRubro}>{item.porcentaje}%</span>
                  </strong>
                </div>
                <div style={barraFondo}>
                  <div style={{ ...barraRelleno, width: `${item.porcentaje}%` }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <div style={panel}>
            <h3 style={sectionTitle}>Ejecución presupuestaria</h3>
            <div style={row}>
              <span>Presupuesto</span>
              <strong>
                {hayPresupuesto ? formatMoney(obra.presupuesto) : "Sin cargar"}
              </strong>
            </div>
            <div style={row}>
              <span>Gastado</span>
              <strong>{formatMoney(resumen?.total_gastado)}</strong>
            </div>
            <div style={row}>
              <span>Consumido</span>
              <strong>{consumido}</strong>
            </div>

            {!hayPresupuesto && (
              <p style={{ ...note, marginBottom: 0, marginTop: "14px" }}>
                Cargá el presupuesto en <strong>Editar obra</strong> para poder
                comparar lo gastado contra lo previsto.
              </p>
            )}
          </div>

          <div style={panelWithMargin}>
            <h3 style={sectionTitle}>Plazos</h3>
            <div style={row}>
              <span>Inicio</span>
              <strong>{formatDate(obra.fecha_inicio)}</strong>
            </div>
            <div style={row}>
              <span>Fin estimado</span>
              <strong>{formatDate(obra.fecha_fin_estimada)}</strong>
            </div>
            <div style={row}>
              <span>Avance físico</span>
              <strong>{resumen?.avance_fisico ?? 0}%</strong>
            </div>
            <p style={{ ...note, marginBottom: 0, marginTop: "14px" }}>
              El avance físico se carga en la solapa Avances. Compararlo con el
              presupuesto consumido muestra si se gasta más rápido de lo que se
              construye.
            </p>
          </div>
        </div>
      </section>

      <section style={panelWithMargin}>
        <h3 style={sectionTitle}>Últimos gastos</h3>

        {ultimos.length === 0 ? (
          <p style={text}>Todavía no hay gastos cargados en esta obra.</p>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Rubro</th>
                <th style={th}>Concepto</th>
                <th style={th}>Pagó</th>
                <th style={th}>Estado</th>
                <th style={thRight}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {ultimos.map((gasto) => (
                <tr key={gasto.id}>
                  <td style={td}>{formatDate(gasto.fecha)}</td>
                  <td style={td}>{gasto.rubros?.nombre ?? "—"}</td>
                  <td style={td}>{gasto.concepto}</td>
                  <td style={td}>{gasto.pagadora?.nombre ?? "—"}</td>
                  <td style={td}>{gasto.estado}</td>
                  <td style={tdRight}>{formatMoney(gasto.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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

const subtituloSeccion = {
  color: "#666666",
  margin: 0,
};

const bloqueTipos = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  marginBottom: "8px",
  paddingBottom: "16px",
  borderBottom: "1px solid #eeeeee",
};

const tarjetaTipo = {
  border: "1px solid #eeeeee",
  padding: "12px",
};

const filaRubro = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "14px",
  marginBottom: "8px",
  color: "#444444",
  gap: "12px",
};

const porcentajeRubro = {
  color: "#999999",
  fontWeight: 400,
};

const barraFondo = {
  height: "8px",
  background: "#eeeeee",
};

const barraRelleno = {
  height: "8px",
  background: "#111111",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "16px",
};

const card = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  background: "#ffffff",
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

const panel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
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

const text = {
  color: "#555555",
};

const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
  marginBottom: 0,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
  marginTop: "12px",
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
