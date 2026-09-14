import Link from "next/link";
import AppShell from "@/components/AppShell";
import GraficoBarras, { type PuntoBarras } from "@/components/GraficoBarras";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { formatMoney, formatMoneyEje } from "@/lib/format";
import { etiquetaMes, mesesEntre } from "@/lib/meses";
import { getObraPorSlug } from "@/lib/obras";
import { semanaDeObra } from "@/lib/semanas";
import { createClient } from "@/lib/supabase/server";

/**
 * El flujo de la obra: cuánto salió y cuánto entró, período a período.
 *
 * Los totales de Economía dicen cuánto se lleva gastado; esto dice **cuándo**.
 * Es la lectura que anticipa la plata que va a hacer falta: tres meses seguidos
 * de gasto creciente se ven acá y en ningún otro lado.
 *
 * **Es sólo el gráfico, a propósito.** Tenía debajo una tabla mes a mes y un
 * acordeón semana a semana, y entre las tres la pantalla decía lo mismo de tres
 * maneras. Acá se viene a ver la forma; el monto exacto de cada barra aparece al
 * pasar el mouse y todo el detalle —incluido el semana a semana— está a un clic,
 * tocando el mes.
 *
 * **El período se elige** (`?periodo=`): toda la obra mes a mes, un año solo
 * mes a mes, o año a año con una barra por año. Una obra de dos o tres años
 * junta treinta meses en un gráfico de ancho fijo y las barras se vuelven
 * palitos; con un año a la vista vuelven a leerse, y el año a año contesta la
 * otra pregunta —cuánto se fue en cada año— sin sumar barras de reojo. Las
 * tarjetas de arriba responden al mismo período que el gráfico, salvo la
 * semana de obra, que es la de hoy.
 *
 * Los ingresos son lo que entró a la cuenta, y muchos gastos los paga una socia
 * de su bolsillo sin pasar por ahí: las dos series conviven en el gráfico pero
 * **no se restan entre sí**. Por eso acá no hay "resultado del período".
 */

const ANUAL = "anual";
const TODO = "todo";

export default async function FlujoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { obraId } = await params;
  const { periodo: periodoPedido } = await searchParams;
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

  // Todos los meses de la obra, del primer movimiento al último, con los
  // vacíos adentro: una obra parada es información.
  const todosLosMeses =
    conMovimiento.length > 0
      ? mesesEntre(conMovimiento[0], conMovimiento[conMovimiento.length - 1])
      : [];

  const años = [...new Set(todosLosMeses.map((clave) => clave.slice(0, 4)))];

  // Qué se muestra. Un año que no tiene movimientos, o cualquier otra cosa en
  // la URL, cae a toda la obra: no vale la pena una pantalla de error por un
  // enlace viejo.
  const periodo =
    periodoPedido === ANUAL && años.length > 1
      ? ANUAL
      : periodoPedido && años.includes(periodoPedido)
        ? periodoPedido
        : TODO;
  const esUnAño = periodo !== TODO && periodo !== ANUAL;

  const mesDeArranque = obra.fecha_inicio?.slice(0, 7) ?? null;

  const mesesAMostrar = esUnAño
    ? todosLosMeses.filter((clave) => clave.startsWith(periodo))
    : todosLosMeses;

  const gastadoEn = (claves: string[]) =>
    claves.reduce((acc, clave) => acc + (gastosPorMes.get(clave) ?? 0), 0);
  const ingresadoEn = (claves: string[]) =>
    claves.reduce((acc, clave) => acc + (ingresosPorMes.get(clave) ?? 0), 0);

  // Los totales de las tarjetas son del período a la vista. Con "toda la obra"
  // y "año a año" es todo; con un año, ese año.
  const totalGastado = gastadoEn(mesesAMostrar);
  const totalIngresado = ingresadoEn(mesesAMostrar);

  // El promedio se calcula sobre los meses que tuvieron gasto: dividir por los
  // meses parados lo hundiría y no diría nada del ritmo real de la obra.
  const mesesConGasto = mesesAMostrar.filter(
    (clave) => (gastosPorMes.get(clave) ?? 0) > 0
  ).length;
  const promedio = mesesConGasto > 0 ? totalGastado / mesesConGasto : 0;

  // El arranque de la obra se marca sólo si quedó algún grupo antes: una línea
  // pegada al borde izquierdo no separa nada, y lo que la marca explica es
  // justamente que a la izquierda hay movimientos que no son obra —acopios,
  // anticipos, impuestos del terreno—, que a veces se vienen pagando de mucho
  // antes. Mirando un año solo, la marca aparece si el arranque cae adentro y
  // no en su primer mes; año a año, si arrancó en un año que no es el primero.
  let puntos: PuntoBarras[];
  if (periodo === ANUAL) {
    const añoDeArranque = mesDeArranque?.slice(0, 4) ?? null;
    const marcarArranque =
      añoDeArranque !== null && años.indexOf(añoDeArranque) > 0;

    puntos = años.map((año) => {
      const meses = todosLosMeses.filter((clave) => clave.startsWith(año));
      const gastado = gastadoEn(meses);
      const ingresado = ingresadoEn(meses);
      return {
        etiqueta: año,
        valores: [gastado, ingresado],
        marca:
          marcarArranque && año === añoDeArranque
            ? "Arranque de obra"
            : undefined,
        // Tocar un año lo abre mes a mes.
        href:
          gastado > 0 || ingresado > 0
            ? `/obras/${obra.slug}/flujo?periodo=${año}`
            : undefined,
      };
    });
  } else {
    const marcarArranque =
      mesDeArranque !== null && mesesAMostrar.indexOf(mesDeArranque) > 0;

    // Los meses vacíos no llevan enlace: entrar a un mes sin nada sería una
    // pantalla en blanco.
    puntos = mesesAMostrar.map((clave) => {
      const gastado = gastosPorMes.get(clave) ?? 0;
      const ingresado = ingresosPorMes.get(clave) ?? 0;
      return {
        etiqueta: etiquetaMes(clave),
        valores: [gastado, ingresado],
        marca:
          marcarArranque && clave === mesDeArranque
            ? "Arranque de obra"
            : undefined,
        href:
          gastado > 0 || ingresado > 0
            ? `/obras/${obra.slug}/flujo/${clave}`
            : undefined,
      };
    });
  }

  const hayMarcaDeArranque = puntos.some((p) => p.marca);

  // La semana en curso, contada desde el arranque de la obra.
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const semanaActual = semanaDeObra(hoyIso, obra.fecha_inicio);

  const titulo =
    periodo === ANUAL
      ? "Año a año"
      : esUnAño
        ? `Mes a mes, ${periodo}`
        : "Mes a mes";

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="flujo" />}
    >
      <ObraHeader obra={obra} activeSection="flujo" ocultarNav />

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
          <p style={ui.label}>Egresos{esUnAño && ` ${periodo}`}</p>
          <h3 style={ui.statNumber}>{formatMoney(totalGastado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Ingresos a la cuenta{esUnAño && ` ${periodo}`}</p>
          <h3 style={ui.statNumber}>{formatMoney(totalIngresado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Promedio por mes</p>
          <h3 style={ui.statNumber}>{formatMoney(promedio)}</h3>
        </div>
      </section>

      <section style={ui.panelConMargen}>
        <div style={ui.toolbar}>
          <h3 style={{ ...ui.sectionTitle, margin: 0 }}>{titulo}</h3>

          {/* Con un solo año, "toda la obra" y ese año son el mismo gráfico y
              el año a año sería una sola barra: el selector no tiene nada que
              elegir. */}
          {años.length > 1 && (
            <nav style={selector}>
              <Link
                href={`/obras/${obra.slug}/flujo`}
                style={periodo === TODO ? opcionActiva : opcion}
              >
                Toda la obra
              </Link>
              {años.map((año) => (
                <Link
                  key={año}
                  href={`/obras/${obra.slug}/flujo?periodo=${año}`}
                  style={periodo === año ? opcionActiva : opcion}
                >
                  {año}
                </Link>
              ))}
              <Link
                href={`/obras/${obra.slug}/flujo?periodo=${ANUAL}`}
                style={periodo === ANUAL ? opcionActiva : opcion}
              >
                Año a año
              </Link>
            </nav>
          )}
        </div>

        {puntos.length === 0 ? (
          <p style={ui.vacio}>
            Todavía no hay gastos ni ingresos cargados en esta obra. Cargá el
            primero en{" "}
            <Link href={`/obras/${obra.slug}/gastos`} style={enlace}>
              Gastos
            </Link>
            .
          </p>
        ) : (
          <>
            <GraficoBarras
              datos={puntos}
              series={[
                { nombre: "Egresos", color: "#111827" },
                { nombre: "Ingresos a la cuenta", color: "#93b8e8" },
              ]}
              formato={formatMoney}
              formatoEje={formatMoneyEje}
            />

            <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
              {hayMarcaDeArranque && (
                <>
                  A la izquierda del arranque no hay obra: son acopios de
                  material, anticipos e impuestos del terreno, que se vienen
                  pagando desde antes de empezar.{" "}
                </>
              )}
              Los ingresos son lo que entró a la cuenta de la obra; muchos
              egresos los paga una socia de su bolsillo sin pasar por ahí, así
              que las dos columnas no se restan entre sí.
            </p>
          </>
        )}
      </section>
    </AppShell>
  );
}

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};

// El selector de período, con la forma del segundo nivel de solapas de la obra
// (ver MaterialesNav): texto gris, y el elegido en negro y subrayado.
const selector = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "20px",
};

const opcion = {
  color: "#777777",
  textDecoration: "none",
  fontSize: "14px",
  paddingBottom: "4px",
  borderBottom: "2px solid transparent",
};

const opcionActiva = {
  ...opcion,
  color: "#111111",
  borderBottom: "2px solid #111111",
};
