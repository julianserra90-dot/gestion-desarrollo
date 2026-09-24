/**
 * Las cuentas de una prefactibilidad. Puro: sin base ni React, para que la
 * ficha en el servidor y el formulario en el navegador saquen los mismos
 * números, y para poder probarlas contra lotes de prefactibilidad conocida
 * sin levantar nada.
 *
 * Primera aproximación, con las simplificaciones del alcance inicial: lote
 * regular entre medianeras, un solo cuerpo, sin patios ni retiros laterales.
 * Lo que no se pueda calcular por falta de un dato da `null`, no cero: cero
 * se leería como "no se puede construir".
 */

export type DatosLote = {
  ancho_m: number | null;
  profundidad_m: number | null;
  superficie_m2: number | null;
  valor_terreno: number | null;
  lfi_m: number | null;
  retiro_frente_m: number | null;
  plantas_sobre_pb: number | null;
  /** La huella construible según la Ciudad; cuando está, manda. */
  sup_edificable_planta_m2: number | null;
};

/**
 * Las unidades de edificabilidad del Código Urbanístico, por su altura
 * máxima: el nombre y las plantas que entran sobre la planta baja. Ciudad 3D
 * informa la altura y no el nombre; los nombres son la misma tabla que usa
 * el propio Ciudad 3D (github.com/gcba/Ciudad-3D,
 * `utils/unidadesEdificabilidad.js`). Las plantas son las del Código, no una
 * división por una altura de piso: 14,6 m son PB + 4, no PB + 3 —lo confirmó
 * el estudio a mano de Andonaegui 1229—.
 */
const UNIDADES_POR_ALTURA: Record<string, { nombre: string; plantasSobrePb: number }> = {
  "9": { nombre: "U.S.A.B 0", plantasSobrePb: 2 },
  "12": { nombre: "U.S.A.B 1", plantasSobrePb: 3 },
  "14.6": { nombre: "U.S.A.B 2", plantasSobrePb: 4 },
  "17.2": { nombre: "U.S.A.M", plantasSobrePb: 5 },
  "22.8": { nombre: "U.S.A.A", plantasSobrePb: 7 },
  "31.2": { nombre: "Corredor Medio", plantasSobrePb: 10 },
  "38": { nombre: "Corredor Alto", plantasSobrePb: 12 },
};

/**
 * Para una altura que no es la de una unidad (un enrase, un área especial):
 * planta baja de 3,4 m y pisos de 2,8 m, redondeando al más cercano. Con
 * estos dos números la cuenta reproduce la tabla de arriba entera.
 */
export const ALTURA_PB_M = 3.4;
export const ALTURA_PISO_M = 2.8;

export function nombreUnidadEdificabilidad(alturaM: number | null): string | null {
  if (alturaM === null || alturaM <= 0) return null;
  return UNIDADES_POR_ALTURA[String(alturaM)]?.nombre ?? null;
}

/** Plantas sobre la planta baja que entran en la altura máxima. */
export function plantasSobrePbEstimadas(alturaMaximaM: number | null): number | null {
  if (alturaMaximaM === null || alturaMaximaM <= 0) return null;
  const unidad = UNIDADES_POR_ALTURA[String(alturaMaximaM)];
  if (unidad) return unidad.plantasSobrePb;
  return Math.max(0, Math.round((alturaMaximaM - ALTURA_PB_M) / ALTURA_PISO_M));
}

/** La cargada si está; si no, ancho × profundidad. */
export function superficieLote(d: DatosLote): number | null {
  if (d.superficie_m2) return d.superficie_m2;
  if (d.ancho_m && d.profundidad_m) return redondear(d.ancho_m * d.profundidad_m);
  return null;
}

/**
 * Hasta dónde se puede construir desde la Línea Oficial: la LFI si el lote la
 * pasa, el fondo del lote si no llega, y menos el retiro de frente si lo hay.
 */
export function profundidadEdificable(d: DatosLote): number | null {
  if (!d.profundidad_m) return null;
  const hastaLfi = d.lfi_m ? Math.min(d.profundidad_m, d.lfi_m) : d.profundidad_m;
  const util = hastaLfi - (d.retiro_frente_m ?? 0);
  return util > 0 ? redondear(util) : 0;
}

/**
 * La huella de cada planta. Si la Ciudad la calculó, es esa: ya tiene la LFI
 * y la LIB resueltas sobre la forma real de la parcela. Si no, frente por
 * profundidad edificable.
 */
export function areaEdificablePlanta(d: DatosLote): number | null {
  if (d.sup_edificable_planta_m2) return d.sup_edificable_planta_m2;
  const profundidad = profundidadEdificable(d);
  if (!d.ancho_m || profundidad === null) return null;
  return redondear(d.ancho_m * profundidad);
}

/** Área edificable por planta baja más las plantas sobre ella. */
export function superficieConstruible(d: DatosLote): number | null {
  const area = areaEdificablePlanta(d);
  if (area === null || d.plantas_sobre_pb === null) return null;
  return redondear(area * (d.plantas_sobre_pb + 1));
}

/** Cuánto cuesta el terreno por metro cuadrado de lote. */
export function incidenciaPorM2Lote(d: DatosLote): number | null {
  const superficie = superficieLote(d);
  if (!superficie || d.valor_terreno === null) return null;
  return redondear(d.valor_terreno / superficie);
}

/**
 * Cuánto cuesta el terreno por metro cuadrado construible: es el número que
 * se compara entre lotes, porque un lote caro con mucha altura puede rendir
 * más que uno barato donde entran dos plantas.
 */
export function incidenciaPorM2Construible(d: DatosLote): number | null {
  const construible = superficieConstruible(d);
  if (!construible || d.valor_terreno === null) return null;
  return redondear(d.valor_terreno / construible);
}

export function resumenLote(d: DatosLote) {
  return {
    superficieLote: superficieLote(d),
    profundidadEdificable: profundidadEdificable(d),
    areaEdificablePlanta: areaEdificablePlanta(d),
    superficieConstruible: superficieConstruible(d),
    incidenciaLote: incidenciaPorM2Lote(d),
    incidenciaConstruible: incidenciaPorM2Construible(d),
  };
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}
