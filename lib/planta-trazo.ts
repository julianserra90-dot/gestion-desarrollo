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

import {
  type Muro,
  type Punto,
  type Referencia,
  distancia,
} from "@/lib/planta-dibujo";

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
 *  1. Si hay un vértice cerca, es ése: las esquinas cierran exactas.
 *  2. Trazando a escuadra, se alinea con el punto anterior en horizontal o en
 *     vertical —lo que esté más cerca de lo que se marcó—, y sobre esa línea
 *     se frena a la altura de otra esquina (una guía) o donde cruza un muro:
 *     así sale el encuentro en T sin puntería.
 *  3. Sin escuadra, se alinea con las esquinas que tenga a la misma altura o
 *     en la misma vertical —una guía por eje, y las dos a la vez dan el punto
 *     exacto donde se cruzan—, y si no hay ninguna se apoya sobre el muro que
 *     tenga cerca.
 *
 * `iman` dice si se pegó a algo y `guias` contra qué se alineó, para mostrarlo.
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
    let mejor: number | null = null;
    let alineadoCon: Punto | null = null;
    let delta = alcanceDeGuia;

    if (o.guias) {
      for (const vertice of o.vertices) {
        const candidato = horizontal ? vertice.x : vertice.y;
        if (Math.abs(candidato - libre) <= delta) {
          delta = Math.abs(candidato - libre);
          mejor = candidato;
          alineadoCon = vertice;
        }
      }
    }

    // El cruce con un muro le gana a una guía igual de cerca: es un encuentro
    // de verdad, no una alineación.
    delta = mejor === null ? o.tolerancia : delta;
    for (const muro of o.muros) {
      const cruce = horizontal
        ? cruceConEje(muro.a.y, muro.b.y, muro.a.x, muro.b.x, previo.y)
        : cruceConEje(muro.a.x, muro.b.x, muro.a.y, muro.b.y, previo.x);
      if (cruce !== null && Math.abs(cruce - libre) <= delta) {
        delta = Math.abs(cruce - libre);
        mejor = cruce;
        alineadoCon = null;
      }
    }

    const valor = mejor ?? libre;
    const punto = horizontal ? { x: valor, y: previo.y } : { x: previo.x, y: valor };
    return {
      punto,
      iman: mejor !== null,
      guias: alineadoCon ? [{ desde: alineadoCon, hasta: punto }] : [],
    };
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

  let apoyo: Punto | null = null;
  menor = o.tolerancia;
  for (const muro of o.muros) {
    const proyectado = proyectar(p, muro.a, muro.b);
    const d = distancia(p, proyectado);
    if (d <= menor) {
      menor = d;
      apoyo = proyectado;
    }
  }

  return apoyo
    ? { punto: apoyo, iman: true, guias: [] }
    : { punto: p, iman: false, guias: [] };
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
function rangoDelCuerpo(referencia: Referencia, grosor: number): [number, number] {
  if (referencia === "exterior") return [0, grosor];
  if (referencia === "interior") return [-grosor, 0];
  return [-grosor / 2, grosor / 2];
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
};

function grosorDe(muro: Pick<Muro, "espesor">, mpp: number | null, u: number) {
  // Sin escala no se sabe cuánto es el espesor en el plano: un trazo fijo.
  return mpp !== null ? Math.max(muro.espesor / mpp, 3 * u) : 5 * u;
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
    return { a: muro.a, b: muro.b, ejeA: muro.a, ejeB: muro.b, grosor };
  }

  const dx = (muro.b.x - muro.a.x) / largo;
  const dy = (muro.b.y - muro.a.y) / largo;
  // Sin escala la referencia no se puede dibujar: el trazo va sobre la línea.
  const [desde, hasta] = rangoDelCuerpo(mpp !== null ? muro.referencia : "centro", grosor);
  const corrimiento = (desde + hasta) / 2;
  const ejeA = { x: muro.a.x - dy * corrimiento, y: muro.a.y + dx * corrimiento };
  const ejeB = { x: muro.b.x - dy * corrimiento, y: muro.b.y + dx * corrimiento };

  /** Cuánto hay que estirar una punta, mirando hacia (ax, ay). */
  const estirar = (punta: Punto, ax: number, ay: number): number => {
    let extra = 0;
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
        grosorDe(otro, mpp, u)
      );
      extra = Math.max(extra, d * haciaAfuera, h * haciaAfuera);
    }
    return extra;
  };

  const enA = estirar(muro.a, -dx, -dy);
  const enB = estirar(muro.b, dx, dy);

  return {
    a: { x: ejeA.x - dx * enA, y: ejeA.y - dy * enA },
    b: { x: ejeB.x + dx * enB, y: ejeB.y + dy * enB },
    ejeA,
    ejeB,
    grosor,
  };
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
