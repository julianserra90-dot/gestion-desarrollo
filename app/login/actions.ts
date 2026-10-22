"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function iniciarSesion(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=" + encodeURIComponent("Completá email y contraseña."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=" + encodeURIComponent(porQueNoEntro(error)));
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}

// ============================== helpers =====================================

/**
 * Por qué no se pudo entrar, en lo que se le dice a la persona.
 *
 * El mensaje de credenciales es genérico a propósito —no conviene revelar si el
 * email existe— pero se usaba para **todo** error, y entonces una caída de
 * Supabase, un corte de red o el proyecto pausado se leían como una contraseña
 * mal puesta: se prueban contraseñas en vez de mirar el estado del servicio.
 * Es el criterio que `lib/dolar.ts` ya aplica a la cotización (si la fuente
 * falla, la pantalla lo avisa en vez de mostrar números falsos), que acá
 * faltaba.
 *
 * El corte lo marca `status`: con un 4xx el servicio contestó y el problema es
 * del pedido; con 0, sin `status` o con 5xx no hubo respuesta que creerle. Lo
 * documenta la propia librería —los errores que ocurren antes de recibir una
 * respuesta no traen `status`— y es más confiable que mirar el mensaje, que
 * cambia entre versiones.
 *
 * El tipo va por su forma y no como `AuthError`: esa clase la define
 * `@supabase/auth-js`, que es una dependencia transitiva y no está en el
 * `package.json`.
 */
function porQueNoEntro(error: { status?: number; code?: string }): string {
  const status = error.status ?? 0;

  if (status < 400 || status >= 500) {
    return "No se pudo conectar con el servicio de cuentas. No es tu contraseña: probá de nuevo en un rato.";
  }

  // Entrar mal muchas veces seguidas también frena, y tampoco es la
  // contraseña: decir que está mal manda a probar otra y a chocar de nuevo.
  if (status === 429 || error.code === "over_request_rate_limit") {
    return "Demasiados intentos seguidos. Esperá unos minutos y volvé a probar.";
  }

  return "Email o contraseña incorrectos.";
}
