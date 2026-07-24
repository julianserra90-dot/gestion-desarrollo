import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import SubirFotosForm from "@/components/SubirFotosForm";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { getRubrosActivos } from "@/lib/rubros";
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

  const rubros = await getRubrosActivos(obra.id);

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

      {rubros.length === 0 && (
        <section style={avisoRubros}>
          Esta obra todavía no tiene rubros elegidos, así que las fotos van a
          quedar sin clasificar. Marcalos en la solapa{" "}
          <Link href={`/obras/${obra.slug}/rubros`} style={enlaceAviso}>
            Rubros
          </Link>
          .
        </section>
      )}

      <SubirFotosForm
        action={crearRegistroFotos}
        obraId={obra.id}
        slug={obra.slug}
        rubros={rubros}
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

const avisoRubros = {
  border: "1px solid #b91c1c",
  color: "#b91c1c",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
  lineHeight: 1.5,
};

const enlaceAviso = {
  color: "#b91c1c",
  textDecoration: "underline",
};
