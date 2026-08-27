"use client";

import { useRef } from "react";

/**
 * Las tres casillas que dicen qué se cotiza en un rubro.
 *
 * Guardan al tocarlas, sin botón: es un interruptor, no un formulario. Y no se
 * puede dejar el rubro sin ninguna de las tres, así que cuando queda una sola
 * marcada esa se deshabilita en vez de rechazar el guardado después.
 */
export default function TiposDeRubro({
  rubroId,
  slug,
  usaMateriales,
  usaManoObra,
  usaCombinado,
  accion,
}: {
  rubroId: string;
  slug: string;
  usaMateriales: boolean;
  usaManoObra: boolean;
  usaCombinado: boolean;
  accion: (rubroId: string, formData: FormData) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const marcadas = [usaMateriales, usaManoObra, usaCombinado].filter(
    Boolean
  ).length;
  const esLaUnica = (valor: boolean) => valor && marcadas === 1;

  return (
    <form ref={form} action={accion.bind(null, rubroId)} style={fila}>
      <input type="hidden" name="slug" value={slug} />

      {/* Una casilla deshabilitada no viaja en el formulario, así que la que
          está trabada manda su valor por un campo oculto. Sin esto, marcar
          otra desmarcaría ésta sola. */}
      {esLaUnica(usaMateriales) && (
        <input type="hidden" name="usa_materiales" value="on" />
      )}
      {esLaUnica(usaManoObra) && (
        <input type="hidden" name="usa_mano_obra" value="on" />
      )}
      {esLaUnica(usaCombinado) && (
        <input type="hidden" name="usa_mano_obra_y_materiales" value="on" />
      )}

      <label
        style={usaMateriales ? etiquetaActiva : etiqueta}
        title={
          esLaUnica(usaMateriales)
            ? "Un rubro tiene que llevar al menos una de las tres"
            : "Acá se compran materiales"
        }
      >
        <input
          type="checkbox"
          name="usa_materiales"
          defaultChecked={usaMateriales}
          disabled={esLaUnica(usaMateriales)}
          onChange={() => form.current?.requestSubmit()}
        />
        Materiales
      </label>

      <label
        style={usaManoObra ? etiquetaActiva : etiqueta}
        title={
          esLaUnica(usaManoObra)
            ? "Un rubro tiene que llevar al menos una de las tres"
            : "Acá se contrata mano de obra"
        }
      >
        <input
          type="checkbox"
          name="usa_mano_obra"
          defaultChecked={usaManoObra}
          disabled={esLaUnica(usaManoObra)}
          onChange={() => form.current?.requestSubmit()}
        />
        Mano de obra
      </label>

      <label
        style={usaCombinado ? etiquetaActiva : etiqueta}
        title={
          esLaUnica(usaCombinado)
            ? "Un rubro tiene que llevar al menos una de las tres"
            : "Acá un mismo contratista cotiza las dos cosas juntas, en un solo papel"
        }
      >
        <input
          type="checkbox"
          name="usa_mano_obra_y_materiales"
          defaultChecked={usaCombinado}
          disabled={esLaUnica(usaCombinado)}
          onChange={() => form.current?.requestSubmit()}
        />
        Mano de obra y materiales
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
