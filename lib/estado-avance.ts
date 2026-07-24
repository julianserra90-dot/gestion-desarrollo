/**
 * El estado de un rubro sale de su avance acumulado, no de un campo aparte.
 *
 * Guardarlo por separado permitía que dijera "Sin iniciar" con 40% cargado, o
 * que quedara en "En ejecución" para siempre porque nadie se acordó de
 * cerrarlo. Si ya tiene avance, está en ejecución: eso es una lectura del
 * número, no un dato que alguien tenga que mantener.
 */

export function estadoDe(acumulado: number): string {
  if (acumulado <= 0) return "Sin iniciar";
  if (acumulado >= 100) return "Finalizado";
  return "En ejecución";
}
