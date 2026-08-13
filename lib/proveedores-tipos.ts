/**
 * Las tres categorías del catálogo de proveedores, sin nada de base de datos:
 * las comparten la pantalla que los edita y su server action.
 *
 * Son el mismo `tipo` de la tabla `proveedores`, con el rótulo y la explicación
 * que van en pantalla. El orden es el de la pantalla, y arranca por
 * contratistas porque son los que más se tocan: cambian de obra en obra.
 */

export const TIPOS_DE_PROVEEDOR = [
  {
    tipo: "Contratista",
    titulo: "Contratistas",
    ayuda: "Los que ponen la mano de obra: plomero, electricista, yesero.",
  },
  {
    tipo: "Proveedor",
    titulo: "Proveedores",
    ayuda: "Los que venden materiales: corralones, casas de sanitarios.",
  },
  {
    tipo: "Varios",
    titulo: "Varios",
    ayuda:
      "A quién se le pagan los gastos administrativos: ABL, AFIP, agrimensor.",
  },
] as const;

export type TipoDeProveedor = (typeof TIPOS_DE_PROVEEDOR)[number]["tipo"];
