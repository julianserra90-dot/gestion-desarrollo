import Link from "next/link";
import type { ReactNode } from "react";

/**
 * El "volver" de las pantallas de detalle, siempre arriba del título.
 *
 * A estas pantallas se entra desde otra —un mes del flujo, un rubro, un
 * proveedor— y no están en las solapas, así que salir dependía del botón del
 * navegador. Cada una lo resolvía a su manera: un botón a mitad de página, una
 * nota al pie, o nada. Estando siempre en el mismo lugar no hay que buscarlo.
 *
 * Dice **adónde** vuelve, no "volver" a secas: el nombre de la pantalla de
 * origen es lo que confirma que uno no se va a ir a cualquier lado.
 */
export default function Volver({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} style={enlace}>
      ← {children}
    </Link>
  );
}

const enlace = {
  display: "inline-block",
  color: "#555555",
  fontSize: "14px",
  textDecoration: "none",
  marginBottom: "12px",
};
