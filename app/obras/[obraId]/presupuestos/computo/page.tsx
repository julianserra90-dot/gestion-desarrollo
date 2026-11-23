import Link from "next/link";
import AppShell from "@/components/AppShell";
import CatalogoComputo, { type RubroCatalogo } from "@/components/CatalogoComputo";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import PlanillaComputo, { type RubroPlanilla } from "@/components/PlanillaComputo";
import PresupuestosNav from "@/components/PresupuestosNav";
import * as ui from "@/components/ui";
import { desvio, mesDeReferencia } from "@/lib/cac";
import {
  firmaDeDesglose,
  getComparacion,
  getComputo,
  getIndicesCac,
  getMaterialesParaListado,
  incidenciaPorRubro,
  listadoDeMateriales,
  loCargadoPorTarea,
  ordenDeRubro,
} from "@/lib/computo";
import { formatMoney } from "@/lib/format";
import { nombreMes } from "@/lib/meses";
import { getMaterialesCatalogo } from "@/lib/materiales";
import { getObraPorSlug } from "@/lib/obras";
import { tareasDesactualizadas } from "@/lib/pase-al-computo";
import { createClient } from "@/lib/supabase/server";
import {
  alternarTarea,
  crearComputo,
  crearTareaPropia,
  editarTareaDelComputo,
  guardarDesgloseDe,
  guardarMedicionDe,
  leerMedicionDe,
  guardarPlanilla,
  quitarItem,
} from "./actions";

/** Las pestañas del cómputo, en la URL para poder volver a la misma. */
const VISTAS = [
  { clave: "tabla", nombre: "Tabla de cómputo" },
  { clave: "materiales", nombre: "Listado de materiales" },
  { clave: "incidencia", nombre: "Incidencia de costos" },
  { clave: "comparacion", nombre: "Estimado vs. cotizado" },
] as const;

type Vista = (typeof VISTAS)[number]["clave"];

export default async function ComputoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{
    error?: string;
    guardado?: string;
    pesos?: string;
    vista?: string;
    abrir?: string;
  }>;
}) {
  const { obraId } = await params;
  const { error, guardado, pesos, vista: vistaPedida, abrir } = await searchParams;
  const vista: Vista = VISTAS.some((v) => v.clave === vistaPedida)
    ? (vistaPedida as Vista)
    : "tabla";
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const base = `/obras/${obra.slug}/presupuestos/computo`;
  const computo = await getComputo(obra.id);

  const encabezado = (
    <>
      <ObraHeader obra={obra} activeSection="presupuestos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Presupuestos</h2>
      </section>

      <PresupuestosNav slug={obra.slug} activa="computo" />

      {error && <p style={errorBox}>{error}</p>}
    </>
  );

  if (!computo) {
    return (
      <AppShell
        sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="presupuestos" />}
      >
        {encabezado}

        <section style={ui.panel}>
          <h3 style={ui.sectionTitle}>Esta obra todavía no tiene cómputo</h3>
          <p style={{ ...ui.note, marginTop: 0, marginBottom: "20px" }}>
            Se eligen las tareas rubro por rubro, se cargan las cantidades y
            sale el estimado de materiales y mano de obra, para comparar contra
            lo que se cotice.
          </p>

          <form action={crearComputo}>
            <input type="hidden" name="slug" value={obra.slug} />
            <input type="hidden" name="obra_id" value={obra.id} />
            <button type="submit" style={ui.button}>
              Nuevo cómputo
            </button>
          </form>
        </section>
      </AppShell>
    );
  }

  const ajustar = pesos !== "1";
  // "catálogo" en el nombre porque más abajo hay otro `materiales`: el listado
  // de lo que lleva la obra, que es la suma de los desgloses y no el catálogo.
  const catalogoMateriales = await getMaterialesCatalogo();
  const indices = await getIndicesCac();
  const referencia = mesDeReferencia(indices);
  const comparacion = await getComparacion(obra.id, computo, indices, ajustar);

  const elegidas = computo.items.map((i) => i.tareaId).filter(Boolean) as string[];

  const supabase = await createClient();
  const [{ data: rubros }, { data: tareas }, { data: modelo }] = await Promise.all([
    supabase.from("rubros").select("id, nombre").eq("obra_id", obra.id),
    supabase.from("tareas").select("id, rubro, subrubro, nombre, unidad, orden").order("orden"),
    // El desglose de modelo de las tareas elegidas: con él se sabe si el de la
    // obra ya se tocó, que es lo que el catálogo avisa antes de destildar.
    supabase
      .from("tarea_desglose")
      .select(
        "tarea_id, tipo, descripcion, unidad, cantidad, precio_unitario, consumo, consumo_unidad, material_id, orden"
      )
      .in("tarea_id", elegidas)
      .order("orden"),
  ]);
  const nombreDeRubro = new Map((rubros ?? []).map((r) => [r.id, r.nombre]));
  const porOrden = <T extends { nombre: string }>(a: T, b: T) =>
    ordenDeRubro(a.nombre) - ordenDeRubro(b.nombre) || a.nombre.localeCompare(b.nombre, "es");

  const renglonesDeModelo = new Map<string, Parameters<typeof firmaDeDesglose>[0]>();
  for (const m of modelo ?? []) {
    const lista = renglonesDeModelo.get(m.tarea_id) ?? [];
    lista.push({
      tipo: m.tipo,
      descripcion: m.descripcion,
      unidad: m.unidad,
      cantidad: Number(m.cantidad),
      precio: Number(m.precio_unitario),
      materialId: m.material_id,
      consumo: m.consumo === null ? null : Number(m.consumo),
      consumoUnidad: m.consumo_unidad,
    });
    renglonesDeModelo.set(m.tarea_id, lista);
  }
  // La composición de cada tarea en el catálogo, para que el desglose de la
  // obra avise si es distinto y la pueda traer.
  const delCatalogo = (tareaId: string | null, renglones: Parameters<typeof firmaDeDesglose>[0]) => {
    if (!tareaId) return null;
    const delModelo = renglonesDeModelo.get(tareaId) ?? [];
    // Sin composición en el catálogo no hay nada que traer.
    if (delModelo.length === 0) return null;
    if (firmaDeDesglose(delModelo) === firmaDeDesglose(renglones)) return null;
    return delModelo.map((m) => ({
      ...m,
      tipo: m.tipo as "Materiales" | "Mano de obra" | "Integrado",
      materialId: m.materialId ?? null,
      consumo: m.consumo ?? null,
      consumoUnidad: m.consumoUnidad ?? null,
      presupuestoId: null,
      usarCotizado: false,
      cotizacion: null,
    }));
  };

  // La planilla agrupada por rubro, en el orden de la obra.
  const porRubro = new Map<string, RubroPlanilla>();
  for (const i of computo.items) {
    let r = porRubro.get(i.rubroId);
    if (!r) {
      r = { rubroId: i.rubroId, rubro: nombreDeRubro.get(i.rubroId) ?? "—", filas: [] };
      porRubro.set(i.rubroId, r);
    }
    r.filas.push({
      id: i.id,
      tareaId: i.tareaId,
      subrubro: i.subrubro,
      nombre: i.nombre,
      unidad: i.unidad,
      cantidad: i.cantidad,
      precioMateriales: i.precioMateriales,
      precioManoObra: i.precioManoObra,
      precioIntegrado: i.precioIntegrado,
      renglones: i.renglones,
      elementosMedidos: i.elementosMedidos,
      elementosDelPlano: i.elementosDelPlano,
      delCatalogo: delCatalogo(i.tareaId, i.renglones),
    });
  }
  const planilla = [...porRubro.values()].sort(
    (a, b) => porOrden({ nombre: a.rubro }, { nombre: b.rubro })
  );

  // El catálogo, rubro por rubro, para la columna de la izquierda.
  const catalogoPorRubro = new Map<string, RubroCatalogo>();
  for (const t of tareas ?? []) {
    const clave = t.rubro.toLowerCase();
    const g = catalogoPorRubro.get(clave) ?? { nombre: t.rubro, tareas: [] };
    g.tareas.push({ id: t.id, subrubro: t.subrubro, nombre: t.nombre, unidad: t.unidad });
    catalogoPorRubro.set(clave, g);
  }
  const catalogo = [...catalogoPorRubro.values()].sort(porOrden);
  const rubrosParaPropias = [...(rubros ?? [])].sort(porOrden);

  const cargadas = loCargadoPorTarea(
    computo.items,
    new Map([...renglonesDeModelo].map(([id, rs]) => [id, firmaDeDesglose(rs)]))
  );

  const sumar = (campo: "estimado" | "cotizado" | "gastado") =>
    comparacion.filas.reduce((acc, f) => acc + f[campo], 0);
  const totalEstimado = sumar("estimado");
  const totalCotizado = sumar("cotizado");
  const totalGastado = sumar("gastado");

  // El desvío total sólo de los rubros que tienen las dos cosas: sumar el
  // estimado de un rubro todavía sin cotizar haría parecer que la obra viene
  // barata.
  const comparables = comparacion.filas.filter((f) => f.estimado > 0 && f.cotizado > 0);
  const desvioTotal = desvio(
    comparables.reduce((a, f) => a + f.cotizado, 0),
    comparables.reduce((a, f) => a + f.estimado, 0)
  );

  const leyendaAjuste = !ajustar
    ? "En pesos de cada fecha, sin ajustar."
    : referencia
      ? `A valores de ${nombreMes(referencia)} (último índice CAC cargado).`
      : "Sin índice CAC cargado: los montos van en pesos de cada fecha.";

  // Si el plano ya se pasó alguna vez, cuántas tareas quedaron distintas de lo
  // que el dibujo mide ahora. Sólo entonces se miden las plantas: una obra
  // que nunca pasó el plano no paga esa cuenta en cada carga.
  const conPlano = computo.items.some((i) => i.elementosDelPlano > 0);
  const desactualizadas =
    vista === "tabla" && conPlano ? await tareasDesactualizadas(obra.id) : 0;

  // Sólo se arma la del cuadro que se está mirando: cada una pide lo suyo.

  const materiales =
    vista === "materiales"
      ? listadoDeMateriales(computo.items, await getMaterialesParaListado())
      : [];
  const totalMateriales = materiales.reduce((a, m) => a + m.importe, 0);
  const incidencia =
    vista === "incidencia"
      ? incidenciaPorRubro(computo.items, (id) => nombreDeRubro.get(id) ?? "—")
      : [];
  const totalIncidencia = incidencia.reduce((a, r) => a + r.total, 0);

  const enlaceVista = (v: Vista) => (v === "tabla" ? base : `${base}?vista=${v}`);

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="presupuestos" />}
    >
      {encabezado}

      {guardado && (
        <p style={okBox} data-no-imprimir>
          Cómputo guardado.
        </p>
      )}

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Estimado</p>
          <h3 style={ui.statNumber}>{formatMoney(totalEstimado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Cotizado y aprobado</p>
          <h3 style={ui.statNumber}>{formatMoney(totalCotizado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Cotizado vs. estimado</p>
          <h3 style={{ ...ui.statNumber, ...colorDesvio(desvioTotal) }}>
            {textoDesvio(desvioTotal)}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Gastado</p>
          <h3 style={ui.statNumber}>{formatMoney(totalGastado)}</h3>
        </div>
      </section>

      <div style={barraVistas}>
        <nav style={vistas} data-no-imprimir>
          {VISTAS.map((v) => (
            <Link
              key={v.clave}
              href={enlaceVista(v.clave)}
              style={vista === v.clave ? vistaActiva : vistaItem}
            >
              {v.nombre}
            </Link>
          ))}
        </nav>

        <div style={acciones} data-no-imprimir>
          <a
            href={`${base}/excel${vista === "materiales" ? "?vista=materiales" : ""}`}
            style={ui.secondaryButton}
          >
            Excel
          </a>
          <Link href={`${base}/presupuesto`} style={ui.secondaryButton}>
            Presupuesto PDF
          </Link>
          <Link href={`${base}/cac`} style={ui.secondaryButton}>
            Índice CAC
          </Link>
        </div>
      </div>

      {desactualizadas > 0 && (
        <p style={avisoPlano} data-no-imprimir>
          El plano cambió: {desactualizadas === 1 ? "1 tarea distinta" : `${desactualizadas} tareas distintas`}.{" "}
          <Link href={`/obras/${obra.slug}/plantas`} style={enlaceAviso}>
            Pasar de nuevo ›
          </Link>
        </p>
      )}

      {vista === "tabla" && (
        <div style={editor}>
          <CatalogoComputo
            obraId={obra.id}
            rubros={catalogo}
            elegidas={elegidas}
            cargadas={cargadas}
            rubrosObra={rubrosParaPropias}
            alternar={alternarTarea}
            crearPropia={crearTareaPropia}
            configurar={Object.fromEntries(
              (rubros ?? []).map((r) => [
                r.nombre.toLowerCase(),
                `/obras/${obra.slug}/rubros/${r.id}`,
              ])
            )}
          />

          <div style={columnaPlanilla}>
            <PlanillaComputo
              slug={obra.slug}
              obraId={obra.id}
              mesPrecios={computo.mesPrecios}
              rubros={planilla}
              superficie={obra.sup_construccion_m2 ? Number(obra.sup_construccion_m2) : null}
              abrirInicial={abrir}
              materiales={catalogoMateriales}
              guardar={guardarPlanilla}
              editarTarea={editarTareaDelComputo}
              guardarDesglose={guardarDesgloseDe}
              leerMedicion={leerMedicionDe}
              guardarMedicion={guardarMedicionDe}
              quitarItem={quitarItem}
            />
          </div>
        </div>
      )}

      {vista === "materiales" && (
        <section style={ui.panel}>
          <h3 style={ui.sectionTitle}>Lo que lleva la obra</h3>
          <p style={{ ...ui.note, marginTop: 0 }}>
            La suma de los materiales de todos los desgloses, por lo computado
            de cada tarea. Lo que dice &ldquo;sin desglosar&rdquo; todavía tiene
            sólo la referencia de Cifras.
          </p>
          {materiales.length === 0 ? (
            <p style={ui.vacio}>
              Todavía no hay materiales: cargá cantidades y desglosá las tareas.
            </p>
          ) : (
            <div style={scroll}>
              <table style={{ ...ui.table, minWidth: "720px" }}>
                <thead>
                  <tr>
                    <th style={ui.th}>Material</th>
                    <th style={thCentro}>Unidad</th>
                    <th style={ui.thRight}>Cantidad</th>
                    <th style={ui.th}>A comprar</th>
                    <th style={ui.thRight}>Precio unit.</th>
                    <th style={ui.thRight}>Importe</th>
                    <th style={thCentro}>Tareas</th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((m) => (
                    <tr key={`${m.descripcion}|${m.unidad}`}>
                      <td style={ui.td}>{m.descripcion}</td>
                      <td style={tdCentro}>{m.unidad}</td>
                      <td style={ui.tdRight}>
                        {m.cantidad.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                      </td>
                      {/* Lo que se le pide al corralón: el material no se
                          vende en 5 kg sino en bolsas de 25. */}
                      <td style={m.comercial ? tdComercial : tdGris}>{m.comercial ?? "—"}</td>
                      <td style={tdGris}>
                        {m.cantidad > 0 ? formatMoney(m.importe / m.cantidad) : "—"}
                      </td>
                      <td style={tdFuerte}>{formatMoney(m.importe)}</td>
                      <td style={tdCentro}>{m.tareas}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={pie} colSpan={5}>
                      Total materiales
                    </td>
                    <td style={pieNumero}>{formatMoney(totalMateriales)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {vista === "incidencia" && (
        <section style={ui.panel}>
          <h3 style={ui.sectionTitle}>Cuánto pesa cada rubro</h3>
          {incidencia.length === 0 ? (
            <p style={ui.vacio}>Todavía no hay cantidades cargadas.</p>
          ) : (
            <div style={scroll}>
              <table style={{ ...ui.table, minWidth: "760px" }}>
                <thead>
                  <tr>
                    <th style={ui.th}>Rubro</th>
                    <th style={ui.thRight}>Materiales</th>
                    <th style={ui.thRight}>Mano de obra</th>
                    <th style={ui.thRight}>Integrado</th>
                    <th style={ui.thRight}>Total</th>
                    <th style={ui.th}>Incidencia</th>
                  </tr>
                </thead>
                <tbody>
                  {incidencia.map((r) => (
                    <tr key={r.rubro}>
                      <td style={ui.td}>{r.rubro}</td>
                      <td style={tdGris}>{monto(r.materiales)}</td>
                      <td style={tdGris}>{monto(r.manoObra)}</td>
                      <td style={tdGris}>{monto(r.integrado)}</td>
                      <td style={tdFuerte}>{formatMoney(r.total)}</td>
                      <td style={ui.td}>
                        <div style={barraIncidencia}>
                          <div style={fondoBarra}>
                            <div
                              style={{
                                ...rellenoBarra,
                                width: `${Math.max(r.porcentaje, 0.5)}%`,
                              }}
                            />
                          </div>
                          <span style={porcentaje}>
                            {r.porcentaje.toLocaleString("es-AR", {
                              maximumFractionDigits: 1,
                            })}{" "}
                            %
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={pie} colSpan={4}>
                      Total estimado
                    </td>
                    <td style={pieNumero}>{formatMoney(totalIncidencia)}</td>
                    <td style={pie}>100 %</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {vista === "comparacion" && (
        <>
          <p style={{ ...ui.note, marginTop: 0 }}>
            {leyendaAjuste}{" "}
            {ajustar && comparacion.sinAjustar > 0 && (
              <>
                {comparacion.sinAjustar === 1
                  ? "Un monto quedó sin ajustar"
                  : `${comparacion.sinAjustar} montos quedaron sin ajustar`}{" "}
                porque su mes es anterior al primer índice cargado.{" "}
              </>
            )}
            {referencia && (
              <Link
                href={ajustar ? `${base}?vista=comparacion&pesos=1` : `${base}?vista=comparacion`}
                style={enlace}
              >
                {ajustar ? "Ver en pesos de cada fecha" : "Ver ajustado por CAC"}
              </Link>
            )}
          </p>

          <section style={ui.panel}>
            {comparacion.filas.length === 0 ? (
              <p style={ui.vacio}>
                Todavía no hay cantidades cargadas ni cotizaciones aprobadas.
              </p>
            ) : (
              <div style={scroll}>
                <table style={tabla}>
                  <thead>
                    <tr>
                      <th style={ui.th}>Rubro</th>
                      <th style={ui.thRight}>Materiales</th>
                      <th style={ui.thRight}>Mano de obra</th>
                      <th style={ui.thRight}>Integrado</th>
                      <th style={ui.thRight}>Total estimado</th>
                      <th style={ui.thRight}>Cotizado</th>
                      <th style={ui.thRight}>Desvío</th>
                      <th style={ui.thRight}>Gastado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparacion.filas.map((f) => {
                      const d = f.cotizado > 0 ? desvio(f.cotizado, f.estimado) : null;
                      return (
                        <tr key={f.rubroId}>
                          <td style={ui.td}>{f.rubro}</td>
                          <td style={tdGris}>{monto(f.estimadoMateriales)}</td>
                          <td style={tdGris}>{monto(f.estimadoManoObra)}</td>
                          <td style={tdGris}>{monto(f.estimadoIntegrado)}</td>
                          <td style={tdFuerte}>{monto(f.estimado)}</td>
                          <td style={ui.tdRight}>{monto(f.cotizado)}</td>
                          <td style={{ ...ui.tdRight, ...colorDesvio(d) }}>
                            {textoDesvio(d)}
                          </td>
                          <td style={ui.tdRight}>{monto(f.gastado)}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={pie}>Total</td>
                      <td style={pieNumero}>
                        {formatMoney(sumaDe(comparacion.filas, "estimadoMateriales"))}
                      </td>
                      <td style={pieNumero}>
                        {formatMoney(sumaDe(comparacion.filas, "estimadoManoObra"))}
                      </td>
                      <td style={pieNumero}>
                        {formatMoney(sumaDe(comparacion.filas, "estimadoIntegrado"))}
                      </td>
                      <td style={pieNumero}>{formatMoney(totalEstimado)}</td>
                      <td style={pieNumero}>{formatMoney(totalCotizado)}</td>
                      <td style={{ ...pieNumero, ...colorDesvio(desvioTotal) }}>
                        {textoDesvio(desvioTotal)}
                      </td>
                      <td style={pieNumero}>{formatMoney(totalGastado)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ ...ui.note, marginBottom: 0 }}>
              El desvío compara lo cotizado contra lo estimado, sólo en rubros
              que tienen las dos cosas. En rojo, cotizado por encima del
              estimado.
            </p>
          </section>
        </>
      )}
    </AppShell>
  );
}

/** Un guion en vez de $ 0,00: cero se leería como "gratis", y es "no hay". */
function monto(valor: number) {
  return valor > 0 ? formatMoney(valor) : "—";
}

type CampoEstimado = "estimadoMateriales" | "estimadoManoObra" | "estimadoIntegrado";

function sumaDe(filas: Record<CampoEstimado, number>[], campo: CampoEstimado) {
  return filas.reduce((acc, f) => acc + f[campo], 0);
}

function textoDesvio(d: number | null) {
  if (d === null) return "—";
  const signo = d > 0 ? "+" : "";
  return `${signo}${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(d)} %`;
}

// Rojo si lo cotizado pasa al estimado, verde si queda por debajo: los dos
// colores con los que la app ya habla de plata en contra y a favor.
function colorDesvio(d: number | null) {
  if (d === null || Math.abs(d) < 0.05) return {};
  return { color: d > 0 ? ui.ROJO : ui.VERDE };
}

// El plano y el cómputo no dicen lo mismo: no es un error, es un pendiente.
const avisoPlano = {
  background: "#fff4d6",
  color: "#8a5a00",
  borderRadius: "12px",
  padding: "12px 16px",
  fontSize: "14px",
  margin: "0 0 20px",
};

const enlaceAviso = {
  color: "inherit",
  fontWeight: 600,
};

const tdComercial = {
  ...ui.td,
  fontSize: "13px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const okBox = {
  border: `1px solid ${ui.VERDE}`,
  color: ui.VERDE,
  padding: "12px 14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const acciones = {
  display: "flex",
  gap: "10px",
  marginBottom: "12px",
};

const enlace = {
  color: "#111111",
};

const scroll = {
  overflowX: "auto" as const,
};

const tabla = {
  ...ui.table,
  minWidth: "860px",
};

const tdGris = {
  ...ui.tdRight,
  color: "#888888",
  whiteSpace: "nowrap" as const,
};

const tdFuerte = {
  ...ui.tdRight,
  fontWeight: 600,
  whiteSpace: "nowrap" as const,
};

const pie = {
  padding: "16px 12px",
  fontWeight: 600,
  fontSize: "14px",
};

const pieNumero = {
  ...pie,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
};

// El catálogo arriba, como un acordeón más, y la planilla debajo.
const editor = {
  display: "block",
};

const columnaPlanilla = {
  minWidth: 0,
};

const barraVistas = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "16px",
  flexWrap: "wrap" as const,
  margin: "32px 0 24px",
  borderBottom: "1px solid #e5e5e5",
};

const vistas = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "22px",
};

const vistaItem = {
  color: "#777777",
  textDecoration: "none",
  fontSize: "14px",
  padding: "0 0 12px",
  borderBottom: "2px solid transparent",
  marginBottom: "-1px",
};

const vistaActiva = {
  ...vistaItem,
  color: "#111111",
  borderBottom: "2px solid #111111",
};

const thCentro = {
  ...ui.th,
  textAlign: "center" as const,
};

const tdCentro = {
  ...ui.td,
  textAlign: "center" as const,
  color: "#777777",
};

const barraIncidencia = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const fondoBarra = {
  ...ui.progressBackground,
  flex: 1,
  minWidth: "120px",
};

const rellenoBarra = {
  ...ui.progressFill,
};

const porcentaje = {
  fontSize: "13px",
  fontWeight: 600,
  whiteSpace: "nowrap" as const,
  minWidth: "52px",
  textAlign: "right" as const,
};

