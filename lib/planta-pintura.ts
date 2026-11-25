/**
 * Pintar desde el 3D, con el bote de pintura.
 *
 * Se elige una pintura —una tarea del rubro Pintura, que lleva sus subtareas:
 * el enduido y el fijador van con el látex— y se toca lo que se pinta. Cada
 * toque es una **pincelada**, y lo que deja en el dibujo es lo mismo que se
 * haría a mano, así se mide y se computa sin nada aparte:
 *
 *   una cara de muro   una capa dibujada sin espesor sobre esa cara, en lo que
 *                      da a su ambiente. Va **sólo por lo que queda a la
 *                      vista**: si la cara tiene porcelanato hasta 2,10, la
 *                      pintura arranca en 2,10. Lo que tapa es sólo lo
 *                      **revestido** —las tareas del rubro Revestimientos—: un
 *                      revoque, aunque llegue a 2,50, es lo que se pinta. Sube
 *                      hasta el cielorraso del ambiente, o la losa.
 *   un cielorraso      la pintura entre las capas del cielorraso del ambiente
 *                      —también el aplicado, tocando la losa desde abajo—.
 *   un cajón           **cara por cara**, como una pared: el fondo, o uno de
 *                      sus frentes. Lo de arriba y lo que va contra el muro no
 *                      se ven y no se pintan.
 *
 * Tocar otra vez con la misma pintura lo que ya la tiene la saca: el bote
 * pinta y despinta.
 *
 * **Las caras que se pueden pintar salen de acá** (`carasPintables`), y de acá
 * las saca también el 3D para resaltar, al pasar el mouse, la que se va a
 * pintar. El toque manda esa misma cara —su tramo—: lo que se resaltó es lo que
 * se pinta.
 *
 * Sin React y sin base: recibe un dibujo y devuelve otro, o por qué no.
 */

import { type CapaDibujada, type CaraDeCajon, type Dibujo, type TramoDeCapa, distancia } from "@/lib/planta-dibujo";
import { tramoDeCara } from "@/lib/planta-capas";
import { type Cara, carasVisibles } from "@/lib/planta-trazo";

/** Lo que se tocó. */
export type Pincelada =
  | { donde: "cara"; tramo: TramoDeCapa }
  | { donde: "cielorraso"; ambienteId: string }
  | { donde: "cajon"; cajonId: string; cara: CaraDeCajon };

/** Una cara de muro que se puede pintar, y entre qué alturas iría la pintura. */
export type CaraPintable = {
  cara: Cara;
  tramo: TramoDeCapa;
  /** Desde dónde se ve, en metros sobre el piso: lo revestido no se pinta.
   *  Null: revestida hasta arriba, no queda nada a la vista. */
  abajo: number | null;
  /** Hasta dónde: el cielorraso del ambiente, o la altura del muro. */
  arriba: number;
  /** Lo que ya tiene encima, en metros: dónde queda la cara terminada. */
  grosor: number;
};

/** Menos que esto, en metros, es arrancar del piso. */
const DEL_PISO = 0.01;

/** Si un tramo es de la misma cara que otro y lo pisa a lo largo. Un canto
 *  va entero: con que sea el mismo, lo pisa. */
function pisa(t: TramoDeCapa, de: TramoDeCapa) {
  if (t.muroId !== de.muroId || t.cara !== de.cara) return false;
  if (de.cara === "a" || de.cara === "b") return true;
  return Math.min(t.hasta, de.hasta) - Math.max(t.desde, de.desde) > 1e-6;
}

/**
 * Las caras de los muros, cada una en lo que da a un ambiente —la del baño de
 * un muro que también da al pasillo es otra que la del pasillo—, con lo que de
 * cada una queda a la vista. También los **cantos**: la punta de un muro que
 * termina suelto —el que deja el paso a una puerta— es una cara que se ve y
 * se pinta (pedido del usuario).
 */
export function carasPintables(
  dibujo: Dibujo,
  mpp: number,
  alturaDePlanta: number,
  /** Las tareas que revisten —porcelanato, cerámica—: lo que no se pinta. */
  revestimientos: Set<string>
): CaraPintable[] {
  const muros = new Map(dibujo.muros.map((m) => [m.id, m] as const));
  const ambientes = new Map(dibujo.ambientes.map((a) => [a.id, a] as const));
  const pintables: CaraPintable[] = [];
  for (const cara of carasVisibles(dibujo.muros, dibujo.ambientes, mpp)) {
    const muro = muros.get(cara.muroId);
    if (!muro) continue;
    const tramo = tramoDeCara(cara, distancia(muro.a, muro.b));
    const encima = dibujo.capas.filter((c) => c.tramos.some((t) => pisa(t, tramo)));

    // Un revestimiento que arranca del piso —el porcelanato hasta 2,10— tapa
    // la pared hasta su altura; uno que sube hasta arriba no deja nada.
    const revestidas = encima.filter(
      (c) => c.tarea !== null && revestimientos.has(c.tarea) && c.espesor > 0 && c.desde <= DEL_PISO
    );
    const abajo = revestidas.some((c) => typeof c.hasta !== "number")
      ? null
      : revestidas.reduce((alto, c) => Math.max(alto, c.hasta as number), 0);

    const alto = muro.altura ?? (alturaDePlanta > 0 ? alturaDePlanta : 0);
    const ambiente = cara.ambienteId ? ambientes.get(cara.ambienteId) : undefined;
    const cielorraso = ambiente?.alturaCielorraso ?? null;
    const arriba = cielorraso !== null && cielorraso < alto ? cielorraso : alto;

    const grosor = encima.reduce((t, c) => t + (c.espesor > 0 ? c.espesor : 0), 0);
    pintables.push({ cara, tramo, abajo: abajo !== null && abajo >= arriba ? null : abajo, arriba, grosor });
  }
  return pintables;
}

export function pintar(
  dibujo: Dibujo,
  mpp: number,
  alturaDePlanta: number,
  tarea: string,
  pincelada: Pincelada,
  revestimientos: Set<string> = new Set()
): { dibujo: Dibujo } | { error: string } {
  switch (pincelada.donde) {
    case "cara":
      return pintarCara(dibujo, mpp, alturaDePlanta, tarea, pincelada.tramo, revestimientos);

    case "cielorraso": {
      const ambiente = dibujo.ambientes.find((a) => a.id === pincelada.ambienteId);
      if (!ambiente) return { error: "Ese ambiente ya no está en el dibujo: recargá para verlo como quedó." };
      const yaTiene = ambiente.cielorraso.some((c) => c.tarea === tarea);
      const cielorraso = yaTiene
        ? ambiente.cielorraso.filter((c) => c.tarea !== tarea)
        : [...ambiente.cielorraso, { tarea, hasta: "techo" as const, espesor: null }];
      return {
        dibujo: {
          ...dibujo,
          ambientes: dibujo.ambientes.map((a) => (a.id === ambiente.id ? { ...a, cielorraso } : a)),
        },
      };
    }

    case "cajon": {
      const cajon = dibujo.cajones.find((c) => c.id === pincelada.cajonId);
      if (!cajon) return { error: "Ese cajón ya no está en el dibujo: recargá para verlo como quedó." };
      const { cara } = pincelada;
      if (cara !== "fondo" && !(Number.isInteger(cara) && cara >= 0 && cara < cajon.puntos.length)) {
        return { error: "Esa cara del cajón ya no está igual: recargá para verla como quedó." };
      }
      let capas = cajon.capas;
      let pinturas = cajon.pinturas;
      // Pintado entero de antes, como una capa más: pasa a ir cara por cara,
      // en todas, y sobre eso se suma o se saca la tocada.
      if (capas.some((c) => c.tarea === tarea)) {
        capas = capas.filter((c) => c.tarea !== tarea);
        const todas: CaraDeCajon[] = ["fondo", ...cajon.puntos.map((_, i) => i)];
        pinturas = [...pinturas.filter((p) => p.tarea !== tarea), { tarea, caras: todas }];
      }
      const suya = pinturas.find((p) => p.tarea === tarea);
      const caras = suya?.caras.includes(cara)
        ? suya.caras.filter((c) => c !== cara)
        : [...(suya?.caras ?? []), cara];
      pinturas = [
        ...pinturas.filter((p) => p.tarea !== tarea),
        ...(caras.length > 0 ? [{ tarea, caras }] : []),
      ];
      return {
        dibujo: {
          ...dibujo,
          cajones: dibujo.cajones.map((c) => (c.id === cajon.id ? { ...c, capas, pinturas } : c)),
        },
      };
    }
  }
}

/** La pintura sobre una de las caras pintables, o fuera si ya la tiene. */
function pintarCara(
  dibujo: Dibujo,
  mpp: number,
  alturaDePlanta: number,
  tarea: string,
  pedido: TramoDeCapa,
  revestimientos: Set<string>
): { dibujo: Dibujo } | { error: string } {
  // La cara tiene que ser una de las de ahora: no se escribe un tramo que
  // llega del navegador sin más.
  const pintable = carasPintables(dibujo, mpp, alturaDePlanta, revestimientos).find(
    (p) =>
      p.tramo.muroId === pedido.muroId &&
      p.tramo.cara === pedido.cara &&
      (p.tramo.cara === "a" ||
        p.tramo.cara === "b" ||
        (Math.abs(p.tramo.desde - pedido.desde) < 1e-6 && Math.abs(p.tramo.hasta - pedido.hasta) < 1e-6))
  );
  if (!pintable) return { error: "Esa cara ya no está igual en el dibujo: recargá para verla como quedó." };
  const { tramo } = pintable;

  // Ya pintada con esto: se despinta.
  const esLaPintura = (c: CapaDibujada) => c.tarea === tarea && c.espesor === 0;
  if (dibujo.capas.some((c) => esLaPintura(c) && c.tramos.some((t) => pisa(t, tramo)))) {
    const capas = dibujo.capas
      .map((c) => (esLaPintura(c) ? { ...c, tramos: c.tramos.filter((t) => !pisa(t, tramo)) } : c))
      .filter((c) => c.tramos.length > 0);
    return { dibujo: { ...dibujo, capas } };
  }

  if (pintable.abajo === null) {
    return { error: "Esa cara está revestida hasta arriba: no queda nada a la vista para pintar." };
  }
  const desde = pintable.abajo;

  // Se suma a una capa de la misma pintura que arranque a la misma altura: la
  // pintura del baño es una sola, aunque se la ponga pared por pared.
  const igual = dibujo.capas.findIndex(
    (c) => esLaPintura(c) && Math.abs(c.desde - desde) < 1e-6 && c.hasta === "cielorraso"
  );
  const capas =
    igual >= 0
      ? dibujo.capas.map((c, i) => (i === igual ? { ...c, tramos: [...c.tramos, tramo] } : c))
      : [
          ...dibujo.capas,
          {
            id: crypto.randomUUID(),
            tarea,
            espesor: 0,
            desde,
            hasta: "cielorraso" as const,
            tramos: [tramo],
          },
        ];
  return { dibujo: { ...dibujo, capas } };
}
