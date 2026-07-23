"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";

const CATEGORIAS = [
  "Arquitectura",
  "Estructura",
  "Instalaciones",
  "Presupuestos",
  "Permisos",
  "Contratos",
];

const ESTADOS = ["Vigente", "En revisión", "Obsoleto"];

export default function SubirDocumentoForm({
  action,
  obraId,
  slug,
  error,
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  error?: string;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");

  return (
    <form
      action={action}
      onSubmit={() => setSubiendo(true)}
    >
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />

      {error && <p style={errorBox}>{error}</p>}

      <div style={ui.panel}>
        <div style={grid}>
          <label style={fieldAncho}>
            <span style={labelCampo}>Archivo</span>
            <input
              type="file"
              name="archivo"
              required
              onChange={(e) =>
                setNombreArchivo(e.target.files?.[0]?.name ?? "")
              }
              style={ui.input}
            />
            <span style={ayuda}>
              Planos, PDF, DWG, planillas. Se sube tal cual, sin comprimir.
            </span>
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>Nombre del documento</span>
            <input
              type="text"
              name="nombre"
              placeholder={
                nombreArchivo
                  ? `Por defecto: ${nombreArchivo.replace(/\.[^.]+$/, "")}`
                  : "Ej: Planta arquitectura PB"
              }
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={labelCampo}>Categoría</span>
            <input
              type="text"
              name="categoria"
              list="categorias-doc"
              placeholder="Seleccionar o escribir"
              style={ui.input}
            />
            <datalist id="categorias-doc">
              {CATEGORIAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label style={field}>
            <span style={labelCampo}>Versión</span>
            <input
              type="text"
              name="version"
              defaultValue="V01"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={labelCampo}>Estado</span>
            <select name="estado" defaultValue="Vigente" style={ui.input}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>

          <label style={field}>
            <span style={labelCampo}>Fecha</span>
            <input type="date" name="fecha" style={ui.input} />
          </label>
        </div>
      </div>

      <div style={acciones}>
        <Link href={`/obras/${slug}/documentos`} style={ui.secondaryButton}>
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={subiendo}
          style={subiendo ? botonInactivo : ui.button}
        >
          {subiendo ? "Subiendo..." : "Subir documento"}
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
};

const fieldAncho = {
  ...field,
  gridColumn: "1 / -1",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const ayuda = {
  fontSize: "13px",
  color: "#999999",
};

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};

const botonInactivo = {
  ...ui.button,
  background: "#999999",
  border: "1px solid #999999",
  cursor: "not-allowed",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
