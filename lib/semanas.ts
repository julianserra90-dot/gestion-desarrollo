/**
 * En qué semana de obra cae una fecha.
 *
 * Puro, sin base: lo usan el listado de gastos y el formulario —los dos
 * corren en el cliente— y las pantallas de servidor. Mismo patrón que
 * `reparto.ts` o `lote-tipos.ts`.
 *
 * Las semanas se cuentan desde el **lunes de la semana en que arrancó la
 * obra**, no en bloques de siete días desde la fecha exacta de inicio. En obra
 * la semana es de lunes a domingo —"la semana 11" es una semana del
 * calendario, y a los contratistas se les paga el viernes—: contando desde un
 * inicio que cayó miércoles, el viernes siguiente caería en la semana 1 y el
 * lunes de ahí a dos días ya sería la 2, que no es como se habla en la obra.
 * Si la obra arrancó un miércoles, esos tres días son igual la semana 1.
 */

const DIA = 24 * 60 * 60 * 1000;

/**
 * "2026-07-17" a milisegundos UTC.
 *
 * Se parsea a mano por la misma razón que `formatDate`: `new Date("2026-07-17")`
 * es medianoche UTC y en Argentina (UTC-3) cae el día anterior — un gasto del
 * lunes contaría como la semana pasada.
 */
function aUtc(iso: string): number | null {
  const [year, mes, dia] = iso.split("-").map(Number);
  if (!year || !mes || !dia) return null;
  return Date.UTC(year, mes - 1, dia);
}

/** El lunes de esa semana. `getUTCDay` devuelve 0 para domingo. */
function lunesDe(ms: number): number {
  const dia = new Date(ms).getUTCDay();
  return ms - ((dia + 6) % 7) * DIA;
}

function aIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * El número de semana de obra de una fecha. Null si la obra no tiene inicio
 * cargado, o si la fecha es anterior al arranque: un anticipo pagado antes de
 * empezar no cae en ninguna semana, y "semana 0" o "semana −3" no significan
 * nada.
 */
export function semanaDeObra(
  fecha: string | null | undefined,
  inicio: string | null | undefined
): number | null {
  if (!fecha || !inicio) return null;

  const f = aUtc(fecha);
  const i = aUtc(inicio);
  if (f === null || i === null) return null;

  const dias = Math.floor((f - lunesDe(i)) / DIA);
  if (dias < 0) return null;

  return Math.floor(dias / 7) + 1;
}

/** De cuándo a cuándo va una semana de obra, para poder mostrarlo. */
export function rangoDeSemana(
  semana: number,
  inicio: string | null | undefined
): { desde: string; hasta: string } | null {
  if (!inicio || semana < 1) return null;

  const i = aUtc(inicio);
  if (i === null) return null;

  const desde = lunesDe(i) + (semana - 1) * 7 * DIA;
  return { desde: aIso(desde), hasta: aIso(desde + 6 * DIA) };
}
