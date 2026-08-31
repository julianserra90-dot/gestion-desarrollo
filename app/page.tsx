import Link from "next/link";
import { formatDate } from "@/lib/format";
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
    .select(
      "id, slug, nombre, ubicacion, domicilio, unidades_funcionales, pisos, estado, fecha_inicio, fecha_fin_estimada, imagen_drive_id"
    )
    .order("nombre");

  const [{ data: obras, error }, { data: resumenes }, { count: cantArchivadas }] =
    await Promise.all([
      viendoArchivadas
        ? consultaObras.not("archivada_en", "is", null)
        : consultaObras.is("archivada_en", null),
      supabase.from("obra_resumen").select("obra_id, avance_fisico"),
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

          // Sólo lo que está cargado: una fila con "—" ocupa el mismo lugar
          // que un dato y no dice nada. En el listado importa qué obra es,
          // no cuánto se gastó.
          const detalles = [
            obra.unidades_funcionales
              ? {
                  etiqueta:
                    obra.unidades_funcionales === 1
                      ? "Unidad funcional"
                      : "Unidades funcionales",
                  valor: String(obra.unidades_funcionales),
                }
              : null,
            obra.pisos !== null
              ? {
                  etiqueta: "Pisos",
                  valor: obra.pisos === 0 ? "Sólo PB" : `PB + ${obra.pisos}`,
                }
              : null,
            obra.fecha_inicio
              ? { etiqueta: "Inicio", valor: formatDate(obra.fecha_inicio) }
              : null,
            obra.fecha_fin_estimada
              ? {
                  etiqueta: "Fin estimado",
                  valor: formatDate(obra.fecha_fin_estimada),
                }
              : null,
          ].filter((d): d is { etiqueta: string; valor: string } => Boolean(d));

          return (
            <Link key={obra.id} href={`/obras/${obra.slug}`} style={obraCard}>
              {/* Siempre cuadrada, tenga o no imagen cargada: así las
                  tarjetas quedan de la misma altura entre sí y no saltan
                  cuando se le agrega una imagen a una obra que no tenía. */}
              {obra.imagen_drive_id ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/archivos/${obra.imagen_drive_id}`}
                  alt=""
                  loading="lazy"
                  style={obraImagen}
                />
              ) : (
                <div style={obraImagen} />
              )}

              <div style={obraContenido}>
                <div>
                  <p style={eyebrow}>{obra.estado}</p>
                  <h2 style={obraTitle}>{obra.nombre}</h2>
                  {obra.domicilio && (
                    <p style={obraAddress}>{obra.domicilio}</p>
                  )}
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
                  {detalles.map((d) => (
                    <div key={d.etiqueta} style={metaRow}>
                      <span>{d.etiqueta}</span>
                      <strong>{d.valor}</strong>
                    </div>
                  ))}
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

// Columnas que se acomodan solas según el ancho: con la imagen cuadrada
// (más alta que la 4:3 de antes), forzar siempre 3 columnas angostaba poco la
// tarjeta y la hacía demasiado alta. Achicando la columna mínima entran más
// por fila, la imagen cuadrada da más chica, y la tarjeta entera se ve sin
// scrollear.
const obraGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: "24px",
};

const obraCard = {
  border: "1px solid #e5e5e5",
  textDecoration: "none",
  color: "#111111",
  display: "flex",
  flexDirection: "column" as const,
  background: "#ffffff",
  overflow: "hidden" as const,
};

// object-fit: cover corta los bordes que sobran en vez de deformar la
// imagen; con la proporción fija (cuadrada) da igual el tamaño con que se
// subió.
const obraImagen = {
  width: "100%",
  aspectRatio: "1 / 1",
  objectFit: "cover" as const,
  display: "block",
  background: "#f2f2f2",
};

const obraContenido = {
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  flex: 1,
};

// Tres escalones de jerarquía: el nombre manda, el domicilio identifica, la
// localidad es el pie. Cada uno más chico y más claro que el anterior, para
// que el ojo los lea en ese orden sin pensarlo. Con la imagen arriba, la
// tarjeta entera ya ocupa bastante: el título achicado deja ver todo sin
// scroll.
const obraTitle = {
  fontSize: "20px",
  fontWeight: 400,
  margin: "8px 0 4px",
  lineHeight: 1.15,
};

const obraAddress = {
  color: "#333333",
  margin: 0,
  fontSize: "16px",
};

const obraLocation = {
  color: "#999999",
  margin: "3px 0 0",
  fontSize: "13px",
};

const progressBlock = {
  marginTop: "14px",
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
  marginTop: "14px",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "6px",
  marginTop: "6px",
  color: "#444444",
  fontSize: "14px",
};
