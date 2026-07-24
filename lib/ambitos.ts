/**
 * Los dos ejes con que se clasifica un documento, sin nada de base de datos:
 * lo usan tanto el servidor como los formularios del cliente.
 *
 * El ámbito dice para qué sirve el papel; el rubro, de qué parte de la obra
 * habla. Lo administrativo no lleva rubro —un seguro no es de albañilería— y
 * en su lugar lleva un título libre.
 */

export const AMBITOS = ["Obra", "Proyecto", "Administrativa"] as const;
export type Ambito = (typeof AMBITOS)[number];

/** Los ámbitos que se archivan por rubro. Administrativa va por título. */
export const AMBITOS_CON_RUBRO: readonly Ambito[] = ["Obra", "Proyecto"];

export function esAmbito(valor: string): valor is Ambito {
  return (AMBITOS as readonly string[]).includes(valor);
}

export function usaRubro(ambito: Ambito): boolean {
  return AMBITOS_CON_RUBRO.includes(ambito);
}

/**
 * Lo que identifica a un documento dentro de una obra: dónde está archivado y
 * con qué nombre. Dos cargas con la misma identidad no son dos documentos, son
 * dos versiones del mismo.
 */
export type LineaDocumento = {
  ambito: Ambito;
  rubroId: string | null;
  titulo: string | null;
  nombre: string;
};

/** Para comparar nombres sin que un espacio o una mayúscula abran una línea nueva. */
export function normalizar(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mismaLinea(a: LineaDocumento, b: LineaDocumento): boolean {
  return (
    a.ambito === b.ambito &&
    a.rubroId === b.rubroId &&
    normalizar(a.titulo ?? "") === normalizar(b.titulo ?? "") &&
    normalizar(a.nombre) === normalizar(b.nombre)
  );
}

/**
 * La versión que le toca a una carga nueva, a partir de las que ya tiene esa
 * línea: la primera es V01 y de ahí en más sigue el número más alto.
 *
 * No tiene nada que ver con la versión que el archivo traiga en su nombre. El
 * DWG puede llamarse "Banquinas - V10" porque así lo numera quien lo dibuja;
 * acá se cuenta cuántas veces ese documento se mandó a la obra.
 */
export function versionSiguiente(existentes: (string | null)[]): string {
  const numeros = existentes
    .map((v) => v?.match(/(\d+)/)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);

  const proxima = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;

  return `V${String(proxima).padStart(2, "0")}`;
}
