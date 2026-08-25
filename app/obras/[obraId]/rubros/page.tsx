import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import RubrosSelector from "@/components/RubrosSelector";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { crearRubro, eliminarRubro, guardarRubros } from "./actions";

export default async function RubrosPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string; nueva?: string }>;
}) {
  const { obraId } = await params;
  const { error, nueva } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: rubros }, { data: gastos }, { data: avances }, { data: fotos }] =
    await Promise.all([
      supabase
        .from("rubros")
        .select("id, nombre, orden, activo")
        .eq("obra_id", obra.id)
        .order("orden"),
      supabase.from("gastos").select("rubro_id").eq("obra_id", obra.id),
      supabase.from("avances").select("rubro_id").eq("obra_id", obra.id),
      supabase.from("foto_registros").select("rubro_id").eq("obra_id", obra.id),
    ]);

  // Cuántas veces se usa cada rubro, para saber si se puede borrar.
  const usos = new Map<string, number>();
  const sumar = (id: string | null) => {
    if (!id) return;
    usos.set(id, (usos.get(id) ?? 0) + 1);
  };

  gastos?.forEach((g) => sumar(g.rubro_id));
  avances?.forEach((a) => sumar(a.rubro_id));
  fotos?.forEach((f) => sumar(f.rubro_id));

  const lista = (rubros ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    activo: r.activo,
    usos: usos.get(r.id) ?? 0,
  }));

  const marcados = lista.filter((r) => r.activo).length;

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="rubros" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Configuración de obra</p>
        <h2 style={ui.pageTitle}>Rubros</h2>
        <p style={ui.subtitle}>
          Los desplegables de gastos, avances y fotos ofrecen sólo los marcados.
        </p>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      {nueva && (
        <section style={avisoNueva}>
          <strong>La obra se creó.</strong> El primer paso es elegir con qué
          rubros se va a trabajar: eso define lo que van a ofrecer los
          formularios de gastos, avances y fotos. Se puede cambiar cuando
          quieras.
        </section>
      )}

      {marcados === 0 && !nueva && (
        <section style={avisoVacio}>
          <strong>Esta obra todavía no tiene rubros elegidos.</strong> Hasta que
          marques al menos uno, los formularios de gastos, avances y fotos no van
          a poder clasificar nada.
        </section>
      )}

      <RubrosSelector
        slug={obra.slug}
        obraId={obra.id}
        rubros={lista}
        guardar={guardarRubros}
        eliminar={eliminarRubro}
        crear={crearRubro}
      />
    </AppShell>
  );
}

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const avisoVacio = {
  border: "1px solid #b91c1c",
  color: "#b91c1c",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
  lineHeight: 1.5,
};

// Recién creada la obra no es un error que no haya rubros: es el paso que
// sigue. Por eso el aviso va en negro y no en rojo.
const avisoNueva = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
  lineHeight: 1.5,
};
