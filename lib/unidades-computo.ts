/**
 * Las unidades de medida del cómputo: una sola lista para las tareas, sus
 * subtareas y las tareas propias.
 *
 * Aparte de `lib/unidades.ts`, que es la de cómo se compra un material
 * (pallet, chapa, caja). Acá van las que se computan en obra: metro lineal (no
 * "m" suelto), "un" para unidad, "gl" para global y los envases en que viene
 * el material. No hay tiempo (días, meses): un alquiler se computa por unidad
 * o global. Las que se repiten con la de materiales se escriben igual.
 */
export const UNIDADES_COMPUTO = [
  { valor: "ml", nombre: "ml — metro lineal" },
  { valor: "m²", nombre: "m² — metro cuadrado" },
  { valor: "m³", nombre: "m³ — metro cúbico" },
  { valor: "un", nombre: "un — unidad" },
  { valor: "gl", nombre: "gl — global" },
  { valor: "kg", nombre: "kg — kilo" },
  { valor: "tn", nombre: "tn — tonelada" },
  { valor: "litro", nombre: "litro/s" },
  { valor: "bolsa", nombre: "bolsa/s" },
  { valor: "paquete", nombre: "paquete/s" },
  { valor: "rollo", nombre: "rollo/s" },
  { valor: "jgo", nombre: "jgo — juego" },
];

