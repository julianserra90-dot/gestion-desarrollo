/**
 * Las capas dibujadas sobre las caras de los muros (`CapaDibujada`): dónde
 * cae cada una, cómo se apilan y qué forma tienen en la planta.
 *
 * Una capa es una lista de tramos de cara. Cada tramo se cruza con las caras
 * que de verdad quedan a la vista (`carasVisibles`): si después otro muro llega
 * contra esa cara, ese pedazo deja de tener capa sola. Lo que queda son las
 * **piezas**: un pedazo de capa sobre un pedazo de cara, entre dos alturas.
 *
 * Sin React y sin base: lo usan el editor, el cómputo y el 3D.
 */

import { recortar } from "@/lib/planta-estructura";
import {
  type Abertura,
  type CapaDibujada,
  type Dibujo,
  type Punto,
  type TramoDeCapa,
  distancia,
} from "@/lib/planta-dibujo";
import type { Cara } from "@/lib/planta-trazo";

export type PiezaDeCapa = {
  capa: CapaDibujada;
  /** En qué lugar de la pila va: el de su capa en la lista. */
  orden: number;
  /** De qué tramo de su capa sale, por su lugar en `capa.tramos`. */
  tramo: number;
  cara: Cara;
  /** Entre dónde y dónde a lo largo del muro, en las mismas medidas que
   *  `cara.desde` y `cara.hasta` (píxeles desde el primer punto marcado). */
  s0: number;
  s1: number;
  /** Entre qué alturas va, en metros sobre el piso. */
  abajo: number;
  arriba: number;
  /** A cuánto de la cara arranca —lo que ocupan las capas de abajo— y cuánto
   *  mide de espesor, en píxeles. */
  n0: number;
  grosor: number;
  /** La pieza en la planta: cuatro puntos, con las esquinas a inglete donde
   *  se encuentra con otra pieza de la misma capa. */
  puntos: Punto[];
};

/** Menos que esto, en metros, no es un tramo. */
const MINIMO = 0.001;

/**
 * Un tramo que termina a menos de esto, en metros, de donde termina la cara
 * llega hasta ahí: a mano, el rincón se marca sobre la cara terminada y no
 * sobre el ladrillo, y la capa quedaba unos centímetros corta.
 */
const CASI_EN_LA_PUNTA = 0.05;

/** El lado de una cara como lo dice un tramo: el canto, o el lado. */
function caraDe(cara: Cara): TramoDeCapa["cara"] {
  return cara.punta ?? cara.lado;
}

/** Hacia dónde avanza la cara y hacia dónde queda su afuera. */
function direcciones(cara: Cara) {
  const largo = cara.largo > 0 ? cara.largo : 1;
  const d = { x: (cara.b.x - cara.a.x) / largo, y: (cara.b.y - cara.a.y) / largo };
  // Un canto se arma con su afuera como normal, igual que una cara larga del
  // lado 1 (`carasVisibles`).
  const lado = cara.punta === null ? cara.lado : 1;
  return { d, n: { x: -d.y * lado, y: d.x * lado } };
}

/** Un punto sobre la cara: a `s` a lo largo y `n` hacia afuera. */
function enCara(cara: Cara, s: number, n: number): Punto {
  const { d, n: o } = direcciones(cara);
  return {
    x: cara.a.x + d.x * (s - cara.desde) + o.x * n,
    y: cara.a.y + d.y * (s - cara.desde) + o.y * n,
  };
}

/** Dónde se cruzan dos rectas (punto y dirección), o null si son paralelas. */
function cruce(p: Punto, dp: Punto, q: Punto, dq: Punto): Punto | null {
  const det = dp.x * dq.y - dp.y * dq.x;
  if (Math.abs(det) < 1e-9) return null;
  const t = ((q.x - p.x) * dq.y - (q.y - p.y) * dq.x) / det;
  return { x: p.x + dp.x * t, y: p.y + dp.y * t };
}

/**
 * Las piezas de todas las capas dibujadas, de la de abajo a la de arriba.
 *
 * `caras` son las caras a la vista de los muros (`carasVisibles`). La altura
 * de cada pieza sale de su capa, recortada a la del muro: "techo" es toda la
 * altura del muro, "cielorraso" la del cielorraso del ambiente al que da la
 * cara (la del muro si no tiene).
 *
 * Cada pieza se apoya sobre las de capas anteriores que tiene debajo —en la
 * misma cara, el mismo tramo y la misma franja de altura—: el porcelanato
 * sobre el revoque, y la pintura de arriba también sobre el revoque, no sobre
 * el porcelanato de abajo.
 */
export function piezasDeCapas(
  dibujo: Pick<Dibujo, "muros" | "ambientes" | "capas">,
  caras: Cara[],
  mpp: number | null,
  alturaDePlanta: number
): PiezaDeCapa[] {
  if (mpp === null || dibujo.capas.length === 0) return [];
  const muros = new Map(dibujo.muros.map((m) => [m.id, m] as const));
  const ambientes = new Map(dibujo.ambientes.map((a) => [a.id, a] as const));
  const minimo = MINIMO / mpp;
  const piezas: PiezaDeCapa[] = [];

  /** Las puntas de cada pieza que ya se unieron con otra. */
  const unidas = new Map<PiezaDeCapa, Set<0 | 1>>();
  dibujo.capas.forEach((capa, orden) => {
    const deLaCapa: PiezaDeCapa[] = [];
    capa.tramos.forEach((tramo, indiceDeTramo) => {
      const muro = muros.get(tramo.muroId);
      if (!muro) return;
      const largo = distancia(muro.a, muro.b);
      const alto = muro.altura ?? alturaDePlanta;
      for (const cara of caras) {
        if (cara.muroId !== tramo.muroId || caraDe(cara) !== tramo.cara) continue;
        // Un canto va entero; una cara larga, en lo que el tramo la cubre. Un
        // tramo que llega a la punta marcada del muro sigue hasta donde
        // termina la cara: en una esquina la cara va un poco más allá de los
        // puntos marcados, y sin esto la capa no llegaba al rincón ni hacía
        // su inglete con la del otro muro.
        // Lo mismo si termina a unos centímetros de donde termina la cara: se
        // la marcó a mano hasta el rincón —la cara terminada del otro muro, o
        // un poco antes— y tiene que dar la vuelta con la del otro, no quedar
        // escalonada.
        const casi = CASI_EN_LA_PUNTA / mpp;
        const hastaLaPuntaA = tramo.desde <= 1e-6 || tramo.desde * largo <= cara.desde + casi;
        const hastaLaPuntaB = tramo.hasta >= 1 - 1e-6 || tramo.hasta * largo >= cara.hasta - casi;
        const s0 =
          cara.punta !== null || hastaLaPuntaA ? cara.desde : Math.max(cara.desde, tramo.desde * largo);
        const s1 =
          cara.punta !== null || hastaLaPuntaB ? cara.hasta : Math.min(cara.hasta, tramo.hasta * largo);
        if (s1 - s0 < minimo) continue;

        const tope =
          capa.hasta === "techo"
            ? alto
            : capa.hasta === "cielorraso"
              ? (cara.ambienteId ? ambientes.get(cara.ambienteId)?.alturaCielorraso : null) ?? alto
              : capa.hasta;
        const arriba = Math.min(tope, alto);
        const abajo = Math.min(Math.max(capa.desde, 0), arriba);
        if (arriba - abajo < MINIMO) continue;

        // Sobre qué se apoya: lo más alto de las piezas de abajo que pisa.
        let n0 = 0;
        for (const otra of piezas) {
          if (otra.cara.muroId !== cara.muroId || caraDe(otra.cara) !== caraDe(cara)) continue;
          if (Math.min(otra.s1, s1) - Math.max(otra.s0, s0) < minimo) continue;
          if (Math.min(otra.arriba, arriba) - Math.max(otra.abajo, abajo) < MINIMO) continue;
          n0 = Math.max(n0, otra.n0 + otra.grosor);
        }
        const grosor = capa.espesor / mpp;
        deLaCapa.push({
          capa,
          orden,
          tramo: indiceDeTramo,
          cara,
          s0,
          s1,
          abajo,
          arriba,
          n0,
          grosor,
          puntos: [enCara(cara, s0, n0), enCara(cara, s1, n0), enCara(cara, s1, n0 + grosor), enCara(cara, s0, n0 + grosor)],
        });
      }
    });
    ingletes(deLaCapa, minimo, unidas, () => true);
    piezas.push(...deLaCapa);
  });
  // Después, las puntas que quedaron sueltas se unen con las de otra capa que
  // va a la misma profundidad y con el mismo espesor: el revoque de un lado y
  // el de la punta de un muro suelto, que son dos capas pero el mismo revoque.
  const parecidas = (p: PiezaDeCapa, q: PiezaDeCapa) =>
    Math.abs(p.n0 - q.n0) <= minimo && Math.abs(p.grosor - q.grosor) <= minimo;
  ingletes(piezas, minimo, unidas, parecidas);
  return piezas;
}

/**
 * Las esquinas a inglete: donde dos piezas terminan en el mismo punto de la
 * cara —el rincón de un ambiente, la esquina de afuera, la punta de un muro—,
 * cada una se corta en el cruce de sus bordes con los de la otra. Así la capa
 * da la vuelta como una sola polilínea, sin huecos afuera ni encimados
 * adentro.
 *
 * Cada punta se une una sola vez (`unidas`): primero con las de su misma
 * capa, y lo que queda suelto, con las que `pueden` unirse.
 */
function ingletes(
  piezas: PiezaDeCapa[],
  tolerancia: number,
  unidas: Map<PiezaDeCapa, Set<0 | 1>>,
  pueden: (p: PiezaDeCapa, q: PiezaDeCapa) => boolean
) {
  const suelta = (pieza: PiezaDeCapa, fin: 0 | 1) => !unidas.get(pieza)?.has(fin);
  const puntas = piezas.flatMap((pieza) =>
    ([0, 1] as const).map((fin) => ({
      pieza,
      fin,
      donde: enCara(pieza.cara, fin === 0 ? pieza.s0 : pieza.s1, 0),
    }))
  );
  for (let i = 0; i < puntas.length; i++) {
    for (let j = i + 1; j < puntas.length; j++) {
      const p = puntas[i];
      const q = puntas[j];
      if (p.pieza === q.pieza || distancia(p.donde, q.donde) > tolerancia * 5) continue;
      if (!suelta(p.pieza, p.fin) || !suelta(q.pieza, q.fin) || !pueden(p.pieza, q.pieza)) continue;
      const dp = direcciones(p.pieza.cara).d;
      const dq = direcciones(q.pieza.cara).d;
      const borde = (x: (typeof puntas)[number], n: number) =>
        enCara(x.pieza.cara, x.fin === 0 ? x.pieza.s0 : x.pieza.s1, n);
      const adentro = cruce(borde(p, p.pieza.n0), dp, borde(q, q.pieza.n0), dq);
      const afuera = cruce(
        borde(p, p.pieza.n0 + p.pieza.grosor),
        dp,
        borde(q, q.pieza.n0 + q.pieza.grosor),
        dq
      );
      if (!adentro || !afuera) continue;
      for (const x of [p, q]) {
        // Los puntos de la pieza: 0 y 3 son su principio, 1 y 2 su fin.
        if (x.fin === 0) {
          x.pieza.puntos[0] = adentro;
          x.pieza.puntos[3] = afuera;
        } else {
          x.pieza.puntos[1] = adentro;
          x.pieza.puntos[2] = afuera;
        }
        unidas.set(x.pieza, new Set([...(unidas.get(x.pieza) ?? []), x.fin]));
      }
    }
  }
}

/**
 * Cuánto mide una pieza a lo largo **por su línea media**, comparado con lo
 * que mide sobre la cara: con las esquinas a inglete, una capa de adentro es
 * más corta afuera que contra el muro, y una de afuera más larga. Medirla por
 * el medio es medir lo que de verdad ocupa: la pintura sobre el revoque mide
 * la cara terminada, y la superficie por el espesor da el volumen justo.
 */
export function proporcionAlLargo(pieza: PiezaDeCapa): number {
  const sobreLaCara = pieza.s1 - pieza.s0;
  if (!(sobreLaCara > 0)) return 1;
  const [a, b, c, d] = pieza.puntos;
  const medio = (distancia(a, b) + distancia(d, c)) / 2;
  return medio / sobreLaCara;
}

/**
 * Lo que se ve de una pieza en la planta: sin los vanos de las puertas y
 * ventanas de su muro que la cruzan **a su altura** —una puerta corta el
 * revoque de piso a techo, pero no el látex de 2,10 para arriba—. Es sólo el
 * dibujo: lo que hay arriba de la puerta, el dintel, se computa igual.
 *
 * Devuelve polígonos; en una capa sin espesor —una pintura—, pares de puntos.
 * Las puntas de la pieza conservan su inglete.
 */
export function trozosEnPlanta(
  pieza: PiezaDeCapa,
  aberturas: Abertura[],
  largoDelMuro: number,
  mpp: number
): Punto[][] {
  const { cara } = pieza;
  const linea = !(pieza.grosor > 0);
  const entera = linea ? [pieza.puntos[0], pieza.puntos[1]] : pieza.puntos;
  if (cara.punta !== null) return [entera];
  const huecos = aberturas
    .filter((ab) => ab.muroId === cara.muroId)
    .filter((ab) => {
      const abajo = ab.tipo === "ventana" ? ab.antepecho ?? 0 : 0;
      return Math.min(abajo + ab.alto, pieza.arriba) - Math.max(abajo, pieza.abajo) > 1e-6;
    })
    .map((ab): [number, number] => {
      const centro = ab.t * largoDelMuro;
      const medio = ab.ancho / mpp / 2;
      return [centro - medio, centro + medio];
    })
    .filter(([a, b]) => b > pieza.s0 && a < pieza.s1)
    .sort((x, y) => x[0] - y[0]);
  if (huecos.length === 0) return [entera];

  // Los tramos libres entre los vanos; los de las puntas, sin límite, para no
  // cortarles el inglete.
  const libres: [number, number][] = [];
  let desde = -Infinity;
  for (const [a, b] of huecos) {
    if (a > desde) libres.push([desde, a]);
    desde = Math.max(desde, b);
  }
  libres.push([desde, Infinity]);

  const trozos: Punto[][] = [];
  for (const [lo, hi] of libres) {
    const s0 = Math.max(lo, pieza.s0);
    const s1 = Math.min(hi, pieza.s1);
    if (s1 - s0 < 1e-6) continue;
    if (linea) {
      trozos.push([
        lo === -Infinity ? pieza.puntos[0] : enCara(cara, s0, pieza.n0),
        hi === Infinity ? pieza.puntos[1] : enCara(cara, s1, pieza.n0),
      ]);
      continue;
    }
    const a = lo === -Infinity ? -1e9 : lo;
    const b = hi === Infinity ? 1e9 : hi;
    const franja = [enCara(cara, a, -1e9), enCara(cara, b, -1e9), enCara(cara, b, 1e9), enCara(cara, a, 1e9)];
    const trozo = recortar(pieza.puntos, franja);
    if (trozo.length >= 3) trozos.push(trozo);
  }
  return trozos;
}

/** Una cara como tramo de capa: entera. */
function tramoDeCara(cara: Cara, largo: number): TramoDeCapa {
  return {
    muroId: cara.muroId,
    cara: caraDe(cara),
    desde: largo > 0 ? cara.desde / largo : 0,
    hasta: largo > 0 ? cara.hasta / largo : 1,
  };
}

/**
 * Los tramos de todo el perímetro de un ambiente: cada cara que da a él,
 * entera. Con `ambienteId` null, las caras que no dan a ningún ambiente: el
 * afuera, para el revoque exterior.
 */
export function tramosDeAmbiente(
  caras: Cara[],
  ambienteId: string | null,
  muros: Dibujo["muros"]
): TramoDeCapa[] {
  const largos = new Map(muros.map((m) => [m.id, distancia(m.a, m.b)] as const));
  return caras
    .filter((c) => c.ambienteId === ambienteId)
    .map((c) => tramoDeCara(c, largos.get(c.muroId) ?? 0));
}

/** Un punto tomado sobre una cara: la cara y dónde, a lo largo. */
export type PuntoEnCara = { cara: Cara; s: number; punto: Punto };

/**
 * La cara más cercana a un punto, a no más de `alcance`, y dónde cae sobre
 * ella. Es como se marca a mano: cada clic se pega a la cara del muro.
 */
export function puntoEnCara(p: Punto, caras: Cara[], alcance: number): PuntoEnCara | null {
  let mejor: PuntoEnCara | null = null;
  let distanciaMejor = alcance;
  for (const cara of caras) {
    if (!(cara.largo > 0)) continue;
    const { d } = direcciones(cara);
    const t = Math.min(cara.largo, Math.max(0, (p.x - cara.a.x) * d.x + (p.y - cara.a.y) * d.y));
    const punto = { x: cara.a.x + d.x * t, y: cara.a.y + d.y * t };
    const lejos = distancia(p, punto);
    if (lejos <= distanciaMejor) {
      distanciaMejor = lejos;
      mejor = { cara, s: cara.desde + t, punto };
    }
  }
  return mejor;
}

/**
 * Los tramos de una polilínea marcada a mano sobre las caras.
 *
 * Dos puntos seguidos sobre la misma cara son el tramo entre ellos. Si caen en
 * caras distintas, la polilínea dobla la esquina: la primera sigue hasta la
 * punta de su cara que queda hacia el segundo punto, y la segunda arranca de
 * la punta de la suya que queda hacia el primero.
 */
export function tramosDePolilinea(puntos: PuntoEnCara[], muros: Dibujo["muros"]): TramoDeCapa[] {
  const largos = new Map(muros.map((m) => [m.id, distancia(m.a, m.b)] as const));
  const tramos: TramoDeCapa[] = [];
  const sumar = (cara: Cara, s0: number, s1: number) => {
    const largo = largos.get(cara.muroId) ?? 0;
    if (!(largo > 0)) return;
    if (cara.punta !== null) {
      tramos.push(tramoDeCara(cara, largo));
      return;
    }
    tramos.push({
      muroId: cara.muroId,
      cara: caraDe(cara),
      desde: Math.min(s0, s1) / largo,
      hasta: Math.max(s0, s1) / largo,
    });
  };
  /** La punta de una cara —en `s`— que queda más cerca de un punto. */
  const puntaHacia = (cara: Cara, p: Punto) =>
    distancia(cara.a, p) <= distancia(cara.b, p) ? cara.desde : cara.hasta;

  for (let i = 0; i + 1 < puntos.length; i++) {
    const p = puntos[i];
    const q = puntos[i + 1];
    if (p.cara.clave === q.cara.clave) {
      sumar(p.cara, p.s, q.s);
    } else {
      sumar(p.cara, p.s, puntaHacia(p.cara, q.punto));
      sumar(q.cara, puntaHacia(q.cara, p.punto), q.s);
    }
  }
  return juntar(tramos);
}

/** Los tramos de la misma cara que se tocan o se pisan, en uno. */
export function juntar(tramos: TramoDeCapa[]): TramoDeCapa[] {
  const enOrden = [...tramos].sort(
    (a, b) =>
      a.muroId.localeCompare(b.muroId) ||
      String(a.cara).localeCompare(String(b.cara)) ||
      a.desde - b.desde
  );
  const juntos: TramoDeCapa[] = [];
  for (const t of enOrden) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && ultimo.muroId === t.muroId && ultimo.cara === t.cara && t.desde <= ultimo.hasta + 1e-6) {
      ultimo.hasta = Math.max(ultimo.hasta, t.hasta);
    } else if (t.hasta - t.desde > 1e-9 || typeof t.cara === "string") {
      juntos.push({ ...t });
    }
  }
  return juntos;
}
