/**
 * Los tipos de muro de una obra: cada uno, una pila de capas.
 *
 * "Muro exterior 30" es revoque exterior 2 cm, ladrillo hueco 18, revoque
 * interior 1,5 y látex: lo que se construye, en el orden en que se construye.
 * El **núcleo** es la mampostería —lo que se dibuja como muro y lo que el
 * hormigón reemplaza—; a cada lado, sus capas desde el núcleo hacia afuera.
 *
 * Cada capa tiene su tarea del cómputo, su espesor y **entre qué alturas va**:
 * el porcelanato de un baño de 0 a 2,10 y el látex de 2,10 al techo, sin que
 * uno se cuente encima del otro.
 *
 * El lado **exterior** es el de la "cara exterior" del muro (su referencia), y
 * el interior el otro: el mismo criterio con que se marca la línea.
 *
 * Sin React y sin base: lo usan el editor, el servidor al guardar y las
 * cuentas.
 */

export type CapaDeMuro = {
  /** Tarea del catálogo, por id. Null: todavía no se eligió. */
  tarea: string | null;
  /** En metros. Cero en una pintura: tiene superficie y no espesor. */
  espesor: number;
  /** Desde qué altura sube, en metros sobre el piso. */
  desde: number;
  /** Hasta dónde: la losa, el cielorraso del ambiente o una altura. */
  hasta: "techo" | "cielorraso" | number;
};

export type Composicion = {
  nucleo: { tarea: string | null; espesor: number };
  /** Del núcleo hacia afuera. */
  exterior: CapaDeMuro[];
  interior: CapaDeMuro[];
};

export type TipoMuro = { id: string; nombre: string } & Composicion;

export const LADOS = ["exterior", "interior"] as const;
export type Lado = (typeof LADOS)[number];

export const CAPA_NUEVA: CapaDeMuro = { tarea: null, espesor: 0.015, desde: 0, hasta: "techo" };

/**
 * Un espesor de muro como se lo da en obra: al medio centímetro —12, 15,
 * 16,5—. Lo que se escribe se lleva ahí.
 */
export function aMedioCentimetro(metros: number): number {
  return Math.round(metros * 200) / 200;
}

/** Sin el polvo de sumar decimales: 0,02 + 0,12 + 0,02 da 0,16 y no 0,15999…. */
function limpio(metros: number): number {
  return Math.round(metros * 10000) / 10000;
}

/** El espesor del muro: el núcleo y todas sus capas. */
export function espesorTotal(c: Composicion): number {
  const suma = (capas: CapaDeMuro[]) => capas.reduce((t, k) => t + k.espesor, 0);
  return limpio(c.nucleo.espesor + suma(c.exterior) + suma(c.interior));
}

/**
 * Lo que un muro toma de su tipo: el espesor total, la mampostería del núcleo
 * y cuánto crece de cada lado. Son datos del muro que se mantienen al día con
 * el tipo, para que todo lo que dibuja y mide un muro siga leyendo el muro.
 */
export function medidasDelMuro(c: Composicion): {
  espesor: number;
  tarea: string | null;
  revestimiento: { exterior: number; interior: number };
} {
  const suma = (capas: CapaDeMuro[]) => capas.reduce((t, k) => t + k.espesor, 0);
  return {
    espesor: espesorTotal(c),
    tarea: c.nucleo.tarea,
    revestimiento: { exterior: limpio(suma(c.exterior)), interior: limpio(suma(c.interior)) },
  };
}

/**
 * Los muros con lo de su tipo al día: espesor, mampostería y revestimiento.
 * Un muro guardado antes de que su tipo cambiara —o antes de que existiera el
 * revestimiento— se lee como su tipo dice. Los que no tienen tipo, o cuyo tipo
 * ya no está, quedan como están.
 */
export function conSusTipos<
  M extends { tipo: string | null; espesor: number; tarea: string | null; revestimiento: { exterior: number; interior: number } },
>(muros: M[], tipos: Map<string, Composicion>): M[] {
  return muros.map((m) => {
    const tipo = m.tipo ? tipos.get(m.tipo) : undefined;
    return tipo ? { ...m, ...medidasDelMuro(tipo) } : m;
  });
}

/** Lo que un muro sin tipo tiene de revestimiento: nada. */
export const SIN_REVESTIMIENTO = { exterior: 0, interior: 0 };

/**
 * El lado de un tipo que da a una cara del muro.
 *
 * La "cara exterior" es la línea marcada de un muro con esa referencia, y el
 * cuerpo crece hacia el +normal: lo de afuera queda del lado −1. El canto —la
 * punta del muro— lleva lo del interior, que es lo que se revoca en una
 * mocheta.
 */
export function ladoDeCara(lado: 1 | -1, punta: "a" | "b" | null): Lado {
  if (punta !== null) return "interior";
  return lado === -1 ? "exterior" : "interior";
}

const numero = (v: unknown): number | null => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) ? n : null;
};

function leerCapa(v: unknown): CapaDeMuro | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  const espesor = numero(r.espesor);
  const desde = numero(r.desde);
  const hasta =
    r.hasta === "techo" || r.hasta === "cielorraso"
      ? r.hasta
      : numero(r.hasta) !== null && (numero(r.hasta) as number) > 0
        ? (numero(r.hasta) as number)
        : "techo";
  return {
    tarea: typeof r.tarea === "string" && r.tarea !== "" ? r.tarea : null,
    espesor: espesor !== null && espesor >= 0 && espesor < 2 ? espesor : 0,
    desde: desde !== null && desde >= 0 && desde < 100 ? desde : 0,
    hasta,
  };
}

/**
 * La composición guardada, tolerante: lo que no se entiende se descarta, y un
 * núcleo sin espesor vuelve a 12 cm, que es el de casi todo.
 */
export function leerComposicion(valor: unknown): Composicion {
  const r = (typeof valor === "object" && valor !== null ? valor : {}) as Record<string, unknown>;
  const n = (typeof r.nucleo === "object" && r.nucleo !== null ? r.nucleo : {}) as Record<
    string,
    unknown
  >;
  const espesor = numero(n.espesor);
  const capas = (v: unknown) =>
    (Array.isArray(v) ? v : []).map(leerCapa).filter((c): c is CapaDeMuro => c !== null);
  return {
    nucleo: {
      tarea: typeof n.tarea === "string" && n.tarea !== "" ? n.tarea : null,
      espesor: espesor !== null && espesor > 0 && espesor < 2 ? espesor : 0.12,
    },
    exterior: capas(r.exterior),
    interior: capas(r.interior),
  };
}

/** Un nombre que no está: "Muro 2", "Muro 3". */
export function nombreLibre(base: string, usados: string[]): string {
  const ya = new Set(usados.map((u) => u.trim().toLowerCase()));
  if (!ya.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const nombre = `${base} ${i}`;
    if (!ya.has(nombre.toLowerCase())) return nombre;
  }
}
