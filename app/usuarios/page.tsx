import Link from "next/link";
import AppShell from "@/components/AppShell";
import * as ui from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { actualizarUsuario } from "./actions";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();

  const [{ data: perfiles }, { data: empresas }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, rol, empresa_id").order("nombre"),
    supabase.from("empresas").select("id, nombre").order("nombre"),
  ]);

  const lista = perfiles ?? [];
  const pendientes = lista.filter((p) => p.rol === "empresa" && !p.empresa_id);

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={ui.eyebrow}>Gestión de desarrollo</p>
          <h2 style={ui.pageTitle}>Usuarios</h2>
          <p style={ui.subtitle}>
            Quién entra a la app y a qué empresa pertenece. Cada usuario ve
            únicamente las obras donde su empresa es socia.
          </p>
        </div>

        <Link href="/" style={backLink}>
          Volver a obras
        </Link>
      </header>

      {error && <p style={errorBox}>{error}</p>}
      {ok && <p style={okBox}>Listo, se guardaron los cambios.</p>}

      {pendientes.length > 0 && (
        <p style={avisoBox}>
          Hay {pendientes.length}{" "}
          {pendientes.length === 1 ? "usuario" : "usuarios"} sin empresa
          asignada. Hasta que se la asignes, no ven ninguna obra.
        </p>
      )}

      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Cómo agregar un usuario</h3>
        <p style={{ ...ui.text, marginBottom: 0 }}>
          Los usuarios se crean desde el panel de Supabase, en{" "}
          <strong>Authentication → Users → Add user</strong> (marcá{" "}
          <em>Auto Confirm User</em>). Apenas se crean aparecen acá abajo, y
          desde acá les asignás nombre y empresa.
        </p>
      </section>

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>
          Usuarios <span style={contador}>({lista.length})</span>
        </h3>

        {lista.length === 0 ? (
          <p style={ui.vacio}>Todavía no hay usuarios.</p>
        ) : (
          <div style={listaUsuarios}>
            {lista.map((perfil) => {
              const sinEmpresa = perfil.rol === "empresa" && !perfil.empresa_id;

              return (
                <form
                  key={perfil.id}
                  action={actualizarUsuario}
                  style={sinEmpresa ? filaPendiente : fila}
                >
                  <input type="hidden" name="usuario_id" value={perfil.id} />

                  <div style={campo}>
                    <span style={etiqueta}>Nombre y apellido</span>
                    <input
                      type="text"
                      name="nombre"
                      defaultValue={perfil.nombre}
                      required
                      style={ui.input}
                    />
                  </div>

                  <div style={campo}>
                    <span style={etiqueta}>Rol</span>
                    <select
                      name="rol"
                      defaultValue={perfil.rol}
                      style={ui.input}
                    >
                      <option value="empresa">Empresa</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div style={campo}>
                    <span style={etiqueta}>Empresa</span>
                    <select
                      name="empresa_id"
                      defaultValue={perfil.empresa_id ?? ""}
                      style={ui.input}
                    >
                      <option value="">Sin asignar</option>
                      {(empresas ?? []).map((empresa) => (
                        <option key={empresa.id} value={empresa.id}>
                          {empresa.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={campoBoton}>
                    <button type="submit" style={ui.secondaryButton}>
                      Guardar
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        )}

        <p style={{ ...ui.note, marginTop: "24px", marginBottom: 0 }}>
          Un <strong>administrador</strong> ve y edita todas las obras y no
          pertenece a ninguna empresa. Un usuario de{" "}
          <strong>empresa</strong> ve sólo las obras donde su empresa es socia,
          y los gastos que carga quedan a nombre de esa empresa.
        </p>
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

const okBox = { ...errorBox };

const avisoBox = {
  border: "1px solid #dcdcdc",
  background: "#fafafa",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
  lineHeight: 1.5,
  color: "#555555",
};

const listaUsuarios = {
  display: "grid",
  gap: "16px",
  marginTop: "20px",
};

const fila = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1.2fr auto",
  gap: "12px",
  alignItems: "end",
  borderTop: "1px solid #eeeeee",
  paddingTop: "16px",
};

const filaPendiente = {
  ...fila,
  borderTop: "1px solid #111111",
};

const campo = {
  display: "grid",
  gap: "6px",
};

const campoBoton = {
  display: "flex",
  alignItems: "flex-end",
};

const etiqueta = {
  fontSize: "12px",
  color: "#777777",
};

const contador = {
  color: "#999999",
  fontSize: "15px",
};
