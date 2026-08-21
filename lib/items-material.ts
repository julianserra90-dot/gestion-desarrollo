/**
 * Los items de materiales de un formulario: qué se compró —o qué se cotizó—,
 * cuánto y a cuánto.
 *
 * Lo comparten el gasto y el presupuesto porque cargan la misma lista con el
 * mismo componente: el presupuesto del corralón y su factura son el mismo
 * papel en dos momentos. Es puro (no toca la base), así que sirve en los dos
 * server actions sin arrastrarse nada.
 *
 * Viajan como tres listas paralelas —`item_material`, `item_cantidad`,
 * `item_precio`— que se cruzan por posición: es como el navegador manda un
 * campo repetido, y evita inventar un formato propio adentro de un input.
 */

export type ItemMaterial = {
  material_id: string;
  cantidad: number;
  precio_unitario: number | null;
  orden: number;
};

/**
 * El precio es opcional (a veces el papel no lo discrimina) pero el material y
 * la cantidad no: una fila a medio llenar se descarta en vez de rechazar el
 * gasto entero por eso.
 */
export function leerItems(formData: FormData): ItemMaterial[] {
  const materiales = formData.getAll("item_material").map(String);
  const cantidades = formData.getAll("item_cantidad").map(String);
  const precios = formData.getAll("item_precio").map(String);

  return materiales
    .map((material_id, i) => ({
      material_id,
      cantidad: Number(cantidades[i] ?? 0),
      precio_unitario:
        (precios[i] ?? "").trim() === "" ? null : Number(precios[i]),
      orden: i,
    }))
    .filter(
      (item) =>
        item.material_id !== "" &&
        Number.isFinite(item.cantidad) &&
        item.cantidad > 0
    );
}

/**
 * El total de lo cotizado, sumando cada renglón.
 *
 * Sirve para el presupuesto, donde el monto **sí** puede salir del detalle: el
 * total del corralón es la suma de sus renglones. En el gasto no se usa, porque
 * ahí el monto es el de la factura, que trae IVA, flete o descuentos que no son
 * items.
 *
 * Un renglón sin precio suma cero: la cantidad se cargó, el precio todavía no.
 */
export function sumaDeItems(items: ItemMaterial[]) {
  const total = items.reduce(
    (acc, i) => acc + i.cantidad * (i.precio_unitario ?? 0),
    0
  );

  // Cantidad va a tres decimales y precio a dos: el producto puede caer abajo
  // del centavo, y el monto se guarda al centavo.
  return Math.round(total * 100) / 100;
}
