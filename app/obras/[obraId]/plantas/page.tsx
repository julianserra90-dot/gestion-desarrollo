import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import BotonDefinirPisos from "@/components/BotonDefinirPisos";
import BotonPasarAlComputo from "@/components/BotonPasarAlComputo";
import EsquemaDeNiveles from "@/components/EsquemaDeNiveles";
import { formatM2, formatMetros, formatNivel, formatNiveles } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { medir } from "@/lib/planta-dibujo";
import { getPisos, getPlantas } from "@/lib/plantas";
import { guardarPisos, moverPlanta, pasarAlComputo, verPaseAlComputo } from "./actions";

export default async function PlantasPage({
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

  const [todas, pisosDeObra] = await Promise.all([getPlantas(obra.id), getPisos(obra.id)]);

  const plantas = todas.map((p) => ({
    ...p,
    // El nivel de piso terminado de cada piso que es esta planta.
    niveles: pisosDeObra.filter((piso) => piso.plantaId === p.id).map((piso) => piso.cota),
    medidas: medir(p.dibujo, p.escala, p.altura),
  }));

  // Los totales son del edificio: cada planta por los pisos que la repiten.
  // Una planta sin escala no mide y no suma; se cuenta aparte para que el
  // total no parezca el edificio entero cuando le falta un piso.
  const pisos = plantas.reduce((t, p) => t + p.repeticiones, 0);
  const sinEscala = plantas.filter((p) => p.medidas === null).length;
  // De dónde a dónde va el edificio, según la definición de pisos.
  const piso0 = pisosDeObra.length > 0 ? Math.min(...pisosDeObra.map((p) => p.cota)) : null;
  const techo = pisosDeObra.length > 0 ? Math.max(...pisosDeObra.map((p) => p.cota + p.altura)) : null;

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="plantas" />}
    >
      <ObraHeader obra={obra} activeSection="plantas" ocultarNav />

      <section style={cabeceraPagina}>
        <div>
          <p style={ui.eyebrow}>Medición sobre plano</p>
          <h2 style={ui.pageTitle}>Plantas y 3D</h2>
        </div>

        <div style={accionesDePagina}>
          <BotonDefinirPisos
            pisos={pisosDeObra}
            plantas={todas.map((p) => ({ id: p.id, nombre: p.nombre }))}
            guardar={guardarPisos.bind(null, obra.slug, obra.id)}
          />
          <Link href={`/obras/${obra.slug}/plantas/3d`} style={ui.secondaryButton}>
            Ver en 3D
          </Link>
          {/* Sin plantas no hay nada que pasar. */}
          {todas.length > 0 && (
            <BotonPasarAlComputo
              ver={verPaseAlComputo.bind(null, obra.id)}
              pasar={pasarAlComputo.bind(null, obra.slug, obra.id)}
              rutaDelComputo={`/obras/${obra.slug}/presupuestos/computo`}
            />
          )}
          <Link href={`/obras/${obra.slug}/plantas/nueva`} style={ui.button}>
            Nueva planta
          </Link>
        </div>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Plantas</p>
          <h3 style={ui.statNumber}>{plantas.length}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Pisos</p>
          <h3 style={ui.statNumber}>{pisos}</h3>
        </div>
        {/* Los niveles del edificio: el número y, al lado, el volumen en chiquito. */}
        <div style={tarjetaDeNiveles}>
          <div>
            <p style={ui.label}>Niveles</p>
            <h3 style={ui.statNumber}>
              {piso0 !== null && techo !== null ? `${formatNivel(piso0)} a ${formatNivel(techo)}` : "—"}
            </h3>
          </div>
          <EsquemaDeNiveles
            pisos={pisosDeObra}
            plantas={todas.map((p) => ({ id: p.id, nombre: p.nombre }))}
            rutaDePlantas={`/obras/${obra.slug}/plantas`}
          />
        </div>
      </section>

      <section style={{ ...ui.panelConMargen, overflowX: "auto" }}>
        {plantas.length === 0 ? (
          <p style={ui.vacio}>Todavía no hay plantas cargadas en esta obra.</p>
        ) : (
          <>
            <table style={tabla}>
              <colgroup>
                <col />
                <col style={{ width: "9%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "118px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={ui.th}>Planta</th>
                  <th style={ui.thRight}>Pisos</th>
                  <th style={ui.thRight}>Nivel</th>
                  <th style={ui.thRight}>Altura</th>
                  <th style={ui.thRight}>Superficie</th>
                  <th style={ui.th} />
                </tr>
              </thead>
              <tbody>
                {plantas.map((p, i) => (
                  <tr key={p.id}>
                    <td style={ui.td}>{p.nombre}</td>
                    <td style={ui.tdRight}>{p.repeticiones}</td>
                    {/* Sin piso asignado todavía no está en ningún nivel. */}
                    <td style={ui.tdRight}>{formatNiveles(p.niveles) ?? "—"}</td>
                    <td style={ui.tdRight}>{formatMetros(p.altura)}</td>
                    <td style={p.medidas ? ui.tdRight : sinEscalaCelda}>
                      {p.medidas ? formatM2(p.medidas.areaDeAmbientes) : "sin escala"}
                    </td>
                    <td style={{ ...ui.tdRight, padding: "6px 8px" }}>
                      <div style={accionesDeFila}>
                      {/* Subir y bajar en la lista: las fundaciones abajo, el
                          techo arriba. En las puntas, el lugar queda vacío para
                          que los botones sigan en columna. */}
                      {([true, false] as const).map((haciaArriba) =>
                        (haciaArriba ? i > 0 : i < plantas.length - 1) ? (
                          <form
                            key={String(haciaArriba)}
                            action={moverPlanta.bind(null, obra.slug, obra.id, p.id, haciaArriba)}
                          >
                            <button
                              type="submit"
                              style={botonRedondo}
                              title={haciaArriba ? "Subir" : "Bajar"}
                              aria-label={`${haciaArriba ? "Subir" : "Bajar"} ${p.nombre}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d={haciaArriba ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
                              </svg>
                            </button>
                          </form>
                        ) : (
                          <span key={String(haciaArriba)} style={lugarVacio} />
                        )
                      )}
                      <Link
                        href={`/obras/${obra.slug}/plantas/${p.id}`}
                        style={botonRedondo}
                        title="Ver"
                        aria-label={`Ver ${p.nombre}`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {sinEscala > 0 && (
              <p style={aviso}>
                {sinEscala === 1
                  ? "Una planta no tiene escala y no entra en los totales."
                  : `${sinEscala} plantas no tienen escala y no entran en los totales.`}
              </p>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}

const cabeceraPagina = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "28px",
};

const accionesDePagina = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const tabla = { ...ui.table, tableLayout: "fixed" as const, whiteSpace: "nowrap" as const };

/** Los botones de cada renglón: redondos, chicos, todos del mismo tamaño. */
const botonRedondo = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "34px",
  height: "34px",
  borderRadius: "999px",
  border: "1px solid #e2ded6",
  color: "#111111",
  background: "#ffffff",
};

const accionesDeFila = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "6px",
};

const lugarVacio = { width: "34px", height: "34px", flexShrink: 0 };

const tarjetaDeNiveles = {
  ...ui.statCard,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const sinEscalaCelda = {
  ...ui.tdRight,
  color: "#999999",
};

const aviso = {
  ...ui.note,
  marginTop: "16px",
  marginBottom: 0,
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
