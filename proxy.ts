import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada request y bloquea el acceso a quien
 * no esté logueado.
 *
 * OJO: en Next.js 16 esto se llama Proxy, no Middleware. La documentación de
 * Supabase todavía dice `middleware.ts`, que en esta versión no se ejecuta.
 *
 * Esto es sólo una primera barrera para redirigir rápido. La seguridad de
 * verdad está en el RLS de la base: aunque alguien saltee esto, sin sesión
 * válida las queries no devuelven nada.
 */
export async function proxy(request: NextRequest) {
  // En el login no hay sesión que validar, así que preguntarle a Supabase es
  // un viaje de ida y vuelta por la red al pedo. Con la conexión lenta se nota:
  // la pantalla donde alguien está esperando para entrar es justo la que no
  // tiene por qué esperar.
  if (request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.next({ request });
  }

  // Sin cookie de sesión no hay nada que validar: se manda al login sin
  // preguntarle a Supabase. Esto no relaja nada —una cookie inventada igual
  // tiene que pasar por getUser() más abajo— pero le ahorra un viaje por la red
  // a quien entra sin haber iniciado sesión.
  const haySesion = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!haySesion) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() valida el token contra Supabase. No usar getSession() acá:
  // ese lee la cookie sin verificarla y se puede falsificar.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Hay que devolver este response y no uno nuevo: si no, se pierden las
  // cookies de sesión actualizadas y el usuario se desloguea solo.
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
