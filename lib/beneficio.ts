/**
 * El beneficio estimado de un desarrollo: lo que se espera vender contra lo
 * que se espera gastar.
 *
 * Sin base de datos: son cuentas sobre números que ya vienen calculados.
 *
 * Todo en dólares, como el resto del negocio inmobiliario. El costo son las
 * dos patas que se pagan de verdad: la obra —el objetivo por m² llevado a toda
 * la superficie de construcción— y el terreno. La venta sale del valor por m²
 * **vendible**, que es lo que se cobra.
 *
 * El costo de obra se mide contra el **objetivo**, no contra lo cotizado ni lo
 * gastado, y es a propósito: es el número con el que se decidió arrancar, está
 * completo desde el día uno y no se mueve. Lo aprobado hoy cubre sólo la mano
 * de obra —casi ningún material se cotiza— y lo gastado sube mientras la obra
 * avanza; con cualquiera de los dos el beneficio saldría inflado.
 */

export type Beneficio = {
  /** Lo que se espera cobrar: valor por m² vendible por la superficie de venta. */
  ventaUsd: number;
  /** El objetivo por m² llevado a toda la superficie de construcción. */
  costoObraUsd: number;
  /** El terreno: lo pactado más los gastos de la operación. */
  costoTerrenoUsd: number;
  costoTotalUsd: number;
  /** Venta menos costo. Negativo es que el negocio no cierra. */
  beneficioUsd: number;
  /**
   * Cuánto de la venta queda como beneficio, en porcentaje. Sobre la venta y
   * no sobre el costo porque así se habla de un desarrollo: "deja un 30%" es
   * del precio de venta.
   */
  margen: number;
};

export function calcularBeneficio({
  valorVentaM2Usd,
  supVentaM2,
  objetivoM2Usd,
  supConstruccionM2,
  costoTerrenoUsd,
}: {
  valorVentaM2Usd: number | null;
  supVentaM2: number | null;
  objetivoM2Usd: number | null;
  supConstruccionM2: number | null;
  costoTerrenoUsd: number;
}): Beneficio | null {
  // Con cualquiera de las cuatro patas en falta el número no se puede armar, y
  // media cuenta es peor que ninguna: la pantalla dice qué hay que cargar.
  if (
    !valorVentaM2Usd ||
    !supVentaM2 ||
    !objetivoM2Usd ||
    !supConstruccionM2 ||
    valorVentaM2Usd <= 0 ||
    supVentaM2 <= 0 ||
    objetivoM2Usd <= 0 ||
    supConstruccionM2 <= 0
  ) {
    return null;
  }

  const ventaUsd = valorVentaM2Usd * supVentaM2;
  const costoObraUsd = objetivoM2Usd * supConstruccionM2;
  const costoTotalUsd = costoObraUsd + costoTerrenoUsd;
  const beneficioUsd = ventaUsd - costoTotalUsd;

  return {
    ventaUsd,
    costoObraUsd,
    costoTerrenoUsd,
    costoTotalUsd,
    beneficioUsd,
    margen: Math.round((beneficioUsd / ventaUsd) * 100),
  };
}
