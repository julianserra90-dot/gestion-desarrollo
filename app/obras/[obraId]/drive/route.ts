import { carpetaDeObra, enlaceDeCarpeta } from "@/lib/drive";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

/**
 * Lleva a la carpeta de la obra en Drive: busca su id —o la crea, si la obra
 * todavía no subió nada— y redirige.
 *
 * Va por acá y no como un enlace armado en la página para no preguntarle a
 * Drive en cada visita al Archivo: sólo se pregunta cuando se toca el botón.
 *
 * Lo puede usar cualquiera que vea la obra. Quién entra a la carpeta no lo
 * decide la app sino Drive: vive en el Drive de la cuenta que autorizó la app,
 * y la abre quien la tenga compartida. A los demás Google les muestra
 * "solicitar acceso"; los archivos los siguen viendo acá, en el Archivo.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ obraId: string }> }
) {
  const { obraId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 401 });

  // Con el cliente del usuario: si no puede ver la obra, no existe.
  const obra = await getObraPorSlug(obraId);
  if (!obra) return new Response("Obra no encontrada", { status: 404 });

  let carpetaId: string;
  try {
    carpetaId = await carpetaDeObra(obra.slug);
  } catch {
    return new Response("No se pudo llegar a Drive", { status: 502 });
  }

  return Response.redirect(enlaceDeCarpeta(carpetaId), 302);
}
