import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import {
  avanceGeneral,
  getAvancePorRubro,
  getUltimaActividad,
} from "@/lib/avances";
import { formatDate, formatUSD } from "@/lib/format";
import { getLote, incidenciaPorM2 } from "@/lib/lote";
import { calcularValorM2, leerDesvioM2 } from "@/lib/metro-cuadrado";
import { getObraPorSlug } from "@/lib/obras";
import {
  superficieConstruccion,
  superficieVenta,
} from "@/lib/superficies";
import { calcularPlazo, leerDesvio } from "@/lib/plazo";
import { getTotalesUsd } from "@/lib/totales-usd";

export default async function EstadoDeObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const [rubros, ultima, totales, lote] = await Promise.all([
    getAvancePorRubro(obra.id),
    getUltimaActividad(obra.id),
    getTotalesUsd(obra.id),
    getLote(
      obra.id,
      obra.lote_valor_usd,
      obra.lote_superficie_m2,
      obra.lote_vendedor,
      obra.lote_detalle
    ),
  ]);

  const avance = avanceGeneral(rubros);

  const supConstruccion = superficieConstruccion(obra);
  const supVenta = superficieVenta(obra);

  const hayLote = lote.valorUsd !== null || lote.pagos.length > 0;
  const incidenciaVenta = incidenciaPorM2(lote.valorUsd, supVenta);
  const inversionTotal = totales.gastadoUsd + lote.totalUsd;

  // El objetivo y el desvío se miden sobre la construcción, que es lo que se
  // cuesta. La venta sirve para leer el gastado/proyectado del lado del negocio.
  const m2 = calcularValorM2({
    superficie: supConstruccion,
    objetivoUsd: obra.valor_m2_usd,
    aprobadoUsd: totales.aprobadoUsd,
    gastadoUsd: totales.gastadoUsd,
    avance,
  });

  const m2Venta = calcularValorM2({
    superficie: supVenta,
    objetivoUsd: null,
    aprobadoUsd: totales.aprobadoUsd,
    gastadoUsd: totales.gastadoUsd,
    avance,
  });

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const plazo = calcularPlazo(
    obra.fecha_inicio,
    obra.fecha_fin_estimada,
    avance,
    hoy
  );

  const desvio = leerDesvio(plazo.desvio);
  const lecturaM2 = leerDesvioM2(m2);

  // La ficha muestra sólo lo que está cargado: una tarjeta con "—" ocupa el
  // mismo lugar que un dato y no dice nada.
  const fichaProyecto = [
    { etiqueta: "Domicilio", valor: obra.domicilio },
    {
      etiqueta: "Sup. de construcción",
      valor: supConstruccion ? `${supConstruccion} m²` : null,
    },
    {
      etiqueta: "Sup. de venta",
      valor: supVenta ? `${supVenta} m²` : null,
    },
    {
      etiqueta: "Unidades funcionales",
      valor: obra.unidades_funcionales
        ? String(obra.unidades_funcionales)
        : null,
    },
    {
      etiqueta: "Pisos",
      valor:
        obra.pisos === null ? null : obra.pisos === 0 ? "Sólo PB" : `PB + ${obra.pisos}`,
    },
    {
      etiqueta: "Promedio por unidad",
      valor:
        supConstruccion && obra.unidades_funcionales
          ? `${Math.round(supConstruccion / obra.unidades_funcionales)} m²`
          : null,
    },
  ].filter((d): d is { etiqueta: string; valor: string } => Boolean(d.valor));
  const enEjecucion = rubros.filter((r) => r.estado === "En ejecución").length;
  const finalizados = rubros.filter((r) => r.estado === "Finalizado").length;
  const sinIniciar = rubros.filter((r) => r.estado === "Sin iniciar").length;
  const ponderado = rubros.some((r) => r.peso > 0);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="estado" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Estado general</p>
        <h2 style={ui.pageTitle}>Cómo va la obra</h2>
        <p style={ui.subtitle}>
          El avance físico contra el calendario, que es lo que dice si la obra
          va bien o va tarde.
        </p>
      </section>

      {/* --- La ficha del proyecto ----------------------------------------- */}

      {fichaProyecto.length > 0 && (
        <section style={{ ...ui.panel, marginBottom: "16px" }}>
          <div style={ficha}>
            {fichaProyecto.map((dato) => (
              <div key={dato.etiqueta}>
                <p style={ui.label}>{dato.etiqueta}</p>
                <strong style={fichaValor}>{dato.valor}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- Avance contra tiempo, que es la lectura que importa ----------- */}

      <section style={ui.panel}>
        <div style={dosColumnas}>
          <div>
            <p style={ui.label}>Avance físico</p>
            <strong style={numeroGrande}>{avance}%</strong>
            <div style={{ ...ui.progressBackground, marginTop: "12px" }}>
              <div
                style={{ ...ui.progressFill, width: `${Math.min(avance, 100)}%` }}
              />
            </div>
            <p style={pieBarra}>
              {ponderado
                ? "Cada rubro pesa su cotización aprobada."
                : "Promedio simple: todavía no hay cotizaciones aprobadas."}
            </p>
          </div>

          <div>
            <p style={ui.label}>Tiempo consumido</p>
            <strong style={numeroGrande}>
              {plazo.consumido === null ? "—" : `${plazo.consumido}%`}
            </strong>
            <div style={{ ...ui.progressBackground, marginTop: "12px" }}>
              <div
                style={{
                  ...ui.progressFill,
                  width: `${Math.min(plazo.consumido ?? 0, 100)}%`,
                }}
              />
            </div>
            <p style={pieBarra}>
              {plazo.totales === null
                ? "Falta cargar fecha de inicio o de fin estimada."
                : `${plazo.totales} días de plazo previsto.`}
            </p>
          </div>
        </div>

        {desvio && (
          <p
            style={{
              ...lecturaDesvio,
              ...(plazo.desvio !== null && plazo.desvio < -5
                ? lecturaMala
                : undefined),
            }}
          >
            {desvio}
          </p>
        )}
      </section>

      {/* --- Las fechas --------------------------------------------------- */}

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Inicio</p>
          <h3 style={statTexto}>
            {obra.fecha_inicio ? formatDate(obra.fecha_inicio) : "Sin cargar"}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Fin estimado</p>
          <h3 style={statTexto}>
            {obra.fecha_fin_estimada
              ? formatDate(obra.fecha_fin_estimada)
              : "Sin cargar"}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>
            {plazo.porArrancar ? "Arranca en" : "Lleva en obra"}
          </p>
          <h3 style={statTexto}>
            {plazo.transcurridos === null
              ? "—"
              : `${Math.abs(plazo.transcurridos)} días`}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>{plazo.vencida ? "Pasada por" : "Quedan"}</p>
          <h3 style={plazo.vencida ? { ...statTexto, ...textoAlerta } : statTexto}>
            {plazo.restantes === null
              ? "—"
              : `${Math.abs(plazo.restantes)} días`}
          </h3>
        </div>
      </section>

      {/* --- El valor del metro cuadrado ------------------------------------ */}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Valor del m² de construcción</h3>
        {supConstruccion && (
          <span style={superficieTexto}>
            {supConstruccion} m² construcción
            {supVenta && supVenta !== supConstruccion
              ? ` · ${supVenta} m² venta`
              : ""}
          </span>
        )}
      </div>

      <section style={ui.panel}>
        {!supConstruccion ? (
          <p style={ui.vacio}>
            Cargá las superficies en{" "}
            <Link href={`/obras/${obra.slug}/editar`} style={enlace}>
              Editar obra
            </Link>{" "}
            y el valor del m² se calcula solo.
          </p>
        ) : (
          <>
            <table style={ui.table}>
              <tbody>
                <tr>
                  <td style={ui.td}>
                    Objetivo al arrancar
                    <span style={aclaracion}>
                      {m2.objetivo === null
                        ? "Cargalo en Editar obra para poder comparar."
                        : "Lo que se planeó pagar por metro. Es el número contra el que se mide todo lo demás."}
                    </span>
                  </td>
                  <td style={{ ...ui.td, ...celdaNumero }}>
                    {m2.objetivo === null
                      ? "—"
                      : `${formatUSD(m2.objetivo)} /m²`}
                  </td>
                </tr>

                {m2.aprobado !== null && (
                  <tr>
                    <td style={ui.td}>Según cotizaciones aprobadas</td>
                    <td style={{ ...ui.td, ...celdaNumero }}>
                      {formatUSD(m2.aprobado)} /m²
                    </td>
                  </tr>
                )}

                <tr>
                  <td style={ui.td}>
                    Llevás gastado
                    <span style={aclaracion}>
                      {formatUSD(totales.gastadoUsd)} repartidos en los{" "}
                      {supConstruccion} m² de construcción.{" "}
                      {avance > 0 && avance < 100
                        ? `Va a subir: falta el ${100 - avance}% de la obra.`
                        : "Es plata ya pagada, no una estimación."}
                    </span>
                  </td>
                  <td style={{ ...ui.td, ...celdaNumero }}>
                    {formatUSD(m2.gastado ?? 0)} /m²
                  </td>
                </tr>

                <tr>
                  <td style={ui.td}>
                    Si sigue a este ritmo, termina en
                    <span style={aclaracion}>
                      {m2.proyectado === null
                        ? "Hace falta algún avance cargado para poder proyectar."
                        : `Con ${formatUSD(totales.gastadoUsd)} se hizo el ${avance}%, así que la obra entera saldría ${formatUSD(
                            totales.gastadoUsd / (avance / 100)
                          )}.`}
                    </span>
                  </td>
                  <td style={{ ...ui.td, ...celdaNumero }}>
                    {m2.proyectado === null ? (
                      "—"
                    ) : (
                      <>
                        <strong style={numeroProyectado}>
                          {formatUSD(m2.proyectado)} /m²
                        </strong>
                        {m2.desvioUsd !== null && (
                          <span
                            style={
                              m2.desvioUsd > 0
                                ? { ...desvioTexto, ...textoAlerta }
                                : desvioTexto
                            }
                          >
                            {m2.desvioUsd > 0 ? "+" : "−"}
                            {formatUSD(Math.abs(m2.desvioUsd))} /m² contra el
                            objetivo
                          </span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {lecturaM2 && (
              <p
                style={
                  lecturaM2.caro
                    ? { ...lecturaDesvio, ...lecturaMala }
                    : lecturaDesvio
                }
              >
                {lecturaM2.texto}
                {m2.desvioTotal !== null && Math.abs(m2.desvioTotal) >= 1 && (
                  <span style={desvioTotalTexto}>
                    {formatUSD(Math.abs(m2.desvioTotal))} en toda la obra
                    {m2.desvioPorcentaje !== null &&
                      ` · ${m2.desvioPorcentaje > 0 ? "+" : ""}${m2.desvioPorcentaje}%`}
                  </span>
                )}
              </p>
            )}

            {supVenta && supVenta !== supConstruccion && (
              <p style={{ ...aclaracionPie, color: "#555555" }}>
                <strong>Por m² de venta</strong> ({supVenta} m²): gastado{" "}
                {formatUSD(m2Venta.gastado ?? 0)} /m²
                {m2Venta.proyectado !== null &&
                  `, proyectado al cierre ${formatUSD(m2Venta.proyectado)} /m²`}
                .
              </p>
            )}

            <p style={aclaracionPie}>
              Cada gasto se valúa al dólar de su fecha, así que el total sale al
              dólar promedio real de la obra y no a una cotización única.
              {totales.sinCotizar > 0 &&
                ` ${totales.sinCotizar} movimiento${
                  totales.sinCotizar === 1 ? "" : "s"
                } sin cotización quedan afuera del cálculo.`}
            </p>
          </>
        )}
      </section>

      {/* --- El lote, si lo hay -------------------------------------------- */}

      {hayLote && (
        <>
          <div style={ui.toolbar}>
            <h3 style={ui.sectionTitle}>Lote y construcción</h3>
            <Link href={`/obras/${obra.slug}/lote`} style={enlace}>
              Ver lote
            </Link>
          </div>

          <section style={ui.panel}>
            <div style={filaInversion}>
              <span>Lote, pagado a hoy</span>
              <strong>
                {formatUSD(lote.totalUsd)}
                {(lote.valorUsd !== null || incidenciaVenta !== null) && (
                  <span style={incidenciaTexto}>
                    {lote.valorUsd !== null &&
                      ` de ${formatUSD(lote.valorUsd)} pactado`}
                    {incidenciaVenta !== null &&
                      ` · incidencia ${formatUSD(incidenciaVenta)}/m² de venta`}
                  </span>
                )}
              </strong>
            </div>
            <div style={filaInversion}>
              <span>Construcción, gastado a hoy</span>
              <strong>{formatUSD(totales.gastadoUsd)}</strong>
            </div>
            <div style={{ ...filaInversion, ...filaInversionTotal }}>
              <span>Inversión total a hoy</span>
              <strong>{formatUSD(inversionTotal)}</strong>
            </div>
          </section>
        </>
      )}

      {/* --- Los rubros ---------------------------------------------------- */}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Rubros</h3>
        <Link href={`/obras/${obra.slug}/avances`} style={enlace}>
          Ver avances
        </Link>
      </div>

      <section style={ui.panel}>
        {rubros.length === 0 ? (
          <p style={ui.vacio}>
            Esta obra no tiene rubros elegidos. Marcalos en{" "}
            <Link href={`/obras/${obra.slug}/rubros`} style={enlace}>
              Rubros
            </Link>
            .
          </p>
        ) : (
          <div style={tresColumnas}>
            <div>
              <p style={ui.label}>En ejecución</p>
              <strong style={numeroMedio}>{enEjecucion}</strong>
            </div>
            <div>
              <p style={ui.label}>Finalizados</p>
              <strong style={numeroMedio}>
                {finalizados} <span style={deTotal}>de {rubros.length}</span>
              </strong>
            </div>
            <div>
              <p style={ui.label}>Sin iniciar</p>
              <strong style={numeroMedio}>{sinIniciar}</strong>
            </div>
          </div>
        )}
      </section>

      {/* --- Lo último que pasó -------------------------------------------- */}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Última actividad</h3>
      </div>

      <section style={ui.panel}>
        {!ultima ? (
          <p style={ui.vacio}>
            Todavía no se cargó ningún avance. Entrá a un rubro desde{" "}
            <Link href={`/obras/${obra.slug}/avances`} style={enlace}>
              Avances
            </Link>{" "}
            para cargar el primero.
          </p>
        ) : (
          <>
            <div style={cabeceraActividad}>
              <div>
                <p style={ui.eyebrow}>{formatDate(ultima.fechaHasta)}</p>
                <h4 style={tituloActividad}>
                  <Link
                    href={`/obras/${obra.slug}/avances/${ultima.rubroId}`}
                    style={enlace}
                  >
                    {ultima.rubro}
                  </Link>
                </h4>
              </div>

              <strong style={numeroMedio}>+{ultima.porcentaje}%</strong>
            </div>

            <p style={{ ...ui.note, marginTop: "12px" }}>
              {ultima.comentario ?? "Sin detalle cargado."}
            </p>

            <p style={pieBarra}>Cargado por {ultima.cargadoPor ?? "—"}.</p>
          </>
        )}
      </section>
    </AppShell>
  );
}

const dosColumnas = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "32px",
};

const tresColumnas = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "24px",
};

const numeroGrande = {
  fontSize: "40px",
  fontWeight: 400,
};

const numeroMedio = {
  fontSize: "26px",
  fontWeight: 400,
};

const deTotal = {
  fontSize: "15px",
  color: "#777777",
};

const statTexto = {
  fontSize: "20px",
  fontWeight: 400,
  margin: "8px 0 0",
};

const textoAlerta = {
  color: "#b00020",
};

const pieBarra = {
  fontSize: "13px",
  color: "#999999",
  margin: "10px 0 0",
};

const lecturaDesvio = {
  marginTop: "28px",
  paddingTop: "20px",
  borderTop: "1px solid #eeeeee",
  fontSize: "16px",
};

const lecturaMala = {
  color: "#b00020",
};

const cabeceraActividad = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
};

const tituloActividad = {
  fontSize: "20px",
  fontWeight: 400,
  margin: "8px 0 0",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};

const ficha = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "40px",
};

const fichaValor = {
  fontSize: "18px",
  fontWeight: 400,
  display: "block",
  marginTop: "6px",
};

const superficieTexto = {
  fontSize: "14px",
  color: "#777777",
};

const celdaNumero = {
  textAlign: "right" as const,
};

const numeroProyectado = {
  fontSize: "18px",
  fontWeight: 400,
};

const aclaracion = {
  display: "block",
  fontSize: "13px",
  color: "#999999",
  marginTop: "4px",
};

const filaInversion = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  padding: "10px 0",
  color: "#444444",
  borderTop: "1px solid #eeeeee",
};

const filaInversionTotal = {
  borderTop: "2px solid #111111",
  color: "#111111",
  fontSize: "17px",
};

const incidenciaTexto = {
  color: "#999999",
  fontWeight: 400,
  fontSize: "14px",
};

const desvioTotalTexto = {
  display: "block",
  fontSize: "14px",
  color: "#777777",
  marginTop: "6px",
};

const aclaracionPie = {
  fontSize: "13px",
  color: "#999999",
  marginTop: "16px",
};

const desvioTexto = {
  display: "block",
  fontSize: "13px",
  color: "#777777",
  marginTop: "4px",
};
