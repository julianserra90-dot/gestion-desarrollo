import Link from "next/link";

/**
 * Las dos solapas de Presupuestos.
 *
 * **Cotizaciones** es lo que ya estaba: qué cotizó cada gremio y cuál se
 * aprobó. **Cómputo** es lo de antes de cotizar: cuánto lleva la obra de cada
 * cosa y cuánto debería salir. Van juntas porque se leen una contra la otra.
 *
 * Mismo segundo nivel que Materiales y Editar obra.
 */
export default function PresupuestosNav({
  slug,
  activa,
}: {
  slug: string;
  activa: "cotizaciones" | "computo";
}) {
  return (
    <nav style={contenedor}>
      <Link
        href={`/obras/${slug}/presupuestos`}
        style={activa === "cotizaciones" ? itemActivo : item}
      >
        Cotizaciones
      </Link>
      <Link
        href={`/obras/${slug}/presupuestos/computo`}
        style={activa === "computo" ? itemActivo : item}
      >
        Cómputo
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
