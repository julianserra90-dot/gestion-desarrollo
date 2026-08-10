/**
 * Cómo se reparte el pago de un gasto entre la cuenta de la obra y una empresa.
 *
 * Es cálculo puro, sin base de datos, para que lo puedan usar tanto el
 * formulario en el navegador como el server action al guardar. Los dos tienen
 * que llegar al mismo número: lo que el formulario muestra es lo que se guarda.
 */

/** Redondeo a centavos, para que la resta de dos montos no arrastre binarios. */
export function centavos(valor: number) {
  return Math.round(valor * 100) / 100;
}

/**
 * Valor del desplegable "Empresa que pagó" cuando el gasto lo ponen todas las
 * socias en partes iguales. No es un id de empresa: al guardar se traduce a
 * `compartido` y la pagadora queda en null.
 */
export const GASTO_COMPARTIDO = "__todas__";

export type Reparto = {
  /** Pesos que salen de la cuenta. */
  ars: number;
  /** Dólares que salen de la cuenta. */
  usd: number;
  /** Lo que cuesta el gasto, en pesos. */
  total: number;
  /** Lo que la cuenta llegó a cubrir, en pesos. */
  cubierto: number;
  /** Lo que tiene que poner una empresa porque la cuenta no alcanzó. */
  deEmpresa: number;
};

/**
 * Reparte el pago entre la cuenta de la obra y una empresa.
 *
 * Lo que se carga es cuánto se quiere pagar con la cuenta, y eso define el
 * gasto. Si el saldo no llega, la cuenta pone todo lo que tiene y la diferencia
 * queda a cargo de una socia: no hay que calcularla a mano.
 *
 * El saldo se mira en el servidor al guardar, no sólo en el formulario, porque
 * entre que se abre la pantalla y se aprieta Guardar otro puede haber gastado
 * esa plata.
 */
export function repartirPago({
  pedidoArs,
  pedidoUsd,
  disponibleArs,
  disponibleUsd,
  cotizacion,
}: {
  pedidoArs: number;
  pedidoUsd: number;
  disponibleArs: number;
  disponibleUsd: number;
  /** Pesos por dólar con los que se valúan los dólares del gasto. */
  cotizacion: number | null;
}): Reparto {
  const pedidoA = Math.max(pedidoArs, 0);
  const pedidoU = Math.max(pedidoUsd, 0);
  const cambio = cotizacion ?? 0;

  // La cuenta pone lo que tiene, cada lado por separado.
  const ars = centavos(Math.min(pedidoA, Math.max(disponibleArs, 0)));
  const usd = centavos(Math.min(pedidoU, Math.max(disponibleUsd, 0)));

  const total = centavos(pedidoA + pedidoU * cambio);
  const cubierto = centavos(ars + usd * cambio);

  return {
    ars,
    usd,
    total,
    cubierto,
    deEmpresa: centavos(Math.max(total - cubierto, 0)),
  };
}
