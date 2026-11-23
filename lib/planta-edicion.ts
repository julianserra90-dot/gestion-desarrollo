/**
 * Cambiar una medida de una cosa del dibujo sin abrir el editor.
 *
 * El 3D deja corregir alturas y medidas mirando el edificio: se toca un muro,
 * se le escribe otra altura y se lo ve crecer. Lo que llega del navegador es
 * mínimo —qué cosa, qué medida, qué valor— y acá se aplica sobre el dibujo
 * guardado, con las mismas reglas que el editor.
 *
 * Sólo se pueden tocar las medidas que están en esta lista. No es una puerta
 * para escribir cualquier cosa en el dibujo: lo que no figura, se rechaza.
 *
 * Sin React y sin base: recibe un dibujo y devuelve otro, o por qué no.
 */

import type { Dibujo } from "@/lib/planta-dibujo";
import { aMedioCentimetro } from "@/lib/tipos-de-muro";

/** Cómo tiene que ser el valor de una medida. */
type Regla = {
  /** Si se puede dejar vacía: vuelve a lo que le toca sola. */
  vacio: boolean;
  /** El menor valor que vale, o null si puede ser negativa. `excluido` si
   *  tiene que ser mayor y no igual. */
  minimo: number | null;
  excluido?: boolean;
};

const MAYOR_QUE_CERO: Regla = { vacio: false, minimo: 0, excluido: true };
const ALTURA_O_NADA: Regla = { vacio: true, minimo: 0, excluido: true };
const NIVEL_O_NADA: Regla = { vacio: true, minimo: null };
const DESDE_CERO_O_NADA: Regla = { vacio: true, minimo: 0 };

/** Qué se puede cambiar de cada cosa. */
const EDITABLE: Record<string, Record<string, Regla>> = {
  muro: { altura: ALTURA_O_NADA, espesor: MAYOR_QUE_CERO },
  abertura: { ancho: MAYOR_QUE_CERO, alto: MAYOR_QUE_CERO, antepecho: DESDE_CERO_O_NADA },
  ambiente: { alturaCielorraso: ALTURA_O_NADA },
  columna: {
    arriba: NIVEL_O_NADA,
    desde: NIVEL_O_NADA,
    ancho: MAYOR_QUE_CERO,
    profundidad: MAYOR_QUE_CERO,
  },
  viga: { ancho: MAYOR_QUE_CERO, alto: MAYOR_QUE_CERO, nivel: NIVEL_O_NADA },
  // El nivel de una losa llega con su signo —-0,05— y se guarda como cuánto
  // más abajo queda, en positivo (`aplicarCambio`).
  losa: { espesor: MAYOR_QUE_CERO, bajoNpt: NIVEL_O_NADA },
};

/**
 * El dibujo con una medida cambiada, o el error.
 *
 * `objeto` es la cosa como la nombra el 3D —"muro:<id>", "columna:<id>"— y
 * `clave` la medida. `valor` null es "vacía": lo que le toca sola.
 *
 * El ancho y el alto de una abertura son **de su tipo**: cambian en todas las
 * del mismo nombre, igual que en el editor. Una P1 mide lo mismo en toda la
 * planta.
 */
export function aplicarCambio(
  dibujo: Dibujo,
  objeto: string,
  clave: string,
  valor: number | null
): { dibujo: Dibujo } | { error: string } {
  const corte = objeto.indexOf(":");
  const tipo = corte === -1 ? "" : objeto.slice(0, corte);
  const id = corte === -1 ? "" : objeto.slice(corte + 1);
  const regla = EDITABLE[tipo]?.[clave];
  if (!regla || id === "") return { error: "Eso no se puede cambiar desde acá." };

  if (valor === null) {
    if (!regla.vacio) return { error: "Esa medida no puede quedar vacía." };
  } else {
    if (!Number.isFinite(valor) || Math.abs(valor) > 1000) {
      return { error: "Tiene que ser un número." };
    }
    if (regla.minimo !== null && (regla.excluido ? valor <= regla.minimo : valor < regla.minimo)) {
      return {
        error: regla.excluido ? "Tiene que ser mayor que cero." : "No puede ser negativa.",
      };
    }
  }

  // Una losa no queda por encima del piso que sostiene: con signo o sin él,
  // es cuánto más abajo.
  // El espesor de un muro va al medio centímetro, como en el editor.
  const cambio = {
    [clave]:
      tipo === "losa" && clave === "bajoNpt" && valor !== null
        ? Math.abs(valor)
        : tipo === "muro" && clave === "espesor" && valor !== null
          ? Math.max(0.005, aMedioCentimetro(valor))
          : valor,
  };
  /** Cambia la medida en los de una lista que cumplan, y dice si hubo alguno. */
  const en = <T extends { id: string }>(lista: T[], cuales: (item: T) => boolean = (i) => i.id === id) => {
    let hubo = false;
    const nueva = lista.map((item) => {
      if (!cuales(item)) return item;
      hubo = true;
      return { ...item, ...cambio };
    });
    return hubo ? nueva : null;
  };
  const noEsta = { error: "Eso ya no está en el dibujo: recargá para verlo como quedó." };

  switch (tipo) {
    case "muro": {
      const muros = en(dibujo.muros);
      return muros ? { dibujo: { ...dibujo, muros } } : noEsta;
    }
    case "abertura": {
      const esta = dibujo.aberturas.find((a) => a.id === id);
      if (!esta) return noEsta;
      if (clave === "antepecho" && esta.tipo !== "ventana") {
        return { error: "Una puerta no tiene antepecho." };
      }
      const aberturas = en(
        dibujo.aberturas,
        clave === "antepecho"
          ? (a) => a.id === id
          : (a) => a.tipo === esta.tipo && a.nombre === esta.nombre
      );
      return aberturas ? { dibujo: { ...dibujo, aberturas } } : noEsta;
    }
    case "ambiente": {
      const ambientes = en(dibujo.ambientes);
      return ambientes ? { dibujo: { ...dibujo, ambientes } } : noEsta;
    }
    case "columna": {
      const columnas = en(dibujo.estructura.columnas);
      return columnas
        ? { dibujo: { ...dibujo, estructura: { ...dibujo.estructura, columnas } } }
        : noEsta;
    }
    case "viga": {
      const vigas = en(dibujo.estructura.vigas);
      return vigas ? { dibujo: { ...dibujo, estructura: { ...dibujo.estructura, vigas } } } : noEsta;
    }
    case "losa": {
      const losas = en(dibujo.estructura.losas);
      return losas ? { dibujo: { ...dibujo, estructura: { ...dibujo.estructura, losas } } } : noEsta;
    }
    default:
      return { error: "Eso no se puede cambiar desde acá." };
  }
}
