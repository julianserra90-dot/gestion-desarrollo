import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { avanceGeneral, getAvancePorRubro } from "@/lib/avances";
import { formatDate } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";

export default async function AvancesPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const rubros = await getAvancePorRubro(obra.id);
  const general = avanceGeneral(rubros);

  const enEjecucion = rubros.filter((r) => r.estado === "En ejecución").length;
  const finalizados = rubros.filter((r) => r.estado === "Finalizado").length;
  const sinIniciar = rubros.filter((r) => r.estado === "Sin iniciar").length;
  const ponderado = rubros.some((r) => r.peso > 0);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="avances" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Seguimiento de obra</p>
        <h2 style={ui.pageTitle}>Avances</h2>
        <p style={ui.subtitle}>
          Entrá a un rubro para cargar lo que se avanzó y ver su historial
          semana a semana.
        </p>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Avance general</p>
          <h3 style={ui.statNumber}>{general}%</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>En ejecución</p>
          <h3 style={ui.statNumber}>{enEjecucion}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Finalizados</p>
          <h3 style={ui.statNumber}>{finalizados}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Sin iniciar</p>
          <h3 style={ui.statNumber}>{sinIniciar}</h3>
        </div>
      </section>

      <section style={ui.panelConMargen}>
        <p style={ui.eyebrow}>Avance físico</p>
        <h3 style={{ ...ui.pageTitle, marginTop: "8px" }}>
          {general}% ejecutado
        </h3>
        <p style={ui.subtitle}>
          {ponderado
            ? "Cada rubro pesa lo que cuesta, según las cotizaciones aprobadas en Presupuestos."
            : "Promedio simple de los rubros: todavía no hay cotizaciones aprobadas con qué ponderar."}
        </p>

        <div style={{ ...ui.progressBackground, marginTop: "20px" }}>
          <div style={{ ...ui.progressFill, width: `${Math.min(general, 100)}%` }} />
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Avance por rubro</h3>
      </div>

      {rubros.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Esta obra no tiene rubros elegidos, así que no hay nada que seguir.
            Marcalos en la solapa{" "}
            <Link href={`/obras/${obra.slug}/rubros`} style={enlaceRubros}>
              Rubros
            </Link>
            .
          </p>
        </section>
      ) : (
        <section style={listaAvances}>
          {rubros.map((rubro) => (
            <Link
              key={rubro.rubroId}
              href={`/obras/${obra.slug}/avances/${rubro.rubroId}`}
              style={tarjetaRubro}
            >
              <div style={cabeceraAvance}>
                <div>
                  <p style={ui.eyebrow}>{rubro.estado}</p>
                  <h3 style={tituloRubro}>{rubro.nombre}</h3>
                </div>

                <strong style={porcentaje}>{rubro.acumulado}%</strong>
              </div>

              <div style={ui.progressBackground}>
                <div
                  style={{
                    ...ui.progressFill,
                    width: `${Math.min(rubro.acumulado, 100)}%`,
                  }}
                />
              </div>

              <div style={pieAvance}>
                <span>
                  {rubro.cantCargas === 0
                    ? "Sin cargas todavía"
                    : `${rubro.cantCargas} ${
                        rubro.cantCargas === 1 ? "carga" : "cargas"
                      } · última al ${formatDate(rubro.ultimaFecha!)}`}
                </span>

                <span style={verHistorial}>Ver historial</span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </AppShell>
  );
}

const listaAvances = {
  display: "grid",
  gap: "16px",
};

const tarjetaRubro = {
  ...ui.panel,
  display: "block",
  color: "inherit",
  textDecoration: "none",
};

const cabeceraAvance = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "16px",
};

const tituloRubro = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "8px 0 0",
};

const porcentaje = {
  fontSize: "26px",
  fontWeight: 400,
};

const enlaceRubros = {
  color: "#111111",
  textDecoration: "underline",
};

const verHistorial = {
  color: "#111111",
  textDecoration: "underline",
};

const pieAvance = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginTop: "20px",
  paddingTop: "16px",
  borderTop: "1px solid #eeeeee",
  color: "#777777",
  fontSize: "14px",
};
