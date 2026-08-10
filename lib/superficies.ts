/**
 * Las superficies de una obra: construcción y venta, las dos a mano.
 *
 * Sin base de datos: lo usan el servidor y los formularios por igual.
 *
 * Son dos números distintos y no se derivan uno del otro. La de construcción es
 * lo que se levanta (con los muros); la de venta es la neta, vendible de las
 * unidades. Un depto vende 35 m² y se construye 36. Con estas dos —más la
 * superficie del lote— salen la incidencia y los valores por m².
 */

/** Los campos de superficie tal como vienen de la obra. */
export type CamposSuperficie = {
  sup_construccion_m2: number | null;
  sup_venta_m2: number | null;
};

const positivo = (v: number | null | undefined): number | null => {
  const n = Number(v ?? 0);
  return n > 0 ? n : null;
};

/** Lo que se construye. Null si no se cargó. */
export function superficieConstruccion(o: CamposSuperficie): number | null {
  return positivo(o.sup_construccion_m2);
}

/** La neta vendible. Null si no se cargó. */
export function superficieVenta(o: CamposSuperficie): number | null {
  return positivo(o.sup_venta_m2);
}
