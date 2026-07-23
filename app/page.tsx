import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "./login/actions";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ archivadas?: string }>;
}) {
  const { archivadas } = await searchParams;
  const viendoArchivadas = archivadas === "1";

  const supabase = await createClient();

  const consultaObras = supabase
    .from("obras")
    .select("id, slug, nombre, ubicacion, estado, fecha_inicio, fecha_fin_estimada")
    .order("nombre");

  const [{ data: obras, error }, { data: resumenes }, { count: cantArchivadas }] =
    await Promise.all([
      viendoArchivadas
        ? consultaObras.not("archivada_en", "is", null)
        : consultaObras.is("archivada_en", null),
      supabase.from("obra_resumen").select("obra_id, total_gastado, avance_fisico"),
      supabase
        .from("obras")
        .select("*", { count: "exact", head: true })
        .not("archivada_en", "is", null),
    ]);

  if (error) {
    return (
      <main style={page}>
        <p style={eyebrow}>Error</p>
        <h1 style={title}>No se pudieron cargar las obras</h1>
        <p style={subtitle}>{error.message}</p>
      </main>
    );
  }

  const resumenPorObra = new Map(
    (resumenes ?? []).map((item) => [item.obra_id, item])
  );

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <p style={eyebrow}>Gestión de desarrollo</p>
          <h1 style={title}>{viendoArchivadas ? "Obras archivadas" : "Obras"}</h1>
          <p style={subtitle}>
            {viendoArchivadas
              ? "Estas obras no aparecen en el listado principal. Entrá a una para desarchivarla."
              : "Seleccioná una obra para ingresar a su información."}
          </p>
        </div>

        <div style={headerActions}>
          <Link href="/empresas" style={secondaryLink}>
            Empresas
          </Link>

          <Link href="/usuarios" style={secondaryLink}>
            Usuarios
          </Link>

          <Link href="/perfil" style={secondaryLink}>
            Mi perfil
          </Link>

          <form action={cerrarSesion}>
            <button type="submit" style={secondaryButton}>
              Salir
            </button>
          </form>

          {viendoArchivadas ? (
            <Link href="/" style={buttonLink}>
              Ver obras activas
            </Link>
          ) : (
            <Link href="/obras/nueva" style={buttonLink}>
              Nueva obra
            </Link>
          )}
        </div>
      </header>

      {obras?.length === 0 && (
        <p style={subtitle}>
          {viendoArchivadas
            ? "No hay obras archivadas."
            : "Todavía no hay obras cargadas."}
        </p>
      )}

      <section style={obraGrid}>
        {obras?.map((obra) => {
          const resumen = resumenPorObra.get(obra.id);
          const avance = resumen?.avance_fisico ?? 0;

          return (
            <Link key={obra.id} href={`/obras/${obra.slug}`} style={obraCard}>
              <div>
                <p style={eyebrow}>{obra.estado}</p>
                <h2 style={obraTitle}>{obra.nombre}</h2>
                <p style={obraLocation}>{obra.ubicacion}</p>
              </div>

              <div style={progressBlock}>
                <div style={progressTop}>
                  <span>Avance</span>
                  <strong>{avance}%</strong>
                </div>

                <div style={progressBackground}>
                  <div
                    style={{
                      ...progressFill,
                      width: `${avance}%`,
                    }}
                  />
                </div>
              </div>

              <div style={meta}>
                <div style={metaRow}>
                  <span>Total gastado</span>
                  <strong>{formatMoney(resumen?.total_gastado)}</strong>
                </div>

                <div style={metaRow}>
                  <span>Inicio</span>
                  <strong>{formatDate(obra.fecha_inicio)}</strong>
                </div>

                <div style={metaRow}>
                  <span>Fin estimado</span>
                  <strong>{formatDate(obra.fecha_fin_estimada)}</strong>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {!viendoArchivadas && (cantArchivadas ?? 0) > 0 && (
        <p style={footerNota}>
          <Link href="/?archivadas=1" style={footerLink}>
            Ver {cantArchivadas} obra{cantArchivadas === 1 ? "" : "s"} archivada
            {cantArchivadas === 1 ? "" : "s"}
          </Link>
        </p>
      )}
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "#ffffff",
  color: "#111111",
  fontFamily: "Arial, Helvetica, sans-serif",
  padding: "56px",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #e5e5e5",
  paddingBottom: "32px",
  marginBottom: "40px",
};

const headerActions = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
};

const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

const title = {
  fontSize: "42px",
  fontWeight: 400,
  margin: "10px 0",
};

const subtitle = {
  color: "#666666",
  margin: 0,
  fontSize: "16px",
};

const buttonLink = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "12px 20px",
  fontSize: "14px",
  textDecoration: "none",
};

const footerNota = {
  marginTop: "40px",
  paddingTop: "24px",
  borderTop: "1px solid #eeeeee",
};

const footerLink = {
  color: "#666666",
  fontSize: "14px",
};

const secondaryButton = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "12px 20px",
  fontSize: "14px",
  cursor: "pointer",
};

const secondaryLink = {
  ...secondaryButton,
  textDecoration: "none",
  display: "inline-block",
};

const obraGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "24px",
};

const obraCard = {
  border: "1px solid #e5e5e5",
  padding: "28px",
  minHeight: "320px",
  textDecoration: "none",
  color: "#111111",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  background: "#ffffff",
};

const obraTitle = {
  fontSize: "26px",
  fontWeight: 400,
  margin: "14px 0 8px",
};

const obraLocation = {
  color: "#666666",
  margin: 0,
};

const progressBlock = {
  marginTop: "36px",
};

const progressTop = {
  display: "flex",
  justifyContent: "space-between",
  color: "#555555",
  fontSize: "14px",
  marginBottom: "10px",
};

const progressBackground = {
  height: "8px",
  background: "#eeeeee",
};

const progressFill = {
  height: "8px",
  background: "#111111",
};

const meta = {
  marginTop: "32px",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
  marginTop: "12px",
  color: "#444444",
  fontSize: "14px",
};
