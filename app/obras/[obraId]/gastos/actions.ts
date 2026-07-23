"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { getCotizacionDeFecha } from "@/lib/dolar";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

type GastoUpdate = Database["public"]["Tables"]["gastos"]["Update"];

/**
 * Deja el gasto expresado en las dos monedas.
 *
 * Se guarda siempre el valor en pesos (es lo que suman los totales) más el
 * equivalente en dólares y la cotización usada. La conversión va al dólar
 * oficial de la fecha del gasto, no al del día en que se carga.
 */
async function convertirMonto(
  montoIngresado: number,
  moneda: string,
  fecha: string
): Promise<
  | { ok: true; ars: number; usd: number | null; cotizacion: number | null }
  | { ok: false; error: string }
> {
  const cotizacion = await getCotizacionDeFecha(fecha);

  if (moneda === "USD") {
    // Sin cotización no hay forma de saber cuántos pesos son: mejor frenar que
    // guardar un gasto que rompería los totales.
    if (!cotizacion) {
      return {
        ok: false,
        error:
          "No se pudo obtener la cotización del dólar para convertir el gasto a pesos. Probá de nuevo en un rato o cargalo en pesos.",
      };
    }

    return {
      ok: true,
      ars: Math.round(montoIngresado * cotizacion * 100) / 100,
      usd: montoIngresado,
      cotizacion,
    };
  }

  return {
    ok: true,
    ars: montoIngresado,
    usd: cotizacion ? Math.round((montoIngresado / cotizacion) * 100) / 100 : null,
    cotizacion,
  };
}

/** Materiales se compran a un proveedor; la mano de obra la hace un contratista. */
function tipoProveedorPara(tipoGasto: string) {
  return tipoGasto === "Mano de obra" ? "Contratista" : "Proveedor";
}

/**
 * Resuelve qué proveedor va en el gasto.
 *
 * Si el formulario mandó uno nuevo, se crea (o se reutiliza el que ya exista
 * con ese nombre y tipo, para no duplicar el catálogo). Si no, se usa el
 * seleccionado del desplegable.
 */
async function resolverProveedor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  tipoGasto: string
): Promise<{ id: string | null; error?: string }> {
  const nuevo = String(formData.get("proveedor_nuevo") ?? "").trim();
  const seleccionado = String(formData.get("proveedor_id") ?? "");

  if (!nuevo) {
    // "__nuevo__" sin nombre escrito equivale a no elegir nada.
    return { id: seleccionado && !seleccionado.startsWith("__") ? seleccionado : null };
  }

  const tipo = tipoProveedorPara(tipoGasto);

  const { data: existente } = await supabase
    .from("proveedores")
    .select("id")
    .eq("nombre", nuevo)
    .eq("tipo", tipo)
    .maybeSingle();

  if (existente) return { id: existente.id };

  const { data: creado, error } = await supabase
    .from("proveedores")
    .insert({ nombre: nuevo, tipo })
    .select("id")
    .single();

  if (error || !creado) {
    return { id: null, error: error?.message ?? "No se pudo crear el proveedor." };
  }

  return { id: creado.id };
}

export async function crearGasto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const monto = Number(formData.get("monto") ?? 0);
  const tipoPago = String(formData.get("tipo_pago") ?? "Facturado");
  const empresaPagadora = String(formData.get("empresa_pagadora_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const rubro = String(formData.get("rubro_id") ?? "");
  const tipoGasto = String(formData.get("tipo_gasto") ?? "Materiales");
  const esAjuste = tipoGasto === "Ajuste de saldo";
  // Todos los ajustes llevan el mismo detalle, venga lo que venga del form.
  const concepto = esAjuste
    ? "Ajuste de saldo"
    : String(formData.get("concepto") ?? "").trim();
  const receptora = String(formData.get("empresa_receptora_id") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const comprobante = formData.get("comprobante");

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/gastos/nuevo?error=${encodeURIComponent(mensaje)}`
    );

  if (!concepto) volver("Poné un detalle para el gasto.");
  if (!empresaPagadora) volver("Elegí qué empresa pagó el gasto.");
  if (!fecha) volver("Poné la fecha del gasto.");
  if (!Number.isFinite(monto) || monto <= 0) {
    volver("El monto tiene que ser mayor a cero.");
  }
  if (esAjuste && !receptora) {
    volver("Elegí a qué empresa se le transfiere.");
  }
  if (esAjuste && receptora === empresaPagadora) {
    volver("Una empresa no puede transferirse a sí misma.");
  }

  // El comprobante es opcional. Si vino, se sube a Drive antes de guardar.
  let archivoComprobante: Awaited<ReturnType<typeof subirArchivo>> | null = null;
  if (comprobante instanceof File && comprobante.size > 0) {
    archivoComprobante = await subirArchivo({
      archivo: comprobante,
      nombre: comprobante.name,
      obraSlug: slug,
      tipo: "comprobantes",
    }).catch((e) => {
      volver(`No se pudo subir el comprobante: ${e instanceof Error ? e.message : "error"}`);
      return null;
    });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const proveedor = await resolverProveedor(supabase, formData, tipoGasto);
  if (proveedor.error) {
    if (archivoComprobante) {
      await eliminarArchivo(archivoComprobante.id).catch(() => {});
    }
    volver(proveedor.error);
  }

  const moneda = String(formData.get("moneda") ?? "ARS");
  const montos = await convertirMonto(monto, moneda, fecha);

  if (!montos.ok) {
    if (archivoComprobante) {
      await eliminarArchivo(archivoComprobante.id).catch(() => {});
    }
    volver(montos.error);
    return;
  }

  const { error } = await supabase.from("gastos").insert({
    obra_id: obraId,
    fecha,
    // Un ajuste no lleva rubro ni proveedor: no se compró nada.
    rubro_id: esAjuste || rubro === "" ? null : rubro,
    concepto,
    tipo_gasto: tipoGasto,
    proveedor_id: esAjuste ? null : proveedor.id,
    empresa_receptora_id: esAjuste ? receptora : null,
    empresa_pagadora_id: empresaPagadora,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    tipo_pago: tipoPago,
    moneda,
    // Un gasto se carga cuando ya se pagó, así que no se pregunta el estado.
    estado: "Pagado",
    observaciones: observaciones === "" ? null : observaciones,
    cargado_por: user?.id ?? null,
    comprobante_drive_id: archivoComprobante?.id ?? null,
    comprobante_nombre: archivoComprobante?.nombre ?? null,
    comprobante_mime: archivoComprobante?.mimeType ?? null,
    comprobante_tamano: archivoComprobante?.tamano ?? null,
  });

  if (error) {
    // Si falló guardar el gasto, se limpia el comprobante ya subido a Drive.
    if (archivoComprobante) {
      await eliminarArchivo(archivoComprobante.id).catch(() => {});
    }
    volver(error.message);
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos`);
}

export async function actualizarGasto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const gastoId = String(formData.get("gasto_id") ?? "");
  const monto = Number(formData.get("monto") ?? 0);
  const tipoPago = String(formData.get("tipo_pago") ?? "Facturado");
  const empresaPagadora = String(formData.get("empresa_pagadora_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const rubro = String(formData.get("rubro_id") ?? "");
  const tipoGasto = String(formData.get("tipo_gasto") ?? "Materiales");
  const esAjuste = tipoGasto === "Ajuste de saldo";
  // Todos los ajustes llevan el mismo detalle, venga lo que venga del form.
  const concepto = esAjuste
    ? "Ajuste de saldo"
    : String(formData.get("concepto") ?? "").trim();
  const receptora = String(formData.get("empresa_receptora_id") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const comprobante = formData.get("comprobante");
  const quitarComprobante = formData.get("quitar_comprobante") === "on";

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/gastos/${gastoId}/editar?error=${encodeURIComponent(mensaje)}`
    );

  if (!concepto) volver("Poné un detalle para el gasto.");
  if (!empresaPagadora) volver("Elegí qué empresa pagó el gasto.");
  if (!fecha) volver("Poné la fecha del gasto.");
  if (!Number.isFinite(monto) || monto <= 0) {
    volver("El monto tiene que ser mayor a cero.");
  }
  if (esAjuste && !receptora) {
    volver("Elegí a qué empresa se le transfiere.");
  }
  if (esAjuste && receptora === empresaPagadora) {
    volver("Una empresa no puede transferirse a sí misma.");
  }

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("gastos")
    .select("comprobante_drive_id, obra_id")
    .eq("id", gastoId)
    .maybeSingle();

  if (!actual) {
    volver("No se encontró el gasto.");
    return;
  }

  const proveedor = await resolverProveedor(supabase, formData, tipoGasto);
  if (proveedor.error) {
    volver(proveedor.error);
  }

  const moneda = String(formData.get("moneda") ?? "ARS");
  const montos = await convertirMonto(monto, moneda, fecha);
  if (!montos.ok) {
    volver(montos.error);
    return;
  }

  // El comprobante puede quedar igual, reemplazarse o quitarse.
  const cambios: GastoUpdate = {
    fecha,
    rubro_id: esAjuste || rubro === "" ? null : rubro,
    concepto,
    tipo_gasto: tipoGasto,
    proveedor_id: esAjuste ? null : proveedor.id,
    empresa_receptora_id: esAjuste ? receptora : null,
    empresa_pagadora_id: empresaPagadora,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    tipo_pago: tipoPago,
    moneda,
    observaciones: observaciones === "" ? null : observaciones,
  };

  let subidoAhora: string | null = null;

  if (comprobante instanceof File && comprobante.size > 0) {
    const archivo = await subirArchivo({
      archivo: comprobante,
      nombre: comprobante.name,
      obraSlug: slug,
      tipo: "comprobantes",
    }).catch((e) => {
      volver(`No se pudo subir el comprobante: ${e instanceof Error ? e.message : "error"}`);
      return null;
    });

    if (archivo) {
      subidoAhora = archivo.id;
      cambios.comprobante_drive_id = archivo.id;
      cambios.comprobante_nombre = archivo.nombre;
      cambios.comprobante_mime = archivo.mimeType;
      cambios.comprobante_tamano = archivo.tamano;
    }
  } else if (quitarComprobante) {
    cambios.comprobante_drive_id = null;
    cambios.comprobante_nombre = null;
    cambios.comprobante_mime = null;
    cambios.comprobante_tamano = null;
  }

  const { error } = await supabase.from("gastos").update(cambios).eq("id", gastoId);

  if (error) {
    // Si la actualización falla, se limpia el archivo recién subido.
    if (subidoAhora) await eliminarArchivo(subidoAhora).catch(() => {});
    volver(error.message);
  }

  // Recién con el cambio confirmado se borra el comprobante viejo de Drive.
  const seReemplazo = subidoAhora && actual.comprobante_drive_id;
  if ((seReemplazo || quitarComprobante) && actual.comprobante_drive_id) {
    await eliminarArchivo(actual.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos`);
}

export async function anularGasto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const gastoId = String(formData.get("gasto_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("gastos")
    .update({ estado: "Anulado" })
    .eq("id", gastoId);

  if (error) {
    redirect(
      `/obras/${slug}/gastos/${gastoId}/editar?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos`);
}

export async function restaurarGasto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const gastoId = String(formData.get("gasto_id") ?? "");

  const supabase = await createClient();
  await supabase.from("gastos").update({ estado: "Pagado" }).eq("id", gastoId);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos`);
}

export async function eliminarGasto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const gastoId = String(formData.get("gasto_id") ?? "");

  const supabase = await createClient();

  const { data: gasto } = await supabase
    .from("gastos")
    .select("comprobante_drive_id")
    .eq("id", gastoId)
    .maybeSingle();

  const { error } = await supabase.from("gastos").delete().eq("id", gastoId);

  if (error) {
    redirect(
      `/obras/${slug}/gastos/${gastoId}/editar?error=${encodeURIComponent(error.message)}`
    );
  }

  if (gasto?.comprobante_drive_id) {
    await eliminarArchivo(gasto.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos`);
}
