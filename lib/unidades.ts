/**
 * Las unidades en que se compra un material.
 *
 * Puro, sin base: lo usan el formulario del catálogo (cliente) y las pantallas
 * que muestran el detalle de un gasto.
 *
 * En la base la unidad es texto libre; esta lista es la que se ofrece en
 * pantalla, para que no entren "un", "unid" y "unidad" como tres cosas
 * distintas. Agregar una es agregarla acá, sin tocar el esquema.
 *
 * El orden es el de uso en obra, no alfabético: primero lo que se cuenta de a
 * uno, después lo que se mide.
 */

export const UNIDADES = [
  "un",
  "bolsa",
  "pallet",
  "m",
  "m²",
  "m³",
  "kg",
  "tn",
  "litro",
  "barra",
  "chapa",
  "rollo",
  "global",
] as const;

export type Unidad = (typeof UNIDADES)[number];
