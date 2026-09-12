import Link from "next/link";
import InputMonto from "@/components/InputMonto";
import * as ui from "@/components/ui";

type Socio = { empresa_id: string; nombre: string };

export type PrevistoExistente = {
  id: string;
  empresa_id: string;
  fecha_prevista: string;
  monto: number;
  moneda: string;
  detalle: string;
  observaciones: string | null;
};

/**
 * Corrige una cuota prevista suelta: la fecha se corrió, el monto cambió, la
 * pone otra empresa. Sin cálculo en vivo porque no hay nada que calcular: la
 * cuota no toca la cuenta hasta que entra.
 */
export default function PrevistoForm({
  action,
  slug,
  socios,
  previsto,
  error,
}: {
  action: (formData: FormData) => void;
  slug: string;
  socios: Socio[];
  previsto: PrevistoExistente;
  error?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="previsto_id" value={previsto.id} />

      {error && <p style={errorBox}>{error}</p>}

      <div style={ui.panel}>
        <div style={grid}>
          <label style={field}>
            <span style={labelCampo}>Fecha prevista</span>
            <input
              type="date"
              name="fecha_prevista"
              defaultValue={previsto.fecha_prevista}
              required
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={labelCampo}>Empresa que aporta</span>
            <select
              name="empresa_id"
              defaultValue={previsto.empresa_id}
              required
              style={ui.input}
            >
              {socios.map((s) => (
                <option key={s.empresa_id} value={s.empresa_id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>

          <div style={fieldAncho}>
            <span style={labelCampo}>Detalle</span>
            <input
              type="text"
              name="detalle"
              defaultValue={previsto.detalle}
              required
              style={ui.input}
            />
          </div>

          <label style={field}>
            <span style={labelCampo}>Monto</span>
            <InputMonto
              name="monto"
              defaultValue={previsto.monto}
              required
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={labelCampo}>Moneda</span>
            <select name="moneda" defaultValue={previsto.moneda} style={ui.input}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>Observaciones</span>
            <textarea
              name="observaciones"
              defaultValue={previsto.observaciones ?? ""}
              placeholder="Opcional"
              style={textarea}
            />
          </label>
        </div>
      </div>

      <div style={acciones}>
        <Link href={`/obras/${slug}/ingresos/agenda`} style={ui.secondaryButton}>
          Cancelar
        </Link>
        <button type="submit" style={ui.button}>
          Guardar cambios
        </button>
      </div>
    </form>
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
  alignContent: "start" as const,
};

const fieldAncho = {
  ...field,
  gridColumn: "1 / -1",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const textarea = {
  ...ui.input,
  minHeight: "90px",
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
