import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatMoney, formatUSD } from "@/lib/format";
import { getInversores } from "@/lib/inversores";
import { getObraPorSlug } from "@/lib/obras";

/**
 * La agenda: quién se comprometió a poner cuánto, y cuánto le falta.
 *
 * Antes un inversor era un nombre escrito a mano en cada ingreso. Servía para
 * saber de dónde vino la plata, pero no para la pregunta de todos los días:
 * cuánto falta que ponga. Acá cada uno tiene su ficha y los aportes cuelgan de
 * ella.
 *
 * Los compradores de unidades entran en la misma tabla: firman por un monto y
 * lo pagan en cuotas, que es exactamente la misma forma.
 */
export default async function InversoresPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const inversores = await getInversores(obra.id);

  const total = inversores.reduce(
    (acc, i) => ({
      comprometidoArs: acc.comprometidoArs + i.comprometidoArs,
      comprometidoUsd: acc.comprometidoUsd + i.comprometidoUsd,
      restaArs: acc.restaArs + i.restaArs,
      restaUsd: acc.restaUsd + i.restaUsd,
    }),
    { comprometidoArs: 0, comprometidoUsd: 0, restaArs: 0, restaUsd: 0 }
  );

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="inversores" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Inversores</h2>
      </section>

      {/* Las mismas cuatro tarjetas que en Ingresos y por la misma razón: son
          dos monedas que no se mezclan, cada una con lo suyo. Nada se valúa de
          un lado al otro. */}
      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Comprometido en pesos</p>
          <h3 style={ui.statNumber}>{formatMoney(total.comprometidoArs)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Comprometido en dólares</p>
          <h3 style={ui.statNumber}>{formatUSD(total.comprometidoUsd)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Resta en pesos</p>
          <h3
            style={{
              ...ui.statNumber,
              color: total.restaArs > 0 ? ui.ROJO : ui.VERDE,
            }}
          >
            {formatMoney(total.restaArs)}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Resta en dólares</p>
          <h3
            style={{
              ...ui.statNumber,
              color: total.restaUsd > 0 ? ui.ROJO : ui.VERDE,
            }}
          >
            {formatUSD(total.restaUsd)}
          </h3>
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Agenda</h3>

        <Link href={`/obras/${obra.slug}/inversores/nuevo`} style={ui.button}>
          Nuevo inversor
        </Link>
      </div>

      <section style={ui.panel}>
        {inversores.length === 0 ? (
          <p style={ui.vacio}>
            Todavía no hay inversores ni compradores cargados en esta obra.
            Cargá el primero para poder seguir cuánto puso y cuánto le falta.
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Quién</th>
                <th style={ui.th}>Qué es</th>
                <th style={ui.thRight}>Comprometido</th>
                <th style={ui.thRight}>Ya puso</th>
                <th style={ui.thRight}>Resta poner</th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {inversores.map((inv) => (
                <tr key={inv.id}>
                  <td style={ui.td}>
                    <strong>{inv.nombreCompleto}</strong>
                    <div style={cuantosAportes}>
                      {inv.aportes === 0
                        ? "sin aportes todavía"
                        : `${inv.aportes} ${inv.aportes === 1 ? "aporte" : "aportes"}`}
                    </div>
                  </td>
                  <td style={{ ...ui.td, ...compacta }}>
                    <span style={tag}>{inv.tipo}</span>
                  </td>

                  {/* Cada columna muestra sólo los lados que tienen algo: un
                      inversor que firmó en dólares no necesita ver "$ 0,00" en
                      todas sus filas. Sin compromiso cargado se dice, en vez de
                      mostrar un cero que se lee como "ya no debe nada". */}
                  <td style={ui.tdRight}>
                    {inv.sinCompromiso ? (
                      <span style={sinDato}>sin cargar</span>
                    ) : (
                      <Montos ars={inv.comprometidoArs} usd={inv.comprometidoUsd} />
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    <Montos ars={inv.aportadoArs} usd={inv.aportadoUsd} />
                  </td>
                  <td style={ui.tdRight}>
                    {inv.sinCompromiso ? (
                      <span style={sinDato}>—</span>
                    ) : (
                      <Montos
                        ars={inv.comprometidoArs > 0 ? inv.restaArs : 0}
                        usd={inv.comprometidoUsd > 0 ? inv.restaUsd : 0}
                        color={
                          inv.restaArs > 0 || inv.restaUsd > 0
                            ? ui.ROJO
                            : ui.VERDE
                        }
                      />
                    )}
                  </td>
                  <td style={ui.td}>
                    <Link
                      href={`/obras/${obra.slug}/inversores/${inv.id}/editar`}
                      style={editarLink}
                    >
                      Ver ficha
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
 * Los dos lados de una cifra, uno debajo del otro.
 *
 * Se dibuja sólo el lado que tiene algo. Si no hay ninguno, un cero en pesos:
 * la celda no puede quedar vacía, y "todavía no puso nada" en la moneda de la
 * obra es la lectura correcta.
 */
function Montos({
  ars,
  usd,
  color,
}: {
  ars: number;
  usd: number;
  color?: string;
}) {
  if (ars === 0 && usd === 0) {
    return <span style={{ color }}>{formatMoney(0)}</span>;
  }

  return (
    <>
      {ars > 0 && <div style={{ color }}>{formatMoney(ars)}</div>}
      {usd > 0 && <div style={{ color }}>{formatUSD(usd)}</div>}
    </>
  );
}

const compacta = { whiteSpace: "nowrap" as const };

const cuantosAportes = {
  fontSize: "13px",
  color: "#999999",
  marginTop: "4px",
};

const sinDato = {
  color: "#bbbbbb",
};

const tag = {
  display: "inline-block",
  border: "1px solid #e5e5e5",
  padding: "2px 8px",
  fontSize: "12px",
  color: "#555555",
};

const editarLink = {
  color: "#111111",
  fontSize: "14px",
  textDecoration: "underline",
};
