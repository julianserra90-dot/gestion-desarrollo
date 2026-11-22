import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { formatM2, formatMetros } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { medir } from "@/lib/planta-dibujo";
import { getPlantas } from "@/lib/plantas";

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

  const plantas = (await getPlantas(obra.id)).map((p) => ({
    ...p,
    medidas: medir(p.dibujo, p.escala, p.altura),
  }));

  // Los totales son del edificio: cada planta por los pisos que la repiten.
  // Una planta sin escala no mide y no suma; se cuenta aparte para que el
  // total no parezca el edificio entero cuando le falta un piso.
  const pisos = plantas.reduce((t, p) => t + p.repeticiones, 0);
  const sinEscala = plantas.filter((p) => p.medidas === null).length;
  const muros = plantas.reduce(
    (t, p) => t + (p.medidas?.largoDeMuros ?? 0) * p.repeticiones,
    0
  );
  const superficie = plantas.reduce(
    (t, p) => t + (p.medidas?.areaDeAmbientes ?? 0) * p.repeticiones,
    0
  );

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="plantas" />}
    >
      <ObraHeader obra={obra} activeSection="plantas" ocultarNav />

      <section style={cabeceraPagina}>
        <div>
          <p style={ui.eyebrow}>Medición sobre plano</p>
          <h2 style={ui.pageTitle}>Plantas</h2>
        </div>

        <Link href={`/obras/${obra.slug}/plantas/nueva`} style={ui.button}>
          Nueva planta
        </Link>
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
        <div style={ui.statCard}>
          <p style={ui.label}>Muros del edificio</p>
          <h3 style={ui.statNumber}>{formatMetros(muros)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Superficie de ambientes</p>
          <h3 style={ui.statNumber}>{formatM2(superficie)}</h3>
        </div>
      </section>

      <section style={ui.panelConMargen}>
        {plantas.length === 0 ? (
          <p style={ui.vacio}>Todavía no hay plantas cargadas en esta obra.</p>
        ) : (
          <>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Planta</th>
                  <th style={ui.thRight}>Pisos iguales</th>
                  <th style={ui.thRight}>Altura</th>
                  <th style={ui.thRight}>Muros</th>
                  <th style={ui.thRight}>Pared sin vanos</th>
                  <th style={ui.thRight}>Aberturas</th>
                  <th style={ui.thRight}>Ambientes</th>
                  <th style={ui.thRight}>Superficie</th>
                  <th style={ui.th} />
                </tr>
              </thead>
              <tbody>
                {plantas.map((p) => (
                  <tr key={p.id}>
                    <td style={ui.td}>{p.nombre}</td>
                    <td style={ui.tdRight}>{p.repeticiones}</td>
                    <td style={ui.tdRight}>{formatMetros(p.altura)}</td>
                    {p.medidas ? (
                      <>
                        <td style={ui.tdRight}>
                          {formatMetros(p.medidas.largoDeMuros)}
                        </td>
                        <td style={ui.tdRight}>
                          {formatM2(p.medidas.paredSinVanos)}
                        </td>
                        <td style={ui.tdRight}>{p.medidas.cantidadDeAberturas}</td>
                        <td style={ui.tdRight}>{p.medidas.ambientes.length}</td>
                        <td style={ui.tdRight}>
                          {formatM2(p.medidas.areaDeAmbientes)}
                        </td>
                      </>
                    ) : (
                      <td style={sinEscalaCelda} colSpan={5}>
                        Sin escala: todavía no mide
                      </td>
                    )}
                    <td style={ui.tdRight}>
                      <Link
                        href={`/obras/${obra.slug}/plantas/${p.id}`}
                        style={enlace}
                      >
                        Abrir
                      </Link>
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

const enlace = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
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
