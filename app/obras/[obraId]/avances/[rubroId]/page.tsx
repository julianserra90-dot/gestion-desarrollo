import Link from "next/link";
import AppShell from "@/components/AppShell";
import CargarAvanceForm from "@/components/CargarAvanceForm";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCargasDeRubro } from "@/lib/avances";
import { estadoDe } from "@/lib/estado-avance";
import { formatDate } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { cargarAvance } from "../actions";

export default async function AvanceDeRubroPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; rubroId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, rubroId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const { data: rubro } = await supabase
    .from("rubros")
    .select("id, nombre")
    .eq("id", rubroId)
    .eq("obra_id", obra.id)
    .maybeSingle();

  if (!rubro) {
    return <AppShell>Rubro no encontrado</AppShell>;
  }

  const cargas = await getCargasDeRubro(obra.id, rubro.id);

  // Las cargas vienen de la más nueva a la más vieja, así que el acumulado
  // total es el de la primera.
  const acumulado = cargas[0]?.acumulado ?? 0;

  // La fecha de hoy en la zona de la obra: el servidor puede estar en UTC y
  // dar el día de mañana a la noche.
  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="avances" />

      <section style={cabecera}>
        <div>
          <p style={ui.eyebrow}>{estadoDe(acumulado)}</p>
          <h2 style={ui.pageTitle}>{rubro.nombre}</h2>
          <p style={ui.subtitle}>
            {cargas.length === 0
              ? "Todavía no se cargó ningún avance de este rubro."
              : `${cargas.length} ${
                  cargas.length === 1 ? "carga" : "cargas"
                } desde el ${formatDate(cargas[cargas.length - 1].fechaDesde)}.`}
          </p>
        </div>

        <div style={acumuladoCaja}>
          <p style={ui.label}>Acumulado</p>
          <strong style={numeroGrande}>{acumulado}%</strong>
        </div>
      </section>

      <div style={ui.progressBackground}>
        <div
          style={{ ...ui.progressFill, width: `${Math.min(acumulado, 100)}%` }}
        />
      </div>

      {error && <p style={errorBox}>{error}</p>}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Cargar avance</h3>
      </div>

      <CargarAvanceForm
        action={cargarAvance}
        obraId={obra.id}
        slug={obra.slug}
        rubroId={rubro.id}
        acumuladoPrevio={acumulado}
        hoy={hoy}
      />

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Historial</h3>
      </div>

      <section style={ui.panel}>
        {cargas.length === 0 ? (
          <p style={ui.vacio}>
            Cuando cargues el primer avance va a aparecer acá, con el detalle de
            qué se hizo en esos días.
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Período</th>
                <th style={ui.th}>Avance</th>
                <th style={ui.th}>Acumulado</th>
                <th style={ui.th}>Qué se hizo</th>
                <th style={ui.th}>Cargado por</th>
                <th style={ui.th} />
              </tr>
            </thead>
            <tbody>
              {cargas.map((carga) => (
                <tr key={carga.id}>
                  <td style={ui.td}>
                    {carga.fechaDesde === carga.fechaHasta
                      ? formatDate(carga.fechaDesde)
                      : `${formatDate(carga.fechaDesde)} al ${formatDate(carga.fechaHasta)}`}
                  </td>
                  <td style={ui.td}>+{carga.porcentaje}%</td>
                  <td style={ui.td}>{carga.acumulado}%</td>
                  <td style={ui.td}>{carga.comentario ?? "—"}</td>
                  <td style={ui.td}>{carga.cargadoPor ?? "—"}</td>
                  <td style={ui.td}>
                    <Link
                      href={`/obras/${obra.slug}/avances/${rubro.id}/${carga.id}/editar`}
                      style={editarLink}
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p style={volver}>
        <Link href={`/obras/${obra.slug}/avances`} style={editarLink}>
          Volver a todos los rubros
        </Link>
      </p>
    </AppShell>
  );
}

const cabecera = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "20px",
};

const acumuladoCaja = {
  textAlign: "right" as const,
};

const numeroGrande = {
  fontSize: "34px",
  fontWeight: 400,
};

const editarLink = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
};

const volver = {
  marginTop: "24px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginTop: "20px",
  fontSize: "14px",
};
