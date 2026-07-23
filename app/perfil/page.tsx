import Link from "next/link";
import AppShell from "@/components/AppShell";
import * as ui from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { actualizarMiPerfil } from "./actions";

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, rol, empresas(nombre)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  // Cuando el perfil se creó solo, el nombre quedó siendo el email.
  const nombreEsElMail = perfil?.nombre === user?.email;

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={ui.eyebrow}>Gestión de desarrollo</p>
          <h2 style={ui.pageTitle}>Mi perfil</h2>
          <p style={ui.subtitle}>
            Tu nombre es el que figura en los gastos, avances y archivos que
            cargás.
          </p>
        </div>

        <Link href="/" style={backLink}>
          Volver a obras
        </Link>
      </header>

      {error && <p style={errorBox}>{error}</p>}
      {ok && <p style={okBox}>Listo, se guardó tu nombre.</p>}

      {nombreEsElMail && !ok && (
        <p style={avisoBox}>
          Tu nombre todavía es tu dirección de correo, así que eso es lo que
          aparece en todo lo que cargaste. Escribí tu nombre y apellido acá
          abajo y se corrige en toda la app.
        </p>
      )}

      <section style={ui.panel}>
        <form action={actualizarMiPerfil} style={form}>
          <label style={field}>
            <span style={labelCampo}>Nombre y apellido</span>
            <input
              type="text"
              name="nombre"
              defaultValue={nombreEsElMail ? "" : (perfil?.nombre ?? "")}
              placeholder="Ej: Julián Serra"
              required
              style={ui.input}
            />
          </label>

          <div style={soloLectura}>
            <span style={labelCampo}>Email</span>
            <strong>{user?.email ?? "—"}</strong>
          </div>

          <div style={soloLectura}>
            <span style={labelCampo}>Rol</span>
            <strong>
              {perfil?.rol === "admin"
                ? "Administrador"
                : (perfil?.empresas?.nombre ?? "Empresa")}
            </strong>
          </div>

          <div style={acciones}>
            <button type="submit" style={ui.button}>
              Guardar
            </button>
          </div>
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

const backLink = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
  paddingBottom: "4px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const okBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const avisoBox = {
  border: "1px solid #dcdcdc",
  background: "#fafafa",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
  lineHeight: 1.5,
  color: "#555555",
};

const form = {
  display: "grid",
  gap: "20px",
  maxWidth: "460px",
};

const field = {
  display: "grid",
  gap: "8px",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const soloLectura = {
  display: "grid",
  gap: "6px",
};

const acciones = {
  display: "flex",
  justifyContent: "flex-start",
  marginTop: "4px",
};
