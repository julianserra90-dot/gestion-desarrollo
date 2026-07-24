/**
 * Cotización del dólar oficial, tomada de Ámbito Financiero.
 *
 * SÓLO SERVIDOR.
 *
 * Se usa el promedio entre compra y venta, que es lo que se suele tomar como
 * referencia para valuar costos.
 *
 * Por qué la cotización histórica y no la de hoy: con la inflación argentina,
 * un gasto de $1.000.000 en enero no representa los mismos dólares que
 * $1.000.000 hoy. Convertir todo al dólar actual subestimaría groseramente lo
 * que costaron los gastos viejos. Por eso cada gasto se convierte al dólar de
 * SU fecha.
 */

const BASE = "https://mercados.ambito.com/dolar/oficial";

export type Cotizacion = {
  compra: number;
  venta: number;
  promedio: number;
  fecha: string;
};

// La cotización cambia una vez por día: alcanza con refrescarla cada media hora.
const TTL_ACTUAL = 30 * 60 * 1000;
const TTL_HISTORICO = 6 * 60 * 60 * 1000;

let cacheActual: { valor: Cotizacion; expira: number } | null = null;
const cacheHistorico = new Map<string, { valor: Map<string, number>; expira: number }>();

/**
 * Pasa un número con formato argentino a number.
 * "1.459,89" -> 1459.89   (el punto separa miles, la coma decimales)
 */
function parsearNumero(texto: string): number {
  return Number(String(texto).replace(/\./g, "").replace(",", "."));
}

/** "22/07/2026" -> "2026-07-22" */
function aIso(fecha: string): string {
  const [dia, mes, anio] = fecha.split("/");
  return `${anio}-${mes}-${dia}`;
}

/** Mueve una fecha ISO tantos días (negativo = hacia atrás). */
function correr(fechaIso: string, dias: number): string {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);

  return fecha.toISOString().slice(0, 10);
}

// En el histórico de Ámbito la fecha de inicio entra y la de fin NO: pedir
// 04/06 a 04/06 devuelve cero filas, y 20/05 a 04/06 termina en el 03/06. Por
// eso el rango se pide con margen para los dos lados.
//
// Sin esto, la cotización de una fecha puntual nunca llegaba y todo caía al
// dólar de hoy: un gasto de junio cargado en julio quedaba valuado al dólar de
// julio, que es justo lo que este módulo quiere evitar.
//
// Adelante alcanza con un día. Atrás va más margen porque un movimiento de un
// día no hábil se resuelve con la cotización del día hábil anterior, y esa
// fila tiene que estar en el rango.
const MARGEN_ATRAS = 15;
const MARGEN_ADELANTE = 1;

async function pedir(url: string) {
  const respuesta = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    // Sin caché de Next: el caché lo maneja este módulo en memoria.
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!respuesta.ok) {
    throw new Error(`Ámbito respondió ${respuesta.status}`);
  }

  return respuesta.json();
}

/** Cotización de hoy. Devuelve null si la fuente no responde. */
export async function getCotizacionActual(): Promise<Cotizacion | null> {
  if (cacheActual && cacheActual.expira > Date.now()) {
    return cacheActual.valor;
  }

  try {
    const datos = await pedir(`${BASE}/variacion`);
    const compra = parsearNumero(datos.compra);
    const venta = parsearNumero(datos.venta);

    if (!Number.isFinite(compra) || !Number.isFinite(venta)) return null;

    const valor: Cotizacion = {
      compra,
      venta,
      promedio: (compra + venta) / 2,
      fecha: String(datos.fecha ?? ""),
    };

    cacheActual = { valor, expira: Date.now() + TTL_ACTUAL };
    return valor;
  } catch {
    // Si la fuente falla, la pantalla lo avisa en vez de mostrar números falsos.
    return null;
  }
}

/**
 * Cotizaciones diarias (promedio compra/venta) entre dos fechas ISO.
 * Devuelve un mapa fecha -> promedio. Sólo trae días hábiles.
 */
async function getHistorico(
  desde: string,
  hasta: string
): Promise<Map<string, number>> {
  const clave = `${desde}|${hasta}`;
  const enCache = cacheHistorico.get(clave);
  if (enCache && enCache.expira > Date.now()) return enCache.valor;

  const mapa = new Map<string, number>();

  try {
    const filas = await pedir(`${BASE}/historico-general/${desde}/${hasta}`);

    // La primera fila es el encabezado ["Fecha","Compra","Venta"].
    for (const fila of Array.isArray(filas) ? filas.slice(1) : []) {
      const [fecha, compra, venta] = fila;
      const c = parsearNumero(compra);
      const v = parsearNumero(venta);
      if (Number.isFinite(c) && Number.isFinite(v)) {
        mapa.set(aIso(fecha), (c + v) / 2);
      }
    }

    cacheHistorico.set(clave, { valor: mapa, expira: Date.now() + TTL_HISTORICO });
  } catch {
    // Se devuelve vacío: quien llama cae en la cotización actual.
  }

  return mapa;
}

export type Convertidor = {
  /** Cotización aplicable a esa fecha, o null si no se pudo determinar. */
  cotizacionDe: (fechaIso: string) => number | null;
  actual: Cotizacion | null;
  /** true si hubo que usar la cotización de hoy por falta de datos históricos. */
  usoFallback: boolean;
};

/**
 * Arma un convertidor para un conjunto de fechas.
 *
 * Para una fecha sin dato propio (fin de semana, feriado) usa la cotización del
 * día hábil anterior más cercano, que es lo que corresponde.
 */
export async function getConvertidor(fechas: string[]): Promise<Convertidor> {
  const actual = await getCotizacionActual();
  const validas = fechas.filter(Boolean).sort();

  if (validas.length === 0) {
    return { cotizacionDe: () => actual?.promedio ?? null, actual, usoFallback: false };
  }

  const historico = await getHistorico(
    correr(validas[0], -MARGEN_ATRAS),
    correr(validas[validas.length - 1], MARGEN_ADELANTE)
  );
  const disponibles = [...historico.keys()].sort();
  let usoFallback = false;

  function cotizacionDe(fechaIso: string): number | null {
    const exacta = historico.get(fechaIso);
    if (exacta) return exacta;

    // El día hábil anterior más cercano.
    let anterior: string | null = null;
    for (const d of disponibles) {
      if (d <= fechaIso) anterior = d;
      else break;
    }

    if (anterior) return historico.get(anterior) ?? null;

    // Fecha previa a todo el histórico disponible (o la fuente falló).
    usoFallback = true;
    return actual?.promedio ?? null;
  }

  return { cotizacionDe, actual, get usoFallback() { return usoFallback; } };
}

/**
 * Cotización aplicable a una fecha puntual. Se usa al guardar un gasto.
 *
 * Si la fecha no tiene cotización propia (fin de semana, feriado, o una fecha
 * futura), cae al día hábil más cercano disponible y, en última instancia, a la
 * cotización de hoy. Devuelve null sólo si la fuente está caída.
 */
export async function getCotizacionDeFecha(
  fechaIso: string
): Promise<number | null> {
  const convertidor = await getConvertidor([fechaIso]);
  return convertidor.cotizacionDe(fechaIso);
}

export type MontoConvertido =
  | { ok: true; ars: number; usd: number | null; cotizacion: number | null }
  | { ok: false; error: string };

/**
 * Deja un monto expresado en las dos monedas.
 *
 * Lo usan los gastos y los ingresos de fondos: en los dos casos se guarda el
 * valor en pesos (es lo que suman los totales) más el equivalente en dólares y
 * la cotización usada. La conversión va al dólar oficial de la fecha del
 * movimiento, no al del día en que se carga.
 *
 * `cotizacionManual` la pisa. Sirve para cuando el cambio del día fue otro: si
 * vendiste los dólares a mejor precio que el oficial, el gasto tiene que quedar
 * valuado a lo que realmente pagaste, no a lo que decía Ámbito.
 */
export async function convertirMonto(
  montoIngresado: number,
  moneda: string,
  fecha: string,
  cotizacionManual?: number | null
): Promise<MontoConvertido> {
  const cotizacion =
    cotizacionManual && cotizacionManual > 0
      ? cotizacionManual
      : await getCotizacionDeFecha(fecha);

  if (moneda === "USD") {
    // Sin cotización no hay forma de saber cuántos pesos son: mejor frenar que
    // guardar un movimiento que rompería los totales.
    if (!cotizacion) {
      return {
        ok: false,
        error:
          "No se pudo obtener la cotización del dólar para convertirlo a pesos. Probá de nuevo en un rato o cargalo en pesos.",
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

