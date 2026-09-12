"use client";

import Link from "next/link";
import ItemsDeMaterial, {
  type ItemCargado,
  type MaterialOpcion,
} from "@/components/ItemsDeMaterial";
import * as ui from "@/components/ui";

/**
 * Un retiro del acopio: qué material entró a la obra y cuándo.
 *
 * Es el mismo detalle de materiales que el de un gasto, con una fecha. El
 * precio de cada item es opcional: si el acopio tiene ese material con precio,
 * la ficha lo toma de ahí; acá se carga sólo si se quiere dejar otro.
 */
export default function RetiroForm({
  action,
  slug,
  gastoId,
  rubroNombre,
  materiales,
  retiro,
  itemsIniciales = [],
  error,
  textoBoton = "Guardar retiro",
}: {
  action: (formData: FormData) => void;
  slug: string;
  gastoId: string;
  /** El rubro del acopio, por nombre: su acordeón arranca abierto. */
  rubroNombre: string;
  materiales: MaterialOpcion[];
  retiro?: { id: string; fecha: string; observaciones: string | null };
  itemsIniciales?: ItemCargado[];
  error?: string;
  textoBoton?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="gasto_id" value={gastoId} />
      {retiro && <input type="hidden" name="retiro_id" value={retiro.id} />}

      {error && <p style={errorBox}>{error}</p>}

      <div style={ui.panel}>
        <div style={grid}>
          <label style={field}>
            <span style={labelCampo}>Fecha del retiro</span>
            <input
              type="date"
              name="fecha"
              defaultValue={retiro?.fecha ?? ""}
              required
              style={ui.input}
            />
          </label>

          <div style={fieldAncho}>
            <span style={labelCampo}>Materiales que entraron a la obra</span>
            <ItemsDeMaterial
              materiales={materiales}
              rubroNombre={rubroNombre}
              iniciales={itemsIniciales}
            />
          </div>

          <label style={fieldAncho}>
            <span style={labelCampo}>Observaciones</span>
            <textarea
              name="observaciones"
              defaultValue={retiro?.observaciones ?? ""}
              placeholder="Opcional"
              style={textarea}
            />
          </label>
        </div>
      </div>

      <div style={acciones}>
        <Link href={`/obras/${slug}/gastos/${gastoId}`} style={ui.secondaryButton}>
          Cancelar
        </Link>
        <button type="submit" style={ui.button}>
          {textoBoton}
        </button>
      </div>
    </form>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
  alignContent: "start" as const,
};

const fieldAncho = {
  ...field,
  gridColumn: "1 / -1",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const textarea = {
  ...ui.input,
  minHeight: "80px",
  resize: "vertical" as const,
};

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
