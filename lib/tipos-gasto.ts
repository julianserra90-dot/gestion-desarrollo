/**
 * Los tipos de gasto en el orden en que se leen, sin nada de base de datos.
 *
 * Los comparten Economía, Dólares y el detalle de un rubro: las tres muestran
 * lo mismo separado igual, y hasta ahora cada una repetía la lista.
 *
 * "Ajuste de saldo" queda afuera a propósito: es un movimiento entre socias, no
 * una compra. Igual, cuando aparece en el desglose de un rubro cae al final en
 * vez de desaparecer, porque suma al total de ese rubro lo mismo.
 */

export const TIPOS_DE_GASTO = [
  "Materiales",
  "Mano de obra",
  "Mano de obra y materiales",
  "Administrativo",
];

export type ParteDeRubro = {
  etiqueta: string;
  valor: number;
};

/** El desglose de un rubro por tipo, ordenado como se lee. */
export function ordenarPorTipo(porTipo: Map<string, number>): ParteDeRubro[] {
  const posicion = (tipo: string) => {
    const i = TIPOS_DE_GASTO.indexOf(tipo);
    return i < 0 ? TIPOS_DE_GASTO.length : i;
  };

  return [...porTipo.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => posicion(a.etiqueta) - posicion(b.etiqueta));
}
