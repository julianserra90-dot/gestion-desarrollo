"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import {
  AMBITOS,
  type Ambito,
  etiquetaAmbito,
  mismaLinea,
  usaRubro,
  versionSiguiente,
} from "@/lib/ambitos";

// Al cargar, Obsoleto no se elige: lo pone el sistema cuando llega la versión
// que lo reemplaza. Al editar sí, que es la pantalla para arreglar errores.
const ESTADOS = ["Vigente", "En revisión"];
const ESTADOS_EDICION = ["Vigente", "En revisión", "Obsoleto"];

const AYUDA: Record<Ambito, string> = {
  Obra: "Lo que se usa para construir: planos de obra, detalles constructivos, planillas.",
  Proyecto: "Lo que define el proyecto: anteproyecto, plantas, cortes, vistas.",
  Administrativa: "Papeles que no son de un rubro: avisos de obra, planos municipales, seguros, contratos.",
  Lote: "Papeles de la compra del terreno: boleto de compraventa, escritura, y lo demás de la operación.",
};

// Sólo para los ámbitos sin rubro: el campo Título cambia de ejemplo y ayuda
// según cuál sea, para no sugerir "Aviso de obra" al cargar la escritura.
const PLACEHOLDER_TITULO: Partial<Record<Ambito, string>> = {
  Administrativa: "Ej: Aviso de obra",
  Lote: "Ej: Escritura",
};

const AYUDA_TITULO: Partial<Record<Ambito, string>> = {
  Administrativa: "Lo administrativo no va por rubro. Los títulos ya usados se ofrecen solos.",
  Lote: "Los papeles del lote no van por rubro. Los títulos ya usados se ofrecen solos.",
};

export type RubroOpcionForm = { id: string; nombre: string };

/** Lo ya cargado en la obra, para saber qué versión le toca a esta carga. */
export type DocumentoCargado = {
  nombre: string;
  ambito: Ambito;
  rubroId: string | null;
  titulo: string | null;
  version: string | null;
  estado: string;
};

/** De qué documento se precargó el formulario, si se vino desde uno. */
export type Precarga = {
  id: string;
  nombre: string;
  ambito: Ambito;
  rubroId: string | null;
  titulo: string | null;
};

/** El documento que se está corrigiendo, si esto es una edición. */
export type DocumentoEnEdicion = Precarga & {
  version: string | null;
  estado: string;
  fecha: string;
};

export default function SubirDocumentoForm({
  action,
  obraId,
  slug,
  rubros,
  titulosUsados,
  documentos,
  error,
  precarga,
  documento,
  textoBoton,
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  rubros: RubroOpcionForm[];
  /** Los títulos ya usados, agrupados por ámbito: cada uno ofrece los suyos. */
  titulosUsados: Record<string, string[]>;
  documentos: DocumentoCargado[];
  error?: string;
  precarga?: Precarga;
  documento?: DocumentoEnEdicion;
  textoBoton?: string;
}) {
  const inicial = documento ?? precarga;
  const editando = Boolean(documento);

  const [subiendo, setSubiendo] = useState(false);
  const [archivos, setArchivos] = useState<string[]>([]);
  const [ambito, setAmbito] = useState<Ambito>(inicial?.ambito ?? "Obra");
  const [rubroId, setRubroId] = useState(inicial?.rubroId ?? "");
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [estado, setEstado] = useState(documento?.estado ?? "Vigente");

  const llevaRubro = usaRubro(ambito);

  // La versión sale de lo que ya hay con ese nombre en ese lugar, igual que la
  // calcula el servidor al guardar. Acá sólo se muestra para que no sorprenda.
  const linea = {
    ambito,
    rubroId: llevaRubro ? rubroId || null : null,
    titulo: llevaRubro ? null : titulo,
    nombre,
  };

  const previos = nombre.trim()
    ? documentos.filter((d) => mismaLinea(linea, d))
    : [];

  const version = versionSiguiente(previos.map((d) => d.version));
  const vigente = previos.find((d) => d.estado === "Vigente");
  const desplaza = estado === "Vigente" && Boolean(vigente);

  return (
    <form action={action} onSubmit={() => setSubiendo(true)}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      {documento && (
        <input type="hidden" name="documento_id" value={documento.id} />
      )}
      {!editando && precarga && (
        <input type="hidden" name="origen" value={precarga.id} />
      )}

      {error && <p style={errorBox}>{error}</p>}

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
                  {etiquetaAmbito(a)}
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
                value={rubroId}
                onChange={(e) => setRubroId(e.target.value)}
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
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                placeholder={PLACEHOLDER_TITULO[ambito] ?? "Ej: Aviso de obra"}
                style={ui.input}
              />
              <datalist id="titulos-doc">
                {(titulosUsados[ambito] ?? []).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <span style={ayuda}>
                {AYUDA_TITULO[ambito] ??
                  "Esto no va por rubro. Los títulos ya usados se ofrecen solos."}
              </span>
            </label>
          )}

          <label style={field}>
            <span style={labelCampo}>Fecha</span>
            <input
              type="date"
              name="fecha"
              defaultValue={documento?.fecha ?? ""}
              style={ui.input}
            />
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>Nombre del documento</span>
            <input
              type="text"
              name="nombre"
              list="nombres-doc"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Banquinas"
              style={ui.input}
            />
            <datalist id="nombres-doc">
              {nombresDisponibles(documentos, linea, llevaRubro).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <span style={ayuda}>
              Es lo que distingue un documento de otro dentro del rubro:
              Banquinas y Replanteo son dos documentos, no dos versiones. Poné el
              mismo nombre para subir una versión nueva.
            </span>
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>
              {editando ? "Agregar archivos" : "Archivos"}
            </span>
            <input
              type="file"
              name="archivos"
              multiple
              required={!editando}
              onChange={(e) =>
                setArchivos(Array.from(e.target.files ?? []).map((f) => f.name))
              }
              style={ui.input}
            />
            <span style={ayuda}>
              {editando
                ? "Se suman a los que ya tiene. Para sacar alguno, más abajo."
                : "El mismo plano en PDF y en DWG va acá junto, como un solo documento. Cómo se llame el archivo no importa: el nombre del documento es el de arriba."}
            </span>
            {archivos.length > 1 && (
              <span style={ayuda}>
                {archivos.length} archivos: {archivos.join(", ")}
              </span>
            )}
          </label>

          <label style={field}>
            <span style={labelCampo}>Estado</span>
            <select
              name="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              style={ui.input}
            >
              {(editando ? ESTADOS_EDICION : ESTADOS).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            {editando && estado === "Vigente" && (
              <span style={ayuda}>
                Si hay otra versión vigente con este nombre, pasa a obsoleta.
              </span>
            )}
          </label>

          {editando ? (
            <label style={fieldVersion}>
              <span style={labelCampo}>Versión</span>
              <input
                type="text"
                name="version"
                defaultValue={documento?.version ?? ""}
                style={ui.input}
              />
              <span style={ayuda}>
                Acá se escribe a mano: es la pantalla para arreglar errores,
                incluido un número mal puesto.
              </span>
            </label>
          ) : (
            <div style={fieldVersion}>
              <span style={labelCampo}>Versión</span>
              <strong style={numeroVersion}>
                {nombre.trim() ? version : "—"}
              </strong>
              <span style={ayuda}>
                {explicacion(nombre, version, vigente, desplaza)}
              </span>
            </div>
          )}
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
          {subiendo ? "Guardando..." : textoBoton ?? "Subir documento"}
        </button>
      </div>
    </form>
  );
}

/** Los nombres ya usados en el mismo lugar, para continuar una línea sin tipear. */
function nombresDisponibles(
  documentos: DocumentoCargado[],
  linea: { ambito: Ambito; rubroId: string | null; titulo: string | null },
  llevaRubro: boolean
): string[] {
  const mismos = documentos.filter(
    (d) =>
      d.ambito === linea.ambito &&
      (llevaRubro
        ? d.rubroId === linea.rubroId
        : (d.titulo ?? "") === (linea.titulo ?? ""))
  );

  return Array.from(new Set(mismos.map((d) => d.nombre))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

function explicacion(
  nombre: string,
  version: string,
  vigente: DocumentoCargado | undefined,
  desplaza: boolean
): string {
  if (!nombre.trim()) return "Se calcula sola cuando pongas el nombre.";

  if (!vigente) {
    return version === "V01"
      ? "Es el primero con ese nombre acá, así que arranca en V01."
      : `Sigue la numeración de lo que ya hay con ese nombre.`;
  }

  if (desplaza) {
    return `Reemplaza a la ${vigente.version ?? "anterior"}, que pasa a Obsoleta.`;
  }

  return `Queda en revisión: la ${vigente.version ?? "anterior"} sigue siendo la vigente hasta que la apruebes.`;
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

const fieldVersion = {
  ...field,
  gridColumn: "span 2",
};

const numeroVersion = {
  fontSize: "20px",
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
