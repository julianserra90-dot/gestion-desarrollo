import Link from "next/link";

/**
 * La etiqueta del comprobante de un gasto: gris para efectivo, celeste pastel
 * para factura. El color dice de un vistazo qué está facturado y qué no, sin
 * el peso de los recuadros negros que había antes.
 *
 * Si el gasto tiene el archivo cargado, la etiqueta entera es el enlace al
 * visor —tocar "Factura A" es abrir la factura, y desde ahí se descarga—. No
 * hay "Ver" aparte: era una columna más para decir lo mismo. Sin archivo es
 * texto y listo, y el subrayado sólo aparece cuando hay adónde ir.
 */
export default function EtiquetaComprobante({
  tipoFactura,
  driveId,
  volver,
}: {
  tipoFactura: string | null;
  driveId: string | null;
  /** Adónde vuelve el visor al cerrar: la pantalla desde la que se abrió. */
  volver: string;
}) {
  const texto = tipoFactura ? `Factura ${tipoFactura}` : "Efectivo";
  const estilo = tipoFactura ? tagFactura : tagEfectivo;

  if (!driveId) {
    return <span style={estilo}>{texto}</span>;
  }

  return (
    <Link
      href={`/ver/${driveId}?volver=${encodeURIComponent(volver)}`}
      style={{ ...estilo, textDecoration: "underline" }}
    >
      {texto}
    </Link>
  );
}

const base = {
  display: "inline-block",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tagEfectivo = {
  ...base,
  background: "#f2f2f2",
  color: "#555555",
};

// Celeste pastel y no verde ni rojo: esos ya significan plata a favor o en
// contra en toda la app.
const tagFactura = {
  ...base,
  background: "#e8f1fb",
  color: "#1e5a96",
};
