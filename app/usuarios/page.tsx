import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AppSidebar from "@/components/AppSidebar";
import * as ui from "@/components/ui";
import { ROL, ROLES, ROL_CON_EMPRESA, leerRol } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { actualizarUsuario } from "./actions";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Organizar usuarios es del administrador. La base ya lo garantiza —la policy
  // de perfiles sólo le deja ver el suyo a los demás—, pero sin esto un
  // desarrollador entraría a una pantalla que se ve rota en vez de a una que no
  // le corresponde.
  const { data: yo } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  if (yo?.rol !== "admin") {
    redirect("/");
  }

  const [{ data: perfiles }, { data: empresas }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, rol, empresa_id").order("nombre"),
    supabase.from("empresas").select("id, nombre").order("nombre"),
  ]);

  const lista = perfiles ?? [];
  const pendientes = lista.filter(
    (p) => p.rol === ROL_CON_EMPRESA && !p.empresa_id
  );

  return (
    <AppShell sidebar={<AppSidebar activo="usuarios" />}>
      <header style={header}>
        <div>
          <p style={ui.eyebrow}>Gestión de desarrollo</p>
          <h2 style={ui.pageTitle}>Usuarios</h2>
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
          {pendientes.length === 1 ? "desarrollador" : "desarrolladores"} sin
          empresa asignada. Hasta que se la asignes, no ven ninguna obra.
        </p>
      )}

      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Cómo agregar un usuario</h3>
        <p style={{ ...ui.text, marginBottom: 0 }}>
          Los usuarios se crean desde el panel de Supabase, en{" "}
          <strong>Authentication → Users → Add user</strong> (marcá{" "}
          <em>Auto Confirm User</em>). Apenas se crean aparecen acá abajo, y
          desde acá les asignás nombre, rol y empresa.
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
              const rol = leerRol(perfil.rol);
              const sinEmpresa =
                perfil.rol === ROL_CON_EMPRESA && !perfil.empresa_id;

              return (
                <form
                  key={perfil.id}
                  action={actualizarUsuario}
                  style={sinEmpresa ? filaPendiente : fila}
                >
                  <input type="hidden" name="usuario_id" value={perfil.id} />

                  <div style={distintivo} title={rol ? ROL[rol].nombre : ""}>
                    {rol ? ROL[rol].emoji : ""}
                  </div>

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
                      {ROLES.map((valor) => (
                        <option key={valor} value={valor}>
                          {ROL[valor].emoji} {ROL[valor].nombre}
                        </option>
                      ))}
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

        <div style={leyenda}>
          {ROLES.map((valor) => (
            <div key={valor} style={leyendaFila}>
              <span style={leyendaRol}>
                <span style={leyendaEmoji}>{ROL[valor].emoji}</span>
                {ROL[valor].nombre}
              </span>
              <span style={ui.note}>{ROL[valor].alcance}</span>
            </div>
          ))}

          <p style={{ ...ui.note, margin: 0 }}>
            La empresa es sólo del desarrollador: en los otros tres roles se
            guarda sin empresa, aunque el desplegable ofrezca una.
          </p>
        </div>
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
  gridTemplateColumns: "auto 1.4fr 1fr 1.2fr auto",
  gap: "12px",
  alignItems: "end",
  borderTop: "1px solid #eeeeee",
  paddingTop: "16px",
};

const filaPendiente = {
  ...fila,
  borderTop: "1px solid #111111",
};

// El emoji del rol, a la altura de los inputs de al lado.
const distintivo = {
  width: "43px",
  height: "43px",
  borderRadius: "999px",
  border: "1px solid #eeeeee",
  background: "#fafafa",
  display: "grid",
  placeItems: "center",
  fontSize: "20px",
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

const leyenda = {
  display: "grid",
  gap: "10px",
  marginTop: "28px",
  borderTop: "1px solid #eeeeee",
  paddingTop: "20px",
};

const leyendaFila = {
  display: "grid",
  gridTemplateColumns: "180px 1fr",
  gap: "12px",
  alignItems: "baseline",
};

const leyendaRol = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  color: "#111111",
};

const leyendaEmoji = {
  fontSize: "16px",
};
