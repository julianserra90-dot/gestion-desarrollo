/**
 * La geometría de dibujar una planta: dónde cae un punto que se marcó "más o
 * menos acá", por dónde va el cuerpo de un muro, cómo se corre el lado de un
 * ambiente.
 *
 * Aparte del editor y sin importar nada de React: son cuentas, y acá se pueden
 * probar solas. Las medidas que salen del dibujo están en `planta-dibujo.ts`;
 * esto es lo que ayuda a que el dibujo quede bien antes de medirlo.
 *
 * Todo en píxeles de la imagen, con la y hacia abajo como en la pantalla.
 */

import { type PiezaDeCapa, piezasDeCapas, proporcionAlLargo } from "@/lib/planta-capas";
import {
  type Abertura,
  type Capa,
  type Dibujo,
  type Muro,
  type Punto,
  type ReferenciaDeMuro,
  areaDe,
  centroDe,
  distancia,
} from "@/lib/planta-dibujo";
import {
  huellaDeColumna,
  medirEstructura,
  prismasDeHormigon,
  recortar,
} from "@/lib/planta-estructura";
import { ladoDeCara, type Composicion } from "@/lib/tipos-de-muro";

export function mismoPunto(a: Punto, b: Punto) {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

/** El punto del tramo a-b más cercano a p. */
export function proyectar(p: Punto, a: Punto, b: Punto): Punto {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  if (largo2 === 0) return a;
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/**
 * Dónde un tramo cruza una línea horizontal o vertical.
 *
 * `fijo` es la coordenada que define la línea (la y de una horizontal) y
 * `libre` la otra. Devuelve la coordenada libre del cruce, o null si el tramo
 * no llega a la línea o corre paralelo a ella.
 */
function cruceConEje(
  fijoA: number,
  fijoB: number,
  libreA: number,
  libreB: number,
  eje: number
): number | null {
  if (fijoA === fijoB) return null;
  const t = (eje - fijoA) / (fijoB - fijoA);
  if (t < 0 || t > 1) return null;
  return libreA + t * (libreB - libreA);
}

// ---- El imán y las guías --------------------------------------------------

/** Una guía: la línea que une el punto que se está marcando con aquél con el
 *  que quedó alineado. Se dibuja para que se vea contra qué se alineó. */
export type Guia = { desde: Punto; hasta: Punto };

export type Ajuste = { punto: Punto; iman: boolean; guias: Guia[] };

/**
 * Las guías se sueltan antes que el imán de los vértices: alinearse con una
 * esquina lejana es una ayuda, y si agarrara desde tan lejos como un vértice
 * no dejaría poner un punto cerca de ninguna alineación.
 */
const PARTE_DE_LAS_GUIAS = 0.6;

/**
 * Dónde cae de verdad un punto que se marcó "más o menos acá".
 *
 * Calcar a mano es impreciso, y dos muros que casi se tocan miden distinto que
 * dos que se tocan. Por eso el punto se corrige, en este orden:
 *
 *  1. Si hay un vértice cerca, es ése: las esquinas cierran exactas. Vértice
 *     es todo punto que ya está: las puntas de un muro, las esquinas de su
 *     cuerpo, las de una abertura, los puntos de un ambiente.
 *  2. Trazando a escuadra, se alinea con el punto anterior en horizontal o en
 *     vertical —lo que esté más cerca de lo que se marcó—, y sobre esa línea
 *     se frena donde cruza un muro o una de sus caras: así sale el encuentro
 *     en T sin puntería. Si no cruza nada, a la altura de otra esquina (una
 *     guía).
 *  3. Sin escuadra, se apoya sobre la línea que tenga cerca —un muro o una
 *     cara—, y sobre ella se frena a la altura de otra esquina. Lejos de toda
 *     línea se alinea con las esquinas que tenga a la misma altura o en la
 *     misma vertical: una guía por eje, y las dos a la vez dan el cruce.
 *
 * El orden dice qué vale más: lo que está dibujado le gana a lo que sólo está
 * alineado. Un punto que cae sobre la cara de un muro es un dato; uno que
 * quedó a la altura de una esquina lejana, una ayuda.
 *
 * `muros` son las líneas de apoyo: los muros por su línea marcada y por sus
 * caras. `iman` dice si se pegó a algo y `guias` contra qué se alineó, para
 * mostrarlo.
 */
export function ajustar(
  p: Punto,
  o: {
    previo: Punto | null;
    ortogonal: boolean;
    tolerancia: number;
    vertices: Punto[];
    muros: { a: Punto; b: Punto }[];
    /** Si se alinea con las esquinas que ya están. */
    guias: boolean;
  }
): Ajuste {
  let cercano: Punto | null = null;
  let menor = o.tolerancia;
  for (const vertice of o.vertices) {
    const d = distancia(p, vertice);
    if (d <= menor) {
      menor = d;
      cercano = vertice;
    }
  }
  if (cercano) return { punto: { x: cercano.x, y: cercano.y }, iman: true, guias: [] };

  const alcanceDeGuia = o.tolerancia * PARTE_DE_LAS_GUIAS;

  if (o.ortogonal && o.previo) {
    const previo = o.previo;
    const horizontal = Math.abs(p.x - previo.x) >= Math.abs(p.y - previo.y);
    // Lo que queda libre es una sola coordenada: la que corre sobre el eje.
    const libre = horizontal ? p.x : p.y;

    // Primero lo que está de verdad: dónde el eje cruza un muro o una de sus
    // caras. Es un encuentro, y le gana a alinearse con una esquina lejana.
    let cruce: number | null = null;
    let delta = o.tolerancia;
    for (const muro of o.muros) {
      const donde = horizontal
        ? cruceConEje(muro.a.y, muro.b.y, muro.a.x, muro.b.x, previo.y)
        : cruceConEje(muro.a.x, muro.b.x, muro.a.y, muro.b.y, previo.x);
      if (donde !== null && Math.abs(donde - libre) <= delta) {
        delta = Math.abs(donde - libre);
        cruce = donde;
      }
    }
    if (cruce !== null) {
      return {
        punto: horizontal ? { x: cruce, y: previo.y } : { x: previo.x, y: cruce },
        iman: true,
        guias: [],
      };
    }

    let alineadoCon: Punto | null = null;
    if (o.guias) {
      delta = alcanceDeGuia;
      for (const vertice of o.vertices) {
        const candidato = horizontal ? vertice.x : vertice.y;
        if (Math.abs(candidato - libre) <= delta) {
          delta = Math.abs(candidato - libre);
          alineadoCon = vertice;
        }
      }
    }

    const valor = alineadoCon ? (horizontal ? alineadoCon.x : alineadoCon.y) : libre;
    const punto = horizontal ? { x: valor, y: previo.y } : { x: previo.x, y: valor };
    return {
      punto,
      iman: alineadoCon !== null,
      guias: alineadoCon ? [{ desde: alineadoCon, hasta: punto }] : [],
    };
  }

  // Sin escuadra, también primero lo que está: la línea más cercana.
  let apoyo: Punto | null = null;
  let linea: { a: Punto; b: Punto } | null = null;
  menor = o.tolerancia;
  for (const muro of o.muros) {
    const proyectado = proyectar(p, muro.a, muro.b);
    const d = distancia(p, proyectado);
    if (d <= menor) {
      menor = d;
      apoyo = proyectado;
      linea = muro;
    }
  }

  if (apoyo && linea) {
    // Ya sobre la línea, se frena a la altura de otra esquina: donde la
    // vertical o la horizontal de un vértice la corta.
    if (o.guias) {
      let mejor: Punto | null = null;
      let alineadoCon: Punto | null = null;
      let delta = alcanceDeGuia;
      for (const vertice of o.vertices) {
        const y = cruceConEje(linea.a.x, linea.b.x, linea.a.y, linea.b.y, vertice.x);
        const x = cruceConEje(linea.a.y, linea.b.y, linea.a.x, linea.b.x, vertice.y);
        const candidatos: Punto[] = [];
        if (y !== null) candidatos.push({ x: vertice.x, y });
        if (x !== null) candidatos.push({ x, y: vertice.y });
        for (const candidato of candidatos) {
          const d = distancia(candidato, apoyo);
          if (d <= delta) {
            delta = d;
            mejor = candidato;
            alineadoCon = vertice;
          }
        }
      }
      if (mejor && alineadoCon) {
        return { punto: mejor, iman: true, guias: [{ desde: alineadoCon, hasta: mejor }] };
      }
    }
    return { punto: apoyo, iman: true, guias: [] };
  }

  if (o.guias) {
    let enX: Punto | null = null;
    let enY: Punto | null = null;
    let deltaX = alcanceDeGuia;
    let deltaY = alcanceDeGuia;

    for (const vertice of o.vertices) {
      if (Math.abs(vertice.x - p.x) <= deltaX) {
        deltaX = Math.abs(vertice.x - p.x);
        enX = vertice;
      }
      if (Math.abs(vertice.y - p.y) <= deltaY) {
        deltaY = Math.abs(vertice.y - p.y);
        enY = vertice;
      }
    }

    if (enX || enY) {
      const punto = { x: enX ? enX.x : p.x, y: enY ? enY.y : p.y };
      const guias: Guia[] = [];
      if (enX) guias.push({ desde: enX, hasta: punto });
      if (enY) guias.push({ desde: enY, hasta: punto });
      return { punto, iman: true, guias };
    }
  }

  return { punto: p, iman: false, guias: [] };
}

// ---- El cuerpo de un muro -------------------------------------------------

/**
 * Entre qué distancias de la línea de referencia está el cuerpo de un muro,
 * medidas sobre su normal (la dirección a→b girada un cuarto de vuelta, que en
 * pantalla es la derecha de quien camina de a hacia b).
 *
 * Es la misma idea que la línea de referencia de un programa de arquitectura:
 * la línea que se marca puede ser el eje del muro o una de sus caras. Con una
 * cara, el cuerpo crece entero hacia el otro lado. Los nombres valen para
 * quien recorre el contorno en el sentido de las agujas del reloj: marcando la
 * cara exterior el muro crece hacia adentro, y marcando la interior, hacia
 * afuera. Recorriendo al revés se invierten, y por eso el editor muestra el
 * cuerpo antes de soltar el punto.
 */
function rangoDelCuerpo(
  referencia: ReferenciaDeMuro,
  grosor: number,
  exterior = 0,
  interior = 0,
  dibujadoAfuera = 0,
  dibujadoAdentro = 0
): [number, number] {
  // La referencia es del núcleo; las capas exteriores crecen hacia el −normal
  // y las interiores hacia el +normal, sin correrlo.
  const nucleo = Math.max(grosor - exterior - interior, 0);
  // Las capas dibujadas van más allá del cuerpo: cuentan para dónde está la
  // cara terminada, pero el cuerpo termina antes de ellas.
  const afuera = exterior + dibujadoAfuera;
  const adentro = interior + dibujadoAdentro;
  const [desde, hasta]: [number, number] =
    referencia === "exteriorTerminada"
      ? [0, afuera + nucleo + adentro]
      : referencia === "interiorTerminada"
        ? [-(afuera + nucleo + adentro), 0]
        : referencia === "exterior"
          ? [-afuera, nucleo + adentro]
          : referencia === "interior"
            ? [-nucleo - afuera, adentro]
            : [-nucleo / 2 - afuera, nucleo / 2 + adentro];
  return [desde + dibujadoAfuera, hasta - dibujadoAdentro];
}

/** Lo que suman las capas dibujadas de cada lado (`Muro.acabado`), en píxeles. */
function acabadoDe(muro: Pick<Muro, "acabado">, mpp: number | null): [number, number] {
  if (mpp === null || !muro.acabado) return [0, 0];
  return [muro.acabado.exterior / mpp, muro.acabado.interior / mpp];
}

/** Lo que crece un muro de cada lado de su núcleo, en píxeles. */
function revestimientoDe(muro: Pick<Muro, "revestimiento">, mpp: number | null): [number, number] {
  if (mpp === null || !muro.revestimiento) return [0, 0];
  return [muro.revestimiento.exterior / mpp, muro.revestimiento.interior / mpp];
}

export type Cuerpo = {
  /** Por dónde se dibuja: el eje del cuerpo, ya estirado en las esquinas. */
  a: Punto;
  b: Punto;
  /** El eje del cuerpo de punta a punta de lo marcado, sin estirar: sobre él
   *  van las aberturas y la cota. */
  ejeA: Punto;
  ejeB: Punto;
  /** El espesor, en píxeles de la imagen. */
  grosor: number;
  /** El eje y el espesor del núcleo solo —el ladrillo, sin sus capas—: es lo
   *  que el hormigón reemplaza. Igual al cuerpo en un muro sin tipo. */
  nucleo: { ejeA: Punto; ejeB: Punto; grosor: number };
};

function grosorDe(muro: Pick<Muro, "espesor">, mpp: number | null, u: number) {
  // Sin escala no se sabe cuánto es el espesor en el plano: un trazo fijo.
  return mpp !== null ? Math.max(muro.espesor / mpp, 3 * u) : 5 * u;
}

/**
 * Cuánto empieza el cuerpo antes del primer punto marcado, a lo largo del
 * muro: positivo si se estiró, **negativo si se acortó** —el muro que llega a
 * otro agarrado de su cara terminada con capas dibujadas—. Es de donde se
 * miden las caras y los vanos; con una distancia, sin signo, un muro acortado
 * corría todo el doble de lo que se acortó.
 */
export function arranqueDe(cuerpo: Pick<Cuerpo, "a" | "b" | "ejeA">): number {
  const largo = distancia(cuerpo.a, cuerpo.b);
  if (!(largo > 0)) return 0;
  return (
    ((cuerpo.ejeA.x - cuerpo.a.x) * (cuerpo.b.x - cuerpo.a.x) +
      (cuerpo.ejeA.y - cuerpo.a.y) * (cuerpo.b.y - cuerpo.a.y)) /
    largo
  );
}

/**
 * Las líneas de un muro sobre su normal, desde su línea marcada: la cara de
 * su cuerpo, las dos de su núcleo —el ladrillo— y la otra cara del cuerpo
 * (`k`), y las dos caras terminadas con las capas dibujadas (`terminadas`).
 */
function lineasDeMuro(muro: Muro, mpp: number | null, u = 1) {
  const l = distancia(muro.a, muro.b);
  const d = { x: (muro.b.x - muro.a.x) / l, y: (muro.b.y - muro.a.y) / l };
  const n = { x: -d.y, y: d.x };
  const [e, i] = revestimientoDe(muro, mpp);
  const [dibujadoAfuera, dibujadoAdentro] = acabadoDe(muro, mpp);
  const [desde, hasta] = rangoDelCuerpo(
    mpp !== null ? muro.referencia : "centro",
    grosorDe(muro, mpp, u),
    e,
    i,
    dibujadoAfuera,
    dibujadoAdentro
  );
  return {
    a: muro.a,
    d,
    n,
    largo: l,
    k: [desde, desde + e, hasta - i, hasta] as [number, number, number, number],
    terminadas: [desde - dibujadoAfuera, hasta + dibujadoAdentro] as [number, number],
  };
}

/** Si dos direcciones van casi en línea: no hacen esquina ni T. */
function enLinea(d: Punto, otra: Punto): boolean {
  return Math.abs(d.x * otra.y - d.y * otra.x) < 0.1;
}

/**
 * El muro contra el que llega la punta de otro **en una T sin punta
 * compartida**: la punta cae sobre su cuerpo o sus capas —en la cara del
 * ladrillo, en la terminada, en la línea marcada—, lejos de sus puntas. Es el
 * tabique que se marcó hasta la pared de enfrente sin partirla. Null si no
 * hay ninguno, o si la punta ya es de otro muro (eso lo resuelve la unión de
 * siempre).
 */
function muroQueLaRecibe(muro: Muro, punta: Punto, muros: Muro[], mpp: number | null): Muro | null {
  if (mpp === null) return null;
  const largo = distancia(muro.a, muro.b);
  if (!(largo > 0)) return null;
  if (muros.some((o) => o.id !== muro.id && (mismoPunto(o.a, punta) || mismoPunto(o.b, punta)))) return null;
  const d = { x: (muro.b.x - muro.a.x) / largo, y: (muro.b.y - muro.a.y) / largo };
  // Hacia dónde sale el muro por esa punta.
  const e = mismoPunto(punta, muro.a) ? { x: -d.x, y: -d.y } : d;
  const tolerancia = 0.01 / mpp;
  for (const otro of muros) {
    if (otro.id === muro.id || !(distancia(otro.a, otro.b) > 0)) continue;
    const l = lineasDeMuro(otro, mpp);
    if (enLinea(d, l.d)) continue;
    const s = (punta.x - l.a.x) * l.d.x + (punta.y - l.a.y) * l.d.y;
    if (s <= tolerancia || s >= l.largo - tolerancia) continue;
    // Llega a su cara: entra desde la cara terminada que tiene enfrente, como
    // mucho hasta la mitad —el eje—. Una punta más adentro no es una T: es un
    // muro que nace en el otro y sigue para el otro lado.
    const m = (punta.x - l.a.x) * l.n.x + (punta.y - l.a.y) * l.n.y;
    const enE = l.n.x * e.x + l.n.y * e.y;
    if (Math.abs(enE) < 1e-9) continue;
    const cara = enE > 0 ? l.terminadas[0] : l.terminadas[1];
    const adentro = (m - cara) * Math.sign(enE);
    if (adentro < -tolerancia || adentro > (l.terminadas[1] - l.terminadas[0]) / 2 + tolerancia) continue;
    return otro;
  }
  return null;
}

/**
 * Con qué otro muro se une uno en una de sus puntas, y cómo: `continua` si el
 * otro sigue de largo (una T: tiene un compañero en línea ahí, o la punta
 * llega a su cara sin partirlo); si no, es una esquina. Null si la punta está
 * suelta o sigue en línea con otro muro.
 */
function unionEnPunta(
  muro: Muro,
  punta: "a" | "b",
  muros: Muro[],
  mpp: number | null
): { otro: Muro; continua: boolean } | null {
  const p = muro[punta];
  const largo = distancia(muro.a, muro.b);
  if (!(largo > 0)) return null;
  const n = { x: -(muro.b.y - muro.a.y) / largo, y: (muro.b.x - muro.a.x) / largo };
  const vecinos = muros.filter(
    (o) => o.id !== muro.id && (mismoPunto(o.a, p) || mismoPunto(o.b, p)) && distancia(o.a, o.b) > 0
  );
  const paralelo = (o: Muro, normal: Punto) => {
    const l = distancia(o.a, o.b);
    return Math.abs(((o.b.x - o.a.x) / l) * normal.x + ((o.b.y - o.a.y) / l) * normal.y) < 0.1;
  };
  if (vecinos.length === 0) {
    // Sin nadie en la punta: puede llegar contra la cara de otro, una T
    // marcada sin partir la pared de enfrente.
    const recibe = muroQueLaRecibe(muro, p, muros, mpp);
    return recibe ? { otro: recibe, continua: true } : null;
  }
  // Sigue en línea con otro muro: no hay unión que cortar.
  if (vecinos.some((o) => paralelo(o, n))) return null;
  const otro = vecinos[0];
  const largoOtro = distancia(otro.a, otro.b);
  const nOtro = { x: -(otro.b.y - otro.a.y) / largoOtro, y: (otro.b.x - otro.a.x) / largoOtro };
  // ¿El otro sigue de largo —una T—? Tiene un compañero en línea en esa punta.
  const continua = vecinos.some((o) => o.id !== otro.id && paralelo(o, nOtro));
  return { otro, continua };
}

/**
 * Entre dónde y dónde se computa la mampostería de un muro, a lo largo de su
 * línea marcada (0 es su punta a): **por el eje del ladrillo**, como se
 * computa en obra. En una esquina, hasta donde se cruza con el eje del
 * ladrillo del otro —cada muro se lleva medio rincón, y el rincón se cuenta una
 * vez—; en una T, hasta la cara del ladrillo de la pared a la que llega —no
 * se mete en la de ella—; suelta o en línea, donde se marcó.
 *
 * Con la línea marcada sola, dos muros marcados por la cara de adentro de una
 * L no contaban el rincón, y marcados por la de afuera lo contaban dos veces.
 */
export function tramoDeMamposteria(muro: Muro, muros: Muro[], mpp: number | null): [number, number] {
  const largo = distancia(muro.a, muro.b);
  if (!(largo > 0) || mpp === null) return [0, largo];
  const propias = lineasDeMuro(muro, mpp);
  const eje = (propias.k[1] + propias.k[2]) / 2;
  const hasta = (punta: "a" | "b"): number => {
    const enLaPunta = punta === "a" ? 0 : largo;
    const union = unionEnPunta(muro, punta, muros, mpp);
    if (!union) return enLaPunta;
    const otro = lineasDeMuro(union.otro, mpp);
    const e = punta === "a" ? { x: -propias.d.x, y: -propias.d.y } : propias.d;
    const enE = otro.n.x * e.x + otro.n.y * e.y;
    const linea = union.continua ? (enE >= 0 ? otro.k[1] : otro.k[2]) : (otro.k[1] + otro.k[2]) / 2;
    // El eje de éste: muro.a + n·eje + d·s. Sobre la línea del otro: (P − otro.a)·otro.n = linea.
    const base =
      (muro.a.x + propias.n.x * eje - otro.a.x) * otro.n.x + (muro.a.y + propias.n.y * eje - otro.a.y) * otro.n.y;
    const paso = propias.d.x * otro.n.x + propias.d.y * otro.n.y;
    if (Math.abs(paso) < 1e-9) return enLaPunta;
    return (linea - base) / paso;
  };
  const s0 = hasta("a");
  const s1 = hasta("b");
  return s1 > s0 ? [s0, s1] : [0, largo];
}

/** Lo que queda de un polígono convexo del lado de una recta donde `lado(p) ≤ 0`. */
function deUnLado(poligono: Punto[], lado: (p: Punto) => number): Punto[] {
  const salida: Punto[] = [];
  for (let i = 0; i < poligono.length; i++) {
    const p = poligono[i];
    const q = poligono[(i + 1) % poligono.length];
    const lp = lado(p);
    const lq = lado(q);
    if (lp <= 0) salida.push(p);
    if ((lp < 0 && lq > 0) || (lp > 0 && lq < 0)) {
      const t = lp / (lp - lq);
      salida.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return salida;
}

/**
 * Por dónde va el cuerpo de un muro, dada la línea que se marcó.
 *
 * En cada punta que comparte con otro muro se estira lo justo para tapar el
 * espesor de ese otro: sin eso, dos muros marcados por su cara dejan la
 * esquina sin llenar. Lo justo es cuánto del cuerpo del otro queda más allá
 * de la punta, mirando hacia afuera del muro; en una esquina que dobla para
 * el otro lado no queda nada y no se estira. Una punta suelta termina donde
 * se marcó.
 *
 * `u` es un píxel de pantalla en unidades del plano.
 */
export function cuerpoDeMuro(
  muro: Muro,
  muros: Muro[],
  mpp: number | null,
  u: number
): Cuerpo {
  const grosor = grosorDe(muro, mpp, u);
  const largo = distancia(muro.a, muro.b);
  if (!(largo > 0)) {
    return {
      a: muro.a,
      b: muro.b,
      ejeA: muro.a,
      ejeB: muro.b,
      grosor,
      nucleo: { ejeA: muro.a, ejeB: muro.b, grosor },
    };
  }

  const dx = (muro.b.x - muro.a.x) / largo;
  const dy = (muro.b.y - muro.a.y) / largo;
  // Sin escala la referencia no se puede dibujar: el trazo va sobre la línea.
  const [ext, int] = revestimientoDe(muro, mpp);
  const [desde, hasta] = rangoDelCuerpo(
    mpp !== null ? muro.referencia : "centro",
    grosor,
    ext,
    int,
    ...acabadoDe(muro, mpp)
  );
  const corrimiento = (desde + hasta) / 2;
  const ejeA = { x: muro.a.x - dy * corrimiento, y: muro.a.y + dx * corrimiento };
  const ejeB = { x: muro.b.x - dy * corrimiento, y: muro.b.y + dx * corrimiento };
  // El núcleo va entre el borde exterior más su revestimiento y el interior
  // menos el suyo.
  const enNucleo = (desde + ext + (hasta - int)) / 2;
  const nucleo = {
    ejeA: { x: muro.a.x - dy * enNucleo, y: muro.a.y + dx * enNucleo },
    ejeB: { x: muro.b.x - dy * enNucleo, y: muro.b.y + dx * enNucleo },
    grosor: Math.max(grosor - ext - int, 0),
  };

  /**
   * Cuánto hay que estirar una punta, mirando hacia (ax, ay). Puede ser
   * negativo —acortarla—: si el otro se marcó por su cara terminada y tiene
   * capas dibujadas, su cuerpo empieza después de su línea, y el ladrillo de
   * éste llega hasta el del otro, no hasta la línea; las capas dan la vuelta
   * por afuera. Sin capas dibujadas el cuerpo del otro siempre toca su línea y
   * nunca da negativo.
   */
  const estirar = (punta: Punto, ax: number, ay: number): number => {
    let extra: number | null = null;
    for (const otro of muros) {
      if (otro.id === muro.id) continue;
      if (!mismoPunto(otro.a, punta) && !mismoPunto(otro.b, punta)) continue;
      const largoDelOtro = distancia(otro.a, otro.b);
      if (!(largoDelOtro > 0)) continue;

      // La normal del otro, y cuánto de ella apunta hacia afuera de éste.
      const nx = -(otro.b.y - otro.a.y) / largoDelOtro;
      const ny = (otro.b.x - otro.a.x) / largoDelOtro;
      const haciaAfuera = nx * ax + ny * ay;
      const [d, h] = rangoDelCuerpo(
        mpp !== null ? otro.referencia : "centro",
        grosorDe(otro, mpp, u),
        ...revestimientoDe(otro, mpp),
        ...acabadoDe(otro, mpp)
      );
      const este = Math.max(d * haciaAfuera, h * haciaAfuera);
      extra = extra === null ? este : Math.max(extra, este);
    }
    if (extra !== null) return extra;
    // Una T sin punta compartida: el ladrillo llega hasta el ladrillo del otro
    // —atraviesa su revoque y sus capas—, aunque se lo haya marcado hasta su
    // cara terminada. Nunca se acorta: si se lo marcó más adentro, queda así.
    const recibe = muroQueLaRecibe(muro, punta, muros, mpp);
    if (!recibe) return 0;
    const l = lineasDeMuro(recibe, mpp, u);
    const enE = l.n.x * ax + l.n.y * ay;
    if (Math.abs(enE) < 1e-9) return 0;
    const m = (punta.x - l.a.x) * l.n.x + (punta.y - l.a.y) * l.n.y;
    const ladrillo = enE > 0 ? l.k[1] : l.k[2];
    return Math.max(0, (ladrillo - m) / enE);
  };

  const enA = estirar(muro.a, -dx, -dy);
  const enB = estirar(muro.b, dx, dy);

  return {
    a: { x: ejeA.x - dx * enA, y: ejeA.y - dy * enA },
    b: { x: ejeB.x + dx * enB, y: ejeB.y + dy * enB },
    ejeA,
    ejeB,
    grosor,
    nucleo,
  };
}

/**
 * Los muros con uno de ellos **agarrado de otra línea**, sin moverlo: el
 * cuerpo queda donde estaba y lo que se corre es la línea marcada —con sus
 * dos puntos—, de la cara exterior al eje o a la interior. Es el ancla de una
 * columna: se elige de dónde se lo toma para alinearlo con otro muro.
 *
 * Los muros que llegan a una de sus puntas la siguen: la punta se va a donde
 * la nueva línea cruza la del vecino, así la esquina o la T no se despegan. Un
 * vecino que sigue en línea —paralelo— no tiene dónde cruzarla y queda como
 * estaba.
 */
export function conOtraReferencia(
  muros: Muro[],
  id: string,
  nueva: ReferenciaDeMuro,
  mpp: number | null
): Muro[] {
  const muro = muros.find((m) => m.id === id);
  if (!muro || mpp === null || muro.referencia === nueva) {
    return muros.map((m) => (m.id === id ? { ...m, referencia: nueva } : m));
  }
  const largo = distancia(muro.a, muro.b);
  if (!(largo > 0)) return muros.map((m) => (m.id === id ? { ...m, referencia: nueva } : m));

  const dx = (muro.b.x - muro.a.x) / largo;
  const dy = (muro.b.y - muro.a.y) / largo;
  const nx = -dy;
  const ny = dx;
  const grosor = muro.espesor / mpp;
  const [ext, int] = revestimientoDe(muro, mpp);
  const [antes] = rangoDelCuerpo(muro.referencia, grosor, ext, int, ...acabadoDe(muro, mpp));
  const [despues] = rangoDelCuerpo(nueva, grosor, ext, int, ...acabadoDe(muro, mpp));
  // El cuerpo va de la línea más `desde`: para que no se mueva, la línea se
  // corre lo que cambió ese `desde`.
  const corrimiento = antes - despues;
  const nuevaA = { x: muro.a.x + nx * corrimiento, y: muro.a.y + ny * corrimiento };
  const nuevaB = { x: muro.b.x + nx * corrimiento, y: muro.b.y + ny * corrimiento };

  /** Dónde la línea nueva cruza la de otro muro, o null si son paralelas. */
  const cruce = (otro: Muro): Punto | null => {
    const ex = otro.b.x - otro.a.x;
    const ey = otro.b.y - otro.a.y;
    const largoOtro = Math.hypot(ex, ey);
    if (!(largoOtro > 0)) return null;
    const det = dx * ey - dy * ex;
    if (Math.abs(det) / largoOtro < 0.1) return null;
    const wx = otro.a.x - nuevaA.x;
    const wy = otro.a.y - nuevaA.y;
    const s = (wx * ey - wy * ex) / det;
    return { x: nuevaA.x + dx * s, y: nuevaA.y + dy * s };
  };

  // Cada punta: donde la nueva línea cruza a un vecino que llega ahí, o
  // corrida en paralelo si no hay.
  const destinos = new Map<"a" | "b", Punto>();
  const vecinos: { id: string; punta: "a" | "b"; punto: "a" | "b" }[] = [];
  for (const punta of ["a", "b"] as const) {
    let destino = punta === "a" ? nuevaA : nuevaB;
    for (const otro of muros) {
      if (otro.id === id) continue;
      for (const suya of ["a", "b"] as const) {
        if (!mismoPunto(otro[suya], muro[punta])) continue;
        const x = cruce(otro);
        if (!x) continue;
        destino = x;
        vecinos.push({ id: otro.id, punta: suya, punto: punta });
      }
    }
    destinos.set(punta, destino);
  }

  return muros.map((m) => {
    if (m.id === id) {
      return { ...m, referencia: nueva, a: destinos.get("a")!, b: destinos.get("b")! };
    }
    const suyas = vecinos.filter((v) => v.id === m.id);
    if (suyas.length === 0) return m;
    const cambio = { ...m };
    for (const v of suyas) cambio[v.punta] = destinos.get(v.punto)!;
    return cambio;
  });
}

/** Una franja de un muro en la planta: una capa o el núcleo, ya recortada. */
export type FranjaEnPlanta = {
  clase: "exterior" | "nucleo" | "interior";
  /** Sus cuatro esquinas, en píxeles. */
  puntos: Punto[];
};

/**
 * Las franjas de un muro en la planta —la capa exterior, el núcleo y la capa
 * interior— **cortadas en sus uniones como en un corte de obra**: en una
 * esquina, cada capa se une con la misma capa del otro muro y forma su propia
 * L; el ladrillo con el ladrillo, el revoque de afuera con el de afuera.
 *
 * En cada punta que comparte con otro muro (no paralelo), cada franja termina
 * en una línea del otro:
 *
 *   esquina (L)   la capa del lado de afuera de la esquina, en la cara
 *                 terminada de afuera del otro; el núcleo, en la cara de afuera
 *                 de su núcleo; la capa del lado de adentro, en la cara de
 *                 adentro de su núcleo, que es donde empieza la capa de adentro
 *                 del otro.
 *   T             cuando el otro sigue de largo —tiene un compañero en línea en
 *                 esa punta—: el núcleo entra hasta la cara cercana del núcleo
 *                 del otro, y las capas terminan en su cara terminada cercana.
 *
 * Una punta suelta, o una que sigue en línea con otro muro, termina donde se
 * marcó. Como las uniones pueden no ser a 90°, cada borde de la franja se
 * corta contra la línea que le toca: la punta queda en bisel si hace falta.
 */
export function franjasEnPlanta(muro: Muro, muros: Muro[], mpp: number | null): FranjaEnPlanta[] {
  const largo = distancia(muro.a, muro.b);
  if (!(largo > 0)) return [];
  const d = { x: (muro.b.x - muro.a.x) / largo, y: (muro.b.y - muro.a.y) / largo };
  const n = { x: -d.y, y: d.x };
  const grosor = grosorDe(muro, mpp, 1);
  const [ext, int] = revestimientoDe(muro, mpp);
  const [desde, hasta] = rangoDelCuerpo(
    mpp !== null ? muro.referencia : "centro",
    grosor,
    ext,
    int,
    ...acabadoDe(muro, mpp)
  );
  // Los bordes sobre la normal, desde la línea marcada: exterior (−n),
  // núcleo, interior (+n).
  const bordes = [desde, desde + ext, hasta - int, hasta];
  const franjas: { clase: FranjaEnPlanta["clase"]; n0: number; n1: number }[] = [
    { clase: "exterior" as const, n0: bordes[0], n1: bordes[1] },
    { clase: "nucleo" as const, n0: bordes[1], n1: bordes[2] },
    { clase: "interior" as const, n0: bordes[2], n1: bordes[3] },
  ].filter((f) => f.n1 - f.n0 > 1e-6);

  /** Las cuatro líneas de un muro, sobre su normal desde su línea marcada. */
  const lineasDe = (otro: Muro) => lineasDeMuro(otro, mpp);

  /**
   * Hasta dónde llega, a lo largo del muro, el borde que está a `m` de su línea
   * marcada, si se lo corta con la línea del otro que está a `k` de la suya.
   */
  const corteEn = (m: number, otro: ReturnType<typeof lineasDe>, k: number): number | null => {
    // Punto del borde: muro.a + n·m + d·s. Sobre la línea del otro: (P − otro.a)·otro.n = k.
    const base = (muro.a.x + n.x * m - otro.a.x) * otro.n.x + (muro.a.y + n.y * m - otro.a.y) * otro.n.y;
    const paso = d.x * otro.n.x + d.y * otro.n.y;
    if (Math.abs(paso) < 1e-9) return null;
    return (k - base) / paso;
  };

  /** Para cada franja, dónde termina en una punta: [borde n0, borde n1], a lo largo. */
  const finEn = (punta: "a" | "b"): ((f: (typeof franjas)[number]) => [number, number]) => {
    const p = muro[punta];
    const enLaPunta = punta === "a" ? 0 : largo;
    const sinCambio = () => [enLaPunta, enLaPunta] as [number, number];
    const union = unionEnPunta(muro, punta, muros, mpp);
    if (!union) return sinCambio;
    const { otro, continua } = union;
    const lineas = lineasDe(otro);
    // Hacia dónde va el muro en esta punta (e), y hacia dónde se va el otro (f).
    const e = punta === "a" ? { x: -d.x, y: -d.y } : d;
    const desdeP = mismoPunto(otro.a, p) ? 1 : -1;
    const f = { x: lineas.d.x * desdeP, y: lineas.d.y * desdeP };
    // Las líneas del otro, ordenadas de la más cercana a la más lejana yendo en e.
    const enE = lineas.n.x * e.x + lineas.n.y * e.y;
    const k = enE >= 0 ? lineas.k : [...lineas.k].reverse();
    const [caraCerca, nucleoCerca, nucleoLejos, caraLejos] = k;
    // De qué lado de la esquina queda cada lado de este muro: afuera es el
    // que mira para el lado contrario a donde se va el otro.
    const afuera = (lado: -1 | 1) => lado * (n.x * f.x + n.y * f.y) < 0;

    return (franja) => {
      /** Contra qué línea del otro termina el borde de la franja de ese lado. */
      const lineaDe = (lado: -1 | 1): number => {
        if (continua) return franja.clase === "nucleo" ? nucleoCerca : caraCerca;
        // El ladrillo de una esquina, a inglete: su borde de afuera llega a la
        // cara lejana del ladrillo del otro, el de adentro a la cercana. Cada
        // muro se queda con medio rincón, que es como se lo computa (por eje).
        if (franja.clase === "nucleo") return afuera(lado) ? nucleoLejos : nucleoCerca;
        return afuera(franja.clase === "exterior" ? -1 : 1) ? caraLejos : nucleoCerca;
      };
      const s0 = corteEn(franja.n0, lineas, lineaDe(-1));
      const s1 = corteEn(franja.n1, lineas, lineaDe(1));
      return [s0 ?? enLaPunta, s1 ?? enLaPunta];
    };
  };

  const enA = finEn("a");
  const enB = finEn("b");
  const punto = (s: number, m: number): Punto => ({
    x: muro.a.x + d.x * s + n.x * m,
    y: muro.a.y + d.y * s + n.y * m,
  });

  // Los muros que llegan a éste en T —con su punta en el medio de él, o donde
  // él sigue de largo en otro muro—, y de qué lado vienen: su ladrillo entra
  // hasta el de éste, así que las capas de ese lado se cortan ahí. El revoque
  // no pasa por delante del ladrillo que llega.
  const pies: { l: ReturnType<typeof lineasDeMuro>; lado: number }[] = [];
  for (const otro of muros) {
    if (otro.id === muro.id || !(distancia(otro.a, otro.b) > 0)) continue;
    const l = lineasDeMuro(otro, mpp);
    if (enLinea(d, l.d)) continue;
    for (const fin of ["a", "b"] as const) {
      const p = otro[fin];
      const llega =
        mismoPunto(muro.a, p) || mismoPunto(muro.b, p)
          ? muros.some(
              (o) =>
                o.id !== muro.id &&
                o.id !== otro.id &&
                (mismoPunto(o.a, p) || mismoPunto(o.b, p)) &&
                distancia(o.a, o.b) > 0 &&
                enLinea(d, lineasDeMuro(o, mpp).d)
            )
          : muroQueLaRecibe(otro, p, muros, mpp)?.id === muro.id;
      if (!llega) continue;
      const q = fin === "a" ? otro.b : otro.a;
      const lado = Math.sign((q.x - p.x) * n.x + (q.y - p.y) * n.y);
      if (lado !== 0) pies.push({ l, lado });
    }
  }

  const nucleoMedio = (bordes[1] + bordes[2]) / 2;
  return franjas.flatMap((f) => {
    const [a0, a1] = enA(f);
    const [b0, b1] = enB(f);
    let piezas = [[punto(a0, f.n0), punto(b0, f.n0), punto(b1, f.n1), punto(a1, f.n1)]];
    if (f.clase !== "nucleo") {
      const suLado = Math.sign((f.n0 + f.n1) / 2 - nucleoMedio);
      for (const pie of pies) {
        if (pie.lado !== suLado) continue;
        const en = (q: Punto) => (q.x - pie.l.a.x) * pie.l.n.x + (q.y - pie.l.a.y) * pie.l.n.y;
        piezas = piezas
          .flatMap((pz) => [deUnLado(pz, (q) => en(q) - pie.l.k[1]), deUnLado(pz, (q) => pie.l.k[2] - en(q))])
          .filter((pz) => pz.length >= 3 && Math.abs(areaDe(pz)) > 1e-6);
      }
    }
    return piezas.map((puntos) => ({ clase: f.clase, puntos }));
  });
}

/**
 * Une dos muros en esquina, como el chaflán de distancia cero de un programa
 * de dibujo: cada uno se alarga o se recorta hasta donde su línea cruza la del
 * otro, y las dos puntas quedan en el mismo punto. Lo que sobraba de uno más
 * allá del otro se va; lo que faltaba se completa.
 *
 * Con la punta compartida, el cuerpo de cada muro se estira lo justo para
 * tapar el del otro (`cuerpoDeMuro`): la esquina queda llena, el revoque de
 * afuera da la vuelta y adentro no queda ningún pedazo de cara suelto.
 *
 * De cada muro se mueve la punta que queda más cerca del cruce. Null si son
 * paralelos: no tienen esquina.
 */
export function unirEnEsquina<T extends { id: string; a: Punto; b: Punto }>(
  muros: T[],
  idA: string,
  idB: string
): T[] | null {
  const a = muros.find((m) => m.id === idA);
  const b = muros.find((m) => m.id === idB);
  if (!a || !b || idA === idB) return null;

  const ax = a.b.x - a.a.x;
  const ay = a.b.y - a.a.y;
  const bx = b.b.x - b.a.x;
  const by = b.b.y - b.a.y;
  const det = ax * by - ay * bx;
  const largos = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (!(largos > 0) || Math.abs(det) / largos < 0.05) return null;

  const wx = b.a.x - a.a.x;
  const wy = b.a.y - a.a.y;
  const s = (wx * by - wy * bx) / det;
  const cruce = { x: a.a.x + ax * s, y: a.a.y + ay * s };

  const laMasCerca = (m: T): "a" | "b" =>
    distancia(m.a, cruce) <= distancia(m.b, cruce) ? "a" : "b";
  const puntaA = laMasCerca(a);
  const puntaB = laMasCerca(b);

  return muros.map((m) =>
    m.id === idA ? { ...m, [puntaA]: cruce } : m.id === idB ? { ...m, [puntaB]: cruce } : m
  );
}

/**
 * Dónde se puede cortar un muro: donde las caras de los otros muros, llevadas
 * hasta él, cruzan su línea. Es el tabique que llega a un medianero: sus dos
 * caras, prolongadas, parten el medianero en el tramo del dormitorio, el del
 * baño y el del pleno, cada uno con sus capas.
 *
 * Devuelve fracciones del largo del muro (0 a 1), ordenadas y sin las que caen
 * en las puntas.
 */
export function cortesDeMuro(muro: Muro, muros: Muro[], mpp: number | null): number[] {
  const largo = distancia(muro.a, muro.b);
  if (!(largo > 0) || mpp === null) return [];
  const dx = (muro.b.x - muro.a.x) / largo;
  const dy = (muro.b.y - muro.a.y) / largo;
  const margen = 0.01 / mpp;

  const cortes: number[] = [];
  for (const otro of muros) {
    if (otro.id === muro.id) continue;
    for (const cara of carasDeCuerpo(cuerpoDeMuro(otro, muros, mpp, 0))) {
      const ex = cara.b.x - cara.a.x;
      const ey = cara.b.y - cara.a.y;
      const largoCara = Math.hypot(ex, ey);
      if (!(largoCara > 0)) continue;
      // Paralelas no se cruzan: un muro que sigue en línea no lo corta.
      const det = dx * ey - dy * ex;
      if (Math.abs(det) / largoCara < 0.1) continue;
      const wx = cara.a.x - muro.a.x;
      const wy = cara.a.y - muro.a.y;
      const s = (wx * ey - wy * ex) / det;
      if (s > margen && s < largo - margen) cortes.push(s / largo);
    }
  }
  return cortes
    .sort((p, q) => p - q)
    .filter((t, i, todos) => i === 0 || (t - todos[i - 1]) * largo > margen);
}

/**
 * Las dos caras de un muro, de punta a punta de su cuerpo ya estirado: son las
 * líneas que el plano dibuja, y contra las que se apoya el contorno de un
 * ambiente.
 */
export function carasDeCuerpo(cuerpo: Cuerpo): { a: Punto; b: Punto }[] {
  const largo = distancia(cuerpo.a, cuerpo.b);
  if (!(largo > 0)) return [];
  const nx = (-(cuerpo.b.y - cuerpo.a.y) / largo) * (cuerpo.grosor / 2);
  const ny = ((cuerpo.b.x - cuerpo.a.x) / largo) * (cuerpo.grosor / 2);
  return [
    { a: { x: cuerpo.a.x + nx, y: cuerpo.a.y + ny }, b: { x: cuerpo.b.x + nx, y: cuerpo.b.y + ny } },
    { a: { x: cuerpo.a.x - nx, y: cuerpo.a.y - ny }, b: { x: cuerpo.b.x - nx, y: cuerpo.b.y - ny } },
  ];
}

/**
 * Las esquinas del cuerpo de un muro: las cuatro de punta a punta de lo
 * marcado y las cuatro del cuerpo estirado. En una punta suelta coinciden; en
 * una esquina, las estiradas dan el vértice de afuera, que no es ningún punto
 * marcado y es justo adonde hay que llegar con el contorno de un ambiente que
 * rodea al muro.
 */
export function esquinasDeCuerpo(cuerpo: Cuerpo): Punto[] {
  const largo = distancia(cuerpo.ejeA, cuerpo.ejeB);
  if (!(largo > 0)) return [];
  const nx = (-(cuerpo.ejeB.y - cuerpo.ejeA.y) / largo) * (cuerpo.grosor / 2);
  const ny = ((cuerpo.ejeB.x - cuerpo.ejeA.x) / largo) * (cuerpo.grosor / 2);
  return [cuerpo.ejeA, cuerpo.ejeB, cuerpo.a, cuerpo.b].flatMap((p) => [
    { x: p.x + nx, y: p.y + ny },
    { x: p.x - nx, y: p.y - ny },
  ]);
}

/**
 * Dónde las caras de dos muros se cortan.
 *
 * Son las esquinas que no marcó nadie: el rincón de adentro de un encuentro
 * en L, los dos rincones de uno en T. Ninguna es la punta de un muro ni la
 * esquina de un cuerpo, y son justo los puntos por donde pasa el contorno de
 * un ambiente.
 *
 * Sólo cuentan los cortes que caen dentro de las dos caras: dos muros que no
 * se tocan no tienen esquina en común aunque sus líneas, alargadas, se crucen.
 */
export function crucesDeCaras(
  unas: { a: Punto; b: Punto }[],
  otras: { a: Punto; b: Punto }[]
): Punto[] {
  const HOLGURA = 1e-6;
  const puntos: Punto[] = [];

  for (const una of unas) {
    const dx = una.b.x - una.a.x;
    const dy = una.b.y - una.a.y;
    for (const otra of otras) {
      const ex = otra.b.x - otra.a.x;
      const ey = otra.b.y - otra.a.y;
      const det = dx * ey - dy * ex;
      if (Math.abs(det) < 1e-9) continue;

      const qx = otra.a.x - una.a.x;
      const qy = otra.a.y - una.a.y;
      const t = (qx * ey - qy * ex) / det;
      const s = (qx * dy - qy * dx) / det;
      if (t < -HOLGURA || t > 1 + HOLGURA || s < -HOLGURA || s > 1 + HOLGURA) continue;

      puntos.push({ x: una.a.x + dx * t, y: una.a.y + dy * t });
    }
  }

  return puntos;
}

// ---- Dónde hay muro de verdad ---------------------------------------------

/** Un rectángulo en la elevación de un muro: entre qué distancias de su
 *  punta, en píxeles, y entre qué alturas, en metros. */
export type Pano = { desde: number; hasta: number; abajo: number; arriba: number };

/**
 * Lo que una pieza de hormigón le saca a un muro, visto en su elevación: el
 * tramo del muro que ocupa y entre qué alturas. Null si no lo toca, o si lo
 * toca apenas.
 *
 * **Donde hay hormigón no hay ladrillo**: la columna que está adentro del
 * muro y la viga que lo corona no se levantan de mampostería. Cuenta cuando
 * la pieza ocupa al menos la mitad del espesor del muro en ese tramo: una
 * columna de 13 en un muro de 15 lo corta; una viga de 12 que pasa por un
 * muro de 30 no, porque el ladrillo sigue al lado.
 *
 * `eje` es el eje del cuerpo del muro y `grosor` su espesor, en píxeles.
 */
export function sombraEnMuro(
  eje: { a: Punto; b: Punto },
  grosor: number,
  prisma: { huella: Punto[]; desde: number; hasta: number }
): Pano | null {
  const largo = distancia(eje.a, eje.b);
  if (!(largo > 0) || !(grosor > 0)) return null;

  const dx = (eje.b.x - eje.a.x) / largo;
  const dy = (eje.b.y - eje.a.y) / largo;
  const medio = grosor / 2;
  const cuerpo: Punto[] = [
    { x: eje.a.x - dy * medio, y: eje.a.y + dx * medio },
    { x: eje.b.x - dy * medio, y: eje.b.y + dx * medio },
    { x: eje.b.x + dy * medio, y: eje.b.y - dx * medio },
    { x: eje.a.x + dy * medio, y: eje.a.y - dx * medio },
  ];
  const adentro = recortar(prisma.huella, cuerpo);
  if (adentro.length < 3) return null;

  let desde = Infinity;
  let hasta = -Infinity;
  for (const p of adentro) {
    const s = (p.x - eje.a.x) * dx + (p.y - eje.a.y) * dy;
    desde = Math.min(desde, s);
    hasta = Math.max(hasta, s);
  }
  const tramo = hasta - desde;
  if (!(tramo > 1e-6) || areaDe(adentro) / (tramo * grosor) < 0.5) return null;
  return { desde, hasta, abajo: prisma.desde, arriba: prisma.hasta };
}

/**
 * Los paños de un muro: su elevación —de punta a punta y del piso a su
 * altura— menos los `huecos`: los vanos de sus aberturas y lo que ocupa el
 * hormigón (`sombraEnMuro`).
 *
 * La elevación se corta en una grilla por cada borde de cada hueco, se tira lo
 * que cae adentro de alguno y lo que queda se vuelve a juntar: primero de
 * abajo hacia arriba, y después a lo largo, donde dos tramos vecinos quedaron
 * iguales. Los huecos pueden pisarse entre sí —una viga sobre una puerta—:
 * lo tapado se cuenta una vez.
 *
 * De acá salen las dos cosas: cuánta mampostería hay —la suma de los paños—
 * y qué cajas dibujar en el 3D.
 */
export function panosDeMuro(largo: number, alto: number, huecos: Pano[]): Pano[] {
  if (!(largo > 0) || !(alto > 0)) return [];

  const HOLGURA = 1e-6;
  const recortados = huecos
    .map((h) => ({
      desde: Math.max(0, h.desde),
      hasta: Math.min(largo, h.hasta),
      abajo: Math.max(0, h.abajo),
      arriba: Math.min(alto, h.arriba),
    }))
    .filter((h) => h.hasta - h.desde > HOLGURA && h.arriba - h.abajo > HOLGURA);

  const cortes = (valores: number[]) =>
    Array.from(new Set(valores)).sort((p, q) => p - q);
  const aLoLargo = cortes([0, largo, ...recortados.flatMap((h) => [h.desde, h.hasta])]);
  const aLoAlto = cortes([0, alto, ...recortados.flatMap((h) => [h.abajo, h.arriba])]);

  // Cada tramo a lo largo, con sus franjas de muro ya juntadas en altura.
  const tramos: { desde: number; hasta: number; franjas: [number, number][] }[] = [];
  for (let i = 0; i + 1 < aLoLargo.length; i++) {
    const s0 = aLoLargo[i];
    const s1 = aLoLargo[i + 1];
    if (!(s1 - s0 > HOLGURA)) continue;
    const s = (s0 + s1) / 2;

    const franjas: [number, number][] = [];
    for (let k = 0; k + 1 < aLoAlto.length; k++) {
      const z0 = aLoAlto[k];
      const z1 = aLoAlto[k + 1];
      if (!(z1 - z0 > HOLGURA)) continue;
      const z = (z0 + z1) / 2;
      const tapado = recortados.some(
        (h) => s > h.desde && s < h.hasta && z > h.abajo && z < h.arriba
      );
      if (tapado) continue;
      const ultima = franjas[franjas.length - 1];
      if (ultima && Math.abs(ultima[1] - z0) < HOLGURA) ultima[1] = z1;
      else franjas.push([z0, z1]);
    }

    // Si quedó igual que el tramo de al lado, es el mismo paño más largo.
    const anterior = tramos[tramos.length - 1];
    const igual =
      anterior &&
      Math.abs(anterior.hasta - s0) < HOLGURA &&
      anterior.franjas.length === franjas.length &&
      anterior.franjas.every(
        (f, k) => Math.abs(f[0] - franjas[k][0]) < HOLGURA && Math.abs(f[1] - franjas[k][1]) < HOLGURA
      );
    if (igual) anterior.hasta = s1;
    else tramos.push({ desde: s0, hasta: s1, franjas });
  }

  return tramos.flatMap((t) =>
    t.franjas.map(([abajo, arriba]) => ({ desde: t.desde, hasta: t.hasta, abajo, arriba }))
  );
}

/**
 * Los vanos de un muro como huecos de su elevación. `arranque` es a cuánto de
 * la punta del eje que se está usando empieza el eje sin estirar, que es
 * sobre el que van las aberturas: cero si es el mismo.
 */
export function vanosDeMuro(
  aberturas: Abertura[],
  muroId: string,
  largoDelEje: number,
  arranque: number,
  mpp: number
): (Pano & { abertura: Abertura })[] {
  return aberturas
    .filter((ab) => ab.muroId === muroId)
    .map((ab) => {
      const centro = arranque + ab.t * largoDelEje;
      const mitad = ab.ancho / mpp / 2;
      const abajo = ab.antepecho ?? 0;
      return {
        abertura: ab,
        desde: centro - mitad,
        hasta: centro + mitad,
        abajo,
        arriba: abajo + ab.alto,
      };
    });
}

/**
 * Cuánta mampostería tiene un muro, en m²: su largo por su altura, menos sus
 * puertas y ventanas y menos lo que ocupa el hormigón. Devuelve también
 * cuánto fue de hormigón, para poder decirlo.
 *
 * El largo es el del eje del ladrillo, de unión a unión (`tramoDeMamposteria`):
 * en una esquina cada muro llega al eje del otro, así el rincón se cuenta una
 * vez. Sin `muros`, el de la línea marcada.
 */
export function mamposteriaDeMuro(
  muro: Muro,
  aberturas: Abertura[],
  hormigon: { huella: Punto[]; desde: number; hasta: number }[],
  mpp: number,
  alto: number,
  muros: Muro[] = []
): { superficie: number; hormigon: number } {
  // El hormigón reemplaza al ladrillo, no al revoque: se lo busca en el núcleo.
  const { nucleo } = cuerpoDeMuro(muro, [], mpp, 0);
  const largoMarcado = distancia(nucleo.ejeA, nucleo.ejeB);
  const [s0, s1] = muros.length > 0 ? tramoDeMamposteria(muro, muros, mpp) : [0, largoMarcado];
  const d =
    largoMarcado > 0
      ? { x: (nucleo.ejeB.x - nucleo.ejeA.x) / largoMarcado, y: (nucleo.ejeB.y - nucleo.ejeA.y) / largoMarcado }
      : { x: 0, y: 0 };
  const eje = {
    a: { x: nucleo.ejeA.x + d.x * s0, y: nucleo.ejeA.y + d.y * s0 },
    b: { x: nucleo.ejeA.x + d.x * s1, y: nucleo.ejeA.y + d.y * s1 },
  };
  const largo = s1 - s0;
  // Las aberturas van sobre la línea marcada: corridas lo que el tramo arranca antes o después.
  const vanos = vanosDeMuro(aberturas, muro.id, largoMarcado, -s0, mpp);
  const sombras = hormigon
    .map((prisma) => sombraEnMuro(eje, nucleo.grosor, prisma))
    .filter((s): s is Pano => s !== null);

  const medir = (huecos: Pano[]) =>
    panosDeMuro(largo, alto, huecos).reduce(
      (t, p) => t + (p.hasta - p.desde) * mpp * (p.arriba - p.abajo),
      0
    );
  const sinHormigon = sombras.length > 0 ? medir([...vanos, ...sombras]) : medir(vanos);
  return {
    superficie: sinHormigon,
    hormigon: sombras.length > 0 ? medir(vanos) - sinHormigon : 0,
  };
}

// ---- Las aberturas, cuando su muro cambia ---------------------------------

/**
 * Las aberturas **en el mismo lugar del plano** después de que sus muros
 * cambiaron de largo o de posición.
 *
 * Una abertura no guarda coordenadas: guarda en qué fracción del largo de su
 * muro está. Eso la lleva con el muro cuando se lo mueve entero, pero al
 * estirarlo la corre: la puerta que estaba al 30 % de un muro de 3 m —a 90
 * cm de la esquina— queda a 1,20 si el muro pasa a medir 4. Y una puerta no
 * se mueve porque la pared siga más allá.
 *
 * Por eso, para cada abertura de un muro que cambió, se busca dónde estaba su
 * centro (`antes`) y se rehace la fracción sobre el muro como quedó
 * (`despues`). Si el muro giró, es el punto más cercano de su nueva línea. Si
 * se acortó hasta pisarla, la abertura se queda adentro, contra la punta:
 * nunca asoma. Las de los muros que no cambiaron vuelven tal cual.
 *
 * Conviene que `antes` sea el dibujo de **cuando empezó el arrastre**, no el
 * del paso anterior: así una abertura que la punta empujó vuelve a su lugar si
 * el muro se alarga otra vez.
 */
export function aberturasEnSuLugar(
  aberturas: Abertura[],
  antes: Muro[],
  despues: Muro[],
  mpp: number | null,
  u: number
): Abertura[] {
  return aberturas.map((abertura) => {
    const viejo = antes.find((m) => m.id === abertura.muroId);
    const nuevo = despues.find((m) => m.id === abertura.muroId);
    if (!viejo || !nuevo) return abertura;
    if (
      mismoPunto(viejo.a, nuevo.a) &&
      mismoPunto(viejo.b, nuevo.b) &&
      viejo.espesor === nuevo.espesor &&
      viejo.referencia === nuevo.referencia
    ) {
      return abertura;
    }

    // Las aberturas van sobre el eje del cuerpo, de punta a punta de lo
    // marcado: no depende de los vecinos, sólo del propio muro.
    const ejeViejo = cuerpoDeMuro(viejo, [], mpp, u);
    const ejeNuevo = cuerpoDeMuro(nuevo, [], mpp, u);
    const centro = {
      x: ejeViejo.ejeA.x + (ejeViejo.ejeB.x - ejeViejo.ejeA.x) * abertura.t,
      y: ejeViejo.ejeA.y + (ejeViejo.ejeB.y - ejeViejo.ejeA.y) * abertura.t,
    };

    const dx = ejeNuevo.ejeB.x - ejeNuevo.ejeA.x;
    const dy = ejeNuevo.ejeB.y - ejeNuevo.ejeA.y;
    const largo2 = dx * dx + dy * dy;
    if (largo2 === 0) return abertura;

    const t = ((centro.x - ejeNuevo.ejeA.x) * dx + (centro.y - ejeNuevo.ejeA.y) * dy) / largo2;
    // Entera adentro del muro; si no entra, al medio. Sin escala no se sabe
    // cuánto ocupa: sólo se la deja adentro.
    const medio = mpp !== null ? abertura.ancho / mpp / 2 / Math.sqrt(largo2) : 0;
    return {
      ...abertura,
      t: medio >= 0.5 ? 0.5 : Math.min(1 - medio, Math.max(medio, t)),
    };
  });
}

// ---- Los lados de un ambiente ---------------------------------------------

/** Dónde se cruzan dos rectas, cada una por un punto y con una dirección. */
function cruce(p: Punto, dp: Punto, q: Punto, dq: Punto): Punto | null {
  const det = dp.x * dq.y - dp.y * dq.x;
  if (Math.abs(det) < 1e-9) return null;
  const t = ((q.x - p.x) * dq.y - (q.y - p.y) * dq.x) / det;
  return { x: p.x + dp.x * t, y: p.y + dp.y * t };
}

/**
 * Desde qué inclinación un vecino cuenta como "en la misma línea" que el lado
 * que se corre: el seno de unos 8°. Calcado a pulso, un tramo que es
 * continuación de otro nunca queda exactamente paralelo, y tratarlo como un
 * lado que cruza mandaría la esquina a decenas de metros.
 */
const CASI_PARALELO = 0.14;

/**
 * Corre un lado de un polígono en paralelo a sí mismo.
 *
 * El lado es el que va del punto `indice` al siguiente, y `cuanto` la distancia
 * sobre su normal (la misma de los muros). Qué pasa en cada punta depende del
 * vecino:
 *
 *  - Si el vecino cruza al lado —la esquina de un cuarto—, no cambia de
 *    dirección: se alarga o se acorta hasta donde el lado corrido lo corta.
 *    Es mover una pared.
 *  - Si el vecino sigue en la misma línea —el lado es un tramo de una pared
 *    más larga—, la punta se queda donde está y aparece un punto nuevo: el
 *    tramo sale o entra y deja un escalón a escuadra. Es como se arma un
 *    placard, un nicho o un saliente a partir de un rectángulo.
 *
 * Devuelve el polígono y las dos puntas del lado ya corrido. Con `cuanto` en
 * cero devuelve el mismo polígono: un escalón de cero deja puntos repetidos.
 */
export function moverLado(
  puntos: Punto[],
  indice: number,
  cuanto: number
): { puntos: Punto[]; a: Punto; b: Punto } {
  const n = puntos.length;
  const i = (((indice % n) + n) % n) || 0;
  const j = (i + 1) % n;
  const a = puntos[i];
  const b = puntos[j];
  const largo = n >= 3 ? distancia(a, b) : 0;
  if (!(largo > 0) || Math.abs(cuanto) < 1e-9) return { puntos, a, b };

  const d = { x: (b.x - a.x) / largo, y: (b.y - a.y) / largo };
  const corridoA = { x: a.x - d.y * cuanto, y: a.y + d.x * cuanto };
  const corridoB = { x: b.x - d.y * cuanto, y: b.y + d.x * cuanto };

  /** Dónde el lado corrido corta al vecino, o null si el vecino sigue en línea. */
  const corte = (esquina: Punto, vecino: Punto): Punto | null => {
    const v = { x: esquina.x - vecino.x, y: esquina.y - vecino.y };
    const largoDelVecino = Math.hypot(v.x, v.y);
    if (largoDelVecino === 0) return null;
    if (Math.abs(d.x * v.y - d.y * v.x) / largoDelVecino < CASI_PARALELO) return null;
    return cruce(corridoA, d, vecino, v);
  };

  const nuevoA = corte(a, puntos[(i - 1 + n) % n]);
  const nuevoB = corte(b, puntos[(j + 1) % n]);

  const resultado: Punto[] = [];
  puntos.forEach((p, k) => {
    // Sin corte, la punta vieja se queda y la corrida se suma del lado del
    // tramo: antes de ella en `a`, después en `b`.
    if (k === i) resultado.push(...(nuevoA ? [nuevoA] : [a, corridoA]));
    else if (k === j) resultado.push(...(nuevoB ? [nuevoB] : [corridoB, b]));
    else resultado.push(p);
  });

  return { puntos: resultado, a: nuevoA ?? corridoA, b: nuevoB ?? corridoB };
}

/**
 * Pone a escuadra un polígono calcado a pulso.
 *
 * Cada lado que está casi horizontal o casi vertical —a menos de `grados` de
 * estarlo— pasa a estarlo del todo; los que van en diagonal a propósito se
 * dejan. Varios lados seguidos de la misma clase son un solo tramo recto y
 * quedan en la misma línea, a la altura promedio de sus puntos: así el
 * polígono se mueve lo menos posible.
 */
export function escuadrar(puntos: Punto[], grados = 15): Punto[] {
  const n = puntos.length;
  if (n < 3) return puntos;

  type Clase = "h" | "v" | null;
  const clases: Clase[] = puntos.map((p, i) => {
    const q = puntos[(i + 1) % n];
    const angulo = (Math.atan2(Math.abs(q.y - p.y), Math.abs(q.x - p.x)) * 180) / Math.PI;
    return angulo <= grados ? "h" : angulo >= 90 - grados ? "v" : null;
  });

  // Dónde empieza un tramo: en un lado cuya clase cambia respecto del anterior.
  const inicio = clases.findIndex((c, i) => c !== clases[(i - 1 + n) % n]);
  if (inicio === -1) return puntos;

  // Para cada lado, la coordenada en la que queda: la y de un horizontal, la x
  // de un vertical.
  const valor: (number | null)[] = new Array(n).fill(null);
  let k = 0;
  while (k < n) {
    const primero = (inicio + k) % n;
    const clase = clases[primero];
    let cuantos = 1;
    while (k + cuantos < n && clases[(inicio + k + cuantos) % n] === clase) cuantos++;

    if (clase !== null) {
      // Los puntos del tramo: los de sus lados, más el último.
      let suma = 0;
      for (let m = 0; m <= cuantos; m++) {
        const p = puntos[(primero + m) % n];
        suma += clase === "h" ? p.y : p.x;
      }
      const promedio = suma / (cuantos + 1);
      for (let m = 0; m < cuantos; m++) valor[(primero + m) % n] = promedio;
    }
    k += cuantos;
  }

  return puntos.map((p, i) => {
    let { x, y } = p;
    // El lado que llega al punto y el que sale de él.
    for (const lado of [(i - 1 + n) % n, i]) {
      const v = valor[lado];
      if (v === null) continue;
      if (clases[lado] === "h") y = v;
      else x = v;
    }
    return { x, y };
  });
}

// ---- Muros encimados ------------------------------------------------------

/** Dos muros cuyos cuerpos se pisan a lo largo, y cuánto (en píxeles). */
export type Solape = { ids: [string, string]; largo: number };

/**
 * Los pares de muros que están uno encima del otro.
 *
 * Pasa calcando: un muro se traza dos veces, o uno largo se dibuja sobre otro
 * corto que ya estaba. El dibujo no lo impide —hay casos en que dos muros se
 * tocan a propósito—, pero el largo de ese tramo queda contado dos veces, y
 * un total que lo calla está mal sin avisar. Acá se los encuentra para
 * decirlo; qué muro sobra lo decide quien dibuja.
 *
 * Dos muros se pisan si corren paralelos, sus cuerpos se superponen de
 * costado —la distancia entre ejes es menor que la suma de los medios
 * espesores— y comparten más de dos centímetros a lo largo. Dos muros en
 * esquina no cuentan, ni dos que se continúan punta con punta, ni una pared
 * doble con las caras apoyadas.
 *
 * Sin escala no hay espesores que comparar y devuelve vacío.
 */
export function solapesDeMuros(muros: Muro[], mpp: number | null): Solape[] {
  if (mpp === null) return [];

  // Sin vecinos: interesa el eje de cada cuerpo de punta a punta, sin estirar.
  const cuerpos = muros.map((m) => cuerpoDeMuro(m, [], mpp, 0));
  const minimo = 0.02 / mpp;
  const solapes: Solape[] = [];

  for (let i = 0; i < muros.length; i++) {
    const uno = cuerpos[i];
    const largo = distancia(uno.ejeA, uno.ejeB);
    if (!(largo > 0)) continue;
    const dx = (uno.ejeB.x - uno.ejeA.x) / largo;
    const dy = (uno.ejeB.y - uno.ejeA.y) / largo;

    for (let j = i + 1; j < muros.length; j++) {
      const otro = cuerpos[j];
      const largoDelOtro = distancia(otro.ejeA, otro.ejeB);
      if (!(largoDelOtro > 0)) continue;

      // Paralelos, a menos de unos tres grados.
      const ex = (otro.ejeB.x - otro.ejeA.x) / largoDelOtro;
      const ey = (otro.ejeB.y - otro.ejeA.y) / largoDelOtro;
      if (Math.abs(dx * ey - dy * ex) > 0.05) continue;

      // Encimados de costado: las dos puntas del otro, cerca del eje de éste.
      const alCostado = (p: Punto) =>
        Math.abs((p.x - uno.ejeA.x) * -dy + (p.y - uno.ejeA.y) * dx);
      const holgura = (uno.grosor + otro.grosor) / 2 - Math.min(uno.grosor, otro.grosor) * 0.05;
      if (alCostado(otro.ejeA) >= holgura || alCostado(otro.ejeB) >= holgura) continue;

      // Y a lo largo: cuánto del otro cae dentro de éste.
      const s1 = (otro.ejeA.x - uno.ejeA.x) * dx + (otro.ejeA.y - uno.ejeA.y) * dy;
      const s2 = (otro.ejeB.x - uno.ejeA.x) * dx + (otro.ejeB.y - uno.ejeA.y) * dy;
      const compartido = Math.min(largo, Math.max(s1, s2)) - Math.max(0, Math.min(s1, s2));
      if (compartido > minimo) {
        solapes.push({ ids: [muros[i].id, muros[j].id], largo: compartido });
      }
    }
  }

  return solapes;
}

// ---- Las caras de los muros -----------------------------------------------

/**
 * Un tramo visible de una cara de un muro: lo que se revoca, se pinta o se
 * reviste. Es la unidad de las terminaciones.
 */
export type Cara = {
  /** Qué cara es: `muro|lado|ambiente`. Ver `Dibujo.caras`. */
  clave: string;
  muroId: string;
  /** De qué lado del muro está, sobre su normal. */
  lado: 1 | -1;
  /**
   * Si es un **canto** —la punta del muro, de cara a cara— dice cuál: la del
   * primer punto o la del segundo. Null en las dos caras largas. Un canto no
   * tiene aberturas y mide el espesor del muro.
   */
  punta: "a" | "b" | null;
  /** Los dos extremos del tramo, sobre la cara. En píxeles. */
  a: Punto;
  b: Punto;
  largo: number;
  /** Dónde cae a lo largo del eje del muro, desde su primer punto: para saber
   *  qué aberturas le tocan. */
  desde: number;
  hasta: number;
  /** El ambiente al que da, o null si no da a ninguno dibujado. */
  ambienteId: string | null;
};

/** Cuánto por delante de la cara se mira si hay otro muro: medio milímetro en
 *  un plano a un centímetro por píxel. Alcanza para distinguir "delante" de
 *  "detrás" sin pisar nada. */
const DELANTE = 0.05;

/** A qué distancias de la cara se busca el ambiente, en metros. Varias,
 *  porque un contorno calcado a pulso puede no llegar hasta la cara. */
const DONDE_BUSCAR_AMBIENTE = [0.03, 0.1, 0.25];

export function adentro(p: Punto, poligono: Punto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      dentro = !dentro;
    }
  }
  return dentro;
}

/**
 * Para qué valores de s vale `desde <= fijo + pendiente * s <= hasta`, o null
 * si para ninguno.
 */
function tramoDentro(
  fijo: number,
  pendiente: number,
  desde: number,
  hasta: number
): [number, number] | null {
  if (Math.abs(pendiente) < 1e-12) {
    return fijo >= desde && fijo <= hasta ? [-Infinity, Infinity] : null;
  }
  const s1 = (desde - fijo) / pendiente;
  const s2 = (hasta - fijo) / pendiente;
  return [Math.min(s1, s2), Math.max(s1, s2)];
}

/**
 * Los tramos de una línea que quedan adentro del cuerpo de otro muro.
 *
 * La línea sale de `origen` en la dirección (dx, dy) y mide `largo`. `propio`
 * es el muro al que pertenece, que no se tapa a sí mismo.
 */
function tramosTapados(
  cuerpos: Cuerpo[],
  propio: number,
  origen: Punto,
  dx: number,
  dy: number,
  largo: number
): [number, number][] {
  const tapados: [number, number][] = [];
  cuerpos.forEach((otro, j) => {
    if (j === propio) return;
    const largoDelOtro = distancia(otro.a, otro.b);
    if (!(largoDelOtro > 0)) return;
    const ex = (otro.b.x - otro.a.x) / largoDelOtro;
    const ey = (otro.b.y - otro.a.y) / largoDelOtro;
    const qx = origen.x - otro.a.x;
    const qy = origen.y - otro.a.y;

    const aLoLargo = tramoDentro(qx * ex + qy * ey, dx * ex + dy * ey, 0, largoDelOtro);
    if (!aLoLargo) return;
    const aLoAncho = tramoDentro(
      qx * -ey + qy * ex,
      dx * -ey + dy * ex,
      -otro.grosor / 2,
      otro.grosor / 2
    );
    if (!aLoAncho) return;

    const s0 = Math.max(0, aLoLargo[0], aLoAncho[0]);
    const s1 = Math.min(largo, aLoLargo[1], aLoAncho[1]);
    if (s1 - s0 > 1e-6) tapados.push([s0, s1]);
  });
  return tapados;
}

/** Lo que queda a la vista de una línea, sacándole los tramos tapados. */
function loQueSeVe(tapados: [number, number][], largo: number): [number, number][] {
  const enOrden = [...tapados].sort((p, q) => p[0] - q[0]);
  const vistos: [number, number][] = [];
  let hasta = 0;
  for (const [s0, s1] of enOrden) {
    if (s0 > hasta) vistos.push([hasta, s0]);
    hasta = Math.max(hasta, s1);
  }
  if (hasta < largo) vistos.push([hasta, largo]);
  return vistos;
}

/**
 * Desglosa cada muro en los tramos de sus dos caras que quedan a la vista.
 *
 * Una cara no es entera de punta a punta: donde otro muro llega contra ella
 * —el encuentro en T, la esquina— ese pedazo queda tapado y no lleva
 * terminación. Lo que queda son los tramos, y cada uno da a un ambiente: una
 * pared que separa el baño del pasillo tiene una cara de cada uno, y el muro
 * que las cruza parte en dos la del pasillo.
 *
 * "Tapado" se decide mirando apenas por delante de la cara: si ahí hay cuerpo
 * de otro muro, no se ve. Mirar delante y no sobre la cara es lo que separa
 * la esquina de afuera —donde el otro muro está detrás y la cara sigue a la
 * vista— de un muro que llega de frente.
 *
 * Las puertas y ventanas no cortan el tramo: arriba de una puerta sigue
 * habiendo pared. Se descuentan como superficie (`medirCaras`).
 *
 * Además de las dos caras largas, cada muro tiene dos **cantos**: sus puntas.
 * Casi siempre están tapadas —contra otro muro, o adentro de la esquina— y no
 * cuentan; la que queda suelta, la de un muro que termina en medio de un
 * ambiente, es pared a la vista y lleva terminación como cualquier otra. Para
 * un canto no alcanza con mirar delante: en una esquina los dos muros se
 * estiran hasta llenarla, y la punta de uno queda sobre la cara de afuera del
 * otro, con aire delante. Ahí es la misma superficie contada dos veces. Por
 * eso también se mira apenas **detrás**: si la punta está metida en el cuerpo
 * de otro muro, no es un canto.
 *
 * Sin escala no hay espesores y devuelve vacío.
 */
export function carasVisibles(
  muros: Muro[],
  ambientes: { id: string; puntos: Punto[] }[],
  mpp: number | null
): Cara[] {
  if (mpp === null) return [];

  const cuerpos = muros.map((m) => cuerpoDeMuro(m, muros, mpp, 0));
  const minimo = 0.01 / mpp;
  const caras: Cara[] = [];

  muros.forEach((muro, i) => {
    const cuerpo = cuerpos[i];
    const largo = distancia(cuerpo.a, cuerpo.b);
    if (!(largo > 0)) return;

    const dx = (cuerpo.b.x - cuerpo.a.x) / largo;
    const dy = (cuerpo.b.y - cuerpo.a.y) / largo;
    // Cuánto se estiró el cuerpo antes del primer punto marcado.
    const estirado = arranqueDe(cuerpo);

    for (const lado of [1, -1] as const) {
      const nx = -dy * lado;
      const ny = dx * lado;
      const origen = {
        x: cuerpo.a.x + nx * (cuerpo.grosor / 2),
        y: cuerpo.a.y + ny * (cuerpo.grosor / 2),
      };
      // Cuánto por delante se mira: medio centímetro en el plano, para que
      // un muro que llega a esta cara con un desfasaje de milímetros igual la
      // tape —si no, queda un pedazo de cara "a la vista" adentro de la
      // esquina, y se computa—.
      const adelante = Math.max(DELANTE, 0.005 / mpp);
      const delante = { x: origen.x + nx * adelante, y: origen.y + ny * adelante };

      // Los tramos tapados por el cuerpo de otro muro.
      const tapados: [number, number][] = [];
      cuerpos.forEach((otro, j) => {
        if (j === i) return;
        const largoDelOtro = distancia(otro.a, otro.b);
        if (!(largoDelOtro > 0)) return;
        const ex = (otro.b.x - otro.a.x) / largoDelOtro;
        const ey = (otro.b.y - otro.a.y) / largoDelOtro;
        const qx = delante.x - otro.a.x;
        const qy = delante.y - otro.a.y;

        const aLoLargo = tramoDentro(qx * ex + qy * ey, dx * ex + dy * ey, 0, largoDelOtro);
        if (!aLoLargo) return;
        const aLoAncho = tramoDentro(
          qx * -ey + qy * ex,
          dx * -ey + dy * ex,
          -otro.grosor / 2,
          otro.grosor / 2
        );
        if (!aLoAncho) return;

        const s0 = Math.max(0, aLoLargo[0], aLoAncho[0]);
        const s1 = Math.min(largo, aLoLargo[1], aLoAncho[1]);
        if (s1 - s0 > 1e-6) tapados.push([s0, s1]);
      });

      // Lo que queda a la vista es lo que no está tapado.
      tapados.sort((p, q) => p[0] - q[0]);
      const vistos: [number, number][] = [];
      let hasta = 0;
      for (const [s0, s1] of tapados) {
        if (s0 > hasta) vistos.push([hasta, s0]);
        hasta = Math.max(hasta, s1);
      }
      if (hasta < largo) vistos.push([hasta, largo]);

      /** El ambiente que hay delante de un punto de la cara, o null. */
      const ambienteEn = (s: number): string | null => {
        for (const metros of DONDE_BUSCAR_AMBIENTE) {
          const sonda = {
            x: origen.x + dx * s + (nx * metros) / mpp,
            y: origen.y + dy * s + (ny * metros) / mpp,
          };
          const ambiente = ambientes.find((amb) => adentro(sonda, amb.puntos));
          if (ambiente) return ambiente.id;
        }
        return null;
      };

      // Una cara que da a dos ambientes —el medianero entre un dormitorio y
      // un baño— se corta donde cambia el ambiente: cada tramo lleva la
      // terminación del suyo. Los cortes son donde la línea de delante de la
      // cara cruza un borde de algún ambiente.
      const sondaMedia = DONDE_BUSCAR_AMBIENTE[1] / mpp;
      const cortes: number[] = [];
      for (const amb of ambientes) {
        for (let k = 0; k < amb.puntos.length; k++) {
          const p = amb.puntos[k];
          const q = amb.puntos[(k + 1) % amb.puntos.length];
          // La línea: origen + d·s + n·sondaMedia. El borde: p + (q − p)·u.
          const ex = q.x - p.x;
          const ey = q.y - p.y;
          const det = dx * -ey - dy * -ex;
          if (Math.abs(det) < 1e-9) continue;
          const wx = p.x - (origen.x + nx * sondaMedia);
          const wy = p.y - (origen.y + ny * sondaMedia);
          const s = (wx * -ey - wy * -ex) / det;
          const u = (dx * wy - dy * wx) / det;
          if (u >= 0 && u <= 1) cortes.push(s);
        }
      }

      // Un borde de ambiente a menos de 15 cm de la punta de la cara no es un
      // cambio de ambiente: es el contorno calcado un poco más adentro —sobre
      // la cara terminada y no sobre la del ladrillo, o antes de la punta de un
      // muro que sigue unos centímetros—. Cortar ahí dejaba un pedazo de cara
      // "sin ambiente" en cada rincón y en cada punta.
      const margen = Math.max(minimo, 0.15 / mpp);
      const tramos: [number, number, string | null][] = [];
      for (const [v0, v1] of vistos) {
        const puntos = [v0, ...cortes.filter((s) => s > v0 + margen && s < v1 - margen).sort((p, q) => p - q), v1];
        for (let k = 0; k < puntos.length - 1; k++) {
          const s0 = puntos[k];
          const s1 = puntos[k + 1];
          if (s1 - s0 < minimo) continue;
          const ambienteId = ambienteEn((s0 + s1) / 2);
          const anterior = tramos[tramos.length - 1];
          // Dos tramos seguidos del mismo ambiente son la misma cara.
          if (anterior && anterior[2] === ambienteId && Math.abs(anterior[1] - s0) < 1e-6) {
            anterior[1] = s1;
          } else {
            tramos.push([s0, s1, ambienteId]);
          }
        }
      }

      for (const [s0, s1, ambienteId] of tramos) {
        if (s1 - s0 < minimo) continue;
        const a = { x: origen.x + dx * s0, y: origen.y + dy * s0 };
        const b = { x: origen.x + dx * s1, y: origen.y + dy * s1 };

        caras.push({
          clave: `${muro.id}|${lado}|${ambienteId ?? ""}`,
          muroId: muro.id,
          lado,
          punta: null,
          a,
          b,
          largo: s1 - s0,
          desde: s0 - estirado,
          hasta: s1 - estirado,
          ambienteId,
        });
      }
    }

    // Los cantos: cada punta del muro, de cara a cara.
    for (const punta of ["a", "b"] as const) {
      const fin = punta === "a" ? cuerpo.a : cuerpo.b;
      // Hacia afuera del muro...
      const ox = punta === "a" ? -dx : dx;
      const oy = punta === "a" ? -dy : dy;
      // ...y a lo ancho, en el sentido que deja esa dirección como su normal:
      // así un canto se dibuja y se sondea igual que una cara larga.
      const ex = oy;
      const ey = -ox;
      const origen = {
        x: fin.x - ex * (cuerpo.grosor / 2),
        y: fin.y - ey * (cuerpo.grosor / 2),
      };
      const corrido = (cuanto: number) => ({
        x: origen.x + ox * cuanto,
        y: origen.y + oy * cuanto,
      });

      const vistos = loQueSeVe(
        [
          ...tramosTapados(cuerpos, i, corrido(DELANTE), ex, ey, cuerpo.grosor),
          ...tramosTapados(cuerpos, i, corrido(-DELANTE), ex, ey, cuerpo.grosor),
        ],
        cuerpo.grosor
      );

      for (const [s0, s1] of vistos) {
        if (s1 - s0 < minimo) continue;
        const a = { x: origen.x + ex * s0, y: origen.y + ey * s0 };
        const b = { x: origen.x + ex * s1, y: origen.y + ey * s1 };
        const medio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

        let ambienteId: string | null = null;
        for (const metros of DONDE_BUSCAR_AMBIENTE) {
          const sonda = { x: medio.x + (ox * metros) / mpp, y: medio.y + (oy * metros) / mpp };
          const ambiente = ambientes.find((amb) => adentro(sonda, amb.puntos));
          if (ambiente) {
            ambienteId = ambiente.id;
            break;
          }
        }

        caras.push({
          clave: `${muro.id}|${punta}|${ambienteId ?? ""}`,
          muroId: muro.id,
          lado: 1,
          punta,
          a,
          b,
          largo: s1 - s0,
          // Un canto se mide de punta a punta de sí mismo: no está sobre el
          // eje del muro, y no hay aberturas que ubicar en él.
          desde: 0,
          hasta: s1 - s0,
          ambienteId,
        });
      }
    }
  });

  return caras;
}

/**
 * Un pedazo de una cara. A lo largo, una puerta o una ventana la parten: a los
 * costados queda el paño, de piso a techo, y en el ancho del vano lo que hay
 * de pared arriba —el dintel— y, en una ventana, abajo —el antepecho—. Las
 * tres cosas son pared y llevan la misma terminación; se separan porque
 * miden distinto y porque es la cuenta que hay que poder revisar.
 */
export type ParteDeCara = {
  tipo: "pano" | "dintel" | "antepecho";
  /** El nombre de la abertura, en un dintel o un antepecho. */
  abertura: string | null;
  /** Los extremos sobre la cara, en píxeles. */
  a: Punto;
  b: Punto;
  /** En metros. */
  ancho: number;
  alto: number;
  /** A qué altura del piso arranca: cero, salvo el dintel. */
  desde: number;
  superficie: number;
};

/** Una capa de una cara, con lo que mide ahí. */
export type CapaMedida = Capa & {
  /** Si es una capa dibujada sobre la cara (`Dibujo.capas`) y no una que la
   *  cara hereda de su tipo de muro o de su ambiente. */
  dibujada?: boolean;
  /** De qué capa dibujada es, por su id. */
  capaId?: string;
  /** Desde qué altura arranca, en metros: cero salvo en una capa de un tipo
   *  de muro que va por encima de otra (el látex sobre el porcelanato). */
  desde: number;
  /** Hasta qué altura sube de verdad en esta cara, en metros. */
  alto: number;
  superficie: number;
};

/**
 * Cuánto hay de una capa en toda la planta.
 *
 * La superficie es de todas las veces que aparece. El volumen, sólo de las
 * que tienen espesor cargado: superficie por espesor, que es de donde sale el
 * material. `espesor` es el de todas si es el mismo en todos lados; null si
 * hay más de uno o si a alguna le falta —el volumen entonces es parcial—.
 */
export type FilaDeCapa = {
  capa: string;
  superficie: number;
  volumen: number;
  espesor: number | null;
};

/** Va juntando lo de cada capa, por su tarea. */
class Acumulado {
  private filas = new Map<
    string,
    { superficie: number; volumen: number; espesores: Set<number | null> }
  >();

  sumar(capa: Pick<Capa, "tarea" | "espesor">, superficie: number) {
    const fila = this.filas.get(capa.tarea) ?? {
      superficie: 0,
      volumen: 0,
      espesores: new Set<number | null>(),
    };
    fila.superficie += superficie;
    fila.volumen += superficie * (capa.espesor ?? 0);
    fila.espesores.add(capa.espesor);
    this.filas.set(capa.tarea, fila);
  }

  lista(): FilaDeCapa[] {
    return Array.from(this.filas, ([capa, f]) => ({
      capa,
      superficie: f.superficie,
      volumen: f.volumen,
      espesor: f.espesores.size === 1 ? Array.from(f.espesores)[0] : null,
    }));
  }
}

/**
 * Lo que las columnas de hormigón le cambian a la terminación de una cara.
 *
 * Una columna que **sobresale** de la cara del ladrillo más que el
 * revestimiento de ese lado hace una mocheta: el revoque la envuelve, y suma
 * sus dos costados —la profundidad que sobresale, dos veces— en cada capa,
 * en su franja de altura. El frente de la columna ya está en la cara: el
 * muro pasa por delante con el mismo largo. Si sobresale menos que el
 * revoque, el revoque la absorbe y no hay mocheta.
 *
 * Una columna de **hormigón visto** que llega a la cara no se reviste: se le
 * resta a cada capa el ancho de su frente; y no hace mochetas.
 *
 * Cada ajuste vale `metros` por metro de altura, entre `desde` y `hasta`:
 * positivo lo que se suma, negativo lo que se resta.
 */
function columnasEnLaCara(
  cara: Cara,
  cuerpo: Cuerpo,
  muro: Muro,
  columnas: { huella: Punto[]; visto: boolean; desde: number; hasta: number }[],
  mpp: number
): AjusteDeColumna[] {
  const { ejeA, ejeB, grosor } = cuerpo.nucleo;
  const largo = distancia(ejeA, ejeB);
  if (!(largo > 0) || columnas.length === 0) return [];
  const dx = (ejeB.x - ejeA.x) / largo;
  const dy = (ejeB.y - ejeA.y) / largo;
  const medio = grosor / 2;
  const revestimiento = muro.revestimiento?.[cara.lado === -1 ? "exterior" : "interior"] ?? 0;
  const holgura = 0.005;

  const ajustes: AjusteDeColumna[] = [];
  for (const col of columnas) {
    // A lo largo del muro y hacia el lado de la cara, desde el eje del núcleo.
    const a = col.huella.map((p) => (p.x - ejeA.x) * dx + (p.y - ejeA.y) * dy);
    const n = col.huella.map((p) => cara.lado * ((p.x - ejeA.x) * -dy + (p.y - ejeA.y) * dx));
    const ancho = Math.min(Math.max(...a), cara.hasta) - Math.max(Math.min(...a), cara.desde);
    if (ancho * mpp <= holgura) continue;
    // Tiene que tocar el núcleo: una columna suelta delante del muro no es suya.
    if (Math.min(...n) > medio + holgura / mpp) continue;
    if (Math.max(...n) < -medio) continue;

    const sobresale = (Math.max(...n) - medio) * mpp;
    const en: [number, number] = [Math.min(...a), Math.max(...a)];
    if (col.visto) {
      if (sobresale >= -holgura) ajustes.push({ metros: -ancho * mpp, desde: col.desde, hasta: col.hasta, en });
    } else if (sobresale > revestimiento + holgura) {
      ajustes.push({ metros: 2 * sobresale, desde: col.desde, hasta: col.hasta, en });
    }
  }
  return ajustes;
}

/** Lo que una columna le suma o le resta a una cara (`columnasEnLaCara`). */
type AjusteDeColumna = {
  metros: number;
  desde: number;
  hasta: number;
  /** Dónde está la columna a lo largo del muro, como `Cara.desde`. */
  en: [number, number];
};

/**
 * Los costados de los vanos que le tocan a una pieza de capa, en m²: el
 * revoque que entra en una puerta o una ventana —las dos jambas, el bajo del
 * dintel y, en una ventana, el antepecho—.
 *
 * Cada cara entra **hasta la mitad del ladrillo**: la carpintería va al medio,
 * y de cada lado se termina lo suyo. Una jamba se cuenta si la pieza llega
 * hasta ella, en la franja de altura de la capa; el bajo del dintel, si la
 * capa llega a la altura del dintel —el revoque sí, el látex de 2,10 para
 * arriba no—; el antepecho, lo mismo a su altura.
 */
function costadosDeVanos(
  pieza: PiezaDeCapa,
  cara: CaraMedida,
  cuerpo: Cuerpo | undefined,
  aberturas: Abertura[],
  mpp: number
): number {
  if (cara.punta !== null || !cuerpo) return 0;
  const profundidad = (cuerpo.nucleo.grosor * mpp) / 2;
  const largoDelEje = distancia(cuerpo.ejeA, cuerpo.ejeB);
  const tolerancia = 0.005 / mpp;
  const alto = cara.alto;
  const llega = (h: number) => pieza.abajo <= h + 1e-9 && pieza.arriba >= h - 1e-9;
  let total = 0;
  for (const ab of aberturas) {
    if (ab.muroId !== cara.muroId) continue;
    const centro = ab.t * largoDelEje;
    const medio = ab.ancho / mpp / 2;
    const [v0, v1] = [centro - medio, centro + medio];
    const abajo = ab.tipo === "ventana" ? Math.min(ab.antepecho ?? 0, alto) : 0;
    const arriba = Math.min(abajo + ab.alto, alto);
    const jamba = Math.max(0, Math.min(pieza.arriba, arriba) - Math.max(pieza.abajo, abajo));
    for (const borde of [v0, v1]) {
      if (borde >= pieza.s0 - tolerancia && borde <= pieza.s1 + tolerancia) total += jamba * profundidad;
    }
    const ancho = Math.max(0, Math.min(v1, pieza.s1) - Math.max(v0, pieza.s0)) * mpp;
    if (arriba < alto - 1e-9 && llega(arriba)) total += ancho * profundidad;
    if (abajo > 1e-9 && llega(abajo)) total += ancho * profundidad;
  }
  return total;
}

/** Sin repetir la misma tarea: dos manos de lo mismo no son el doble. */
function sinRepetir(capas: Capa[]): Capa[] {
  const vistas = new Set<string>();
  return capas.filter((capa) => !vistas.has(capa.tarea) && vistas.add(capa.tarea));
}

export type CaraMedida = Cara & {
  /** De piso a techo: la altura de su muro, o la de la planta. */
  alto: number;
  /** Los paños, dinteles y antepechos en que la parten sus aberturas. */
  partes: ParteDeCara[];
  /** m²: la suma de sus partes, que ya no incluye los vanos. */
  superficie: number;
  /** Sus capas, del muro hacia afuera: las propias o las de su ambiente. */
  capas: CapaMedida[];
  /** Si las capas son las suyas y no las que hereda de su ambiente. */
  propias: boolean;
};

export type MedidaDeCaras = {
  caras: CaraMedida[];
  /** Cada capa de pared, sumando todas las caras que la llevan: sus m² y,
   *  donde tiene espesor, sus m³. */
  porCapa: FilaDeCapa[];
  /** m² de cara a la vista que todavía no tienen ninguna capa. */
  sinTerminacion: number;
  /** Cada capa de piso y de cielorraso, sumando los ambientes. */
  pisos: FilaDeCapa[];
  cielorrasos: FilaDeCapa[];
  /** m² de ambiente que todavía no tienen piso, o cielorraso. */
  sinPiso: number;
  sinCielorraso: number;
  /**
   * La mampostería: cuánto muro hay de cada tipo, ya sin los vanos. Van los
   * m² y los m³ porque el catálogo cotiza unos de una forma y otros de la
   * otra: el ladrillo hueco por superficie, el común por volumen. Quién usa
   * cuál lo dice la unidad de la tarea.
   */
  muros: { capa: string; superficie: number; volumen: number }[];
  /** m² de muro que todavía no tienen tipo. */
  murosSinTipo: number;
  /** m² que se les descontaron a los muros por el hormigón que tienen
   *  adentro: ya no están en `muros` ni en `murosSinTipo`. */
  hormigonEnMuros: number;
  /** Los metros de zócalo de cada tarea: el largo de las caras que lo
   *  llevan, sin las puertas. */
  zocalos: { capa: string; largo: number }[];
  /** Las capas dibujadas, pieza por pieza: lo que se dibuja en la planta y
   *  se levanta en el 3D. */
  piezas: PiezaDeCapa[];
  /** Cada cajón de cielorraso con lo que mide. */
  cajones: MedidaDeCajon[];
};

export type MedidaDeCajon = {
  id: string;
  /** El ambiente donde está, o null. */
  ambienteId: string | null;
  /** El fondo, en m². */
  area: number;
  /** Los metros de frente: lo de su contorno que no va contra un muro. */
  frentes: number;
  /** Cuánto baja, de su techo —el cielorraso del ambiente o la losa— a su fondo. */
  alto: number;
  /** El fondo más los frentes por lo que baja: lo que se le computa a cada capa. */
  superficie: number;
};

/**
 * Cuánto del contorno de un polígono no va contra un muro, en píxeles. Se mira
 * apenas afuera de cada lado, en varios puntos: donde hay cuerpo de un muro,
 * ese pedazo va contra él. Un lado a medias cuenta a medias.
 */
function bordeLibre(puntos: Punto[], cuerpos: Cuerpo[], afuera: number): number {
  // De qué lado queda el afuera depende del sentido en que se lo recorrió.
  let doble = 0;
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i];
    const q = puntos[(i + 1) % puntos.length];
    doble += p.x * q.y - q.x * p.y;
  }
  const sentido = doble >= 0 ? -1 : 1;
  // El cuerpo de cada muro como polígono, de punta a punta ya estirado.
  const huellas = cuerpos.map((c) => {
    const largo = distancia(c.a, c.b);
    if (!(largo > 0)) return [];
    const nx = (-(c.b.y - c.a.y) / largo) * (c.grosor / 2);
    const ny = ((c.b.x - c.a.x) / largo) * (c.grosor / 2);
    return [
      { x: c.a.x + nx, y: c.a.y + ny },
      { x: c.b.x + nx, y: c.b.y + ny },
      { x: c.b.x - nx, y: c.b.y - ny },
      { x: c.a.x - nx, y: c.a.y - ny },
    ];
  });
  const MUESTRAS = 8;
  let libre = 0;
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i];
    const q = puntos[(i + 1) % puntos.length];
    const largo = distancia(p, q);
    if (!(largo > 0)) continue;
    const n = { x: (-(q.y - p.y) / largo) * sentido, y: ((q.x - p.x) / largo) * sentido };
    let sueltas = 0;
    for (let k = 0; k < MUESTRAS; k++) {
      const t = (k + 0.5) / MUESTRAS;
      const sonda = {
        x: p.x + (q.x - p.x) * t + n.x * afuera,
        y: p.y + (q.y - p.y) * t + n.y * afuera,
      };
      if (!huellas.some((h) => adentro(sonda, h))) sueltas++;
    }
    libre += (largo * sueltas) / MUESTRAS;
  }
  return libre;
}

/**
 * Las caras de los muros con su superficie y sus capas.
 *
 * La superficie de una cara es la suma de sus partes: los paños de piso a
 * techo, y en el ancho de cada puerta o ventana lo que queda de pared arriba
 * y abajo. La altura es la del muro si tiene la suya, y si no la de la
 * planta. Las capas son las propias de la cara si las tiene, y si no las de
 * su ambiente.
 *
 * Cada capa mide hasta donde sube: toda la cara si llega al techo, y si no la
 * parte de cada paño, antepecho y dintel que queda por debajo de su altura.
 * Un porcelanato hasta el cielorraso a 2,40 no cuenta los 25 cm que el muro
 * sigue por arriba, y de un dintel que arranca a 2,05 cuenta 35.
 *
 * El piso y el cielorraso se miden por la superficie de su ambiente.
 *
 * La mampostería se mide por muro y no por cara: el largo de la línea con que
 * se lo marcó por su altura, menos sus puertas y ventanas, una sola vez —un
 * muro es un muro aunque tenga dos caras—, y **menos el hormigón que tiene
 * adentro** (`mamposteriaDeMuro`): el hormigón tiene prioridad, y donde hay
 * una columna o una viga no se levanta ladrillo. A las terminaciones no se
 * les descuenta: el revoque tapa la columna igual que al muro. El volumen es
 * esa superficie por su espesor.
 *
 * `pisoAPiso` es lo que hay al piso terminado de arriba, si la planta es de
 * algún piso: de ahí salen los niveles de la estructura.
 *
 * Es de **un** piso, como `medir`. Null sin escala.
 */
export function medirCaras(
  dibujo: Dibujo,
  mpp: number | null,
  altura: number,
  pisoAPiso: number | null = null,
  tipos: Map<string, Composicion> = new Map()
): MedidaDeCaras | null {
  if (mpp === null) return null;

  const alturaDePlanta = altura > 0 ? altura : 0;
  const muros = new Map(dibujo.muros.map((m) => [m.id, m] as const));
  const cuerpos = new Map(
    dibujo.muros.map((m) => [m.id, cuerpoDeMuro(m, [], mpp, 0)] as const)
  );
  /** Menos que esto no es un paño: un milímetro. */
  const minimo = 0.001 / mpp;
  const ambientes = new Map(dibujo.ambientes.map((amb) => [amb.id, amb] as const));

  // Las columnas de hormigón, con su huella y entre qué alturas están: las que
  // sobresalen de un muro hacen mochetas, y las vistas no se revisten.
  const estructuraMedida = medirEstructura(dibujo.estructura, mpp, altura, pisoAPiso);
  const columnas = dibujo.estructura.columnas
    .filter((c) => c.material !== "metalica")
    .map((c) => {
      const medida = estructuraMedida?.columnas.find((x) => x.id === c.id);
      return {
        huella: huellaDeColumna(c, mpp),
        visto: c.visto,
        desde: medida?.desde ?? 0,
        hasta: medida?.hasta ?? alturaDePlanta,
      };
    });

  /** Lo que las columnas le hacen a cada cara: lo usan también las capas
   *  dibujadas. */
  const ajustesDe = new Map<string, AjusteDeColumna[]>();
  const caras = carasVisibles(dibujo.muros, dibujo.ambientes, mpp).map((cara): CaraMedida => {
    const cuerpo = cuerpos.get(cara.muroId);
    const largoDelEje = cuerpo ? distancia(cuerpo.ejeA, cuerpo.ejeB) : 0;

    const alto = muros.get(cara.muroId)?.altura ?? alturaDePlanta;

    // Los vanos que le tocan a esta cara, en orden y sin pisarse.
    // Un canto no tiene aberturas: es la punta del muro.
    const vanos = dibujo.aberturas
      .filter((ab) => cara.punta === null && ab.muroId === cara.muroId)
      .map((ab) => {
        const centro = ab.t * largoDelEje;
        const medio = ab.ancho / mpp / 2;
        return {
          ab,
          desde: Math.max(cara.desde, centro - medio),
          hasta: Math.min(cara.hasta, centro + medio),
        };
      })
      .filter((v) => v.hasta - v.desde > minimo)
      .sort((p, q) => p.desde - q.desde);

    const dx = cara.largo > 0 ? (cara.b.x - cara.a.x) / cara.largo : 0;
    const dy = cara.largo > 0 ? (cara.b.y - cara.a.y) / cara.largo : 0;
    const en = (s: number): Punto => ({
      x: cara.a.x + dx * (s - cara.desde),
      y: cara.a.y + dy * (s - cara.desde),
    });
    const parte = (
      tipo: ParteDeCara["tipo"],
      abertura: string | null,
      desde: number,
      hasta: number,
      altoDeLaParte: number,
      desdeElPiso = 0
    ): ParteDeCara => {
      const ancho = (hasta - desde) * mpp;
      return {
        tipo,
        abertura,
        a: en(desde),
        b: en(hasta),
        ancho,
        alto: altoDeLaParte,
        desde: desdeElPiso,
        superficie: ancho * altoDeLaParte,
      };
    };

    const partes: ParteDeCara[] = [];
    let recorrido = cara.desde;
    for (const vano of vanos) {
      const desde = Math.max(vano.desde, recorrido);
      if (vano.hasta - desde <= minimo) continue;
      if (desde - recorrido > minimo) partes.push(parte("pano", null, recorrido, desde, alto));

      // Bajo una ventana, hasta su antepecho; una puerta arranca en el piso.
      // Una ventana sin antepecho cargado no se sabe a qué altura está: lo
      // que no es vano va todo arriba, que da la misma superficie.
      const antepecho = Math.min(vano.ab.antepecho ?? 0, alto);
      if (antepecho > 0) {
        partes.push(parte("antepecho", vano.ab.nombre, desde, vano.hasta, antepecho));
      }
      const dintel = alto - antepecho - vano.ab.alto;
      if (dintel > 1e-9) {
        partes.push(parte("dintel", vano.ab.nombre, desde, vano.hasta, dintel, alto - dintel));
      }
      recorrido = vano.hasta;
    }
    if (cara.hasta - recorrido > minimo) {
      partes.push(parte("pano", null, recorrido, cara.hasta, alto));
    }

    const ambiente = cara.ambienteId ? ambientes.get(cara.ambienteId) : undefined;
    const propias = dibujo.caras[cara.clave];
    // Qué capas lleva la cara, de lo más particular a lo más general: las
    // suyas, si se le pusieron; las del ambiente al que da, si el ambiente
    // tiene terminación propia —el baño, con su porcelanato—; y si no, las
    // del lado de su tipo de muro.
    const muroDeLaCara = muros.get(cara.muroId);
    const tipo = muroDeLaCara?.tipo ? tipos.get(muroDeLaCara.tipo) : undefined;
    const delAmbiente = ambiente && ambiente.capas.length > 0 ? ambiente.capas : null;
    const delTipo =
      tipo && !propias && !delAmbiente
        ? tipo[ladoDeCara(cara.lado, cara.punta)]
            .filter((c) => c.tarea !== null)
            .map((c) => ({
              tarea: c.tarea as string,
              hasta: c.hasta,
              espesor: c.espesor > 0 ? c.espesor : null,
              desde: c.desde,
            }))
        : null;

    // Una capa repetida en la misma cara cuenta una vez, la primera: dos
    // manos de lo mismo no son el doble de superficie. Salvo que vaya en
    // franjas distintas: el mismo látex abajo y arriba de una guarda.
    const lista =
      delTipo ??
      (propias ?? delAmbiente ?? [])
        .filter((c) => c.tarea !== "")
        .map((c) => ({ ...c, desde: c.desde ?? 0 }))
        .filter(
          (c, i, todas) =>
            todas.findIndex((o) => o.tarea === c.tarea && o.desde === c.desde) === i
        );
    const ajustes = cara.punta === null && cuerpo && muroDeLaCara
      ? columnasEnLaCara(cara, cuerpo, muroDeLaCara, columnas, mpp)
      : [];
    ajustesDe.set(`${cara.clave}|${cara.desde}`, ajustes);

    const capas = lista.map((capa): CapaMedida => {
      const tope =
        capa.hasta === "techo"
          ? alto
          : capa.hasta === "cielorraso"
            ? ambiente?.alturaCielorraso ?? alto
            : capa.hasta;
      const hasta = Math.min(tope, alto);
      const desde = Math.min(Math.max(capa.desde, 0), hasta);
      // Las mochetas suman sus dos costados y el frente de una columna vista
      // se resta, en la franja de la capa y la altura de la columna.
      const porColumnas = ajustes.reduce((t, a) => {
        const franja = Math.max(0, Math.min(hasta, a.hasta) - Math.max(desde, a.desde));
        return t + a.metros * franja;
      }, 0);
      return {
        ...capa,
        desde,
        alto: hasta,
        // De cada parte, lo que queda entre donde arranca la capa y donde
        // llega.
        superficie: Math.max(
          0,
          partes.reduce(
            (t, p) =>
              t +
              p.ancho *
                Math.max(0, Math.min(hasta, p.desde + p.alto) - Math.max(desde, p.desde)),
            0
          ) + porColumnas
        ),
      };
    });

    return {
      ...cara,
      alto,
      partes,
      superficie: partes.reduce((t, p) => t + p.superficie, 0),
      capas,
      propias: propias !== undefined,
    };
  });

  // Las capas dibujadas: cada pieza mide lo que cubre de cada parte de su
  // cara —sin los vanos— en su franja de altura, más las mochetas de las
  // columnas que tiene encima y los costados de los vanos que toca. Van a la
  // lista de capas de su cara como cualquier otra, y de ahí al cómputo.
  const piezas = piezasDeCapas(dibujo, caras, mpp, alturaDePlanta);
  for (const pieza of piezas) {
    const cara = pieza.cara as CaraMedida;
    if (pieza.capa.tarea === null) continue;
    const largo = cara.largo > 0 ? cara.largo : 1;
    const dx = (cara.b.x - cara.a.x) / largo;
    const dy = (cara.b.y - cara.a.y) / largo;
    const aLoLargo = (p: Punto) => cara.desde + (p.x - cara.a.x) * dx + (p.y - cara.a.y) * dy;
    const enAltura = (desde: number, hasta: number) =>
      Math.max(0, Math.min(pieza.arriba, hasta) - Math.max(pieza.abajo, desde));
    let superficie = 0;
    for (const parte of cara.partes) {
      const s0 = Math.min(aLoLargo(parte.a), aLoLargo(parte.b));
      const s1 = Math.max(aLoLargo(parte.a), aLoLargo(parte.b));
      const ancho = Math.max(0, Math.min(s1, pieza.s1) - Math.max(s0, pieza.s0)) * mpp;
      superficie += ancho * enAltura(parte.desde, parte.desde + parte.alto);
    }
    for (const ajuste of ajustesDe.get(`${cara.clave}|${cara.desde}`) ?? []) {
      if (Math.min(ajuste.en[1], pieza.s1) - Math.max(ajuste.en[0], pieza.s0) <= 0) continue;
      superficie += ajuste.metros * enAltura(ajuste.desde, ajuste.hasta);
    }
    const costados = costadosDeVanos(pieza, cara, cuerpos.get(cara.muroId), dibujo.aberturas, mpp);
    cara.capas.push({
      tarea: pieza.capa.tarea,
      hasta: pieza.capa.hasta,
      espesor: pieza.capa.espesor > 0 ? pieza.capa.espesor : null,
      desde: pieza.abajo,
      alto: pieza.arriba,
      // Por su línea media: la de adentro de una esquina mide menos que la
      // cara, la de afuera más (`proporcionAlLargo`).
      superficie: Math.max(0, superficie * proporcionAlLargo(pieza)) + costados,
      dibujada: true,
      capaId: pieza.capa.id,
    });
  }

  const porCapa = new Acumulado();
  let sinTerminacion = 0;
  // El zócalo va por el pie de cada cara que lo lleva: los paños y los
  // antepechos, que arrancan en el piso; no las puertas.
  const zocalos = new Map<string, number>();
  for (const cara of caras) {
    if (cara.capas.length === 0) sinTerminacion += cara.superficie;
    for (const capa of cara.capas) porCapa.sumar(capa, capa.superficie);

    if (cara.punta !== null) continue;
    const zocalo = muros.get(cara.muroId)?.zocalo[ladoDeCara(cara.lado, null)];
    if (!zocalo) continue;
    const largo = cara.partes.filter((p) => p.desde < 1e-9).reduce((t, p) => t + p.ancho, 0);
    zocalos.set(zocalo, (zocalos.get(zocalo) ?? 0) + largo);
  }

  const pisos = new Acumulado();
  const cielorrasos = new Acumulado();
  let sinPiso = 0;
  let sinCielorraso = 0;

  // Los cajones: su fondo y sus frentes, con las capas del cajón. Donde hay un
  // cajón el cielorraso del ambiente no se hace: se le descuenta su fondo.
  const cuerposEnteros = dibujo.muros.map((m) => cuerpoDeMuro(m, dibujo.muros, mpp, 0));
  const cajones: MedidaDeCajon[] = [];
  const bajoCajones = new Map<string, number>();
  for (const cajon of dibujo.cajones) {
    const centro = centroDe(cajon.puntos);
    const ambiente = dibujo.ambientes.find((a) => adentro(centro, a.puntos)) ?? null;
    const techo =
      ambiente?.alturaCielorraso !== null && ambiente?.alturaCielorraso !== undefined && ambiente.alturaCielorraso > cajon.fondo
        ? ambiente.alturaCielorraso
        : alturaDePlanta;
    const alto = Math.max(0, techo - cajon.fondo);
    const area = areaDe(cajon.puntos) * mpp * mpp;
    const frentes = bordeLibre(cajon.puntos, cuerposEnteros, 0.06 / mpp) * mpp;
    const superficie = area + frentes * alto;
    cajones.push({ id: cajon.id, ambienteId: ambiente?.id ?? null, area, frentes, alto, superficie });
    for (const capa of sinRepetir(cajon.capas)) cielorrasos.sumar(capa, superficie);
    if (ambiente) bajoCajones.set(ambiente.id, (bajoCajones.get(ambiente.id) ?? 0) + area);
  }

  for (const ambiente of dibujo.ambientes) {
    const superficie = areaDe(ambiente.puntos) * mpp * mpp;
    if (ambiente.piso.length === 0) sinPiso += superficie;
    const delCielorraso = Math.max(0, superficie - (bajoCajones.get(ambiente.id) ?? 0));
    if (ambiente.cielorraso.length === 0) sinCielorraso += delCielorraso;
    for (const capa of sinRepetir(ambiente.piso)) pisos.sumar(capa, superficie);
    for (const capa of sinRepetir(ambiente.cielorraso)) cielorrasos.sumar(capa, delCielorraso);
  }

  // Donde hay hormigón no hay ladrillo: a cada muro se le saca la columna que
  // tiene adentro y la viga que lo corona.
  const hormigon = prismasDeHormigon(dibujo.estructura, mpp, altura, pisoAPiso);
  const porTipo = new Map<string, { superficie: number; volumen: number }>();
  let murosSinTipo = 0;
  let hormigonEnMuros = 0;
  for (const muro of dibujo.muros) {
    const alto = muro.altura ?? alturaDePlanta;
    const medida = mamposteriaDeMuro(muro, dibujo.aberturas, hormigon, mpp, alto, dibujo.muros);
    const { superficie } = medida;
    hormigonEnMuros += medida.hormigon;

    if (muro.tarea === null) {
      murosSinTipo += superficie;
      continue;
    }
    const ya = porTipo.get(muro.tarea) ?? { superficie: 0, volumen: 0 };
    // Con tipo, el volumen es el del núcleo: el ladrillo, sin sus revoques.
    const delNucleo = muro.tipo ? tipos.get(muro.tipo)?.nucleo.espesor : undefined;
    porTipo.set(muro.tarea, {
      superficie: ya.superficie + superficie,
      volumen: ya.volumen + superficie * (delNucleo ?? muro.espesor),
    });
  }

  return {
    caras,
    porCapa: porCapa.lista(),
    sinTerminacion,
    pisos: pisos.lista(),
    cielorrasos: cielorrasos.lista(),
    sinPiso,
    sinCielorraso,
    muros: Array.from(porTipo, ([capa, m]) => ({ capa, ...m })),
    murosSinTipo,
    hormigonEnMuros,
    zocalos: Array.from(zocalos, ([capa, largo]) => ({ capa, largo })),
    piezas,
    cajones,
  };
}
