import AppShell from "@/components/AppShell";
import MaterialesNav from "@/components/MaterialesNav";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getPresentaciones } from "@/lib/materiales";
import { envaseDe } from "@/lib/presentaciones";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { UNIDADES } from "@/lib/unidades";
import {
  actualizarMaterial,
  agregarPresentacion,
  crearMaterial,
  eliminarMaterial,
  quitarPresentacion,
} from "../actions";

/**
 * El catálogo de materiales: lo que se ofrece al detallar una compra.
 *
 * Es **uno solo para todas las obras**, igual que el de proveedores: el ladrillo
 * común es el mismo ladrillo en todos lados. Se entra por una obra pero se
 * edita el catálogo entero, así que la pantalla lo dice.
 *
 * Cada material lleva además sus **presentaciones**: las formas en que se
 * vende —lata de 1, 4 y 10 litros; balde de 20—. Con ellas el listado de
 * materiales del cómputo dice qué comprar y no sólo cuánto hace falta.
 *
 * Vive en su propia solapa y no debajo del consumo: son dos preguntas distintas
 * —qué entró a la obra, y qué se puede elegir al cargar— y tenerlas apiladas
 * obligaba a bajar toda la pared de acordeones para corregir un nombre mal
 * escrito.
 */

export default async function CatalogoMaterialesPage({
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

  const [{ data: catalogo }, { data: rubros }, { data: perfil }, presentaciones] =
    await Promise.all([
      supabase
        .from("materiales")
        .select("id, nombre, unidad, contenido, contenido_unidad, rubro_id")
        .order("nombre"),
      // Alfabético y no por el orden del catálogo (que es la secuencia de obra:
      // preliminares, demoliciones, excavaciones…): acá no se sigue la obra, se
      // busca un rubro puntual en una lista larga.
      supabase
        .from("rubros")
        .select("id, nombre")
        .is("obra_id", null)
        .order("nombre"),
      supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user?.id ?? "")
        .maybeSingle(),
      getPresentaciones(),
    ]);

  const esAdmin = perfil?.rol === "admin";
  const lista = catalogo ?? [];
  const listaRubros = rubros ?? [];
  const nombreRubro = new Map(listaRubros.map((r) => [r.id, r.nombre]));

  // Cuántas veces se usó cada material, para saber si se puede borrar del
  // catálogo. Cuenta todas las obras, igual que el borrado que hace la base.
  const { data: todosLosItems } = await supabase
    .from("gasto_materiales")
    .select("material_id");

  const usos = new Map<string, number>();
  for (const item of todosLosItems ?? []) {
    usos.set(item.material_id, (usos.get(item.material_id) ?? 0) + 1);
  }

  // El catálogo agrupado por rubro, alfabético (los rubros vienen ordenados
  // así de la consulta) y con los sueltos al final. Un rubro sin materiales no
  // aparece: sería un acordeón vacío.
  const grupos = [
    ...listaRubros
      .map((r) => ({
        titulo: r.nombre,
        materiales: lista.filter((m) => m.rubro_id === r.id),
      }))
      .filter((g) => g.materiales.length > 0),
    {
      titulo: "Sin rubro",
      materiales: lista.filter(
        (m) => !m.rubro_id || !nombreRubro.has(m.rubro_id)
      ),
    },
  ].filter((g) => g.materiales.length > 0);

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="materiales" />}
    >
      <ObraHeader obra={obra} activeSection="materiales" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Materiales</h2>
      </section>

      <MaterialesNav slug={obra.slug} activa="catalogo" />

      {error && <p style={errorBox}>{error}</p>}
      {ok && <p style={okBox}>Listo, se guardó.</p>}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Catálogo</h3>
        <span style={ui.note}>
          {lista.length} · el mismo para todas las obras
        </span>
      </div>

      {!esAdmin && (
        <p style={avisoBox}>
          Podés agregar, pero modificar y eliminar el listado es cosa del
          administrador: lo que se toca acá cambia en todas las obras.
        </p>
      )}

      <section style={ui.panel}>
        <form action={crearMaterial} style={formAlta}>
          <input type="hidden" name="slug" value={obra.slug} />

          <label style={campo}>
            <span style={etiqueta}>Material</span>
            <input
              type="text"
              name="nombre"
              placeholder="Ej: Ladrillo común"
              required
              style={ui.input}
            />
          </label>

          <label style={campo}>
            <span style={etiqueta}>Unidad</span>
            <select name="unidad" defaultValue="un" style={ui.input}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <label style={campo}>
            <span style={etiqueta}>Contenido</span>
            <div style={parEnvase}>
              <input
                type="number"
                name="contenido"
                min={0}
                step="any"
                placeholder="30"
                aria-label="Cuánto trae el envase"
                style={{ ...ui.input, flex: "1 1 80px" }}
              />
              <select
                name="contenido_unidad"
                defaultValue="kg"
                aria-label="Unidad de lo que trae"
                style={{ ...ui.input, flex: "0 0 100px" }}
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label style={campo}>
            <span style={etiqueta}>Rubro</span>
            <select name="rubro_id" defaultValue="" style={ui.input}>
              <option value="">Sin rubro</option>
              {listaRubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" style={ui.button}>
            Agregar
          </button>
        </form>
      </section>

      {/* El listado va en acordeones por rubro, no de corrido: con treinta
          materiales cargados encontrar el que se quiere corregir era bajar y
          leer todo. Cerrados, cada rubro es una línea. */}
      <div style={acordeones}>
        {grupos.map((grupo) => (
          <details key={grupo.titulo} style={ui.panel}>
            <summary style={resumen}>
              <span style={contenidoResumen}>
                <span style={tituloRubro}>{grupo.titulo}</span>
                <span style={ui.note}>
                  {grupo.materiales.length}{" "}
                  {grupo.materiales.length === 1 ? "material" : "materiales"}
                </span>
              </span>
            </summary>

            <div style={{ ...filas, marginTop: "16px" }}>
              {grupo.materiales.map((m) => {
                const veces = usos.get(m.id) ?? 0;
                const suyas = presentaciones.get(m.id) ?? [];
                // En qué se puede medir una forma de venta: lo que trae su
                // envase, o la unidad del material.
                const unidadesDePresentacion = [
                  ...new Set([m.contenido_unidad, m.unidad].filter(Boolean) as string[]),
                ];
                const propia = envaseDe({
                  unidad: m.unidad,
                  contenido: m.contenido === null ? null : Number(m.contenido),
                  contenidoUnidad: m.contenido_unidad,
                });
                // Cómo se vende, para leerlo cerrado: "bolsa 25 kg · bolsa 5 kg".
                const formas = [
                  ...(propia
                    ? [
                        propia.contenido === 1 && propia.nombre === propia.unidad
                          ? "suelto"
                          : `${propia.nombre} ${propia.contenido.toLocaleString("es-AR")} ${propia.unidad}`,
                      ]
                    : []),
                  ...suyas.map((s) => `${s.nombre} ${s.contenido.toLocaleString("es-AR")} ${s.unidad}`),
                ];
                const formulario = `material-${m.id}`;

                return (
                  <details key={m.id} style={material}>
                    <summary style={resumenMaterial}>
                      <span style={lineaResumen}>
                        <span style={nombreMaterial}>{m.nombre}</span>
                        <span style={formasResumen}>{formas.join(" · ") || "—"}</span>
                      </span>
                    </summary>

                    <div style={cuerpoMaterial}>
                      {/* El material: su nombre, su rubro y guardar. */}
                      <form id={formulario} action={actualizarMaterial} style={filaMaterial}>
                        <input type="hidden" name="slug" value={obra.slug} />
                        <input type="hidden" name="material_id" value={m.id} />
                        <input
                          type="text"
                          name="nombre"
                          defaultValue={m.nombre}
                          aria-label="Material"
                          required
                          disabled={!esAdmin}
                          style={ui.input}
                        />
                        <select
                          name="rubro_id"
                          defaultValue={m.rubro_id ?? ""}
                          aria-label="Rubro"
                          disabled={!esAdmin}
                          style={ui.input}
                        >
                          <option value="">Sin rubro</option>
                          {m.rubro_id && !nombreRubro.has(m.rubro_id) && (
                            <option value={m.rubro_id}>Rubro anterior</option>
                          )}
                          {listaRubros.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre}
                            </option>
                          ))}
                        </select>
                        {esAdmin ? (
                          <button type="submit" style={botonGuardar}>
                            Guardar
                          </button>
                        ) : (
                          <span />
                        )}
                      </form>

                      {/* Cómo se vende: la forma propia del material —es del
                          formulario de arriba y se guarda con él— y las que se
                          le agregan, cada una en su renglón, en las mismas
                          columnas. */}
                      <div style={tablaDeVenta}>
                        <span style={tituloDeColumna}>Se vende en</span>
                        <span style={{ ...tituloDeColumna, textAlign: "center" }}>Cantidad</span>
                        <span style={{ ...tituloDeColumna, textAlign: "center" }}>Unidad</span>
                        <span />

                        <select
                          form={formulario}
                          name="unidad"
                          defaultValue={m.unidad}
                          aria-label="Forma de venta"
                          disabled={!esAdmin}
                          style={ui.input}
                        >
                          {!UNIDADES.some((u) => u === m.unidad) && <option value={m.unidad}>{m.unidad}</option>}
                          {UNIDADES.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                        <input
                          form={formulario}
                          type="number"
                          name="contenido"
                          defaultValue={m.contenido ?? ""}
                          min={0}
                          step="any"
                          placeholder="—"
                          aria-label="Cuánto trae"
                          disabled={!esAdmin}
                          style={{ ...ui.input, textAlign: "right" }}
                        />
                        <select
                          form={formulario}
                          name="contenido_unidad"
                          defaultValue={m.contenido_unidad ?? "kg"}
                          aria-label="Unidad de lo que trae"
                          disabled={!esAdmin}
                          style={ui.input}
                        >
                          {m.contenido_unidad && !UNIDADES.some((u) => u === m.contenido_unidad) && (
                            <option value={m.contenido_unidad}>{m.contenido_unidad}</option>
                          )}
                          {UNIDADES.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                        <span />

                        {suyas.map((s) => (
                          <span key={s.id} style={{ display: "contents" }}>
                            <span style={valorFijo}>{s.nombre}</span>
                            <span style={{ ...valorFijo, textAlign: "right" }}>
                              {s.contenido.toLocaleString("es-AR")}
                            </span>
                            <span style={valorFijo}>{s.unidad}</span>
                            {esAdmin ? (
                              <form action={quitarPresentacion} style={formEnLinea}>
                                <input type="hidden" name="slug" value={obra.slug} />
                                <input type="hidden" name="presentacion_id" value={s.id} />
                                <button
                                  type="submit"
                                  style={botonDeRenglon}
                                  title="Quitar"
                                  aria-label={`Quitar ${s.nombre} de ${s.contenido} ${s.unidad}`}
                                >
                                  ×
                                </button>
                              </form>
                            ) : (
                              <span />
                            )}
                          </span>
                        ))}

                        {/* Otra forma de venderlo. */}
                        <form action={agregarPresentacion} style={{ display: "contents" }}>
                          <input type="hidden" name="slug" value={obra.slug} />
                          <input type="hidden" name="material_id" value={m.id} />
                          <input
                            type="text"
                            name="nombre"
                            placeholder={m.unidad === "un" ? "pallet" : m.unidad}
                            aria-label="Forma de venta"
                            required
                            style={ui.input}
                          />
                          <input
                            type="number"
                            name="contenido"
                            min={0}
                            step="any"
                            placeholder="0"
                            aria-label="Cantidad"
                            required
                            style={{ ...ui.input, textAlign: "right" }}
                          />
                          <select
                            name="unidad"
                            defaultValue={unidadesDePresentacion[0]}
                            aria-label="Unidad"
                            style={ui.input}
                          >
                            {unidadesDePresentacion.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                          <button type="submit" style={botonDeRenglon} title="Agregar otra forma de venta">
                            +
                          </button>
                        </form>
                      </div>

                      {/* Borrar, sólo el que no está en ninguna compra. */}
                      <div style={pieMaterial}>
                        {esAdmin && veces === 0 ? (
                          <form action={eliminarMaterial} style={formEnLinea}>
                            <input type="hidden" name="slug" value={obra.slug} />
                            <input type="hidden" name="material_id" value={m.id} />
                            <button type="submit" style={botonBorrar}>
                              Eliminar material
                            </button>
                          </form>
                        ) : (
                          <span style={ui.note}>
                            {veces > 0 ? `En ${veces} ${veces === 1 ? "compra" : "compras"}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </AppShell>
  );
}

/** Un material: una línea cerrada, su ficha abierta. */
const material = {
  border: ui.BORDE,
  borderRadius: "12px",
  background: "#ffffff",
};

const resumenMaterial = { cursor: "pointer", padding: "12px 16px" };

const lineaResumen = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: "12px",
  flexWrap: "wrap" as const,
};

const nombreMaterial = { fontSize: "14px", fontWeight: 600 };

const formasResumen = { fontSize: "13px", color: "#8a8a8a" };

const cuerpoMaterial = {
  display: "grid",
  gap: "16px",
  padding: "4px 16px 16px",
};

// Las mismas columnas en las dos partes: lo que se escribe a la izquierda, el
// botón de 96 px a la derecha. Arriba, el rubro ocupa cantidad y unidad.
const filaMaterial = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 1fr) 240px 96px",
  gap: "10px",
  alignItems: "center",
};

const tablaDeVenta = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 1fr) 115px 115px 96px",
  gap: "8px 10px",
  alignItems: "center",
};

const tituloDeColumna = {
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#8a8a8a",
};

const valorFijo = { fontSize: "14px", padding: "0 13px" };

const botonGuardar = { ...ui.secondaryButton, width: "96px", textAlign: "center" as const };

/** El + y el × de cada renglón: la misma forma y el mismo ancho que Guardar. */
const botonDeRenglon = { ...botonGuardar, fontSize: "17px", lineHeight: "21px" };

const pieMaterial = { display: "flex", justifyContent: "flex-end" };

const acordeones = {
  display: "grid",
  gap: "12px",
};

const resumen = {
  cursor: "pointer",
};

// El contenido va en un span aparte: darle display al summary borra el
// triangulito nativo, que es la señal de que el bloque se abre.
const contenidoResumen = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: "14px",
  width: "calc(100% - 28px)",
  verticalAlign: "middle" as const,
};

const tituloRubro = {
  fontSize: "18px",
};

const formAlta = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "12px",
  alignItems: "flex-end",
};

const campo = {
  display: "grid",
  gap: "8px",
  flex: "1 1 200px",
};

const etiqueta = {
  fontSize: "13px",
  color: "#555555",
};

const filas = {
  display: "grid",
  gap: "12px",
};

const botonBorrar = {
  ...ui.secondaryButton,
  color: "#b91c1c",
  borderColor: "#e5c2c2",
};

const errorBox = {
  border: "1px solid #b91c1c",
  color: "#b91c1c",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const okBox = {
  border: "1px solid #15803d",
  color: "#15803d",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const avisoBox = {
  border: "1px solid #e5e5e5",
  color: "#555555",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const formEnLinea = {
  display: "inline",
  margin: 0,
};

// El número y su unidad, en línea: "trae 30 kg" se lee de una.
const parEnvase = {
  display: "flex",
  gap: "6px",
};
