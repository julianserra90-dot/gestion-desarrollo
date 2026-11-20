/**
 * El consumo de un renglón del desglose y su traducción a cantidad.
 *
 * Un rendimiento no se enuncia en envases: el revoque proyectable consume
 * **18 kg por m²** y la bolsa viene de 30 kg. Lo que el cómputo necesita para
 * la cuenta son las 0,6 bolsas —el precio unitario es por bolsa—, pero lo que
 * se sabe, se lee en la ficha del producto y se puede verificar es el 18.
 *
 * Por eso el desglose guarda las dos cosas: el consumo tal como se dijo y la
 * cantidad que sale de dividirlo por lo que trae el envase. La cantidad sigue
 * mandando en todos los precios; el consumo la explica y la rehace si mañana
 * la bolsa cambia de tamaño.
 *
 * Esta regla vive sola, sin importar nada, porque la usan el servidor al leer
 * el cómputo y la pantalla del desglose al escribirlo: si cada uno convirtiera
 * a su manera, la fila mostraría un número y la base guardaría otro.
 */

/**
 * El envase que se le puede aplicar a un renglón: en qué unidad se compra y
 * cuánto trae.
 */
export type Envase = {
  /** La unidad del renglón, en la que está su precio unitario (bolsa). */
  unidad: string;
  /** Cuánto trae el envase (30). Null si el material no lo declara. */
  contenido: number | null;
  /** La unidad de lo que trae (kg). Siempre junto con `contenido`. */
  contenidoUnidad: string | null;
};

/**
 * Dos unidades son la misma aunque estén escritas distinto: "Kg" y "kg", "m 2"
 * y "m2". Las unidades son texto libre en toda la app, así que comparar a secas
 * dejaría el envase sin aplicar por una mayúscula.
 */
export function mismaUnidad(a: string | null, b: string | null) {
  if (!a || !b) return false;
  const limpiar = (u: string) => u.trim().toLowerCase().split(" ").join("");
  return limpiar(a) === limpiar(b);
}

/**
 * En qué unidades se puede enunciar el consumo de un renglón: la del envase
 * y, si el material declara lo que trae, también la de su contenido.
 *
 * Una sola opción quiere decir que no hay nada que elegir ni que convertir, y
 * la pantalla muestra el campo de cantidad de siempre.
 */
export function unidadesDeConsumo(envase: Envase): string[] {
  const otra = envase.contenido && envase.contenido > 0 ? envase.contenidoUnidad : null;
  return otra && !mismaUnidad(otra, envase.unidad)
    ? [envase.unidad, otra]
    : [envase.unidad];
}

/**
 * La cantidad —en la unidad del renglón— que sale de un consumo enunciado.
 *
 * Devuelve `null` cuando no hay nada que derivar: sin consumo declarado, o
 * enunciado en una unidad que el envase no sabe convertir (el material perdió
 * su contenido, o alguien le cambió la unidad al renglón). En esos casos vale
 * la cantidad que está guardada, que es la que siempre mandó.
 *
 * No redondea: la cantidad guardada tiene cuatro decimales y este resultado se
 * usa para los precios, donde el redondeo de 2,5714 contra 2,571428… se nota
 * multiplicado por los metros de la obra.
 */
export function cantidadDesdeConsumo(
  consumo: number | null,
  consumoUnidad: string | null,
  envase: Envase | null
): number | null {
  if (!envase || consumo === null || !Number.isFinite(consumo) || consumo <= 0) return null;

  // Enunciado en la unidad en la que se compra: es la cantidad misma, no hay
  // conversión. Pasa cuando el consumo se carga en bolsas por comodidad.
  if (mismaUnidad(consumoUnidad, envase.unidad)) return consumo;

  const trae = envase.contenido;
  if (trae && trae > 0 && mismaUnidad(consumoUnidad, envase.contenidoUnidad)) {
    return consumo / trae;
  }

  return null;
}

/**
 * El consumo que corresponde a una cantidad: la vuelta de la cuenta anterior.
 *
 * La usa la pantalla cuando se cambia la unidad del consumo, para no perder lo
 * que ya estaba escrito: 0,6 bolsas pasan a 18 kg en vez de quedar en 0,6 kg.
 */
export function consumoDesdeCantidad(
  cantidad: number,
  consumoUnidad: string | null,
  envase: Envase | null
): number | null {
  if (!envase || !Number.isFinite(cantidad) || cantidad <= 0) return null;

  if (mismaUnidad(consumoUnidad, envase.unidad)) return cantidad;

  const trae = envase.contenido;
  if (trae && trae > 0 && mismaUnidad(consumoUnidad, envase.contenidoUnidad)) {
    return cantidad * trae;
  }

  return null;
}

/**
 * El envase aplicable a un renglón, o `null` si no hay ninguno.
 *
 * Hace falta que el renglón apunte a un material **y** que su unidad sea la
 * del material: el precio unitario del renglón es por esa unidad, y el
 * contenido que declara el material está medido contra la suya. Si alguien le
 * cambió la unidad al renglón —lo pasó de bolsa a kg— el envase ya no se puede
 * aplicar, y el renglón vuelve a ser uno de cantidad a secas.
 *
 * La usan el servidor al leer el cómputo y la pantalla al escribirlo, para que
 * los dos decidan igual cuándo hay conversión.
 */
export function envaseDelRenglon(
  unidadRenglon: string,
  material: { unidad: string; contenido: number | null; contenidoUnidad: string | null } | null
): Envase | null {
  if (!material || !mismaUnidad(unidadRenglon, material.unidad)) return null;
  return {
    unidad: unidadRenglon,
    contenido: material.contenido,
    contenidoUnidad: material.contenidoUnidad,
  };
}
