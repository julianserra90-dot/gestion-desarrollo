import Link from "next/link";
import AppShell from "@/components/AppShell";
import AppSidebar from "@/components/AppSidebar";
import Volver from "@/components/Volver";
import * as ui from "@/components/ui";
import { formatM2 } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { crearReferencia } from "./actions";

/**
 * La base de edificios de referencia: lo que se construyó en CABA en lotes
 * como los que se estudian, con sus plantas publicadas. Se carga de a uno,
 * mirando las plantas, y los estudios la usan como comparables.
 */
export default async function ReferenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: edificios, error: errorConsulta } = await supabase
    .from("edificios_referencia")
    .select(
      "id, estudio, barrio, direccion, frente_m, fondo_m, esquina, frente_a_parque, superficie_lote_m2, unidades_funcionales, link, etiqueta, unidades_por_planta, plantas_sobre_pb, analizado_en"
    )
    .order("frente_m")
    .order("fondo_m");

  const cargados = (edificios ?? []).filter((e) => e.analizado_en).length;

  return (
    <AppShell sidebar={<AppSidebar activo="prefactibilidades" />}>
      <Volver href="/prefactibilidades">Prefactibilidades</Volver>

      <header style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Prefactibilidad</p>
        <h2 style={ui.pageTitle}>Edificios de referencia</h2>
        <p style={ui.subtitle}>
          {(edificios ?? []).length} edificios, {cargados} con la resolución cargada.
        </p>
      </header>

      {error && <p style={errorBox}>{error}</p>}
      {errorConsulta && <p style={errorBox}>{errorConsulta.message}</p>}

      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Agregar edificio</h3>
        <form action={crearReferencia} style={formAlta}>
          <input type="text" name="estudio" placeholder="Estudio" required style={ui.input} />
          <input type="text" name="barrio" placeholder="Barrio" style={ui.input} />
          <input type="text" name="direccion" placeholder="Dirección" required style={ui.input} />
          <input type="text" name="frente_m" placeholder="Frente (m)" inputMode="decimal" style={ui.input} />
          <input type="text" name="fondo_m" placeholder="Fondo (m)" inputMode="decimal" style={ui.input} />
          <input type="text" name="superficie_lote_m2" placeholder="Lote (m²)" inputMode="decimal" style={ui.input} />
          <input type="number" name="unidades_funcionales" placeholder="Unidades" min="0" style={ui.input} />
          <input type="url" name="link" placeholder="Enlace a las plantas" style={ui.input} />
          <button type="submit" style={ui.button}>
            Agregar
          </button>
        </form>
      </section>

      <section style={ui.panelConMargen}>
        <div style={{ overflowX: "auto" }}>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Edificio</th>
                <th style={ui.thRight}>Lote</th>
                <th style={ui.thRight}>Unidades</th>
                <th style={ui.th}>Resolución</th>
                <th style={ui.th}>Plantas</th>
              </tr>
            </thead>
            <tbody>
              {(edificios ?? []).map((e) => (
                <tr key={e.id}>
                  <td style={ui.td}>
                    <Link href={`/prefactibilidades/referencias/${e.id}`} style={enlace}>
                      {e.direccion}
                    </Link>
                    <div style={ui.note}>
                      {[e.barrio, e.estudio].filter(Boolean).join(" · ")}
                      {e.etiqueta === "NUEVO" && " · en obra"}
                    </div>
                  </td>
                  <td style={ui.tdRight}>
                    {e.frente_m !== null && e.fondo_m !== null
                      ? `${formatear(e.frente_m)} × ${formatear(e.fondo_m)} m`
                      : "—"}
                    {e.esquina && <div style={ui.note}>esquina</div>}
                    {e.frente_a_parque && <div style={ui.note}>frente a parque</div>}
                    {e.superficie_lote_m2 !== null && <div style={ui.note}>{formatM2(e.superficie_lote_m2)}</div>}
                  </td>
                  <td style={ui.tdRight}>{e.unidades_funcionales ?? "—"}</td>
                  <td style={ui.td}>
                    {e.analizado_en ? (
                      <>
                        {e.unidades_por_planta !== null && `${e.unidades_por_planta} por planta`}
                        {e.plantas_sobre_pb !== null && ` · PB + ${e.plantas_sobre_pb}`}
                      </>
                    ) : (
                      <span style={ui.note}>sin cargar</span>
                    )}
                  </td>
                  <td style={ui.td}>
                    {e.link ? (
                      <a href={e.link} target="_blank" rel="noreferrer" style={enlaceSuave}>
                        ver ↗
                      </a>
                    ) : (
                      <span style={ui.note}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function formatear(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

const formAlta = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "10px",
};

const enlace = {
  color: "#111111",
  fontWeight: 600,
  textDecoration: "none",
};

const enlaceSuave = {
  color: "#666666",
  textDecoration: "none",
  borderBottom: "1px solid #cccccc",
};

const errorBox = {
  border: "1px solid #111111",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
