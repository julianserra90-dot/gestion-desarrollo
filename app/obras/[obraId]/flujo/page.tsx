import Link from "next/link";
import AppShell from "@/components/AppShell";
import GraficoBarras from "@/components/GraficoBarras";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { rangoDeSemana, semanaDeObra } from "@/lib/semanas";
import { createClient } from "@/lib/supabase/server";

/**
 * El flujo de la obra: cuánto salió y cuánto entró, mes a mes.
 *
 * Los totales de Economía dicen cuánto se lleva gastado; esto dice **cuándo**.
 * Es la lectura que anticipa la plata que va a hacer falta: tres meses seguidos
 * de gasto creciente se ven acá y en ningún otro lado.
 *
 * El acumulado es de gastos, no un saldo de cuenta: los ingresos son lo que
 * entró a la cuenta de la obra, pero muchos gastos los paga una socia de su
 * bolsillo sin pasar por ahí. Restar las dos columnas daría un número que no
 * es el saldo de nada.
 */

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** "2026-07" a "jul 26". */
function etiquetaMes(clave: string) {
  const [year, mes] = clave.split("-");
  return `${MESES[Number(mes) - 1]} ${year.slice(2)}`;
}

/** Todos los meses entre el primero y el último, incluso los vacíos: un mes
 * sin movimiento es información —la obra estuvo parada— y saltearlo deformaría
 * el gráfico. */
function mesesEntre(desde: string, hasta: string) {
  const claves: string[] = [];
  let [year, mes] = desde.split("-").map(Number);
  const [yearFin, mesFin] = hasta.split("-").map(Number);

  while (year < yearFin || (year === yearFin && mes <= mesFin)) {
    claves.push(`${year}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      year += 1;
    }
  }

  return claves;
}

export default async function FlujoPage({
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

  const [{ data: gastos }, { data: ingresos }] = await Promise.all([
    supabase
      .from("gastos")
      .select("fecha, monto, estado, tipo_gasto")
      .eq("obra_id", obra.id)
      .neq("estado", "Anulado"),
    // `monto` es siempre el valor en pesos, también en los aportes en dólares:
    // es la columna que suma `obra_caja` para el balance.
    supabase
      .from("ingresos")
      .select("fecha, monto")
      .eq("obra_id", obra.id),
  ]);

  // Un ajuste de saldo mueve plata entre socias: no es plata que salga de la
  // obra, así que no es flujo. Mismo criterio que en "en qué se gastó".
  const salidas = (gastos ?? []).filter(
    (g) => g.tipo_gasto !== "Ajuste de saldo"
  );
  const entradas = ingresos ?? [];

  const totalGastado = salidas.reduce((acc, g) => acc + Number(g.monto), 0);
  const totalIngresado = entradas.reduce((acc, i) => acc + Number(i.monto), 0);

  const gastosPorMes = new Map<string, number>();
  for (const g of salidas) {
    const clave = g.fecha.slice(0, 7);
    gastosPorMes.set(clave, (gastosPorMes.get(clave) ?? 0) + Number(g.monto));
  }

  const ingresosPorMes = new Map<string, number>();
  for (const i of entradas) {
    const clave = i.fecha.slice(0, 7);
    ingresosPorMes.set(clave, (ingresosPorMes.get(clave) ?? 0) + Number(i.monto));
  }

  const conMovimiento = [
    ...new Set([...gastosPorMes.keys(), ...ingresosPorMes.keys()]),
  ].sort();

  const claves =
    conMovimiento.length > 0
      ? mesesEntre(conMovimiento[0], conMovimiento[conMovimiento.length - 1])
      : [];

  // El acumulado se arma recorriendo en orden, del mes más viejo al más nuevo.
  const meses: {
    clave: string;
    etiqueta: string;
    gastado: number;
    ingresado: number;
    acumulado: number;
  }[] = [];

  let acumulado = 0;
  for (const clave of claves) {
    const gastado = gastosPorMes.get(clave) ?? 0;
    acumulado += gastado;

    meses.push({
      clave,
      etiqueta: etiquetaMes(clave),
      gastado,
      ingresado: ingresosPorMes.get(clave) ?? 0,
      acumulado,
    });
  }

  // El promedio se calcula sobre los meses que tuvieron gasto: dividir por los
  // meses parados lo hundiría y no diría nada del ritmo real de la obra.
  const mesesConGasto = meses.filter((m) => m.gastado > 0).length;
  const promedio = mesesConGasto > 0 ? totalGastado / mesesConGasto : 0;

  // La semana en curso, contada desde el arranque de la obra.
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const semanaActual = semanaDeObra(hoyIso, obra.fecha_inicio);

  // Lo mismo que los meses, pero por semana de obra. Sólo las que tuvieron
  // gasto: una obra de un año tiene cincuenta semanas y las vacías serían puro
  // relleno en una tabla que se lee de arriba abajo.
  // Lo pagado antes del arranque no cae en ninguna semana —acopios de
  // material, anticipos, señas—, pero es plata que salió: va en una fila
  // aparte y entra al acumulado, para que la columna cierre con el total.
  const porSemana = new Map<number, number>();
  let previoAlArranque = 0;

  for (const g of salidas) {
    const semana = semanaDeObra(g.fecha, obra.fecha_inicio);
    if (semana === null) {
      if (obra.fecha_inicio) previoAlArranque += Number(g.monto);
      continue;
    }
    porSemana.set(semana, (porSemana.get(semana) ?? 0) + Number(g.monto));
  }

  const semanas: {
    semana: number;
    gastado: number;
    acumulado: number;
    rango: { desde: string; hasta: string } | null;
  }[] = [];

  let acumuladoSemanal = previoAlArranque;
  for (const [semana, gastado] of [...porSemana.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    acumuladoSemanal += gastado;
    semanas.push({
      semana,
      gastado,
      acumulado: acumuladoSemanal,
      rango: rangoDeSemana(semana, obra.fecha_inicio),
    });
  }

  // Se acumula del más viejo al más nuevo, pero se lista al revés: la semana
  // en curso arriba, igual que en el resto de los listados.
  semanas.reverse();

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="flujo" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Flujo</h2>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Semana de obra</p>
          <h3 style={ui.statNumber}>
            {semanaActual !== null ? semanaActual : "—"}
          </h3>
          {semanaActual === null && (
            <p style={{ ...ui.note, margin: "6px 0 0" }}>
              Cargá la fecha de inicio en Editar obra.
            </p>
          )}
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Gastado</p>
          <h3 style={ui.statNumber}>{formatMoney(totalGastado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Ingresado a la cuenta</p>
          <h3 style={ui.statNumber}>{formatMoney(totalIngresado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Promedio por mes</p>
          <h3 style={ui.statNumber}>{formatMoney(promedio)}</h3>
        </div>
      </section>

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Mes a mes</h3>

        <GraficoBarras
          datos={meses.map((m) => ({
            etiqueta: m.etiqueta,
            valores: [m.gastado, m.ingresado],
          }))}
          series={[
            { nombre: "Gastos", color: "#111827" },
            { nombre: "Ingresos a la cuenta", color: "#93b8e8" },
          ]}
          formato={formatMoney}
        />

        {meses.length > 0 && (
          <table style={{ ...ui.table, marginTop: "28px" }}>
            <thead>
              <tr>
                <th style={ui.th}>Mes</th>
                <th style={ui.thRight}>Gastos</th>
                <th style={ui.thRight}>Ingresos a la cuenta</th>
                <th style={ui.thRight}>Gastado acumulado</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.clave}>
                  <td style={ui.td}>{m.etiqueta}</td>
                  <td style={ui.tdRight}>
                    {m.gastado > 0 ? (
                      <strong>{formatMoney(m.gastado)}</strong>
                    ) : (
                      <span style={{ color: "#bbbbbb" }}>—</span>
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    {m.ingresado > 0 ? (
                      formatMoney(m.ingresado)
                    ) : (
                      <span style={{ color: "#bbbbbb" }}>—</span>
                    )}
                  </td>
                  <td style={ui.tdRight}>{formatMoney(m.acumulado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={tdTotal}>Total</td>
                <td style={tdTotalRight}>{formatMoney(totalGastado)}</td>
                <td style={tdTotalRight}>{formatMoney(totalIngresado)}</td>
                <td style={tdTotalRight}>—</td>
              </tr>
            </tfoot>
          </table>
        )}

        <p style={{ ...ui.note, marginTop: "16px", marginBottom: 0 }}>
          Los ingresos son lo que entró a la cuenta de la obra; muchos gastos
          los paga una socia de su bolsillo sin pasar por ahí, así que las dos
          columnas no se restan entre sí.
        </p>
      </section>

      {semanas.length > 0 && (
        /* Acordeón: la semana es el detalle fino, y con medio año de obra son
           veinte filas. Los meses quedan arriba, que es la lectura que se
           viene a buscar. */
        <details style={ui.panelConMargen}>
          <summary style={resumenSemanas}>
            <span style={contenidoResumen}>
              <span style={tituloSemanas}>Semana a semana</span>
              <span style={ui.note}>{semanas.length} semanas con gastos</span>
            </span>
          </summary>

          <table style={{ ...ui.table, marginTop: "16px" }}>
            <thead>
              <tr>
                <th style={ui.th}>Semana</th>
                <th style={ui.th}>Del</th>
                <th style={ui.thRight}>Gastos</th>
                <th style={ui.thRight}>Gastado acumulado</th>
              </tr>
            </thead>
            <tbody>
              {semanas.map((s) => (
                <tr key={s.semana}>
                  <td style={ui.td}>
                    <strong>Semana {s.semana}</strong>
                    {s.semana === semanaActual && (
                      <span style={tagActual}>En curso</span>
                    )}
                  </td>
                  <td style={ui.td}>
                    {s.rango
                      ? `${formatDate(s.rango.desde)} al ${formatDate(s.rango.hasta)}`
                      : "—"}
                  </td>
                  <td style={ui.tdRight}>
                    <strong>{formatMoney(s.gastado)}</strong>
                  </td>
                  <td style={ui.tdRight}>{formatMoney(s.acumulado)}</td>
                </tr>
              ))}

              {/* Va última porque la tabla se lee de la semana en curso hacia
                  atrás, y esto es lo más viejo de todo. */}
              {previoAlArranque > 0 && (
                <tr>
                  <td style={ui.td}>
                    <span style={ui.tagPrevio}>Previo al arranque</span>
                  </td>
                  <td style={ui.td}>Acopios, anticipos y señas</td>
                  <td style={ui.tdRight}>
                    <strong>{formatMoney(previoAlArranque)}</strong>
                  </td>
                  <td style={ui.tdRight}>{formatMoney(previoAlArranque)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </details>
      )}

      {meses.length === 0 && (
        <section style={ui.panelConMargen}>
          <p style={ui.vacio}>
            Todavía no hay gastos ni ingresos cargados en esta obra. Cargá el
            primero en{" "}
            <Link href={`/obras/${obra.slug}/gastos`} style={enlace}>
              Gastos
            </Link>
            .
          </p>
        </section>
      )}
    </AppShell>
  );
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

const resumenSemanas = {
  cursor: "pointer",
};

// El contenido va en un span aparte: darle display al summary borra el
// triangulito nativo, que es la señal de que el bloque se abre.
const contenidoResumen = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: "14px",
  width: "calc(100% - 28px)",
  verticalAlign: "middle" as const,
};

const tituloSemanas = {
  fontSize: "18px",
};

const tagActual = {
  marginLeft: "8px",
  background: "#f2f2f2",
  color: "#555555",
  padding: "2px 6px",
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};
