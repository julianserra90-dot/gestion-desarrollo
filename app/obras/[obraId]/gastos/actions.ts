"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { convertirMonto, getCotizacionDeFecha } from "@/lib/dolar";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { getCaja } from "@/lib/caja";
import { guardarDetalleSiCorresponde } from "@/lib/detalles";
import { camposDelFormulario } from "@/lib/borradores";
import { leerItems, sumaDeItems } from "@/lib/items-material";
import type { ItemMaterial } from "@/lib/items-material";
import { GASTO_COMPARTIDO, centavos, repartirPago } from "@/lib/reparto";
import type { Reparto } from "@/lib/reparto";
import type { MontoConvertido } from "@/lib/dolar";
import { createClient } from "@/lib/supabase/server";

type GastoUpdate = Database["public"]["Tables"]["gastos"]["Update"];

/**
 * Lee del formulario cuánto se saca de cada lado de la cuenta y qué cotización
 * usar.
 *
 * La cotización manual pisa a la del blue en todo el gasto, no sólo en la
 * conversión de los dólares que salen de la cuenta: si conseguiste otro cambio,
 * ese es el valor real de lo que pagaste.
 */
function leerCaja(formData: FormData, esAjuste: boolean) {
  // Un ajuste de saldo mueve plata entre socias: nunca toca la cuenta.
  const usarCaja = formData.get("usar_caja") === "on" && !esAjuste;
  const manual = formData.get("cotizacion_manual") === "on";
  const valor = Number(formData.get("cotizacion_valor") ?? 0);

  // El gasto es en pesos pero se paga con los dólares de la cuenta: viene el
  // monto en pesos y los dólares se calculan al cambio, en `resolverMontos`,
  // que es donde se conoce la cotización.
  const pesosEnDolares = usarCaja
    ? Number(formData.get("caja_pesos_en_dolares") ?? 0) || 0
    : 0;

  return {
    usarCaja,
    cotizacionManual: manual && Number.isFinite(valor) && valor > 0 ? valor : null,
    pesosEnDolares,
    pedidoArs:
      usarCaja && pesosEnDolares <= 0 ? Number(formData.get("caja_ars") ?? 0) || 0 : 0,
    pedidoUsd:
      usarCaja && pesosEnDolares <= 0 ? Number(formData.get("caja_usd") ?? 0) || 0 : 0,
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

  let cotizacion =
    caja.cotizacionManual ?? (await getCotizacionDeFecha(fecha));

  // Sin cotización no hay forma de saber cuántos pesos son esos dólares.
  if ((caja.pedidoUsd > 0 || caja.pesosEnDolares > 0) && !cotizacion) {
    return {
      ok: false,
      error:
        "No se pudo obtener la cotización del dólar para valuar los dólares del gasto. Cargala a mano con la casilla de cotización personalizada.",
    };
  }

  // Pesos pagados con dólares: los dólares salen de dividir por el cambio, al
  // centavo, y el cambio se recalcula desde ahí para que el gasto quede
  // exactamente en los pesos cargados: el papel dice pesos, no 9.993,85.
  let pedidoUsd = caja.pedidoUsd;
  const enPesos = caja.pesosEnDolares > 0;
  if (enPesos && cotizacion) {
    pedidoUsd = centavos(caja.pesosEnDolares / cotizacion);
    if (pedidoUsd <= 0) {
      return { ok: false, error: "El monto en pesos es demasiado chico para descontar dólares." };
    }
    cotizacion = caja.pesosEnDolares / pedidoUsd;
  }

  const reparto = repartirPago({
    pedidoArs: caja.pedidoArs,
    pedidoUsd,
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
    // Se guarda como cargado en dólares sólo si se pagó enteramente con
    // dólares. Pesos pagados con dólares es un gasto en pesos: el papel dice
    // pesos, aunque de la cuenta hayan salido dólares.
    moneda: !enPesos && pedidoUsd > 0 && caja.pedidoArs === 0 ? "USD" : "ARS",
    reparto,
  };
}

/**
 * Cada tipo de gasto se paga a una categoría de proveedor distinta: materiales
 * a un proveedor, mano de obra a un contratista, y lo administrativo —impuestos,
 * honorarios, gastos municipales— a "Varios".
 */
function tipoProveedorPara(tipoGasto: string) {
  if (tipoGasto === "Mano de obra" || tipoGasto === "Mano de obra y materiales") {
    return "Contratista";
  }
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
  // Facturado en varias facturas: el titular, el número y el archivo viven en
  // cada factura (`gasto_facturas`), no en el gasto.
  const varias = Boolean(tipoFactura) && formData.get("facturas_multiples") === "on";

  return {
    tipo_pago: tipoFactura ? "Facturado" : "Efectivo",
    tipo_factura: tipoFactura,
    alicuota_iva:
      esA && Number.isFinite(alicuota) && alicuota > 0 ? alicuota : null,
    // El titular sólo tiene sentido en la factura A: es quien computa el IVA.
    empresa_factura_id: esA && titular && !varias ? titular : null,
    // Cómo se leen los precios del detalle. Sólo la A discrimina IVA, así que
    // sólo ahí pueden ser netos; en el resto el precio es el final.
    precios_con_iva: esA ? formData.get("precios_con_iva") === "on" : true,
    // El número impreso en el papel: el de la factura, o el del presupuesto o
    // remito con que se pagó en efectivo. Con varias facturas, cada una lleva
    // el suyo; un ajuste no tiene papel.
    numero_factura:
      !esAjuste && !varias
        ? String(formData.get("numero_factura") ?? "").trim() || null
        : null,
    varias,
  };
}

/** Una de las facturas cuando el gasto se facturó en varias, leída del form. */
type FacturaLeida = {
  empresaId: string;
  monto: number;
  numero: string | null;
  archivo: File | null;
  quitar: boolean;
};

/**
 * Las facturas del gasto, cuando se facturó en varias: una por socia, por lo
 * que diga cada papel. Sólo si el gasto es entre las socias y facturado; las
 * de monto cero se descartan (esa socia no recibió factura). Tienen que sumar
 * el monto del gasto: es un comprobante partido, no dos compras.
 */
function leerFacturas(
  formData: FormData,
  compartido: boolean,
  facturado: boolean
): { facturas: FacturaLeida[]; error?: string } {
  if (!compartido || !facturado || formData.get("facturas_multiples") !== "on") {
    return { facturas: [] };
  }

  const cantidad = Number(formData.get("facturas_cantidad") ?? 0);
  const facturas: FacturaLeida[] = [];
  for (let i = 1; i <= cantidad; i++) {
    const empresaId = String(formData.get(`factura_empresa_${i}`) ?? "").trim();
    const monto = Number(formData.get(`factura_monto_${i}`) ?? 0);
    if (!empresaId || !Number.isFinite(monto) || monto <= 0) continue;
    const archivo = formData.get(`factura_archivo_${i}`);
    facturas.push({
      empresaId,
      monto,
      numero: String(formData.get(`factura_numero_${i}`) ?? "").trim() || null,
      archivo: archivo instanceof File && archivo.size > 0 ? archivo : null,
      quitar: formData.get(`factura_quitar_${i}`) === "on",
    });
  }

  if (facturas.length < 2) {
    return {
      facturas,
      error: "Con más de una factura, cargá el monto de al menos dos.",
    };
  }
  return { facturas };
}

/**
 * Guarda las facturas del gasto reemplazando las anteriores. Los archivos se
 * suben antes y se conservan los que ya estaban si no vino uno nuevo ni se
 * pidió quitarlo; los que se reemplazan o se quitan se borran de Drive recién
 * después de que la base confirmó.
 */
async function guardarFacturas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gastoId: string,
  slug: string,
  facturas: FacturaLeida[]
): Promise<string | null> {
  const { data: previas } = await supabase
    .from("gasto_facturas")
    .select("empresa_id, comprobante_drive_id, comprobante_nombre, comprobante_mime, comprobante_tamano")
    .eq("gasto_id", gastoId);
  const previaDe = new Map((previas ?? []).map((p) => [p.empresa_id, p]));

  const subidos: string[] = [];
  const aBorrar: string[] = [];
  const filas = [];

  for (const [i, f] of facturas.entries()) {
    const previa = previaDe.get(f.empresaId);
    let archivo = previa
      ? {
          id: previa.comprobante_drive_id,
          nombre: previa.comprobante_nombre,
          mime: previa.comprobante_mime,
          tamano: previa.comprobante_tamano,
        }
      : { id: null, nombre: null, mime: null, tamano: null };

    if (f.archivo) {
      const nuevo = await subirArchivo({
        archivo: f.archivo,
        nombre: f.archivo.name,
        obraSlug: slug,
        tipo: "comprobantes",
      }).catch(() => null);
      if (!nuevo) {
        await Promise.all(subidos.map((id) => eliminarArchivo(id).catch(() => {})));
        return "No se pudo subir el archivo de una de las facturas.";
      }
      subidos.push(nuevo.id);
      if (archivo.id) aBorrar.push(archivo.id);
      archivo = { id: nuevo.id, nombre: nuevo.nombre, mime: nuevo.mimeType, tamano: nuevo.tamano };
    } else if (f.quitar && archivo.id) {
      aBorrar.push(archivo.id);
      archivo = { id: null, nombre: null, mime: null, tamano: null };
    }

    filas.push({
      gasto_id: gastoId,
      empresa_id: f.empresaId,
      monto: f.monto,
      numero: f.numero,
      comprobante_drive_id: archivo.id,
      comprobante_nombre: archivo.nombre,
      comprobante_mime: archivo.mime,
      comprobante_tamano: archivo.tamano,
      orden: i,
    });
  }

  // Las facturas de socias que ya no están (o todas, si el gasto dejó de ser
  // en varias) se van con sus archivos.
  for (const p of previas ?? []) {
    if (!facturas.some((f) => f.empresaId === p.empresa_id) && p.comprobante_drive_id) {
      aBorrar.push(p.comprobante_drive_id);
    }
  }

  const { error: errorBorrado } = await supabase
    .from("gasto_facturas")
    .delete()
    .eq("gasto_id", gastoId);
  if (errorBorrado) {
    await Promise.all(subidos.map((id) => eliminarArchivo(id).catch(() => {})));
    return errorBorrado.message;
  }

  if (filas.length > 0) {
    const { error } = await supabase.from("gasto_facturas").insert(filas);
    if (error) {
      await Promise.all(subidos.map((id) => eliminarArchivo(id).catch(() => {})));
      return error.message;
    }
  }

  await Promise.all(aBorrar.map((id) => eliminarArchivo(id).catch(() => {})));
  return null;
}

/**
 * Quién puso la plata: una socia puntual o todas en partes iguales.
 *
 * "Entre las socias" viaja por el mismo campo que la empresa porque es otra
 * respuesta a la misma pregunta. Un ajuste de saldo va de una socia a otra, así
 * que ahí no vale: queda sin pagadora y el formulario la vuelve a pedir.
 */
function leerQuienPago(formData: FormData, esAjuste: boolean) {
  const elegido = String(formData.get("empresa_pagadora_id") ?? "");

  return {
    compartido: !esAjuste && elegido === GASTO_COMPARTIDO,
    empresaPagadora: elegido === GASTO_COMPARTIDO ? "" : elegido,
  };
}

/**
 * El detalle de materiales de la factura. La lectura del formulario vive en
 * `lib/items-material.ts` porque el presupuesto carga la misma lista con el
 * mismo componente; acá queda sólo cómo se guarda.
 */
function itemsDelGasto(formData: FormData, tipoGasto: string): ItemMaterial[] {
  // La mano de obra no se desglosa en items y un ajuste de saldo no compra
  // nada: en esos casos no hay detalle que leer.
  return tipoGasto === "Materiales" ? leerItems(formData) : [];
}

/**
 * El descuento que la factura hace sobre el detalle, en la base de los precios.
 *
 * Nunca más que lo que suma el detalle: dejaría materiales a precio negativo.
 * Sin detalle con precio no hay sobre qué descontar, y queda en cero.
 */
function descuentoDelGasto(formData: FormData, tipoGasto: string): number {
  const escrito = Number(formData.get("descuento_detalle") ?? 0);
  if (!Number.isFinite(escrito) || escrito <= 0) return 0;
  const suma = sumaDeItems(itemsDelGasto(formData, tipoGasto));
  return Math.min(Math.round(escrito * 100) / 100, suma);
}

/**
 * De qué presupuesto salió esta compra.
 *
 * Lo manda el formulario cuando se trajeron los items de un presupuesto, y es
 * sólo la procedencia: los items del gasto quedan como copia propia, así que
 * corregir el presupuesto después no reescribe qué se compró.
 *
 * Vacío es lo normal en la compra chica, que se carga sin cotizar nada.
 */
function presupuestoDelGasto(
  formData: FormData,
  tipoGasto: string
): string | null {
  if (tipoGasto !== "Materiales") return null;
  return String(formData.get("presupuesto_id") ?? "").trim() || null;
}

/**
 * Guarda el detalle reemplazando el anterior entero.
 *
 * Borrar y volver a insertar es más simple que averiguar qué cambió, y no se
 * pierde nada: los items no tienen historia propia —son el desglose de este
 * gasto— y el `id` no lo referencia nadie.
 */
async function guardarItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gastoId: string,
  items: ItemMaterial[]
) {
  const { error: errorBorrado } = await supabase
    .from("gasto_materiales")
    .delete()
    .eq("gasto_id", gastoId);

  if (errorBorrado) return errorBorrado.message;
  if (items.length === 0) return null;

  const { error } = await supabase
    .from("gasto_materiales")
    .insert(items.map((item) => ({ ...item, gasto_id: gastoId })));

  return error?.message ?? null;
}

export async function crearGasto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const rubro = String(formData.get("rubro_id") ?? "");
  const tipoGasto = String(formData.get("tipo_gasto") ?? "Materiales");
  const esAjuste = tipoGasto === "Ajuste de saldo";
  const { compartido, empresaPagadora } = leerQuienPago(formData, esAjuste);
  const factura = leerComprobante(formData, esAjuste);
  // Todos los ajustes llevan el mismo detalle, venga lo que venga del form. El
  // resto es opcional, y vacío se guarda como `null`: un dato que no se cargó,
  // no una cadena en blanco.
  const concepto = esAjuste
    ? "Ajuste de saldo"
    : String(formData.get("concepto") ?? "").trim() || null;
  if (!esAjuste) await guardarDetalleSiCorresponde("Gasto", formData, concepto);
  const receptora = String(formData.get("empresa_receptora_id") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const comprobante = formData.get("comprobante");
  const caja = leerCaja(formData, esAjuste);
  const usarCaja = caja.usarCaja;
  // Si se terminó un borrador: se vuelve a él ante un error, y al guardar se
  // borra y su comprobante pasa al gasto.
  const borradorId = String(formData.get("borrador_id") ?? "").trim() || null;

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/gastos/nuevo?${borradorId ? `borrador=${borradorId}&` : ""}error=${encodeURIComponent(mensaje)}`
    );

  // Con dinero en cuenta puede no hacer falta ninguna: se pide más abajo, sólo
  // si una empresa agregó algo de su bolsillo.
  if (!usarCaja && !empresaPagadora && !compartido) {
    volver("Elegí qué empresa pagó el gasto.");
  }
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

  // El comprobante que se adjuntó al guardar el borrador, si no se subió otro
  // ni se lo quitó. No va en `archivoComprobante` a propósito: ése se borra de
  // Drive si el gasto no se guarda, y éste sigue siendo del borrador.
  const quitarComprobante = formData.get("quitar_comprobante") === "on";
  const { data: borrador } = borradorId
    ? await supabase
        .from("gastos_borradores")
        .select("comprobante_drive_id, comprobante_nombre, comprobante_mime, comprobante_tamano")
        .eq("id", borradorId)
        .maybeSingle()
    : { data: null };
  const comprobanteDelBorrador =
    !archivoComprobante && !quitarComprobante && borrador?.comprobante_drive_id
      ? {
          id: borrador.comprobante_drive_id,
          nombre: borrador.comprobante_nombre,
          mimeType: borrador.comprobante_mime,
          tamano: borrador.comprobante_tamano,
        }
      : null;
  const comprobanteFinal = archivoComprobante ?? comprobanteDelBorrador;

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

  // Facturado en varias facturas: se leen acá, con el monto ya resuelto,
  // porque tienen que sumar exactamente el gasto (en la moneda en que se
  // cargó). Es un comprobante partido, no dos compras.
  // Entre las socias o con la cuenta (que es de todas): en los dos casos la
  // factura puede venir partida, una por socia.
  const lecturaFacturas = leerFacturas(
    formData,
    compartido || usarCaja,
    factura.tipo_pago === "Facturado"
  );
  if (lecturaFacturas.error) volver(lecturaFacturas.error);
  const facturasDelGasto = lecturaFacturas.facturas;
  if (facturasDelGasto.length > 0) {
    const montoGasto = usarCaja ? montos.ars : Number(formData.get("monto") ?? 0);
    const sumaFacturas = facturasDelGasto.reduce((acc, f) => acc + f.monto, 0);
    if (Math.abs(sumaFacturas - montoGasto) >= 0.01) {
      volver(
        `Las facturas suman ${sumaFacturas.toFixed(2)} y el gasto es ${montoGasto.toFixed(2)}: tienen que coincidir.`
      );
    }
  }
  const faltante = reparto ? reparto.deEmpresa : 0;
  // Si la cuenta se hizo cargo de todo, el gasto no lo puso nadie de su
  // bolsillo: ni una socia ni todas.
  const loPoneAlguien = !usarCaja || faltante > 0;

  if (faltante > 0 && !empresaPagadora && !compartido) {
    await limpiar();
    volver("El dinero en cuenta no alcanza: elegí qué empresa aporta el resto.");
  }

  // Se pide el id de vuelta porque el detalle de materiales cuelga de él.
  const { data: creado, error } = await supabase
    .from("gastos")
    .insert({
      obra_id: obraId,
      fecha,
      // Un ajuste no lleva rubro ni proveedor: no se compró nada.
      rubro_id: esAjuste || rubro === "" ? null : rubro,
      concepto,
      tipo_gasto: tipoGasto,
      proveedor_id: esAjuste ? null : proveedor.id,
      presupuesto_id: presupuestoDelGasto(formData, tipoGasto),
      empresa_receptora_id: esAjuste ? receptora : null,
      empresa_pagadora_id:
        compartido || !loPoneAlguien ? null : empresaPagadora,
      compartido: compartido && loPoneAlguien,
      caja_ars: reparto?.ars ?? 0,
      caja_usd: reparto?.usd ?? 0,
      cotizacion_manual: caja.cotizacionManual !== null,
      pesos_con_dolares: caja.pesosEnDolares > 0,
      monto: montos.ars,
      monto_usd: montos.usd,
      cotizacion: montos.cotizacion,
      tipo_pago: factura.tipo_pago,
      tipo_factura: factura.tipo_factura,
      alicuota_iva: factura.alicuota_iva,
      empresa_factura_id: factura.empresa_factura_id,
      precios_con_iva: factura.precios_con_iva,
      descuento_detalle: descuentoDelGasto(formData, tipoGasto),
      numero_factura: factura.numero_factura,
      // Sólo una compra de materiales puede ser un acopio.
      es_acopio: tipoGasto === "Materiales" && formData.get("es_acopio") === "on",
      moneda,
      // Un gasto se carga cuando ya se pagó, así que no se pregunta el estado.
      estado: "Pagado",
      observaciones: observaciones === "" ? null : observaciones,
      cargado_por: user?.id ?? null,
      comprobante_drive_id: comprobanteFinal?.id ?? null,
      comprobante_nombre: comprobanteFinal?.nombre ?? null,
      comprobante_mime: comprobanteFinal?.mimeType ?? null,
      comprobante_tamano: comprobanteFinal?.tamano ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Si falló guardar el gasto, se limpia el comprobante ya subido a Drive.
    if (archivoComprobante) {
      await eliminarArchivo(archivoComprobante.id).catch(() => {});
    }
    volver(error.message);
  }

  // El borrador ya es un gasto. Su comprobante, si no pasó al gasto (se subió
  // otro o se lo quitó), no lo usa nadie más.
  if (borradorId) {
    await supabase.from("gastos_borradores").delete().eq("id", borradorId);
    if (borrador?.comprobante_drive_id && !comprobanteDelBorrador) {
      await eliminarArchivo(borrador.comprobante_drive_id).catch(() => {});
    }
  }

  // El gasto ya está guardado. Si el detalle falla, se avisa desde la pantalla
  // de edición en vez de perder la carga entera: es el desglose, no el gasto.
  if (creado) {
    const problema = await guardarItems(
      supabase,
      creado.id,
      itemsDelGasto(formData, tipoGasto)
    );

    if (problema) {
      revalidatePath("/", "layout");
      redirect(
        `/obras/${slug}/gastos/${creado.id}/editar?error=${encodeURIComponent(
          `El gasto se guardó, pero el detalle de materiales no: ${problema}`
        )}`
      );
    }

    // Las facturas, si se facturó en varias: mismo criterio que el detalle,
    // el gasto ya está y lo que falle se corrige desde la edición.
    const problemaFacturas = await guardarFacturas(
      supabase,
      creado.id,
      slug,
      facturasDelGasto
    );
    if (problemaFacturas) {
      revalidatePath("/", "layout");
      redirect(
        `/obras/${slug}/gastos/${creado.id}/editar?error=${encodeURIComponent(
          `El gasto se guardó, pero las facturas no: ${problemaFacturas}`
        )}`
      );
    }
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos`);
}

export async function actualizarGasto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const gastoId = String(formData.get("gasto_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const rubro = String(formData.get("rubro_id") ?? "");
  const tipoGasto = String(formData.get("tipo_gasto") ?? "Materiales");
  const esAjuste = tipoGasto === "Ajuste de saldo";
  const { compartido, empresaPagadora } = leerQuienPago(formData, esAjuste);
  const factura = leerComprobante(formData, esAjuste);
  // Todos los ajustes llevan el mismo detalle, venga lo que venga del form. El
  // resto es opcional, y vacío se guarda como `null`: un dato que no se cargó,
  // no una cadena en blanco.
  const concepto = esAjuste
    ? "Ajuste de saldo"
    : String(formData.get("concepto") ?? "").trim() || null;
  if (!esAjuste) await guardarDetalleSiCorresponde("Gasto", formData, concepto);
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

  if (!usarCaja && !empresaPagadora && !compartido) {
    volver("Elegí qué empresa pagó el gasto.");
  }
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

  // Facturado en varias facturas: se leen acá, con el monto ya resuelto,
  // porque tienen que sumar exactamente el gasto (en la moneda en que se
  // cargó). Es un comprobante partido, no dos compras.
  // Entre las socias o con la cuenta (que es de todas): en los dos casos la
  // factura puede venir partida, una por socia.
  const lecturaFacturas = leerFacturas(
    formData,
    compartido || usarCaja,
    factura.tipo_pago === "Facturado"
  );
  if (lecturaFacturas.error) volver(lecturaFacturas.error);
  const facturasDelGasto = lecturaFacturas.facturas;
  if (facturasDelGasto.length > 0) {
    const montoGasto = usarCaja ? montos.ars : Number(formData.get("monto") ?? 0);
    const sumaFacturas = facturasDelGasto.reduce((acc, f) => acc + f.monto, 0);
    if (Math.abs(sumaFacturas - montoGasto) >= 0.01) {
      volver(
        `Las facturas suman ${sumaFacturas.toFixed(2)} y el gasto es ${montoGasto.toFixed(2)}: tienen que coincidir.`
      );
    }
  }
  const faltante = reparto ? reparto.deEmpresa : 0;
  // Si la cuenta se hizo cargo de todo, el gasto no lo puso nadie de su
  // bolsillo: ni una socia ni todas.
  const loPoneAlguien = !usarCaja || faltante > 0;

  if (faltante > 0 && !empresaPagadora && !compartido) {
    volver("El dinero en cuenta no alcanza: elegí qué empresa aporta el resto.");
  }

  // El comprobante puede quedar igual, reemplazarse o quitarse.
  const cambios: GastoUpdate = {
    fecha,
    rubro_id: esAjuste || rubro === "" ? null : rubro,
    concepto,
    tipo_gasto: tipoGasto,
    proveedor_id: esAjuste ? null : proveedor.id,
    presupuesto_id: presupuestoDelGasto(formData, tipoGasto),
    empresa_receptora_id: esAjuste ? receptora : null,
    empresa_pagadora_id:
      compartido || !loPoneAlguien ? null : empresaPagadora,
    compartido: compartido && loPoneAlguien,
    caja_ars: reparto?.ars ?? 0,
    caja_usd: reparto?.usd ?? 0,
    cotizacion_manual: caja.cotizacionManual !== null,
    pesos_con_dolares: caja.pesosEnDolares > 0,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    tipo_pago: factura.tipo_pago,
    tipo_factura: factura.tipo_factura,
    alicuota_iva: factura.alicuota_iva,
    empresa_factura_id: factura.empresa_factura_id,
    precios_con_iva: factura.precios_con_iva,
    descuento_detalle: descuentoDelGasto(formData, tipoGasto),
    numero_factura: factura.numero_factura,
    es_acopio: tipoGasto === "Materiales" && formData.get("es_acopio") === "on",
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

  // El detalle se reemplaza entero. Si el gasto dejó de ser de materiales, la
  // lista viene vacía y el desglose anterior se borra: ya no aplica.
  const problema = await guardarItems(
    supabase,
    gastoId,
    itemsDelGasto(formData, tipoGasto)
  );

  if (problema) {
    volver(`El gasto se guardó, pero el detalle de materiales no: ${problema}`);
  }

  // Las facturas se reemplazan enteras; si el gasto dejó de ser en varias, la
  // lista viene vacía y las anteriores se borran con sus archivos.
  const problemaFacturas = await guardarFacturas(
    supabase,
    gastoId,
    slug,
    facturasDelGasto
  );
  if (problemaFacturas) {
    volver(`El gasto se guardó, pero las facturas no: ${problemaFacturas}`);
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

// ------------------------------ Borradores ---------------------------------

/**
 * Guarda el formulario como está, para terminarlo después.
 *
 * No valida nada: es justamente lo que todavía no se puede (falta la fecha, el
 * cambio, a nombre de quién salió). Los campos van tal cual los mandó el
 * navegador y el gasto no existe hasta que se termine: nada de esto suma en
 * ningún lado. El comprobante, si se adjuntó, sube a Drive ya, para no tener
 * que volver a buscar la foto de la factura.
 */
export async function guardarBorrador(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const borradorId = String(formData.get("borrador_id") ?? "").trim() || null;
  const comprobante = formData.get("comprobante");
  const quitar = formData.get("quitar_comprobante") === "on";

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/gastos/nuevo?${borradorId ? `borrador=${borradorId}&` : ""}error=${encodeURIComponent(mensaje)}`
    );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: anterior } = borradorId
    ? await supabase
        .from("gastos_borradores")
        .select("comprobante_drive_id")
        .eq("id", borradorId)
        .maybeSingle()
    : { data: null };

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

  // Un archivo nuevo pisa al anterior; "Quitar" lo saca; si no, queda el que estaba.
  const comprobanteCambia = archivo !== null || quitar;
  const datos = {
    obra_id: obraId,
    campos: camposDelFormulario(formData),
    actualizado_en: new Date().toISOString(),
    ...(comprobanteCambia
      ? {
          comprobante_drive_id: archivo?.id ?? null,
          comprobante_nombre: archivo?.nombre ?? null,
          comprobante_mime: archivo?.mimeType ?? null,
          comprobante_tamano: archivo?.tamano ?? null,
        }
      : {}),
  };

  const { data: guardado, error } = borradorId
    ? await supabase
        .from("gastos_borradores")
        .update(datos)
        .eq("id", borradorId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("gastos_borradores")
        .insert({ ...datos, cargado_por: user?.id ?? null })
        .select("id")
        .maybeSingle();

  if (error || !guardado) {
    if (archivo) await eliminarArchivo(archivo.id).catch(() => {});
    volver(error?.message ?? "El borrador ya no existe: puede que se haya terminado o descartado.");
  }

  if (comprobanteCambia && anterior?.comprobante_drive_id) {
    await eliminarArchivo(anterior.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos`);
}

/** Tira un borrador, con su comprobante si tenía uno. */
export async function descartarBorrador(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const borradorId = String(formData.get("borrador_id") ?? "");

  const supabase = await createClient();
  const { data: borrado, error } = await supabase
    .from("gastos_borradores")
    .delete()
    .eq("id", borradorId)
    .select("comprobante_drive_id")
    .maybeSingle();

  if (error) {
    redirect(
      `/obras/${slug}/gastos/nuevo?borrador=${borradorId}&error=${encodeURIComponent(error.message)}`
    );
  }

  if (borrado?.comprobante_drive_id) {
    await eliminarArchivo(borrado.comprobante_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/gastos`);
}
