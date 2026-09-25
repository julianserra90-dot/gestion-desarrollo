import Link from "next/link";
import { Fragment } from "react";
import AppShell from "@/components/AppShell";
import MaterialesNav from "@/components/MaterialesNav";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getAcopiosDeObra } from "@/lib/acopios";
import { formatDate, formatMoney } from "@/lib/format";
import { factorDescuento } from "@/lib/items-material";
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
      "cantidad, precio_unitario, materiales(nombre, unidad), gastos!inner(id, obra_id, fecha, estado, es_acopio, tipo_factura, numero_factura, precios_con_iva, alicuota_iva, descuento_detalle, rubros(nombre), gasto_facturas(numero))"
    )
    .eq("gastos.obra_id", obra.id)
    .neq("gastos.estado", "Anulado")
    .order("fecha", { referencedTable: "gastos", ascending: false });

  // El consumo, agrupado por rubro y dentro de cada uno por material. Las
  // cantidades se suman entre compras: tres compras de ladrillo son un solo
  // renglón con el total, y debajo cada compra con su factura.
  const porRubro = new Map<string, Map<string, Consumo>>();

  // Lo que suma el detalle de cada gasto, a precio de lista: el descuento de
  // la factura se reparte entre sus materiales en proporción a eso.
  const sumaPorGasto = new Map<string, number>();
  for (const item of items ?? []) {
    const id = item.gastos?.id ?? "";
    const subtotal = Number(item.cantidad) * Number(item.precio_unitario ?? 0);
    sumaPorGasto.set(id, (sumaPorGasto.get(id) ?? 0) + subtotal);
  }

  for (const item of items ?? []) {
    const gasto = item.gastos;
    // Los items de un acopio son lo que quedó en el corralón, no lo que entró
    // a la obra: lo que entró son sus retiros, que se suman más abajo.
    if (gasto?.es_acopio) continue;
    const rubro = gasto?.rubros?.nombre ?? "Sin rubro";
    const material = item.materiales?.nombre ?? "—";
    const unidad = item.materiales?.unidad ?? "";
    const cantidad = Number(item.cantidad);
    // El costo va siempre con el IVA adentro, como el monto del gasto: si el
    // precio se cargó neto (factura A), se le suma la alícuota. Si no, netos y
    // finales se sumarían como si fueran lo mismo.
    // Y con el descuento de la factura, si hizo uno: el material costó lo que
    // se pagó, no el precio de lista.
    const factor =
      (gasto?.precios_con_iva === false ? 1 + Number(gasto?.alicuota_iva ?? 21) / 100 : 1) *
      factorDescuento(Number(gasto?.descuento_detalle ?? 0), sumaPorGasto.get(gasto?.id ?? "") ?? 0);
    const precio =
      item.precio_unitario === null ? null : Number(item.precio_unitario) * factor;

    // Facturado en varias: los números de todas, uno tras otro.
    const numeros = (gasto?.gasto_facturas ?? []).map((f) => f.numero).filter(Boolean);
    const numero =
      numeros.length > 0
        ? numeros.join(" + ")
        : (gasto?.gasto_facturas?.length ?? 0) > 1
          ? `${gasto?.gasto_facturas?.length} facturas`
          : gasto?.numero_factura;
    const comprobante = `${gasto?.tipo_factura ? `Factura ${gasto.tipo_factura}` : "Efectivo"}${
      numero ? ` · ${numero}` : ""
    }`;

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

  // Los acopios: lo que entró a la obra son sus retiros, cada uno con fecha,
  // y se suman al consumo del rubro del acopio como una compra más.
  const acopios = await getAcopiosDeObra(obra.id);
  for (const a of acopios) {
    const delRubro = porRubro.get(a.rubro) ?? new Map<string, Consumo>();
    for (const r of a.retiros) {
      for (const i of r.items) {
        const actual = delRubro.get(i.material) ?? {
          material: i.material,
          unidad: i.unidad,
          cantidad: 0,
          costo: 0,
          compras: [],
        };
        delRubro.set(i.material, {
          ...actual,
          cantidad: actual.cantidad + i.cantidad,
          costo: actual.costo + (i.precio === null ? 0 : i.cantidad * i.precio),
          compras: [
            ...actual.compras,
            {
              gastoId: a.gastoId,
              fecha: r.fecha,
              comprobante: `Retiro del acopio${a.proveedor ? ` · ${a.proveedor}` : ""}`,
              cantidad: i.cantidad,
              precio: i.precio,
            },
          ],
        });
      }
    }
    // Aunque no haya retiros todavía: el rubro tiene que aparecer para mostrar
    // el acopio pagado y que nada entró.
    porRubro.set(a.rubro, delRubro);
  }
  const acopiosPorRubro = new Map<string, typeof acopios>();
  for (const a of acopios) {
    acopiosPorRubro.set(a.rubro, [...(acopiosPorRubro.get(a.rubro) ?? []), a]);
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
                    {(acopiosPorRubro.get(grupo.rubro)?.length ?? 0) > 0 &&
                      ` · ${acopiosPorRubro.get(grupo.rubro)!.length} ${acopiosPorRubro.get(grupo.rubro)!.length === 1 ? "acopio" : "acopios"}`}
                  </span>
                </span>
              </summary>

              {grupo.filas.length > 0 && (
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
                          abre la ficha del gasto —para mirar, no la edición—:
                          desde ahí se ve la factura o se pasa a editar. */}
                      {fila.compras.map((compra, i) => (
                        <tr key={`${fila.material}-${i}`} style={filaCompra}>
                          <td style={celdaCompra}>
                            <Link
                              href={`/obras/${obra.slug}/gastos/${compra.gastoId}`}
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
              )}

              {/* Los acopios del rubro: cuánto se pagó, cuánto ya entró a la
                  obra en retiros y cuánto queda por retirar. La pregunta que
                  se hace meses después de haber pagado. */}
              {(acopiosPorRubro.get(grupo.rubro) ?? []).map((a) => (
                <div key={a.gastoId} style={acopioFila}>
                  <div>
                    <span style={tagAcopio}>Acopio</span>{" "}
                    <Link href={`/obras/${obra.slug}/gastos/${a.gastoId}`} style={enlace}>
                      {a.concepto ?? a.proveedor ?? "Acopio"}
                    </Link>
                    <span style={ui.note}> · {formatDate(a.fecha)}</span>
                  </div>
                  <div style={acopioNumeros}>
                    Pagado {formatMoney(a.monto)}
                    {" · "}
                    {a.retiros.length === 0
                      ? "nada entró a la obra todavía"
                      : `entró ${formatMoney(a.retirado)} en ${a.retiros.length} ${a.retiros.length === 1 ? "retiro" : "retiros"}`}
                    {a.retirado > 0 &&
                      a.monto - a.retirado > 0.005 &&
                      ` · quedan ${formatMoney(a.monto - a.retirado)}`}
                  </div>
                </div>
              ))}
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

// Una línea por acopio, debajo de la tabla del rubro.
const acopioFila = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap" as const,
  marginTop: "12px",
  padding: "10px 14px",
  border: "1px solid #eeeeee",
  borderRadius: "10px",
  fontSize: "14px",
};

const acopioNumeros = {
  fontSize: "13px",
  color: "#555555",
};

const tagAcopio = {
  display: "inline-block",
  borderRadius: "6px",
  padding: "2px 7px",
  fontSize: "11px",
  background: "#fdf3e3",
  color: "#92400e",
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
