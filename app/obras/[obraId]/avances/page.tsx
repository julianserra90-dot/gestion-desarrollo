import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();

  const [{ data: avances }, { data: registros }] = await Promise.all([
    supabase
      .from("avances")
      .select(
        "id, porcentaje, estado, comentario, fecha, actualizado_por_nombre, rubro_id, rubros(nombre, orden, activo)"
      )
      .eq("obra_id", obra.id),
    supabase
      .from("foto_registros")
      .select("rubro_id, fotos(count)")
      .eq("obra_id", obra.id),
  ]);

  // Sólo los rubros que la obra usa. Los desmarcados conservan su avance por
  // si se vuelven a marcar, pero no ensucian el seguimiento.
  const lista = (avances ?? [])
    .filter((a) => a.rubros?.activo)
    .sort((a, b) => (a.rubros?.orden ?? 0) - (b.rubros?.orden ?? 0));

  // Las fotos asociadas a un rubro son las de todos sus registros fotográficos.
  const fotosPorRubro = new Map<string, number>();
  for (const registro of registros ?? []) {
    if (!registro.rubro_id) continue;
    const cantidad = registro.fotos?.[0]?.count ?? 0;
    fotosPorRubro.set(
      registro.rubro_id,
      (fotosPorRubro.get(registro.rubro_id) ?? 0) + cantidad
    );
  }

  const avancePromedio =
    lista.length > 0
      ? Math.round(lista.reduce((acc, a) => acc + a.porcentaje, 0) / lista.length)
      : 0;

  const finalizados = lista.filter((a) => a.estado === "Finalizado").length;
  const activos = lista.filter(
    (a) => a.estado === "En ejecución" || a.estado === "Inicial"
  ).length;
  const totalFotos = [...fotosPorRubro.values()].reduce((a, b) => a + b, 0);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="avances" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Seguimiento de obra</p>
        <h2 style={ui.pageTitle}>Avances</h2>
        <p style={ui.subtitle}>
          Seguimiento físico por rubro, con comentarios técnicos y fotos
          asociadas.
        </p>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Avance general</p>
          <h3 style={ui.statNumber}>{avancePromedio}%</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Rubros finalizados</p>
          <h3 style={ui.statNumber}>{finalizados}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Rubros activos</p>
          <h3 style={ui.statNumber}>{activos}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Fotos asociadas</p>
          <h3 style={ui.statNumber}>{totalFotos}</h3>
        </div>
      </section>

      <section style={ui.panelConMargen}>
        <p style={ui.eyebrow}>Avance físico promedio</p>
        <h3 style={{ ...ui.pageTitle, marginTop: "8px" }}>
          {avancePromedio}% ejecutado
        </h3>
        <p style={ui.subtitle}>
          Surge del promedio de avance de los rubros cargados.
        </p>

        <div style={{ ...ui.progressBackground, marginTop: "20px" }}>
          <div style={{ ...ui.progressFill, width: `${avancePromedio}%` }} />
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Avance por rubro</h3>
      </div>

      {lista.length === 0 ? (
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
          {lista.map((avance) => (
            <article key={avance.id} style={ui.panel}>
              <div style={cabeceraAvance}>
                <div>
                  <p style={ui.eyebrow}>{avance.estado}</p>
                  <h3 style={tituloRubro}>{avance.rubros?.nombre ?? "Sin rubro"}</h3>
                </div>

                <strong style={porcentaje}>{avance.porcentaje}%</strong>
              </div>

              <div style={ui.progressBackground}>
                <div
                  style={{ ...ui.progressFill, width: `${avance.porcentaje}%` }}
                />
              </div>

              {avance.comentario && (
                <p style={{ ...ui.note, marginTop: "16px" }}>
                  {avance.comentario}
                </p>
              )}

              <div style={pieAvance}>
                <span>
                  {formatDate(avance.fecha)} · {avance.actualizado_por_nombre ?? "—"} ·{" "}
                  {fotosPorRubro.get(avance.rubro_id) ?? 0} fotos
                </span>

                <Link
                  href={`/obras/${obra.slug}/avances/${avance.id}/editar`}
                  style={ui.secondaryButton}
                >
                  Editar
                </Link>
              </div>
            </article>
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
