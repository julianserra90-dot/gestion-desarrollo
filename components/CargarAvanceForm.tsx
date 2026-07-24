"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import { estadoDe } from "@/lib/estado-avance";

export type AvanceEnEdicion = {
  id: string;
  porcentaje: number;
  fechaDesde: string;
  fechaHasta: string;
  comentario: string | null;
};

export default function CargarAvanceForm({
  action,
  obraId,
  slug,
  rubroId,
  /** Lo que lleva el rubro sin contar esta carga. */
  acumuladoPrevio,
  hoy,
  avance,
  textoBoton,
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  rubroId: string;
  acumuladoPrevio: number;
  hoy: string;
  avance?: AvanceEnEdicion;
  textoBoton?: string;
}) {
  const [porcentaje, setPorcentaje] = useState(
    avance ? String(avance.porcentaje) : ""
  );

  const suma = Number(porcentaje);
  const valido = Number.isFinite(suma) && suma > 0;
  const resultado = acumuladoPrevio + (valido ? suma : 0);

  return (
    <form action={action}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rubro_id" value={rubroId} />
      {avance && <input type="hidden" name="avance_id" value={avance.id} />}

      <div style={ui.panel}>
        <div style={grid}>
          <label style={field}>
            <span style={labelCampo}>Avance del período</span>
            <div style={conSufijo}>
              <input
                type="number"
                name="porcentaje"
                min="1"
                max="100"
                step="1"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                required
                style={{ ...ui.input, width: "100%" }}
              />
              <span style={sufijo}>%</span>
            </div>
            <span style={ayuda}>
              Cuánto se avanzó en estos días, no el total del rubro.
            </span>
          </label>

          <label style={field}>
            <span style={labelCampo}>Desde</span>
            <input
              type="date"
              name="fecha_desde"
              defaultValue={avance?.fechaDesde ?? hoy}
              required
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={labelCampo}>Hasta</span>
            <input
              type="date"
              name="fecha_hasta"
              defaultValue={avance?.fechaHasta ?? hoy}
              required
              style={ui.input}
            />
            <span style={ayuda}>Los días que se trabajó, nada más.</span>
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>Qué se hizo</span>
            <textarea
              name="comentario"
              defaultValue={avance?.comentario ?? ""}
              placeholder="Ej: se demolieron las paredes de planta alta"
              style={textarea}
            />
            <span style={ayuda}>
              Es lo que después se lee en el historial para saber qué pasó esa
              semana.
            </span>
          </label>

          <div style={fieldAncho}>
            <div style={resumen}>
              <span style={labelCampo}>Queda el rubro en</span>
              <strong style={numeroResumen}>{resultado}%</strong>
              <span style={ayuda}>
                {valido
                  ? `De ${acumuladoPrevio}% a ${resultado}% · ${estadoDe(resultado)}`
                  : `Hoy lleva ${acumuladoPrevio}% · ${estadoDe(acumuladoPrevio)}`}
              </span>
              {resultado > 100 && (
                <span style={aviso}>
                  Pasa de 100%. Se guarda igual —a veces el reparto de
                  porcentajes no cierra clavado— pero para el avance general se
                  cuenta como 100%.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={acciones}>
        <Link href={`/obras/${slug}/avances/${rubroId}`} style={ui.secondaryButton}>
          Cancelar
        </Link>

        <button type="submit" style={ui.button}>
          {textoBoton ?? "Cargar avance"}
        </button>
      </div>
    </form>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
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

const conSufijo = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const sufijo = {
  fontSize: "16px",
  color: "#555555",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const ayuda = {
  fontSize: "13px",
  color: "#999999",
};

const aviso = {
  fontSize: "13px",
  color: "#111111",
};

const resumen = {
  border: "1px solid #eeeeee",
  padding: "16px",
  display: "grid",
  gap: "6px",
  alignContent: "start" as const,
};

const numeroResumen = {
  fontSize: "26px",
  fontWeight: 400,
};

const textarea = {
  ...ui.input,
  minHeight: "100px",
  resize: "vertical" as const,
};

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};
