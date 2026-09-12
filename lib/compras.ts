/**
 * Una compra partida en varias facturas.
 *
 * SÓLO SERVIDOR: lee de la base.
 *
 * El corralón parte una compra grande en dos facturas, una por socia, para
 * repartir el crédito fiscal. Cada factura es un gasto, pero los materiales se
 * cargan una sola vez: en la **principal**. Las otras apuntan a ella con
 * `compra_de_gasto_id` y no tienen items propios.
 */

import { createClient } from "@/lib/supabase/server";

/** Una factura principal a la que otra se puede enganchar, con sus materiales. */
export type FacturaDeCompra = {
  id: string;
  fecha: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  /** "Factura A · 0001-00001234", o "Factura A" si no tiene número. */
  comprobante: string;
  monto: number;
  items: { nombre: string; unidad: string; cantidad: number; precio: number | null }[];
};

/** Otra factura de la misma compra, para mostrarla junto a la principal. */
export type FacturaVinculada = {
  id: string;
  fecha: string;
  comprobante: string;
  monto: number;
  pagadora: string | null;
};

export function textoComprobante(tipo: string | null, numero: string | null) {
  if (!tipo) return "Efectivo";
  return numero ? `Factura ${tipo} · ${numero}` : `Factura ${tipo}`;
}

/**
 * Las facturas de materiales de la obra a las que se puede enganchar otra:
 * facturadas, con items cargados, no anuladas y que no estén ellas mismas
 * enganchadas a otra (una cadena no se entiende). Las más nuevas primero: la
 * segunda factura se carga días después de la primera, no meses.
 */
export async function getFacturasDeCompra(
  obraId: string,
  excepto?: string
): Promise<FacturaDeCompra[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("gastos")
    .select(
      "id, fecha, monto, tipo_factura, numero_factura, proveedor_id, proveedores(nombre), gasto_materiales(cantidad, precio_unitario, materiales(nombre, unidad))"
    )
    .eq("obra_id", obraId)
    .eq("tipo_gasto", "Materiales")
    .neq("estado", "Anulado")
    .not("tipo_factura", "is", null)
    .is("compra_de_gasto_id", null)
    .order("fecha", { ascending: false })
    .limit(60);

  return (data ?? [])
    .filter((g) => g.id !== excepto && g.gasto_materiales.length > 0)
    .map((g) => ({
      id: g.id,
      fecha: g.fecha,
      proveedorId: g.proveedor_id,
      proveedorNombre: g.proveedores?.nombre ?? null,
      comprobante: textoComprobante(g.tipo_factura, g.numero_factura),
      monto: Number(g.monto),
      items: g.gasto_materiales.map((i) => ({
        nombre: i.materiales?.nombre ?? "—",
        unidad: i.materiales?.unidad ?? "",
        cantidad: Number(i.cantidad),
        precio: i.precio_unitario === null ? null : Number(i.precio_unitario),
      })),
    }));
}

/** Las facturas enganchadas a una principal. */
export async function getFacturasVinculadas(
  principalId: string
): Promise<FacturaVinculada[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("gastos")
    .select(
      "id, fecha, monto, tipo_factura, numero_factura, pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre)"
    )
    .eq("compra_de_gasto_id", principalId)
    .neq("estado", "Anulado")
    .order("fecha");

  return (data ?? []).map((g) => ({
    id: g.id,
    fecha: g.fecha,
    comprobante: textoComprobante(g.tipo_factura, g.numero_factura),
    monto: Number(g.monto),
    pagadora: g.pagadora?.nombre ?? null,
  }));
}

/**
 * Para toda la obra: de cada principal, sus otras facturas. Lo usa el resumen
 * de Materiales para decir que una compra vino en dos papeles.
 */
export async function getVinculadasPorPrincipal(obraId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("gastos")
    .select("id, fecha, tipo_factura, numero_factura, compra_de_gasto_id")
    .eq("obra_id", obraId)
    .neq("estado", "Anulado")
    .not("compra_de_gasto_id", "is", null)
    .order("fecha");

  const porPrincipal = new Map<string, { id: string; fecha: string; comprobante: string }[]>();
  for (const g of data ?? []) {
    if (!g.compra_de_gasto_id) continue;
    const lista = porPrincipal.get(g.compra_de_gasto_id) ?? [];
    lista.push({
      id: g.id,
      fecha: g.fecha,
      comprobante: textoComprobante(g.tipo_factura, g.numero_factura),
    });
    porPrincipal.set(g.compra_de_gasto_id, lista);
  }
  return porPrincipal;
}
