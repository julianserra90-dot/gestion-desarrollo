import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import RetiroForm from "@/components/RetiroForm";
import * as ui from "@/components/ui";
import { getRetiro } from "@/lib/acopios";
import { getMaterialesCatalogo } from "@/lib/materiales";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { actualizarRetiro, eliminarRetiro } from "../../actions";

export default async function EditarRetiroPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; gastoId: string; retiroId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, gastoId, retiroId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: acopio }, materiales, retiro] = await Promise.all([
    supabase
      .from("gastos")
      .select("id, concepto, es_acopio, proveedores(nombre), rubros(nombre)")
      .eq("id", gastoId)
      .eq("obra_id", obra.id)
      .maybeSingle(),
    getMaterialesCatalogo(),
    getRetiro(gastoId, retiroId),
  ]);

  if (!acopio?.es_acopio || !retiro) {
    return <AppShell>Retiro no encontrado</AppShell>;
  }

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="gastos" />}
    >
      <ObraHeader obra={obra} activeSection="gastos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>
          Acopio · {acopio.concepto ?? acopio.proveedores?.nombre ?? "—"}
        </p>
        <h2 style={ui.pageTitle}>Editar retiro</h2>
      </section>

      <RetiroForm
        action={actualizarRetiro}
        slug={obra.slug}
        gastoId={acopio.id}
        rubroNombre={acopio.rubros?.nombre ?? ""}
        materiales={materiales}
        retiro={{ id: retiro.id, fecha: retiro.fecha, observaciones: retiro.observaciones }}
        itemsIniciales={retiro.items.map((i) => ({
          materialId: i.materialId,
          cantidad: String(i.cantidad),
          // Sólo el precio propio del retiro: el heredado del acopio no se
          // copia, para que siga siguiendo al acopio si aquél cambia.
          precio: "",
        }))}
        error={error}
        textoBoton="Guardar cambios"
      />

      <section style={panelRiesgo}>
        <h3 style={ui.sectionTitle}>Dar de baja</h3>
        <p style={{ ...ui.text, marginBottom: "16px" }}>
          Se borra el retiro con sus materiales. El acopio no se toca.
        </p>
        <form action={eliminarRetiro}>
          <input type="hidden" name="slug" value={obra.slug} />
          <input type="hidden" name="gasto_id" value={acopio.id} />
          <input type="hidden" name="retiro_id" value={retiro.id} />
          <button type="submit" style={botonPeligro}>
            Eliminar retiro
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
