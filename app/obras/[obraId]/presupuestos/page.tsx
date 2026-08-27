import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonDescarga from "@/components/BotonDescarga";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import TiposDeRubro from "@/components/TiposDeRubro";
import { createClient } from "@/lib/supabase/server";
import {
  aprobarPresupuesto,
  cambiarTiposDeRubro,
  desaprobarPresupuesto,
} from "./actions";

const TIPOS = ["Materiales", "Mano de obra"] as const;

/** La aprobada primera, después las pendientes, las descartadas al final. */
const ORDEN_ESTADO: Record<string, number> = {
  Aprobado: 0,
  Pendiente: 1,
  Descartado: 2,
};

export default async function PresupuestosPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [
    { data: comparacion },
    { data: cotizaciones },
    { data: todosLosRubros },
    { data: gastosCargados },
  ] = await Promise.all([
    supabase
      .from("obra_presupuesto")
      .select("rubro_id, tipo, cotizado, gastado")
      .eq("obra_id", obra.id),
    supabase
      .from("presupuestos")
      .select(
        "id, rubro_id, tipo, numero, monto, moneda, monto_usd, fecha, validez_hasta, estado, detalle, comprobante_drive_id, proveedores(nombre), presupuesto_materiales(cantidad, precio_unitario, orden, materiales(nombre, unidad))"
      )
      .eq("obra_id", obra.id)
      .order("monto"),
    supabase
      .from("rubros")
      .select("id, nombre, orden, activo, usa_materiales, usa_mano_obra")
      .eq("obra_id", obra.id)
      .order("nombre"),
    // Qué se facturó contra cada presupuesto. Son varios cuando el proveedor
    // parte el papel en dos facturas —una por socia, para repartir el crédito
    // fiscal—, y desde la ficha no había forma de ver si estaba entero.
    supabase
      .from("gastos")
      .select("presupuesto_id, monto")
      .eq("obra_id", obra.id)
      .neq("estado", "Anulado")
      .not("presupuesto_id", "is", null),
  ]);

  const lista = cotizaciones ?? [];
  const filas = comparacion ?? [];

  const facturado = new Map<string, { monto: number; cuantos: number }>();

  for (const g of gastosCargados ?? []) {
    if (!g.presupuesto_id) continue;

    const previo = facturado.get(g.presupuesto_id) ?? { monto: 0, cuantos: 0 };
    facturado.set(g.presupuesto_id, {
      monto: previo.monto + Number(g.monto),
      cuantos: previo.cuantos + 1,
    });
  }

  // Un rubro entra a la grilla si está marcado en la obra, o si ya tiene algo
  // cargado aunque lo hayan desmarcado después.
  const conCotizacion = new Set(lista.map((c) => c.rubro_id));
  const conGasto = new Set(
    filas.filter((f) => Number(f.gastado) > 0).map((f) => f.rubro_id)
  );

  const rubros = (todosLosRubros ?? []).filter(
    (r) => r.activo || conCotizacion.has(r.id) || conGasto.has(r.id)
  );

  const buscar = (rubroId: string, tipo: string) =>
    filas.find((f) => f.rubro_id === rubroId && f.tipo === tipo);

  /**
   * Qué bloques mostrar. Manda lo que dicen las casillas del rubro, pero si un
   * tipo desmarcado ya tiene cotizaciones o gastos igual se muestra: esconder
   * algo que existe sería peor que mostrar un bloque de más.
   */
  const tiposDe = (r: (typeof rubros)[number]) =>
    TIPOS.filter((t) => {
      if (t === "Materiales" ? r.usa_materiales : r.usa_mano_obra) return true;
      const f = buscar(r.id, t);
      return (
        lista.some((c) => c.rubro_id === r.id && c.tipo === t) ||
        Number(f?.gastado ?? 0) > 0
      );
    });

  const totalCotizado = filas.reduce((acc, f) => acc + Number(f.cotizado), 0);
  const totalGastado = filas.reduce((acc, f) => acc + Number(f.gastado), 0);

  // Lo que queda por pagar de lo aprobado. Sólo las filas con cotización —lo
  // gastado en un rubro sin cotizar no descuenta de nada— y sólo los saldos
  // positivos: un rubro que se pasó no devuelve plata para otro.
  const totalRestante = filas
    .filter((f) => Number(f.cotizado) > 0)
    .reduce(
      (acc, f) => acc + Math.max(Number(f.cotizado) - Number(f.gastado), 0),
      0
    );
  const pendientes = lista.filter((c) => c.estado === "Pendiente").length;
  const sinCotizar = filas.filter((f) => Number(f.cotizado) === 0).length;

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="presupuestos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Presupuestos</h2>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Cotizado y aprobado</p>
          <h3 style={ui.statNumber}>{formatMoney(totalCotizado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Gastado en esos rubros</p>
          <h3 style={ui.statNumber}>{formatMoney(totalGastado)}</h3>
        </div>
        {/* El mismo número que la ficha "Resta pagar" del Balance, y calculado
            igual: sólo lo que tiene cotización aprobada, y un rubro que se pasó
            no compensa lo que falta en otro. */}
        <div style={ui.statCard}>
          <p style={ui.label}>Restante</p>
          <h3 style={{ ...ui.statNumber, ...estiloFalta }}>
            {formatMoney(totalRestante)}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Cotizaciones pendientes</p>
          <h3 style={ui.statNumber}>{pendientes}</h3>
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Rubro por rubro</h3>

        <div style={accionesToolbar}>
          {/* El catálogo de con quiénes se trabaja se edita acá al lado porque
              es donde uno se da cuenta de que está mal escrito: al ir a cargar
              la cotización. */}
          <Link
            href={`/obras/${obra.slug}/presupuestos/contratistas`}
            style={ui.secondaryButton}
          >
            Contratistas
          </Link>

          <Link href={`/obras/${obra.slug}/presupuestos/nuevo`} style={ui.button}>
            Nueva cotización
          </Link>
        </div>
      </div>

      {rubros.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Esta obra no tiene rubros elegidos. Marcalos en la solapa{" "}
            <Link href={`/obras/${obra.slug}/rubros`} style={enlaceSimple}>
              Rubros
            </Link>{" "}
            para empezar a cargar cotizaciones.
          </p>
        </section>
      ) : (
        <div style={listaRubros}>
          {rubros.map((rubro) => {
            const tipos = tiposDe(rubro);

            return (
              <section key={rubro.id} style={ui.panel}>
                <div style={cabeceraRubro}>
                  <h3 style={tituloRubro}>{rubro.nombre}</h3>

                  <TiposDeRubro
                    rubroId={rubro.id}
                    slug={obra.slug}
                    usaMateriales={rubro.usa_materiales}
                    usaManoObra={rubro.usa_mano_obra}
                    accion={cambiarTiposDeRubro}
                  />
                </div>

                {/* Cada tipo es un acordeón a lo ancho: con muchas cotizaciones
                    el bloque abierto se hacía interminable. Los números viven
                    en el encabezado —la aprobada siempre a la vista— y la lista
                    es el detalle que se abre cuando hace falta. Arrancan
                    cerrados, igual que en el detalle por rubro. */}
                {tipos.map((tipo) => {
                  const fila = buscar(rubro.id, tipo);
                  const cotizado = Number(fila?.cotizado ?? 0);
                  const gastado = Number(fila?.gastado ?? 0);
                  const suyas = lista.filter(
                    (c) => c.rubro_id === rubro.id && c.tipo === tipo
                  );
                  const aprobada = suyas.find((c) => c.estado === "Aprobado");
                  const ordenadas = [...suyas].sort(
                    (a, b) =>
                      (ORDEN_ESTADO[a.estado] ?? 1) - (ORDEN_ESTADO[b.estado] ?? 1) ||
                      Number(a.monto) - Number(b.monto)
                  );

                  return (
                    <details key={tipo} style={acordeonTipo}>
                      {/* El contenido va en un span aparte: darle display al
                          summary borra el triangulito nativo, que es la señal
                          de que esto se abre. Columnas de ancho fijo para que
                          los números arranquen en la misma vertical en todos
                          los rubros. */}
                      <summary style={resumenTipo}>
                        <span style={contenidoResumen}>
                          <span style={tituloTipo}>
                            {tipo}
                            <span style={cuentaCotizaciones}>
                              {suyas.length === 0
                                ? "Sin cotizaciones"
                                : suyas.length === 1
                                  ? "1 cotización"
                                  : `${suyas.length} cotizaciones`}
                            </span>
                          </span>

                          <span style={dato}>
                            <span style={datoLabel}>Aprobada</span>
                            {aprobada ? (
                              <strong style={aprobadaResumen}>
                                {formatMoney(aprobada.monto)}
                              </strong>
                            ) : (
                              <span style={sinDato}>—</span>
                            )}
                          </span>

                          <span style={dato}>
                            <span style={datoLabel}>Gastado</span>
                            <strong>{formatMoney(gastado)}</strong>
                          </span>

                          {/* Lo aprobado menos lo pagado: el saldo que queda
                              por poner. Va siempre en rojo —es plata que falta,
                              no una diferencia a favor—, igual que en el
                              Balance y en el detalle por rubro. Pasarse sale
                              como negativo bajo el mismo rótulo: el signo ya lo
                              dice. */}
                          <span style={dato}>
                            <span style={datoLabel}>Restante</span>
                            {cotizado > 0 ? (
                              <strong style={estiloFalta}>
                                {formatMoney(cotizado - gastado)}
                              </strong>
                            ) : (
                              <span style={sinDato}>—</span>
                            )}
                          </span>

                          <Link
                            href={`/obras/${obra.slug}/presupuestos/nuevo?rubro=${rubro.id}&tipo=${encodeURIComponent(tipo)}`}
                            style={enlaceCotizar}
                          >
                            + Cotizar
                          </Link>
                        </span>
                      </summary>

                      <div style={contenidoAbierto}>
                        {ordenadas.length === 0 ? (
                          <p style={sinCotizaciones}>Sin cotizaciones.</p>
                        ) : (
                          <div style={listaCotizaciones}>
                            {ordenadas.map((c) => {
                              const esAprobada = c.estado === "Aprobado";

                              // Qué se cotizó, no sólo cuánto. Se ordena acá y
                              // no en la consulta: ordenar un embebido de
                              // PostgREST es más frágil que hacerlo con la
                              // lista ya traída.
                              const items = [
                                ...(c.presupuesto_materiales ?? []),
                              ].sort((a, b) => a.orden - b.orden);

                              const sumaItems = items.reduce(
                                (acc, i) =>
                                  acc +
                                  Number(i.cantidad) *
                                    Number(i.precio_unitario ?? 0),
                                0
                              );

                              return (
                                <div
                                  key={c.id}
                                  style={esAprobada ? tarjetaAprobada : tarjeta}
                                >
                                  <div style={cabeceraCotizacion}>
                                    <div>
                                      <strong>{c.proveedores?.nombre ?? "—"}</strong>
                                      {esAprobada && (
                                        <span style={tagOk}>Aprobada</span>
                                      )}
                                      {c.estado === "Descartado" && (
                                        <span style={tagDescartada}>Descartada</span>
                                      )}
                                    </div>

                                    <strong style={montoCotizacion}>
                                      {formatMoney(c.monto)}
                                    </strong>
                                  </div>

                                  {c.detalle && (
                                    <p style={detalleCotizacion}>{c.detalle}</p>
                                  )}

                                  {/* Qué se cotizó, a un clic y sin entrar a
                                      editar: la ficha decía cuánto salía pero
                                      no qué era. Arranca cerrado, como todos
                                      los acordeones de la app, y el summary
                                      queda con su display por defecto para no
                                      perder el triangulito nativo. */}
                                  {items.length > 0 && (
                                    <details style={bloqueItems}>
                                      <summary style={resumenItems}>
                                        {items.length === 1
                                          ? "1 material cotizado"
                                          : `${items.length} materiales cotizados`}
                                        {" · "}
                                        {formatMoney(sumaItems)}
                                      </summary>

                                      <div style={tablaItems}>
                                        <div style={encabezadoItems}>
                                          <span>Material</span>
                                          <span style={derechaItem}>Cantidad</span>
                                          <span style={derechaItem}>
                                            Precio unitario
                                          </span>
                                          <span style={derechaItem}>Subtotal</span>
                                        </div>

                                        {items.map((i, indice) => (
                                          <div
                                            key={`${c.id}-${indice}`}
                                            style={renglonItem}
                                          >
                                            <span>
                                              {i.materiales?.nombre ?? "—"}
                                            </span>
                                            <span style={derechaItem}>
                                              {Number(
                                                i.cantidad
                                              ).toLocaleString("es-AR")}{" "}
                                              {i.materiales?.unidad ?? ""}
                                            </span>
                                            {/* Sin precio va guion y no cero:
                                                un cero se leería como gratis. */}
                                            <span style={derechaItem}>
                                              {i.precio_unitario === null
                                                ? "—"
                                                : formatMoney(
                                                    Number(i.precio_unitario)
                                                  )}
                                            </span>
                                            <span style={derechaItem}>
                                              {i.precio_unitario === null
                                                ? "—"
                                                : formatMoney(
                                                    Number(i.cantidad) *
                                                      Number(i.precio_unitario)
                                                  )}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  )}

                                  {/* Cuánto se facturó contra este papel. Con
                                      dos facturas partidas entre las socias,
                                      es la única forma de ver desde acá si
                                      está entero o falta la otra mitad. */}
                                  {(() => {
                                    const f = facturado.get(c.id);
                                    if (!f) return null;

                                    const resta = Number(c.monto) - f.monto;

                                    return (
                                      <p style={facturadoContra}>
                                        Facturado {formatMoney(f.monto)} en{" "}
                                        {f.cuantos === 1
                                          ? "1 gasto"
                                          : `${f.cuantos} gastos`}
                                        {resta > 0.01 &&
                                          ` · restan ${formatMoney(resta)}`}
                                      </p>
                                    );
                                  })()}

                                  <div style={pieCotizacion}>
                                    <span>
                                      {/* El número va primero: es con lo que
                                          el proveedor identifica el papel, y
                                          lo que se busca al llegar la
                                          factura. */}
                                      {c.numero && `N° ${c.numero} · `}
                                      {formatDate(c.fecha)}
                                      {c.validez_hasta &&
                                        ` · vence ${formatDate(c.validez_hasta)}`}
                                      {c.moneda === "USD" &&
                                        ` · US$ ${Number(c.monto_usd ?? 0).toLocaleString("es-AR")}`}
                                    </span>

                                    <div style={accionesCotizacion}>
                                      {c.comprobante_drive_id && (
                                        <>
                                          <Link
                                            href={`/ver/${c.comprobante_drive_id}?volver=${encodeURIComponent(
                                              `/obras/${obra.slug}/presupuestos`
                                            )}`}
                                            style={enlaceSimple}
                                          >
                                            Ver
                                          </Link>
                                          <BotonDescarga
                                            fileId={c.comprobante_drive_id}
                                            variante="icono"
                                            etiqueta={`Descargar cotización de ${c.proveedores?.nombre ?? "proveedor"}`}
                                          />
                                        </>
                                      )}

                                      <Link
                                        href={`/obras/${obra.slug}/presupuestos/${c.id}/editar`}
                                        style={enlaceSimple}
                                      >
                                        Editar
                                      </Link>

                                      <form
                                        action={
                                          esAprobada
                                            ? desaprobarPresupuesto.bind(null, c.id)
                                            : aprobarPresupuesto.bind(null, c.id)
                                        }
                                      >
                                        <input
                                          type="hidden"
                                          name="slug"
                                          value={obra.slug}
                                        />
                                        <button
                                          type="submit"
                                          style={
                                            esAprobada
                                              ? ui.secondaryButton
                                              : botonAprobar
                                          }
                                        >
                                          {esAprobada ? "Desaprobar" : "Aprobar"}
                                        </button>
                                      </form>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {sinCotizar > 0 && (
        <p style={{ ...ui.note, marginTop: "20px" }}>
          Quedan {sinCotizar} combinaciones de rubro y tipo sin cotización
          aprobada.
        </p>
      )}
    </AppShell>
  );
}

const VERDE = "#15803d";
const ROJO = "#b91c1c";

// Lo que resta pagar va en rojo: es plata que todavía hay que poner, no una
// diferencia a favor. Pasarse de lo cotizado sale como negativo bajo el mismo
// rótulo y comparte el color, que el signo ya lo dice.
const estiloFalta = { color: ROJO };

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const accionesToolbar = {
  display: "flex",
  gap: "12px",
};

const listaRubros = {
  display: "grid",
  gap: "20px",
};

const cabeceraRubro = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  flexWrap: "wrap" as const,
  marginBottom: "6px",
};

const tituloRubro = {
  fontSize: "20px",
  fontWeight: 400,
  margin: 0,
};

const acordeonTipo = {
  borderTop: "1px solid #eeeeee",
  padding: "14px 0",
};

const resumenTipo = {
  cursor: "pointer",
};

const contenidoResumen = {
  display: "inline-grid",
  // Tres columnas de números del mismo ancho fijo: montos completos, sin
  // recortes, y alineados en la misma vertical en todos los rubros.
  gridTemplateColumns: "minmax(0, 1fr) 150px 150px 150px auto",
  alignItems: "center",
  gap: "20px",
  width: "calc(100% - 28px)",
  verticalAlign: "middle" as const,
};

const tituloTipo = {
  display: "inline-grid",
  gap: "2px",
  fontSize: "15px",
  color: "#111111",
};

const cuentaCotizaciones = {
  fontSize: "12px",
  color: "#999999",
};

const dato = {
  display: "inline-grid",
  gap: "4px",
};

const datoLabel = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#777777",
};

const sinDato = {
  color: "#999999",
  fontSize: "14px",
};

// La aprobada va en verde y siempre a la vista, abierto o cerrado el bloque:
// es la que manda sobre el rubro. Sólo el monto: el nombre de quien cotizó
// se veía cortado acá y vive en la ficha, al abrir.
const aprobadaResumen = {
  color: VERDE,
  whiteSpace: "nowrap" as const,
};

const enlaceCotizar = {
  color: "#111111",
  fontSize: "13px",
  textDecoration: "underline",
  justifySelf: "end" as const,
};

const contenidoAbierto = {
  marginTop: "16px",
};

const sinCotizaciones = {
  color: "#999999",
  fontSize: "14px",
  margin: 0,
};

const listaCotizaciones = {
  display: "grid",
  gap: "10px",
};

const tarjeta = {
  border: "1px solid #e5e5e5",
  padding: "12px",
};

const tarjetaAprobada = {
  ...tarjeta,
  border: `1px solid ${VERDE}`,
  background: "#f2faf5",
};

const cabeceraCotizacion = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "12px",
};

const montoCotizacion = {
  whiteSpace: "nowrap" as const,
};

const tagOk = {
  marginLeft: "8px",
  border: `1px solid ${VERDE}`,
  background: VERDE,
  color: "#ffffff",
  padding: "2px 6px",
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const tagDescartada = {
  marginLeft: "8px",
  border: "1px solid #cccccc",
  color: "#999999",
  padding: "2px 6px",
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const detalleCotizacion = {
  fontSize: "14px",
  color: "#555555",
  margin: "8px 0 0",
  lineHeight: 1.5,
};

const bloqueItems = {
  marginTop: "10px",
};

const facturadoContra = {
  margin: "10px 0 0",
  fontSize: "13px",
  color: "#555555",
};

const resumenItems = {
  fontSize: "13px",
  color: "#555555",
  cursor: "pointer",
};

const tablaItems = {
  marginTop: "8px",
  borderTop: "1px solid #e5e5e5",
  fontSize: "13px",
};

// Las cuatro columnas del detalle, en el mismo orden que el formulario: no hay
// que releer el encabezado al saltar de una pantalla a la otra.
const filaItems = {
  display: "grid",
  gridTemplateColumns: "1fr 110px 120px 120px",
  gap: "10px",
  padding: "6px 0",
};

const encabezadoItems = {
  ...filaItems,
  color: "#999999",
  fontSize: "11px",
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  borderBottom: "1px solid #e5e5e5",
};

const renglonItem = {
  ...filaItems,
  color: "#333333",
  borderBottom: "1px solid #f2f2f2",
};

const derechaItem = {
  textAlign: "right" as const,
};

const pieCotizacion = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap" as const,
  marginTop: "10px",
  fontSize: "13px",
  color: "#777777",
};

const accionesCotizacion = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const enlaceSimple = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "13px",
};

const botonAprobar = {
  background: VERDE,
  color: "#ffffff",
  border: `1px solid ${VERDE}`,
  padding: "8px 12px",
  fontSize: "13px",
  cursor: "pointer",
};
