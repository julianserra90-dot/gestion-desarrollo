import type { ItemCargado } from "@/components/ItemsDeMaterial";

/**
 * Borradores de gasto: el formulario a medio cargar, guardado tal cual.
 *
 * Puro (no toca la base): lo usan el server action que lo guarda, el
 * formulario que lo retoma y el listado que lo muestra.
 *
 * Se guarda lo que manda el navegador —cada campo con sus valores— y no
 * columnas interpretadas, porque interpretar es justamente lo que un gasto a
 * medio cargar todavía no permite (sin fecha no hay cotización, sin monto no
 * hay reparto). Al retomarlo, cada campo vuelve con lo que tenía.
 */

/** El formulario como lo manda el navegador: cada campo con sus valores. */
export type CamposBorrador = Record<string, string[]>;

/** Identifican la pantalla, no el gasto: no se guardan. */
const FUERA_DEL_BORRADOR = new Set(["obra_id", "slug", "borrador_id", "gasto_id"]);

/** Los campos de texto del formulario. Los archivos van aparte, a Drive. */
export function camposDelFormulario(formData: FormData): CamposBorrador {
  const campos: CamposBorrador = {};
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor !== "string") continue;
    if (FUERA_DEL_BORRADOR.has(clave) || clave.startsWith("$ACTION")) continue;
    (campos[clave] ??= []).push(valor);
  }
  return campos;
}

/** El primer valor de un campo, o null si no vino o vino vacío. */
export function valorDe(campos: CamposBorrador | null | undefined, clave: string) {
  const valor = campos?.[clave]?.[0];
  return valor === undefined || valor.trim() === "" ? null : valor;
}

/** Una casilla tildada: el navegador la manda como "on", y destildada no la manda. */
export function tildado(campos: CamposBorrador | null | undefined, clave: string) {
  return campos?.[clave]?.[0] === "on";
}

/**
 * Los materiales del detalle, como los espera `ItemsDeMaterial`. Las tres
 * listas se cruzan por posición, igual que en el server action; una fila sin
 * nada escrito no vuelve.
 */
export function itemsDelBorrador(campos: CamposBorrador): ItemCargado[] {
  const materiales = campos.item_material ?? [];
  const cantidades = campos.item_cantidad ?? [];
  const precios = campos.item_precio ?? [];

  return materiales
    .map((materialId, i) => ({
      materialId,
      cantidad: cantidades[i] ?? "",
      precio: precios[i] ?? "",
    }))
    .filter((f) => f.materialId !== "" || f.cantidad !== "" || f.precio !== "");
}

/** Las facturas de un gasto facturado en varias: empresa, monto y número. */
export function facturasDelBorrador(campos: CamposBorrador) {
  const cantidad = Number(valorDe(campos, "facturas_cantidad") ?? 0);
  const facturas: { empresaId: string; monto: number; numero: string | null }[] = [];

  for (let i = 1; i <= cantidad; i++) {
    const empresaId = valorDe(campos, `factura_empresa_${i}`);
    if (!empresaId) continue;
    facturas.push({
      empresaId,
      monto: Number(valorDe(campos, `factura_monto_${i}`) ?? 0),
      numero: valorDe(campos, `factura_numero_${i}`),
    });
  }

  return facturas;
}

/** Lo que el listado muestra de un borrador: lo mismo que de un gasto, lo que haya. */
export type ResumenBorrador = {
  fecha: string | null;
  rubroId: string | null;
  tipoGasto: string | null;
  proveedorId: string | null;
  /** El nombre escrito para un proveedor que todavía no está en el catálogo. */
  proveedorNuevo: string | null;
  concepto: string | null;
  /** Lo que se lleva escrito de plata, en su moneda. Vacío si nada. */
  montos: { valor: number; moneda: "ARS" | "USD" }[];
};

export function resumenDelBorrador(campos: CamposBorrador): ResumenBorrador {
  const numero = (clave: string) => Number(valorDe(campos, clave) ?? 0) || 0;

  // Pagado con la cuenta, el gasto es lo que sale de ella: el campo "monto"
  // ni se muestra. Si no, es el monto en su moneda.
  const montos: ResumenBorrador["montos"] = [];
  if (tildado(campos, "usar_caja")) {
    const pesos = numero("caja_pesos_en_dolares") || numero("caja_ars");
    if (pesos > 0) montos.push({ valor: pesos, moneda: "ARS" });
    if (!valorDe(campos, "caja_pesos_en_dolares") && numero("caja_usd") > 0) {
      montos.push({ valor: numero("caja_usd"), moneda: "USD" });
    }
  } else if (numero("monto") > 0) {
    montos.push({
      valor: numero("monto"),
      moneda: valorDe(campos, "moneda") === "USD" ? "USD" : "ARS",
    });
  }

  const proveedorId = valorDe(campos, "proveedor_id");

  return {
    fecha: valorDe(campos, "fecha"),
    rubroId: valorDe(campos, "rubro_id"),
    tipoGasto: valorDe(campos, "tipo_gasto"),
    proveedorId: proveedorId === "__nuevo__" ? null : proveedorId,
    proveedorNuevo: proveedorId === "__nuevo__" ? valorDe(campos, "proveedor_nuevo") : null,
    concepto: valorDe(campos, "concepto"),
    montos,
  };
}
