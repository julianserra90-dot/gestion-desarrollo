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
  valor_m2_usd: number | null;
  domicilio: string | null;
  unidades_funcionales: number | null;
  pisos: number | null;
  sup_construccion_m2: number | null;
  sup_venta_m2: number | null;
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
            <span style={ayudaCampo}>
              La localidad, que es lo que se lee en el listado de obras.
            </span>
          </label>

          <label style={field}>
            <span style={label}>Domicilio</span>
            <input
              type="text"
              name="domicilio"
              defaultValue={obra?.domicilio ?? ""}
              placeholder="Ej: Av. Mitre 1240"
              style={input}
            />
            <span style={ayudaCampo}>
              Calle y altura, para avisos de obra y planos municipales.
            </span>
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

          <label style={field}>
            <span style={label}>Superficie de construcción (m²)</span>
            <input
              type="number"
              name="sup_construccion_m2"
              min="0"
              step="0.01"
              defaultValue={obra?.sup_construccion_m2 ?? ""}
              placeholder="0"
              style={input}
            />
            <span style={ayudaCampo}>Lo que se construye, con muros.</span>
          </label>

          <label style={field}>
            <span style={label}>Superficie de venta (m²)</span>
            <input
              type="number"
              name="sup_venta_m2"
              min="0"
              step="0.01"
              defaultValue={obra?.sup_venta_m2 ?? ""}
              placeholder="0"
              style={input}
            />
            <span style={ayudaCampo}>La neta vendible de las unidades.</span>
          </label>

          <label style={field}>
            <span style={label}>Unidades funcionales</span>
            <input
              type="number"
              name="unidades_funcionales"
              min="1"
              step="1"
              defaultValue={obra?.unidades_funcionales ?? ""}
              placeholder="0"
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>Pisos sobre PB</span>
            <input
              type="number"
              name="pisos"
              min="0"
              step="1"
              defaultValue={obra?.pisos ?? ""}
              placeholder="0"
              style={input}
            />
            <span style={ayudaCampo}>
              Un PB + 5 son 5. La planta baja se cuenta aparte.
            </span>
          </label>

          <label style={field}>
            <span style={label}>Objetivo por m² (USD)</span>
            <input
              type="number"
              name="valor_m2_usd"
              min="0"
              step="1"
              defaultValue={obra?.valor_m2_usd ?? ""}
              placeholder="Ej: 800"
              style={input}
            />
            <span style={ayudaCampo}>
              A cuántos dólares el metro se arrancó la obra. Con esto y la
              superficie, Estado compara contra lo que va dando de verdad.
            </span>
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

const ayudaCampo = {
  fontSize: "13px",
  color: "#999999",
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
