/**
 * La marca de "esto vino del plano": una plantita, chica, al lado del número.
 *
 * Un dato que salió del dibujo de las plantas se corrige en el dibujo, no
 * donde se lo está leyendo. La marca es para eso: para que mirando el cómputo
 * se sepa cuáles cantidades no se tocan ahí.
 *
 * `conAviso` la pone en ámbar: la tarea tiene, además, medición cargada a
 * mano, y puede estar contando lo mismo dos veces.
 */
export default function SignoDelPlano({
  conAviso = false,
  titulo,
}: {
  conAviso?: boolean;
  /** Lo que dice al pasarle el mouse por encima. */
  titulo?: string;
}) {
  const texto =
    titulo ??
    (conAviso
      ? "Tiene medición del plano y también a mano: puede estar contada dos veces"
      : "Viene del plano");

  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      role="img"
      aria-label={texto}
      style={{ ...signo, color: conAviso ? AMBAR : AZUL }}
    >
      <title>{texto}</title>
      {/* El contorno de una planta y dos tabiques adentro. */}
      <path
        d="M2 2.5h12v11H2zM2 8h5M9.5 8H14M8 2.5V6M8 10v3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

export const AZUL = "#1d4ed8";
export const AMBAR = "#b45309";

// En línea con el texto que acompaña: la hoja de estilos de base pone los
// `svg` en bloque, y sola la marca se va a su propio renglón.
const signo = {
  display: "inline-block",
  flex: "none",
  verticalAlign: "-2px",
};
