import AppShell from "@/components/AppShell";
import GraficoBarras from "@/components/GraficoBarras";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import Volver from "@/components/Volver";
import { formatDate, formatMoney, formatMoneyEje } from "@/lib/format";
import { esClaveDeMes, nombreMes, rangoDeMes } from "@/lib/meses";
import { getObraPorSlug } from "@/lib/obras";
import { coloresPorRubro } from "@/lib/paleta-rubros";
import { rangoDeSemana, semanaDeObra } from "@/lib/semanas";
import { createClient } from "@/lib/supabase/server";

/**
 * Un mes de la obra, semana por semana.
 *
 * Se entra tocando el mes en el gráfico de Flujo, que muestra la forma pero no
 * el detalle. Acá se abre ese mes: cada semana con lo que se gastó **desglosado
 * por rubro** —en los colores de la paleta, apilados— y lo que entró a la
 * cuenta al lado.
 *
 * El desglose por rubro va acá y no en el gráfico de meses a propósito: en la
 * pantalla de arriba lo que se busca es el ritmo, y partir cada barra en cinco
 * colores lo tapaba. Recién cuando uno entra a un mes pregunta "¿en qué se fue?".
 *
 * El orden del apilado sale del peso de cada rubro **en el mes entero**, no
 * semana a semana: si albañilería está abajo en la semana 3 tiene que estarlo en
 * la 4, o las barras no se pueden comparar entre sí.
 */

export default async function MesDeFlujo({
  params,
}: {
  params: Promise<{ obraId: string; mes: string }>;
}) {
  const { obraId, mes } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  if (!esClaveDeMes(mes)) {
    return <AppShell>Mes no válido</AppShell>;
  }

  const supabase = await createClient();

  // El mes se filtra por rango, no con `like "2026-05-%"`: `fecha` es una
  // columna `date`, no texto, así que el like no filtra nada y la consulta
  // vuelve vacía **sin dar error** —pasó, y el mes se veía en cero—.
  const { desde, hasta } = rangoDeMes(mes);

  const [{ data: gastos }, { data: ingresos }] = await Promise.all([
    supabase
      .from("gastos")
      .select("id, fecha, concepto, monto, estado, tipo_gasto, rubros(nombre)")
      .eq("obra_id", obra.id)
      .neq("estado", "Anulado")
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .order("fecha"),
    supabase
      .from("ingresos")
      .select("fecha, monto")
      .eq("obra_id", obra.id)
      .gte("fecha", desde)
      .lt("fecha", hasta),
  ]);

  // Mismo criterio que en Flujo: un ajuste de saldo mueve plata entre socias,
  // no sale de la obra.
  const salidas = (gastos ?? []).filter(
    (g) => g.tipo_gasto !== "Ajuste de saldo"
  );
  const entradas = ingresos ?? [];

  const totalGastado = salidas.reduce((acc, g) => acc + Number(g.monto), 0);
  const totalIngresado = entradas.reduce((acc, i) => acc + Number(i.monto), 0);

  // Los rubros del mes, ordenados por lo que pesan: de ahí salen el color y el
  // orden del apilado, iguales en todas las semanas.
  const totalPorRubro = new Map<string, number>();
  for (const g of salidas) {
    const nombre = g.rubros?.nombre ?? "Sin rubro";
    totalPorRubro.set(
      nombre,
      (totalPorRubro.get(nombre) ?? 0) + Number(g.monto)
    );
  }

  const rubrosOrdenados = [...totalPorRubro.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nombre]) => nombre);

  const colorDeRubro = coloresPorRubro(rubrosOrdenados);

  /**
   * La clave de agrupado de una fecha: el número de semana de obra, o
   * `"previo"` para lo pagado antes del arranque —acopios, anticipos, señas—,
   * que no cae en ninguna semana pero es plata que salió igual.
   */
  const claveDe = (fecha: string) => {
    const semana = semanaDeObra(fecha, obra.fecha_inicio);
    return semana === null ? "previo" : String(semana);
  };

  const gastadoPorClave = new Map<string, number>();
  const porClaveYRubro = new Map<string, Map<string, number>>();

  for (const g of salidas) {
    const clave = claveDe(g.fecha);
    const nombre = g.rubros?.nombre ?? "Sin rubro";
    const monto = Number(g.monto);

    gastadoPorClave.set(clave, (gastadoPorClave.get(clave) ?? 0) + monto);

    const delGrupo = porClaveYRubro.get(clave) ?? new Map<string, number>();
    delGrupo.set(nombre, (delGrupo.get(nombre) ?? 0) + monto);
    porClaveYRubro.set(clave, delGrupo);
  }

  const ingresadoPorClave = new Map<string, number>();
  for (const i of entradas) {
    const clave = claveDe(i.fecha);
    ingresadoPorClave.set(
      clave,
      (ingresadoPorClave.get(clave) ?? 0) + Number(i.monto)
    );
  }

  // "Previo al arranque" primero: es lo más viejo. Las semanas después, en
  // orden, para que el gráfico se lea de izquierda a derecha como el calendario.
  const claves = [
    ...new Set([...gastadoPorClave.keys(), ...ingresadoPorClave.keys()]),
  ].sort((a, b) => {
    if (a === "previo") return -1;
    if (b === "previo") return 1;
    return Number(a) - Number(b);
  });

  const hayPrevio = claves.includes("previo");

  const grupos = claves.map((clave, i) => {
    const esPrevio = clave === "previo";
    const rango = esPrevio ? null : rangoDeSemana(Number(clave), obra.fecha_inicio);

    return {
      clave,
      esPrevio,
      etiqueta: esPrevio ? "Previo" : `Sem ${clave}`,
      // El arranque se marca entre lo previo y la primera semana: a la
      // izquierda de esa línea hay acopios e impuestos del terreno, no obra.
      marca: hayPrevio && i === 1 ? "Arranque de obra" : undefined,
      rango,
      gastado: gastadoPorClave.get(clave) ?? 0,
      ingresado: ingresadoPorClave.get(clave) ?? 0,
      porRubro: porClaveYRubro.get(clave) ?? new Map<string, number>(),
    };
  });

  const hayMovimientos = totalGastado > 0 || totalIngresado > 0;

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="flujo" />

      <section style={ui.sectionHeader}>
        {/* Sin eyebrow: decía "Flujo" y el enlace de arriba ya lo dice. */}
        <Volver href={`/obras/${obra.slug}/flujo`}>Flujo</Volver>
        <h2 style={ui.pageTitle}>{nombreMes(mes)}</h2>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Gastado en el mes</p>
          <h3 style={ui.statNumber}>{formatMoney(totalGastado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Ingresado a la cuenta</p>
          <h3 style={ui.statNumber}>{formatMoney(totalIngresado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Semanas con movimiento</p>
          <h3 style={ui.statNumber}>{grupos.length}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Gastos cargados</p>
          <h3 style={ui.statNumber}>{salidas.length}</h3>
        </div>
      </section>

      <section style={ui.panelConMargen}>
        {/* El "volver" vive arriba del título, junto con el de todas las
            pantallas de detalle: acá abajo había que ir a buscarlo. */}
        <h3 style={ui.sectionTitle}>Semana a semana</h3>

        {!hayMovimientos ? (
          <p style={ui.vacio}>Este mes no tiene gastos ni ingresos cargados.</p>
        ) : (
          <>
            <GraficoBarras
              datos={grupos.map((g) => ({
                etiqueta: g.etiqueta,
                valores: [g.gastado, g.ingresado],
                marca: g.marca,
                // Sólo los gastos se parten por rubro; un ingreso a la cuenta
                // no pertenece a ninguno.
                partes: [
                  rubrosOrdenados
                    .map((nombre) => ({
                      etiqueta: nombre,
                      color: colorDeRubro.get(nombre) ?? "#111827",
                      valor: g.porRubro.get(nombre) ?? 0,
                    }))
                    .filter((p) => p.valor > 0),
                  undefined,
                ],
              }))}
              series={[
                { nombre: "Gastos", color: "#111827" },
                { nombre: "Ingresos a la cuenta", color: "#93b8e8" },
              ]}
              formato={formatMoney}
              formatoEje={formatMoneyEje}
            />

            <table style={{ ...ui.table, marginTop: "28px" }}>
              <thead>
                <tr>
                  <th style={ui.th}>Semana</th>
                  <th style={ui.th}>Del</th>
                  <th style={ui.thRight}>Gastos</th>
                  <th style={ui.thRight}>Ingresos a la cuenta</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.clave}>
                    <td style={ui.td}>
                      {g.esPrevio ? (
                        <span style={ui.tagPrevio}>Previo al arranque</span>
                      ) : (
                        <strong>Semana {g.clave}</strong>
                      )}
                    </td>
                    <td style={ui.td}>
                      {g.esPrevio
                        ? "Acopios, anticipos y señas"
                        : g.rango
                          ? `${formatDate(g.rango.desde)} al ${formatDate(g.rango.hasta)}`
                          : "—"}
                    </td>
                    <td style={ui.tdRight}>
                      {g.gastado > 0 ? (
                        <strong>{formatMoney(g.gastado)}</strong>
                      ) : (
                        <span style={sinDato}>—</span>
                      )}
                    </td>
                    <td style={ui.tdRight}>
                      {g.ingresado > 0 ? (
                        formatMoney(g.ingresado)
                      ) : (
                        <span style={sinDato}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={tdTotal}>Total del mes</td>
                  <td style={tdTotal}></td>
                  <td style={tdTotalRight}>{formatMoney(totalGastado)}</td>
                  <td style={tdTotalRight}>{formatMoney(totalIngresado)}</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}
      </section>

      {rubrosOrdenados.length > 0 && (
        <section style={ui.panelConMargen}>
          <h3 style={ui.sectionTitle}>En qué se gastó el mes</h3>

          <table style={{ ...ui.table, marginTop: "16px" }}>
            <tbody>
              {rubrosOrdenados.map((nombre) => (
                <tr key={nombre}>
                  <td style={ui.td}>
                    <span
                      style={{
                        ...swatch,
                        background: colorDeRubro.get(nombre) ?? "#111827",
                      }}
                    />
                    {nombre}
                  </td>
                  <td style={ui.tdRight}>
                    <strong>{formatMoney(totalPorRubro.get(nombre) ?? 0)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </AppShell>
  );
}

const sinDato = {
  color: "#bbbbbb",
};

const swatch = {
  display: "inline-block",
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  marginRight: "10px",
};

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
