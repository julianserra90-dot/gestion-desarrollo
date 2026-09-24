import AppShell from "@/components/AppShell";
import AppSidebar from "@/components/AppSidebar";
import BotonConfirmar from "@/components/BotonConfirmar";
import Volver from "@/components/Volver";
import * as ui from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { actualizarReferencia, eliminarReferencia } from "../actions";

/**
 * Un edificio de referencia: sus datos y, lo que importa, su resolución
 * escrita mirando las plantas. Cuanto más se carga, mejor contrastan los
 * comparables con las reglas.
 */
export default async function ReferenciaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const supabase = await createClient();

  const { data: e } = await supabase
    .from("edificios_referencia")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!e) {
    return <AppShell>Edificio no encontrado</AppShell>;
  }

  return (
    <AppShell sidebar={<AppSidebar activo="prefactibilidades" />}>
      <Volver href="/prefactibilidades/referencias">Edificios de referencia</Volver>

      <header style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Edificio de referencia</p>
        <h2 style={ui.pageTitle}>{e.direccion}</h2>
        <p style={ui.subtitle}>
          {[e.barrio, e.estudio].filter(Boolean).join(" · ")}
          {e.link && (
            <>
              {" · "}
              <a href={e.link} target="_blank" rel="noreferrer" style={enlace}>
                ver las plantas ↗
              </a>
            </>
          )}
        </p>
      </header>

      {error && <p style={errorBox}>{error}</p>}
      {guardado && <p style={okBox}>Guardado.</p>}

      <form action={actualizarReferencia}>
        <input type="hidden" name="referencia_id" value={e.id} />

        <div style={ui.panel}>
          <h3 style={sectionTitle}>El lote</h3>
          <div style={grid}>
            <label style={field}>
              <span style={label}>Estudio</span>
              <input type="text" name="estudio" defaultValue={e.estudio} required style={ui.input} />
            </label>
            <label style={field}>
              <span style={label}>Barrio</span>
              <input type="text" name="barrio" defaultValue={e.barrio ?? ""} style={ui.input} />
            </label>
            <label style={field}>
              <span style={label}>Dirección</span>
              <input type="text" name="direccion" defaultValue={e.direccion} required style={ui.input} />
            </label>
            <label style={field}>
              <span style={label}>Enlace a las plantas</span>
              <input type="url" name="link" defaultValue={e.link ?? ""} style={ui.input} />
            </label>
            <label style={field}>
              <span style={label}>Frente (m)</span>
              <input type="number" name="frente_m" step="0.01" min="0" defaultValue={e.frente_m ?? ""} style={ui.input} />
            </label>
            <label style={field}>
              <span style={label}>Fondo (m)</span>
              <input type="number" name="fondo_m" step="0.01" min="0" defaultValue={e.fondo_m ?? ""} style={ui.input} />
            </label>
            <label style={field}>
              <span style={label}>Superficie del lote (m²)</span>
              <input type="number" name="superficie_lote_m2" step="0.01" min="0" defaultValue={e.superficie_lote_m2 ?? ""} style={ui.input} />
            </label>
            <label style={field}>
              <span style={label}>Unidades funcionales</span>
              <input type="number" name="unidades_funcionales" step="1" min="0" defaultValue={e.unidades_funcionales ?? ""} style={ui.input} />
            </label>
            <label style={casilla}>
              <input type="checkbox" name="esquina" defaultChecked={e.esquina} />
              <span>Esquina</span>
            </label>
            <label style={casilla}>
              <input type="checkbox" name="frente_a_parque" defaultChecked={e.frente_a_parque} />
              <span>Frente a un parque</span>
            </label>
            <label style={field}>
              <span style={label}>Etiqueta</span>
              <select name="etiqueta" defaultValue={e.etiqueta ?? ""} style={ui.input}>
                <option value="">Sin etiqueta</option>
                <option value="VER">Construido, con plantas</option>
                <option value="NUEVO">En obra</option>
              </select>
            </label>
          </div>
        </div>

        <div style={ui.panelConMargen}>
          <h3 style={sectionTitle}>La resolución</h3>
          <p style={ayuda}>
            Lo que se ve en las plantas. Con algo escrito acá, el edificio pasa a
            contar como analizado en los comparables.
          </p>
          <div style={grid}>
            <label style={field}>
              <span style={label}>Plantas sobre PB</span>
              <input type="number" name="plantas_sobre_pb" step="1" min="0" defaultValue={e.plantas_sobre_pb ?? ""} style={ui.input} />
            </label>
            <label style={field}>
              <span style={label}>Unidades por planta tipo</span>
              <input type="number" name="unidades_por_planta" step="1" min="0" defaultValue={e.unidades_por_planta ?? ""} style={ui.input} />
            </label>
            <label style={fieldLarge}>
              <span style={label}>Núcleo</span>
              <input type="text" name="nucleo" defaultValue={e.nucleo ?? ""} placeholder="Ej: contra la medianera derecha, a 12 m del frente; escalera de dos tramos y ascensor" style={ui.input} />
            </label>
            <label style={fieldLarge}>
              <span style={label}>Ingreso</span>
              <input type="text" name="ingreso" defaultValue={e.ingreso ?? ""} placeholder="Ej: pasillo lateral de 1,20 m desde la calle hasta el núcleo; el palier abre a las dos unidades" style={ui.input} />
            </label>
            <label style={fieldLarge}>
              <span style={label}>Patios</span>
              <input type="text" name="patios" defaultValue={e.patios ?? ""} placeholder="Ej: uno junto al núcleo de 3 × 5 y otro de 4 × 6 entre la unidad del medio y la del fondo" style={ui.input} />
            </label>
            <label style={fieldLarge}>
              <span style={label}>Tipologías</span>
              <input type="text" name="tipologias" defaultValue={e.tipologias ?? ""} placeholder="Ej: monoambientes al frente, 2 dormitorios pasantes al fondo, dúplex en el último piso" style={ui.input} />
            </label>
            <label style={field}>
              <span style={label}>Cocheras</span>
              <input type="number" name="cocheras" step="1" min="0" defaultValue={e.cocheras ?? ""} style={ui.input} />
            </label>
            <div style={field}>
              <label style={casilla}>
                <input type="checkbox" name="ascensor" defaultChecked={e.ascensor ?? false} />
                <span>Tiene ascensor</span>
              </label>
              <label style={casilla}>
                <input type="checkbox" name="local_pb" defaultChecked={e.local_pb ?? false} />
                <span>Local en planta baja</span>
              </label>
            </div>
            <label style={fieldLarge}>
              <span style={label}>Notas</span>
              <textarea name="notas" defaultValue={e.notas ?? ""} placeholder="Lo que enseña este edificio: qué hace distinto, qué medida repite, qué evitar." style={textarea} />
            </label>
          </div>
        </div>

        <div style={actions}>
          <button type="submit" style={ui.button}>
            Guardar
          </button>
        </div>
      </form>

      <section style={zonaBorrar}>
        <form action={eliminarReferencia}>
          <input type="hidden" name="referencia_id" value={e.id} />
          <BotonConfirmar mensaje={`¿Eliminar ${e.direccion} de la base de referencia?`} style={botonBorrar}>
            Eliminar edificio
          </BotonConfirmar>
        </form>
      </section>
    </AppShell>
  );
}

const sectionTitle = {
  ...ui.sectionTitle,
  margin: "0 0 20px",
};

const ayuda = {
  ...ui.note,
  margin: "-8px 0 20px",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
  alignContent: "start" as const,
};

const fieldLarge = {
  ...field,
  gridColumn: "1 / -1",
};

const label = {
  fontSize: "13px",
  color: "#555555",
};

const casilla = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  color: "#333333",
  cursor: "pointer",
  alignSelf: "end",
};

const textarea = {
  ...ui.input,
  minHeight: "96px",
  resize: "vertical" as const,
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "28px",
};

const zonaBorrar = {
  marginTop: "40px",
  paddingTop: "24px",
  borderTop: "1px solid #eeeeee",
  display: "flex",
  justifyContent: "flex-end",
};

const botonBorrar = {
  ...ui.secondaryButton,
  color: ui.ROJO,
  borderColor: "#f1c8c8",
};

const enlace = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
};

const errorBox = {
  border: "1px solid #111111",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const okBox = {
  background: "#e7f5ec",
  color: ui.VERDE,
  borderRadius: "10px",
  padding: "12px 14px",
  marginBottom: "20px",
  fontSize: "14px",
};
