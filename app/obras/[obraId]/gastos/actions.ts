"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { convertirMonto, getCotizacionDeFecha } from "@/lib/dolar";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { getCaja } from "@/lib/caja";
import { centavos, repartirPago } from "@/lib/reparto";
import type { Reparto } from "@/lib/reparto";
import type { MontoConvertido } from "@/lib/dolar";
import { createClient } from "@/lib/supabase/server";

type GastoUpdate = Database["public"]["Tables"]["gastos"]["Update"];

/**
 * Lee del formulario cuánto se saca de cada lado de la cuenta y qué cotización
 * usar.
 *
 * La cotización manual pisa a la oficial en todo el gasto, no sólo en la
 * conversión de los dólares que salen de la cuenta: si conseguiste otro cambio,
 * ese es el valor real de lo que pagaste.
 */
function leerCaja(formData: FormData, esAjuste: boolean) {
  // Un ajuste de saldo mueve plata entre socias: nunca toca la cuenta.
  const usarCaja = formData.get("usar_caja") === "on" && !esAjuste;
  const manual = formData.get("cotizacion_manual") === "on";
  const valor = Number(formData.get("cotizacion_valor") ?? 0);

  return {
    usarCaja,
    cotizacionManual: manual && Number.isFinite(valor) && valor > 0 ? valor : null,
    pedidoArs: usarCaja ? Number(formData.get("caja_ars") ?? 0) || 0 : 0,
    pedidoUsd: usarCaja ? Number(formData.get("caja_usd") ?? 0) || 0 : 0,
  };
}

type Caja = ReturnType<typeof leerCaja>;

type Resuelto = MontoConvertido & {
  moneda?: string;
  /** Lo que efectivamente sale de la cuenta. */
  reparto?: Reparto;
};

/**
 * Resuelve cuánto costó el gasto y cuánto sale de cada lado de la cuenta.
 *
 * Pagando con la cuenta el formulario no pide el monto: lo que se carga es
 * cuánto se quiere pagar con ella, y eso ES el gasto. Si el saldo no llega, la
 * cuenta pone lo que tiene y la diferencia queda a cargo de una socia.
 *
 * Los saldos se miran acá, no en el formulario: entre que se abrió la pantalla
 * y se apretó Guardar, otro pudo haber gastado esa plata.
 */
async function resolverMontos(
  formData: FormData,
  fecha: string,
  caja: Caja,
  disponibles: { ars: number; usd: number }
): Promise<Resuelto> {
  if (!caja.usarCaja) {
    const moneda = String(formData.get("moneda") ?? "ARS");
    const monto = Number(formData.get("monto") ?? 0);

    if (!Number.isFinite(monto) || monto <= 0) {
      return { ok: false, error: "El monto tiene que ser mayor a cero." };
    }

    return {
      ...(await convertirMonto(monto, moneda, fecha, caja.cotizacionManual)),
      moneda,
    };
  }

  const cotizacion =
    caja.cotizacionManual ?? (await getCotizacionDeFecha(fecha));

  // Sin cotización no hay forma de saber cuántos pesos son esos dólares.
  if (caja.pedidoUsd > 0 && !cotizacion) {
    return {
      ok: false,
      error:
        "No se pudo obtener la cotización del dólar para valuar los dólares del gasto. Cargala a mano con la casilla de cotización personalizada.",
    };
  }

  const reparto = repartirPago({
    pedidoArs: caja.pedidoArs,
    pedidoUsd: caja.pedidoUsd,
    disponibleArs: disponibles.ars,
    disponibleUsd: disponibles.usd,
    cotizacion,
  });

  if (reparto.total <= 0) {
    return {
      ok: false,
      error: "Cargá cuánto se paga con la cuenta: el gasto no puede ser cero.",
    };
  }

  return {
    ok: true,
    ars: reparto.total,
    usd: cotizacion ? centavos(reparto.total / cotizacion) : null,
    cotizacion,
    // Se guarda como cargado en dólares sólo si se pagó enteramente con dólares.
    moneda: caja.pedidoUsd > 0 && caja.pedidoArs === 0 ? "USD" : "ARS",
    reparto,
  };
}

/**
 * Cada tipo de gasto se paga a una categoría de proveedor distinta: materiales
 * a un proveedor, mano de obra a un contratista, y lo administrativo —impuestos,
 * honorarios, gastos municipales— a "Varios".
 */
function tipoProveedorPara(tipoGasto: string) {
  if (tipoGasto === "Mano de obra") return "Contratista";
  if (tipoGasto === "Administrativo") return "Varios";
  return "Proveedor";
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

/**
 * Deriva del comprobante lo que se guarda: si el gasto es facturado o efectivo,
 * el tipo de factura y la alícuota.
 *
 * El formulario manda `tipo_factura` (A/B/C, o vacío para efectivo). De ahí sale
 * si es facturado. La alícuota sólo tiene sentido en la A. Un ajuste de saldo no
 * compra nada, así que nunca lleva factura ni IVA —aunque el campo oculto del
 * form venga con algo, acá se anula.
 */
function leerComprobante(formData: FormData, esAjuste: boolean) {
  const tipoFactura = esAjuste
    ? null
    : String(formData.get("tipo_factura") ?? "").trim() || null;

  const alicuota = Number(formData.get("alicuota_iva") ?? 0);
  const esA = tipoFactura === "A";
  const titular = String(formData.get("empresa_factura_id") ?? "").trim();

  return {
    tipo_pago: tipoFactura ? "Facturado" : "Efectivo",
    tipo_factura: tipoFactura,
    alicuota_iva:
      esA && Number.isFinite(alicuota) && alicuota > 0 ? alicuota : null,
    // El titular sólo tiene sentido en la factura A: es quien computa el IVA.
    empresa_factura_id: esA && titular ? titular : null,
  };
}

export async function crearGasto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const empresaPagadora = String(formData.get("empresa_pagadora_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const rubro = String(formData.get("rubro_id") ?? "");
  const tipoGasto = String(formData.get("tipo_gasto") ?? "Materiales");
  const esAjuste = tipoGasto === "Ajuste de saldo";
  const factura = leerComprobante(formData, esAjuste);
  // Todos los ajustes llevan el mismo detalle, venga lo que venga del form.
  const concepto = esAjuste
    ? "Ajuste de saldo"
    : String(formData.get("concepto") ?? "").trim();
  const receptora = String(formData.get("empresa_receptora_id") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const comprobante = formData.get("comprobante");
  const caja = leerCaja(formData, esAjuste);
  const usarCaja = caja.usarCaja;

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/gastos/nuevo?error=${encodeURIComponent(mensaje)}`
    );

  if (!concepto) volver("Poné un detalle para el gasto.");
  // Con dinero en cuenta puede no hacer falta ninguna: se pide más abajo, sólo
  // si una empresa agregó algo de su bolsillo.
  if (!usarCaja && !empresaPagadora) volver("Elegí qué empresa pagó el gasto.");
  if (!fecha) volver("Poné la fecha del gasto.");
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

  const saldos = usarCaja ? await getCaja(obraId) : null;

  const montos = await resolverMontos(formData, fecha, caja, {
    ars: saldos?.arsSaldo ?? 0,
    usd: saldos?.usdSaldo ?? 0,
  });

  const limpiar = async () => {
    if (archivoComprobante) {
      await eliminarArchivo(archivoComprobante.id).catch(() => {});
    }
  };

  if (!montos.ok) {
    await limpiar();
    volver(montos.error);
    return;
  }

  const moneda = montos.moneda ?? "ARS";
  const reparto = montos.reparto;
  const faltante = reparto ? reparto.deEmpresa : 0;

  if (faltante > 0 && !empresaPagadora) {
    await limpiar();
    volver("El dinero en cuenta no alcanza: elegí qué empresa aporta el resto.");
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
    // Si la cuenta se hizo cargo de todo no hay empresa que lo haya pagado.
    empresa_pagadora_id: !usarCaja || faltante > 0 ? empresaPagadora : null,
    caja_ars: reparto?.ars ?? 0,
    caja_usd: reparto?.usd ?? 0,
    cotizacion_manual: caja.cotizacionManual !== null,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    tipo_pago: factura.tipo_pago,
    tipo_factura: factura.tipo_factura,
    alicuota_iva: factura.alicuota_iva,
    empresa_factura_id: factura.empresa_factura_id,
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
  const empresaPagadora = String(formData.get("empresa_pagadora_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const rubro = String(formData.get("rubro_id") ?? "");
  const tipoGasto = String(formData.get("tipo_gasto") ?? "Materiales");
  const esAjuste = tipoGasto === "Ajuste de saldo";
  const factura = leerComprobante(formData, esAjuste);
  // Todos los ajustes llevan el mismo detalle, venga lo que venga del form.
  const concepto = esAjuste
    ? "Ajuste de saldo"
    : String(formData.get("concepto") ?? "").trim();
  const receptora = String(formData.get("empresa_receptora_id") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const comprobante = formData.get("comprobante");
  const quitarComprobante = formData.get("quitar_comprobante") === "on";
  const caja = leerCaja(formData, esAjuste);
  const usarCaja = caja.usarCaja;

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/gastos/${gastoId}/editar?error=${encodeURIComponent(mensaje)}`
    );

  if (!concepto) volver("Poné un detalle para el gasto.");
  if (!usarCaja && !empresaPagadora) volver("Elegí qué empresa pagó el gasto.");
  if (!fecha) volver("Poné la fecha del gasto.");
  if (esAjuste && !receptora) {
    volver("Elegí a qué empresa se le transfiere.");
  }
  if (esAjuste && receptora === empresaPagadora) {
    volver("Una empresa no puede transferirse a sí misma.");
  }

  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("gastos")
    .select("comprobante_drive_id, obra_id, caja_ars, caja_usd, estado")
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

  // Lo que este gasto ya tenía tomado de la cuenta vuelve a estar disponible
  // para él mismo. Si está anulado no tomó nada: el saldo ya lo contempla.
  const anulado = actual.estado === "Anulado";
  const saldos = usarCaja ? await getCaja(actual.obra_id) : null;

  const montos = await resolverMontos(formData, fecha, caja, {
    ars: (saldos?.arsSaldo ?? 0) + (anulado ? 0 : Number(actual.caja_ars)),
    usd: (saldos?.usdSaldo ?? 0) + (anulado ? 0 : Number(actual.caja_usd)),
  });

  if (!montos.ok) {
    volver(montos.error);
    return;
  }

  const moneda = montos.moneda ?? "ARS";
  const reparto = montos.reparto;
  const faltante = reparto ? reparto.deEmpresa : 0;

  if (faltante > 0 && !empresaPagadora) {
    volver("El dinero en cuenta no alcanza: elegí qué empresa aporta el resto.");
  }

  // El comprobante puede quedar igual, reemplazarse o quitarse.
  const cambios: GastoUpdate = {
    fecha,
    rubro_id: esAjuste || rubro === "" ? null : rubro,
    concepto,
    tipo_gasto: tipoGasto,
    proveedor_id: esAjuste ? null : proveedor.id,
    empresa_receptora_id: esAjuste ? receptora : null,
    empresa_pagadora_id: !usarCaja || faltante > 0 ? empresaPagadora : null,
    caja_ars: reparto?.ars ?? 0,
    caja_usd: reparto?.usd ?? 0,
    cotizacion_manual: caja.cotizacionManual !== null,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    tipo_pago: factura.tipo_pago,
    tipo_factura: factura.tipo_factura,
    alicuota_iva: factura.alicuota_iva,
    empresa_factura_id: factura.empresa_factura_id,
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

  // Reactivar un gasto que se había pagado con dinero en cuenta vuelve a
  // tomar esa plata, y puede que ya no esté.
  const { error } = await supabase
    .from("gastos")
    .update({ estado: "Pagado" })
    .eq("id", gastoId);

  if (error) {
    redirect(
      `/obras/${slug}/gastos/${gastoId}/editar?error=${encodeURIComponent(error.message)}`
    );
  }

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
