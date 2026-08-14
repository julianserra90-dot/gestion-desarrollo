/**
 * Los meses en texto, sin nada de base de datos: los comparten la solapa Flujo
 * y el detalle de un mes.
 *
 * La clave de un mes es `"2026-07"` —los primeros siete caracteres de la fecha
 * de Postgres—, así que ordena sola alfabéticamente y sirve de segmento de URL
 * sin escapar nada.
 */

const CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function esClaveDeMes(clave: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(clave);
}

/** "2026-07" a "jul 26", para el eje del gráfico. */
export function etiquetaMes(clave: string) {
  const [year, mes] = clave.split("-");
  return `${CORTOS[Number(mes) - 1]} ${year.slice(2)}`;
}

/** "2026-07" a "julio de 2026", para el título de una pantalla. */
export function nombreMes(clave: string) {
  const [year, mes] = clave.split("-");
  return `${LARGOS[Number(mes) - 1]} de ${year}`;
}

/**
 * De qué fecha a qué fecha va un mes, para filtrar en la base.
 *
 * `hasta` es el **primer día del mes siguiente** y se consulta con `lt`, no con
 * `lte`: así no hay que saber si el mes tiene 28, 30 o 31 días.
 *
 * Se hace con un rango y no con un `like "2026-05-%"` porque `fecha` es una
 * columna `date`, no texto: el `like` no filtra nada y la consulta vuelve vacía
 * sin dar error.
 */
export function rangoDeMes(clave: string) {
  const [year, mes] = clave.split("-").map(Number);
  const siguiente =
    mes === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mes + 1).padStart(2, "0")}-01`;

  return { desde: `${clave}-01`, hasta: siguiente };
}

/**
 * Todos los meses entre el primero y el último, incluso los vacíos: un mes sin
 * movimiento es información —la obra estuvo parada— y saltearlo deformaría el
 * gráfico.
 */
export function mesesEntre(desde: string, hasta: string) {
  const claves: string[] = [];
  let [year, mes] = desde.split("-").map(Number);
  const [yearFin, mesFin] = hasta.split("-").map(Number);

  while (year < yearFin || (year === yearFin && mes <= mesFin)) {
    claves.push(`${year}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      year += 1;
    }
  }

  return claves;
}
