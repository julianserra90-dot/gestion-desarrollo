import AppSidebarRail, { type ItemSidebar } from "@/components/AppSidebarRail";
import { createClient } from "@/lib/supabase/server";

const ITEMS: ItemSidebar[] = [
  { clave: "obras", label: "Obras", href: "/", icono: "grid" },
  {
    clave: "prefactibilidades",
    label: "Prefactibilidades",
    href: "/prefactibilidades",
    icono: "prefactibilidad",
  },
  { clave: "empresas", label: "Empresas", href: "/empresas", icono: "edificio" },
  { clave: "usuarios", label: "Usuarios", href: "/usuarios", icono: "usuarios" },
  { clave: "perfil", label: "Mi perfil", href: "/perfil", icono: "perfil" },
];

/** Organizar usuarios es del administrador: al resto ni se le ofrece. */
const SOLO_ADMIN = ["usuarios"];

/**
 * La misma franja lateral de `ObraSidebar`, pero para las pantallas que no son
 * de una obra puntual. Sin grupos ni selector: son destinos fijos y Salir, así
 * que va todo en una sola lista.
 */
export default async function AppSidebar({ activo }: { activo: string }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const esAdmin = perfil?.rol === "admin";
  const items = esAdmin
    ? ITEMS
    : ITEMS.filter((item) => !SOLO_ADMIN.includes(item.clave));

  return <AppSidebarRail activo={activo} items={items} />;
}
