import Link from "next/link";
import AppShell from "@/components/AppShell";
import GaleriaFotos from "@/components/GaleriaFotos";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

export default async function FotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ rubro?: string }>;
}) {
  const { obraId } = await params;
  const { rubro } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();
  const { data: registros } = await supabase
    .from("foto_registros")
    .select(
      "id, fecha, descripcion, estado, subido_por_nombre, rubro_id, rubros(nombre), fotos(id, drive_file_id, nombre)"
    )
    .eq("obra_id", obra.id)
    .order("fecha", { ascending: false });

  const lista = (registros ?? []).map((r) => ({
    ...r,
    imagenes: (r.fotos ?? []).filter((f) => f.drive_file_id),
    cantidad: (r.fotos ?? []).length,
    rubroNombre: r.rubros?.nombre ?? "Sin rubro",
  }));

  const rubros = Array.from(new Set(lista.map((r) => r.rubroNombre))).sort();
  const filtrados = rubro ? lista.filter((r) => r.rubroNombre === rubro) : lista;

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="fotos" />

      <section style={cabeceraPagina}>
        <div>
          <p style={ui.eyebrow}>Registro visual</p>
          <h2 style={ui.pageTitle}>Fotos de obra</h2>
        </div>

        <Link href={`/obras/${obra.slug}/fotos/nuevo`} style={ui.button}>
          Subir fotos
        </Link>
      </section>

      {/* Sin tarjetas de conteo: cuántos registros o cuántas fotos hay no le
          sirve a nadie, y cada acordeón ya dice lo suyo ("2 fotos · 2 cargas"). */}
      {rubros.length > 0 && (
        <section style={filtros}>
          <Link
            href={`/obras/${obra.slug}/fotos`}
            style={!rubro ? filtroActivo : filtro}
          >
            Todos <span style={contador}>{lista.length}</span>
          </Link>

          {rubros.map((nombre) => (
            <Link
              key={nombre}
              href={`/obras/${obra.slug}/fotos?rubro=${encodeURIComponent(nombre)}`}
              style={rubro === nombre ? filtroActivo : filtro}
            >
              {nombre}{" "}
              <span style={contador}>
                {lista.filter((r) => r.rubroNombre === nombre).length}
              </span>
            </Link>
          ))}
        </section>
      )}

      <section style={{ marginTop: "32px" }}>
        {filtrados.length === 0 ? (
          <div style={ui.panel}>
            <p style={ui.vacio}>
              {lista.length === 0
                ? "Todavía no hay fotos cargadas en esta obra."
                : "No hay registros para este rubro."}
            </p>
          </div>
        ) : (
          <GaleriaFotos
            registros={filtrados.map((registro) => ({
              id: registro.id,
              rubroNombre: registro.rubroNombre,
              descripcion: registro.descripcion,
              fecha: registro.fecha,
              estado: registro.estado,
              subidoPor: registro.subido_por_nombre,
              fotos: registro.imagenes.map((imagen) => ({
                id: imagen.id,
                driveFileId: imagen.drive_file_id as string,
              })),
            }))}
          />
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

const filtros = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px",
  marginTop: "32px",
};

const filtro = {
  color: "#111111",
  textDecoration: "none",
  border: "1px solid #e5e5e5",
  padding: "10px 14px",
  fontSize: "14px",
  background: "#ffffff",
};

const filtroActivo = {
  ...filtro,
  color: "#ffffff",
  border: "1px solid #111111",
  background: "#111111",
};

const contador = {
  color: "inherit",
  opacity: 0.6,
  marginLeft: "4px",
};
