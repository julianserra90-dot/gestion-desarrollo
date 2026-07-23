import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraForm from "@/components/ObraForm";
import { createClient } from "@/lib/supabase/server";
import { crearEmpresa } from "@/app/empresas/actions";
import { crearObra } from "../actions";

export default async function NuevaObraPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, nombre")
    .order("nombre");

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>Gestión de desarrollo</p>
          <h2 style={title}>Nueva obra</h2>
          <p style={subtitle}>
            Cargá los datos y definí qué empresas participan y en qué proporción.
          </p>
        </div>

        <Link href="/" style={backLink}>
          Volver a obras
        </Link>
      </header>

      <ObraForm
        action={crearObra}
        empresas={empresas ?? []}
        socios={[]}
        error={error}
        cancelarHref="/"
        textoBoton="Crear obra"
      />

      <section style={panel}>
        <h3 style={sectionTitle}>¿Falta una empresa?</h3>
        <p style={text}>
          Si la empresa que buscás no está en la lista, agregala acá y después
          seleccionala arriba.
        </p>

        <form action={crearEmpresa} style={inlineForm}>
          <input type="hidden" name="volver_a" value="/obras/nueva" />
          <input
            type="text"
            name="nombre"
            placeholder="Nombre de la empresa"
            required
            style={input}
          />
          <button type="submit" style={secondaryButton}>
            Agregar empresa
          </button>
        </form>
      </section>
    </AppShell>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #e5e5e5",
  paddingBottom: "24px",
  marginBottom: "32px",
};

const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

const title = {
  fontSize: "36px",
  fontWeight: 400,
  margin: "8px 0",
};

const subtitle = {
  color: "#666666",
  margin: 0,
};

const backLink = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
  paddingBottom: "4px",
};

const panel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  marginTop: "32px",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
  margin: "0 0 8px",
};

const text = {
  color: "#666666",
  fontSize: "14px",
  margin: "0 0 16px",
};

const inlineForm = {
  display: "flex",
  gap: "12px",
  maxWidth: "520px",
};

const input = {
  flex: 1,
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  background: "#ffffff",
  padding: "12px",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111111",
};

const secondaryButton = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};
