/**
 * Los colores con los que se dibujan los rubros, sin nada de base de datos.
 *
 * Estaban adentro de `GraficoTorta`, pero el gráfico de barras del flujo también
 * pinta rubros y los dos tienen que hablar el mismo idioma: si albañilería es
 * azul en un lado, tiene que serlo en el otro.
 *
 * El orden importa: cada gráfico va tomando colores de la lista según el orden
 * en que le llegan los rubros. Los primeros son los más contrastados entre sí,
 * porque son los que más se van a usar.
 */

export const PALETA_RUBROS = [
  "#111827",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#6b7280",
];

/**
 * A cada rubro su color, en el orden en que vienen. Quien llama decide ese
 * orden —hoy, de mayor a menor gasto— y de ahí sale qué color le toca a cada
 * uno; con más rubros que colores, la paleta vuelve a empezar.
 */
export function coloresPorRubro(nombres: string[]) {
  return new Map(
    nombres.map((nombre, i) => [
      nombre,
      PALETA_RUBROS[i % PALETA_RUBROS.length],
    ])
  );
}
