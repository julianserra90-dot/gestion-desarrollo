/**
 * Los cuatro roles de un usuario, con el emoji que lo distingue en pantalla.
 *
 * El emoji sale del rol y no se elige: dos inversores se ven iguales a
 * propósito, porque lo que hay que reconocer de un vistazo es de qué lado está
 * cada uno, no quién es. Son objetos y no caras —la llave, la grúa, la plata,
 * la casa— para que no le compitan a los íconos de trazo del resto de la app.
 */

export const ROLES = ["admin", "desarrollador", "inversor", "comprador"] as const;

export type Rol = (typeof ROLES)[number];

export const ROL: Record<
  Rol,
  { nombre: string; emoji: string; alcance: string }
> = {
  admin: {
    nombre: "Administrador",
    emoji: "🔑",
    alcance:
      "Ve y edita todas las obras, y es el único que toca los usuarios: el rol, la empresa y el nombre.",
  },
  desarrollador: {
    nombre: "Desarrollador",
    emoji: "🏗️",
    alcance:
      "Ve todo de las obras donde su empresa es socia, y los gastos que carga quedan a nombre de ella. No entra a Usuarios.",
  },
  inversor: {
    nombre: "Inversor",
    emoji: "💰",
    alcance:
      "Va a ver lo que puso y el avance de la obra, no la economía entera. Todavía no tiene pantallas: por ahora entra y no ve ninguna obra.",
  },
  comprador: {
    nombre: "Comprador",
    emoji: "🏠",
    alcance:
      "Va a ver lo que lleva pagado y el avance de la obra. Todavía no tiene pantallas: por ahora entra y no ve ninguna obra.",
  },
};

/** El único rol que pertenece a una empresa; los demás no son de ninguna. */
export const ROL_CON_EMPRESA: Rol = "desarrollador";

/**
 * El rol tal como viene de la base, que es `text`. Si alguna vez queda uno que
 * el código no conoce, mejor null que inventarle un nombre.
 */
export function leerRol(valor: string | null | undefined): Rol | null {
  return (ROLES as readonly string[]).includes(valor ?? "")
    ? (valor as Rol)
    : null;
}
