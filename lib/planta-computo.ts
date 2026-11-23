/**
 * Del dibujo de las plantas al cómputo de la obra.
 *
 * El dibujo ya sabe cuánto lleva cada piso: los m² de cada tipo de muro, de
 * cada capa de pared, de piso y de cielorraso, y los m³ de cada pieza de la
 * estructura. Y cada una de esas cosas **es una tarea del catálogo** —el tipo
 * de un muro, la capa de una terminación y la tarea de una columna se eligen
 * de ahí—, así que no hay nada que emparejar: lo que falta es llevar el número.
 *
 * Acá se arman los renglones de medición y se los compara con lo que el
 * cómputo ya tiene, para mostrar qué cambia antes de escribir nada:
 *
 *   terminaciones y muros   **uno por tarea y por piso** —"Revoque grueso ·
 *                           2.º piso · Paredes · 85,40 m²"—. Una planta tipo
 *                           son cientos de caras, y la cuenta cara por cara ya
 *                           se revisa en el editor.
 *   estructura              **uno por pieza** —"V03 · 2.º piso · 0,12 × 0,45 ×
 *                           3,80"—, que es como se computa un hormigón: cada
 *                           pieza tiene nombre y se controla contra la
 *                           planilla de estructura.
 *
 * Sin React y sin base: recibe lo dibujado y lo guardado, y devuelve cuentas.
 */

import { cantidadDeElemento, type Forma } from "@/lib/medicion";
import { nombreDePiso, type Piso } from "@/lib/pisos";
import { metrosPorPixel, type Dibujo, type Escala } from "@/lib/planta-dibujo";
import { medirEstructura } from "@/lib/planta-estructura";
import type { Composicion } from "@/lib/tipos-de-muro";
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
  /**
   * De qué parte del dibujo sale —Muros, Paredes, Pisos, Cielorrasos—, o el
   * nombre de la pieza de estructura: C01, V03, L1.
   */
  etiqueta: string;
  forma: Forma;
  /** El ancho de una columna o una viga. */
  a: number | null;
  /** El espesor, o la profundidad de una columna, o el alto de una viga. */
  b: number | null;
  /** La superficie o el largo; o el volumen, si no hay cuenta que mostrar. */
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
  /** Piezas de hormigón dibujadas, sin tarea: su hormigón no se pasa. */
  piezasSinTarea: number;
  /** Piezas metálicas: se cotizan en kg, y el plano todavía no da el peso. */
  metalicas: number;
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
  zocalos: "Zócalos",
  muros: "Muros",
  paredes: "Paredes",
  pisos: "Pisos",
  cielorrasos: "Cielorrasos",
} as const;

const alCentimetro = (n: number) => Math.round(n * 100) / 100;
const alMilimetro = (n: number) => Math.round(n * 1000) / 1000;
/**
 * Un volumen ya hecho, con los seis decimales que guarda la medición: una viga
 * de 0,15048 m³ redondeada al litro pierde medio litro, y en un edificio son
 * cientos de vigas.
 */
const alCentimetroCubico = (n: number) => Math.round(n * 1e6) / 1e6;

const esSuperficie = (unidad: string) => /^m[²2]$/i.test(unidad.trim());
const esVolumen = (unidad: string) => /^m[³3]$/i.test(unidad.trim());
const esLargo = (unidad: string) => /^(ml|m)$/i.test(unidad.trim());

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
    return suyos.map((p) => ({
      nivel: nombreDePiso(p),
      pisoAPiso: p.altura,
      unidades: 1,
    }));
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
  unidadDe: (tareaId: string) => string | null,
  tipos: Map<string, Composicion> = new Map()
): LoDelPlano {
  const renglones: (RenglonDelPlano & { orden: number })[] = [];
  const noSeMiden = new Map<string, string | null>();
  const sinEscala: string[] = [];
  const pendientes: Pendientes = {
    murosSinTipo: 0,
    sinTerminacion: 0,
    sinPiso: 0,
    sinCielorraso: 0,
    piezasSinTarea: 0,
    metalicas: 0,
  };

  // El lugar de cada piso en el edificio, para ordenar los renglones.
  const lugar = new Map(pisos.map((p, i) => [nombreDePiso(p), i] as const));

  plantas.forEach((planta, indice) => {
    const mpp = metrosPorPixel(planta.escala);
    if (mpp === null) {
      sinEscala.push(planta.nombre);
      return;
    }

    // Lo que falta en la estructura se cuenta por pieza dibujada, no por piso:
    // es lo que hay que ir a completar.
    const { columnas, vigas, losas } = planta.dibujo.estructura;
    for (const pieza of [...columnas, ...vigas]) {
      if (pieza.material === "metalica") pendientes.metalicas += 1;
      else if (pieza.tarea === null) pendientes.piezasSinTarea += 1;
    }
    pendientes.piezasSinTarea += losas.filter((l) => l.tarea === null).length;

    for (const lugarDePlanta of ubicacionesDe(planta, pisos)) {
      const medida = medirCaras(
        planta.dibujo,
        mpp,
        planta.altura,
        lugarDePlanta.pisoAPiso,
        tipos
      );
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
        renglones.push({
          tareaId: fila.capa,
          nivel,
          etiqueta,
          ...elemento,
          cantidad,
          orden,
        });
      };

      // La estructura primero: es el orden de la obra.
      const estructura = medirEstructura(
        planta.dibujo.estructura,
        mpp,
        planta.altura,
        lugarDePlanta.pisoAPiso,
      );
      const agregarPieza = (
        tareaId: string | null,
        nombre: string,
        medidas: (
          unidad: string,
        ) => {
          forma: Forma;
          a: number | null;
          b: number | null;
          c: number | null;
        } | null,
      ) => {
        if (tareaId === null) return;
        const unidad = unidadDe(tareaId);
        const elegidas = unidad === null ? null : medidas(unidad);
        if (!elegidas) {
          noSeMiden.set(tareaId, unidad);
          return;
        }
        const elemento = { ...elegidas, unidades };
        const cantidad = cantidadDeElemento(elemento);
        // Una pieza que queda entera adentro de otra no tiene hormigón propio.
        if (cantidad <= 0) return;
        renglones.push({
          tareaId,
          nivel,
          etiqueta: nombre.trim() || "Sin nombre",
          ...elemento,
          cantidad,
          orden,
        });
      };

      if (estructura) {
        for (const c of planta.dibujo.estructura.columnas) {
          if (c.material === "metalica") continue;
          const m = estructura.columnas.find((x) => x.id === c.id);
          if (!m) continue;
          agregarPieza(c.tarea, c.nombre, (unidad) =>
            esVolumen(unidad)
              ? cuentaDePrisma(m, c.ancho, c.profundidad, m.alto)
              : null,
          );
        }
        for (const v of planta.dibujo.estructura.vigas) {
          if (v.material === "metalica") continue;
          const m = estructura.vigas.find((x) => x.id === v.id);
          if (!m) continue;
          agregarPieza(v.tarea, v.nombre, (unidad) =>
            esVolumen(unidad)
              ? // Un tabique, de losa a losa: su alto es el que le toca, no el de viga.
                cuentaDePrisma(m, v.ancho, v.tabique ? m.hasta - m.desde : v.alto, m.largo)
              : null,
          );
        }
        for (const l of planta.dibujo.estructura.losas) {
          const m = estructura.losas.find((x) => x.id === l.id);
          if (!m) continue;
          agregarPieza(l.tarea, l.nombre, (unidad) => {
            // Una losa de viguetas se cotiza por su superficie.
            if (esSuperficie(unidad)) {
              return {
                forma: "directo",
                a: null,
                b: null,
                c: alCentimetro(m.superficie),
              };
            }
            if (!esVolumen(unidad)) return null;
            return Math.abs(m.bruto - m.neto) < 0.0005
              ? {
                  forma: "superficie",
                  a: null,
                  b: l.espesor,
                  c: alCentimetro(m.superficie),
                }
              : { forma: "directo", a: null, b: null, c: alCentimetroCubico(m.neto) };
          });
        }
      }

      for (const m of medida.muros) {
        // El muro trae su volumen ya hecho: cada uno tiene su espesor.
        agregar(ETIQUETAS.muros, { ...m, espesor: null });
      }
      for (const c of medida.porCapa) agregar(ETIQUETAS.paredes, c);
      for (const c of medida.pisos) agregar(ETIQUETAS.pisos, c);
      for (const c of medida.cielorrasos) agregar(ETIQUETAS.cielorrasos, c);

      // Los zócalos, en metros lineales: lo único del plano que va por largo.
      for (const z of medida.zocalos) {
        const unidad = unidadDe(z.capa);
        if (unidad === null || !esLargo(unidad)) {
          noSeMiden.set(z.capa, unidad);
          continue;
        }
        const elemento = { forma: "directo" as const, a: null, b: null, c: alCentimetro(z.largo), unidades };
        const cantidad = cantidadDeElemento(elemento);
        if (cantidad <= 0) continue;
        renglones.push({ tareaId: z.capa, nivel, etiqueta: ETIQUETAS.zocalos, ...elemento, cantidad, orden });
      }
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
    noSeMiden: Array.from(noSeMiden, ([tareaId, unidad]) => ({
      tareaId,
      unidad,
    })),
    sinEscala,
    pendientes,
  };
}

/**
 * El renglón de una columna o una viga: ancho × alto × largo, como en la
 * planilla de estructura, **si la pieza no comparte nada con otra**. Si le
 * tocó ceder un nudo —la viga que entra en una columna, o que la losa cubre—
 * la cuenta de sus tres medidas daría la pieza entera y contaría el nudo dos
 * veces: va su volumen, ya descontado.
 */
function cuentaDePrisma(
  medida: { bruto: number; neto: number },
  ancho: number,
  segunda: number,
  largo: number,
): { forma: Forma; a: number | null; b: number | null; c: number | null } {
  if (Math.abs(medida.bruto - medida.neto) < 0.0005) {
    return { forma: "prisma", a: ancho, b: segunda, c: alMilimetro(largo) };
  }
  return { forma: "directo", a: null, b: null, c: alCentimetroCubico(medida.neto) };
}

/** Qué medidas lleva el renglón de una capa, según en qué se cotiza su tarea. */
function medidasDe(
  fila: FilaDeCapa,
  unidad: string | null,
): { forma: Forma; b: number | null; c: number | null } | null {
  if (unidad === null) return null;

  if (esSuperficie(unidad)) {
    return { forma: "directo", b: null, c: alCentimetro(fila.superficie) };
  }
  if (esVolumen(unidad)) {
    if (fila.espesor !== null && fila.espesor > 0) {
      return {
        forma: "superficie",
        b: fila.espesor,
        c: alCentimetro(fila.superficie),
      };
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
  a: number | null;
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
  a: number | null;
  b: number | null;
  c: number | null;
  unidades: number;
}) =>
  [
    (r.nivel ?? "").trim(),
    (r.etiqueta ?? "").trim(),
    r.forma,
    r.a == null ? "" : r.a.toFixed(4),
    r.b == null ? "" : r.b.toFixed(4),
    r.c == null ? "" : r.c.toFixed(4),
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
  items: ItemGuardado[],
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
    const guardados = (item?.medicion ?? []).filter(
      (m) => m.origen === "plano",
    );
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
        item !== null &&
        item.medicion.length === 0 &&
        item.cantidad > 0 &&
        nuevos.length > 0,
      cambia: item === null || antes !== despues,
      renglones: nuevos,
    };
  });
}
