import Link from "next/link";
import { Fragment } from "react";
import AppShell from "@/components/AppShell";
import MaterialesNav from "@/components/MaterialesNav";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

/**
 * Qué material entró a la obra, rubro por rubro.
 *
 * Vive en **Obra** y no en Economía porque no habla de plata sino de obra: los
 * $ 5.218.446 del corralón ya están en Gastos; lo que acá importa es que fueron
 * 2.500 ladrillos y 40 bolsas de cemento, y cuánto se lleva puesto en cada
 * rubro. El costo aparece como referencia, no como el número principal.
 *
 * El consumo se arma solo con el detalle que se carga en cada gasto: no hay
 * nada que cargar en esta pantalla. Lo que se edita —el catálogo— vive en la
 * otra solapa.
 */

/** Una compra del material: de qué gasto y de qué factura salió. */
type Compra = {
  gastoId: string;
  fecha: string;
  /** "Factura A · 0001-00001234", "Factura B" o "Efectivo". */
  comprobante: string;
  cantidad: number;
  /** Con el IVA adentro, o null si no se cargó precio. */
  precio: number | null;
};

type Consumo = {
  material: string;
  unidad: string;
  cantidad: number;
  costo: number;
  /** Cada item que lo cargó: dos compras del mismo ladrillo son dos filas. */
  compras: Compra[];
};

export default async function MaterialesPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  // `!inner` para poder filtrar por la obra del gasto: sin eso traería el
  // detalle de todas las obras. Los anulados no entraron a la obra.
  const { data: items } = await supabase
    .from("gasto_materiales")
    .select(
      "cantidad, precio_unitario, materiales(nombre, unidad), gastos!inner(id, obra_id, fecha, estado, tipo_factura, numero_factura, precios_con_iva, alicuota_iva, rubros(nombre))"
    )
    .eq("gastos.obra_id", obra.id)
    .neq("gastos.estado", "Anulado")
    .order("fecha", { referencedTable: "gastos", ascending: false });

  // El consumo, agrupado por rubro y dentro de cada uno por material. Las
  // cantidades se suman entre compras: tres compras de ladrillo son un solo
  // renglón con el total, y debajo cada compra con su factura.
  const porRubro = new Map<string, Map<string, Consumo>>();

  for (const item of items ?? []) {
    const gasto = item.gastos;
    const rubro = gasto?.rubros?.nombre ?? "Sin rubro";
    const material = item.materiales?.nombre ?? "—";
    const unidad = item.materiales?.unidad ?? "";
    const cantidad = Number(item.cantidad);
    // El costo va siempre con el IVA adentro, como el monto del gasto: si el
    // precio se cargó neto (factura A), se le suma la alícuota. Si no, netos y
    // finales se sumarían como si fueran lo mismo.
    const factor = gasto?.precios_con_iva === false
      ? 1 + Number(gasto?.alicuota_iva ?? 21) / 100
      : 1;
    const precio =
      item.precio_unitario === null ? null : Number(item.precio_unitario) * factor;

    const comprobante = gasto?.tipo_factura
      ? `Factura ${gasto.tipo_factura}${gasto.numero_factura ? ` · ${gasto.numero_factura}` : ""}`
      : "Efectivo";

    const delRubro = porRubro.get(rubro) ?? new Map<string, Consumo>();
    const actual = delRubro.get(material) ?? {
      material,
      unidad,
      cantidad: 0,
      costo: 0,
      compras: [],
    };

    delRubro.set(material, {
      ...actual,
      cantidad: actual.cantidad + cantidad,
      costo: actual.costo + (precio === null ? 0 : cantidad * precio),
      compras: [
        ...actual.compras,
        {
          gastoId: gasto?.id ?? "",
          fecha: gasto?.fecha ?? "",
          comprobante,
          cantidad,
          precio,
        },
      ],
    });

    porRubro.set(rubro, delRubro);
  }

  // Todo alfabético, rubros y materiales: a esta pantalla se viene a buscar
  // uno puntual —"¿cuántos ladrillos llevamos?"— y ordenar por lo que pesa
  // obliga a leer la lista entera para encontrarlo.
  const consumo = [...porRubro.entries()]
    .map(([rubro, materiales]) => {
      const filas = [...materiales.values()].sort((a, b) =>
        a.material.localeCompare(b.material)
      );

      return {
        rubro,
        filas,
        costo: filas.reduce((acc, f) => acc + f.costo, 0),
      };
    })
    .sort((a, b) => a.rubro.localeCompare(b.rubro));

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="materiales" />}
    >
      <ObraHeader obra={obra} activeSection="materiales" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Materiales</h2>
      </section>

      <MaterialesNav slug={obra.slug} activa="resumen" />

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Lo que se usó, por rubro</h3>
      </div>

      {consumo.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Todavía no hay materiales cargados en ningún gasto. Se van sumando
            solos a medida que detallás las compras al cargar un gasto de
            materiales, con lo que haya en el{" "}
            <Link href={`/obras/${obra.slug}/materiales/catalogo`} style={enlace}>
              catálogo
            </Link>
            .
          </p>
        </section>
      ) : (
        <div style={acordeones}>
          {consumo.map((grupo) => (
            /* Acordeón por rubro, cerrado: con veinte materiales cargados la
               lista entera sería una pared. El encabezado dice lo que se viene
               a mirar de un vistazo. */
            <details key={grupo.rubro} style={ui.panel}>
              <summary style={resumen}>
                <span style={contenidoResumen}>
                  <span style={tituloRubro}>{grupo.rubro}</span>
                  <span style={ui.note}>
                    {grupo.filas.length}{" "}
                    {grupo.filas.length === 1 ? "material" : "materiales"}
                    {grupo.costo > 0 && ` · ${formatMoney(grupo.costo)}`}
                  </span>
                </span>
              </summary>

              <table style={{ ...ui.table, marginTop: "16px" }}>
                <thead>
                  <tr>
                    <th style={ui.th}>Material</th>
                    <th style={ui.thRight}>Cantidad</th>
                    <th style={ui.th}>Unidad</th>
                    <th style={ui.thRight}>Compras</th>
                    <th style={ui.thRight}>Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.filas.map((fila) => (
                    <Fragment key={fila.material}>
                      <tr>
                        <td style={ui.td}>{fila.material}</td>
                        <td style={ui.tdRight}>
                          <strong>{formatCantidad(fila.cantidad)}</strong>
                        </td>
                        <td style={ui.td}>{fila.unidad}</td>
                        <td style={ui.tdRight}>{fila.compras.length}</td>
                        {/* Sin precio cargado no hay costo, y un cero se leería
                            como "salió gratis". */}
                        <td style={ui.tdRight}>
                          {fila.costo > 0 ? (
                            formatMoney(fila.costo)
                          ) : (
                            <span style={{ color: "#bbbbbb" }}>—</span>
                          )}
                        </td>
                      </tr>

                      {/* Cada compra debajo de su material, con la factura de
                          la que salió: es lo que permite decir "estos
                          ladrillos vinieron en la 0001-00001234". El enlace
                          abre el gasto. */}
                      {fila.compras.map((compra, i) => (
                        <tr key={`${fila.material}-${i}`} style={filaCompra}>
                          <td style={celdaCompra}>
                            <Link
                              href={`/obras/${obra.slug}/gastos/${compra.gastoId}/editar`}
                              style={enlaceCompra}
                            >
                              {formatDate(compra.fecha)} · {compra.comprobante}
                            </Link>
                          </td>
                          <td style={{ ...celdaCompra, textAlign: "right" }}>
                            {formatCantidad(compra.cantidad)}
                          </td>
                          <td style={celdaCompra}>{fila.unidad}</td>
                          <td style={celdaCompra} />
                          <td style={{ ...celdaCompra, textAlign: "right" }}>
                            {compra.precio === null
                              ? "—"
                              : formatMoney(compra.cantidad * compra.precio)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      )}
    </AppShell>
  );
}

/**
 * Las cantidades no son plata: 2.500 ladrillos se escribe sin decimales, pero
 * 6,5 m³ de arena los necesita. Se muestran los que tenga, hasta tres.
 */
function formatCantidad(valor: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(valor);
}

const acordeones = {
  display: "grid",
  gap: "12px",
};

const resumen = {
  cursor: "pointer",
};

// El contenido va en un span aparte: darle display al summary borra el
// triangulito nativo, que es la señal de que el bloque se abre.
const contenidoResumen = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: "14px",
  width: "calc(100% - 28px)",
  verticalAlign: "middle" as const,
};

const tituloRubro = {
  fontSize: "18px",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};

// Las compras van más chicas y en gris, debajo de su material: son el
// desglose del renglón de arriba, no renglones de la misma jerarquía.
const filaCompra = {
  background: "#fafafa",
};

const celdaCompra = {
  padding: "6px 14px 6px 28px",
  fontSize: "13px",
  color: "#777777",
  borderBottom: "1px solid #f0f0f0",
};

const enlaceCompra = {
  color: "#777777",
  textDecoration: "underline",
};
