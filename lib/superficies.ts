/**
 * Las superficies de una obra, calculadas a partir del desglose.
 *
 * Sin base de datos: lo usan el servidor y los formularios por igual.
 *
 * La construcción sale del desglose —cubierta, semicubierta, descubierta— con un
 * coeficiente por obra: la semicubierta cuenta al 50% o 100% y la descubierta al
 * 0/25/50%, para elegir cómo contemplar cada una en lo construido.
 *
 * La venta NO se deriva de eso: es la superficie neta, vendible de las unidades,
 * y se carga a mano. Un depto puede venderse como 35 m² y construirse 36 (los
 * muros suman en construcción y no en la venta), así que son datos distintos.
 */

/** Los campos de superficie tal como vienen de la obra. */
export type CamposSuperficie = {
  sup_cubierta_m2: number | null;
  sup_semicubierta_m2: number | null;
  sup_descubierta_m2: number | null;
  coef_semicubierta: number | null;
  coef_descubierta: number | null;
  sup_venta_m2: number | null;
};

/** Opciones de coeficiente que ofrece el formulario. */
export const COEF_SEMICUBIERTA = [
  { valor: 0.5, etiqueta: "50%" },
  { valor: 1, etiqueta: "100%" },
];

export const COEF_DESCUBIERTA = [
  { valor: 0, etiqueta: "0%" },
  { valor: 0.25, etiqueta: "25%" },
  { valor: 0.5, etiqueta: "50%" },
];

const n = (v: number | null | undefined) => Number(v ?? 0);

/**
 * Lo construido: cubierta al 100%, más la semicubierta y la descubierta al
 * coeficiente elegido. Null si no se cargó nada.
 */
export function superficieConstruccion(o: CamposSuperficie): number | null {
  // Sin coeficiente cargado, los defaults de la base: semi 50%, descubierta 0%.
  const coefSemi = o.coef_semicubierta ?? 0.5;
  const coefDesc = o.coef_descubierta ?? 0;

  const total =
    n(o.sup_cubierta_m2) +
    n(o.sup_semicubierta_m2) * coefSemi +
    n(o.sup_descubierta_m2) * coefDesc;

  return total > 0 ? total : null;
}

/** La superficie neta que se vende, cargada a mano. Null si no se cargó. */
export function superficieVenta(o: CamposSuperficie): number | null {
  const venta = n(o.sup_venta_m2);
  return venta > 0 ? venta : null;
}

/**
 * El mismo cálculo de construcción sobre números sueltos, para el vivo del
 * formulario (donde no hay una fila de obra todavía).
 */
export function construccionDe(
  cubierta: number,
  semicubierta: number,
  descubierta: number,
  coefSemi: number,
  coefDesc: number
): number {
  return cubierta + semicubierta * coefSemi + descubierta * coefDesc;
}
