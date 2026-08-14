import Link from "next/link";
import AppShell from "@/components/AppShell";
import GraficoBarras from "@/components/GraficoBarras";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatMoney, formatMoneyEje } from "@/lib/format";
import { etiquetaMes, mesesEntre } from "@/lib/meses";
import { getObraPorSlug } from "@/lib/obras";
import { semanaDeObra } from "@/lib/semanas";
import { createClient } from "@/lib/supabase/server";

/**
 * El flujo de la obra: cuánto salió y cuánto entró, mes a mes.
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
 * Los ingresos son lo que entró a la cuenta, y muchos gastos los paga una socia
 * de su bolsillo sin pasar por ahí: las dos series conviven en el gráfico pero
 * **no se restan entre sí**. Por eso acá no hay "resultado del mes".
 */

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

  // El mes en que arrancó la obra, para marcarlo en el gráfico. Sólo si quedó
  // algún mes antes: una línea pegada al borde izquierdo no separa nada, y lo
  // que la marca explica es justamente que a la izquierda hay movimientos que
  // no son obra —acopios, anticipos, impuestos del terreno—, que a veces se
  // vienen pagando de mucho antes.
  const mesDeArranque = obra.fecha_inicio?.slice(0, 7) ?? null;
  const marcarArranque =
    mesDeArranque !== null &&
    claves.indexOf(mesDeArranque) > 0;

  const meses = claves.map((clave) => ({
    clave,
    etiqueta: etiquetaMes(clave),
    gastado: gastosPorMes.get(clave) ?? 0,
    ingresado: ingresosPorMes.get(clave) ?? 0,
    marca:
      marcarArranque && clave === mesDeArranque
        ? "Arranque de obra"
        : undefined,
  }));

  // El promedio se calcula sobre los meses que tuvieron gasto: dividir por los
  // meses parados lo hundiría y no diría nada del ritmo real de la obra.
  const mesesConGasto = meses.filter((m) => m.gastado > 0).length;
  const promedio = mesesConGasto > 0 ? totalGastado / mesesConGasto : 0;

  // La semana en curso, contada desde el arranque de la obra.
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const semanaActual = semanaDeObra(hoyIso, obra.fecha_inicio);

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
        <div style={ui.toolbar}>
          <h3 style={{ ...ui.sectionTitle, margin: 0 }}>Mes a mes</h3>
          <span style={ui.note}>Tocá un mes para ver su semana a semana.</span>
        </div>

        {meses.length === 0 ? (
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
            {/* Los meses vacíos no llevan enlace: entrar a un mes sin nada sería
                una pantalla en blanco. */}
            <GraficoBarras
              datos={meses.map((m) => ({
                etiqueta: m.etiqueta,
                valores: [m.gastado, m.ingresado],
                marca: m.marca,
                href:
                  m.gastado > 0 || m.ingresado > 0
                    ? `/obras/${obra.slug}/flujo/${m.clave}`
                    : undefined,
              }))}
              series={[
                { nombre: "Gastos", color: "#111827" },
                { nombre: "Ingresos a la cuenta", color: "#93b8e8" },
              ]}
              formato={formatMoney}
              formatoEje={formatMoneyEje}
            />

            <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
              {marcarArranque && (
                <>
                  A la izquierda del arranque no hay obra: son acopios de
                  material, anticipos e impuestos del terreno, que se vienen
                  pagando desde antes de empezar.{" "}
                </>
              )}
              Los ingresos son lo que entró a la cuenta de la obra; muchos gastos
              los paga una socia de su bolsillo sin pasar por ahí, así que las
              dos columnas no se restan entre sí.
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
