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

/** Mismo valor que ofrece el formulario cuando aportan todas las socias. */
const TODAS_LAS_SOCIAS = "todas";

/** Redondea al centavo: los montos se guardan así y el reparto no puede
 *  inventar fracciones. */
const alCentavo = (n: number) => Math.round(n * 100) / 100;

/**
 * Cuánto pone cada socia cuando aportan todas a la vez. En partes iguales
 * salvo que se haya escrito un monto por empresa. El centavo que sobra de la
 * división va a la primera, para que la suma dé exactamente el total cargado.
 */
function repartirEntreSocias(
  socios: { empresa_id: string }[],
  total: number,
  diferentes: boolean,
  formData: FormData
) {
  if (diferentes) {
    return socios.map((s) => ({
      empresaId: s.empresa_id,
      monto: Number(formData.get(`monto_socia_${s.empresa_id}`) ?? 0),
    }));
  }
  const parte = alCentavo(total / socios.length);
  const resto = alCentavo(total - parte * socios.length);
  return socios.map((s, i) => ({
    empresaId: s.empresa_id,
    monto: alCentavo(parte + (i === 0 ? resto : 0)),
  }));
}

/**
 * Campos comunes al alta y a la edición.
 *
 * Según el origen se completa una cosa u otra: si la plata la pone una socia
 * queda apuntada la empresa; si la pone un inversor o un comprador, su ficha de
 * la agenda de la obra. Antes era el nombre escrito a mano (`aportante`): dos
 * aportes del mismo inversor sólo se juntaban si se escribía igual las dos
 * veces, y no había a qué colgarle cuánto se había comprometido a poner.
 */
function leerFormulario(formData: FormData) {
  const origen = String(formData.get("origen") ?? DE_SOCIA);
  const esDeSocia = origen === DE_SOCIA;

  const empresaId = String(formData.get("empresa_id") ?? "");
  const sonTodas = esDeSocia && empresaId === TODAS_LAS_SOCIAS;

  return {
    origen,
    esDeSocia,
    empresaId,
    sonTodas,
    montosDiferentes: sonTodas && formData.get("montos_diferentes") === "on",
    inversorId: String(formData.get("inversor_id") ?? ""),
    fecha: String(formData.get("fecha") ?? "").trim(),
    concepto: String(formData.get("concepto") ?? "").trim(),
    // Con montos distintos por socia no viene un monto general: el total se
    // arma después, sumando lo de cada una.
    monto: Number(formData.get("monto") ?? 0),
    moneda: String(formData.get("moneda") ?? "ARS"),
    observaciones: String(formData.get("observaciones") ?? "").trim(),
    comprobante: formData.get("comprobante"),
    // La cuota de la agenda que este ingreso cumple, si se llegó desde ahí.
    previstoId: String(formData.get("previsto_id") ?? "") || null,
  };
}

/** Devuelve el mensaje de error, o null si está todo bien. */
function validar(campos: ReturnType<typeof leerFormulario>) {
  if (!ORIGENES.includes(campos.origen)) return "Elegí de dónde viene la plata.";
  if (!campos.fecha) return "Poné la fecha del ingreso.";
  if (!campos.concepto) return "Poné un detalle para el ingreso.";
  // Con montos por socia el total se valida más adelante, cuando se conocen.
  if (!campos.montosDiferentes && (!Number.isFinite(campos.monto) || campos.monto <= 0)) {
    return "El monto tiene que ser mayor a cero.";
  }
  if (campos.esDeSocia && !campos.empresaId) {
    return "Elegí qué empresa socia pone la plata.";
  }
  if (!campos.esDeSocia && !campos.inversorId) {
    return `Elegí qué ${campos.origen === "Inversor" ? "inversor" : "comprador"} aporta. Si no está en la lista, cargalo primero en Inversores.`;
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

  const supabase = await createClient();

  // Un ingreso por quien pone la plata. Casi siempre es uno; cuando aportan
  // todas las socias a la vez, uno por cada una con su parte, porque el
  // balance cuenta aportes por empresa y así cada una queda con lo suyo.
  let partes: { empresaId: string | null; monto: number }[];

  if (campos.sonTodas) {
    const { data: socios } = await supabase
      .from("obra_socios")
      .select("empresa_id, empresas(nombre)")
      .eq("obra_id", obraId);

    const ordenados = (socios ?? []).sort((a, b) =>
      (a.empresas?.nombre ?? "").localeCompare(b.empresas?.nombre ?? "")
    );
    if (ordenados.length < 2) {
      volver("La obra necesita al menos dos socias para repartir un aporte.");
    }

    partes = repartirEntreSocias(
      ordenados,
      campos.monto,
      campos.montosDiferentes,
      formData
    );

    if (partes.some((p) => !Number.isFinite(p.monto) || p.monto < 0)) {
      volver("Los montos por empresa tienen que ser cero o más.");
    }
    // Una socia que pone cero no aporta: no se le anota nada.
    partes = partes.filter((p) => p.monto > 0);
    if (partes.length === 0) {
      volver("Alguna de las empresas tiene que poner un monto mayor a cero.");
    }
  } else {
    partes = [
      { empresaId: campos.esDeSocia ? campos.empresaId : null, monto: campos.monto },
    ];
  }

  // El comprobante es opcional. Si vino, se sube a Drive antes de guardar.
  // Cuando son varios ingresos, cada uno lleva su copia: si compartieran el
  // archivo, borrar uno dejaría al otro apuntando a un comprobante que ya no
  // existe.
  const archivos: Awaited<ReturnType<typeof subirArchivo>>[] = [];
  const limpiarArchivos = () =>
    Promise.all(archivos.map((a) => eliminarArchivo(a.id).catch(() => {})));

  if (campos.comprobante instanceof File && campos.comprobante.size > 0) {
    for (let i = 0; i < partes.length; i++) {
      const subido = await subirArchivo({
        archivo: campos.comprobante,
        nombre: campos.comprobante.name,
        obraSlug: slug,
        tipo: "comprobantes",
      }).catch((e) => {
        return e instanceof Error ? e : new Error("error");
      });
      if (subido instanceof Error) {
        await limpiarArchivos();
        volver(`No se pudo subir el comprobante: ${subido.message}`);
        return;
      }
      archivos.push(subido);
    }
  }

  // Todas las partes se convierten a la cotización de la misma fecha.
  const convertidas = await Promise.all(
    partes.map((p) => convertirMonto(p.monto, campos.moneda, campos.fecha))
  );
  const fallida = convertidas.find((m) => !m.ok);
  if (fallida && !fallida.ok) {
    await limpiarArchivos();
    volver(fallida.error);
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const filas = partes.map((parte, i) => {
    const montos = convertidas[i];
    const archivo = archivos[i];
    return {
      obra_id: obraId,
      fecha: campos.fecha,
      origen: campos.origen,
      empresa_id: parte.empresaId,
      inversor_id: campos.esDeSocia ? null : campos.inversorId,
      concepto: campos.concepto,
      monto: montos.ok ? montos.ars : 0,
      monto_usd: montos.ok ? montos.usd : null,
      cotizacion: montos.ok ? montos.cotizacion : null,
      moneda: campos.moneda,
      observaciones: campos.observaciones === "" ? null : campos.observaciones,
      cargado_por: user?.id ?? null,
      comprobante_drive_id: archivo?.id ?? null,
      comprobante_nombre: archivo?.nombre ?? null,
      comprobante_mime: archivo?.mimeType ?? null,
      comprobante_tamano: archivo?.tamano ?? null,
      // Una cuota prevista es de una sola empresa: se engancha sólo cuando el
      // ingreso también lo es. Repartido entre todas no hay a cuál colgarlo.
      previsto_id: campos.sonTodas ? null : campos.previstoId,
    };
  });

  // Un solo insert: o entran todos los ingresos o no entra ninguno.
  const { error } = await supabase.from("ingresos").insert(filas);

  if (error) {
    // Si falló guardar, se limpian los comprobantes ya subidos a Drive.
    await limpiarArchivos();
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
  // Un ingreso guardado es de una sola empresa; el formulario de edición no
  // ofrece "todas", pero si llegara no hay cómo repartirlo.
  if (campos.sonTodas) volver("Elegí una sola empresa para este ingreso.");

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
    inversor_id: campos.esDeSocia ? null : campos.inversorId,
    concepto: campos.concepto,
    monto: montos.ars,
    monto_usd: montos.usd,
    cotizacion: montos.cotizacion,
    moneda: campos.moneda,
    observaciones: campos.observaciones === "" ? null : campos.observaciones,
  };
  // `aportante` no se toca: quedó como estaba en los ingresos viejos, de
  // respaldo del nombre con el que se cargaron antes de existir la agenda.

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
