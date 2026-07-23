import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import SubirFotosForm from "@/components/SubirFotosForm";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { crearRegistroFotos } from "../actions";

export default async function NuevasFotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();
  const { data: rubros } = await supabase
    .from("rubros")
    .select("id, nombre")
    .eq("obra_id", obra.id)
    .order("orden");

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="fotos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Subir fotos</h2>
        <p style={ui.subtitle}>
          Cargá una o varias fotos de un mismo momento de obra. Se reducen de
          tamaño automáticamente antes de guardarse.
        </p>
      </section>

      <SubirFotosForm
        action={crearRegistroFotos}
        obraId={obra.id}
        slug={obra.slug}
        rubros={rubros ?? []}
        error={error}
      />

      <p style={{ ...ui.note, marginTop: "20px" }}>
        <Link href={`/obras/${obra.slug}/fotos`} style={{ color: "#666666" }}>
          Volver a las fotos de la obra
        </Link>
      </p>
    </AppShell>
  );
}
