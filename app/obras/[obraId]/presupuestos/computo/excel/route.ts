import { getComputo, listadoDeMateriales, ordenDeRubro } from "@/lib/computo";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

/**
 * El cómputo para abrir en Excel.
 *
 * Va como CSV con punto y coma y coma decimal, que es lo que el Excel en
 * castellano abre directo con doble clic, cada número en su celda. Un .xlsx
 * de verdad pedía sumar una librería para lo mismo. La marca BOM al principio
 * es la que le dice a Excel que es UTF-8: sin ella "Zócalos" sale "ZÃ³calos".
 *
 * Con ?vista=materiales baja el listado de materiales en vez de la planilla.
 * Los permisos son los de siempre: lee con la sesión del usuario y el RLS
 * decide.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ obraId: string }> }
) {
  const { obraId } = await params;
  const vista = new URL(request.url).searchParams.get("vista");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 401 });

  const obra = await getObraPorSlug(obraId);
  if (!obra) return new Response("No encontrado", { status: 404 });

  const computo = await getComputo(obra.id);
  if (!computo) return new Response("La obra no tiene cómputo", { status: 404 });

  const { data: rubros } = await supabase
    .from("rubros")
    .select("id, nombre")
    .eq("obra_id", obra.id);
  const nombreDeRubro = new Map((rubros ?? []).map((r) => [r.id, r.nombre]));

  const filas: (string | number)[][] = [];

  if (vista === "materiales") {
    filas.push(["Material", "Unidad", "Cantidad", "Precio unitario", "Importe", "Tareas"]);
    let total = 0;
    for (const m of listadoDeMateriales(computo.items)) {
      filas.push([
        m.descripcion,
        m.unidad,
        m.cantidad,
        m.cantidad > 0 ? m.importe / m.cantidad : 0,
        m.importe,
        m.tareas,
      ]);
      total += m.importe;
    }
    filas.push([]);
    filas.push(["Total materiales", "", "", "", total, ""]);
  } else {
    filas.push([
      "Rubro",
      "Tarea",
      "Unidad",
      "Cantidad",
      "Materiales unitario",
      "Materiales subtotal",
      "Mano de obra unitario",
      "Mano de obra subtotal",
      "Integrado unitario",
      "Integrado subtotal",
      "Total",
    ]);

    const items = [...computo.items].sort((a, b) => {
      const ra = nombreDeRubro.get(a.rubroId) ?? "";
      const rb = nombreDeRubro.get(b.rubroId) ?? "";
      return ordenDeRubro(ra) - ordenDeRubro(rb) || ra.localeCompare(rb, "es");
    });

    let mat = 0;
    let mo = 0;
    let int = 0;
    for (const i of items) {
      const m = i.cantidad * i.precioMateriales;
      const o = i.cantidad * i.precioManoObra;
      const n = i.cantidad * i.precioIntegrado;
      mat += m;
      mo += o;
      int += n;
      filas.push([
        nombreDeRubro.get(i.rubroId) ?? "",
        i.nombre,
        i.unidad,
        i.cantidad,
        i.precioMateriales,
        m,
        i.precioManoObra,
        o,
        i.precioIntegrado,
        n,
        m + o + n,
      ]);
    }
    filas.push([]);
    filas.push(["Total", "", "", "", "", mat, "", mo, "", int, mat + mo + int]);
  }

  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  const nombre = `${vista === "materiales" ? "materiales" : "computo"}-${obra.slug}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}

/** Un valor como lo lee Excel en castellano: coma decimal, texto entre comillas. */
function celda(valor: string | number) {
  if (typeof valor === "number") {
    return (Math.round(valor * 100) / 100).toString().replace(".", ",");
  }
  return `"${valor.replace(/"/g, '""')}"`;
}
