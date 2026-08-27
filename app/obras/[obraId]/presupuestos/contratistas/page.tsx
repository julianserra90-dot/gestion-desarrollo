import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import Volver from "@/components/Volver";
import { getObraPorSlug } from "@/lib/obras";
import { TIPOS_DE_PROVEEDOR } from "@/lib/proveedores-tipos";
import { createClient } from "@/lib/supabase/server";
import {
  actualizarProveedor,
  crearProveedor,
  eliminarProveedor,
} from "./actions";

/** En cuántos gastos y cotizaciones figura, acá y en el resto de las obras. */
type Uso = {
  gastosAca: number;
  gastosOtras: number;
  cotizAca: number;
  cotizOtras: number;
};

export default async function ContratistasPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { obraId } = await params;
  const { error, ok } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Los gastos y cotizaciones se traen enteros —no sólo los de esta obra—
  // porque el borrado lo frena la base si el proveedor quedó enganchado en
  // cualquier lado, y conviene decirlo antes de ofrecer el botón.
  //
  // Los rubros son los del catálogo (`obra_id` null): el listado de proveedores
  // también es común a todas las obras, así que el rubro tiene que serlo.
  const [
    { data: catalogo },
    { data: rubros },
    { data: gastos },
    { data: cotizaciones },
    { data: perfil },
  ] = await Promise.all([
    supabase
      .from("proveedores")
      .select("id, nombre, tipo, telefono, rubro_id")
      .order("nombre"),
    supabase
      .from("rubros")
      .select("id, nombre")
      .is("obra_id", null)
      .order("nombre"),
    supabase.from("gastos").select("proveedor_id, obra_id"),
    supabase.from("presupuestos").select("proveedor_id, obra_id"),
    supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user?.id ?? "")
      .maybeSingle(),
  ]);

  // Editar y borrar el catálogo es de admin (política `proveedores_admin`).
  // Agregar lo puede hacer cualquiera: el formulario de gastos ya lo hacía.
  const esAdmin = perfil?.rol === "admin";

  const uso = new Map<string, Uso>();

  for (const fila of gastos ?? []) {
    if (!fila.proveedor_id) continue;
    const u = uso.get(fila.proveedor_id) ?? sinUso();
    if (fila.obra_id === obra.id) u.gastosAca++;
    else u.gastosOtras++;
    uso.set(fila.proveedor_id, u);
  }

  for (const fila of cotizaciones ?? []) {
    if (!fila.proveedor_id) continue;
    const u = uso.get(fila.proveedor_id) ?? sinUso();
    if (fila.obra_id === obra.id) u.cotizAca++;
    else u.cotizOtras++;
    uso.set(fila.proveedor_id, u);
  }

  const lista = catalogo ?? [];
  const listaRubros = rubros ?? [];

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="presupuestos" />

      <section style={ui.sectionHeader}>
        <Volver href={`/obras/${obra.slug}/presupuestos`}>Presupuestos</Volver>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Contratistas y proveedores</h2>
        <p style={ui.subtitle}>
          El listado es <strong>el mismo para todas las obras</strong>.
        </p>
      </section>

      {error && <p style={errorBox}>{error}</p>}
      {ok && <p style={okBox}>Listo, se guardó.</p>}

      {!esAdmin && (
        <p style={avisoBox}>
          Podés agregar, pero modificar y eliminar el listado es cosa del
          administrador: lo que se toca acá cambia en todas las obras.
        </p>
      )}

      {/* El "volver" salió de acá: vive arriba del título, en el mismo lugar
          que en todas las pantallas de detalle. */}
      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Agregar</h3>
      </div>

      <section style={ui.panel}>
        <form action={crearProveedor} style={formAlta}>
          <input type="hidden" name="slug" value={obra.slug} />

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
            <select name="tipo" defaultValue="Contratista" style={ui.input}>
              {TIPOS_DE_PROVEEDOR.map((t) => (
                <option key={t.tipo} value={t.tipo}>
                  {t.tipo}
                </option>
              ))}
            </select>
          </label>

          <label style={campo}>
            <span style={etiqueta}>Rubro</span>
            <SelectorDeRubro rubros={listaRubros} />
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
      </section>

      {/* Acordeón nativo: `details` abre y cierra sin JavaScript, así la página
          sigue siendo un server component. Arranca abierto el grupo que se vino
          a mirar —contratistas— y el resto plegado, que es lo que hace que la
          lista se lea como una agenda y no como un muro. */}
      {TIPOS_DE_PROVEEDOR.map((grupo) => {
        const suyos = lista.filter((p) => p.tipo === grupo.tipo);

        return (
          <details
            key={grupo.tipo}
            open={grupo.tipo === "Contratista"}
            style={acordeon}
          >
            <summary style={resumen}>
              <span style={contenidoResumen}>
                <span style={tituloGrupo}>{grupo.titulo}</span>
                <span style={ui.note}>
                  {suyos.length} · {grupo.ayuda}
                </span>
              </span>
            </summary>

            {suyos.length === 0 ? (
              <p style={{ ...ui.vacio, marginTop: "20px" }}>
                Todavía no hay ninguno cargado.
              </p>
            ) : (
              <div style={filas}>
                {suyos.map((p) => {
                  const u = uso.get(p.id);
                  const enUso = total(u) > 0;

                  return (
                    <div key={p.id} style={fila}>
                      <div style={renglon}>
                        <form action={actualizarProveedor} style={formEdicion}>
                          <input type="hidden" name="slug" value={obra.slug} />
                          <input
                            type="hidden"
                            name="proveedor_id"
                            value={p.id}
                          />

                          <input
                            type="text"
                            name="nombre"
                            defaultValue={p.nombre}
                            aria-label="Nombre y apellido"
                            required
                            disabled={!esAdmin}
                            style={ui.input}
                          />

                          <SelectorDeRubro
                            rubros={listaRubros}
                            valor={p.rubro_id}
                            deshabilitado={!esAdmin}
                          />

                          <input
                            type="text"
                            name="telefono"
                            defaultValue={p.telefono ?? ""}
                            placeholder="Teléfono"
                            aria-label="Teléfono"
                            disabled={!esAdmin}
                            style={ui.input}
                          />

                          <button
                            type="submit"
                            disabled={!esAdmin}
                            style={ui.button}
                          >
                            Guardar
                          </button>
                        </form>

                        {/* El tacho va en su propio form —es otra acción— pero
                            alineado en el mismo renglón. Cuando el proveedor
                            tiene algo cargado queda deshabilitado en vez de
                            desaparecer: que el botón esté siempre en el mismo
                            lugar hace la lista más fácil de recorrer. */}
                        <form action={eliminarProveedor}>
                          <input type="hidden" name="slug" value={obra.slug} />
                          <input
                            type="hidden"
                            name="proveedor_id"
                            value={p.id}
                          />
                          <button
                            type="submit"
                            disabled={!esAdmin || enUso}
                            title={
                              enUso
                                ? "No se puede eliminar: tiene gastos o cotizaciones cargadas"
                                : "Eliminar"
                            }
                            aria-label={`Eliminar ${p.nombre}`}
                            style={enUso || !esAdmin ? tachoInerte : tacho}
                          >
                            <IconoTacho />
                          </button>
                        </form>
                      </div>

                      <p style={usoTexto}>{describirUso(u)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </details>
        );
      })}
    </AppShell>
  );
}

/**
 * El desplegable de rubros. Se repite igual en el alta y en cada renglón, y en
 * los dos casos el vacío es una opción legítima: no siempre se sabe de entrada
 * qué hace el que se está cargando.
 */
function SelectorDeRubro({
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

function sinUso(): Uso {
  return { gastosAca: 0, gastosOtras: 0, cotizAca: 0, cotizOtras: 0 };
}

function total(u: Uso | undefined) {
  if (!u) return 0;
  return u.gastosAca + u.gastosOtras + u.cotizAca + u.cotizOtras;
}

/**
 * Se separa lo de esta obra de lo del resto porque son dos preguntas: "¿con
 * este trabajé acá?" y "¿por qué no me deja borrarlo?".
 */
function describirUso(u: Uso | undefined) {
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

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const okBox = {
  ...errorBox,
  borderColor: "#dcdcdc",
  color: "#555555",
};

const avisoBox = {
  ...errorBox,
  borderColor: "#dcdcdc",
  color: "#777777",
};

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

const acordeon = {
  ...ui.panel,
  marginTop: "16px",
};

const resumen = {
  cursor: "pointer",
};

/**
 * El contenido va en un `span` inline-flex y no en el `summary` directamente:
 * con `display: flex` en el summary se pierde el triangulito nativo, que es la
 * única señal de que el grupo se abre. El ancho descuenta lo que ocupa.
 */
const contenidoResumen = {
  display: "inline-flex",
  flexWrap: "wrap" as const,
  alignItems: "baseline",
  gap: "12px",
  width: "calc(100% - 28px)",
  verticalAlign: "middle",
};

const tituloGrupo = {
  fontSize: "18px",
};

const filas = {
  display: "grid",
  gap: "16px",
  marginTop: "20px",
};

const fila = {
  display: "grid",
  gap: "6px",
  borderTop: "1px solid #eeeeee",
  paddingTop: "16px",
};

const renglon = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
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

const usoTexto = {
  ...ui.note,
  margin: 0,
};
