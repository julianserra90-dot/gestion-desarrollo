import Link from "next/link";
import * as ui from "@/components/ui";
import { formatM2 } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/**
 * Los edificios de referencia con un lote parecido: mismo frente más o menos
 * un metro, fondo dentro de un tercio, sin esquinas. Con cuántas unidades
 * sacaron, y qué daría esa densidad en este lote. Es el contraste entre lo
 * que dicen las reglas y lo que se construyó; cuando la resolución está
 * cargada, también dice cómo lo resolvieron.
 */
export default async function Comparables({
  frente,
  fondo,
  superficie,
}: {
  frente: number;
  fondo: number;
  superficie: number;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edificios_referencia")
    .select(
      "id, estudio, barrio, direccion, frente_m, fondo_m, esquina, superficie_lote_m2, unidades_funcionales, link, unidades_por_planta, plantas_sobre_pb, nucleo, ingreso, patios, tipologias, analizado_en"
    );

  const TOLERANCIA_FRENTE = 1;
  const TOLERANCIA_FONDO = 0.35;
  const parecidos = (data ?? [])
    .filter((e) => e.frente_m !== null && e.fondo_m !== null && !e.esquina)
    .map((e) => ({
      ...e,
      distancia:
        Math.abs((e.frente_m ?? 0) - frente) / TOLERANCIA_FRENTE +
        Math.abs((e.fondo_m ?? 0) - fondo) / (TOLERANCIA_FONDO * fondo),
    }))
    .filter((e) => e.distancia <= 2)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 8);

  const estimaciones = parecidos
    .filter((e) => e.unidades_funcionales && e.superficie_lote_m2)
    .map((e) => ((e.unidades_funcionales ?? 0) / (e.superficie_lote_m2 ?? 1)) * superficie)
    .sort((a, b) => a - b);
  const mediana =
    estimaciones.length > 0 ? estimaciones[Math.floor(estimaciones.length / 2)] : null;

  return (
    <section style={ui.panelConMargen}>
      <h3 style={ui.sectionTitle}>Edificios comparables</h3>

      {parecidos.length === 0 ? (
        <p style={ui.vacio}>
          Ningún edificio de referencia con un lote parecido: frente a un metro y fondo a un
          tercio.
        </p>
      ) : (
        <>
          {mediana !== null && (
            <p style={resumen}>
              Con la densidad de estos edificios, este lote sacaría entre{" "}
              <strong>{Math.round(estimaciones[0])}</strong> y{" "}
              <strong>{Math.round(estimaciones[estimaciones.length - 1])}</strong> unidades;
              la mediana da <strong>{Math.round(mediana)}</strong>.
            </p>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Edificio</th>
                  <th style={ui.thRight}>Lote</th>
                  <th style={ui.thRight}>Unidades</th>
                  <th style={ui.thRight}>Para este lote</th>
                  <th style={ui.th}>Resolución</th>
                </tr>
              </thead>
              <tbody>
                {parecidos.map((e) => {
                  const densidad =
                    e.unidades_funcionales && e.superficie_lote_m2
                      ? (e.unidades_funcionales / e.superficie_lote_m2) * superficie
                      : null;
                  return (
                    <tr key={e.id}>
                      <td style={ui.td}>
                        <Link href={`/prefactibilidades/referencias/${e.id}`} style={enlace}>
                          {e.direccion}
                        </Link>
                        <div style={ui.note}>
                          {[e.barrio, e.estudio].filter(Boolean).join(" · ")}
                          {e.link && (
                            <>
                              {" · "}
                              <a href={e.link} target="_blank" rel="noreferrer" style={enlaceSuave}>
                                plantas ↗
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={ui.tdRight}>
                        {formatear(e.frente_m ?? 0)} × {formatear(e.fondo_m ?? 0)} m
                        {e.superficie_lote_m2 && <div style={ui.note}>{formatM2(e.superficie_lote_m2)}</div>}
                      </td>
                      <td style={ui.tdRight}>{e.unidades_funcionales ?? "—"}</td>
                      <td style={ui.tdRight}>{densidad !== null ? Math.round(densidad) : "—"}</td>
                      <td style={ui.td}>
                        {e.analizado_en ? (
                          <>
                            {e.unidades_por_planta !== null && `${e.unidades_por_planta} por planta`}
                            {e.plantas_sobre_pb !== null && ` · PB + ${e.plantas_sobre_pb}`}
                            {e.nucleo && <div style={ui.note}>Núcleo: {e.nucleo}</div>}
                            {e.ingreso && <div style={ui.note}>Ingreso: {e.ingreso}</div>}
                            {e.patios && <div style={ui.note}>Patios: {e.patios}</div>}
                            {e.tipologias && <div style={ui.note}>Unidades: {e.tipologias}</div>}
                          </>
                        ) : (
                          <span style={ui.note}>sin cargar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
        La base son edificios construidos en CABA con sus plantas publicadas;{" "}
        <Link href="/prefactibilidades/referencias" style={enlaceSuave}>
          se carga desde acá
        </Link>
        . La densidad compara unidades por metro de lote, que depende del producto: los
        mismos metros dan seis unidades grandes o diecisiete chicas.
      </p>
    </section>
  );
}

function formatear(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

const resumen = {
  ...ui.text,
  margin: "0 0 16px",
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
