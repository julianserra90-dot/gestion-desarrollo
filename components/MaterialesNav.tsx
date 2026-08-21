import Link from "next/link";

/**
 * Las dos solapas de Materiales.
 *
 * **Resumen** contesta qué entró a la obra —cuántos ladrillos llevamos— y se
 * arma solo con el detalle de cada gasto: no hay nada que cargar ahí.
 * **Catálogo** es lo otro: la lista de materiales que se ofrecen al cargar una
 * compra, común a todas las obras y que se toca una vez.
 *
 * Estaban las dos apiladas en la misma pantalla y el catálogo quedaba abajo de
 * todo el consumo, así que para corregir un nombre había que bajar una pared de
 * acordeones. Son dos preguntas distintas: una se consulta, la otra se edita.
 *
 * Se ven como el segundo nivel de las solapas de obra, igual que en Editar
 * obra, para que se lea que cuelgan de Materiales.
 */
export default function MaterialesNav({
  slug,
  activa,
}: {
  slug: string;
  activa: "resumen" | "catalogo";
}) {
  return (
    <nav style={contenedor}>
      <Link
        href={`/obras/${slug}/materiales`}
        style={activa === "resumen" ? itemActivo : item}
      >
        Resumen
      </Link>
      <Link
        href={`/obras/${slug}/materiales/catalogo`}
        style={activa === "catalogo" ? itemActivo : item}
      >
        Catálogo
      </Link>
    </nav>
  );
}

const contenedor = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "20px",
  marginBottom: "32px",
  paddingBottom: "12px",
  borderBottom: "1px solid #e5e5e5",
};

const item = {
  color: "#777777",
  textDecoration: "none",
  fontSize: "14px",
  paddingBottom: "4px",
  borderBottom: "2px solid transparent",
};

const itemActivo = {
  ...item,
  color: "#111111",
  borderBottom: "2px solid #111111",
};
