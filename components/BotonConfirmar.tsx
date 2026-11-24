"use client";

import { useRef } from "react";
import { useConfirmacion } from "@/components/Confirmacion";

/**
 * Un botón de envío que pregunta antes de mandar el formulario.
 *
 * Es el primer confirm de la app: hasta acá ningún borrado preguntaba. Pero
 * el de un estudio quedó en la ficha, a un clic de mirar y editar, y un clic
 * de más no puede tirar un estudio entero que la Ciudad tardó en contestar.
 *
 * La pregunta es la de `useConfirmacion` y no la del sistema. Como la
 * respuesta llega después, el clic no puede frenarse y seguir: se frena
 * siempre, y recién con el sí se manda el formulario a mano, nombrando este
 * botón para que valga su `formAction`.
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
  const { preguntar, dialogo } = useConfirmacion();
  const boton = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={boton}
        type="submit"
        formAction={formAction}
        formNoValidate={formAction !== undefined}
        style={style}
        onClick={(e) => {
          e.preventDefault();
          void preguntar(mensaje, "Sí, dale").then((si) => {
            if (si) boton.current?.form?.requestSubmit(boton.current);
          });
        }}
      >
        {children}
      </button>
      {dialogo}
    </>
  );
}
