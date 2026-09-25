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
  formAction,
}: {
  mensaje: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  /**
   * Otra acción que la del formulario, para un botón que vive adentro de uno
   * ajeno (descartar un borrador desde su formulario). Con ella no se valida
   * el formulario: para tirarlo no hace falta que esté completo.
   */
  formAction?: (formData: FormData) => void;
}) {
  return (
    <button
      type="submit"
      formAction={formAction}
      formNoValidate={formAction !== undefined}
      style={style}
      onClick={(e) => {
        if (!window.confirm(mensaje)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
