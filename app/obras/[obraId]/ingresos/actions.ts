"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { convertirMonto } from "@/lib/dolar";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

type IngresoUpdate = Database["public"]["Tables"]["ingresos"]["Update"];

const DE_SOCIA = "Empresa socia";
const ORIGENES = [DE_SOCIA, "Inversor", "Comprador"];

/**
 * Campos comunes al alta y a la edición.
 *
 * Según el origen se completa una cosa u otra: si la plata la pone una socia
 * queda apuntada la empresa; si la pone un inversor o un comprador se guarda
 * el nombre suelto, porque no están en el catálogo de empresas.
 */
function leerFormulario(formData: FormData) {
  const origen = String(formData.get("origen") ?? DE_SOCIA);
  const esDeSocia = origen === DE_SOCIA;

  return {
    origen,
    esDeSocia,
    empresaId: String(formData.get("empresa_id") ?? ""),
    aportante: String(formData.get("aportante") ?? "").trim(),
    fecha: String(formData.get("fecha") ?? "").trim(),
    concepto: String(formData.get("concepto") ?? "").trim(),
    monto: Number(formData.get("monto") ?? 0),
    moneda: String(formData.get("moneda") ?? "ARS"),
    observaciones: String(formData.get("observaciones") ?? "").trim(),
    comprobante: formData.get("comprobante"),
  };
}

/** Devuelve el mensaje de error, o null si está todo bien. */
function validar(campos: ReturnType<typeof leerFormulario>) {
  if (!ORIGENES.includes(campos.origen)) return "Elegí de dónde viene la plata.";
  if (!campos.fecha) return "Poné la fecha del ingreso.";
  if (!campos.concepto) return "Poné un detalle para el ingreso.";
  if (!Number.isFinite(campos.monto) || campos.monto <= 0) {
    return "El monto tiene que ser mayor a cero.";
  }
  if (campos.esDeSocia && !campos.empresaId) {
    return "Elegí qué empresa socia pone la plata.";
  }
  if (!campos.esDeSocia && !campos.aportante) {
    return `Poné el nombre ${campos.origen === "Inversor" ? "del inversor" : "del comprador"}.`;
  }

  return null;
}

export async function crearIngreso(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const campos = leerFormulario(formData);

  const volver = (mensaje: string): never =>
    redirect(`/obras/${slug}/ingresos/nuevo?error=${encodeURIComponent(mensaje)}`);

  const invalido = validar(campos);
  if (invalido) volver(invalido);

  // El comprobante es opcional. Si vino, se sube a Drive antes de guardar.
  let archivo: Awaited<ReturnType<typeof subirArchivo>> | null = null;
  if (campos.comprobante instanceof File && campos.comprobante.size > 0) {
    archivo = await subirArchivo({
      archivo: campos.comprobante,
      nombre: campos.comprobante.name,
      obraSlug: slug,
      tipo: "comprobantes",
    }).catch((e) => {
      volver(`No se pudo subir el comprobante: ${e instanceof Error ? e.message : "error"}`);
      return null;
    });
  }

  const montos = await convertirMonto(campos.monto, campos.moneda, campos.fecha);

  if (!montos.ok) {
    if (archivo) await eliminarArchivo(archivo.id).catch(() => {});
    volver(montos.error);
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("ingresos").insert({
    obra_id: obraId,
    fecha: campos.fecha,
    origen: campos.origen,
    empresa_id: campos.esDeSocia ? campos.empresaId : null,
    aportante: campos.esDeSocia ? null : campos.aportante,
    concepto: campos.concepto,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    moneda: campos.moneda,
    observaciones: campos.observaciones === "" ? null : campos.observaciones,
    cargado_por: user?.id ?? null,
    comprobante_drive_id: archivo?.id ?? null,
    comprobante_nombre: archivo?.nombre ?? null,
    comprobante_mime: archivo?.mimeType ?? null,
    comprobante_tamano: archivo?.tamano ?? null,
  });

  if (error) {
    // Si falló guardar, se limpia el comprobante ya subido a Drive.
    if (archivo) await eliminarArchivo(archivo.id).catch(() => {});
    volver(error.message);
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/ingresos`);
}

export async function actualizarIngreso(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ingresoId = String(formData.get("ingreso_id") ?? "");
  const quitarComprobante = formData.get("quitar_comprobante") === "on";
  const campos = leerFormulario(formData);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/ingresos/${ingresoId}/editar?error=${encodeURIComponent(mensaje)}`
    );

  const invalido = validar(campos);
  if (invalido) volver(invalido);

  const montos = await convertirMonto(campos.monto, campos.moneda, campos.fecha);
  if (!montos.ok) {
    volver(montos.error);
    return;
  }

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("ingresos")
    .select("comprobante_drive_id")
    .eq("id", ingresoId)
    .maybeSingle();

  if (!actual) {
    volver("No se encontró el ingreso.");
    return;
  }

  const cambios: IngresoUpdate = {
    fecha: campos.fecha,
    origen: campos.origen,
    empresa_id: campos.esDeSocia ? campos.empresaId : null,
    aportante: campos.esDeSocia ? null : campos.aportante,
    concepto: campos.concepto,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    moneda: campos.moneda,
    observaciones: campos.observaciones === "" ? null : campos.observaciones,
  };

  let subidoAhora: string | null = null;

  if (campos.comprobante instanceof File && campos.comprobante.size > 0) {
    const nuevo = await subirArchivo({
      archivo: campos.comprobante,
      nombre: campos.comprobante.name,
      obraSlug: slug,
      tipo: "comprobantes",
    }).catch((e) => {
      volver(`No se pudo subir el comprobante: ${e instanceof Error ? e.message : "error"}`);
      return null;
    });

    if (nuevo) {
      subidoAhora = nuevo.id;
      cambios.comprobante_drive_id = nuevo.id;
      cambios.comprobante_nombre = nuevo.nombre;
      cambios.comprobante_mime = nuevo.mimeType;
      cambios.comprobante_tamano = nuevo.tamano;
    }
  } else if (quitarComprobante) {
    cambios.comprobante_drive_id = null;
    cambios.comprobante_nombre = null;
    cambios.comprobante_mime = null;
    cambios.comprobante_tamano = null;
  }

  // Bajar el monto de un ingreso que ya se gastó dejaría la caja en rojo. La
  // base lo frena y el mensaje que devuelve explica por qué.
  const { error } = await supabase
    .from("ingresos")
    .update(cambios)
    .eq("id", ingresoId);

  if (error) {
    if (subidoAhora) await eliminarArchivo(subidoAhora).catch(() => {});
    volver(error.message);
  }

  // Recién con el cambio confirmado se borra el comprobante viejo de Drive.
  const seReemplazo = subidoAhora && actual.comprobante_drive_id;
  if ((seReemplazo || quitarComprobante) && actual.comprobante_drive_id) {
    await eliminarArchivo(actual.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/ingresos`);
}

export async function eliminarIngreso(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ingresoId = String(formData.get("ingreso_id") ?? "");

  const supabase = await createClient();

  const { data: ingreso } = await supabase
    .from("ingresos")
    .select("comprobante_drive_id")
    .eq("id", ingresoId)
    .maybeSingle();

  const { error } = await supabase.from("ingresos").delete().eq("id", ingresoId);

  if (error) {
    redirect(
      `/obras/${slug}/ingresos/${ingresoId}/editar?error=${encodeURIComponent(error.message)}`
    );
  }

  if (ingreso?.comprobante_drive_id) {
    await eliminarArchivo(ingreso.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/ingresos`);
}
