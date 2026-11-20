/**
 * La medición de una tarea del cómputo: los elementos que se midieron y la
 * cantidad que sale de ellos.
 *
 * Una tarea dice 22,28 m³ de vigas. Ese número es el resultado de medir ciento
 * treinta y dos vigas, y hasta ahora esa cuenta vivía en una planilla aparte.
 * Acá cada elemento es una fila —la viga V-201, de 0,12 x 0,45 x 4,49— y la
 * cantidad de la tarea es la suma.
 *
 * Sin importar nada: la usan el servidor al guardar y la pantalla al escribir,
 * y si cada uno multiplicara a su manera la fila mostraría un número y la base
 * guardaría otro.
 */

/** Qué se multiplica en un elemento. */
export type Forma = "prisma" | "superficie" | "directo";

/** Qué tan firme es la medida. */
export type EstadoMedida = "firme" | "estimado" | "hipotesis" | "pendiente";

export type Elemento = {
  forma: Forma;
  /** Ancho o base, alto o espesor, largo o área. Cuáles se usan lo dice `forma`. */
  a: number | null;
  b: number | null;
  c: number | null;
  unidades: number;
};

/**
 * Las tres formas de medir, con qué columnas pide cada una.
 *
 * No son tres fórmulas arbitrarias: son las tres que aparecen en cualquier
 * cómputo de estructura. Meterlas en una sola columna —a veces un largo, a
 * veces un área, a veces un volumen ya calculado— es lo que vuelve ilegible
 * una planilla, porque mirando el número no se sabe qué es.
 */
export const FORMAS: {
  valor: Forma;
  nombre: string;
  /** Lo que se multiplica, para el desplegable. */
  cuenta: string;
  usa: ("a" | "b" | "c")[];
}[] = [
  {
    valor: "prisma",
    nombre: "Ancho × Alto × Largo",
    cuenta: "a × b × c × unidades",
    usa: ["a", "b", "c"],
  },
  {
    // Nombrada por sus columnas y no "espesor × área": eso es una losa, pero
    // la misma forma mide un paño de mampostería por alto y largo, y un
    // nombre de hormigón ahí adentro confunde más de lo que explica.
    valor: "superficie",
    nombre: "Alto/esp. × Largo/área",
    cuenta: "b × c × unidades",
    usa: ["b", "c"],
  },
  {
    valor: "directo",
    nombre: "Ya es el resultado",
    cuenta: "c × unidades",
    usa: ["c"],
  },
];

export const ESTADOS: { valor: EstadoMedida; nombre: string; corto: string }[] = [
  { valor: "firme", nombre: "Firme", corto: "" },
  { valor: "estimado", nombre: "Estimada", corto: "est." },
  { valor: "hipotesis", nombre: "Hipótesis previa", corto: "hip." },
  { valor: "pendiente", nombre: "Pendiente", corto: "pend." },
];

/** Qué medidas pide una forma. */
export function medidasDe(forma: Forma): ("a" | "b" | "c")[] {
  return FORMAS.find((f) => f.valor === forma)?.usa ?? ["a", "b", "c"];
}

/**
 * Lo que aporta un elemento.
 *
 * Una medida que falta deja el elemento en cero y no suma. Es a propósito: la
 * alternativa —tratar el vacío como un uno, o como un cero que igual
 * multiplica— esconde lo que falta medir adentro de un total que parece
 * completo. Así el pendiente se ve restando.
 */
export function cantidadDeElemento(e: Elemento): number {
  const unidades = Number(e.unidades);
  if (!Number.isFinite(unidades) || unidades <= 0) return 0;

  let producto = unidades;
  for (const m of medidasDe(e.forma)) {
    const valor = Number(e[m]);
    if (e[m] === null || !Number.isFinite(valor) || valor <= 0) return 0;
    producto *= valor;
  }
  return producto;
}

/** Si al elemento le falta alguna de las medidas que su forma pide. */
export function leFaltaMedida(e: Elemento): boolean {
  return medidasDe(e.forma).some((m) => {
    const valor = Number(e[m]);
    return e[m] === null || !Number.isFinite(valor) || valor <= 0;
  });
}

/** La cantidad de la tarea: la suma de sus elementos. */
export function totalDeMedicion(elementos: Elemento[]): number {
  return elementos.reduce((a, e) => a + cantidadDeElemento(e), 0);
}

export type TotalDeNivel = {
  /** "" cuando el elemento no declaró nivel: se muestra como "Sin nivel". */
  nivel: string;
  cantidad: number;
  elementos: number;
  /** Cuántos no suman todavía porque les falta una medida. */
  pendientes: number;
};

/**
 * Los totales por nivel, en el orden en que aparecen los elementos.
 *
 * Por orden de aparición y no alfabético: "Sobre 1.º" y "Sobre planta baja" se
 * ordenarían al revés de como se construye el edificio, y el orden de la
 * planilla es el que el que la cargó eligió.
 */
export function totalesPorNivel(
  elementos: (Elemento & { nivel: string | null })[]
): TotalDeNivel[] {
  const porNivel = new Map<string, TotalDeNivel>();

  for (const e of elementos) {
    const nivel = (e.nivel ?? "").trim();
    const fila = porNivel.get(nivel) ?? { nivel, cantidad: 0, elementos: 0, pendientes: 0 };
    fila.cantidad += cantidadDeElemento(e);
    fila.elementos += 1;
    if (leFaltaMedida(e)) fila.pendientes += 1;
    porNivel.set(nivel, fila);
  }

  return [...porNivel.values()];
}

export type ElementoPegado = Elemento & {
  nivel: string | null;
  etiqueta: string | null;
  estado: EstadoMedida;
  fuente: string | null;
};

/**
 * Lee un bloque pegado desde Excel.
 *
 * Doscientos cincuenta elementos a mano no los carga nadie, así que la
 * medición tiene que poder venir de la planilla donde ya está. Se pegan las
 * columnas **en el orden en que están en la planilla de cómputo**:
 *
 *   tipo · ID · ancho · alto · largo · unidades · volumen · estado · fuente · nivel
 *
 * Por posición y no adivinando: una planilla de cómputo no trae encabezados
 * fiables —se repiten por nivel, cambian de mayúsculas— y errarle a una
 * columna de dimensiones es peor que no importar nada.
 *
 * La columna de volumen se lee y se descarta: es el resultado, y el resultado
 * lo rehace la app a partir de las medidas. Si no coincidiera, es que la
 * planilla tenía una fórmula distinta y conviene que se note.
 *
 * Las filas que no son elementos —el encabezado, los títulos de grupo, los
 * subtotales, el nombre del nivel, el resumen del final— se saltean solas: un
 * cómputo pegado entero las trae en el medio y pedirle a alguien que las borre
 * antes es pedirle que no use esto.
 */
export function leerPegado(texto: string): ElementoPegado[] {
  const filas: ElementoPegado[] = [];

  for (const linea of texto.split("\n")) {
    if (!linea.trim()) continue;

    const col = linea.split("\t").map((c) => c.trim());
    const tipo = col[0] ?? "";

    if (NO_ES_ELEMENTO.test(tipo)) continue;
    // Una fila de totales trae un número donde los elementos traen su nombre:
    // el resumen por nivel del final de la planilla empieza con "S/PB" y sigue
    // con los metros cúbicos de cada grupo. Sumarla sería contar todo dos
    // veces, que es el error que más caro sale de un cómputo importado.
    if (col[1] && numeroDe(col[1]) !== null) continue;

    const a = numeroDe(col[2]);
    const b = numeroDe(col[3]);
    const c = numeroDe(col[4]);

    // Sin ninguna medida no hay elemento: es un título o una fila en blanco
    // que se coló.
    if (a === null && b === null && c === null) continue;

    const unidades = numeroDe(col[5]);

    const forma = formaDe(tipo, a, b, c);
    const usa = medidasDe(forma);

    filas.push({
      forma,
      // Sólo las medidas que la forma usa: el 1 de relleno de una losa se
      // descarta en vez de quedar guardado pareciendo un ancho.
      a: usa.includes("a") ? a : null,
      b: usa.includes("b") ? b : null,
      c: usa.includes("c") ? c : null,
      unidades: unidades && unidades > 0 ? unidades : 1,
      etiqueta: col[1] || null,
      estado: estadoDe(col[7] ?? ""),
      fuente: col[8] || null,
      nivel: col[9] || null,
    });
  }

  return filas;
}

/**
 * Las filas de una planilla que no son un elemento medido.
 *
 * `SOBRE` entra porque los niveles se escriben como título de bloque ("SOBRE
 * PLANTA BAJA") además de repetirse en la columna de nivel de cada fila.
 */
const NO_ES_ELEMENTO =
  /^(tipo|vigas|losas|columnas|escaleras|tabiques|subtotal|total|sobre |resumen|nivel|atenci|volumen|cotas)/i;

/**
 * Qué forma tiene un elemento pegado.
 *
 * Una fila con una sola medida sólo puede ser un resultado ya calculado, diga
 * lo que diga su nombre. Después manda el nombre: una losa se mide por espesor
 * y área aunque la planilla le haya puesto un 1 en la columna de ancho, que es
 * relleno para que la fórmula tenga tres factores. Ese 1 no significa nada y no
 * se guarda.
 */
function formaDe(tipo: string, a: number | null, b: number | null, c: number | null): Forma {
  const medidas = [a, b, c].filter((m) => m !== null).length;
  if (medidas <= 1) return "directo";
  if (/losa|pa[ñn]o/i.test(tipo)) return "superficie";
  if (medidas >= 3) return "prisma";
  return a === null ? "superficie" : "prisma";
}

/** El estado, de como lo escriba la planilla: "ALTURA ESTIMADA", "PENDIENTE". */
function estadoDe(texto: string): EstadoMedida {
  if (/pendiente/i.test(texto)) return "pendiente";
  if (/hip[oó]tesis|provisor|provisional/i.test(texto)) return "hipotesis";
  if (/estimad/i.test(texto)) return "estimado";
  return "firme";
}

/**
 * Un número de una celda de Excel.
 *
 * Acepta la coma decimal y el punto de miles, que es como los escribe una
 * planilla en español, y devuelve `null` para lo que no sea un número: una
 * celda vacía o un "a verificar" no son un cero.
 */
export function numeroDe(celda: string | undefined): number | null {
  const limpio = (celda ?? "").trim();
  if (!limpio) return null;

  // "1.234,56" es mil doscientos treinta y cuatro; "1.234" sin coma, también.
  const normal = limpio.includes(",")
    ? limpio.split(".").join("").split(",").join(".")
    : limpio;

  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}
