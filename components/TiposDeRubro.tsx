"use client";

import { useRef } from "react";

/**
 * Las dos casillas que dicen qué se cotiza en un rubro.
 *
 * Guardan al tocarlas, sin botón: es un interruptor, no un formulario. Y no se
 * puede dejar el rubro sin ninguna de las dos, así que la última marcada queda
 * deshabilitada en vez de rechazar el guardado después.
 */
export default function TiposDeRubro({
  rubroId,
  slug,
  usaMateriales,
  usaManoObra,
  accion,
}: {
  rubroId: string;
  slug: string;
  usaMateriales: boolean;
  usaManoObra: boolean;
  accion: (rubroId: string, formData: FormData) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const soloUna = usaMateriales !== usaManoObra;

  return (
    <form ref={form} action={accion.bind(null, rubroId)} style={fila}>
      <input type="hidden" name="slug" value={slug} />

      {/* Una casilla deshabilitada no viaja en el formulario, así que la que
          está trabada manda su valor por un campo oculto. Sin esto, marcar la
          otra desmarcaría ésta sola. */}
      {soloUna && usaMateriales && (
        <input type="hidden" name="usa_materiales" value="on" />
      )}
      {soloUna && usaManoObra && (
        <input type="hidden" name="usa_mano_obra" value="on" />
      )}

      <label
        style={usaMateriales ? etiquetaActiva : etiqueta}
        title={
          soloUna && usaMateriales
            ? "Un rubro tiene que llevar al menos una de las dos"
            : "Acá se compran materiales"
        }
      >
        <input
          type="checkbox"
          name="usa_materiales"
          defaultChecked={usaMateriales}
          disabled={soloUna && usaMateriales}
          onChange={() => form.current?.requestSubmit()}
        />
        Materiales
      </label>

      <label
        style={usaManoObra ? etiquetaActiva : etiqueta}
        title={
          soloUna && usaManoObra
            ? "Un rubro tiene que llevar al menos una de las dos"
            : "Acá se contrata mano de obra"
        }
      >
        <input
          type="checkbox"
          name="usa_mano_obra"
          defaultChecked={usaManoObra}
          disabled={soloUna && usaManoObra}
          onChange={() => form.current?.requestSubmit()}
        />
        Mano de obra
      </label>
    </form>
  );
}

const fila = {
  display: "flex",
  gap: "16px",
  alignItems: "center",
};

const etiqueta = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  color: "#999999",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const etiquetaActiva = {
  ...etiqueta,
  color: "#111111",
};
