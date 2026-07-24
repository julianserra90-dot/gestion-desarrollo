/**
 * El plazo de una obra: cuánto lleva, cuánto queda, y si el avance físico va a
 * la par del calendario.
 *
 * Sin base de datos: lo usan el servidor y los formularios por igual.
 *
 * El cruce entre avance y tiempo es el que dice algo. Un 40% de obra no
 * significa nada solo; con el 30% del plazo consumido va bien, y con el 70%
 * consumido la obra está en problemas.
 */

/** Los días desde la época, tomando la fecha como día calendario y no como instante. */
function enDias(iso: string): number {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia) / 86_400_000;
}

export type Plazo = {
  /** Días entre inicio y fin estimado. Null si falta alguna fecha. */
  totales: number | null;
  /** Días desde el inicio hasta hoy. Negativo si todavía no arrancó. */
  transcurridos: number | null;
  /** Días hasta el fin estimado. Negativo si ya se pasó. */
  restantes: number | null;
  /** Qué porcentaje del plazo se consumió. Puede pasar de 100. */
  consumido: number | null;
  /**
   * Avance menos tiempo consumido. Positivo va adelantado, negativo atrasado.
   * Null si no hay plazo con qué comparar.
   */
  desvio: number | null;
  /** Si ya pasó la fecha de fin estimada. */
  vencida: boolean;
  /** Si todavía no llegó la fecha de inicio. */
  porArrancar: boolean;
};

export function calcularPlazo(
  inicio: string | null,
  fin: string | null,
  avance: number,
  hoy: string
): Plazo {
  const hoyD = enDias(hoy);
  const inicioD = inicio ? enDias(inicio) : null;
  const finD = fin ? enDias(fin) : null;

  const transcurridos = inicioD === null ? null : hoyD - inicioD;
  const restantes = finD === null ? null : finD - hoyD;

  const totales =
    inicioD === null || finD === null ? null : Math.max(finD - inicioD, 0);

  // Con plazo de cero días —inicio y fin el mismo día— no hay proporción que
  // calcular, así que se lo trata como sin plazo.
  const consumido =
    totales === null || totales === 0 || transcurridos === null
      ? null
      : Math.round((transcurridos / totales) * 100);

  return {
    totales,
    transcurridos,
    restantes,
    consumido,
    desvio: consumido === null ? null : avance - consumido,
    vencida: restantes !== null && restantes < 0,
    porArrancar: transcurridos !== null && transcurridos < 0,
  };
}

/** Cómo se lee el desvío en una frase. */
export function leerDesvio(desvio: number | null): string | null {
  if (desvio === null) return null;

  // Cinco puntos de diferencia es ruido: el avance se carga a ojo y el
  // calendario no se mueve en bloques tan finos.
  if (Math.abs(desvio) <= 5) return "En línea con el calendario";

  return desvio > 0
    ? `Adelantado ${desvio} puntos sobre el calendario`
    : `Atrasado ${Math.abs(desvio)} puntos respecto del calendario`;
}
