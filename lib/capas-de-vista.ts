/**
 * Qué se ve del dibujo: las capas de vista que se prenden y apagan en la
 * planta y en el 3D. Son **las mismas** en los dos —ocultar la estructura en
 * el plano la oculta en el 3D, y al revés— y se recuerdan en este navegador.
 *
 * Es de quien mira, no de la obra: no va a la base. Se guarda en el navegador
 * y avisa a todo lo abierto —otra pestaña también— cuando cambia.
 */

import { useSyncExternalStore } from "react";

export type CapaDeVista =
  | "plano"
  | "ambientes"
  | "muros"
  | "capas"
  | "aberturas"
  | "cajones"
  | "cielorrasos"
  | "estructura"
  | "cotas";

/** Cómo arranca cada una. Los cielorrasos, apagados: tapan el edificio
 *  mirado desde arriba. */
const AL_EMPEZAR: Record<CapaDeVista, boolean> = {
  plano: true,
  ambientes: true,
  muros: true,
  capas: true,
  aberturas: true,
  cajones: true,
  cielorrasos: false,
  estructura: true,
  cotas: true,
};

const CLAVE = "gestion-desarrollo:capas-de-vista";
const AVISO = "capas-de-vista";

function leer(): string {
  try {
    return window.localStorage.getItem(CLAVE) ?? "{}";
  } catch {
    return "{}";
  }
}

function escuchar(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(AVISO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(AVISO, avisar);
  };
}

/** Las capas de vista: si se ve cada una, cambiarla, y cuántas hay ocultas de una lista. */
export function useCapasDeVista() {
  const guardado = useSyncExternalStore(escuchar, leer, () => "{}");
  let elegidas: Partial<Record<CapaDeVista, boolean>> = {};
  try {
    elegidas = JSON.parse(guardado);
  } catch {
    elegidas = {};
  }
  const ve = (c: CapaDeVista) => elegidas[c] ?? AL_EMPEZAR[c];
  const poner = (c: CapaDeVista, visible: boolean) => {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify({ ...elegidas, [c]: visible }));
    } catch {
      // Sin almacenamiento —navegación privada—: queda como estaba.
    }
    window.dispatchEvent(new Event(AVISO));
  };
  const ocultasDe = (lista: CapaDeVista[]) => lista.filter((c) => !ve(c)).length;
  return { ve, poner, ocultasDe };
}
