import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import {
  avanceGeneral,
  getAvancePorRubro,
  getUltimaActividad,
} from "@/lib/avances";
import { formatDate } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { calcularPlazo, leerDesvio } from "@/lib/plazo";

export default async function EstadoDeObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const [rubros, ultima] = await Promise.all([
    getAvancePorRubro(obra.id),
    getUltimaActividad(obra.id),
  ]);

  const avance = avanceGeneral(rubros);

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const plazo = calcularPlazo(
    obra.fecha_inicio,
    obra.fecha_fin_estimada,
    avance,
    hoy
  );

  const desvio = leerDesvio(plazo.desvio);
  const enEjecucion = rubros.filter((r) => r.estado === "En ejecución").length;
  const finalizados = rubros.filter((r) => r.estado === "Finalizado").length;
  const sinIniciar = rubros.filter((r) => r.estado === "Sin iniciar").length;
  const ponderado = rubros.some((r) => r.peso > 0);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="estado" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Estado general</p>
        <h2 style={ui.pageTitle}>Cómo va la obra</h2>
        <p style={ui.subtitle}>
          El avance físico contra el calendario, que es lo que dice si la obra
          va bien o va tarde.
        </p>
      </section>

      {/* --- Avance contra tiempo, que es la lectura que importa ----------- */}

      <section style={ui.panel}>
        <div style={dosColumnas}>
          <div>
            <p style={ui.label}>Avance físico</p>
            <strong style={numeroGrande}>{avance}%</strong>
            <div style={{ ...ui.progressBackground, marginTop: "12px" }}>
              <div
                style={{ ...ui.progressFill, width: `${Math.min(avance, 100)}%` }}
              />
            </div>
            <p style={pieBarra}>
              {ponderado
                ? "Cada rubro pesa su cotización aprobada."
                : "Promedio simple: todavía no hay cotizaciones aprobadas."}
            </p>
          </div>

          <div>
            <p style={ui.label}>Tiempo consumido</p>
            <strong style={numeroGrande}>
              {plazo.consumido === null ? "—" : `${plazo.consumido}%`}
            </strong>
            <div style={{ ...ui.progressBackground, marginTop: "12px" }}>
              <div
                style={{
                  ...ui.progressFill,
                  width: `${Math.min(plazo.consumido ?? 0, 100)}%`,
                }}
              />
            </div>
            <p style={pieBarra}>
              {plazo.totales === null
                ? "Falta cargar fecha de inicio o de fin estimada."
                : `${plazo.totales} días de plazo previsto.`}
            </p>
          </div>
        </div>

        {desvio && (
          <p
            style={{
              ...lecturaDesvio,
              ...(plazo.desvio !== null && plazo.desvio < -5
                ? lecturaMala
                : undefined),
            }}
          >
            {desvio}
          </p>
        )}
      </section>

      {/* --- Las fechas --------------------------------------------------- */}

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Inicio</p>
          <h3 style={statTexto}>
            {obra.fecha_inicio ? formatDate(obra.fecha_inicio) : "Sin cargar"}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Fin estimado</p>
          <h3 style={statTexto}>
            {obra.fecha_fin_estimada
              ? formatDate(obra.fecha_fin_estimada)
              : "Sin cargar"}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>
            {plazo.porArrancar ? "Arranca en" : "Lleva en obra"}
          </p>
          <h3 style={statTexto}>
            {plazo.transcurridos === null
              ? "—"
              : `${Math.abs(plazo.transcurridos)} días`}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>{plazo.vencida ? "Pasada por" : "Quedan"}</p>
          <h3 style={plazo.vencida ? { ...statTexto, ...textoAlerta } : statTexto}>
            {plazo.restantes === null
              ? "—"
              : `${Math.abs(plazo.restantes)} días`}
          </h3>
        </div>
      </section>

      {/* --- Los rubros ---------------------------------------------------- */}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Rubros</h3>
        <Link href={`/obras/${obra.slug}/avances`} style={enlace}>
          Ver avances
        </Link>
      </div>

      <section style={ui.panel}>
        {rubros.length === 0 ? (
          <p style={ui.vacio}>
            Esta obra no tiene rubros elegidos. Marcalos en{" "}
            <Link href={`/obras/${obra.slug}/rubros`} style={enlace}>
              Rubros
            </Link>
            .
          </p>
        ) : (
          <div style={tresColumnas}>
            <div>
              <p style={ui.label}>En ejecución</p>
              <strong style={numeroMedio}>{enEjecucion}</strong>
            </div>
            <div>
              <p style={ui.label}>Finalizados</p>
              <strong style={numeroMedio}>
                {finalizados} <span style={deTotal}>de {rubros.length}</span>
              </strong>
            </div>
            <div>
              <p style={ui.label}>Sin iniciar</p>
              <strong style={numeroMedio}>{sinIniciar}</strong>
            </div>
          </div>
        )}
      </section>

      {/* --- Lo último que pasó -------------------------------------------- */}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Última actividad</h3>
      </div>

      <section style={ui.panel}>
        {!ultima ? (
          <p style={ui.vacio}>
            Todavía no se cargó ningún avance. Entrá a un rubro desde{" "}
            <Link href={`/obras/${obra.slug}/avances`} style={enlace}>
              Avances
            </Link>{" "}
            para cargar el primero.
          </p>
        ) : (
          <>
            <div style={cabeceraActividad}>
              <div>
                <p style={ui.eyebrow}>{formatDate(ultima.fechaHasta)}</p>
                <h4 style={tituloActividad}>
                  <Link
                    href={`/obras/${obra.slug}/avances/${ultima.rubroId}`}
                    style={enlace}
                  >
                    {ultima.rubro}
                  </Link>
                </h4>
              </div>

              <strong style={numeroMedio}>+{ultima.porcentaje}%</strong>
            </div>

            <p style={{ ...ui.note, marginTop: "12px" }}>
              {ultima.comentario ?? "Sin detalle cargado."}
            </p>

            <p style={pieBarra}>Cargado por {ultima.cargadoPor ?? "—"}.</p>
          </>
        )}
      </section>
    </AppShell>
  );
}

const dosColumnas = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "32px",
};

const tresColumnas = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "24px",
};

const numeroGrande = {
  fontSize: "40px",
  fontWeight: 400,
};

const numeroMedio = {
  fontSize: "26px",
  fontWeight: 400,
};

const deTotal = {
  fontSize: "15px",
  color: "#777777",
};

const statTexto = {
  fontSize: "20px",
  fontWeight: 400,
  margin: "8px 0 0",
};

const textoAlerta = {
  color: "#b00020",
};

const pieBarra = {
  fontSize: "13px",
  color: "#999999",
  margin: "10px 0 0",
};

const lecturaDesvio = {
  marginTop: "28px",
  paddingTop: "20px",
  borderTop: "1px solid #eeeeee",
  fontSize: "16px",
};

const lecturaMala = {
  color: "#b00020",
};

const cabeceraActividad = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
};

const tituloActividad = {
  fontSize: "20px",
  fontWeight: 400,
  margin: "8px 0 0",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};
