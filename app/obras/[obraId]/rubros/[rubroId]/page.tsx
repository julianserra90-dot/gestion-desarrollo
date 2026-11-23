import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import TareasDelRubro, { type TareaDelRubro } from "@/components/TareasDelRubro";
import * as ui from "@/components/ui";
import { getMaterialesCatalogo } from "@/lib/materiales";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import {
  crearTareaDelCatalogo,
  editarTareaDelCatalogo,
  eliminarTareaDelCatalogo,
  guardarModeloDeTarea,
  leerModeloDeTarea,
} from "../../presupuestos/computo/actions";

/**
 * Las tareas de un rubro: dónde se configura el catálogo de tareas.
 *
 * Se entra desde los Rubros de la obra, pero el catálogo es **común a todas
 * las obras** (decidido con el usuario el 23/11/2026): una composición que se
 * mejora acá le sirve a la obra siguiente. Por eso la pantalla lo dice arriba.
 *
 * Las tareas del catálogo nombran su rubro por texto, no por id: cada obra
 * tiene su copia de los rubros y el catálogo es uno. Se las busca por el
 * nombre del rubro sin mirar mayúsculas, igual que al tildar una tarea.
 */
export default async function TareasDelRubroPage({
  params,
}: {
  params: Promise<{ obraId: string; rubroId: string }>;
}) {
  const { obraId, rubroId } = await params;
  const obra = await getObraPorSlug(obraId);
  if (!obra) return <AppShell>Obra no encontrada</AppShell>;

  const supabase = await createClient();
  const { data: rubro } = await supabase
    .from("rubros")
    .select("id, nombre")
    .eq("id", rubroId)
    .eq("obra_id", obra.id)
    .maybeSingle();
  if (!rubro) return <AppShell>Rubro no encontrado</AppShell>;

  // El nombre va en un ilike: sin escapar, un "_" del nombre valdría por
  // cualquier letra.
  const patron = rubro.nombre.replace(/[\\%_]/g, (c) => `\\${c}`);
  const [{ data: tareas, error }, { data: enObra }, materiales] = await Promise.all([
    supabase
      .from("tareas")
      .select("id, subrubro, nombre, unidad, orden")
      .ilike("rubro", patron)
      .order("orden")
      .order("nombre"),
    supabase.from("computo_items").select("tarea_id").eq("obra_id", obra.id),
    getMaterialesCatalogo(),
  ]);
  if (error) console.error("TareasDelRubroPage:", error.message);

  const ids = (tareas ?? []).map((t) => t.id);
  const { data: composiciones } = ids.length
    ? await supabase.from("tarea_desglose").select("tarea_id").in("tarea_id", ids)
    : { data: [] as { tarea_id: string }[] };

  const renglonesPorTarea = new Map<string, number>();
  for (const c of composiciones ?? []) {
    renglonesPorTarea.set(c.tarea_id, (renglonesPorTarea.get(c.tarea_id) ?? 0) + 1);
  }
  const deLaObra = new Set((enObra ?? []).map((i) => i.tarea_id));

  const lista: TareaDelRubro[] = (tareas ?? []).map((t) => ({
    id: t.id,
    subrubro: t.subrubro,
    nombre: t.nombre,
    unidad: t.unidad,
    renglones: renglonesPorTarea.get(t.id) ?? 0,
    enEstaObra: deLaObra.has(t.id),
  }));

  return (
    <AppShell sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="rubros" />}>
      <ObraHeader obra={obra} activeSection="rubros" ocultarNav />

      <section style={ui.sectionHeader}>
        <Link href={`/obras/${obra.slug}/rubros`} style={volver}>
          ← Rubros
        </Link>
        <p style={ui.eyebrow}>Tareas del rubro</p>
        <h2 style={ui.pageTitle}>{rubro.nombre}</h2>
        <p style={ui.subtitle}>Catálogo común a todas las obras.</p>
      </section>

      <TareasDelRubro
        rubro={rubro.nombre}
        tareas={lista}
        materiales={materiales}
        crear={crearTareaDelCatalogo}
        editar={editarTareaDelCatalogo}
        eliminar={eliminarTareaDelCatalogo}
        leerComposicion={leerModeloDeTarea}
        guardarComposicion={guardarModeloDeTarea}
      />
    </AppShell>
  );
}

const volver = {
  display: "inline-block",
  color: "#777777",
  fontSize: "14px",
  textDecoration: "none",
  marginBottom: "12px",
};
