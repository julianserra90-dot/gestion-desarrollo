/**
 * Cuánto hay que comprar de un material: de "27 litros" a "1 balde de 20
 * litros + 1 lata de 4 litros + 3 latas de 1 litro".
 *
 * El cómputo dice cuánto **se necesita**; el corralón vende en presentaciones.
 * Esa traducción vive acá, sin base y sin React: la usan el listado de
 * materiales y su Excel, y se prueba sola.
 *
 * Todo se compara en la **unidad base** del material: la de lo que trae su
 * envase si declara uno (el cemento, en kg), y si no la suya (el látex, en
 * litros). Una presentación medida en la unidad del envase —"bolsa de 50 kg"
 * para un material que se compra por bolsa de 25— se pasa a la base con lo
 * que trae el envase.
 */

import { mismaUnidad } from "@/lib/consumo";

export type Presentacion = {
  /** Lata, balde, bolsa. */
  nombre: string;
  /** Cuánto trae, en `unidad`. */
  contenido: number;
  unidad: string;
};

export type MaterialConPresentaciones = {
  /** En qué se compra y se cotiza en el desglose: bolsa, litro. */
  unidad: string;
  /** Lo que trae su envase: 25 kg. Null si no declara. */
  contenido: number | null;
  contenidoUnidad: string | null;
  presentaciones: Presentacion[];
};

/** Una presentación pasada a la unidad base. */
type Tamano = { presentacion: Presentacion; enBase: number };

export type Compra = {
  partes: { presentacion: Presentacion; cantidad: number }[];
  /** Lo que se compra en total, en la unidad base. */
  total: number;
};

const EPS = 1e-9;

/** En qué se compara: lo que trae el envase, o la unidad del material. */
export function unidadBase(m: MaterialConPresentaciones): string {
  return m.contenido && m.contenido > 0 && m.contenidoUnidad ? m.contenidoUnidad : m.unidad;
}

/**
 * Una cantidad en la unidad base, o null si su unidad no es ninguna de las
 * del material: 0,2 bolsas de 25 kg son 5 kg.
 */
export function aBase(
  cantidad: number,
  unidad: string,
  m: MaterialConPresentaciones
): number | null {
  const base = unidadBase(m);
  if (mismaUnidad(unidad, base)) return cantidad;
  if (mismaUnidad(unidad, m.unidad) && m.contenido && m.contenido > 0) {
    return cantidad * m.contenido;
  }
  return null;
}

/**
 * Lo que se compra de a uno: no hay media barra ni medio ladrillo. Sin
 * presentaciones ni envase, de estas se compra la cantidad entera de arriba.
 */
const DE_A_UNO = ["un", "bolsa", "pallet", "barra", "chapa", "rollo", "caja"];

/**
 * Las presentaciones que se pueden comparar, de la más grande a la más chica.
 *
 * Sin ninguna cargada vale el envase del material —"bolsa" de 25 kg—, que es
 * lo que se compraba hasta que existieron las presentaciones. Sin envase, lo
 * que se compra de a uno va por la unidad entera (15,5 ladrillos son 16), y lo
 * demás —kg, m³ a granel— no tiene forma comercial que decir.
 */
export function tamanosDe(m: MaterialConPresentaciones): Tamano[] {
  const declaradas = m.presentaciones.length
    ? m.presentaciones
    : m.contenido && m.contenido > 0 && m.contenidoUnidad
      ? [
          {
            // "3 un de 25 kg" no se entiende: un envase sin nombre es un envase.
            nombre: mismaUnidad(m.unidad, "un") ? "envase" : m.unidad,
            contenido: m.contenido,
            unidad: m.contenidoUnidad,
          },
        ]
      : DE_A_UNO.some((u) => mismaUnidad(u, m.unidad))
        ? [{ nombre: m.unidad, contenido: 1, unidad: m.unidad }]
        : [];

  return declaradas
    .map((p) => ({ presentacion: p, enBase: aBase(p.contenido, p.unidad, m) }))
    .filter((t): t is Tamano => t.enBase !== null && t.enBase > EPS)
    .sort((a, b) => b.enBase - a.enBase);
}

/**
 * La compra que cubre lo que se necesita **sobrando lo menos posible**, y
 * entre dos que sobran lo mismo, la de menos envases.
 *
 * No es un problema que valga la pena resolver exacto para cualquier tamaño:
 * se prueba, de la presentación más grande a la más chica, llevar de cada una
 * la cantidad que entra, una menos o una más, y la última cubre el resto. Con
 * las cuatro o cinco presentaciones que tiene un producto son unos cientos de
 * combinaciones, y da lo que haría cualquiera en el mostrador: 27 litros son un
 * balde de 20, una lata de 4 y tres de 1.
 */
export function compraMinima(necesario: number, tamanos: Tamano[]): Compra | null {
  if (!(necesario > EPS) || tamanos.length === 0) return null;

  let mejor: { cuantos: number[]; total: number; envases: number } | null = null;

  const probar = (i: number, falta: number, cuantos: number[]) => {
    if (i === tamanos.length - 1) {
      const n = Math.max(0, Math.ceil(falta / tamanos[i].enBase - EPS));
      const todos = [...cuantos, n];
      const total = todos.reduce((t, c, k) => t + c * tamanos[k].enBase, 0);
      const envases = todos.reduce((t, c) => t + c, 0);
      if (
        !mejor ||
        total < mejor.total - EPS ||
        (Math.abs(total - mejor.total) <= EPS && envases < mejor.envases)
      ) {
        mejor = { cuantos: todos, total, envases };
      }
      return;
    }
    const entra = Math.floor(falta / tamanos[i].enBase + EPS);
    for (const n of new Set([entra - 1, entra, entra + 1])) {
      if (n < 0) continue;
      probar(i + 1, falta - n * tamanos[i].enBase, [...cuantos, n]);
    }
  };
  probar(0, necesario, []);

  const elegida = mejor as { cuantos: number[]; total: number } | null;
  if (!elegida) return null;
  return {
    partes: elegida.cuantos
      .map((cantidad, k) => ({ presentacion: tamanos[k].presentacion, cantidad }))
      .filter((p) => p.cantidad > 0),
    total: elegida.total,
  };
}

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/**
 * El plural de una palabra en castellano: lata → latas, balde → baldes,
 * barril → barriles. Las abreviaturas (kg, m², tn) no se tocan.
 */
function plural(palabra: string): string {
  if (!/^[a-záéíóúñ]{3,}$/i.test(palabra)) return palabra;
  return /[aeiouáéíóú]$/i.test(palabra) ? `${palabra}s` : `${palabra}es`;
}

/** "1 lata de 4 litros", "3 latas de 1 litro"; de a uno, "16 un". */
function textoDeParte(p: { presentacion: Presentacion; cantidad: number }): string {
  if (p.presentacion.contenido === 1 && mismaUnidad(p.presentacion.nombre, p.presentacion.unidad)) {
    return `${p.cantidad} ${p.cantidad === 1 ? p.presentacion.unidad : plural(p.presentacion.unidad)}`;
  }
  const [primera, ...resto] = p.presentacion.nombre.trim().toLowerCase().split(" ");
  const nombre = [p.cantidad === 1 ? primera : plural(primera), ...resto].join(" ");
  const unidad = p.presentacion.contenido === 1 ? p.presentacion.unidad : plural(p.presentacion.unidad);
  return `${p.cantidad} ${nombre} de ${numero.format(p.presentacion.contenido)} ${unidad}`;
}

/** La compra en una línea: "1 balde de 20 litros + 2 latas de 4 litros". */
export function textoDeCompra(compra: Compra): string {
  return compra.partes.map(textoDeParte).join(" + ");
}
