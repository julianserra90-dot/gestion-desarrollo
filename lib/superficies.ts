/**
 * Las superficies de una obra, calculadas a partir del desglose.
 *
 * Sin base de datos: lo usan el servidor y los formularios por igual.
 *
 * Se cargan tres superficies —cubierta, semicubierta, descubierta— y de ahí
 * salen dos totales según para qué se miren:
 *
 *   - construcción: todo lo que se levanta, al 100%. Manda para el costo de
 *     construir (un balcón cuesta construirlo aunque valga menos al venderse).
 *   - venta: ponderada. La semicubierta cuenta al coeficiente elegido (50% o
 *     100%) y la descubierta al suyo (0, 25 o 50%), porque un patio no se vende
 *     como metro cubierto.
 */

/** Los campos de superficie tal como vienen de la obra. */
export type CamposSuperficie = {
  sup_cubierta_m2: number | null;
  sup_semicubierta_m2: number | null;
  sup_descubierta_m2: number | null;
  coef_semicubierta: number | null;
  coef_descubierta: number | null;
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

/** Todo lo que se construye, al 100%. Null si no se cargó nada. */
export function superficieConstruccion(o: CamposSuperficie): number | null {
  const total =
    n(o.sup_cubierta_m2) + n(o.sup_semicubierta_m2) + n(o.sup_descubierta_m2);
  return total > 0 ? total : null;
}

/** La superficie ponderada que se vende. Null si no se cargó nada. */
export function superficieVenta(o: CamposSuperficie): number | null {
  // Sin coeficiente cargado, los defaults de la base: semi 50%, descubierta 0%.
  const coefSemi = o.coef_semicubierta ?? 0.5;
  const coefDesc = o.coef_descubierta ?? 0;

  const total =
    n(o.sup_cubierta_m2) +
    n(o.sup_semicubierta_m2) * coefSemi +
    n(o.sup_descubierta_m2) * coefDesc;

  return total > 0 ? total : null;
}
