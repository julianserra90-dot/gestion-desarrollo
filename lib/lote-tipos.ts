/**
 * Las categorías de un pago del lote, sin nada de base de datos: las comparten
 * el servidor (`lib/lote.ts`) y el formulario del cliente (`PagoLoteForm`).
 *
 * "Compra" abona el precio pactado; el resto son gastos de la operación
 * (escribanía, sellos, comisión) que van aparte del saldo.
 */

export const CATEGORIAS_LOTE = [
  "Compra",
  "Escribanía",
  "Sellos",
  "Comisión",
  "Otro",
] as const;

export type CategoriaLote = (typeof CATEGORIAS_LOTE)[number];

/** Las categorías que no son el precio en sí: gastos de la operación. */
export const CATEGORIAS_ASOCIADAS: readonly CategoriaLote[] = [
  "Escribanía",
  "Sellos",
  "Comisión",
  "Otro",
];

export function esCategoriaLote(valor: string): valor is CategoriaLote {
  return (CATEGORIAS_LOTE as readonly string[]).includes(valor);
}
