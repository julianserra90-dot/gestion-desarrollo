/**
 * Lo cotizado y lo gastado de cada rubro.
 *
 * SÓLO SERVIDOR.
 *
 * Lo usa el formulario de gastos para avisar cuando un gasto deja el rubro por
 * encima de lo que se había cotizado. Es un aviso y no un freno: siempre puede
 * aparecer una compra de urgencia que nadie cotizó.
 */

import { createClient } from "@/lib/supabase/server";

export type PresupuestoRubro = {
  rubro_id: string;
  tipo: string;
  cotizado: number;
  gastado: number;
  proveedor: string | null;
};

export async function getPresupuestosDeObra(
  obraId: string
): Promise<PresupuestoRubro[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("obra_presupuesto")
    .select("rubro_id, tipo, cotizado, gastado, proveedor_id")
    .eq("obra_id", obraId)
    .gt("cotizado", 0);

  const filas = data ?? [];
  if (filas.length === 0) return [];

  // Los nombres de quienes cotizaron, para poder decir "por encima de lo que
  // cotizó Fulano" en vez de un monto suelto.
  const ids = [...new Set(filas.map((f) => f.proveedor_id).filter(Boolean))];

  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .in("id", ids as string[]);

  const nombres = new Map((proveedores ?? []).map((p) => [p.id, p.nombre]));

  return filas.map((f) => ({
    rubro_id: f.rubro_id ?? "",
    tipo: f.tipo ?? "",
    cotizado: Number(f.cotizado ?? 0),
    gastado: Number(f.gastado ?? 0),
    proveedor: f.proveedor_id ? (nombres.get(f.proveedor_id) ?? null) : null,
  }));
}

/**
 * Los presupuestos que tienen items cargados, para que la compra los traiga en
 * vez de recargarlos a mano.
 *
 * Es otra pregunta que `getPresupuestosDeObra`, que viene sumado por rubro
 * para avisar si un gasto se pasa: acá hace falta cada presupuesto suelto, con
 * su número y su lista, porque de uno puntual es de donde se copia.
 *
 * Vienen **todos** los de materiales, tengan items o no: el desplegable no
 * sirve sólo para copiar la lista, también para decir de qué presupuesto salió
 * la compra. Eso importa cuando el proveedor parte un presupuesto en **dos
 * facturas** —una por socia, para repartir el crédito fiscal—: la segunda no
 * lleva detalle pero sí tiene que quedar enganchada al mismo papel.
 *
 * No se filtra por estado: un presupuesto que todavía no se aprobó es justo del
 * que se está por comprar.
 *
 * Cada uno viene con **lo que ya se cargó contra él**, que es lo que evita el
 * error silencioso: si los materiales ya se detallaron en otro gasto y se
 * vuelven a traer, la solapa Materiales cuenta 6.600 ladrillos donde entraron
 * 3.300. El material entró una sola vez; partir la factura es un acto fiscal,
 * no una segunda entrega.
 */
export type GastoDelPresupuesto = {
  id: string;
  fecha: string;
  monto: number;
  /** Si este gasto se quedó con el detalle de materiales del presupuesto. */
  tieneItems: boolean;
};

export type PresupuestoConItems = {
  id: string;
  numero: string | null;
  fecha: string;
  monto: number;
  proveedor_id: string;
  items: { materialId: string; cantidad: string; precio: string }[];
  gastos: GastoDelPresupuesto[];
};

export async function getPresupuestosConItems(
  obraId: string
): Promise<PresupuestoConItems[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("presupuestos")
    .select(
      "id, numero, fecha, monto, proveedor_id, presupuesto_materiales(material_id, cantidad, precio_unitario, orden)"
    )
    .eq("obra_id", obraId)
    .eq("tipo", "Materiales")
    .order("fecha", { ascending: false });

  const presupuestos = data ?? [];
  if (presupuestos.length === 0) return [];

  // Lo ya facturado contra cada presupuesto. Los anulados no cuentan, igual que
  // en todos los totales de la app.
  const { data: gastos } = await supabase
    .from("gastos")
    .select("id, fecha, monto, presupuesto_id, gasto_materiales(id)")
    .eq("obra_id", obraId)
    .neq("estado", "Anulado")
    .in(
      "presupuesto_id",
      presupuestos.map((p) => p.id)
    );

  const porPresupuesto = new Map<string, GastoDelPresupuesto[]>();

  for (const g of gastos ?? []) {
    if (!g.presupuesto_id) continue;

    const lista = porPresupuesto.get(g.presupuesto_id) ?? [];
    lista.push({
      id: g.id,
      fecha: g.fecha,
      monto: Number(g.monto),
      tieneItems: (g.gasto_materiales ?? []).length > 0,
    });
    porPresupuesto.set(g.presupuesto_id, lista);
  }

  return presupuestos.map((p) => ({
    id: p.id,
    numero: p.numero,
    fecha: p.fecha,
    monto: Number(p.monto),
    proveedor_id: p.proveedor_id,
    // El orden se acomoda acá y no en la consulta: ordenar un embebido de
    // PostgREST es más frágil que hacerlo con la lista ya traída.
    items: [...(p.presupuesto_materiales ?? [])]
      .sort((a, b) => a.orden - b.orden)
      .map((i) => ({
        materialId: i.material_id,
        cantidad: String(i.cantidad),
        precio: i.precio_unitario === null ? "" : String(i.precio_unitario),
      })),
    gastos: porPresupuesto.get(p.id) ?? [],
  }));
}
