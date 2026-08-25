"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TIPOS } from "@/lib/inversores";
import { createClient } from "@/lib/supabase/server";

/**
 * Alta, corrección y baja de una ficha de la agenda.
 *
 * Los dos compromisos se guardan por separado y pueden ser cero: alguien que
 * todavía no firmó por un monto igual entra en la agenda, para que sus aportes
 * caigan en su ficha desde el primero.
 */
function leerFormulario(formData: FormData) {
  return {
    tipo: String(formData.get("tipo") ?? "Inversor"),
    nombre: String(formData.get("nombre") ?? "").trim(),
    apellido: String(formData.get("apellido") ?? "").trim(),
    comprometidoArs: Number(formData.get("comprometido_ars") ?? 0),
    comprometidoUsd: Number(formData.get("comprometido_usd") ?? 0),
    observaciones: String(formData.get("observaciones") ?? "").trim(),
  };
}

/** Devuelve el mensaje de error, o null si está todo bien. */
function validar(campos: ReturnType<typeof leerFormulario>) {
  if (!TIPOS.includes(campos.tipo)) return "Elegí si es inversor o comprador.";
  if (!campos.nombre) return "Poné el nombre.";
  if (!Number.isFinite(campos.comprometidoArs) || campos.comprometidoArs < 0) {
    return "El monto comprometido en pesos no puede ser negativo.";
  }
  if (!Number.isFinite(campos.comprometidoUsd) || campos.comprometidoUsd < 0) {
    return "El monto comprometido en dólares no puede ser negativo.";
  }

  return null;
}

/** Los campos tal como van a la base, comunes al alta y a la edición. */
function aFila(campos: ReturnType<typeof leerFormulario>) {
  return {
    tipo: campos.tipo,
    nombre: campos.nombre,
    apellido: campos.apellido === "" ? null : campos.apellido,
    comprometido_ars: campos.comprometidoArs,
    comprometido_usd: campos.comprometidoUsd,
    observaciones: campos.observaciones === "" ? null : campos.observaciones,
  };
}

/**
 * El índice que impide dos fichas con el mismo nombre habla en jerga de
 * Postgres. Acá se traduce, que es lo único que le importa a quien carga.
 */
function traducirError(mensaje: string, nombre: string) {
  return mensaje.includes("inversores_sin_repetir")
    ? `Ya hay una ficha de ${nombre} en esta obra. Cargá sus aportes en la que existe.`
    : mensaje;
}

export async function crearInversor(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const campos = leerFormulario(formData);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/inversores/nuevo?error=${encodeURIComponent(mensaje)}`
    );

  const invalido = validar(campos);
  if (invalido) volver(invalido);

  const supabase = await createClient();

  const { error } = await supabase
    .from("inversores")
    .insert({ obra_id: obraId, ...aFila(campos) });

  if (error) volver(traducirError(error.message, campos.nombre));

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/inversores`);
}

export async function actualizarInversor(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const inversorId = String(formData.get("inversor_id") ?? "");
  const campos = leerFormulario(formData);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/inversores/${inversorId}/editar?error=${encodeURIComponent(mensaje)}`
    );

  const invalido = validar(campos);
  if (invalido) volver(invalido);

  const supabase = await createClient();

  const { error } = await supabase
    .from("inversores")
    .update(aFila(campos))
    .eq("id", inversorId);

  if (error) volver(traducirError(error.message, campos.nombre));

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/inversores`);
}

export async function eliminarInversor(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const inversorId = String(formData.get("inversor_id") ?? "");

  const supabase = await createClient();

  const { error } = await supabase
    .from("inversores")
    .delete()
    .eq("id", inversorId);

  if (error) {
    // La base no deja borrar a alguien con aportes cargados (`restrict`): eso
    // sería borrar plata que entró de verdad.
    const mensaje = error.message.includes("ingresos_inversor_id_fkey")
      ? "No se puede eliminar: tiene aportes cargados. Primero hay que resolver esos ingresos."
      : error.message;

    redirect(
      `/obras/${slug}/inversores/${inversorId}/editar?error=${encodeURIComponent(mensaje)}`
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/inversores`);
}
