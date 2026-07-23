/**
 * Botón de descarga de un archivo alojado en Drive.
 *
 * Apunta siempre a /archivos/<id>?descargar=1, que verifica los permisos sobre
 * la obra antes de servir el archivo. Por eso cualquier usuario habilitado
 * puede bajar lo que subió otro, sin necesidad de entrar al Drive.
 */
export default function BotonDescarga({
  fileId,
  etiqueta,
  variante = "texto",
  titulo,
}: {
  fileId: string;
  /** Texto visible. Con variante "icono" se usa sólo como accesibilidad. */
  etiqueta?: string;
  variante?: "texto" | "icono";
  titulo?: string;
}) {
  const texto = etiqueta ?? "Descargar";

  return (
    <a
      href={`/archivos/${fileId}?descargar=1`}
      // download le pide al navegador guardar en vez de abrir; el nombre real
      // lo define el header Content-Disposition que manda el servidor.
      download
      title={titulo ?? texto}
      aria-label={texto}
      style={variante === "icono" ? estiloIcono : estiloTexto}
    >
      <IconoDescarga />
      {variante === "texto" && <span>{texto}</span>}
    </a>
  );
}

function IconoDescarga() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

const estiloTexto = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  color: "#111111",
  textDecoration: "none",
  border: "1px solid #dcdcdc",
  padding: "6px 10px",
  fontSize: "13px",
  background: "#ffffff",
  whiteSpace: "nowrap" as const,
};

const estiloIcono = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "30px",
  height: "30px",
  color: "#111111",
  background: "rgba(255, 255, 255, 0.92)",
  border: "1px solid #dcdcdc",
  textDecoration: "none",
};
