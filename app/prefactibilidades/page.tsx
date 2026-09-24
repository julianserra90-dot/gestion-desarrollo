import Link from "next/link";
import AppShell from "@/components/AppShell";
import AppSidebar from "@/components/AppSidebar";
import EstadoPrefactibilidad from "@/components/EstadoPrefactibilidad";
import * as ui from "@/components/ui";
import { formatM2, formatMoney, formatUSD } from "@/lib/format";
import { resumenLote } from "@/lib/prefactibilidad";
import { createClient } from "@/lib/supabase/server";

/**
 * Los terrenos en estudio, del más nuevo al más viejo. No tienen nada que ver
 * con las obras: son lotes que todavía se están evaluando, y la mayoría no
 * va a llegar a obra. Por eso viven en su propia pantalla y no en la grilla
 * de la portada.
 */
export default async function PrefactibilidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: estudios, error: errorConsulta } = await supabase
    .from("prefactibilidades")
    .select(
      "id, direccion, barrio, estado, tipo_desarrollo, ancho_m, profundidad_m, superficie_m2, valor_terreno, moneda_valor, unidad_edificabilidad, altura_maxima_m, plantas_sobre_pb, lfi_m, retiro_frente_m, sup_edificable_planta_m2, smp"
    )
    .order("creado_en", { ascending: false });

  return (
    <AppShell sidebar={<AppSidebar activo="prefactibilidades" />}>
      <header style={header}>
        <div>
          <p style={ui.eyebrow}>Gestión de desarrollo</p>
          <h2 style={ui.pageTitle}>Prefactibilidades</h2>
        </div>

        <Link href="/prefactibilidades/nueva" style={ui.button}>
          Nuevo estudio
        </Link>
      </header>

      {error && <p style={errorBox}>{error}</p>}
      {errorConsulta && <p style={errorBox}>{errorConsulta.message}</p>}

      <section style={ui.panel}>
        {(estudios ?? []).length === 0 ? (
          <p style={ui.vacio}>Todavía no hay terrenos en estudio.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Terreno</th>
                  <th style={ui.th}>Estado</th>
                  <th style={ui.thRight}>Frente × fondo</th>
                  <th style={ui.thRight}>Superficie</th>
                  <th style={ui.th}>Normativa</th>
                  <th style={ui.thRight}>Construible</th>
                  <th style={ui.thRight}>Valor</th>
                  <th style={ui.thRight}>Incidencia</th>
                </tr>
              </thead>
              <tbody>
                {(estudios ?? []).map((estudio) => {
                  const cuentas = resumenLote(estudio);
                  const enDolares = estudio.moneda_valor === "USD";
                  const formatValor = enDolares ? formatUSD : formatMoney;

                  return (
                    <tr key={estudio.id}>
                      <td style={ui.td}>
                        <Link
                          href={`/prefactibilidades/${estudio.id}`}
                          style={enlaceTerreno}
                        >
                          {estudio.direccion}
                        </Link>
                        {(estudio.barrio || estudio.smp) && (
                          <div style={ui.note}>
                            {[estudio.barrio, estudio.smp].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td style={ui.td}>
                        <EstadoPrefactibilidad valor={estudio.estado} />
                        {estudio.tipo_desarrollo &&
                          estudio.tipo_desarrollo !== "A definir" && (
                            <div style={ui.note}>{estudio.tipo_desarrollo}</div>
                          )}
                      </td>
                      <td style={ui.tdRight}>
                        {estudio.ancho_m && estudio.profundidad_m
                          ? `${formatMetros(estudio.ancho_m)} × ${formatMetros(estudio.profundidad_m)}`
                          : "—"}
                      </td>
                      <td style={ui.tdRight}>
                        {cuentas.superficieLote !== null
                          ? formatM2(cuentas.superficieLote)
                          : "—"}
                      </td>
                      <td style={ui.td}>
                        {estudio.unidad_edificabilidad ?? "—"}
                        {estudio.altura_maxima_m && (
                          <div style={ui.note}>
                            hasta {formatMetros(estudio.altura_maxima_m)} m
                            {estudio.plantas_sobre_pb !== null &&
                              ` · PB + ${estudio.plantas_sobre_pb}`}
                          </div>
                        )}
                      </td>
                      <td style={ui.tdRight}>
                        {cuentas.superficieConstruible !== null
                          ? formatM2(cuentas.superficieConstruible)
                          : "—"}
                      </td>
                      <td style={ui.tdRight}>
                        {estudio.valor_terreno !== null
                          ? formatValor(estudio.valor_terreno)
                          : "—"}
                      </td>
                      <td style={ui.tdRight}>
                        {/* Por metro construible cuando se puede, que es el
                            número que compara lotes; si todavía no hay
                            volumen, por metro de lote, y lo dice. */}
                        {cuentas.incidenciaConstruible !== null ? (
                          <>
                            {formatValor(cuentas.incidenciaConstruible)}
                            <div style={ui.note}>por m² construible</div>
                          </>
                        ) : cuentas.incidenciaLote !== null ? (
                          <>
                            {formatValor(cuentas.incidenciaLote)}
                            <div style={ui.note}>por m² de lote</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function formatMetros(valor: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(valor);
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #eeeeee",
  paddingBottom: "24px",
  marginBottom: "32px",
};

const errorBox = {
  border: "1px solid #111111",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const enlaceTerreno = {
  color: "#111111",
  fontWeight: 600,
  textDecoration: "none",
};
