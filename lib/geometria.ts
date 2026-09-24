/**
 * Geometría plana de una parcela, en metros. Puro: sin base ni React.
 *
 * Ciudad 3D da el polígono de la parcela en lon/lat y la huella edificable
 * como superficie, no como polígono. Acá el polígono se pasa a metros y la
 * huella se recorta como una banda desde el frente, de la profundidad que
 * haga falta para llegar a esa superficie: es lo que hace la LFI en un lote
 * entre medianeras, y sale de la forma real del lote sin dibujar nada a mano.
 * Sirve para el volumen 3D y para leer "hasta dónde se construye".
 */

export type Punto = { x: number; y: number };

export type Frente = { a: Punto; b: Punto };

/**
 * Lon/lat a metros alrededor de un centro: x hacia el este, y hacia el
 * norte. Una parcela mide decenas de metros: la proyección equirectangular
 * local se equivoca en milímetros.
 */
export function aMetros(anillo: [number, number][], centro: [number, number]): Punto[] {
  const kx = 111320 * Math.cos((centro[1] * Math.PI) / 180);
  const ky = 110540;
  const puntos = anillo.map(([lng, lat]) => ({
    x: (lng - centro[0]) * kx,
    y: (lat - centro[1]) * ky,
  }));
  // GeoJSON repite el primer punto al final; acá los anillos van abiertos.
  const [p, ...resto] = puntos;
  const ultimo = resto[resto.length - 1];
  if (ultimo && Math.abs(ultimo.x - p.x) < 1e-9 && Math.abs(ultimo.y - p.y) < 1e-9) {
    resto.pop();
  }
  return [p, ...resto];
}

/** Un lote rectangular con el frente sobre el eje x, para cuando no hay polígono. */
export function rectangulo(frente: number, fondo: number): Punto[] {
  return [
    { x: 0, y: 0 },
    { x: frente, y: 0 },
    { x: frente, y: fondo },
    { x: 0, y: fondo },
  ];
}

/**
 * Saca los vértices que no doblan: el polígono del catastro trae puntos
 * intermedios sobre los lados rectos, y cada uno era una arista vertical de
 * más en el volumen. Un vértice se queda si el rumbo cambia más de la
 * tolerancia, o si sacarlo movería el borde más de 5 cm.
 */
export function simplificar(poligono: Punto[], toleranciaGrados = 2): Punto[] {
  if (poligono.length <= 4) return poligono;
  const n = poligono.length;
  const salida = poligono.filter((p, i) => {
    const a = poligono[(i + n - 1) % n];
    const b = poligono[(i + 1) % n];
    const giro = Math.abs(anguloEntre(a, p, b));
    return giro > (toleranciaGrados * Math.PI) / 180 || distanciaASegmento(p, a, b) > 0.05;
  });
  return salida.length >= 3 ? salida : poligono;
}

/** Cuánto dobla el camino a → p → b, en radianes con signo. */
function anguloEntre(a: Punto, p: Punto, b: Punto) {
  const r1 = Math.atan2(p.y - a.y, p.x - a.x);
  const r2 = Math.atan2(b.y - p.y, b.x - p.x);
  let d = r2 - r1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function area(poligono: Punto[]): number {
  let suma = 0;
  for (let i = 0; i < poligono.length; i++) {
    const p = poligono[i];
    const q = poligono[(i + 1) % poligono.length];
    suma += p.x * q.y - q.x * p.y;
  }
  return Math.abs(suma) / 2;
}

export function centroide(poligono: Punto[]): Punto {
  const n = poligono.length;
  return {
    x: poligono.reduce((s, p) => s + p.x, 0) / n,
    y: poligono.reduce((s, p) => s + p.y, 0) / n,
  };
}

export function distancia(a: Punto, b: Punto) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * El lado que da a la calle: el más cercano a la puerta, cuando la hay. Sin
 * puerta, el más corto de los lados que miden algo (una ochava o un quiebre
 * de medianera no son un frente), que en un lote entre medianeras es el
 * frente o el fondo, y de los dos no hay con qué elegir.
 */
export function frenteDe(poligono: Punto[], puerta: Punto | null): Frente {
  let mejor: Frente | null = null;
  let mejorValor = Infinity;
  const LADO_MINIMO = 2;

  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    if (!puerta && distancia(a, b) < LADO_MINIMO) continue;
    const valor = puerta ? distanciaASegmento(puerta, a, b) : distancia(a, b);
    if (valor < mejorValor) {
      mejorValor = valor;
      mejor = { a, b };
    }
  }

  return mejor ?? { a: poligono[0], b: poligono[1] };
}

function distanciaASegmento(p: Punto, a: Punto, b: Punto) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  const t =
    largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2));
  return distancia(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * La normal al frente que apunta hacia adentro del lote, unitaria. Con ella,
 * la profundidad de un punto es cuánto entró desde la línea del frente.
 */
export function normalInterior(poligono: Punto[], frente: Frente): Punto {
  const dx = frente.b.x - frente.a.x;
  const dy = frente.b.y - frente.a.y;
  const largo = Math.hypot(dx, dy) || 1;
  let n = { x: -dy / largo, y: dx / largo };
  const c = centroide(poligono);
  if ((c.x - frente.a.x) * n.x + (c.y - frente.a.y) * n.y < 0) n = { x: -n.x, y: -n.y };
  return n;
}

export function profundidadDe(p: Punto, frente: Frente, normal: Punto) {
  return (p.x - frente.a.x) * normal.x + (p.y - frente.a.y) * normal.y;
}

/** Hasta dónde llega el lote desde el frente: la profundidad del punto más lejano. */
export function fondoDe(poligono: Punto[], frente: Frente, normal: Punto) {
  return Math.max(...poligono.map((p) => profundidadDe(p, frente, normal)));
}

/**
 * El lote recortado a una banda de `profundidad` metros desde el frente
 * (Sutherland–Hodgman contra un semiplano). Un lote entre medianeras
 * recortado por la LFI es exactamente esto.
 */
export function recortarDesdeFrente(
  poligono: Punto[],
  frente: Frente,
  normal: Punto,
  profundidad: number
): Punto[] {
  const adentro = (p: Punto) => profundidadDe(p, frente, normal) <= profundidad;
  const salida: Punto[] = [];

  for (let i = 0; i < poligono.length; i++) {
    const actual = poligono[i];
    const previo = poligono[(i + poligono.length - 1) % poligono.length];
    const actualAdentro = adentro(actual);
    const previoAdentro = adentro(previo);

    if (actualAdentro) {
      if (!previoAdentro) salida.push(cruce(previo, actual, frente, normal, profundidad));
      salida.push(actual);
    } else if (previoAdentro) {
      salida.push(cruce(previo, actual, frente, normal, profundidad));
    }
  }

  return salida;
}

function cruce(p: Punto, q: Punto, frente: Frente, normal: Punto, profundidad: number): Punto {
  const dp = profundidadDe(p, frente, normal) - profundidad;
  const dq = profundidadDe(q, frente, normal) - profundidad;
  const t = dp / (dp - dq);
  return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
}

/**
 * La huella que tiene la superficie que dijo la Ciudad: la banda desde el
 * frente cuya área es esa, buscando la profundidad por bisección. Si la
 * superficie es el lote entero o más, la huella es el lote.
 */
export function huellaPorSuperficie(
  poligono: Punto[],
  frente: Frente,
  superficieObjetivo: number
): { huella: Punto[]; profundidad: number } {
  const normal = normalInterior(poligono, frente);
  const fondo = fondoDe(poligono, frente, normal);

  if (superficieObjetivo >= area(poligono) - 0.01) {
    return { huella: poligono, profundidad: fondo };
  }

  let bajo = 0;
  let alto = fondo;
  for (let i = 0; i < 40; i++) {
    const medio = (bajo + alto) / 2;
    if (area(recortarDesdeFrente(poligono, frente, normal, medio)) < superficieObjetivo) {
      bajo = medio;
    } else {
      alto = medio;
    }
  }

  const profundidad = (bajo + alto) / 2;
  return { huella: recortarDesdeFrente(poligono, frente, normal, profundidad), profundidad };
}

/** El anillo exterior más grande de un GeoJSON de parcela (Polygon o MultiPolygon). */
export function anilloExterior(geometria: unknown): [number, number][] | null {
  const g = geometria as {
    type?: string;
    coordinates?: unknown;
    features?: { geometry?: unknown }[];
  } | null;
  if (!g) return null;
  if (g.type === "FeatureCollection" && g.features?.[0]) {
    return anilloExterior(g.features[0].geometry);
  }
  if (g.type === "Polygon") {
    return (g.coordinates as [number, number][][])[0] ?? null;
  }
  if (g.type === "MultiPolygon") {
    const anillos = (g.coordinates as [number, number][][][]).map((p) => p[0]);
    if (anillos.length === 0) return null;
    return anillos.reduce((mayor, anillo) =>
      areaLonLat(anillo) > areaLonLat(mayor) ? anillo : mayor
    );
  }
  return null;
}

function areaLonLat(anillo: [number, number][]) {
  return area(anillo.map(([x, y]) => ({ x, y })));
}
