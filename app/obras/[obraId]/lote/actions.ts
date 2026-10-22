"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { esCategoriaLote, PAGO_COMPARTIDO } from "@/lib/lote-tipos";
import { noTocoNada, sinPermisoPara } from "@/lib/permisos";
import { createClient } from "@/lib/supabase/server";

type PagoLoteUpdate = Database["public"]["Tables"]["lote_pagos"]["Update"];

/**
 * Guarda la ficha del lote: la compra y la identificación del inmueble.
 *
 * Se edita desde Editar obra → Datos lote. Son datos que se cargan al comprar y
 * después casi no se tocan, al revés que los pagos.
 */
export async function guardarDatosLote(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");

  const valor = String(formData.get("lote_valor_usd") ?? "").trim();
  const superficie = String(formData.get("lote_superficie_m2") ?? "").trim();

  /** Un campo vacío se guarda como null, no como cadena vacía. */
  const texto = (campo: string) => {
    const valor = String(formData.get(campo) ?? "").trim();
    return valor === "" ? null : valor;
  };

  const supabase = await createClient();

  const { error } = await supabase
    .from("obras")
    .update({
      lote_valor_usd: valor === "" ? null : Number(valor),
      lote_superficie_m2: superficie === "" ? null : Number(superficie),
      lote_vendedor: texto("lote_vendedor"),
      lote_propietario: texto("lote_propietario"),
      lote_partida: texto("lote_partida"),
      lote_circunscripcion: texto("lote_circunscripcion"),
      lote_seccion: texto("lote_seccion"),
      lote_manzana: texto("lote_manzana"),
      lote_parcela: texto("lote_parcela"),
      lote_detalle: texto("lote_detalle"),
    })
    .eq("id", obraId);

  if (error) {
    redirect(
      `/obras/${slug}/editar/lote?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/lote`);
}

type CamposPago = {
  fecha: string;
  categoria: string;
  concepto: string;
  monto: number;
  moneda: string;
  /**
   * El cambio con el que se hizo el pago, si se cargó a mano. Null deja que se
   * valúe al blue de su fecha, que es el caso de siempre.
   */
  cotizacion: number | null;
  observaciones: string;
  /** La socia que pagó, o null si es compartido. */
  empresaId: string | null;
  compartido: boolean;
};

/**
 * El cambio cargado a mano, o null.
 *
 * Mismo criterio que en un gasto de obra (`leerCaja`): la casilla sin tildar, o
 * tildada con un valor que no es un número mayor a cero, es "no se cargó". No
 * se guarda un cero, que se leería como un cambio de cero pesos por dólar.
 */
function leerCotizacion(formData: FormData): number | null {
  const manual = formData.get("cotizacion_manual") === "on";
  const valor = Number(formData.get("cotizacion_valor") ?? 0);

  return manual && Number.isFinite(valor) && valor > 0 ? valor : null;
}

function leerPago(formData: FormData): CamposPago {
  const quienPago = String(formData.get("empresa_id") ?? "").trim();
  const compartido = quienPago === PAGO_COMPARTIDO;

  return {
    fecha: String(formData.get("fecha") ?? "").trim(),
    categoria: String(formData.get("categoria") ?? "").trim(),
    concepto: String(formData.get("concepto") ?? "").trim(),
    monto: Number(formData.get("monto") ?? 0),
    moneda: String(formData.get("moneda") ?? "USD"),
    cotizacion: leerCotizacion(formData),
    observaciones: String(formData.get("observaciones") ?? "").trim(),
    empresaId: compartido || quienPago === "" ? null : quienPago,
    compartido,
  };
}

/** Devuelve el problema, o null si está todo bien. */
function validar(p: CamposPago): string | null {
  if (!esCategoriaLote(p.categoria)) {
    return "Elegí qué tipo de pago es.";
  }
  if (!p.concepto) {
    return "Poné un concepto (seña, escritura, honorarios...).";
  }
  if (!p.compartido && !p.empresaId) {
    return "Elegí quién hizo el pago.";
  }
  if (!Number.isFinite(p.monto) || p.monto <= 0) {
    return "El monto tiene que ser mayor a cero.";
  }
  if (p.moneda !== "ARS" && p.moneda !== "USD") {
    return "Elegí la moneda del pago.";
  }
  return null;
}

export async function crearPagoLote(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const campos = leerPago(formData);
  const comprobante = formData.get("comprobante");

  // El error vuelve al formulario, no a la solapa: el alta tiene su propia
  // pantalla, y mandarlo al listado sería hacerle empezar de nuevo.
  const volver = (mensaje: string): never =>
    redirect(`/obras/${slug}/lote/nuevo?error=${encodeURIComponent(mensaje)}`);

  const problema = validar(campos);
  if (problema) {
    volver(problema);
    return;
  }

  // El comprobante es opcional. Si vino, se sube a Drive antes de guardar.
  let archivo: Awaited<ReturnType<typeof subirArchivo>> | null = null;
  if (comprobante instanceof File && comprobante.size > 0) {
    archivo = await subirArchivo({
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

  const { error } = await supabase.from("lote_pagos").insert({
    obra_id: obraId,
    fecha: campos.fecha === "" ? undefined : campos.fecha,
    categoria: campos.categoria,
    concepto: campos.concepto,
    monto: campos.monto,
    moneda: campos.moneda,
    cotizacion: campos.cotizacion,
    observaciones: campos.observaciones === "" ? null : campos.observaciones,
    empresa_id: campos.empresaId,
    compartido: campos.compartido,
    comprobante_drive_id: archivo?.id ?? null,
    comprobante_nombre: archivo?.nombre ?? null,
    comprobante_mime: archivo?.mimeType ?? null,
    comprobante_tamano: archivo?.tamano ?? null,
  });

  if (error) {
    if (archivo) await eliminarArchivo(archivo.id).catch(() => {});
    volver(error.message);
    return;
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/lote`);
}

export async function actualizarPagoLote(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const pagoId = String(formData.get("pago_id") ?? "");
  const campos = leerPago(formData);
  const comprobante = formData.get("comprobante");
  const quitarComprobante = formData.get("quitar_comprobante") === "on";

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/lote/${pagoId}/editar?error=${encodeURIComponent(mensaje)}`
    );

  const problema = validar(campos);
  if (problema) {
    volver(problema);
    return;
  }

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("lote_pagos")
    .select("comprobante_drive_id")
    .eq("id", pagoId)
    .eq("obra_id", obraId)
    .maybeSingle();

  if (!actual) {
    volver("No se encontró el pago.");
    return;
  }

  const cambios: PagoLoteUpdate = {
    fecha: campos.fecha === "" ? undefined : campos.fecha,
    categoria: campos.categoria,
    concepto: campos.concepto,
    monto: campos.monto,
    moneda: campos.moneda,
    // Va siempre, también en null: destildar la casilla tiene que **borrar** el
    // cambio cargado antes, no dejar el viejo pegado al pago.
    cotizacion: campos.cotizacion,
    observaciones: campos.observaciones === "" ? null : campos.observaciones,
    empresa_id: campos.empresaId,
    compartido: campos.compartido,
  };

  let subidoAhora: string | null = null;

  if (comprobante instanceof File && comprobante.size > 0) {
    const nuevo = await subirArchivo({
      archivo: comprobante,
      nombre: comprobante.name,
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

  const { error } = await supabase
    .from("lote_pagos")
    .update(cambios)
    .eq("id", pagoId)
    .eq("obra_id", obraId);

  if (error) {
    if (subidoAhora) await eliminarArchivo(subidoAhora).catch(() => {});
    volver(error.message);
    return;
  }

  const seReemplazo = subidoAhora && actual.comprobante_drive_id;
  if ((seReemplazo || quitarComprobante) && actual.comprobante_drive_id) {
    await eliminarArchivo(actual.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/lote`);
}

export async function eliminarPagoLote(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const pagoId = String(formData.get("pago_id") ?? "");

  const supabase = await createClient();

  const { data: pago } = await supabase
    .from("lote_pagos")
    .select("comprobante_drive_id")
    .eq("id", pagoId)
    .eq("obra_id", obraId)
    .maybeSingle();

  const { data: borrados, error } = await supabase
    .from("lote_pagos")
    .delete()
    .eq("id", pagoId)
    .eq("obra_id", obraId)
    .select("id");

  if (error) {
    redirect(`/obras/${slug}/lote?error=${encodeURIComponent(error.message)}`);
  }

  // Antes de Drive, como en gastos e ingresos (`lib/permisos.ts`).
  if (noTocoNada(borrados)) {
    redirect(
      `/obras/${slug}/lote?error=${encodeURIComponent(
        sinPermisoPara("borrar este pago")
      )}`
    );
  }

  if (pago?.comprobante_drive_id) {
    await eliminarArchivo(pago.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/lote`);
}
