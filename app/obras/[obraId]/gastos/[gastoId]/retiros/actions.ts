"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { leerItems } from "@/lib/items-material";
import { createClient } from "@/lib/supabase/server";

/**
 * Los retiros de un acopio: qué material entró a la obra y cuándo.
 *
 * El acopio se pagó de una vez; lo que entra se va registrando retiro por
 * retiro. Los items viajan con los mismos nombres que en el gasto
 * (`item_material`, `item_cantidad`, `item_precio`), leídos por `leerItems`.
 * El precio es opcional: si el acopio tiene ese material con precio, la
 * pantalla lo toma de ahí.
 */

function volverA(slug: string, gastoId: string, retiroId: string | null, mensaje: string): never {
  const ruta = retiroId
    ? `/obras/${slug}/gastos/${gastoId}/retiros/${retiroId}/editar`
    : `/obras/${slug}/gastos/${gastoId}/retiros/nuevo`;
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}

/** El acopio tiene que existir, ser de la obra y estar marcado como acopio. */
async function verificarAcopio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gastoId: string
) {
  const { data } = await supabase
    .from("gastos")
    .select("id, es_acopio")
    .eq("id", gastoId)
    .maybeSingle();
  return Boolean(data?.es_acopio);
}

export async function crearRetiro(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const gastoId = String(formData.get("gasto_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const items = leerItems(formData);

  if (!fecha) volverA(slug, gastoId, null, "Poné la fecha del retiro.");
  if (items.length === 0) {
    volverA(slug, gastoId, null, "Cargá qué materiales se retiraron.");
  }

  const supabase = await createClient();
  if (!(await verificarAcopio(supabase, gastoId))) {
    volverA(slug, gastoId, null, "Este gasto no es un acopio.");
  }

  const { data: retiro, error } = await supabase
    .from("acopio_retiros")
    .insert({
      gasto_id: gastoId,
      fecha,
      observaciones: observaciones === "" ? null : observaciones,
    })
    .select("id")
    .single();

  if (error || !retiro) volverA(slug, gastoId, null, error?.message ?? "No se pudo guardar.");

  const { error: errorItems } = await supabase
    .from("acopio_retiro_items")
    .insert(items.map((i) => ({ ...i, retiro_id: retiro.id })));

  if (errorItems) {
    // Sin items el retiro no dice nada: se borra y se avisa.
    await supabase.from("acopio_retiros").delete().eq("id", retiro.id);
    volverA(slug, gastoId, null, errorItems.message);
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos/${gastoId}`);
}

export async function actualizarRetiro(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const gastoId = String(formData.get("gasto_id") ?? "");
  const retiroId = String(formData.get("retiro_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const items = leerItems(formData);

  if (!fecha) volverA(slug, gastoId, retiroId, "Poné la fecha del retiro.");
  if (items.length === 0) {
    volverA(slug, gastoId, retiroId, "Cargá qué materiales se retiraron.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("acopio_retiros")
    .update({ fecha, observaciones: observaciones === "" ? null : observaciones })
    .eq("id", retiroId)
    .eq("gasto_id", gastoId);

  if (error) volverA(slug, gastoId, retiroId, error.message);

  // Los items se reemplazan enteros, como el detalle de un gasto.
  const { error: errorBorrado } = await supabase
    .from("acopio_retiro_items")
    .delete()
    .eq("retiro_id", retiroId);
  if (errorBorrado) volverA(slug, gastoId, retiroId, errorBorrado.message);

  const { error: errorItems } = await supabase
    .from("acopio_retiro_items")
    .insert(items.map((i) => ({ ...i, retiro_id: retiroId })));
  if (errorItems) volverA(slug, gastoId, retiroId, errorItems.message);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos/${gastoId}`);
}

export async function eliminarRetiro(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const gastoId = String(formData.get("gasto_id") ?? "");
  const retiroId = String(formData.get("retiro_id") ?? "");

  const supabase = await createClient();

  const { error } = await supabase
    .from("acopio_retiros")
    .delete()
    .eq("id", retiroId)
    .eq("gasto_id", gastoId);

  if (error) volverA(slug, gastoId, retiroId, error.message);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos/${gastoId}`);
}
