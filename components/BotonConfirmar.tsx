"use client";

/**
 * Un botón de envío que pregunta antes de mandar el formulario.
 *
 * Es el primer confirm de la app: hasta acá ningún borrado preguntaba. Pero
 * el de un estudio quedó en la ficha, a un clic de mirar y editar, y un clic
 * de más no puede tirar un estudio entero que la Ciudad tardó en contestar.
 */
export default function BotonConfirmar({
  mensaje,
  style,
  children,
}: {
  mensaje: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      style={style}
      onClick={(e) => {
        if (!window.confirm(mensaje)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
