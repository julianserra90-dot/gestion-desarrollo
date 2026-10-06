import AppShell from "@/components/AppShell";
import BotonConfirmar from "@/components/BotonConfirmar";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import PresupuestosNav from "@/components/PresupuestosNav";
import * as ui from "@/components/ui";
import { getIndicesCac } from "@/lib/computo";
import { nombreMes } from "@/lib/meses";
import { getObraPorSlug } from "@/lib/obras";
import { eliminarIndiceCac, guardarIndiceCac } from "../actions";

/**
 * El índice CAC mes a mes. Es uno solo para todas las obras: se carga una vez
 * por mes, desde cualquier obra, y ajusta los cómputos de todas.
 */
export default async function IndiceCacPage({
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

  const indices = await getIndicesCac();
  // El más nuevo arriba: es el que se acaba de cargar o el que hay que mirar.
  const lista = [...indices].reverse();

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="presupuestos" />}
    >
      <ObraHeader obra={obra} activeSection="presupuestos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Índice CAC</h2>
      </section>

      <PresupuestosNav slug={obra.slug} activa="computo" />

      {error && <p style={errorBox}>{error}</p>}

      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Cargar un mes</h3>

        <form action={guardarIndiceCac} style={formulario}>
          <input type="hidden" name="slug" value={obra.slug} />

          <label style={campo}>
            <span style={ui.label}>Mes</span>
            <input type="month" name="mes" required style={ui.input} />
          </label>

          <label style={campo}>
            <span style={ui.label}>Índice general</span>
            <input
              type="number"
              name="valor"
              min={0}
              step="any"
              required
              placeholder="Ej: 15823,4"
              style={ui.input}
            />
          </label>

          <button type="submit" style={ui.button}>
            Guardar
          </button>
        </form>

        <p style={{ ...ui.note, marginBottom: 0 }}>
          Es el mismo para todas las obras. Si el mes ya estaba, se corrige.
        </p>
      </section>

      <section style={ui.panelConMargen}>
        {lista.length === 0 ? (
          <p style={ui.vacio}>
            Todavía no hay meses cargados. Sin índice, el cómputo se compara en
            pesos de cada fecha.
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Mes</th>
                <th style={ui.thRight}>Índice</th>
                <th style={ui.thRight}>Variación mensual</th>
                <th style={ui.th} />
              </tr>
            </thead>
            <tbody>
              {lista.map((i, n) => {
                const anterior = lista[n + 1];
                const variacion = anterior
                  ? ((i.valor - anterior.valor) / anterior.valor) * 100
                  : null;

                return (
                  <tr key={i.mes}>
                    <td style={ui.td}>{capitalizar(nombreMes(i.mes))}</td>
                    <td style={ui.tdRight}>
                      {i.valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                    </td>
                    <td style={ui.tdRight}>
                      {variacion === null
                        ? "—"
                        : `${variacion > 0 ? "+" : ""}${variacion.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`}
                    </td>
                    <td style={{ ...ui.td, textAlign: "right" }}>
                      <form action={eliminarIndiceCac.bind(null, `${i.mes}-01`)}>
                        <input type="hidden" name="slug" value={obra.slug} />
                        <BotonConfirmar
                          mensaje={`¿Borrar el índice de ${nombreMes(i.mes)}?`}
                          style={botonBorrar}
                        >
                          Borrar
                        </BotonConfirmar>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const formulario = {
  display: "grid",
  gridTemplateColumns: "200px 220px auto",
  gap: "16px",
  alignItems: "end",
};

const campo = {
  display: "grid",
  gap: "8px",
  alignContent: "start",
};

const botonBorrar = {
  background: "none",
  border: "none",
  color: "#777777",
  textDecoration: "underline",
  cursor: "pointer",
  fontSize: "13px",
};
