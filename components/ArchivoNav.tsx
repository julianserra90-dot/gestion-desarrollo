import Link from "next/link";

/**
 * Las dos solapas de Archivo.
 *
 * "Carpetas" es mirar: todo lo de la obra —documentos, planos, fotos,
 * facturas— ordenado como en un Drive, sólo lo vigente. "Documentos" es
 * administrar: los documentos por ámbito (de obra, de proyecto,
 * administrativa, lote) y por rubro, con su versión y su estado, para subir
 * una nueva versión, editar, o ver las anteriores que quedaron obsoletas.
 *
 * Cuando Archivo reemplazó a Documentos en la barra lateral, esta segunda
 * pantalla quedó sin entrada; vive acá, como el segundo nivel de Archivo.
 */
export default function ArchivoNav({
  slug,
  activa,
}: {
  slug: string;
  activa: "carpetas" | "documentos";
}) {
  return (
    <nav style={contenedor}>
      <Link
        href={`/obras/${slug}/archivo`}
        style={activa === "carpetas" ? itemActivo : item}
      >
        Carpetas
      </Link>
      <Link
        href={`/obras/${slug}/documentos`}
        style={activa === "documentos" ? itemActivo : item}
      >
        Documentos y versiones
      </Link>
    </nav>
  );
}

const contenedor = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "20px",
  marginBottom: "24px",
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
