import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import PagoLoteForm from "@/components/PagoLoteForm";
import PagosLoteLista from "@/components/PagosLoteLista";
import * as ui from "@/components/ui";
import { formatUSD } from "@/lib/format";
import { getLote, incidenciaPorM2 } from "@/lib/lote";
import { getObraPorSlug } from "@/lib/obras";
import {
  superficieConstruccion,
  superficieVenta,
} from "@/lib/superficies";
import { getTotalesUsd } from "@/lib/totales-usd";
import { crearPagoLote, eliminarPagoLote, guardarDatosLote } from "./actions";

export default async function LotePage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId } = await params;
  const { error } = await searchParams;
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

  const incidenciaConstruccion = incidenciaPorM2(
    lote.valorUsd,
    superficieConstruccion(obra)
  );
  const incidenciaVenta = incidenciaPorM2(lote.valorUsd, superficieVenta(obra));
  const inversionTotal = construccion.gastadoUsd + lote.totalUsd;

  // Para el desplegable del formulario: las socias de la obra.
  const socios = lote.socios.map((s) => ({ id: s.empresaId, nombre: s.empresa }));

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const hayDatos = lote.valorUsd !== null || lote.pagos.length > 0;

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="lote" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Economía</p>
        <h2 style={ui.pageTitle}>Lote</h2>
        <p style={ui.subtitle}>
          La compra del terreno, aparte del costo de construir. Todo en dólares.
        </p>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      {hayDatos && (
        <section style={ui.statsGrid}>
          <div style={ui.statCard}>
            <p style={ui.label}>Valor pactado</p>
            <h3 style={ui.statNumber}>
              {lote.valorUsd === null ? "—" : formatUSD(lote.valorUsd)}
            </h3>
          </div>
          <div style={ui.statCard}>
            <p style={ui.label}>Pagado de la compra</p>
            <h3 style={ui.statNumber}>{formatUSD(lote.pagadoCompraUsd)}</h3>
          </div>
          <div style={ui.statCard}>
            <p style={ui.label}>Saldo pendiente</p>
            <h3 style={ui.statNumber}>
              {lote.saldoUsd === null ? "—" : formatUSD(lote.saldoUsd)}
            </h3>
            {lote.saldoUsd !== null && lote.saldoUsd <= 0 && lote.valorUsd && (
              <p style={{ ...ui.note, margin: "6px 0 0" }}>Compra saldada.</p>
            )}
          </div>
          <div style={ui.statCard}>
            <p style={ui.label}>Gastos de la operación</p>
            <h3 style={ui.statNumber}>{formatUSD(lote.asociadosUsd)}</h3>
            <p style={{ ...ui.note, margin: "6px 0 0" }}>
              Escribanía, sellos, comisión.
            </p>
          </div>
        </section>
      )}

      {hayDatos && (
        <section style={ui.panelConMargen}>
          <div style={dosColumnas}>
            <div style={filaResumen}>
              <span>Total desembolsado en el lote</span>
              <strong>{formatUSD(lote.totalUsd)}</strong>
            </div>
            {incidenciaConstruccion !== null && (
              <div style={filaResumen}>
                <span>Incidencia por m² de construcción</span>
                <strong>{formatUSD(incidenciaConstruccion)} /m²</strong>
              </div>
            )}
            {incidenciaVenta !== null &&
              incidenciaVenta !== incidenciaConstruccion && (
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
            Cada socia pone su porcentaje del terreno. Este reparto es del lote y
            va aparte del balance de la obra.
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

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Datos del lote</h3>

        <form action={guardarDatosLote}>
          <input type="hidden" name="obra_id" value={obra.id} />
          <input type="hidden" name="slug" value={obra.slug} />

          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Valor de compra (USD)</span>
              <input
                type="number"
                name="lote_valor_usd"
                min="0"
                step="0.01"
                defaultValue={obra.lote_valor_usd ?? ""}
                placeholder="Ej: 200000"
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Superficie del terreno (m²)</span>
              <input
                type="number"
                name="lote_superficie_m2"
                min="0"
                step="0.01"
                defaultValue={obra.lote_superficie_m2 ?? ""}
                placeholder="Ej: 300"
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Vendedor</span>
              <input
                type="text"
                name="lote_vendedor"
                defaultValue={obra.lote_vendedor ?? ""}
                placeholder="Quién vende"
                style={ui.input}
              />
            </label>

            <label style={fieldAncho}>
              <span style={labelCampo}>Detalle</span>
              <input
                type="text"
                name="lote_detalle"
                defaultValue={obra.lote_detalle ?? ""}
                placeholder="Nomenclatura catastral, partida, notas"
                style={ui.input}
              />
            </label>
          </div>

          <div style={accionesFicha}>
            <button type="submit" style={ui.button}>
              Guardar datos
            </button>
          </div>
        </form>
      </section>

      {/* --- Alta de pago -------------------------------------------------- */}

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Agregar pago</h3>
        <PagoLoteForm
          action={crearPagoLote}
          obraId={obra.id}
          slug={obra.slug}
          hoy={hoy}
          socios={socios}
        />
      </section>

      {/* --- Historial de pagos -------------------------------------------- */}

      <section style={ui.panelConMargen}>
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
        />
      </section>
    </AppShell>
  );
}

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

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
  alignContent: "start" as const,
};

const fieldAncho = {
  ...field,
  gridColumn: "1 / -1",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const accionesFicha = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "20px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
