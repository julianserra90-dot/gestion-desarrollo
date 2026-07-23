import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { actualizarAvance } from "../../actions";

const ESTADOS = [
  "Sin iniciar",
  "Replanteo",
  "Inicial",
  "En ejecución",
  "Finalizado",
];

export default async function EditarAvancePage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; avanceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, avanceId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const { data: avance } = await supabase
    .from("avances")
    .select("id, porcentaje, estado, comentario, fecha, rubro_id, rubros(nombre)")
    .eq("id", avanceId)
    .eq("obra_id", obra.id)
    .maybeSingle();

  if (!avance) {
    return <AppShell>Avance no encontrado</AppShell>;
  }

  // Las fotos asociadas salen de los registros fotográficos del mismo rubro.
  const { data: registros } = await supabase
    .from("foto_registros")
    .select("fotos(count)")
    .eq("obra_id", obra.id)
    .eq("rubro_id", avance.rubro_id);

  const fotosAsociadas = (registros ?? []).reduce(
    (acc, r) => acc + (r.fotos?.[0]?.count ?? 0),
    0
  );

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="avances" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Editar avance</p>
        <h2 style={ui.pageTitle}>{avance.rubros?.nombre ?? "Sin rubro"}</h2>
        <p style={ui.subtitle}>
          Actualizá el porcentaje, el estado y el comentario técnico del rubro.
        </p>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      <form action={actualizarAvance}>
        <input type="hidden" name="avance_id" value={avance.id} />
        <input type="hidden" name="slug" value={obra.slug} />

        <div style={ui.panel}>
          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Porcentaje de avance</span>
              <input
                type="number"
                name="porcentaje"
                min="0"
                max="100"
                defaultValue={avance.porcentaje}
                required
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Estado</span>
              <select
                name="estado"
                defaultValue={avance.estado}
                style={ui.input}
              >
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </label>

            <label style={field}>
              <span style={labelCampo}>Fecha de actualización</span>
              <input
                type="date"
                name="fecha"
                defaultValue={avance.fecha}
                style={ui.input}
              />
            </label>

            <div style={soloLectura}>
              <span style={labelCampo}>Fotos asociadas</span>
              <strong style={{ fontSize: "22px" }}>{fotosAsociadas}</strong>
              <p style={{ ...ui.note, margin: "6px 0 0" }}>
                Se cuentan solas según las fotos cargadas en este rubro.
              </p>
            </div>

            <label style={fieldAncho}>
              <span style={labelCampo}>Comentario técnico</span>
              <textarea
                name="comentario"
                defaultValue={avance.comentario ?? ""}
                style={textarea}
              />
            </label>
          </div>
        </div>

        <div style={acciones}>
          <Link href={`/obras/${obra.slug}/avances`} style={ui.secondaryButton}>
            Cancelar
          </Link>

          <button type="submit" style={ui.button}>
            Guardar avance
          </button>
        </div>
      </form>
    </AppShell>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
};

const fieldAncho = {
  ...field,
  gridColumn: "1 / -1",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const soloLectura = {
  border: "1px solid #eeeeee",
  padding: "12px",
  display: "grid",
  gap: "4px",
  alignContent: "start" as const,
};

const textarea = {
  ...ui.input,
  minHeight: "120px",
  resize: "vertical" as const,
};

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
