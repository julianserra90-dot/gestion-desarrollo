import { type CamposBorrador } from "@/lib/borradores";
import { GASTO_COMPARTIDO } from "@/lib/reparto";

/**
 * Repetir un gasto: el formulario de alta, precargado con uno que ya está.
 *
 * Puro (no toca la base): lo usa la pantalla de nuevo gasto para armar la
 * precarga, y el formulario para reconstruir lo que se le pidió a la cuenta.
 *
 * Hay gastos que vuelven todos los meses —impuestos, honorarios, un alquiler—
 * y cargarlos de cero cada vez es escribir ocho campos que no cambiaron. La
 * precarga sale en la misma forma que la de un borrador (`CamposBorrador`), así
 * que el formulario no se entera de la diferencia: ya sabía arrancar con
 * valores puestos.
 *
 * **Qué no se copia**, porque es de esa vez y no del gasto que se repite:
 *
 * - La fecha. Va la de hoy, que es el sentido del botón.
 * - El comprobante y el número de factura. El papel es otro; copiar el número
 *   dejaría dos gastos declarando la misma factura.
 * - La cotización que se puso a mano. Ese fue el cambio de ese día; hoy rige
 *   el de hoy, y si hace falta otro se vuelve a escribir.
 * - De qué cotización salió la compra (`presupuesto_id`). Es la procedencia de
 *   aquella compra; heredarla en silencio sería afirmar algo que nadie dijo.
 *
 * Todo lo demás se copia y se puede editar, que es lo que se pidió: lo normal
 * es que cambie el monto y nada más.
 */

/**
 * Lo que hace falta para saber qué se le pidió a la cuenta. Va aparte porque
 * el formulario lo calcula también al editar, donde tiene menos columnas a
 * mano que acá.
 */
export type PagoConLaCuenta = {
  monto: number;
  caja_ars: number;
  caja_usd: number;
  cotizacion: number | null;
  pesos_con_dolares: boolean;
};

/** Lo que hace falta de un gasto para repetirlo. */
export type GastoParaRepetir = PagoConLaCuenta & {
  rubro_id: string | null;
  proveedor_id: string | null;
  empresa_receptora_id: string | null;
  tipo_gasto: string;
  es_acopio: boolean;
  concepto: string | null;
  tipo_pago: string | null;
  tipo_factura: string | null;
  alicuota_iva: number | null;
  precios_con_iva: boolean;
  empresa_factura_id: string | null;
  monto_usd: number | null;
  moneda: string;
  descuento_detalle: number | null;
  observaciones: string | null;
  empresa_pagadora_id: string | null;
  compartido: boolean;
};

/**
 * Lo que se le pidió a la cuenta de la obra, en los términos del formulario.
 *
 * El gasto guarda lo que la cuenta **puso** (`caja_ars`, `caja_usd`); el
 * formulario pregunta lo que se le **pide**, que es más: si el saldo no
 * alcanzaba, la diferencia la cubrió una socia y el campo de pesos la incluía.
 * Esto rearma esa cifra, y lo usan los dos lados que la necesitan: editar un
 * gasto y repetirlo.
 *
 * `pesosEnDolares` en null quiere decir que el gasto no se cargó en el modo
 * "pesos con dólares"; el formulario reconoce ese modo por la presencia del
 * campo, no por su valor.
 */
export function loPedidoALaCuenta(gasto: PagoConLaCuenta): {
  usaLaCuenta: boolean;
  ars: string;
  usd: string;
  pesosEnDolares: string | null;
} {
  const usaLaCuenta = Number(gasto.caja_ars) > 0 || Number(gasto.caja_usd) > 0;

  // En pesos con dólares no se pidieron pesos de la cuenta: lo que no
  // cubrieron los dólares lo puso una socia.
  const deCuenta =
    Number(gasto.caja_ars) + Number(gasto.caja_usd) * Number(gasto.cotizacion ?? 0);
  const pedidoArs = gasto.pesos_con_dolares
    ? 0
    : deCuenta <= 0
      ? 0
      : Number(gasto.caja_ars) + Math.max(Number(gasto.monto) - deCuenta, 0);

  return {
    usaLaCuenta,
    ars: pedidoArs > 0 ? String(Math.round(pedidoArs * 100) / 100) : "",
    usd: Number(gasto.caja_usd) > 0 ? String(gasto.caja_usd) : "",
    pesosEnDolares: gasto.pesos_con_dolares ? String(gasto.monto) : null,
  };
}

/**
 * El gasto, en la forma en que el formulario lee una precarga.
 *
 * `hoy` llega de afuera —la pantalla, que sabe en qué día está— en vez de
 * calcularse acá: así esta función sigue siendo pura y la fecha no depende del
 * huso del servidor.
 */
export function camposParaRepetir(
  gasto: GastoParaRepetir,
  hoy: string
): CamposBorrador {
  const campos: CamposBorrador = {};

  /** Un campo vacío no se pone: el formulario lo lee como "no vino". */
  const poner = (clave: string, valor: string | null | undefined) => {
    if (valor !== null && valor !== undefined && valor !== "") campos[clave] = [valor];
  };

  poner("fecha", hoy);
  poner("rubro_id", gasto.rubro_id);
  poner("tipo_gasto", gasto.tipo_gasto);
  poner("proveedor_id", gasto.proveedor_id);
  poner("empresa_receptora_id", gasto.empresa_receptora_id);
  poner("concepto", gasto.concepto);
  poner("observaciones", gasto.observaciones);

  // Quién puso la plata. "Entre las socias" ocupa el lugar de una empresa en
  // el desplegable, igual que al editar.
  poner(
    "empresa_pagadora_id",
    gasto.compartido ? GASTO_COMPARTIDO : gasto.empresa_pagadora_id
  );
  poner("empresa_factura_id", gasto.empresa_factura_id);

  // Sin factura el formulario llama "sin" al efectivo. Un gasto viejo
  // facturado sin tipo cargado cae en A, el caso más común, como al editar.
  poner(
    "tipo_factura",
    gasto.tipo_pago === "Efectivo" ? "sin" : (gasto.tipo_factura ?? "A")
  );
  poner("alicuota_iva", gasto.alicuota_iva === null ? null : String(gasto.alicuota_iva));
  if (gasto.precios_con_iva) poner("precios_con_iva", "on");
  if (gasto.es_acopio) poner("es_acopio", "on");
  if (gasto.descuento_detalle) poner("descuento_detalle", String(gasto.descuento_detalle));

  const cuenta = loPedidoALaCuenta(gasto);

  if (cuenta.usaLaCuenta) {
    // Pagado con la cuenta, el gasto es lo que sale de ella: no hay monto
    // aparte que precargar.
    poner("usar_caja", "on");
    poner("caja_ars", cuenta.ars);
    poner("caja_usd", cuenta.usd);
    // Va aunque sea vacío: el modo se reconoce por la presencia del campo.
    if (cuenta.pesosEnDolares !== null) {
      campos.caja_pesos_en_dolares = [cuenta.pesosEnDolares];
    }
  } else {
    // El monto se repite en la moneda en que se cargó, que es como se escribe.
    poner(
      "monto",
      gasto.moneda === "USD"
        ? gasto.monto_usd === null
          ? null
          : String(gasto.monto_usd)
        : String(gasto.monto)
    );
    poner("moneda", gasto.moneda);
  }

  return campos;
}
