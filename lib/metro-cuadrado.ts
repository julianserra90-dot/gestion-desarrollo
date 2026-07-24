/**
 * El valor del metro cuadrado de una obra, en dólares.
 *
 * Sin base de datos: son cuentas sobre números que ya vienen calculados.
 *
 * En dólares y no en pesos porque así se decide una obra: se arranca diciendo
 * "esto tiene que dar 800 el metro" y contra ese número se mide todo. En pesos
 * la comparación no significa nada, porque el peso de febrero y el de noviembre
 * no son la misma unidad.
 */

export type ValorM2 = {
  /** El objetivo cargado al arrancar, en USD/m². */
  objetivo: number | null;
  /** Las cotizaciones aprobadas sobre la superficie. Null si todavía no hay. */
  aprobado: number | null;
  /** Lo gastado hasta hoy sobre la superficie. */
  gastado: number | null;
  /**
   * Lo que va a salir el m² si la obra sigue a este ritmo: se toma lo gastado,
   * se lo lleva al 100% según el avance, y recién ahí se divide.
   *
   * Es el único comparable contra el objetivo antes de terminar. El gastado por
   * m² siempre da bajo mientras falte obra, así que compararlo sería engañarse.
   */
  proyectado: number | null;
  /**
   * Cuánto más caro sale el metro que lo planeado, en dólares. Positivo es más
   * caro: objetivo 800 y proyectado 850 da 50.
   *
   * En dólares y no en porcentaje porque así se habla de una obra: "termina 50
   * dólares más caro el metro" se entiende de una, "termina 6% más caro" hay
   * que traducirlo.
   */
  desvioUsd: number | null;
  /**
   * Ese desvío llevado a toda la superficie: lo que la obra entera se pasa de
   * lo planeado. Es el número que le importa a las socias.
   */
  desvioTotal: number | null;
  /** El mismo desvío en porcentaje, para dimensionarlo. */
  desvioPorcentaje: number | null;
};

export function calcularValorM2({
  superficie,
  objetivoUsd,
  aprobadoUsd,
  gastadoUsd,
  avance,
}: {
  superficie: number | null;
  objetivoUsd: number | null;
  aprobadoUsd: number | null;
  gastadoUsd: number;
  avance: number;
}): ValorM2 {
  const vacio: ValorM2 = {
    objetivo: null,
    aprobado: null,
    gastado: null,
    proyectado: null,
    desvioUsd: null,
    desvioTotal: null,
    desvioPorcentaje: null,
  };

  if (!superficie || superficie <= 0) return vacio;

  const objetivo = objetivoUsd && objetivoUsd > 0 ? objetivoUsd : null;

  // Sin avance no hay ritmo del que proyectar: dividir por cero daría infinito,
  // y proyectar desde el 1% daría un número disparatado que nadie puede usar.
  const proyectado =
    avance > 0 ? gastadoUsd / (avance / 100) / superficie : null;

  const desvioUsd =
    objetivo && proyectado ? proyectado - objetivo : null;

  return {
    objetivo,
    aprobado:
      aprobadoUsd && aprobadoUsd > 0 ? aprobadoUsd / superficie : null,
    gastado: gastadoUsd / superficie,
    proyectado,
    desvioUsd,
    desvioTotal: desvioUsd === null ? null : desvioUsd * superficie,
    desvioPorcentaje:
      objetivo && desvioUsd !== null
        ? Math.round((desvioUsd / objetivo) * 100)
        : null,
  };
}

/**
 * El desvío en una frase, como se diría en obra: "termina 50 dólares más caro
 * el metro". Devuelve null si no hay con qué comparar.
 */
export function leerDesvioM2(m2: ValorM2): {
  texto: string;
  caro: boolean;
} | null {
  if (m2.desvioUsd === null || m2.desvioTotal === null) return null;

  const porMetro = Math.abs(Math.round(m2.desvioUsd));

  // Un dólar por metro no es un desvío, es redondeo.
  if (porMetro < 1) return { texto: "Va clavado al objetivo", caro: false };

  const caro = m2.desvioUsd > 0;

  return {
    texto: caro
      ? `Termina US$ ${porMetro} más caro el metro`
      : `Termina US$ ${porMetro} más barato el metro`,
    caro,
  };
}
