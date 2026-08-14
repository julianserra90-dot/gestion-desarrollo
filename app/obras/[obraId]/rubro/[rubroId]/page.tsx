import Link from "next/link";
import AppShell from "@/components/AppShell";
import DetalleDeGasto from "@/components/DetalleDeGasto";
import EtiquetaComprobante from "@/components/EtiquetaComprobante";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { getPresupuestosDeObra } from "@/lib/presupuestos";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_DE_GASTO } from "@/lib/tipos-gasto";

/**
 * En qué se fue la plata de un rubro, contra lo que se había cotizado.
 *
 * Se entra desde "En qué se gastó" en Economía, tocando el rubro. Responde la
 * pregunta que sigue naturalmente a ver el total: cuánto fue material y cuánto
 * mano de obra, cuánto de eso estaba cotizado y cuánto falta pagar.
 *
 * **No hay totales del rubro entero, y es a propósito.** Los había, y mentían:
 * sumaban la cotización de la mano de obra contra lo gastado en materiales más
 * mano de obra, así que el "falta pagar" salía enorme y sin sentido. Cada tipo
 * se compara sólo contra su propia cotización, que es la única comparación que
 * significa algo.
 */

export default async function RubroDetalle({
  params,
}: {
  params: Promise<{ obraId: string; rubroId: string }>;
}) {
  const { obraId, rubroId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: rubro }, { data: gastos }, presupuestos] = await Promise.all([
    supabase.from("rubros").select("id, nombre").eq("id", rubroId).maybeSingle(),
    supabase
      .from("gastos")
      .select(
        "id, fecha, concepto, monto, monto_caja, tipo_gasto, tipo_factura, tipo_pago, estado, compartido, comprobante_drive_id, proveedor_id, proveedores(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre)"
      )
      .eq("obra_id", obra.id)
      .eq("rubro_id", rubroId)
      .order("fecha", { ascending: false }),
    getPresupuestosDeObra(obra.id),
  ]);

  if (!rubro) {
    return <AppShell>Rubro no encontrado</AppShell>;
  }

  // Los anulados no son plata que se gastó: quedan afuera, igual que en el
  // total de Economía desde donde se llegó acá.
  const vigentes = (gastos ?? []).filter((g) => g.estado !== "Anulado");

  const cotizacionesDelRubro = presupuestos.filter((p) => p.rubro_id === rubroId);

  // Un tipo entra si tiene gastos o si tiene una cotización aprobada: un rubro
  // cotizado y todavía sin gastar es justamente lo que hay que poder mirar.
  const bloques = TIPOS_DE_GASTO.map((tipo) => {
    const items = vigentes.filter((g) => g.tipo_gasto === tipo);
    const cotizacion = cotizacionesDelRubro.find((p) => p.tipo === tipo);

    return {
      tipo,
      items,
      gastado: items.reduce((acc, g) => acc + Number(g.monto), 0),
      cotizado: cotizacion?.cotizado ?? 0,
      proveedor: cotizacion?.proveedor ?? null,
    };
  }).filter((bloque) => bloque.items.length > 0 || bloque.cotizado > 0);

  /** Quién puso la plata, con las mismas reglas que el listado de gastos. */
  const quienPago = (gasto: (typeof vigentes)[number]) => {
    if (gasto.compartido) return "Entre las socias";
    if (gasto.pagadora?.nombre) return gasto.pagadora.nombre;
    return Number(gasto.monto_caja) > 0 ? "Dinero en cuenta" : "—";
  };

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="economia" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>En qué se gastó</p>
        <h2 style={ui.pageTitle}>{rubro.nombre}</h2>
        <p style={ui.subtitle}>
          Lo gastado en este rubro contra lo cotizado. Cada tipo se compara por
          separado: la cotización de la mano de obra no tiene nada que ver con
          lo que se gastó en materiales.
        </p>
      </section>

      {bloques.length === 0 ? (
        <section style={ui.panelConMargen}>
          <p style={ui.vacio}>
            Todavía no hay gastos ni cotizaciones en {rubro.nombre}.
          </p>
        </section>
      ) : (
        bloques.map((bloque) => {
          const hayCotizacion = bloque.cotizado > 0;
          const faltaBloque = bloque.cotizado - bloque.gastado;

          return (
            /* Acordeón nativo (`details`): abre y cierra sin JavaScript, así la
               página sigue siendo un server component. Arrancan **cerrados** y
               los números viven en el encabezado, que es lo que se viene a
               mirar; la tabla de gastos es el detalle y se abre cuando hace
               falta. */
            <details key={bloque.tipo} style={ui.panelConMargen}>
              {/* Los tres rótulos son siempre los mismos —Cotizado, Gastado,
                  Falta pagar— y las columnas tienen ancho fijo, así se alinean
                  entre bloques y la pantalla se lee de un vistazo. Nada de
                  "cotizado · Hugo" ni "sin cotización aprobada": el rótulo que
                  cambia de bloque en bloque rompe la grilla. Lo que no se puede
                  calcular es un guión, no un cero, que se leería como "no falta
                  nada". */}
              <summary style={resumen}>
                <span style={contenidoResumen}>
                  <span style={tituloBloque}>{bloque.tipo}</span>

                  <span style={dato}>
                    <span style={datoLabel}>Cotizado</span>
                    {hayCotizacion ? (
                      <strong>{formatMoney(bloque.cotizado)}</strong>
                    ) : (
                      <span style={sinDato}>—</span>
                    )}
                  </span>

                  <span style={dato}>
                    <span style={datoLabel}>Gastado</span>
                    <strong>{formatMoney(bloque.gastado)}</strong>
                  </span>

                  {/* Pasarse de lo cotizado sale como número negativo bajo el
                      mismo rótulo, en vez de cambiarlo por "Se pasó": el signo
                      ya lo dice y la columna queda igual en todos los bloques. */}
                  <span style={dato}>
                    <span style={datoLabel}>Falta pagar</span>
                    {hayCotizacion ? (
                      <strong style={estiloFalta}>
                        {formatMoney(faltaBloque)}
                      </strong>
                    ) : (
                      <span style={sinDato}>—</span>
                    )}
                  </span>
                </span>
              </summary>

              <div style={contenidoAbierto}>
                {/* Quién cotizó salió del encabezado para no romper la grilla,
                    pero es un dato que se busca: vive acá, al abrir. */}
                {bloque.proveedor && (
                  <p style={quienCotizo}>Cotizó {bloque.proveedor}.</p>
                )}

                {bloque.items.length === 0 ? (
                  <p style={ui.vacio}>Cotizado, sin gastos cargados todavía.</p>
                ) : (
                  /* Las columnas van en el mismo orden que en Gastos, para no
                     tener que releer el encabezado al saltar de una pantalla a
                     la otra. Faltan Rubro y Tipo, que acá serían la misma
                     respuesta en todas las filas. */
                  <table style={ui.table}>
                    <thead>
                      <tr>
                        <th style={ui.th}>Fecha</th>
                        <th style={ui.th}>Destino</th>
                        <th style={ui.th}>Detalle</th>
                        <th style={ui.th}>Comprobante</th>
                        <th style={ui.th}>Pagó</th>
                        <th style={ui.thRight}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bloque.items.map((gasto) => (
                        <tr key={gasto.id}>
                          <td style={ui.td}>{formatDate(gasto.fecha)}</td>
                          <td style={ui.td}>
                            {gasto.proveedor_id ? (
                              <Link
                                href={`/obras/${obra.slug}/proveedor/${gasto.proveedor_id}`}
                                style={enlace}
                              >
                                {gasto.proveedores?.nombre ?? "—"}
                              </Link>
                            ) : (
                              (gasto.proveedores?.nombre ?? "—")
                            )}
                          </td>
                          <td style={ui.td}>
                            <DetalleDeGasto
                              fecha={gasto.fecha}
                              inicioObra={obra.fecha_inicio}
                              concepto={gasto.concepto}
                            />
                          </td>
                          <td style={ui.td}>
                            <EtiquetaComprobante
                              tipoFactura={gasto.tipo_factura}
                              driveId={gasto.comprobante_drive_id}
                              volver={`/obras/${obra.slug}/rubro/${rubroId}`}
                            />
                          </td>
                          <td style={ui.td}>{quienPago(gasto)}</td>
                          <td style={ui.tdRight}>
                            <strong>{formatMoney(Number(gasto.monto))}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </details>
          );
        })
      )}

      <p style={{ ...ui.note, marginTop: "24px" }}>
        Lo cotizado sale de las cotizaciones aprobadas en{" "}
        <Link href={`/obras/${obra.slug}/presupuestos`} style={enlace}>
          Presupuestos
        </Link>
        .{" "}
        <Link href={`/obras/${obra.slug}`} style={enlace}>
          Volver a Economía
        </Link>
        .
      </p>
    </AppShell>
  );
}

// Lo que falta pagar va en rojo: es plata que todavía hay que poner. Se probó
// con un rojo suave y quedaba desdibujado justo en el número que más se mira.
// Pasarse sale como negativo bajo el mismo rótulo, así que comparte el color.
const estiloFalta = { color: "#b91c1c" };

const resumen = {
  cursor: "pointer",
};

/**
 * El contenido del encabezado va en un `span` aparte, no en el `summary`
 * directamente: poniéndole un display propio al summary se pierde el triangulito
 * nativo, que es la única señal de que el bloque se abre. El ancho descuenta lo
 * que ocupa el triangulito.
 */
const contenidoResumen = {
  display: "inline-grid",
  // Ancho fijo en las tres columnas de números: así arrancan en la misma
  // vertical en todos los bloques. Con anchos por contenido cada fila caía en
  // un lugar distinto y la pantalla se leía torcida.
  gridTemplateColumns: "minmax(0, 1fr) 180px 180px 180px",
  alignItems: "center",
  gap: "20px",
  width: "calc(100% - 28px)",
  verticalAlign: "middle",
};

const tituloBloque = {
  fontSize: "18px",
};

const sinDato = {
  color: "#999999",
  fontSize: "14px",
};

const dato = {
  display: "inline-grid",
  gap: "4px",
};

const contenidoAbierto = {
  marginTop: "20px",
};

const quienCotizo = {
  ...ui.note,
  margin: "0 0 16px",
};

const datoLabel = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#777777",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};
