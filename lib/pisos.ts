/**
 * La definición de pisos de una obra: cada piso con su nivel.
 *
 * Es la tabla de pisos de un programa de arquitectura: número, nombre, cota de
 * nivel y altura. Las cotas **van encadenadas**: la de un piso es la del de
 * abajo más su altura, así que cambiar la altura de uno sube o baja a todos
 * los de arriba, y nadie tiene que rehacer la suma a mano —que es donde un
 * corte queda con dos pisos pisándose—.
 *
 * Sin React y sin base: son cuentas, y se prueban solas. Lo usa el diálogo al
 * editar y el servidor al guardar.
 */

/** Un piso, como se guarda y como se muestra. */
export type Piso = {
  /** 0 es la planta baja; hacia arriba 1, 2, 3; los subsuelos, negativos. */
  numero: number;
  /** Vacío: se lo nombra por su número (`nombreDePiso`). */
  nombre: string;
  /** El nivel de piso terminado, en metros sobre el ±0,00 de la obra. */
  cota: number;
  /** De piso a piso, en metros. */
  altura: number;
  /** La planta dibujada que le toca, o null si todavía no tiene. */
  plantaId: string | null;
};

/** Lo que es de un piso y no sale de su lugar en la lista. */
export type FilaDePiso = { nombre: string; altura: number; plantaId: string | null };

/**
 * La definición mientras se edita: los pisos **de abajo hacia arriba**, cuál
 * de ellos es la planta baja (`base`) y a qué nivel está. De eso salen el
 * número y la cota de cada uno: guardados por separado, insertar un piso en
 * el medio obligaría a renumerar y a recalcular a mano.
 */
export type Definicion = { filas: FilaDePiso[]; base: number; cotaBase: number };

export const DEFINICION_VACIA: Definicion = { filas: [], base: 0, cotaBase: 0 };

/** Con qué altura arranca el primer piso: la de piso a piso más común. */
export const ALTURA_DE_PISO_INICIAL = 3;

const alMilimetro = (n: number) => Math.round(n * 1000) / 1000;

/** Los pisos de una definición, de abajo hacia arriba, con número y cota. */
export function pisosDe(def: Definicion): Piso[] {
  const cotas: number[] = new Array(def.filas.length).fill(0);
  if (def.filas.length === 0) return [];

  const base = Math.min(Math.max(def.base, 0), def.filas.length - 1);
  cotas[base] = def.cotaBase;
  // Hacia arriba, cada uno arranca donde termina el de abajo.
  for (let i = base + 1; i < def.filas.length; i++) {
    cotas[i] = cotas[i - 1] + def.filas[i - 1].altura;
  }
  // Hacia abajo, un subsuelo termina donde arranca el piso de arriba.
  for (let i = base - 1; i >= 0; i--) {
    cotas[i] = cotas[i + 1] - def.filas[i].altura;
  }

  return def.filas.map((fila, i) => ({
    numero: i - base,
    nombre: fila.nombre,
    cota: alMilimetro(cotas[i]),
    altura: fila.altura,
    plantaId: fila.plantaId,
  }));
}

/**
 * La definición que corresponde a los pisos guardados.
 *
 * Las cotas se rehacen desde las alturas: si lo guardado no cerrara —una cota
 * que no es la de abajo más su altura—, manda la cadena, que es la que no deja
 * pisos encimados. La planta baja es el piso 0; si no hay, el primero que no
 * es subsuelo.
 */
export function aDefinicion(pisos: Piso[]): Definicion {
  if (pisos.length === 0) return DEFINICION_VACIA;

  const ordenados = [...pisos].sort((a, b) => a.numero - b.numero);
  const sobreTierra = ordenados.findIndex((p) => p.numero >= 0);
  const base = sobreTierra === -1 ? ordenados.length - 1 : sobreTierra;

  return {
    filas: ordenados.map((p) => ({ nombre: p.nombre, altura: p.altura, plantaId: p.plantaId })),
    base,
    cotaBase: ordenados[base].cota,
  };
}

/**
 * Suma un piso encima o debajo de otro. Devuelve la definición y el lugar
 * donde quedó el nuevo.
 *
 * El nuevo copia la altura y la planta del que se tomó de referencia: casi
 * siempre se inserta otro piso de la misma planta tipo. Los números se
 * acomodan solos, y la planta baja sigue siendo la planta baja: un piso que
 * entra por debajo de ella es un subsuelo más, no la corre para arriba.
 *
 * En una definición vacía, pone la planta baja.
 */
export function insertarPiso(
  def: Definicion,
  indice: number,
  donde: "encima" | "abajo"
): { def: Definicion; indice: number } {
  if (def.filas.length === 0) {
    return {
      def: {
        filas: [{ nombre: "", altura: ALTURA_DE_PISO_INICIAL, plantaId: null }],
        base: 0,
        cotaBase: def.cotaBase,
      },
      indice: 0,
    };
  }

  const referencia = def.filas[indice];
  if (!referencia) return { def, indice };

  const lugar = donde === "encima" ? indice + 1 : indice;
  const filas = [
    ...def.filas.slice(0, lugar),
    { nombre: "", altura: referencia.altura, plantaId: referencia.plantaId },
    ...def.filas.slice(lugar),
  ];
  // Todo lo que entra de la planta baja para abajo la empuja un lugar en la
  // lista, para que siga siendo el piso 0.
  const base = lugar <= def.base ? def.base + 1 : def.base;

  return { def: { ...def, filas, base }, indice: lugar };
}

/**
 * Saca un piso. Los de arriba bajan lo que él medía.
 *
 * Si era la planta baja, pasa a serlo el que tenía encima —o, si no había, el
 * de abajo—, y conserva su nivel: el ±0,00 de la obra no se mueve porque se
 * borre un renglón.
 */
export function borrarPiso(def: Definicion, indice: number): Definicion {
  if (!def.filas[indice]) return def;

  const filas = def.filas.filter((_, i) => i !== indice);
  if (filas.length === 0) return { ...DEFINICION_VACIA, cotaBase: def.cotaBase };

  const base = indice < def.base ? def.base - 1 : Math.min(def.base, filas.length - 1);
  return { ...def, filas, base };
}

/** Cambia algo de un piso: su nombre, su altura, su planta. */
export function cambiarPiso(
  def: Definicion,
  indice: number,
  cambios: Partial<FilaDePiso>
): Definicion {
  if (cambios.altura !== undefined && !(cambios.altura > 0)) return def;
  return {
    ...def,
    filas: def.filas.map((fila, i) => (i === indice ? { ...fila, ...cambios } : fila)),
  };
}

/**
 * Escribe la cota de un piso.
 *
 * Como las cotas salen de las alturas, poner una es cambiar una altura: la
 * del piso de abajo si está sobre la planta baja —es el que tiene que estirar
 * para llegar hasta ahí—, la propia si es un subsuelo. La de la planta baja
 * es el origen, y moverla sube o baja el edificio entero.
 *
 * Si la cota dejaría un piso con altura cero o negativa —más abajo que el
 * que tiene debajo—, no cambia nada.
 */
export function ponerCota(def: Definicion, indice: number, cota: number): Definicion {
  if (!def.filas[indice] || !Number.isFinite(cota)) return def;
  if (indice === def.base) return { ...def, cotaBase: alMilimetro(cota) };

  const cotas = pisosDe(def).map((p) => p.cota);
  if (indice > def.base) {
    return cambiarPiso(def, indice - 1, { altura: alMilimetro(cota - cotas[indice - 1]) });
  }
  return cambiarPiso(def, indice, { altura: alMilimetro(cotas[indice + 1] - cota) });
}

/** Cómo se nombra un piso que no tiene nombre puesto: por su número. */
export function nombreDePiso(piso: Pick<Piso, "numero" | "nombre">): string {
  if (piso.nombre.trim() !== "") return piso.nombre.trim();
  if (piso.numero === 0) return "Planta baja";
  return piso.numero > 0 ? `${piso.numero}.º piso` : `${-piso.numero}.º subsuelo`;
}

/**
 * Lo que llega de afuera, convertido en pisos o en por qué no sirve.
 *
 * Lo usa el servidor antes de guardar: la lista viene del navegador, y lo que
 * entra a la base tiene que ser una definición que después se pueda leer —sin
 * dos pisos con el mismo número, sin alturas en cero—.
 */
export function leerPisos(valor: unknown): { pisos: Piso[] } | { error: string } {
  if (!Array.isArray(valor)) return { error: "La definición de pisos no llegó bien." };

  const pisos: Piso[] = [];
  const numeros = new Set<number>();
  for (const crudo of valor) {
    if (typeof crudo !== "object" || crudo === null) return { error: "Hay un piso mal cargado." };
    const r = crudo as Record<string, unknown>;
    const numero = Number(r.numero);
    const cota = Number(r.cota);
    const altura = Number(r.altura);

    if (!Number.isInteger(numero) || Math.abs(numero) > 200) {
      return { error: "Hay un piso con un número que no sirve." };
    }
    if (numeros.has(numero)) return { error: `El piso ${numero} está dos veces.` };
    if (!Number.isFinite(cota) || Math.abs(cota) > 1000) {
      return { error: `La cota del piso ${numero} tiene que ser un número.` };
    }
    if (!(altura > 0) || altura > 100) {
      return { error: `La altura del piso ${numero} tiene que ser mayor que cero.` };
    }

    numeros.add(numero);
    pisos.push({
      numero,
      nombre: typeof r.nombre === "string" ? r.nombre.trim() : "",
      cota,
      altura,
      plantaId: typeof r.plantaId === "string" && r.plantaId !== "" ? r.plantaId : null,
    });
  }

  return { pisos: pisos.sort((a, b) => a.numero - b.numero) };
}
