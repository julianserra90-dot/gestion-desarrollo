import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import PagosLoteLista from "@/components/PagosLoteLista";
import * as ui from "@/components/ui";
import { formatUSD } from "@/lib/format";
import { getLote, incidenciaPorM2 } from "@/lib/lote";
import { CATEGORIAS_ASOCIADAS } from "@/lib/lote-tipos";
import { getObraPorSlug } from "@/lib/obras";
import { superficieVenta } from "@/lib/superficies";
import { getTotalesUsd } from "@/lib/totales-usd";
import { eliminarPagoLote } from "./actions";

/** Los atajos que llegan desde las tarjetas de arriba. */
const CATEGORIAS_POR_VISTA: Record<string, readonly string[]> = {
  compra: ["Compra"],
  administrativos: CATEGORIAS_ASOCIADAS,
};

export default async function LotePage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string; ver?: string }>;
}) {
  const { obraId } = await params;
  const { error, ver } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const [lote, construccion] = await Promise.all([
    getLote(
      obra.id,
      obra.lote_valor_usd,
      obra.lote_superficie_m2,
      obra.lote_vendedor,
      obra.lote_detalle
    ),
    getTotalesUsd(obra.id),
  ]);

  // Lo que venga de más en la URL se ignora: la pantalla abre sin filtro.
  const categoriasFiltro = ver ? CATEGORIAS_POR_VISTA[ver] : undefined;

  const incidenciaVenta = incidenciaPorM2(lote.valorUsd, superficieVenta(obra));
  const inversionTotal = construccion.gastadoUsd + lote.totalUsd;

  const hayDatos = lote.valorUsd !== null || lote.pagos.length > 0;

  // La nomenclatura catastral se guarda desglosada pero se lee entera: sueltas,
  // "II" y "B" no dicen nada.
  const nomenclatura = [
    obra.lote_circunscripcion && `Circ. ${obra.lote_circunscripcion}`,
    obra.lote_seccion && `Secc. ${obra.lote_seccion}`,
    obra.lote_manzana && `Mz. ${obra.lote_manzana}`,
    obra.lote_parcela && `Parc. ${obra.lote_parcela}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Sólo se listan los datos cargados: una ficha llena de guiones no informa.
  const ficha = [
    {
      etiqueta: "Superficie del terreno",
      valor:
        obra.lote_superficie_m2 === null
          ? null
          : `${obra.lote_superficie_m2} m²`,
    },
    { etiqueta: "Vendedor", valor: obra.lote_vendedor },
    { etiqueta: "Propietario", valor: obra.lote_propietario },
    { etiqueta: "Partida inmobiliaria", valor: obra.lote_partida },
    { etiqueta: "Nomenclatura catastral", valor: nomenclatura || null },
    { etiqueta: "Detalle", valor: obra.lote_detalle },
  ].filter((dato) => dato.valor);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="lote" />

      {/* La acción va arriba y no al pie: esta pantalla se abre para mirar cómo
          viene la compra, y cargar un pago no debería costar un scroll. */}
      <section style={ui.sectionHeader}>
        <div style={encabezado}>
          <div>
            <p style={ui.eyebrow}>Economía</p>
            <h2 style={ui.pageTitle}>Lote</h2>
            <p style={ui.subtitle}>Todo en dólares.</p>
          </div>

          <Link href={`/obras/${obra.slug}/lote/nuevo`} style={ui.button}>
            Agregar pago
          </Link>
        </div>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      {hayDatos && (
        <section style={ui.statsGrid}>
          <div style={ui.statCard}>
            <p style={ui.label}>Valor lote</p>
            <h3 style={ui.statNumber}>
              {lote.valorUsd === null ? "—" : formatUSD(lote.valorUsd)}
            </h3>
          </div>
          {/* Lleva al detalle de esos pagos, más abajo en esta misma pantalla:
              es la pregunta que sigue al número —"¿qué se fue pagando?"—. */}
          <Link href={`/obras/${obra.slug}/lote?ver=compra#pagos`} style={cardEnlace}>
            <p style={ui.label}>Pago a la fecha</p>
            <h3 style={ui.statNumber}>{formatUSD(lote.pagadoCompraUsd)}</h3>
          </Link>
          <div style={ui.statCard}>
            <p style={ui.label}>Saldo pendiente</p>
            <h3 style={ui.statNumber}>
              {lote.saldoUsd === null ? "—" : formatUSD(lote.saldoUsd)}
            </h3>
            {lote.saldoUsd !== null && lote.saldoUsd <= 0 && lote.valorUsd && (
              <p style={{ ...ui.note, margin: "6px 0 0" }}>Compra saldada.</p>
            )}
          </div>
          <Link
            href={`/obras/${obra.slug}/lote?ver=administrativos#pagos`}
            style={cardEnlace}
          >
            <p style={ui.label}>Gastos administrativos</p>
            <h3 style={ui.statNumber}>{formatUSD(lote.asociadosUsd)}</h3>
          </Link>
        </section>
      )}

      {hayDatos && (
        <section style={ui.panelConMargen}>
          <div style={dosColumnas}>
            <div style={filaResumen}>
              <span>Total desembolsado en el lote</span>
              <strong>{formatUSD(lote.totalUsd)}</strong>
            </div>
            {/* Siempre sobre la superficie de venta: la incidencia es cuánto
                del m² que se vende es tierra, no cuánto del que se construye. */}
            {incidenciaVenta !== null && (
              <div style={filaResumen}>
                <span>Incidencia por m² de venta</span>
                <strong>{formatUSD(incidenciaVenta)} /m²</strong>
              </div>
            )}
            <div style={filaResumen}>
              <span>Gastado en construcción</span>
              <strong>{formatUSD(construccion.gastadoUsd)}</strong>
            </div>
            <div style={{ ...filaResumen, ...filaTotal }}>
              <span>Inversión total (lote + construcción)</span>
              <strong>{formatUSD(inversionTotal)}</strong>
            </div>
          </div>

          {(lote.sinCotizar > 0 || construccion.sinCotizar > 0) && (
            <p style={{ ...ui.note, marginTop: "14px" }}>
              Hay movimientos sin cotización que quedan fuera del cálculo en
              dólares.
            </p>
          )}
        </section>
      )}

      {/* --- Reparto del lote entre socias --------------------------------- */}

      {lote.pagos.length > 0 && lote.socios.length > 0 && (
        <section style={ui.panelConMargen}>
          <h3 style={ui.sectionTitle}>Reparto del lote entre socias</h3>
          <p style={{ ...ui.note, marginTop: 0, marginBottom: "16px" }}>
            Este reparto es del lote y va aparte del balance de la obra.
          </p>

          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Empresa</th>
                <th style={ui.th}>Particip.</th>
                <th style={thDer}>Puso</th>
                <th style={thDer}>Le corresponde</th>
                <th style={thDer}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {lote.socios.map((s) => (
                <tr key={s.empresaId}>
                  <td style={ui.td}>{s.empresa}</td>
                  <td style={ui.td}>{s.porcentaje}%</td>
                  <td style={tdDer}>{formatUSD(s.puestoUsd)}</td>
                  <td style={tdDer}>{formatUSD(s.leCorrespondeUsd)}</td>
                  <td style={tdDer}>
                    <strong style={estiloSaldo(s.saldoUsd)}>
                      {s.saldoUsd > 0 ? "+" : ""}
                      {formatUSD(s.saldoUsd)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {lote.sinAsignarUsd > 0.01 && (
            <p style={{ ...ui.note, marginTop: "14px" }}>
              Hay {formatUSD(lote.sinAsignarUsd)} en pagos{" "}
              <strong>sin asignar</strong>. No entran en el reparto hasta que les
              elijas la empresa que pagó (editá cada pago).
            </p>
          )}

          <div style={liquidacionBox}>
            <p style={liquidacionTitulo}>Liquidación sugerida del lote</p>
            {lote.liquidacion.length === 0 ? (
              <p style={{ ...ui.text, margin: 0 }}>
                Las socias están a la par en el lote.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "20px" }}>
                {lote.liquidacion.map((mov, i) => (
                  <li key={i} style={{ ...ui.text, lineHeight: 1.7 }}>
                    <strong>{mov.de}</strong> le transfiere{" "}
                    <strong>{formatUSD(mov.monto)}</strong> a{" "}
                    <strong>{mov.a}</strong>.
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* --- Ficha del lote ------------------------------------------------ */}
      {/* Sólo lectura. Estos datos se cargan al comprar y después casi no se
          tocan, así que se editan en Editar obra → Datos lote. Acá se muestran
          porque son la identidad del terreno. */}

      <section style={ui.panelConMargen}>
        <div style={ui.toolbar}>
          <h3 style={ui.sectionTitle}>Datos del lote</h3>

          <Link href={`/obras/${obra.slug}/editar/lote`} style={enlaceEditar}>
            Editar datos del lote
          </Link>
        </div>

        {ficha.length === 0 ? (
          <p style={ui.vacio}>
            Todavía no se cargaron los datos del terreno.
          </p>
        ) : (
          <div style={dosColumnas}>
            {ficha.map((dato) => (
              <div key={dato.etiqueta} style={filaResumen}>
                <span>{dato.etiqueta}</span>
                <strong>{dato.valor}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Historial de pagos -------------------------------------------- */}

      <section id="pagos" style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Pagos</h3>

        <PagosLoteLista
          pagos={lote.pagos.map((p) => ({
            id: p.id,
            fecha: p.fecha,
            categoria: p.categoria,
            concepto: p.concepto,
            monto: p.monto,
            moneda: p.moneda,
            usd: p.usd,
            empresa: p.empresa,
            compartido: p.compartido,
          }))}
          slug={obra.slug}
          obraId={obra.id}
          eliminar={eliminarPagoLote}
          categoriaInicial={categoriasFiltro}
        />
      </section>
    </AppShell>
  );
}

const encabezado = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "24px",
};

// Misma tarjeta que ui.statCard, pero lleva al detalle de esos pagos.
const cardEnlace = {
  ...ui.statCard,
  display: "block",
  color: "#111111",
  textDecoration: "none",
};

const dosColumnas = {
  display: "grid",
  gap: "2px",
};

const filaResumen = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  padding: "10px 0",
  color: "#444444",
  borderTop: "1px solid #eeeeee",
};

const filaTotal = {
  borderTop: "2px solid #111111",
  color: "#111111",
  fontSize: "17px",
};

const thDer = {
  ...ui.th,
  textAlign: "right" as const,
};

const tdDer = {
  ...ui.td,
  textAlign: "right" as const,
};

// Verde: puso de más y le deben. Rojo: tiene que compensar.
function estiloSaldo(saldo: number) {
  if (saldo > 0.01) return { color: "#15803d" };
  if (saldo < -0.01) return { color: "#b91c1c" };
  return undefined;
}

const liquidacionBox = {
  border: "1px solid #111111",
  padding: "16px",
  marginTop: "24px",
};

const liquidacionTitulo = {
  fontSize: "13px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#555555",
  margin: "0 0 10px",
};

const enlaceEditar = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
