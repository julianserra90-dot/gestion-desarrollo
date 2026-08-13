import Link from "next/link";
import AppShell from "@/components/AppShell";
import GraficoTorta from "@/components/GraficoTorta";
import ObraHeader from "@/components/ObraHeader";
import { getCaja } from "@/lib/caja";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { calcularLiquidacion } from "@/lib/liquidacion";
import { getLote } from "@/lib/lote";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_DE_GASTO, ordenarPorTipo } from "@/lib/tipos-gasto";

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

  const [{ data: balance }, { data: resumen }, { data: gastos }, caja, lote] = await Promise.all([
    supabase
      .from("obra_balance")
      .select(
        "empresa_id, empresa, porcentaje, pagado, le_corresponde, saldo, pagado_facturado, pagado_efectivo, ajustes, aportes, fondos_terceros, total_a_repartir"
      )
      .eq("obra_id", obra.id),
    supabase
      .from("obra_resumen")
      .select(
        "total_gastado, avance_fisico, avance_financiero, total_facturado, total_efectivo, presupuesto_aprobado"
      )
      .eq("obra_id", obra.id)
      .maybeSingle(),
    // Se traen todos los gastos: sirven tanto para el desglose por rubro como
    // para la lista de los últimos movimientos.
    supabase
      .from("gastos")
      .select(
        "id, fecha, concepto, monto, monto_caja, iva, tipo_factura, empresa_factura_id, estado, tipo_gasto, compartido, rubro_id, rubros(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre)"
      )
      .eq("obra_id", obra.id)
      .order("fecha", { ascending: false }),
    getCaja(obra.id),
    // El lote va aparte de los gastos, pero para "en qué se gastó" cuenta como
    // uno más. Sólo se necesita su total en pesos (los otros campos, null).
    getLote(obra.id, null, null, null, null),
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

  // Lo que pusieron inversores y compradores no lo reparten las socias.
  const fondosTerceros = Number(balance?.[0]?.fondos_terceros ?? 0);
  const aRepartir = Number(balance?.[0]?.total_a_repartir ?? 0);

  const suma = (campo: (s: (typeof socios)[number]) => number) =>
    socios.reduce((acc, s) => acc + campo(s), 0);

  const hayEnCuenta = caja.arsSaldo > 0 || caja.usdSaldo > 0;
  const aprobado = Number(resumen?.presupuesto_aprobado ?? 0);

  const liquidacion = calcularLiquidacion(socios);

  // --------------------------- Terreno y obra juntos -------------------------
  // El lote no se cruza con los gastos de obra: no entra en el m² construido ni
  // en el balance de arriba, y tiene su propia liquidación. Pero una socia puede
  // haber puesto el terreno entero y compensarse pagando menos de la obra
  // diaria. Con las dos liquidaciones separadas eso no se ve: hay que mirarlas
  // juntas para saber si la compensación cierra.
  const hayLote = lote.pagos.length > 0;

  const consolidado = socios.map((socio) => {
    const enLote = lote.socios.find((s) => s.empresaId === socio.empresaId);

    return {
      empresa: socio.empresa,
      porcentaje: socio.porcentaje,
      obraPuesto: socio.pagado,
      // El lote se valúa al dólar de cada pago, igual que en "en qué se gastó":
      // es la única forma de sumarlo con la obra, que se lleva en pesos.
      lotePuesto: enLote?.puestoArs ?? 0,
      totalPuesto: socio.pagado + (enLote?.puestoArs ?? 0),
      totalSaldo: socio.saldo + (enLote?.saldoArs ?? 0),
    };
  });

  const liquidacionTotal = calcularLiquidacion(
    consolidado.map((c) => ({ empresa: c.empresa, saldo: c.totalSaldo }))
  );

  const sumaTotal = (campo: (s: (typeof consolidado)[number]) => number) =>
    consolidado.reduce((acc, s) => acc + campo(s), 0);

  const todos = gastos ?? [];
  const ultimos = todos.slice(0, 8);

  // Desglose de en qué se gastó. No cuentan los anulados ni los ajustes de
  // saldo: un ajuste mueve plata entre socias, no compra nada para la obra.
  const vigentes = todos.filter(
    (g) => g.estado !== "Anulado" && g.tipo_gasto !== "Ajuste de saldo"
  );
  const totalVigente = vigentes.reduce((acc, g) => acc + Number(g.monto), 0);

  // El IVA que se puede recuperar: la columna `iva` ya da 0 en todo lo que no
  // sea factura A, así que alcanza con sumarla.
  const creditoFiscal = vigentes.reduce((acc, g) => acc + Number(g.iva ?? 0), 0);

  // Cada rubro se guarda con su id para poder entrar al detalle desde la
  // leyenda. Los gastos sin rubro se juntan aparte y no llevan enlace: no hay
  // adónde ir.
  // De cada rubro se guarda además cuánto fue material y cuánto mano de obra:
  // es lo que el gráfico dibuja en tonos del mismo color, para que se vea que
  // sigue siendo el mismo rubro.
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

  // Sin presupuesto cargado no hay contra qué comparar: mostrar "0% consumido"
  // haría creer que no se gastó nada.
  const hayPresupuesto = Number(obra.presupuesto ?? 0) > 0;
  const consumido = hayPresupuesto ? `${resumen?.avance_financiero ?? 0}%` : "—";

  // El lote (en dólares) valuado en pesos, para que entre en el mismo desglose
  // que los gastos. Es una inversión aparte de la obra, pero también es plata
  // que salió, así que en "en qué se gastó" cuenta como un rubro más.
  const loteArs = Math.round(lote.totalArs);
  const totalConLote = totalVigente + loteArs;

  const porcentajeDe = (total: number) =>
    totalConLote > 0 ? Math.round((total / totalConLote) * 100) : 0;

  const gastoPorRubro = [
    ...[...porRubro.values()].map((r) => ({
      rubro: r.nombre,
      total: r.total,
      href: r.id ? `/obras/${obra.slug}/rubro/${r.id}` : undefined,
      partes: ordenarPorTipo(r.porTipo),
    })),
    // El lote no se desglosa: es una compra sola, no tiene materiales ni mano
    // de obra.
    ...(loteArs > 0
      ? [
          {
            rubro: "Lote / Terreno",
            total: loteArs,
            href: `/obras/${obra.slug}/lote`,
            partes: [],
          },
        ]
      : []),
  ]
    .map((r) => ({ ...r, porcentaje: porcentajeDe(r.total) }))
    .sort((a, b) => b.total - a.total);

  const torta = gastoPorRubro.map((r) => ({
    etiqueta: r.rubro,
    valor: r.total,
    href: r.href,
    partes: r.partes,
  }));

  // Materiales vs mano de obra: la otra lectura útil de en qué se va la plata.
  // Lo administrativo (impuestos, honorarios) se suma como tercera categoría,
  // pero sólo aparece si la obra tiene alguno: no todas las obras lo tienen.
  const porTipo = TIPOS_DE_GASTO
    .map((tipo) => {
      const total = vigentes
        .filter((g) => g.tipo_gasto === tipo)
        .reduce((acc, g) => acc + Number(g.monto), 0);

      return {
        tipo,
        total,
        porcentaje: totalVigente > 0 ? Math.round((total / totalVigente) * 100) : 0,
      };
    })
    .filter((item) => item.tipo !== "Administrativo" || item.total > 0);

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
        <Link href={`/obras/${obra.slug}/dinero-en-cuenta`} style={cardEnlace}>
          <p style={label}>Dinero en cuenta</p>
          <h3 style={number}>{formatMoney(caja.arsSaldo)}</h3>
          <p style={{ ...note, margin: "6px 0 0" }}>
            {formatUSD(caja.usdSaldo)}
          </p>
        </Link>
        {/* El consumido no está acá a propósito: vive en "Ejecución
            presupuestaria", que es donde tiene contra qué compararse. */}
        {creditoFiscal > 0 && (
          <div style={card}>
            <p style={label}>Crédito fiscal (IVA)</p>
            <h3 style={number}>{formatMoney(creditoFiscal)}</h3>
            <p style={{ ...note, margin: "6px 0 0" }}>
              De las facturas A cargadas.
            </p>
          </div>
        )}
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
              {hayAportes && <th style={thRight}>Puso en cuenta</th>}
              {hayAjustes && <th style={thRight}>Ajustes</th>}
              <th style={thRight}>Total</th>
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

        {/* La tabla de arriba sólo mira a las socias. Esto explica la
            diferencia contra el gasto total de la obra. */}
        {(caja.usado > 0 || fondosTerceros > 0) && (
          <div style={desglose}>
            <p style={resultTitle}>De dónde salió el gasto de la obra</p>

            <div style={filaDesglose}>
              <span>Total gastado</span>
              <strong>{formatMoney(resumen?.total_gastado)}</strong>
            </div>
            <div style={filaDesglose}>
              <span>Pagado con dinero en cuenta</span>
              <strong>− {formatMoney(caja.usado)}</strong>
            </div>
            <div style={filaDesglose}>
              <span>Pagado de su bolsillo por las socias</span>
              <strong>
                {formatMoney(suma((s) => s.facturado + s.efectivo))}
              </strong>
            </div>

            {fondosTerceros > 0 && (
              <>
                <div style={{ ...filaDesglose, marginTop: "14px" }}>
                  <span>Fondos de inversores y compradores</span>
                  <strong>{formatMoney(fondosTerceros)}</strong>
                </div>
                <div style={filaDesglose}>
                  <span>Queda a repartir entre las socias</span>
                  <strong>{formatMoney(aRepartir)}</strong>
                </div>
              </>
            )}
          </div>
        )}

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
          {hayEnCuenta && (
            <>
              {" "}
              La suma de los saldos no da cero porque queda plata sin gastar en
              la cuenta de la obra —{" "}
              <strong>
                {formatMoney(caja.arsSaldo)}
                {caja.usdSaldo > 0 && ` y ${formatUSD(caja.usdSaldo)}`}
              </strong>{" "}
              — y esa plata todavía es de quien la puso.
            </>
          )}
        </p>
      </section>

      {/* El terreno va aparte de la obra a propósito: es una compra de inmueble
          y su valor no debe inflar el m² construido. Acá va sólo cuánto salió;
          el reparto entre socias vive en la solapa Lote, que es donde se lo va a
          buscar. */}
      {hayLote && (
        <section style={panelWithMargin}>
          <h3 style={sectionTitle}>Terreno</h3>
          <p style={text}>
            La compra del lote no se cruza con los gastos de obra: no entra en el
            balance de arriba ni en el m² construido. Quién puso cuánto se ve en
            la solapa{" "}
            <Link href={`/obras/${obra.slug}/lote`} style={enlaceNota}>
              Lote
            </Link>
            .
          </p>

          <div style={desglose}>
            <div style={filaDesglose}>
              <span>Total desembolsado en el terreno</span>
              <strong>{formatUSD(lote.totalUsd)}</strong>
            </div>
            <div style={filaDesglose}>
              <span>En pesos, al dólar de cada pago</span>
              <strong>{formatMoney(lote.totalArs)}</strong>
            </div>
          </div>
        </section>
      )}

      {/* La lectura que no daba ninguna de las dos tablas por separado: si una
          socia puso el terreno y la otra viene pagando más de la obra, recién
          sumadas se ve si la compensación cierra. */}
      {hayLote && (
        <section style={panelWithMargin}>
          <h3 style={sectionTitle}>Total por empresa</h3>
          <p style={text}>
            Obra y terreno se llevan separados, pero la plata sale del mismo
            bolsillo. Sumados muestran cómo queda cada empresa en el desarrollo
            completo.
          </p>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Empresa</th>
                <th style={th}>Particip.</th>
                <th style={thRight}>En la obra</th>
                <th style={thRight}>En el terreno</th>
                <th style={thRight}>Total puesto</th>
                <th style={thRight}>Saldo total</th>
              </tr>
            </thead>
            <tbody>
              {consolidado.map((socio) => (
                <tr key={socio.empresa}>
                  <td style={td}>{socio.empresa}</td>
                  <td style={td}>{socio.porcentaje}%</td>
                  <td style={tdRight}>
                    {socio.obraPuesto !== 0 ? formatMoney(socio.obraPuesto) : "—"}
                  </td>
                  <td style={tdRight}>
                    {socio.lotePuesto > 0 ? formatMoney(socio.lotePuesto) : "—"}
                  </td>
                  <td style={tdRight}>
                    <strong>{formatMoney(socio.totalPuesto)}</strong>
                  </td>
                  <td style={tdRight}>
                    <strong style={estiloSaldo(socio.totalSaldo)}>
                      {socio.totalSaldo > 0 ? "+" : ""}
                      {formatMoney(socio.totalSaldo)}
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
                <td style={tdTotalRight}>
                  {formatMoney(sumaTotal((s) => s.obraPuesto))}
                </td>
                <td style={tdTotalRight}>
                  {formatMoney(sumaTotal((s) => s.lotePuesto))}
                </td>
                <td style={tdTotalRight}>
                  {formatMoney(sumaTotal((s) => s.totalPuesto))}
                </td>
                <td style={tdTotalRight}>
                  {formatMoney(sumaTotal((s) => s.totalSaldo))}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Un pago de lote sin socia no se le atribuye a nadie: la columna del
              terreno queda corta contra el total de arriba y hay que decirlo. */}
          {lote.sinAsignarUsd > 0 && (
            <p style={note}>
              Hay <strong>{formatUSD(lote.sinAsignarUsd)}</strong> en pagos del
              terreno sin socia asignada, que no se le suman a ninguna. Se les
              asigna una editando el pago en la solapa{" "}
              <Link href={`/obras/${obra.slug}/lote`} style={enlaceNota}>
                Lote
              </Link>
              .
            </p>
          )}

          <div style={resultBox}>
            <p style={resultTitle}>Liquidación de todo el desarrollo</p>

            {liquidacionTotal.length === 0 ? (
              <p style={resultText}>
                Las empresas están equilibradas contando obra y terreno.
              </p>
            ) : (
              <ul style={resultList}>
                {liquidacionTotal.map((mov, i) => (
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
            El terreno está en dólares; acá se valúa en pesos al cambio de cada
            pago para poder sumarlo con la obra. Esta es la liquidación que vale:
            la de arriba mira sólo la obra, y puede pedir una transferencia que el
            terreno ya compensó.
          </p>
        </section>
      )}

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
            <div style={{ marginTop: "20px" }}>
              <GraficoTorta datos={torta} formato={formatMoney} />

              {loteArs > 0 && (
                <p style={notaTorta}>
                  <strong>Inversión total: {formatMoney(totalConLote)}</strong>
                  {" "}(obra + lote). El lote está en dólares; acá se valúa en
                  pesos al cambio de cada pago para poder sumarlo.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <div style={panel}>
            <h3 style={sectionTitle}>Ejecución presupuestaria</h3>
            <div style={row}>
              <span>Presupuesto estimado</span>
              <strong>
                {hayPresupuesto ? formatMoney(obra.presupuesto) : "Sin cargar"}
              </strong>
            </div>
            {/* El estimado se calculó antes de arrancar; el real lo van armando
                las cotizaciones que se aprueban a medida que avanza la obra. */}
            <div style={row}>
              <span>Presupuesto real</span>
              <strong>
                {aprobado > 0 ? (
                  <Link
                    href={`/obras/${obra.slug}/presupuestos`}
                    style={{ color: "#111111" }}
                  >
                    {formatMoney(aprobado)}
                  </Link>
                ) : (
                  "Sin cotizaciones"
                )}
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

            {aprobado === 0 && (
              <p style={{ ...note, marginBottom: 0, marginTop: "14px" }}>
                A medida que apruebes cotizaciones en{" "}
                <strong>Presupuestos</strong>, el presupuesto real se va
                armando solo.
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
                  <td style={td}>
                    {gasto.compartido
                      ? "Entre las socias"
                      : (gasto.pagadora?.nombre ??
                        (Number(gasto.monto_caja) > 0
                          ? "Dinero en cuenta"
                          : "—"))}
                  </td>
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

const porcentajeRubro = {
  color: "#999999",
  fontWeight: 400,
};

const notaTorta = {
  fontSize: "13px",
  color: "#777777",
  lineHeight: 1.5,
  marginTop: "20px",
  marginBottom: 0,
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
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

const enlaceNota = {
  color: "#111111",
  textDecoration: "underline",
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

const desglose = {
  border: "1px solid #e5e5e5",
  padding: "16px",
  marginTop: "24px",
};

const filaDesglose = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "14px",
  color: "#555555",
  paddingTop: "8px",
  gap: "16px",
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
