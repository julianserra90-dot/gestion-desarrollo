"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TODAS_LAS_SOCIAS = "todas";
const MONEDAS = ["ARS", "USD"];

const alCentavo = (n: number) => Math.round(n * 100) / 100;

/** El texto de cada cuota se arma solo: el número es lo que la identifica. */
function detalleDeCuota(concepto: string, numero: number) {
  return concepto ? `${concepto} · Cuota Nº ${numero}` : `Cuota Nº ${numero}`;
}

/**
 * Carga una serie de cuotas previstas.
 *
 * El formulario manda la cantidad y, por cada cuota, su fecha y su monto ya
 * editados (11 de 4.000 y una de 6.000 es lo normal, no la excepción). Si
 * aportan todas las socias, cada una recibe su propia serie con la mitad de
 * cada cuota: la agenda es por empresa, igual que los ingresos.
 */
export async function crearCuotas(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const empresaId = String(formData.get("empresa_id") ?? "");
  const concepto = String(formData.get("concepto") ?? "").trim();
  const moneda = String(formData.get("moneda") ?? "ARS");
  const cantidad = Number(formData.get("cantidad") ?? 0);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/ingresos/agenda/nuevo?error=${encodeURIComponent(mensaje)}`
    );

  if (!empresaId) volver("Elegí qué empresa va a poner las cuotas.");
  if (!MONEDAS.includes(moneda)) volver("Elegí la moneda de las cuotas.");
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 120) {
    volver("La cantidad de cuotas tiene que ser entre 1 y 120.");
  }

  const cuotas: { numero: number; fecha: string; monto: number }[] = [];
  for (let n = 1; n <= cantidad; n++) {
    const fecha = String(formData.get(`cuota_fecha_${n}`) ?? "").trim();
    const monto = Number(formData.get(`cuota_monto_${n}`) ?? 0);
    if (!fecha) volver(`Falta la fecha de la cuota Nº ${n}.`);
    if (!Number.isFinite(monto) || monto <= 0) {
      volver(`El monto de la cuota Nº ${n} tiene que ser mayor a cero.`);
    }
    cuotas.push({ numero: n, fecha, monto });
  }

  const supabase = await createClient();

  // A quiénes se les anotan: una empresa, o todas las socias de la obra.
  let empresas: string[];
  if (empresaId === TODAS_LAS_SOCIAS) {
    const { data: socios } = await supabase
      .from("obra_socios")
      .select("empresa_id, empresas(nombre)")
      .eq("obra_id", obraId);
    empresas = (socios ?? [])
      .sort((a, b) =>
        (a.empresas?.nombre ?? "").localeCompare(b.empresas?.nombre ?? "")
      )
      .map((s) => s.empresa_id);
    if (empresas.length < 2) {
      volver("La obra necesita al menos dos socias para repartir las cuotas.");
    }
  } else {
    empresas = [empresaId];
  }

  const filas = empresas.flatMap((empresa, i) => {
    const serieId = crypto.randomUUID();
    return cuotas.map((c) => {
      // Entre varias, cada una pone su parte; el centavo que sobra va a la
      // primera para que las partes sumen la cuota entera.
      const parte = alCentavo(c.monto / empresas.length);
      const resto = alCentavo(c.monto - parte * empresas.length);
      return {
        obra_id: obraId,
        empresa_id: empresa,
        serie_id: serieId,
        numero_cuota: c.numero,
        fecha_prevista: c.fecha,
        monto: alCentavo(parte + (i === 0 ? resto : 0)),
        moneda,
        detalle: detalleDeCuota(concepto, c.numero),
      };
    });
  });

  const { error } = await supabase.from("ingresos_previstos").insert(filas);
  if (error) volver(error.message);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/ingresos/agenda`);
}

export async function actualizarPrevisto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const previstoId = String(formData.get("previsto_id") ?? "");

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/ingresos/agenda/${previstoId}/editar?error=${encodeURIComponent(mensaje)}`
    );

  const empresaId = String(formData.get("empresa_id") ?? "");
  const fecha = String(formData.get("fecha_prevista") ?? "").trim();
  const monto = Number(formData.get("monto") ?? 0);
  const moneda = String(formData.get("moneda") ?? "ARS");
  const detalle = String(formData.get("detalle") ?? "").trim();
  const observaciones = String(formData.get("observaciones") ?? "").trim();

  if (!empresaId) volver("Elegí qué empresa pone la cuota.");
  if (!fecha) volver("Poné la fecha prevista.");
  if (!Number.isFinite(monto) || monto <= 0) {
    volver("El monto tiene que ser mayor a cero.");
  }
  if (!MONEDAS.includes(moneda)) volver("Elegí la moneda.");
  if (!detalle) volver("Poné un detalle para la cuota.");

  const supabase = await createClient();

  const { error } = await supabase
    .from("ingresos_previstos")
    .update({
      empresa_id: empresaId,
      fecha_prevista: fecha,
      monto,
      moneda,
      detalle,
      observaciones: observaciones === "" ? null : observaciones,
    })
    .eq("id", previstoId);

  if (error) volver(error.message);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/ingresos/agenda`);
}

/**
 * Borra una cuota prevista. Si ya la cumplió un ingreso, ese ingreso queda
 * (es plata que entró de verdad); sólo pierde el enganche con la agenda.
 */
export async function eliminarPrevisto(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const previstoId = String(formData.get("previsto_id") ?? "");

  const supabase = await createClient();

  const { error } = await supabase
    .from("ingresos_previstos")
    .delete()
    .eq("id", previstoId);

  if (error) {
    redirect(
      `/obras/${slug}/ingresos/agenda/${previstoId}/editar?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/ingresos/agenda`);
}
