"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import { AMBITOS, type Ambito } from "@/lib/ambitos";

const ESTADOS = ["Vigente", "En revisión", "Obsoleto"];

const AYUDA: Record<Ambito, string> = {
  Obra: "Lo que se usa para construir: planos de obra, detalles constructivos, planillas.",
  Proyecto: "Lo que define el proyecto: anteproyecto, plantas, cortes, vistas.",
  Administrativa: "Papeles que no son de un rubro: avisos de obra, planos municipales, seguros, contratos.",
};

export type RubroOpcionForm = { id: string; nombre: string };

/** El documento del que esta carga es continuación, si es una versión nueva. */
export type VersionAnterior = {
  id: string;
  nombre: string;
  ambito: Ambito;
  rubroId: string | null;
  titulo: string | null;
  version: string | null;
};

export default function SubirDocumentoForm({
  action,
  obraId,
  slug,
  rubros,
  titulosUsados,
  error,
  reemplaza,
  versionSugerida,
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  rubros: RubroOpcionForm[];
  titulosUsados: string[];
  error?: string;
  reemplaza?: VersionAnterior;
  versionSugerida?: string;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [archivos, setArchivos] = useState<string[]>([]);
  const [ambito, setAmbito] = useState<Ambito>(reemplaza?.ambito ?? "Obra");

  const llevaRubro = ambito !== "Administrativa";

  return (
    <form action={action} onSubmit={() => setSubiendo(true)}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      {reemplaza && (
        <input type="hidden" name="reemplaza_a" value={reemplaza.id} />
      )}

      {error && <p style={errorBox}>{error}</p>}

      {reemplaza && (
        <p style={avisoVersion}>
          Es una versión nueva de <strong>{reemplaza.nombre}</strong>
          {reemplaza.version ? ` (${reemplaza.version})` : ""}. Al guardar, esa
          queda marcada como <strong>Obsoleta</strong>.
        </p>
      )}

      <div style={ui.panel}>
        <div style={grid}>
          <label style={field}>
            <span style={labelCampo}>Ámbito</span>
            <select
              name="ambito"
              value={ambito}
              onChange={(e) => setAmbito(e.target.value as Ambito)}
              style={ui.input}
            >
              {AMBITOS.map((a) => (
                <option key={a} value={a}>
                  {a === "Administrativa" ? "Administrativa" : `De ${a.toLowerCase()}`}
                </option>
              ))}
            </select>
            <span style={ayuda}>{AYUDA[ambito]}</span>
          </label>

          {llevaRubro ? (
            <label style={field}>
              <span style={labelCampo}>Rubro</span>
              <select
                name="rubro_id"
                defaultValue={reemplaza?.rubroId ?? ""}
                required
                style={ui.input}
              >
                <option value="">Elegir rubro</option>
                {rubros.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
              <span style={ayuda}>
                {rubros.length === 0
                  ? "Esta obra todavía no marcó qué rubros usa."
                  : "Sólo aparecen los rubros que esta obra usa."}
              </span>
            </label>
          ) : (
            <label style={field}>
              <span style={labelCampo}>Título</span>
              <input
                type="text"
                name="titulo"
                list="titulos-doc"
                defaultValue={reemplaza?.titulo ?? ""}
                required
                placeholder="Ej: Aviso de obra"
                style={ui.input}
              />
              <datalist id="titulos-doc">
                {titulosUsados.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <span style={ayuda}>
                Lo administrativo no va por rubro. Los títulos ya usados se
                ofrecen solos.
              </span>
            </label>
          )}

          <label style={field}>
            <span style={labelCampo}>Fecha</span>
            <input type="date" name="fecha" style={ui.input} />
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>Archivos</span>
            <input
              type="file"
              name="archivos"
              multiple
              required
              onChange={(e) =>
                setArchivos(Array.from(e.target.files ?? []).map((f) => f.name))
              }
              style={ui.input}
            />
            <span style={ayuda}>
              El mismo plano en PDF y en DWG va acá junto, como un solo
              documento. Se suben tal cual, sin comprimir.
            </span>
            {archivos.length > 1 && (
              <span style={ayuda}>
                {archivos.length} archivos: {archivos.join(", ")}
              </span>
            )}
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>Nombre del documento</span>
            <input
              type="text"
              name="nombre"
              defaultValue={reemplaza?.nombre ?? ""}
              placeholder={
                archivos[0]
                  ? `Por defecto: ${archivos[0].replace(/\.[^.]+$/, "")}`
                  : "Ej: Planta albañilería PB"
              }
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={labelCampo}>Versión</span>
            <input
              type="text"
              name="version"
              defaultValue={versionSugerida || "V01"}
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

const avisoVersion = {
  border: "1px solid #e5e5e5",
  background: "#fafafa",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
