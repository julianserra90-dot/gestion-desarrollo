"use client";

import * as ui from "@/components/ui";

/**
 * Qué bloques de cotización lleva un rubro: el que falta se agrega, el que
 * sobra se saca.
 *
 * Antes eran tres casillas siempre a la vista en el encabezado del rubro. Son
 * independientes a propósito —un rubro normalmente lleva dos a la vez—, pero
 * estaban prendidas casi siempre y pesaban más que el nombre del rubro: ahí lo
 * que se mira es qué bloques hay, no qué casillas están tildadas. Ahora el
 * encabezado muestra los bloques y nada más, el desplegable agrega el que
 * falte, y el que está vacío se saca desde su propia fila.
 *
 * Un rubro no puede quedarse sin ninguno, así que el "Quitar" sólo aparece
 * cuando queda más de uno. Y sólo en un bloque sin cotizaciones ni gastos:
 * sacarlo con algo cargado no lo escondería —la pantalla igual muestra lo que
 * existe— y el botón no haría nada visible.
 */

export type CambiarBloque = (rubroId: string, formData: FormData) => void;

export default function AgregarBloque({
  rubroId,
  slug,
  faltantes,
  accion,
}: {
  rubroId: string;
  slug: string;
  /** Los tipos que el rubro todavía no muestra. */
  faltantes: readonly string[];
  accion: CambiarBloque;
}) {
  if (faltantes.length === 0) return null;

  return (
    <form action={accion.bind(null, rubroId)}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="incluir" value="1" />

      {/* Guarda al elegir, sin botón: elegir ya es la acción. La primera
          opción es el rótulo y no se puede volver a ella. */}
      <select
        name="tipo"
        defaultValue=""
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={selector}
        aria-label="Agregar un bloque de cotización"
      >
        <option value="" disabled>
          + Agregar bloque
        </option>
        {faltantes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </form>
  );
}

export function QuitarBloque({
  rubroId,
  slug,
  tipo,
  accion,
}: {
  rubroId: string;
  slug: string;
  tipo: string;
  accion: CambiarBloque;
}) {
  return (
    // Vive adentro del `summary` del acordeón: sin frenar el clic, sacar el
    // bloque lo abriría de paso.
    <form
      action={accion.bind(null, rubroId)}
      style={{ display: "inline" }}
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="incluir" value="" />

      <button
        type="submit"
        style={quitar}
        title={`Sacar ${tipo.toLowerCase()} de este rubro`}
      >
        Quitar
      </button>
    </form>
  );
}

const selector = {
  ...ui.input,
  width: "auto",
  padding: "7px 10px",
  color: "#555555",
  cursor: "pointer",
};

const quitar = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#999999",
  fontSize: "13px",
  textDecoration: "underline",
  cursor: "pointer",
  fontFamily: "Arial, Helvetica, sans-serif",
};
