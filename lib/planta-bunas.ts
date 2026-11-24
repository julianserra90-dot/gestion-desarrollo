/**
 * La buña del cielorraso: por dónde pasa la línea, cuánto mide y cómo se la
 * corre.
 *
 * Es un anillo. Mientras nadie lo toque **no se guarda**: es el contorno del
 * ambiente, y lo sigue si después se corre un muro. En cuanto se corre uno de
 * sus lados —o se apaga— se queda con sus propios puntos y desde ahí es suyo,
 * aunque el ambiente cambie.
 *
 * Que recién ahí se guarde es lo que evita el problema de los índices: con el
 * anillo propio, agregarle un punto al contorno del ambiente no corre de lugar
 * ningún lado de la buña, porque ya no salen de ahí.
 *
 * Sin React y sin base: lo usan el editor y la medición.
 */

import { type Ambiente, type Punto, distancia } from "@/lib/planta-dibujo";

/** Un punto del anillo y si el lado que **arranca** en él lleva buña. */
export type VerticeDeBuna = { x: number; y: number; lleva: boolean };

export type LadoDeBuna = {
  a: Punto;
  b: Punto;
  lleva: boolean;
  /** Su lugar en el anillo: el lado k va del punto k al siguiente. */
  indice: number;
};

/**
 * Hasta dónde llega el cielorraso de un ambiente: su contorno propio, o el del
 * ambiente entero mientras no se le haya dibujado uno.
 */
export function contornoDeCielorraso(
  ambiente: Pick<Ambiente, "puntos" | "contornoCielorraso">
): Punto[] {
  return ambiente.contornoCielorraso ?? ambiente.puntos;
}

/**
 * El anillo de la buña de un ambiente: el suyo, o **el borde del cielorraso**
 * entero. Sale de ahí y no del ambiente porque la buña es el remate de ese
 * borde: corrido el cielorraso por delante de un placard, la buña lo sigue
 * sola. Sin buña, vacío.
 */
export function anilloDeBuna(
  ambiente: Pick<Ambiente, "puntos" | "contornoCielorraso" | "buna">
): VerticeDeBuna[] {
  if (!ambiente.buna) return [];
  return (
    ambiente.buna.anillo ??
    contornoDeCielorraso(ambiente).map((p) => ({ x: p.x, y: p.y, lleva: true }))
  );
}

/** Los lados del anillo, cada uno de su punto al siguiente. */
export function ladosDeBuna(anillo: VerticeDeBuna[]): LadoDeBuna[] {
  if (anillo.length < 3) return [];
  return anillo.map((p, i) => ({
    a: { x: p.x, y: p.y },
    b: { x: anillo[(i + 1) % anillo.length].x, y: anillo[(i + 1) % anillo.length].y },
    lleva: p.lleva,
    indice: i,
  }));
}

/** Cuánto mide, en metros: sólo los lados que llevan buña. */
export function largoDeBuna(anillo: VerticeDeBuna[], mpp: number): number {
  return ladosDeBuna(anillo)
    .filter((l) => l.lleva)
    .reduce((t, l) => t + distancia(l.a, l.b) * mpp, 0);
}

/** Prende o apaga un lado. El anillo pasa a ser propio: lo apagado no está en
 *  el contorno del ambiente y no se puede derivar de él. */
export function conLadoCambiado(anillo: VerticeDeBuna[], indice: number): VerticeDeBuna[] {
  return anillo.map((p, i) => (i === indice ? { ...p, lleva: !p.lleva } : p));
}

/**
 * El anillo después de correr uno de sus lados, con cada lado quedándose con
 * lo suyo.
 *
 * `lleva` es lo que llevaba cada lado **al agarrarlo**, no lo que lleva ahora:
 * el anillo se recalcula desde el de antes en cada movida del puntero, así que
 * el de ahora ya puede tener los puntos de la movida anterior.
 *
 * `movido` es lo que devuelve `moverLado`: los puntos nuevos y, por cada uno,
 * de qué punto del anillo viejo sale. Correr un lado puede **agregar** puntos
 * —el escalón que queda cuando el vecino seguía en la misma línea—, y ahí los
 * dos puntos nuevos salen del mismo viejo: ese pedazo es parte del lado que se
 * corrió y lleva lo que lleve él.
 */
export function anilloCorrido(
  lleva: boolean[],
  indice: number,
  movido: { puntos: Punto[]; origen: number[] }
): VerticeDeBuna[] {
  const n = movido.puntos.length;
  const delCorrido = lleva[indice] ?? true;
  return movido.puntos.map((p, k) => {
    const deAca = movido.origen[k];
    const delQueSigue = movido.origen[(k + 1) % n];
    return {
      x: p.x,
      y: p.y,
      lleva: deAca === delQueSigue ? delCorrido : lleva[deAca] ?? true,
    };
  });
}

/** El anillo con uno de sus puntos en otro lado: mover una esquina no cambia
 *  qué lado lleva buña y cuál no. */
export function conPuntoMovido(
  anillo: VerticeDeBuna[],
  indice: number,
  donde: Punto
): VerticeDeBuna[] {
  return anillo.map((p, i) => (i === indice ? { ...p, x: donde.x, y: donde.y } : p));
}
