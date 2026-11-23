/**
 * Del dibujo de las plantas al cómputo de la obra.
 *
 * El dibujo ya sabe cuánto lleva cada piso: los m² de cada tipo de muro, de
 * cada capa de pared, de piso y de cielorraso. Y cada una de esas cosas **es
 * una tarea del catálogo** —el tipo de un muro y la capa de una terminación se
 * eligen de ahí—, así que no hay nada que emparejar: lo que falta es llevar el
 * número.
 *
 * Acá se arma **un renglón de medición por tarea y por piso** —"Revoque
 * grueso · 2.º piso · Paredes · 85,40 m²"— y se lo compara con lo que el
 * cómputo ya tiene, para mostrar qué cambia antes de escribir nada.
 *
 * Por piso y no elemento por elemento: una planta tipo son cientos de caras, y
 * la cuenta cara por cara ya se revisa en el editor, que es donde se ve. En el
 * cómputo alcanza con saber cuánto lleva cada nivel.
 *
 * Sin React y sin base: recibe lo dibujado y lo guardado, y devuelve cuentas.
 */

import { cantidadDeElemento, type Forma } from "@/lib/medicion";
import { nombreDePiso, type Piso } from "@/lib/pisos";
import { metrosPorPixel, type Dibujo, type Escala } from "@/lib/planta-dibujo";
import { medirCaras, type FilaDeCapa } from "@/lib/planta-trazo";

/** Lo que hace falta de una planta para computarla. */
export type PlantaParaComputar = {
  id: string;
  nombre: string;
  /** De piso a techo, en metros. */
  altura: number;
  /** Cuántos pisos son esta planta, si no tiene pisos asignados. */
  repeticiones: number;
  escala: Escala | null;
  dibujo: Dibujo;
};

/** Un renglón de medición que sale del dibujo. */
export type RenglonDelPlano = {
  tareaId: string;
  /** El piso: su nombre en la definición de pisos, o el de la planta. */
  nivel: string;
  /** De qué parte del dibujo sale: Muros, Paredes, Pisos, Cielorrasos. */
  etiqueta: string;
  forma: Forma;
  a: null;
  /** El espesor, en una capa que se cotiza por volumen. */
  b: number | null;
  /** La superficie; o el volumen, si no hay un espesor único que mostrar. */
  c: number | null;
  /** Cuántos pisos iguales: uno, salvo la planta sin pisos asignados. */
  unidades: number;
  cantidad: number;
};

/** Los m² del edificio que el dibujo todavía no puede pasar. */
export type Pendientes = {
  murosSinTipo: number;
  sinTerminacion: number;
  sinPiso: number;
  sinCielorraso: number;
};

export type LoDelPlano = {
  renglones: RenglonDelPlano[];
  /**
   * Las tareas que el dibujo usa y no se pueden pasar: se cotizan en una
   * unidad que el plano no da (ml, u, gl). `unidad` null es una tarea que ya
   * no está en el catálogo.
   */
  noSeMiden: { tareaId: string; unidad: string | null }[];
  /** Las plantas que no miden porque no tienen escala. */
  sinEscala: string[];
  pendientes: Pendientes;
};

const ETIQUETAS = {
  muros: "Muros",
  paredes: "Paredes",
  pisos: "Pisos",
  cielorrasos: "Cielorrasos",
} as const;

const alCentimetro = (n: number) => Math.round(n * 100) / 100;
const alMilimetro = (n: number) => Math.round(n * 1000) / 1000;

const esSuperficie = (unidad: string) => /^m[²2]$/i.test(unidad.trim());
const esVolumen = (unidad: string) => /^m[³3]$/i.test(unidad.trim());

/**
 * En qué pisos está una planta.
 *
 * Los que la tienen asignada en la definición de pisos, cada uno con su nombre
 * y su altura de piso a piso —de donde cuelga la estructura que les saca lugar
 * a los muros—. Si no la tiene ninguno, la planta misma, por los pisos iguales
 * que se le cargaron.
 */
function ubicacionesDe(planta: PlantaParaComputar, pisos: Piso[]) {
  const suyos = pisos.filter((p) => p.plantaId === planta.id);
  if (suyos.length > 0) {
    return suyos.map((p) => ({ nivel: nombreDePiso(p), pisoAPiso: p.altura, unidades: 1 }));
  }
  return [
    {
      nivel: planta.nombre.trim() || "Sin nivel",
      pisoAPiso: null as number | null,
      unidades: Math.max(1, planta.repeticiones),
    },
  ];
}

/**
 * Lo que el dibujo de las plantas mide para el cómputo.
 *
 * `unidadDe` dice en qué se cotiza cada tarea: la unidad que tiene en el
 * cómputo de la obra si ya está —alguien pudo cambiársela—, y si no la del
 * catálogo. De ahí sale qué número se lleva:
 *
 *   m²   la superficie.
 *   m³   la superficie por el espesor. Con un espesor único el renglón muestra
 *        la cuenta —0,02 × 85,40—; con varios, el volumen ya sumado. Una capa
 *        sin espesor cargado queda en cero, a la vista: es lo que falta.
 *   otra no se pasa, y se avisa: el plano no da metros lineales ni unidades.
 *
 * Los renglones salen en el orden del edificio: los pisos de abajo hacia
 * arriba, y en cada uno los muros, las paredes, los pisos y los cielorrasos.
 */
export function delPlano(
  plantas: PlantaParaComputar[],
  pisos: Piso[],
  unidadDe: (tareaId: string) => string | null
): LoDelPlano {
  const renglones: (RenglonDelPlano & { orden: number })[] = [];
  const noSeMiden = new Map<string, string | null>();
  const sinEscala: string[] = [];
  const pendientes: Pendientes = {
    murosSinTipo: 0,
    sinTerminacion: 0,
    sinPiso: 0,
    sinCielorraso: 0,
  };

  // El lugar de cada piso en el edificio, para ordenar los renglones.
  const lugar = new Map(pisos.map((p, i) => [nombreDePiso(p), i] as const));

  plantas.forEach((planta, indice) => {
    const mpp = metrosPorPixel(planta.escala);
    if (mpp === null) {
      sinEscala.push(planta.nombre);
      return;
    }

    for (const lugarDePlanta of ubicacionesDe(planta, pisos)) {
      const medida = medirCaras(planta.dibujo, mpp, planta.altura, lugarDePlanta.pisoAPiso);
      if (!medida) continue;

      const { nivel, unidades } = lugarDePlanta;
      pendientes.murosSinTipo += medida.murosSinTipo * unidades;
      pendientes.sinTerminacion += medida.sinTerminacion * unidades;
      pendientes.sinPiso += medida.sinPiso * unidades;
      pendientes.sinCielorraso += medida.sinCielorraso * unidades;

      // Los pisos definidos van primero y en su orden; las plantas sueltas,
      // después, en el de la lista.
      const orden = lugar.get(nivel) ?? pisos.length + indice;

      const agregar = (etiqueta: string, fila: FilaDeCapa) => {
        const unidad = unidadDe(fila.capa);
        const medidas = medidasDe(fila, unidad);
        if (!medidas) {
          noSeMiden.set(fila.capa, unidad);
          return;
        }
        const elemento = { ...medidas, a: null, unidades };
        const cantidad = cantidadDeElemento(elemento);
        // Una capa con espesor pero sin superficie no es un pendiente: no
        // está. Sin espesor sí se guarda, en cero, para que se vea que falta.
        if (cantidad <= 0 && fila.superficie < 0.005) return;
        renglones.push({ tareaId: fila.capa, nivel, etiqueta, ...elemento, cantidad, orden });
      };

      for (const m of medida.muros) {
        // El muro trae su volumen ya hecho: cada uno tiene su espesor.
        agregar(ETIQUETAS.muros, { ...m, espesor: null });
      }
      for (const c of medida.porCapa) agregar(ETIQUETAS.paredes, c);
      for (const c of medida.pisos) agregar(ETIQUETAS.pisos, c);
      for (const c of medida.cielorrasos) agregar(ETIQUETAS.cielorrasos, c);
    }
  });

  return {
    // `sort` es estable: dentro de un piso queda el orden en que se agregaron.
    renglones: renglones
      .sort((a, b) => a.orden - b.orden)
      .map((r) => ({
        tareaId: r.tareaId,
        nivel: r.nivel,
        etiqueta: r.etiqueta,
        forma: r.forma,
        a: r.a,
        b: r.b,
        c: r.c,
        unidades: r.unidades,
        cantidad: r.cantidad,
      })),
    noSeMiden: Array.from(noSeMiden, ([tareaId, unidad]) => ({ tareaId, unidad })),
    sinEscala,
    pendientes,
  };
}

/** Qué medidas lleva el renglón de una capa, según en qué se cotiza su tarea. */
function medidasDe(
  fila: FilaDeCapa,
  unidad: string | null
): { forma: Forma; b: number | null; c: number | null } | null {
  if (unidad === null) return null;

  if (esSuperficie(unidad)) {
    return { forma: "directo", b: null, c: alCentimetro(fila.superficie) };
  }
  if (esVolumen(unidad)) {
    if (fila.espesor !== null && fila.espesor > 0) {
      return { forma: "superficie", b: fila.espesor, c: alCentimetro(fila.superficie) };
    }
    const volumen = alMilimetro(fila.volumen);
    return { forma: "directo", b: null, c: volumen > 0 ? volumen : null };
  }
  return null;
}

/* ============================ Contra el cómputo ============================ */

/** Un renglón de medición como está guardado. */
export type RenglonGuardado = {
  origen: "mano" | "plano";
  nivel: string | null;
  etiqueta: string | null;
  forma: Forma;
  b: number | null;
  c: number | null;
  unidades: number;
  cantidad: number;
};

/** Una tarea del cómputo, con su medición. */
export type ItemGuardado = {
  id: string;
  tareaId: string | null;
  cantidad: number;
  medicion: RenglonGuardado[];
};

/** Qué le pasa a una tarea si se pasa el plano al cómputo. */
export type LineaDelPase = {
  tareaId: string;
  /** Null: la tarea todavía no está en el cómputo, y se agrega. */
  itemId: string | null;
  /** La cantidad que la tarea tiene hoy. */
  hoy: number;
  /** Lo que el plano mide ahora. */
  delPlano: number;
  /** Lo que tiene medido a mano, que se queda como está. */
  aMano: number;
  /** La cantidad con la que queda: lo del plano más lo medido a mano. */
  queda: number;
  /**
   * Tenía la cantidad escrita a mano, sin medición: con los renglones del
   * plano pasa a ser la suma, y ese número se pierde.
   */
  pisaLaEscrita: boolean;
  /** Si lo guardado como del plano no es lo que el plano mide ahora. */
  cambia: boolean;
  /** Los renglones que quedan para esta tarea. */
  renglones: RenglonDelPlano[];
};

const firmaDe = (r: {
  nivel: string | null;
  etiqueta: string | null;
  forma: Forma;
  b: number | null;
  c: number | null;
  unidades: number;
}) =>
  [
    (r.nivel ?? "").trim(),
    (r.etiqueta ?? "").trim(),
    r.forma,
    r.b === null ? "" : r.b.toFixed(4),
    r.c === null ? "" : r.c.toFixed(4),
    r.unidades.toFixed(4),
  ].join("|");

/**
 * Lo que el plano mide, tarea por tarea, contra lo que el cómputo tiene.
 *
 * Entran las tareas que el plano mide y las que el cómputo tiene con
 * renglones del plano: una capa que se sacó del dibujo sigue guardada, y
 * pasar el plano la tiene que sacar.
 *
 * Lo medido a mano no se toca nunca: la cantidad de una tarea queda en lo del
 * plano **más** lo de mano. Si mide lo mismo dos veces, eso se ve en `aMano`,
 * que es lo que la pantalla avisa.
 *
 * Una tarea que queda sin ningún renglón —el plano dejó de medirla y a mano no
 * tenía nada— queda en cero: su cantidad había salido del dibujo, y el dibujo
 * ya no la dice.
 */
export function compararConComputo(
  renglones: RenglonDelPlano[],
  items: ItemGuardado[]
): LineaDelPase[] {
  const porTarea = new Map<string, RenglonDelPlano[]>();
  for (const r of renglones) {
    const lista = porTarea.get(r.tareaId) ?? [];
    lista.push(r);
    porTarea.set(r.tareaId, lista);
  }

  // Una tarea del catálogo está una sola vez en el cómputo.
  const itemDe = new Map<string, ItemGuardado>();
  for (const i of items) {
    if (i.tareaId && !itemDe.has(i.tareaId)) itemDe.set(i.tareaId, i);
  }

  const tareas = new Set(porTarea.keys());
  for (const [tareaId, item] of itemDe) {
    if (item.medicion.some((m) => m.origen === "plano")) tareas.add(tareaId);
  }

  return Array.from(tareas, (tareaId): LineaDelPase => {
    const nuevos = porTarea.get(tareaId) ?? [];
    const item = itemDe.get(tareaId) ?? null;
    const guardados = (item?.medicion ?? []).filter((m) => m.origen === "plano");
    const deMano = (item?.medicion ?? []).filter((m) => m.origen === "mano");

    const delPlano = nuevos.reduce((t, r) => t + r.cantidad, 0);
    const aMano = deMano.reduce((t, m) => t + m.cantidad, 0);

    const antes = guardados.map(firmaDe).sort().join("\n");
    const despues = nuevos.map(firmaDe).sort().join("\n");

    return {
      tareaId,
      itemId: item?.id ?? null,
      hoy: item?.cantidad ?? 0,
      delPlano: alMilimetro(delPlano),
      aMano: alMilimetro(aMano),
      queda: alMilimetro(delPlano + aMano),
      pisaLaEscrita:
        item !== null && item.medicion.length === 0 && item.cantidad > 0 && nuevos.length > 0,
      cambia: item === null || antes !== despues,
      renglones: nuevos,
    };
  });
}
