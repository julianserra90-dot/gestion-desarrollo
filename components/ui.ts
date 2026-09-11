/**
 * Estilos compartidos por las pantallas.
 *
 * Antes cada página repetía estos mismos objetos al final del archivo, lo que
 * hacía que un cambio de diseño hubiera que aplicarlo en siete lugares.
 *
 * Esquinas redondeadas y sombra suave en vez del recuadro plano de antes: las
 * tarjetas se leen como algo que flota sobre la página, no como una celda de
 * planilla. `SOMBRA`/`BORDE`/`RADIO` son los mismos tres valores en todos los
 * bloques, para que se sientan del mismo juego.
 */

export const SOMBRA =
  "0 1px 2px rgba(17, 17, 17, 0.04), 0 12px 28px -14px rgba(17, 17, 17, 0.16)";
export const BORDE = "1px solid rgba(17, 17, 17, 0.06)";
export const RADIO = "18px";

export const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

export const pageTitle = {
  fontSize: "36px",
  fontWeight: 500,
  letterSpacing: "-0.01em",
  margin: "8px 0",
};

export const subtitle = {
  color: "#666666",
  margin: 0,
};

export const sectionHeader = {
  marginBottom: "28px",
};

// Las tarjetas de arriba de cada pantalla; si la ventana no da, bajan de a
// fila en vez de desbordar con scroll horizontal.
export const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "20px",
};

export const statCard = {
  border: BORDE,
  borderRadius: RADIO,
  padding: "26px 28px",
  background: "#ffffff",
  boxShadow: SOMBRA,
};

export const label = {
  fontSize: "12px",
  color: "#8a8a8a",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  fontWeight: 600,
  margin: 0,
};

// Más pesado y con el interletrado ajustado, no más grande: con varias
// tarjetas por fila un monto largo ("$ 54.111.427,50") ya va justo, y
// agrandar el número lo hace saltar de línea o salirse de la tarjeta.
// `overflowWrap` queda como red de seguridad para el monto más largo que
// todavía no apareció.
export const statNumber = {
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  margin: "12px 0 0",
  overflowWrap: "break-word" as const,
};

export const panel = {
  border: BORDE,
  borderRadius: RADIO,
  padding: "26px 28px",
  background: "#ffffff",
  boxShadow: SOMBRA,
};

export const panelConMargen = {
  ...panel,
  marginTop: "32px",
};

export const sectionTitle = {
  fontSize: "17px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
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
  fontSize: "11px",
  color: "#8a8a8a",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  fontWeight: 600,
  borderBottom: "1px solid #eeeeee",
  padding: "12px",
};

export const thRight = {
  ...th,
  textAlign: "right" as const,
};

export const td = {
  borderBottom: "1px solid #f2f2f2",
  padding: "16px 12px",
  color: "#333333",
  fontSize: "14px",
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
  borderRadius: "10px",
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
  borderRadius: "10px",
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
  borderRadius: "10px",
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
  borderRadius: "999px",
  padding: "2px 8px",
  fontSize: "11px",
  whiteSpace: "nowrap" as const,
};

export const progressBackground = {
  height: "8px",
  borderRadius: "999px",
  background: "#eeeeee",
};

export const progressFill = {
  height: "8px",
  borderRadius: "999px",
  background: "#111111",
};

// Los dos colores con los que la app habla de plata: verde lo que está, rojo
// lo que falta. Viven acá desde que el balance y los ingresos los comparten.
export const VERDE = "#15803d";
export const ROJO = "#b91c1c";
