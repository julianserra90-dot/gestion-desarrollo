import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import {
  getIngresosPrevistos,
  resumirPrevistos,
  type IngresoPrevisto,
} from "@/lib/ingresos-previstos";
import { getObraPorSlug } from "@/lib/obras";

/**
 * La agenda de ingresos: qué cuotas van a poner las socias y cuánto falta.
 *
 * Los ingresos reales cuentan lo que ya entró. Cuando los aportes vienen en
 * cuotas de afuera —otro emprendimiento que se está cobrando—, hace falta
 * además ver lo que todavía no entró y cuándo debería. Cada cuota cumplida
 * apunta al ingreso real que la cubrió; las demás están pendientes o, si ya
 * pasó su fecha, vencidas.
 */
export default async function AgendaIngresosPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const cuotas = await getIngresosPrevistos(obra.id);
  const resumen = resumirPrevistos(cuotas);
  const base = `/obras/${obra.slug}/ingresos`;

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="ingresos" />}
    >
      <ObraHeader obra={obra} activeSection="ingresos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Agenda de ingresos</h2>
      </section>

      {/* Dos monedas, dos columnas de números: lo previsto en dólares no se
          valúa en pesos para sumarlo, igual que en toda la app. Lo que falta
          va primero porque es la pregunta que trae a esta pantalla. */}
      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Falta ingresar en pesos</p>
          <h3
            style={{
              ...ui.statNumber,
              color: resumen.faltaArs > 0 ? ui.ROJO : ui.VERDE,
            }}
          >
            {formatMoney(resumen.faltaArs)}
          </h3>
          {resumen.previstoArs > 0 && (
            <p style={{ ...ui.note, margin: "6px 0 0" }}>
              de {formatMoney(resumen.previstoArs)} previstos
            </p>
          )}
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Falta ingresar en dólares</p>
          <h3
            style={{
              ...ui.statNumber,
              color: resumen.faltaUsd > 0 ? ui.ROJO : ui.VERDE,
            }}
          >
            {formatUSD(resumen.faltaUsd)}
          </h3>
          {resumen.previstoUsd > 0 && (
            <p style={{ ...ui.note, margin: "6px 0 0" }}>
              de {formatUSD(resumen.previstoUsd)} previstos
            </p>
          )}
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Ya ingresado</p>
          <h3 style={ui.statNumber}>{formatMoney(resumen.ingresadoArs)}</h3>
          {resumen.ingresadoUsd > 0 && (
            <p style={{ ...ui.note, margin: "6px 0 0" }}>
              y {formatUSD(resumen.ingresadoUsd)}
            </p>
          )}
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Cuotas por entrar</p>
          <h3 style={ui.statNumber}>{resumen.pendientes + resumen.vencidas}</h3>
          {resumen.vencidas > 0 && (
            <p style={{ ...ui.note, margin: "6px 0 0", color: ui.ROJO }}>
              {resumen.vencidas === 1
                ? "1 vencida"
                : `${resumen.vencidas} vencidas`}
            </p>
          )}
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Cuotas previstas</h3>

        <div style={botones}>
          <Link href={base} style={ui.secondaryButton}>
            Ver ingresos
          </Link>
          <Link href={`${base}/agenda/nuevo`} style={ui.button}>
            Nuevas cuotas
          </Link>
        </div>
      </div>

      <section style={ui.panel}>
        {cuotas.length === 0 ? (
          <p style={ui.vacio}>
            Todavía no hay cuotas previstas en esta obra. Cargá la primera serie
            para saber cuánto falta por entrar y cuándo.
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha prevista</th>
                <th style={ui.th}>Empresa</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.thRight}>Monto</th>
                <th style={ui.th}>Estado</th>
                <th style={ui.th}></th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {cuotas.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...ui.td, ...compacta }}>
                    {formatDate(c.fechaPrevista)}
                  </td>
                  <td style={ui.td}>{c.empresaNombre}</td>
                  <td style={ui.td}>
                    {c.detalle}
                    {c.observaciones && (
                      <div style={observaciones}>{c.observaciones}</div>
                    )}
                  </td>
                  <td style={{ ...ui.tdRight, ...compacta }}>
                    {c.moneda === "USD" ? formatUSD(c.monto) : formatMoney(c.monto)}
                  </td>
                  <td style={{ ...ui.td, ...compacta }}>
                    <Estado cuota={c} base={base} />
                  </td>
                  <td style={{ ...ui.td, ...compacta }}>
                    {/* La cuota se cumple cargando el ingreso real, con todo
                        precargado desde acá. */}
                    {!c.ingreso && (
                      <Link
                        href={`${base}/nuevo?previsto=${c.id}`}
                        style={enlace}
                      >
                        Registrar ingreso
                      </Link>
                    )}
                  </td>
                  <td style={{ ...ui.td, ...compacta }}>
                    <Link href={`${base}/agenda/${c.id}/editar`} style={enlace}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}

/**
 * Cómo está la cuota. Una cumplida dice cuándo entró y, si entró por otro
 * monto, cuánto: es lo que explica que "falta ingresar" no dé cero aunque
 * todas figuren cumplidas.
 */
function Estado({ cuota, base }: { cuota: IngresoPrevisto; base: string }) {
  if (cuota.ingreso) {
    const distinto =
      cuota.ingreso.moneda !== cuota.moneda || cuota.ingreso.monto !== cuota.monto;
    const montoReal =
      cuota.ingreso.moneda === "USD"
        ? formatUSD(cuota.ingreso.monto)
        : formatMoney(cuota.ingreso.monto);

    return (
      <Link href={`${base}/${cuota.ingreso.id}/editar`} style={estadoOk}>
        Ingresada el {formatDate(cuota.ingreso.fecha)}
        {distinto && <div style={estadoNota}>por {montoReal}</div>}
      </Link>
    );
  }

  if (cuota.estado === "vencida") {
    return <span style={estadoVencida}>Vencida</span>;
  }

  return <span style={estadoPendiente}>Pendiente</span>;
}

const compacta = { whiteSpace: "nowrap" as const };

const botones = {
  display: "flex",
  gap: "12px",
};

const observaciones = {
  fontSize: "13px",
  color: "#999999",
  marginTop: "4px",
};

const enlace = {
  color: "#111111",
  fontSize: "14px",
  textDecoration: "underline",
};

const estadoOk = {
  color: ui.VERDE,
  fontSize: "14px",
  textDecoration: "none",
};

const estadoNota = {
  fontSize: "13px",
  color: "#999999",
};

const estadoVencida = {
  color: ui.ROJO,
  fontSize: "14px",
};

const estadoPendiente = {
  color: "#777777",
  fontSize: "14px",
};
