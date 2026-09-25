/**
 * Acopios: se paga hoy y el material entra a la obra después, en retiros.
 *
 * SÓLO SERVIDOR: lee de la base.
 *
 * Un acopio es un gasto marcado (`es_acopio`). Lo que entró a la obra son sus
 * retiros, cada uno con fecha y materiales; los items del gasto en sí son lo
 * que quedó acopiado en el corralón, no consumo. Por eso Materiales suma los
 * retiros y no los items del acopio.
 */

import { factorDescuento } from "@/lib/items-material";
import { createClient } from "@/lib/supabase/server";

export type RetiroItem = {
  materialId: string;
  material: string;
  unidad: string;
  cantidad: number;
  precio: number | null;
};

export type Retiro = {
  id: string;
  fecha: string;
  observaciones: string | null;
  items: RetiroItem[];
  /** Lo que valen los items con precio, con el IVA adentro. */
  valor: number;
};

type FilaRetiro = {
  id: string;
  fecha: string;
  observaciones: string | null;
  acopio_retiro_items: {
    material_id: string;
    cantidad: number;
    precio_unitario: number | null;
    orden: number;
    materiales: { nombre: string; unidad: string } | null;
  }[];
};

/**
 * Un precio sin cargar en el retiro se toma del acopio si ese material está
 * acopiado con precio: es lo que se pagó por él. El factor lleva el precio a
 * IVA adentro cuando el acopio se cargó neto (factura A).
 */
function armar(
  f: FilaRetiro,
  precioAcopio: Map<string, number>,
  factor: number
): Retiro {
  const items = [...f.acopio_retiro_items]
    .sort((a, b) => a.orden - b.orden)
    .map((i) => {
      const propio = i.precio_unitario === null ? null : Number(i.precio_unitario);
      const precio = propio ?? precioAcopio.get(i.material_id) ?? null;
      return {
        materialId: i.material_id,
        material: i.materiales?.nombre ?? "—",
        unidad: i.materiales?.unidad ?? "",
        cantidad: Number(i.cantidad),
        precio: precio === null ? null : precio * factor,
      };
    });

  return {
    id: f.id,
    fecha: f.fecha,
    observaciones: f.observaciones,
    items,
    valor: items.reduce((acc, i) => acc + i.cantidad * (i.precio ?? 0), 0),
  };
}

const SELECT_RETIRO =
  "id, fecha, observaciones, acopio_retiro_items(material_id, cantidad, precio_unitario, orden, materiales(nombre, unidad))";

/**
 * Lo que se pagó por cada material acopiado: el precio de lista con el
 * descuento de la factura, si hizo uno. El precio que se escribe en un retiro
 * no pasa por acá: es el que se cargó para ese retiro.
 */
function preciosAcopiados(
  items: { material_id: string; cantidad: number; precio_unitario: number | null }[],
  descuento: number
) {
  const suma = items.reduce(
    (acc, i) => acc + Number(i.cantidad) * Number(i.precio_unitario ?? 0),
    0
  );
  const conDescuento = factorDescuento(descuento, suma);
  const precios = new Map<string, number>();
  for (const i of items) {
    if (i.precio_unitario !== null) {
      precios.set(i.material_id, Number(i.precio_unitario) * conDescuento);
    }
  }
  return precios;
}

/** Los precios con que se acopió cada material, y el factor de IVA del acopio. */
async function preciosDelAcopio(gastoId: string) {
  const supabase = await createClient();
  const [{ data: gasto }, { data: items }] = await Promise.all([
    supabase
      .from("gastos")
      .select("precios_con_iva, alicuota_iva, tipo_factura, descuento_detalle")
      .eq("id", gastoId)
      .maybeSingle(),
    supabase
      .from("gasto_materiales")
      .select("material_id, cantidad, precio_unitario")
      .eq("gasto_id", gastoId),
  ]);

  const factor =
    gasto?.tipo_factura === "A" && gasto.precios_con_iva === false
      ? 1 + Number(gasto.alicuota_iva ?? 21) / 100
      : 1;
  const precios = preciosAcopiados(items ?? [], Number(gasto?.descuento_detalle ?? 0));
  return { precios, factor };
}

/** Los retiros de un acopio, del más nuevo al más viejo. */
export async function getRetirosDeAcopio(gastoId: string): Promise<Retiro[]> {
  const supabase = await createClient();
  const [{ data }, { precios, factor }] = await Promise.all([
    supabase
      .from("acopio_retiros")
      .select(SELECT_RETIRO)
      .eq("gasto_id", gastoId)
      .order("fecha", { ascending: false }),
    preciosDelAcopio(gastoId),
  ]);
  return ((data ?? []) as FilaRetiro[]).map((f) => armar(f, precios, factor));
}

export async function getRetiro(gastoId: string, retiroId: string): Promise<Retiro | null> {
  const supabase = await createClient();
  const [{ data }, { precios, factor }] = await Promise.all([
    supabase
      .from("acopio_retiros")
      .select(SELECT_RETIRO)
      .eq("gasto_id", gastoId)
      .eq("id", retiroId)
      .maybeSingle(),
    preciosDelAcopio(gastoId),
  ]);
  return data ? armar(data as FilaRetiro, precios, factor) : null;
}

export type AcopioDeObra = {
  gastoId: string;
  fecha: string;
  proveedor: string | null;
  rubro: string;
  concepto: string | null;
  /** Lo pagado por el acopio. */
  monto: number;
  /** Lo que valen los retiros con precio: lo ya entrado a la obra. */
  retirado: number;
  retiros: Retiro[];
};

/**
 * Los acopios de la obra con sus retiros, para Materiales: cuánto se pagó,
 * cuánto ya entró y qué materiales fueron. Los anulados no cuentan.
 */
export async function getAcopiosDeObra(obraId: string): Promise<AcopioDeObra[]> {
  const supabase = await createClient();

  const { data: acopios } = await supabase
    .from("gastos")
    // Literal y no armado con `+`: el cliente tipado sólo entiende el select
    // si puede leerlo como texto fijo.
    .select(
      "id, fecha, concepto, monto, precios_con_iva, alicuota_iva, tipo_factura, descuento_detalle, proveedores(nombre), rubros(nombre), gasto_materiales(material_id, cantidad, precio_unitario), acopio_retiros(id, fecha, observaciones, acopio_retiro_items(material_id, cantidad, precio_unitario, orden, materiales(nombre, unidad)))"
    )
    .eq("obra_id", obraId)
    .eq("es_acopio", true)
    .neq("estado", "Anulado")
    .order("fecha", { ascending: false });

  return (acopios ?? []).map((a) => {
    const factor =
      a.tipo_factura === "A" && a.precios_con_iva === false
        ? 1 + Number(a.alicuota_iva ?? 21) / 100
        : 1;
    const precios = preciosAcopiados(a.gasto_materiales, Number(a.descuento_detalle ?? 0));
    const retiros = (a.acopio_retiros as FilaRetiro[])
      .map((r) => armar(r, precios, factor))
      .sort((x, y) => y.fecha.localeCompare(x.fecha));

    return {
      gastoId: a.id,
      fecha: a.fecha,
      proveedor: a.proveedores?.nombre ?? null,
      rubro: a.rubros?.nombre ?? "Sin rubro",
      concepto: a.concepto,
      monto: Number(a.monto),
      retirado: retiros.reduce((acc, r) => acc + r.valor, 0),
      retiros,
    };
  });
}
