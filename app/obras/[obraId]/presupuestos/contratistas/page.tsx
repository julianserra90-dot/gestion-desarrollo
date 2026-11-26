import AppShell from "@/components/AppShell";
import FilaProveedor, {
  AltaProveedor,
  BotonEliminar,
  describirUso,
  fila,
  renglon,
  totalDeUso,
  usoTexto,
} from "@/components/FilaProveedor";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { getCatalogoDesdeObra } from "@/lib/proveedores";
import { TIPOS_DE_PROVEEDOR } from "@/lib/proveedores-tipos";
import { sumarProveedorAObra } from "./actions";

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

  const { catalogo: lista, rubros, deLaObra, uso, esAdmin } =
    await getCatalogoDesdeObra(obra.id);

  const volver = `/obras/${obra.slug}/presupuestos/contratistas`;

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="presupuestos" />}
    >
      <ObraHeader obra={obra} activeSection="presupuestos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Contratistas y proveedores</h2>
        <p style={ui.subtitle}>
          Los que trabajan <strong>en esta obra</strong>: son los que aparecen
          al cargar un gasto o una cotización. Uno de otra obra se suma desde
          abajo de todo.
        </p>
      </section>

      {error && <p style={errorBox}>{error}</p>}
      {ok && <p style={okBox}>Listo, se guardó.</p>}

      {!esAdmin && (
        <p style={avisoBox}>
          Podés agregar, sumar y sacar de esta obra, pero modificar y eliminar
          es cosa del administrador: el nombre y el teléfono son los mismos en
          todas las obras.
        </p>
      )}

      {/* El "volver" salió de acá: vive arriba del título, en el mismo lugar
          que en todas las pantallas de detalle. */}
      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Agregar</h3>
      </div>

      <section style={ui.panel}>
        <AltaProveedor obra={obra} rubros={rubros} volver={volver} />
      </section>

      {/* Acordeón nativo: `details` abre y cierra sin JavaScript, así la página
          sigue siendo un server component. Arranca abierto el grupo que se vino
          a mirar —contratistas— y el resto plegado, que es lo que hace que la
          lista se lea como una agenda y no como un muro. */}
      {TIPOS_DE_PROVEEDOR.map((grupo) => {
        const suyos = lista.filter(
          (p) => p.tipo === grupo.tipo && deLaObra.has(p.id)
        );

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
                Esta obra todavía no tiene ninguno.
              </p>
            ) : (
              <div style={filas}>
                {suyos.map((p) => (
                  <FilaProveedor
                    key={p.id}
                    proveedor={p}
                    obra={obra}
                    rubros={rubros}
                    uso={uso.get(p.id)}
                    esAdmin={esAdmin}
                    volver={volver}
                  />
                ))}
              </div>
            )}
          </details>
        );
      })}

      {/* Los del catálogo que esta obra no usa: los de las otras obras y los
          que nunca se usaron. Arranca plegado: se abre para sumar uno. */}
      {(() => {
        const ajenos = lista.filter((p) => !deLaObra.has(p.id));
        if (ajenos.length === 0) return null;

        return (
          <details style={acordeon}>
            <summary style={resumen}>
              <span style={contenidoResumen}>
                <span style={tituloGrupo}>De otras obras</span>
                <span style={ui.note}>
                  {ajenos.length} · Sumá a esta obra los que también trabajan
                  acá.
                </span>
              </span>
            </summary>

            <div style={filas}>
              {ajenos.map((p) => {
                const u = uso.get(p.id);

                return (
                  <div key={p.id} style={fila}>
                    <div style={renglon}>
                      <span>
                        {p.nombre} <span style={ui.note}>· {p.tipo}</span>
                      </span>

                      <form action={sumarProveedorAObra}>
                        <input type="hidden" name="slug" value={obra.slug} />
                        <input type="hidden" name="obra_id" value={obra.id} />
                        <input type="hidden" name="volver" value={volver} />
                        <input type="hidden" name="proveedor_id" value={p.id} />
                        <button type="submit" style={ui.secondaryButton}>
                          Sumar a esta obra
                        </button>
                      </form>

                      <BotonEliminar
                        obra={obra}
                        volver={volver}
                        proveedor={p}
                        enUso={totalDeUso(u) > 0}
                        esAdmin={esAdmin}
                      />
                    </div>

                    <p style={usoTexto}>{describirUso(u)}</p>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })()}
    </AppShell>
  );
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
