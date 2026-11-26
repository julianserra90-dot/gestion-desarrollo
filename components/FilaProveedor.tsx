import {
  actualizarProveedor,
  crearProveedor,
  eliminarProveedor,
  quitarProveedorDeObra,
} from "@/app/obras/[obraId]/presupuestos/contratistas/actions";
import * as ui from "@/components/ui";
import type { UsoDeProveedor } from "@/lib/proveedores";
import { TIPOS_DE_PROVEEDOR } from "@/lib/proveedores-tipos";

/**
 * El alta de un proveedor desde una obra: queda en el catálogo y marcado en
 * esta obra. Si ya existía con ese nombre (cargado desde otra), se suma acá.
 */
export function AltaProveedor({
  obra,
  rubros,
  volver,
  tipo = "Contratista",
}: {
  obra: { id: string; slug: string };
  rubros: { id: string; nombre: string }[];
  volver: string;
  tipo?: string;
}) {
  return (
    <form action={crearProveedor} style={formAlta}>
      <input type="hidden" name="slug" value={obra.slug} />
      <input type="hidden" name="obra_id" value={obra.id} />
      <input type="hidden" name="volver" value={volver} />

      <label style={campo}>
        <span style={etiqueta}>Nombre y apellido</span>
        <input
          type="text"
          name="nombre"
          placeholder="Ej: Juan Pérez, o Corralón Central"
          required
          style={ui.input}
        />
      </label>

      <label style={campo}>
        <span style={etiqueta}>Categoría</span>
        <select name="tipo" defaultValue={tipo} style={ui.input}>
          {TIPOS_DE_PROVEEDOR.map((t) => (
            <option key={t.tipo} value={t.tipo}>
              {t.tipo}
            </option>
          ))}
        </select>
      </label>

      <label style={campo}>
        <span style={etiqueta}>Rubro</span>
        <SelectorDeRubro rubros={rubros} />
      </label>

      <label style={campo}>
        <span style={etiqueta}>Teléfono</span>
        <input
          type="text"
          name="telefono"
          placeholder="Ej: 11 5555-4444"
          style={ui.input}
        />
      </label>

      <button type="submit" style={ui.button}>
        Agregar
      </button>
    </form>
  );
}

/**
 * Un renglón del catálogo de proveedores, editable en el lugar: nombre, rubro
 * y teléfono, más sacarlo de la obra y el tacho.
 *
 * Lo comparten "Contratistas y proveedores" y la agenda de Gremios. `volver`
 * es la pantalla a la que se regresa después de guardar.
 *
 * Editar y borrar son del administrador (el nombre y el teléfono son los
 * mismos en todas las obras); sacarlo de la obra lo puede hacer cualquiera.
 */
export default function FilaProveedor({
  proveedor: p,
  obra,
  rubros,
  uso,
  esAdmin,
  volver,
  busca,
}: {
  proveedor: { id: string; nombre: string; telefono: string | null; rubro_id: string | null };
  /** El texto donde busca el buscador de la agenda, si lo hay. */
  busca?: string;
  obra: { id: string; slug: string };
  rubros: { id: string; nombre: string }[];
  uso: UsoDeProveedor | undefined;
  esAdmin: boolean;
  volver: string;
}) {
  const enUso = totalDeUso(uso) > 0;

  // `data-busca` va en un envoltorio sin estilo: el buscador lo esconde con
  // `display: none` y al volver lo deja vacío, lo que le borraría el `grid`
  // al renglón.
  return (
    <div data-busca={busca}>
      <div style={fila}>
        <div style={renglon}>
          <form action={actualizarProveedor} style={formEdicion}>
            <Ocultos obra={obra} volver={volver} proveedorId={p.id} />
  
            <input
              type="text"
              name="nombre"
              defaultValue={p.nombre}
              aria-label="Nombre y apellido"
              required
              disabled={!esAdmin}
              style={ui.input}
            />
  
            <SelectorDeRubro rubros={rubros} valor={p.rubro_id} deshabilitado={!esAdmin} />
  
            <input
              type="text"
              name="telefono"
              defaultValue={p.telefono ?? ""}
              placeholder="Teléfono"
              aria-label="Teléfono"
              disabled={!esAdmin}
              style={ui.input}
            />
  
            <button type="submit" disabled={!esAdmin} style={ui.button}>
              Guardar
            </button>
          </form>
  
          {/* Sacarlo de la obra no borra nada: sólo deja de aparecer en los
              desplegables de acá. */}
          <form action={quitarProveedorDeObra}>
            <Ocultos obra={obra} volver={volver} proveedorId={p.id} />
            <button
              type="submit"
              title="Deja de aparecer en los desplegables de esta obra. No borra nada."
              style={ui.secondaryButton}
            >
              Sacar de la obra
            </button>
          </form>
  
          {/* El tacho va en su propio form —es otra acción— pero alineado en el
              mismo renglón. Cuando el proveedor tiene algo cargado queda
              deshabilitado en vez de desaparecer: que el botón esté siempre en
              el mismo lugar hace la lista más fácil de recorrer. */}
          <BotonEliminar
            obra={obra}
            volver={volver}
            proveedor={p}
            enUso={enUso}
            esAdmin={esAdmin}
          />
        </div>

        <p style={usoTexto}>{describirUso(uso)}</p>
      </div>
    </div>
  );
}

export function BotonEliminar({
  obra,
  volver,
  proveedor,
  enUso,
  esAdmin,
}: {
  obra: { id: string; slug: string };
  volver: string;
  proveedor: { id: string; nombre: string };
  enUso: boolean;
  esAdmin: boolean;
}) {
  return (
    <form action={eliminarProveedor}>
      <Ocultos obra={obra} volver={volver} proveedorId={proveedor.id} />
      <button
        type="submit"
        disabled={!esAdmin || enUso}
        title={
          enUso
            ? "No se puede eliminar: tiene gastos o cotizaciones cargadas"
            : "Eliminar"
        }
        aria-label={`Eliminar ${proveedor.nombre}`}
        style={enUso || !esAdmin ? tachoInerte : tacho}
      >
        <IconoTacho />
      </button>
    </form>
  );
}

function Ocultos({
  obra,
  volver,
  proveedorId,
}: {
  obra: { id: string; slug: string };
  volver: string;
  proveedorId: string;
}) {
  return (
    <>
      <input type="hidden" name="slug" value={obra.slug} />
      <input type="hidden" name="obra_id" value={obra.id} />
      <input type="hidden" name="volver" value={volver} />
      <input type="hidden" name="proveedor_id" value={proveedorId} />
    </>
  );
}

/**
 * El desplegable de rubros. Se repite igual en el alta y en cada renglón, y en
 * los dos casos el vacío es una opción legítima: no siempre se sabe de entrada
 * qué hace el que se está cargando.
 */
export function SelectorDeRubro({
  rubros,
  valor,
  deshabilitado,
}: {
  rubros: { id: string; nombre: string }[];
  valor?: string | null;
  deshabilitado?: boolean;
}) {
  return (
    <select
      name="rubro_id"
      defaultValue={valor ?? ""}
      aria-label="Rubro"
      disabled={deshabilitado}
      style={ui.input}
    >
      <option value="">Sin rubro</option>
      {rubros.map((r) => (
        <option key={r.id} value={r.id}>
          {r.nombre}
        </option>
      ))}
    </select>
  );
}

function IconoTacho() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M10 4h4M9 7v12M15 7v12M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function totalDeUso(u: UsoDeProveedor | undefined) {
  if (!u) return 0;
  return u.gastosAca + u.gastosOtras + u.cotizAca + u.cotizOtras;
}

/**
 * Se separa lo de esta obra de lo del resto porque son dos preguntas: "¿con
 * este trabajé acá?" y "¿por qué no me deja borrarlo?".
 */
export function describirUso(u: UsoDeProveedor | undefined) {
  if (!u) return "Sin uso todavía.";

  const aca: string[] = [];
  if (u.cotizAca) aca.push(plural(u.cotizAca, "cotización", "cotizaciones"));
  if (u.gastosAca) aca.push(plural(u.gastosAca, "gasto", "gastos"));

  const partes: string[] = [];
  if (aca.length) partes.push(`En esta obra: ${aca.join(" y ")}.`);
  else partes.push("Sin uso en esta obra.");
  if (u.cotizOtras + u.gastosOtras > 0) {
    partes.push("También figura en otras obras.");
  }

  return partes.join(" ");
}

function plural(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

const formAlta = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1.5fr 1fr auto",
  gap: "12px",
  alignItems: "end",
};

const campo = {
  display: "grid",
  gap: "6px",
  minWidth: 0,
};

const etiqueta = {
  fontSize: "12px",
  color: "#777777",
};

export const fila = {
  display: "grid",
  gap: "6px",
  borderTop: "1px solid #eeeeee",
  paddingTop: "16px",
};

export const renglon = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: "12px",
  alignItems: "center",
};

const formEdicion = {
  display: "grid",
  gridTemplateColumns: "2fr 1.5fr 1fr auto",
  gap: "12px",
  alignItems: "center",
};

const tacho = {
  ...ui.button,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px",
};

/** Deshabilitado se ve, pero no invita: gris sobre blanco y sin manito. */
const tachoInerte = {
  ...tacho,
  background: "#ffffff",
  color: "#cccccc",
  borderColor: "#e5e5e5",
  cursor: "default",
};

export const usoTexto = {
  ...ui.note,
  margin: 0,
};
