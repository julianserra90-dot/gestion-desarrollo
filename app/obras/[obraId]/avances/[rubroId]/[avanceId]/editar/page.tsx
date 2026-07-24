import AppShell from "@/components/AppShell";
import CargarAvanceForm from "@/components/CargarAvanceForm";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCargasDeRubro } from "@/lib/avances";
import { formatDate } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { actualizarAvance, eliminarAvance } from "../../../actions";

export default async function EditarAvancePage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; rubroId: string; avanceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, rubroId, avanceId } = await params;
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
  const carga = cargas.find((c) => c.id === avanceId);

  if (!carga) {
    return <AppShell>Avance no encontrado</AppShell>;
  }

  // Lo que lleva el rubro sin contar esta carga: es contra eso que se mide el
  // número nuevo mientras se edita.
  const total = cargas[0]?.acumulado ?? 0;
  const acumuladoPrevio = total - carga.porcentaje;

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="avances" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{rubro.nombre}</p>
        <h2 style={ui.pageTitle}>Editar avance</h2>
        <p style={ui.subtitle}>
          Carga del {formatDate(carga.fechaDesde)}
          {carga.fechaDesde === carga.fechaHasta
            ? ""
            : ` al ${formatDate(carga.fechaHasta)}`}
          . Cambiar el porcentaje recalcula el acumulado del rubro y el de todas
          las cargas posteriores.
        </p>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      <CargarAvanceForm
        action={actualizarAvance}
        obraId={obra.id}
        slug={obra.slug}
        rubroId={rubro.id}
        acumuladoPrevio={acumuladoPrevio}
        hoy={hoy}
        avance={{
          id: carga.id,
          porcentaje: carga.porcentaje,
          fechaDesde: carga.fechaDesde,
          fechaHasta: carga.fechaHasta,
          comentario: carga.comentario,
        }}
        textoBoton="Guardar cambios"
      />

      <section style={panelRiesgo}>
        <h3 style={ui.sectionTitle}>Dar de baja</h3>

        <p style={{ ...ui.text, marginBottom: "16px" }}>
          Se borra esta carga del historial y el rubro baja{" "}
          {carga.porcentaje}%, quedando en {acumuladoPrevio}%. El resto de las
          cargas no se toca.
        </p>

        <form action={eliminarAvance}>
          <input type="hidden" name="avance_id" value={carga.id} />
          <input type="hidden" name="rubro_id" value={rubro.id} />
          <input type="hidden" name="obra_id" value={obra.id} />
          <input type="hidden" name="slug" value={obra.slug} />
          <button type="submit" style={botonPeligro}>
            Eliminar definitivamente
          </button>
        </form>
      </section>
    </AppShell>
  );
}

const panelRiesgo = {
  border: "1px solid #111111",
  padding: "24px",
  marginTop: "32px",
};

const botonPeligro = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
