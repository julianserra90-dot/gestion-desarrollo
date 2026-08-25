import Link from "next/link";
import AppShell from "@/components/AppShell";
import GraficoTorta from "@/components/GraficoTorta";
import ObraHeader from "@/components/ObraHeader";
import { getCaja } from "@/lib/caja";
import { repartirComprobantes } from "@/lib/comprobantes";
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

  const [
    { data: balance },
    { data: resumen },
    { data: gastos },
    { data: comparacion },
    { data: rubrosObra },
    caja,
    lote,
  ] = await Promise.all([
    supabase
      .from("obra_balance")
      .select(
        "empresa_id, empresa, porcentaje, pagado, le_corresponde, saldo, ajustes, aportes, total_a_repartir"
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
        "monto, iva, empresa_factura_id, empresa_pagadora_id, compartido, tipo_pago, estado, tipo_gasto, rubro_id, rubros(nombre)"
      )
      .eq("obra_id", obra.id),
    // Lo cotizado y aprobado contra lo gastado, por rubro y tipo: de ahí sale
    // lo que todavía falta pagar.
    supabase
      .from("obra_presupuesto")
      .select("rubro_id, rubro, tipo, cotizado, gastado")
      .eq("obra_id", obra.id),
    // Los rubros con sus casillas, para saber qué combinaciones corresponden:
    // la vista devuelve materiales y mano de obra de todos, y en el terreno la
    // mano de obra no existe.
    supabase
      .from("rubros")
      .select("id, nombre, orden, activo, usa_materiales, usa_mano_obra")
      .eq("obra_id", obra.id)
      .order("orden"),
    getCaja(obra.id),
    // El valor pactado del lote hace falta para calcular cuánto le resta pagar
    // a cada socia; el resto de la ficha acá no se usa.
    getLote(obra.id, obra.lote_valor_usd, null, null, null),
  ]);

  // Desglose de en qué se gastó. No cuentan los anulados ni los ajustes de
  // saldo: un ajuste mueve plata entre socias, no compra nada para la obra.
  const vigentes = (gastos ?? []).filter(
    (g) => g.estado !== "Anulado" && g.tipo_gasto !== "Ajuste de saldo"
  );

  // Lo facturado, lo efectivo y el crédito fiscal de cada socia: a quién se le
  // facturó, que no es lo mismo que quién puso la plata. El detalle está en
  // `lib/comprobantes.ts`, que es el mismo cálculo que rehace el listado de
  // gastos con cada filtro. Por tomar el monto entero del comprobante, estas
  // columnas ya no suman hasta "Total obra".
  const { porEmpresa, facturadoSinAsignar, efectivoSinAsignar } =
    repartirComprobantes(
      vigentes.map((g) => ({
        monto: Number(g.monto),
        iva: Number(g.iva ?? 0),
        tipoPago: g.tipo_pago,
        empresaFacturaId: g.empresa_factura_id,
        empresaPagadoraId: g.empresa_pagadora_id,
        compartido: g.compartido ?? false,
      })),
      (balance ?? [])
        .map((b) => b.empresa_id)
        .filter((id): id is string => Boolean(id))
    );

  // La vista no trae orden propio, así que se ordena acá: alfabético, el mismo
  // que usa el desglose por empresa del listado de gastos.
  const socios = (balance ?? [])
    .slice()
    .sort((a, b) => (a.empresa ?? "").localeCompare(b.empresa ?? ""))
    .map((item) => ({
      empresaId: item.empresa_id,
      empresa: item.empresa ?? "—",
      porcentaje: Number(item.porcentaje ?? 0),
      pagado: Number(item.pagado ?? 0),
      leCorresponde: Number(item.le_corresponde ?? 0),
      saldo: Number(item.saldo ?? 0),
      // Lo que adelantó de su bolsillo. El resto de lo que puso son aportes al
      // dinero en cuenta y ajustes con la otra socia, que van en su columna: los
      // tres juntos dan "Total obra".
      bolsillo:
        Number(item.pagado ?? 0) -
        Number(item.aportes ?? 0) -
        Number(item.ajustes ?? 0),
      ajustes: Number(item.ajustes ?? 0),
      aportes: Number(item.aportes ?? 0),
      facturado: item.empresa_id
        ? (porEmpresa.get(item.empresa_id)?.facturado ?? 0)
        : 0,
      efectivo: item.empresa_id
        ? (porEmpresa.get(item.empresa_id)?.efectivo ?? 0)
        : 0,
      creditoFiscal: item.empresa_id
        ? (porEmpresa.get(item.empresa_id)?.creditoFiscal ?? 0)
        : 0,
    }));

  // Las columnas de bolsillo, ajustes, aportes y crédito fiscal sólo aparecen
  // si alguna socia tiene.
  const hayBolsillo = socios.some((s) => s.bolsillo !== 0);
  const hayAjustes = socios.some((s) => s.ajustes !== 0);
  const hayAportes = socios.some((s) => s.aportes !== 0);
  const hayCreditoFiscal = socios.some((s) => s.creditoFiscal > 0);

  // Las columnas vienen en tres bloques que contestan preguntas distintas y
  // sólo suman dentro de su bloque; los encabezados de arriba los agrupan.
  const colsComprobantes = 2 + (hayCreditoFiscal ? 1 : 0);
  const colsPuso =
    1 + (hayBolsillo ? 1 : 0) + (hayAportes ? 1 : 0) + (hayAjustes ? 1 : 0);

  const aRepartir = Number(balance?.[0]?.total_a_repartir ?? 0);

  const suma = (campo: (s: (typeof socios)[number]) => number) =>
    socios.reduce((acc, s) => acc + campo(s), 0);

  const liquidacion = calcularLiquidacion(socios);

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

  // --------------------------- Lo que falta pagar ----------------------------
  // Sale de las cotizaciones aprobadas: lo cotizado menos lo ya pagado del
  // mismo rubro **y del mismo tipo**. Es la única comparación que cierra —la
  // cotización de la mano de obra no tiene nada que ver con lo que se gastó en
  // materiales—, igual que en el detalle por rubro.
  const pendientes = (comparacion ?? [])
    .filter((f) => Number(f.cotizado) > 0)
    .map((f) => ({
      rubroId: f.rubro_id,
      rubro: f.rubro ?? "—",
      tipo: f.tipo ?? "",
      cotizado: Number(f.cotizado),
      gastado: Number(f.gastado),
      falta: Number(f.cotizado) - Number(f.gastado),
    }))
    .sort((a, b) => b.falta - a.falta);

  // Un rubro que se pasó no devuelve plata, así que no compensa lo que falta en
  // otro: el total suma sólo lo que todavía hay que poner.
  const totalFalta = pendientes.reduce((acc, p) => acc + Math.max(p.falta, 0), 0);

  // Lo que no se puede saber: los rubros marcados en la obra cuyo material o
  // mano de obra no tiene cotización aprobada. Hay que decirlo, o el total de
  // arriba se lee como si fuera todo lo que falta de la obra —y hoy casi ningún
  // material está cotizado—.
  const cotizados = new Set(pendientes.map((p) => `${p.rubroId}-${p.tipo}`));

  const sinCotizar = (rubrosObra ?? [])
    .filter((r) => r.activo)
    .flatMap((r) => {
      const combos: { id: string; rubro: string; tipo: string }[] = [];
      if (r.usa_materiales) {
        combos.push({ id: r.id, rubro: r.nombre, tipo: "materiales" });
      }
      if (r.usa_mano_obra) {
        combos.push({ id: r.id, rubro: r.nombre, tipo: "mano de obra" });
      }
      return combos;
    })
    .filter(
      (c) =>
        !cotizados.has(
          `${c.id}-${c.tipo === "materiales" ? "Materiales" : "Mano de obra"}`
        )
    );

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

      {/* Cada tarjeta lleva al detalle de lo que muestra: el listado de gastos
          con la columna Comprobante ya filtrada. Es la pregunta que sigue
          naturalmente al número —"¿en qué se fue todo eso en efectivo?"— y
          desde ahí se puede seguir filtrando a mano. */}
      <section style={statsGrid}>
        <Link href={`/obras/${obra.slug}/gastos?ver=todos`} style={cardEnlace}>
          <p style={label}>Total gastado</p>
          <h3 style={number}>{formatMoney(resumen?.total_gastado)}</h3>
        </Link>
        <Link
          href={`/obras/${obra.slug}/gastos?ver=facturado`}
          style={cardEnlace}
        >
          <p style={label}>Facturado</p>
          <h3 style={number}>{formatMoney(resumen?.total_facturado)}</h3>
        </Link>
        <Link
          href={`/obras/${obra.slug}/gastos?ver=efectivo`}
          style={cardEnlace}
        >
          <p style={label}>En efectivo</p>
          <h3 style={number}>{formatMoney(resumen?.total_efectivo)}</h3>
        </Link>
        {/* El crédito fiscal sale sólo de las facturas A, así que el detalle
            son esas: el resto no lo discrimina. */}
        <Link
          href={`/obras/${obra.slug}/gastos?ver=credito-fiscal`}
          style={cardEnlace}
        >
          <p style={label}>Crédito fiscal (IVA)</p>
          <h3 style={number}>{formatMoney(creditoFiscal)}</h3>
        </Link>
        {/* Recién acá se corta el desglose del total gastado y empieza otra
            cosa: la plata que hay y la que falta. */}
        <Link href={`/obras/${obra.slug}/ingresos`} style={cardEnlace}>
          <p style={label}>Dinero en cuenta</p>
          {/* Los dos saldos con el mismo peso: no es un número principal con
              una aclaración abajo, son las dos monedas de la misma cuenta y
              ninguna manda sobre la otra. En verde porque es plata que está
              —nunca puede ser negativa—, al revés del rojo de "Resta pagar". */}
          <h3 style={{ ...number, color: VERDE }}>
            {formatMoney(caja.arsSaldo)}
          </h3>
          <p style={{ ...number, color: VERDE, margin: "4px 0 0" }}>
            {formatUSD(caja.usdSaldo)}
          </p>
        </Link>
        {/* Lo que todavía hay que poner: lo aprobado menos lo pagado, rubro por
            rubro. En rojo porque es plata que falta, igual que el "falta pagar"
            del detalle por rubro. El desglose vive en Presupuestos, que es
            adonde lleva. */}
        {pendientes.length > 0 && (
          <Link href={`/obras/${obra.slug}/presupuestos`} style={cardEnlace}>
            <p style={label}>Resta pagar</p>
            <h3 style={{ ...number, color: ROJO }}>
              {formatMoney(totalFalta)}
            </h3>
            {/* Hoy casi ningún material está cotizado: sin esta línea el número
                se lee como todo lo que falta de la obra, y es sólo lo cotizado. */}
            {sinCotizar.length > 0 && (
              <p style={{ ...note, margin: "6px 0 0" }}>
                {sinCotizar.length} sin cotizar
              </p>
            )}
          </Link>
        )}
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

        {/* Nueve columnas no entran en una ventana angosta. Scrollean acá
            adentro en vez de correr la página entera de costado. */}
        <div style={scrollX}>
          <table style={table}>
            <thead>
              {/* Comprobantes contesta "a nombre de quién salió" y la plata
                  "quién la puso": son dos cuentas distintas sobre los mismos
                  gastos, y sin el rótulo se leen como columnas que suman. */}
              <tr>
                <th style={thGrupo} colSpan={2} />
                <th style={thGrupoCorte} colSpan={colsComprobantes}>
                  Comprobantes
                </th>
                <th style={thGrupoCorte} colSpan={colsPuso}>
                  Lo que puso
                </th>
                <th style={thGrupoCorte} colSpan={2}>
                  El reparto
                </th>
              </tr>
              <tr>
                <th style={th}>Empresa</th>
                <th style={th}>Particip.</th>
                <th style={thRightCorte}>Facturado</th>
                <th style={thRight}>Efectivo</th>
                {hayCreditoFiscal && <th style={thRight}>Crédito fiscal</th>}
                {hayBolsillo && <th style={thRightCorte}>De su bolsillo</th>}
                {hayAportes && (
                  <th style={hayBolsillo ? thRight : thRightCorte}>
                    Puso en cuenta
                  </th>
                )}
                {hayAjustes && (
                  <th style={hayBolsillo || hayAportes ? thRight : thRightCorte}>
                    Ajustes
                  </th>
                )}
                <th style={colsPuso > 1 ? thRight : thRightCorte}>Total obra</th>
                <th style={thRightCorte}>Le corresponde</th>
                <th style={thRight}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {socios.map((socio) => (
                <tr key={socio.empresa}>
                  <td style={td}>{socio.empresa}</td>
                  <td style={td}>{socio.porcentaje}%</td>
                  <td style={tdRightCorte}>
                    {socio.facturado > 0 ? formatMoney(socio.facturado) : "—"}
                  </td>
                  <td style={tdRight}>
                    {socio.efectivo > 0 ? formatMoney(socio.efectivo) : "—"}
                  </td>
                  {hayCreditoFiscal && (
                    <td style={tdRight}>
                      {socio.creditoFiscal > 0
                        ? formatMoney(socio.creditoFiscal)
                        : "—"}
                    </td>
                  )}
                  {hayBolsillo && (
                    <td style={tdRightCorte}>
                      {socio.bolsillo !== 0 ? formatMoney(socio.bolsillo) : "—"}
                    </td>
                  )}
                  {hayAportes && (
                    <td style={hayBolsillo ? tdRight : tdRightCorte}>
                      {socio.aportes > 0 ? formatMoney(socio.aportes) : "—"}
                    </td>
                  )}
                  {hayAjustes && (
                    <td style={hayBolsillo || hayAportes ? tdRight : tdRightCorte}>
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
                  <td style={colsPuso > 1 ? tdRight : tdRightCorte}>
                    <strong>{formatMoney(socio.pagado)}</strong>
                  </td>
                  <td style={tdRightCorte}>{formatMoney(socio.leCorresponde)}</td>
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
                {/* "Total" a secas: cada bloque suma lo suyo y no son la misma
                    plata contada de nuevo. */}
                <td style={tdTotal} colSpan={2}>
                  Total
                </td>
                <td style={tdTotalRightCorte}>
                  {formatMoney(suma((s) => s.facturado))}
                </td>
                <td style={tdTotalRight}>{formatMoney(suma((s) => s.efectivo))}</td>
                {hayCreditoFiscal && (
                  <td style={tdTotalRight}>
                    {formatMoney(suma((s) => s.creditoFiscal))}
                  </td>
                )}
                {hayBolsillo && (
                  <td style={tdTotalRightCorte}>
                    {formatMoney(suma((s) => s.bolsillo))}
                  </td>
                )}
                {hayAportes && (
                  <td style={hayBolsillo ? tdTotalRight : tdTotalRightCorte}>
                    {formatMoney(suma((s) => s.aportes))}
                  </td>
                )}
                {hayAjustes && (
                  <td
                    style={
                      hayBolsillo || hayAportes ? tdTotalRight : tdTotalRightCorte
                    }
                  >
                    —
                  </td>
                )}
                <td style={colsPuso > 1 ? tdTotalRight : tdTotalRightCorte}>
                  {formatMoney(suma((s) => s.pagado))}
                </td>
                <td style={tdTotalRightCorte}>{formatMoney(aRepartir)}</td>
                <td style={tdTotalRight}>{formatMoney(suma((s) => s.saldo))}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Un gasto pagado entero con el dinero en cuenta y sin factura a
            nombre de una socia no es de ninguna: se dice aparte para que las
            columnas de comprobantes no parezcan cortas contra el total
            gastado. */}
        {facturadoSinAsignar + efectivoSinAsignar > 0 && (
          <p style={note}>
            {formatMoney(facturadoSinAsignar + efectivoSinAsignar)} sin atribuir
            a ninguna empresa —salieron del dinero en cuenta y no llevan factura
            a nombre de una socia—, así que no entran en Facturado ni en
            Efectivo.
          </p>
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

const scrollX = {
  overflowX: "auto" as const,
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

// La línea vertical separa los bloques de columnas. Va en la primera columna de
// cada bloque, y es lo que avisa que de un lado al otro los números no suman.
const corte = { borderLeft: "1px solid #e5e5e5" };

const thRightCorte = { ...thRight, ...corte };

// El rótulo del bloque, arriba de sus columnas: más chico y sin la línea de
// abajo, que le corresponde a la fila de encabezados de verdad.
const thGrupo = {
  ...th,
  textAlign: "center" as const,
  color: "#aaaaaa",
  borderBottom: "none",
  padding: "0 12px 4px",
};

const thGrupoCorte = { ...thGrupo, ...corte };

const td = {
  borderBottom: "1px solid #eeeeee",
  padding: "14px 12px",
  color: "#333333",
};

const tdRight = {
  ...td,
  textAlign: "right" as const,
};

const tdRightCorte = { ...tdRight, ...corte };

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

const tdTotalRightCorte = { ...tdTotalRight, ...corte };

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
