import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { UNIDADES } from "@/lib/unidades";
import {
  actualizarMaterial,
  crearMaterial,
  eliminarMaterial,
} from "./actions";

/**
 * Qué material entró a la obra, rubro por rubro, y el catálogo de lo que se
 * compra.
 *
 * Vive en **Obra** y no en Economía porque no habla de plata sino de obra: los
 * $ 5.218.446 del corralón ya están en Gastos; lo que acá importa es que fueron
 * 2.500 ladrillos y 40 bolsas de cemento, y cuánto se lleva puesto en cada
 * rubro. El costo aparece como referencia, no como el número principal.
 *
 * El consumo se arma solo con el detalle que se carga en cada gasto: no hay
 * nada que cargar dos veces. El catálogo va abajo, que es lo que se toca una
 * vez y después queda quieto.
 */

type Consumo = {
  material: string;
  unidad: string;
  cantidad: number;
  costo: number;
  /** Cuántos items lo cargaron: dos compras del mismo ladrillo son dos. */
  compras: number;
};

export default async function MaterialesPage({
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

  const [
    { data: catalogo },
    { data: rubros },
    { data: items },
    { data: perfil },
  ] = await Promise.all([
    supabase
      .from("materiales")
      .select("id, nombre, unidad, rubro_id")
      .order("nombre"),
    supabase
      .from("rubros")
      .select("id, nombre")
      .is("obra_id", null)
      .order("orden"),
    // `!inner` para poder filtrar por la obra del gasto: sin eso traería el
    // detalle de todas las obras. Los anulados no entraron a la obra.
    supabase
      .from("gasto_materiales")
      .select(
        "cantidad, precio_unitario, materiales(nombre, unidad), gastos!inner(obra_id, estado, rubros(nombre))"
      )
      .eq("gastos.obra_id", obra.id)
      .neq("gastos.estado", "Anulado"),
    supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user?.id ?? "")
      .maybeSingle(),
  ]);

  const esAdmin = perfil?.rol === "admin";
  const lista = catalogo ?? [];
  const listaRubros = rubros ?? [];
  const nombreRubro = new Map(listaRubros.map((r) => [r.id, r.nombre]));

  // El catálogo agrupado por rubro, en el orden del catálogo de rubros —el de
  // la obra, no alfabético— y con los sueltos al final. Un rubro sin
  // materiales no aparece: sería un acordeón vacío.
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

  // Cuántas veces se usó cada material, para saber si se puede borrar del
  // catálogo. Cuenta todas las obras, igual que el borrado que hace la base.
  const { data: todosLosItems } = await supabase
    .from("gasto_materiales")
    .select("material_id");

  const usos = new Map<string, number>();
  for (const item of todosLosItems ?? []) {
    usos.set(item.material_id, (usos.get(item.material_id) ?? 0) + 1);
  }

  // El consumo, agrupado por rubro y dentro de cada uno por material. Las
  // cantidades se suman entre compras: tres compras de ladrillo son un solo
  // renglón con el total.
  const porRubro = new Map<string, Map<string, Consumo>>();

  for (const item of items ?? []) {
    const rubro = item.gastos?.rubros?.nombre ?? "Sin rubro";
    const material = item.materiales?.nombre ?? "—";
    const unidad = item.materiales?.unidad ?? "";
    const cantidad = Number(item.cantidad);
    const precio = item.precio_unitario === null ? null : Number(item.precio_unitario);

    const delRubro = porRubro.get(rubro) ?? new Map<string, Consumo>();
    const actual = delRubro.get(material) ?? {
      material,
      unidad,
      cantidad: 0,
      costo: 0,
      compras: 0,
    };

    delRubro.set(material, {
      ...actual,
      cantidad: actual.cantidad + cantidad,
      costo: actual.costo + (precio === null ? 0 : cantidad * precio),
      compras: actual.compras + 1,
    });

    porRubro.set(rubro, delRubro);
  }

  // El rubro con más plata en materiales primero: es donde se mira.
  const consumo = [...porRubro.entries()]
    .map(([rubro, materiales]) => {
      const filas = [...materiales.values()].sort(
        (a, b) => b.costo - a.costo || a.material.localeCompare(b.material)
      );

      return {
        rubro,
        filas,
        costo: filas.reduce((acc, f) => acc + f.costo, 0),
      };
    })
    .sort((a, b) => b.costo - a.costo || a.rubro.localeCompare(b.rubro));

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="materiales" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Materiales</h2>
      </section>

      {error && <p style={errorBox}>{error}</p>}
      {ok && <p style={okBox}>Listo, se guardó.</p>}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Lo que se usó, por rubro</h3>
      </div>

      {consumo.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Todavía no hay materiales cargados en ningún gasto. Se van sumando
            solos a medida que detallás las compras al cargar un gasto de
            materiales.
          </p>
        </section>
      ) : (
        <div style={acordeones}>
          {consumo.map((grupo) => (
            /* Acordeón por rubro, cerrado: con veinte materiales cargados la
               lista entera sería una pared. El encabezado dice lo que se viene
               a mirar de un vistazo. */
            <details key={grupo.rubro} style={ui.panel}>
              <summary style={resumen}>
                <span style={contenidoResumen}>
                  <span style={tituloRubro}>{grupo.rubro}</span>
                  <span style={ui.note}>
                    {grupo.filas.length}{" "}
                    {grupo.filas.length === 1 ? "material" : "materiales"}
                    {grupo.costo > 0 && ` · ${formatMoney(grupo.costo)}`}
                  </span>
                </span>
              </summary>

              <table style={{ ...ui.table, marginTop: "16px" }}>
                <thead>
                  <tr>
                    <th style={ui.th}>Material</th>
                    <th style={ui.thRight}>Cantidad</th>
                    <th style={ui.th}>Unidad</th>
                    <th style={ui.thRight}>Compras</th>
                    <th style={ui.thRight}>Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.filas.map((fila) => (
                    <tr key={fila.material}>
                      <td style={ui.td}>{fila.material}</td>
                      <td style={ui.tdRight}>
                        <strong>{formatCantidad(fila.cantidad)}</strong>
                      </td>
                      <td style={ui.td}>{fila.unidad}</td>
                      <td style={ui.tdRight}>{fila.compras}</td>
                      {/* Sin precio cargado no hay costo, y un cero se leería
                          como "salió gratis". */}
                      <td style={ui.tdRight}>
                        {fila.costo > 0 ? (
                          formatMoney(fila.costo)
                        ) : (
                          <span style={{ color: "#bbbbbb" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      )}

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

                return (
                  <div key={m.id} style={fila}>
                  <form action={actualizarMaterial} style={formEdicion}>
                    <input type="hidden" name="slug" value={obra.slug} />
                    <input type="hidden" name="material_id" value={m.id} />

                    <input
                      type="text"
                      name="nombre"
                      defaultValue={m.nombre}
                      aria-label="Material"
                      required
                      disabled={!esAdmin}
                      style={{ ...ui.input, flex: "1 1 240px" }}
                    />

                    <select
                      name="unidad"
                      defaultValue={m.unidad}
                      aria-label="Unidad"
                      disabled={!esAdmin}
                      style={{ ...ui.input, flex: "0 0 120px" }}
                    >
                      {/* Si la unidad guardada ya no está en la lista, se
                          ofrece igual: si no, editar el nombre la cambiaría
                          sin que nadie lo pida. */}
                      {!UNIDADES.some((u) => u === m.unidad) && (
                        <option value={m.unidad}>{m.unidad}</option>
                      )}
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>

                    <select
                      name="rubro_id"
                      defaultValue={m.rubro_id ?? ""}
                      aria-label="Rubro"
                      disabled={!esAdmin}
                      style={{ ...ui.input, flex: "1 1 180px" }}
                    >
                      <option value="">Sin rubro</option>
                      {/* Un rubro que ya no está en el catálogo no se pierde. */}
                      {m.rubro_id && !nombreRubro.has(m.rubro_id) && (
                        <option value={m.rubro_id}>Rubro anterior</option>
                      )}
                      {listaRubros.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>

                    {esAdmin && (
                      <button type="submit" style={ui.secondaryButton}>
                        Guardar
                      </button>
                    )}
                  </form>

                  {/* Sólo se puede borrar el que no está en ningún detalle: la
                      base lo rechaza igual, pero ofrecer un botón que va a
                      fallar es peor que no ofrecerlo. */}
                  {esAdmin && veces === 0 ? (
                    <form action={eliminarMaterial}>
                      <input type="hidden" name="slug" value={obra.slug} />
                      <input type="hidden" name="material_id" value={m.id} />
                      <button type="submit" style={botonBorrar}>
                        Eliminar
                      </button>
                    </form>
                    ) : (
                      <span style={ui.note}>
                        {veces === 0
                          ? "—"
                          : `En ${veces} ${veces === 1 ? "compra" : "compras"}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </AppShell>
  );
}

/**
 * Las cantidades no son plata: 2.500 ladrillos se escribe sin decimales, pero
 * 6,5 m³ de arena los necesita. Se muestran los que tenga, hasta tres.
 */
function formatCantidad(valor: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(valor);
}

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

const fila = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap" as const,
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
};

const formEdicion = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap" as const,
  alignItems: "center",
  flex: "1 1 480px",
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
