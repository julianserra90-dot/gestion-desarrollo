import Link from "next/link";
import SociosEditor, {
  type Empresa,
  type SocioInicial,
} from "@/components/SociosEditor";

type Obra = {
  id: string;
  slug: string;
  nombre: string;
  ubicacion: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
  presupuesto: number | null;
};

const ESTADOS = ["Proyecto", "En ejecución", "Pausada", "Finalizada"];

export default function ObraForm({
  action,
  obra,
  empresas,
  socios,
  error,
  cancelarHref,
  textoBoton,
}: {
  action: (formData: FormData) => void;
  obra?: Obra;
  empresas: Empresa[];
  socios: SocioInicial[];
  error?: string;
  cancelarHref: string;
  textoBoton: string;
}) {
  return (
    <form action={action}>
      {obra && (
        <>
          <input type="hidden" name="obra_id" value={obra.id} />
          <input type="hidden" name="slug" value={obra.slug} />
        </>
      )}

      {error && <p style={errorBox}>{error}</p>}

      <div style={panel}>
        <h3 style={sectionTitle}>Datos de la obra</h3>

        <div style={grid}>
          <label style={fieldLarge}>
            <span style={label}>Nombre</span>
            <input
              type="text"
              name="nombre"
              defaultValue={obra?.nombre ?? ""}
              placeholder="Ej: Edificio San Isidro"
              required
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Ubicación</span>
            <input
              type="text"
              name="ubicacion"
              defaultValue={obra?.ubicacion ?? ""}
              placeholder="Ej: San Isidro, Buenos Aires"
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Estado</span>
            <select
              name="estado"
              defaultValue={obra?.estado ?? "Proyecto"}
              style={input}
            >
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </label>

          <label style={field}>
            <span style={label}>Fecha de inicio</span>
            <input
              type="date"
              name="fecha_inicio"
              defaultValue={obra?.fecha_inicio ?? ""}
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Fin estimado</span>
            <input
              type="date"
              name="fecha_fin_estimada"
              defaultValue={obra?.fecha_fin_estimada ?? ""}
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Presupuesto</span>
            <input
              type="number"
              name="presupuesto"
              min="0"
              step="1"
              defaultValue={obra?.presupuesto ?? ""}
              placeholder="0"
              style={input}
            />
          </label>
        </div>
      </div>

      <SociosEditor empresas={empresas} iniciales={socios} />

      <div style={actions}>
        <Link href={cancelarHref} style={secondaryButton}>
          Cancelar
        </Link>

        <button type="submit" style={button}>
          {textoBoton}
        </button>
      </div>
    </form>
  );
}

const panel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
  margin: "0 0 20px",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
};

const fieldLarge = {
  display: "grid",
  gap: "8px",
  gridColumn: "1 / -1",
};

const label = {
  fontSize: "13px",
  color: "#555555",
};

const input = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  background: "#ffffff",
  padding: "12px",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111111",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "28px",
};

const button = {
  background: "#111111",
  color: "#ffffff",
  border: "none",
  padding: "14px 22px",
  fontSize: "14px",
  cursor: "pointer",
};

const secondaryButton = {
  color: "#111111",
  textDecoration: "none",
  border: "1px solid #dcdcdc",
  padding: "14px 22px",
  fontSize: "14px",
};
