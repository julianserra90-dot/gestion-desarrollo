import Link from "next/link";

/**
 * Las dos solapas de Editar obra.
 *
 * "Datos obra" es lo que define el proyecto —domicilio, superficies, socias—; y
 * "Datos lote", el terreno como inmueble: cuánto salió y cómo se lo identifica.
 * Son dos fichas distintas de la misma obra, y mezclarlas hacía un formulario
 * larguísimo donde lo catastral se perdía entre las fechas de obra.
 *
 * Se ven como el segundo nivel de las solapas de obra, para que se lea que
 * cuelgan de "Editar obra" y no que son secciones nuevas.
 */
export default function EditarNav({
  slug,
  activa,
}: {
  slug: string;
  activa: "obra" | "lote";
}) {
  return (
    <nav style={contenedor}>
      <Link
        href={`/obras/${slug}/editar`}
        style={activa === "obra" ? itemActivo : item}
      >
        Datos obra
      </Link>
      <Link
        href={`/obras/${slug}/editar/lote`}
        style={activa === "lote" ? itemActivo : item}
      >
        Datos lote
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
