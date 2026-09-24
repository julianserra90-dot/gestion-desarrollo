import Link from "next/link";
import AppShell from "@/components/AppShell";
import AppSidebar from "@/components/AppSidebar";
import Volver from "@/components/Volver";
import * as ui from "@/components/ui";
import { crearPrefactibilidad } from "../actions";

// La consulta encadena USIG y Ciudad 3D con reintentos: puede pasar de los
// 10 segundos que Vercel da por defecto a una acción.
export const maxDuration = 60;

/**
 * El alta pide una sola cosa: la dirección. Con eso la Ciudad contesta el
 * resto —parcela, medidas, normativa— y el estudio se abre ya cargado. Lo
 * que haya que corregir se corrige después, desde Editar.
 */
export default async function NuevaPrefactibilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AppShell sidebar={<AppSidebar activo="prefactibilidades" />}>
      <Volver href="/prefactibilidades">Prefactibilidades</Volver>

      <header style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Prefactibilidad</p>
        <h2 style={ui.pageTitle}>Nuevo estudio</h2>
      </header>

      <form action={crearPrefactibilidad}>
        {error && <p style={errorBox}>{error}</p>}

        <div style={ui.panel}>
          <label style={field}>
            <span style={label}>Dirección del terreno</span>
            <input
              type="text"
              name="direccion"
              placeholder="Ej: Andonaegui 1229"
              autoFocus
              required
              style={ui.input}
            />
            <span style={ayudaCampo}>
              Calle y altura en la Ciudad de Buenos Aires. Con eso USIG ubica
              la parcela y Ciudad 3D trae la ficha catastral y la normativa;
              tarda unos segundos.
            </span>
          </label>
        </div>

        <div style={actions}>
          <Link href="/prefactibilidades" style={ui.secondaryButton}>
            Cancelar
          </Link>
          <button type="submit" style={ui.button}>
            Consultar a la Ciudad
          </button>
        </div>
      </form>
    </AppShell>
  );
}

const field = {
  display: "grid",
  gap: "8px",
  maxWidth: "560px",
};

const label = {
  fontSize: "13px",
  color: "#555555",
};

const ayudaCampo = {
  fontSize: "13px",
  color: "#999999",
};

const errorBox = {
  border: "1px solid #111111",
  borderRadius: "10px",
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
