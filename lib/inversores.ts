/**
 * La agenda de inversores y compradores de una obra.
 *
 * SÓLO SERVIDOR: lee de la base.
 *
 * Contesta una sola pregunta: por cuánto firmó cada uno y cuánto le falta
 * poner. Los dos lados **no se mezclan**, igual que en la cuenta de la obra:
 * quien firmó por US$ 100.000 los debe en dólares, y aportar pesos no le baja
 * esa deuda. Por eso todo viene por duplicado —`ars` y `usd`— y en ningún lado
 * se convierte de una moneda a la otra.
 */

import { createClient } from "@/lib/supabase/server";

export type Inversor = {
  id: string;
  tipo: string;
  nombre: string;
  apellido: string | null;
  /** Nombre y apellido ya unidos, que es como se muestra siempre. */
  nombreCompleto: string;
  observaciones: string | null;
  comprometidoArs: number;
  comprometidoUsd: number;
  aportadoArs: number;
  aportadoUsd: number;
  /** Lo que falta poner. Nunca negativo: si puso de más, es cero. */
  restaArs: number;
  restaUsd: number;
  /** Sin compromiso cargado no hay saldo que calcular, y se dice. */
  sinCompromiso: boolean;
  aportes: number;
};

export const TIPOS = ["Inversor", "Comprador"];

export function nombreCompleto(nombre: string, apellido: string | null) {
  return [nombre, apellido].filter(Boolean).join(" ");
}

/**
 * La agenda entera con lo aportado por cada uno.
 *
 * Los aportes se leen de los ingresos que cuelgan de cada ficha. Un ingreso en
 * dólares suma del lado de los dólares y no toca el de los pesos, aunque en la
 * base tenga además su valuación en pesos: esa valuación existe para el balance
 * entre socias, no para descontar una deuda que se firmó en otra moneda.
 */
export async function getInversores(obraId: string): Promise<Inversor[]> {
  const supabase = await createClient();

  const [{ data: fichas }, { data: aportes }] = await Promise.all([
    supabase
      .from("inversores")
      .select(
        "id, tipo, nombre, apellido, comprometido_ars, comprometido_usd, observaciones"
      )
      .eq("obra_id", obraId),
    supabase
      .from("ingresos")
      .select("inversor_id, moneda, monto, monto_usd")
      .eq("obra_id", obraId)
      .not("inversor_id", "is", null),
  ]);

  const puesto = new Map<string, { ars: number; usd: number; cuantos: number }>();

  for (const a of aportes ?? []) {
    if (!a.inversor_id) continue;

    const acumulado = puesto.get(a.inversor_id) ?? { ars: 0, usd: 0, cuantos: 0 };
    const esUsd = a.moneda === "USD";

    acumulado.ars += esUsd ? 0 : Number(a.monto);
    acumulado.usd += esUsd ? Number(a.monto_usd ?? 0) : 0;
    acumulado.cuantos += 1;

    puesto.set(a.inversor_id, acumulado);
  }

  return (fichas ?? [])
    .map((f) => {
      const suyo = puesto.get(f.id) ?? { ars: 0, usd: 0, cuantos: 0 };
      const comprometidoArs = Number(f.comprometido_ars ?? 0);
      const comprometidoUsd = Number(f.comprometido_usd ?? 0);

      return {
        id: f.id,
        tipo: f.tipo,
        nombre: f.nombre,
        apellido: f.apellido,
        nombreCompleto: nombreCompleto(f.nombre, f.apellido),
        observaciones: f.observaciones,
        comprometidoArs,
        comprometidoUsd,
        aportadoArs: suyo.ars,
        aportadoUsd: suyo.usd,
        // Poner de más no es una deuda negativa: es que ya está saldado. El
        // excedente se ve igual comparando aportado contra comprometido.
        restaArs: Math.max(0, comprometidoArs - suyo.ars),
        restaUsd: Math.max(0, comprometidoUsd - suyo.usd),
        sinCompromiso: comprometidoArs === 0 && comprometidoUsd === 0,
        aportes: suyo.cuantos,
      };
    })
    .sort(
      (a, b) =>
        a.tipo.localeCompare(b.tipo) ||
        a.nombreCompleto.localeCompare(b.nombreCompleto)
    );
}

/** Una ficha sola, para su pantalla de edición. */
export async function getInversor(obraId: string, inversorId: string) {
  const todos = await getInversores(obraId);
  return todos.find((i) => i.id === inversorId) ?? null;
}
