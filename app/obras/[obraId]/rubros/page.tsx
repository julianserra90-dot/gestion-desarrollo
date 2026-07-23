import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { crearRubro, eliminarRubro, renombrarRubro } from "./actions";

export default async function RubrosPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: rubros }, { data: gastos }, { data: avances }, { data: fotos }] =
    await Promise.all([
      supabase
        .from("rubros")
        .select("id, nombre, orden")
        .eq("obra_id", obra.id)
        .order("orden"),
      supabase.from("gastos").select("rubro_id").eq("obra_id", obra.id),
      supabase.from("avances").select("rubro_id").eq("obra_id", obra.id),
      supabase.from("foto_registros").select("rubro_id").eq("obra_id", obra.id),
    ]);

  // Cuántas veces se usa cada rubro, para saber si se puede borrar.
  const usos = new Map<string, { gastos: number; avances: number; fotos: number }>();
  const sumar = (id: string | null, campo: "gastos" | "avances" | "fotos") => {
    if (!id) return;
    const actual = usos.get(id) ?? { gastos: 0, avances: 0, fotos: 0 };
    actual[campo] += 1;
    usos.set(id, actual);
  };

  gastos?.forEach((g) => sumar(g.rubro_id, "gastos"));
  avances?.forEach((a) => sumar(a.rubro_id, "avances"));
  fotos?.forEach((f) => sumar(f.rubro_id, "fotos"));

  const lista = rubros ?? [];
  const siguienteOrden = Math.max(0, ...lista.map((r) => r.orden)) + 1;

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="rubros" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Configuración de obra</p>
        <h2 style={ui.pageTitle}>Rubros</h2>
        <p style={ui.subtitle}>
          Los rubros de esta obra. Se usan para clasificar gastos, avances y
          fotos. Cada obra tiene los suyos: cambiarlos acá no afecta a las demás.
        </p>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Agregar rubro</h3>

        <form action={crearRubro} style={formNuevo}>
          <input type="hidden" name="obra_id" value={obra.id} />
          <input type="hidden" name="slug" value={obra.slug} />

          <input
            type="text"
            name="nombre"
            placeholder="Nombre del rubro"
            required
            style={ui.input}
          />
          <input
            type="number"
            name="orden"
            defaultValue={siguienteOrden}
            title="Orden en que aparece en las listas"
            style={{ ...ui.input, width: "90px" }}
          />
          <button type="submit" style={ui.button}>
            Agregar
          </button>
        </form>
      </section>

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>
          Rubros de la obra <span style={contador}>({lista.length})</span>
        </h3>

        {lista.length === 0 ? (
          <p style={ui.vacio}>Esta obra todavía no tiene rubros cargados.</p>
        ) : (
          <div style={listaRubros}>
            {lista.map((rubro) => {
              const uso = usos.get(rubro.id);
              const total = uso ? uso.gastos + uso.avances + uso.fotos : 0;

              return (
                <div key={rubro.id} style={fila}>
                  <form action={renombrarRubro} style={formFila}>
                    <input type="hidden" name="rubro_id" value={rubro.id} />
                    <input type="hidden" name="slug" value={obra.slug} />

                    <input
                      type="number"
                      name="orden"
                      defaultValue={rubro.orden}
                      style={{ ...ui.input, width: "80px" }}
                    />
                    <input
                      type="text"
                      name="nombre"
                      defaultValue={rubro.nombre}
                      required
                      style={ui.input}
                    />
                    <button type="submit" style={ui.secondaryButton}>
                      Guardar
                    </button>
                  </form>

                  <div style={usoInfo}>
                    {total === 0 ? (
                      <span>Sin uso</span>
                    ) : (
                      <span>
                        {[
                          uso?.gastos ? `${uso.gastos} gastos` : null,
                          uso?.avances ? `${uso.avances} avances` : null,
                          uso?.fotos ? `${uso.fotos} registros de fotos` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}

                    {total === 0 ? (
                      <form action={eliminarRubro}>
                        <input type="hidden" name="rubro_id" value={rubro.id} />
                        <input type="hidden" name="slug" value={obra.slug} />
                        <button type="submit" style={ui.secondaryButton}>
                          Eliminar
                        </button>
                      </form>
                    ) : (
                      <span style={bloqueado}>En uso, no se puede eliminar</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const formNuevo = {
  display: "flex",
  gap: "12px",
  marginTop: "16px",
  maxWidth: "640px",
};

const listaRubros = {
  display: "grid",
  gap: "14px",
  marginTop: "20px",
};

const fila = {
  display: "grid",
  gap: "8px",
  borderTop: "1px solid #eeeeee",
  paddingTop: "14px",
};

const formFila = {
  display: "flex",
  gap: "12px",
  maxWidth: "640px",
};

const usoInfo = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  color: "#777777",
  fontSize: "13px",
};

const bloqueado = {
  color: "#999999",
};

const contador = {
  color: "#999999",
  fontSize: "15px",
};
