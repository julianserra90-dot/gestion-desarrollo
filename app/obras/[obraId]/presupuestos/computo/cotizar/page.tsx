import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import PresupuestosNav from "@/components/PresupuestosNav";
import Volver from "@/components/Volver";
import * as ui from "@/components/ui";
import {
  getComputo,
  getMaterialesParaListado,
  listadoDeMateriales,
  ordenDeRubro,
} from "@/lib/computo";
import { formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { pedirCotizacion } from "../actions";

const cantidad = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

/**
 * El pedido de cotización que sale del cómputo.
 *
 * Se llega tildando tareas en la planilla. Acá se ve el desglose de todas
 * **sumado en una sola lista**: el cemento de la mampostería y el del revoque
 * son un renglón, con el total que hace falta. Eso es lo que se le manda al
 * corralón —una lista, no un pedido suelto por material— y lo que queda
 * guardado como items de la cotización, con la cantidad y sin precio.
 *
 * Lo que en el desglose es nada más que texto, sin material del catálogo, no
 * puede ir como item: va nombrado en las observaciones. Se dice acá, para que
 * nadie se entere después de que faltaba la mitad del pedido.
 */
export default async function CotizarDelComputoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ items?: string; error?: string }>;
}) {
  const { obraId } = await params;
  const { items: pedidas, error } = await searchParams;
  const obra = await getObraPorSlug(obraId);
  if (!obra) return <AppShell>Obra no encontrada</AppShell>;

  const base = `/obras/${obra.slug}/presupuestos/computo`;
  const ids = (pedidas ?? "").split(",").filter(Boolean);

  const encabezado = (
    <>
      <ObraHeader obra={obra} activeSection="presupuestos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Presupuestos</h2>
      </section>

      <PresupuestosNav slug={obra.slug} activa="computo" />

      <Volver href={base}>Cómputo</Volver>

      {error && <p style={cajaError}>{error}</p>}
    </>
  );

  const computo = await getComputo(obra.id);
  const elegidos = computo
    ? computo.items.filter((i) => ids.includes(i.id))
    : [];

  if (elegidos.length === 0) {
    return (
      <AppShell sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="presupuestos" />}>
        {encabezado}
        <section style={ui.panel}>
          <p style={ui.vacio}>
            No hay tareas para cotizar. Tildalas en la{" "}
            <Link href={base} style={enlace}>
              tabla de cómputo
            </Link>{" "}
            y volvé a pedir la cotización.
          </p>
        </section>
      </AppShell>
    );
  }

  const supabase = await createClient();
  const { data: rubrosDeLaObra } = await supabase
    .from("rubros")
    .select("id, nombre")
    .eq("obra_id", obra.id);
  const nombreDeRubro = new Map((rubrosDeLaObra ?? []).map((r) => [r.id, r.nombre]));

  const catalogo = await getMaterialesParaListado();
  const listado = listadoDeMateriales(elegidos, catalogo);
  const delCatalogo = listado.filter((m) => m.materialId !== null);
  const sueltos = listado.filter((m) => m.materialId === null);
  const total = listado.reduce((a, m) => a + m.importe, 0);

  // A qué rubro se anota. Los candidatos son los rubros de las tareas
  // elegidas, y viene propuesto el que más pesa: casi siempre se cotiza
  // dentro de un rubro, y cuando se cruzan dos el pedido es del grueso.
  const pesoPorRubro = new Map<string, number>();
  for (const i of elegidos) {
    const peso = i.cantidad * i.precioMateriales;
    pesoPorRubro.set(i.rubroId, (pesoPorRubro.get(i.rubroId) ?? 0) + peso);
  }
  const candidatos = [...pesoPorRubro]
    .map(([id, peso]) => ({ id, nombre: nombreDeRubro.get(id) ?? "Sin rubro", peso }))
    .sort((a, b) => b.peso - a.peso || a.nombre.localeCompare(b.nombre, "es"));

  const tareas = [...elegidos].sort(
    (a, b) =>
      ordenDeRubro(nombreDeRubro.get(a.rubroId) ?? "") -
        ordenDeRubro(nombreDeRubro.get(b.rubroId) ?? "") ||
      a.nombre.localeCompare(b.nombre, "es")
  );

  return (
    <AppShell sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="presupuestos" />}>
      {encabezado}

      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>
          {elegidos.length === 1
            ? "Pedir cotización de 1 tarea"
            : `Pedir cotización de ${elegidos.length} tareas`}
        </h3>
        <p style={{ ...ui.note, marginTop: 0 }}>
          Sale una sola cotización, con el desglose de todas las tareas sumado
          en una lista de materiales. Queda en Cotizaciones como pedido
          &ldquo;A cotizar&rdquo;, sin proveedor y sin precios: los carga el
          proveedor cuando conteste.
        </p>

        <ul style={listaTareas}>
          {tareas.map((i) => (
            <li key={i.id} style={tarea}>
              <span>{i.nombre}</span>
              <span style={tenue}>
                {cantidad(i.cantidad)} {i.unidad} ·{" "}
                {nombreDeRubro.get(i.rubroId) ?? "Sin rubro"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Lo que se pide</h3>

        {delCatalogo.length === 0 ? (
          <p style={ui.vacio}>
            Ninguno de estos materiales está en el catálogo, así que no hay
            items que guardar. Se puede pedir igual: van nombrados en las
            observaciones.
          </p>
        ) : (
          <table style={tabla}>
            <thead>
              <tr>
                <th style={ui.th}>Material</th>
                <th style={ui.thRight}>Cantidad</th>
                <th style={ui.thRight}>Computado</th>
                <th style={ui.th}>Hay que comprar</th>
              </tr>
            </thead>
            <tbody>
              {delCatalogo.map((m) => (
                <tr key={m.materialId}>
                  <td style={ui.td}>
                    {m.descripcion}
                    {m.tareas > 1 && (
                      <span style={tenue}> · de {m.tareas} tareas</span>
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    {cantidad(m.cantidad)} {m.unidad}
                  </td>
                  <td style={ui.tdRight}>{formatMoney(m.importe)}</td>
                  <td style={ui.td}>{m.comercial ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sueltos.length > 0 && (
          <div style={aviso}>
            <strong style={{ display: "block", marginBottom: "6px" }}>
              {sueltos.length === 1
                ? "1 renglón sin material del catálogo"
                : `${sueltos.length} renglones sin material del catálogo`}
            </strong>
            <p style={{ ...ui.note, margin: "0 0 8px" }}>
              No se pueden guardar como items —el item se guarda por material—,
              así que van escritos en las observaciones de la cotización. Para
              que entren en la lista, enlazalos a un material en el desglose de
              su tarea.
            </p>
            <ul style={listaSueltos}>
              {sueltos.map((m) => (
                <li key={`${m.descripcion}|${m.unidad}`}>
                  {m.descripcion} — {cantidad(m.cantidad)} {m.unidad}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p style={totalLinea}>
          Computado para estas tareas <strong>{formatMoney(total)}</strong>
        </p>
      </section>

      <form action={pedirCotizacion} style={ui.panel}>
        <input type="hidden" name="slug" value={obra.slug} />
        <input type="hidden" name="obra_id" value={obra.id} />
        {elegidos.map((i) => (
          <input key={i.id} type="hidden" name="item" value={i.id} />
        ))}

        <h3 style={ui.sectionTitle}>A qué rubro se anota</h3>
        <p style={{ ...ui.note, marginTop: 0 }}>
          La cotización vive en un rubro, que es donde después se compara
          contra lo computado. Si el pedido cruza rubros, elegí el que manda.
        </p>

        <div style={pie}>
          <label style={campo}>
            <span style={ui.label}>Rubro</span>
            <select
              name="rubro_id"
              defaultValue={candidatos[0]?.id}
              style={{ ...ui.input, width: "280px" }}
            >
              {candidatos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" style={ui.button}>
            Pedir la cotización
          </button>
        </div>
      </form>
    </AppShell>
  );
}

const enlace = { color: "#111", textDecoration: "underline" } as const;

const tenue = { color: "#6b7280", fontSize: "13px" } as const;

const cajaError = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: "12px 16px",
  borderRadius: "12px",
  marginBottom: "16px",
  fontSize: "14px",
} as const;

const listaTareas = {
  listStyle: "none",
  margin: "16px 0 0",
  padding: 0,
  display: "grid",
  gap: "8px",
} as const;

const tarea = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "16px",
  padding: "8px 12px",
  background: "#f9fafb",
  borderRadius: "10px",
  fontSize: "14px",
} as const;

const tabla = {
  ...ui.table,
  marginTop: "16px",
} as const;

const aviso = {
  marginTop: "20px",
  padding: "14px 16px",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: "12px",
  fontSize: "14px",
} as const;

const listaSueltos = {
  margin: 0,
  paddingLeft: "18px",
  color: "#6b7280",
  fontSize: "13px",
} as const;

const totalLinea = {
  marginTop: "20px",
  marginBottom: 0,
  textAlign: "right",
  fontSize: "15px",
} as const;

const pie = {
  display: "flex",
  alignItems: "flex-end",
  gap: "16px",
  flexWrap: "wrap",
  marginTop: "16px",
} as const;

const campo = { display: "grid", gap: "6px" } as const;
