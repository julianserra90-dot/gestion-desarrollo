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
 * La versión que sigue a la dada: V02 → V03. Si no tiene forma reconocible se
 * devuelve vacío y la escribe el usuario.
 */
export function proximaVersion(version: string | null): string {
  const match = version?.match(/^([A-Za-z]*)(\d+)$/);
  if (!match) return "";

  const [, prefijo, numero] = match;
  const siguiente = String(Number(numero) + 1).padStart(numero.length, "0");

  return `${prefijo}${siguiente}`;
}
