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
