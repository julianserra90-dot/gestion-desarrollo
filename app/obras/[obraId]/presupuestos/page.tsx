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

  const [{ data: comparacion }, { data: cotizaciones }, { data: todosLosRubros }] =
    await Promise.all([
      supabase
        .from("obra_presupuesto")
        .select("rubro_id, tipo, cotizado, gastado")
        .eq("obra_id", obra.id),
      supabase
        .from("presupuestos")
        .select(
          "id, rubro_id, tipo, monto, moneda, monto_usd, fecha, validez_hasta, estado, detalle, comprobante_drive_id, proveedores(nombre)"
        )
        .eq("obra_id", obra.id)
        .order("monto"),
      supabase
        .from("rubros")
        .select("id, nombre, orden, activo, usa_materiales, usa_mano_obra")
        .eq("obra_id", obra.id)
        .order("orden"),
    ]);

  const lista = cotizaciones ?? [];
  const filas = comparacion ?? [];

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
  const pendientes = lista.filter((c) => c.estado === "Pendiente").length;
  const sinCotizar = filas.filter((f) => Number(f.cotizado) === 0).length;

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="presupuestos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Presupuestos</h2>
        <p style={ui.subtitle}>
          Las cotizaciones que se pidieron por rubro. Al lado de cada uno se
          marca si lleva materiales, mano de obra o las dos, y de cada bloque se
          aprueba la elegida.
        </p>
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
        <div style={ui.statCard}>
          <p style={ui.label}>Diferencia</p>
          <h3 style={{ ...ui.statNumber, ...estiloDiferencia(totalGastado - totalCotizado) }}>
            {totalGastado > totalCotizado ? "+" : ""}
            {formatMoney(totalGastado - totalCotizado)}
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

              {/* Un rubro que sólo se compra ocupa el ancho entero: no tiene
                  sentido dejar media pantalla vacía. */}
              <div style={tipos.length === 1 ? unTipo : dosTipos}>
                {tipos.map((tipo) => {
                  const fila = buscar(rubro.id, tipo);
                  const cotizado = Number(fila?.cotizado ?? 0);
                  const gastado = Number(fila?.gastado ?? 0);
                  const suyas = lista.filter(
                    (c) => c.rubro_id === rubro.id && c.tipo === tipo
                  );

                  return (
                    <div key={tipo} style={bloqueTipo}>
                      <div style={cabeceraTipo}>
                        <p style={ui.eyebrow}>{tipo}</p>

                        <Link
                          href={`/obras/${obra.slug}/presupuestos/nuevo?rubro=${rubro.id}&tipo=${encodeURIComponent(tipo)}`}
                          style={enlaceCotizar}
                        >
                          + Cotizar
                        </Link>
                      </div>

                      {/* Lo aprobado contra lo que realmente se gastó: es la
                          lectura que ordena la obra. */}
                      {(cotizado > 0 || gastado > 0) && (
                        <div style={comparativa}>
                          <div style={filaComp}>
                            <span>Cotizado</span>
                            <strong>
                              {cotizado > 0 ? formatMoney(cotizado) : "—"}
                            </strong>
                          </div>
                          <div style={filaComp}>
                            <span>Gastado</span>
                            <strong>{formatMoney(gastado)}</strong>
                          </div>
                          {cotizado > 0 && (
                            <div style={filaComp}>
                              <span>Diferencia</span>
                              <strong style={estiloDiferencia(gastado - cotizado)}>
                                {gastado > cotizado ? "+" : ""}
                                {formatMoney(gastado - cotizado)}
                              </strong>
                            </div>
                          )}
                        </div>
                      )}

                      {suyas.length === 0 ? (
                        <p style={sinCotizaciones}>Sin cotizaciones.</p>
                      ) : (
                        <div style={listaCotizaciones}>
                          {suyas.map((c) => {
                            const aprobada = c.estado === "Aprobado";

                            return (
                              <div
                                key={c.id}
                                style={aprobada ? tarjetaAprobada : tarjeta}
                              >
                                <div style={cabeceraCotizacion}>
                                  <div>
                                    <strong>{c.proveedores?.nombre ?? "—"}</strong>
                                    {aprobada && <span style={tagOk}>Aprobada</span>}
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

                                <div style={pieCotizacion}>
                                  <span>
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
                                        aprobada
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
                                        style={aprobada ? ui.secondaryButton : botonAprobar}
                                      >
                                        {aprobada ? "Desaprobar" : "Aprobar"}
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
                  );
                })}
              </div>
            </section>
            );
          })}
        </div>
      )}

      <p style={{ ...ui.note, marginTop: "20px" }}>
        {sinCotizar > 0 && (
          <>
            Quedan {sinCotizar} combinaciones de rubro y tipo sin cotización
            aprobada.{" "}
          </>
        )}
        Aprobar no obliga a nada: si aparece una compra de urgencia que nadie
        cotizó, el gasto se carga igual eligiendo otro proveedor. El total
        aprobado es el presupuesto real de la obra, distinto del estimado que se
        carga en <strong>Editar obra</strong>.
      </p>
    </AppShell>
  );
}

const VERDE = "#15803d";
const ROJO = "#b91c1c";

// Gastar menos de lo cotizado es buena noticia; más, no.
function estiloDiferencia(valor: number) {
  if (valor > 0) return { color: ROJO };
  if (valor < 0) return { color: VERDE };
  return undefined;
}

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
  marginBottom: "20px",
};

const tituloRubro = {
  fontSize: "20px",
  fontWeight: 400,
  margin: 0,
};

const dosTipos = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "24px",
};

const unTipo = {
  display: "grid",
  gridTemplateColumns: "1fr",
};

const bloqueTipo = {
  display: "grid",
  gap: "12px",
  alignContent: "start",
};

const cabeceraTipo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #eeeeee",
  paddingBottom: "8px",
};

const enlaceCotizar = {
  color: "#111111",
  fontSize: "13px",
  textDecoration: "underline",
};

const comparativa = {
  display: "grid",
  gap: "4px",
  border: "1px solid #eeeeee",
  padding: "12px",
};

const filaComp = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "14px",
  color: "#555555",
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

// La aprobada se distingue con borde negro: es la que manda.
const tarjetaAprobada = {
  ...tarjeta,
  border: "1px solid #111111",
  background: "#fafafa",
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
  border: "1px solid #111111",
  background: "#111111",
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
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "8px 12px",
  fontSize: "13px",
  cursor: "pointer",
};
