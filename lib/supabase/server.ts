import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Es async porque en esta versión de Next `cookies()` devuelve una promesa.
 * Hay que crearlo dentro de cada función que lo use: no se puede guardar en
 * una variable de módulo, porque las cookies son por request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Los Server Components no pueden escribir cookies. Se ignora a
            // propósito: el refresco de sesión lo resuelve el proxy.
          }
        },
      },
    }
  );
}

function requireEnv(nombre: string) {
  const valor = process.env[nombre];

  if (!valor || valor.startsWith("REEMPLAZAR_")) {
    throw new Error(
      `Falta ${nombre} en .env.local. Copiala del dashboard de Supabase, ` +
        `en Project Settings > API Keys.`
    );
  }

  return valor;
}
