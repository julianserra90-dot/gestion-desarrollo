import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Cliente de Supabase para Client Components.
 *
 * Sólo hace falta donde el browser tenga que hablar con Supabase por su cuenta
 * (login, subida de archivos, realtime). Para leer datos preferimos hacerlo en
 * Server Components, que no exponen nada al cliente.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
