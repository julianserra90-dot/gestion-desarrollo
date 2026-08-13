/**
 * Estilos compartidos por las pantallas.
 *
 * Antes cada página repetía estos mismos objetos al final del archivo, lo que
 * hacía que un cambio de diseño hubiera que aplicarlo en siete lugares.
 */

export const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

export const pageTitle = {
  fontSize: "36px",
  fontWeight: 400,
  margin: "8px 0",
};

export const subtitle = {
  color: "#666666",
  margin: 0,
};

export const sectionHeader = {
  marginBottom: "28px",
};

export const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "16px",
};

export const statCard = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  background: "#ffffff",
};

export const label = {
  fontSize: "13px",
  color: "#777777",
  margin: 0,
};

export const statNumber = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "12px 0 0",
};

export const panel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
};

export const panelConMargen = {
  ...panel,
  marginTop: "32px",
};

export const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
  marginTop: 0,
};

export const text = {
  color: "#555555",
};

export const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
};

export const row = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
  marginTop: "12px",
};

export const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

export const th = {
  textAlign: "left" as const,
  fontSize: "12px",
  color: "#777777",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  borderBottom: "1px solid #e5e5e5",
  padding: "12px",
};

export const thRight = {
  ...th,
  textAlign: "right" as const,
};

export const td = {
  borderBottom: "1px solid #eeeeee",
  padding: "14px 12px",
  color: "#333333",
};

export const tdRight = {
  ...td,
  textAlign: "right" as const,
};

export const toolbar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginTop: "32px",
  marginBottom: "20px",
};

export const button = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
};

export const secondaryButton = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
};

export const input = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  background: "#ffffff",
  padding: "12px",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111111",
};

export const vacio = {
  color: "#777777",
  fontSize: "15px",
  margin: 0,
};

/**
 * Lo que se pagó antes de que arrancara la obra: acopios de material,
 * anticipos, señas. No cae en ninguna semana, y en vez de dejar el lugar en
 * blanco —que se lee como un dato que falta— se marca por lo que es.
 *
 * Ámbar porque los otros colores ya significan algo: gris y celeste son el
 * comprobante, y el verde y el rojo, plata a favor o en contra.
 */
export const tagPrevio = {
  display: "inline-block",
  background: "#fdf0dd",
  color: "#8a5a12",
  padding: "2px 6px",
  fontSize: "11px",
  whiteSpace: "nowrap" as const,
};

export const progressBackground = {
  height: "8px",
  background: "#eeeeee",
};

export const progressFill = {
  height: "8px",
  background: "#111111",
};
