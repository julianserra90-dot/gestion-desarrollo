/**
 * Pasar las capas de antes a capas dibujadas.
 *
 * Antes, las terminaciones de pared salían de tres lados: las capas del tipo
 * de muro, la terminación propia del ambiente (el baño) y las capas puestas a
 * una cara. Ahora se dibujan sobre las caras (`CapaDibujada`), y el tipo de
 * muro queda sólo con su núcleo. Esto hace el pase de una planta: cada cara
 * se lleva, como capas dibujadas, exactamente lo que llevaba.
 *
 * Los pasos:
 *
 *   1. Se mide la planta como estaba (`medirCaras`): qué capas lleva cada cara.
 *   2. Los muros se quedan con el núcleo, **sin moverse**: el que se agarraba
 *      de una cara terminada pasa a agarrarse de la del ladrillo
 *      (`conOtraReferencia`), y el revestimiento se va.
 *   3. Con los muros así, cada cara —que ahora es la del ladrillo— recibe las
 *      capas que llevaba, como tramos enteros. Se la reconoce por su clave
 *      (muro, lado y ambiente), que no cambia.
 *   4. Las capas iguales —misma tarea, espesor, alturas y lugar en la pila—
 *      de todas las caras son una sola capa dibujada, y la pila se arma por
 *      ese lugar: la primera contra el muro.
 *
 * Las capas que ya estaban dibujadas quedan encima, como estaban.
 */

import { type CapaDibujada, type Dibujo, type Escala, distancia, metrosPorPixel } from "@/lib/planta-dibujo";
import { juntar } from "@/lib/planta-capas";
import { aberturasEnSuLugar, carasVisibles, conOtraReferencia, medirCaras } from "@/lib/planta-trazo";
import { type Composicion, conSusTipos, medidasDelMuro, SIN_REVESTIMIENTO } from "@/lib/tipos-de-muro";

/** Si la planta tiene capas de las de antes, que habría que pasar. */
export function tieneCapasDeAntes(dibujo: Dibujo, tipos: Map<string, Composicion>): boolean {
  return (
    dibujo.ambientes.some((a) => a.capas.length > 0) ||
    Object.keys(dibujo.caras).length > 0 ||
    dibujo.muros.some((m) => {
      const tipo = m.tipo ? tipos.get(m.tipo) : undefined;
      return (tipo && tipo.exterior.length + tipo.interior.length > 0) || m.revestimiento.exterior + m.revestimiento.interior > 0;
    })
  );
}

/** El tipo, sin sus capas: sólo el núcleo. */
export function soloNucleo(c: Composicion): Composicion {
  return { nucleo: c.nucleo, exterior: [], interior: [] };
}

/**
 * La planta con sus capas de antes pasadas a capas dibujadas, los muros con el
 * núcleo solo y sin terminaciones de ambiente ni de cara. `tipos` son los
 * tipos de muro de la obra **como estaban**, con sus capas.
 */
export function capasAlDibujo(
  dibujo: Dibujo,
  escala: Escala | null,
  altura: number,
  tipos: Map<string, Composicion>
): Dibujo {
  const sinTerminaciones = {
    ambientes: dibujo.ambientes.map((a) => ({ ...a, capas: [] })),
    caras: {},
  };
  const nucleos = new Map(Array.from(tipos, ([id, t]) => [id, soloNucleo(t)] as const));
  const mpp = metrosPorPixel(escala);
  if (mpp === null) {
    // Sin escala no hay caras que medir: sólo se sacan las capas.
    return { ...dibujo, ...sinTerminaciones, muros: conSusTipos(dibujo.muros, nucleos) };
  }

  // 1. Lo que lleva cada cara hoy, sin las ya dibujadas.
  const antes = { ...dibujo, muros: conSusTipos(dibujo.muros, tipos) };
  const medida = medirCaras(antes, mpp, altura, null, tipos);
  const porClave = new Map<string, { tarea: string; espesor: number; desde: number; hasta: CapaDibujada["hasta"] }[]>();
  for (const cara of medida?.caras ?? []) {
    if (porClave.has(cara.clave)) continue;
    const viejas = cara.capas.filter((c) => !c.dibujada);
    if (viejas.length === 0) continue;
    porClave.set(
      cara.clave,
      viejas.map((c) => ({ tarea: c.tarea, espesor: c.espesor ?? 0, desde: c.desde, hasta: c.hasta }))
    );
  }

  // 2. Los muros con el núcleo solo, en el mismo lugar.
  let muros = antes.muros;
  for (const m of antes.muros) {
    if (m.referencia === "exteriorTerminada" || m.referencia === "interiorTerminada") {
      muros = conOtraReferencia(muros, m.id, m.referencia === "exteriorTerminada" ? "exterior" : "interior", mpp);
    }
  }
  muros = muros.map((m) => {
    const tipo = m.tipo ? tipos.get(m.tipo) : undefined;
    if (tipo) return { ...m, ...medidasDelMuro(soloNucleo(tipo)) };
    const { exterior, interior } = m.revestimiento;
    return { ...m, espesor: Math.max(m.espesor - exterior - interior, 0.01), revestimiento: SIN_REVESTIMIENTO };
  });

  // 3 y 4. Cada cara nueva recibe lo suyo; las capas iguales se juntan.
  const largos = new Map(muros.map((m) => [m.id, distancia(m.a, m.b)] as const));
  const grupos = new Map<string, { lugar: number; capa: CapaDibujada }>();
  for (const cara of carasVisibles(muros, dibujo.ambientes, mpp)) {
    const capas = porClave.get(cara.clave);
    const largo = largos.get(cara.muroId) ?? 0;
    if (!capas || !(largo > 0)) continue;
    capas.forEach((c, lugar) => {
      const clave = [lugar, c.tarea, c.espesor, c.desde, c.hasta].join("|");
      const grupo = grupos.get(clave) ?? {
        lugar,
        capa: {
          id: crypto.randomUUID(),
          tarea: c.tarea,
          espesor: c.espesor,
          desde: c.desde,
          hasta: c.hasta,
          tramos: [],
        },
      };
      grupo.capa.tramos.push({
        muroId: cara.muroId,
        cara: cara.punta ?? cara.lado,
        desde: cara.desde / largo,
        hasta: cara.hasta / largo,
      });
      grupos.set(clave, grupo);
    });
  }
  const pasadas = Array.from(grupos.values())
    .sort((a, b) => a.lugar - b.lugar)
    .map((g) => ({ ...g.capa, tramos: juntar(g.capa.tramos) }));

  return {
    ...dibujo,
    ...sinTerminaciones,
    muros,
    // Las puertas y ventanas, donde estaban: los vecinos de un muro que cambió
    // de línea pudieron alargarse o acortarse un poco.
    aberturas: aberturasEnSuLugar(dibujo.aberturas, antes.muros, muros, mpp, 1),
    capas: [...pasadas, ...dibujo.capas],
  };
}
