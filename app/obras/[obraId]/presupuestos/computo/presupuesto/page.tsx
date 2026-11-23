import Link from "next/link";
import BotonImprimir from "@/components/BotonImprimir";
import Logo from "@/components/Logo";
import { getComputo, ordenDeRubro, type ItemComputo } from "@/lib/computo";
import { formatMoney } from "@/lib/format";
import { nombreMes } from "@/lib/meses";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

/**
 * El cómputo como un presupuesto, para guardar en PDF o imprimir.
 *
 * Ordenado como se presenta uno: cada rubro con su número y su título
 * —"3. Aislaciones"—, sus tareas itemizadas debajo —3.1, 3.2— con la unidad,
 * la cantidad, lo que va de materiales y de mano de obra (M.O.) por unidad y
 * el importe, y el subtotal del rubro. Arriba, el logo. Al final, el resumen
 * por rubro con lo que pesa cada uno, y el total.
 *
 * Van sólo las tareas con cantidad: una tarea tildada en cero no es parte de
 * lo que se presupuesta. Los precios son los del cómputo, del mes que dice.
 *
 * Es una página aparte y sin la barra de la app: lo que se ve es lo que sale
 * en el papel. El botón usa el diálogo de impresión del navegador, que es el
 * que guarda el PDF.
 */
export default async function PresupuestoDelComputoPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);
  if (!obra) return <p style={{ padding: "24px" }}>Obra no encontrada</p>;

  const computo = await getComputo(obra.id);
  if (!computo) return <p style={{ padding: "24px" }}>La obra no tiene cómputo.</p>;

  const supabase = await createClient();
  const { data: rubrosDeLaObra } = await supabase.from("rubros").select("id, nombre").eq("obra_id", obra.id);
  const nombreDeRubro = new Map((rubrosDeLaObra ?? []).map((r) => [r.id, r.nombre]));

  // Los rubros en el orden de la obra, cada uno con sus tareas con cantidad.
  const porRubro = new Map<string, ItemComputo[]>();
  for (const item of computo.items) {
    if (!(item.cantidad > 0)) continue;
    const lista = porRubro.get(item.rubroId) ?? [];
    lista.push(item);
    porRubro.set(item.rubroId, lista);
  }
  const rubros = Array.from(porRubro, ([id, items]) => {
    const nombre = nombreDeRubro.get(id) ?? "Sin rubro";
    const total = items.reduce((s, i) => s + importeDe(i), 0);
    return { id, nombre, items, total };
  }).sort((a, b) => ordenDeRubro(a.nombre) - ordenDeRubro(b.nombre) || a.nombre.localeCompare(b.nombre, "es"));
  const total = rubros.reduce((s, r) => s + r.total, 0);
  const conIntegrado = computo.items.some((i) => i.cantidad > 0 && i.tipos.int);

  const hoy = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date()
  );

  return (
    <main style={hoja}>
      <style>{IMPRESION}</style>

      <div style={barra} data-no-imprimir>
        <Link href={`/obras/${obra.slug}/presupuestos/computo`} style={volver}>
          ← Cómputo
        </Link>
        <BotonImprimir />
      </div>

      <header style={encabezado}>
        <div>
          <p style={sobretitulo}>Presupuesto</p>
          <h1 style={titulo}>{obra.nombre}</h1>
          <p style={datos}>
            {hoy} · Precios de {nombreMes(computo.mesPrecios)}
          </p>
        </div>
        <Logo ancho="110px" />
      </header>

      {rubros.map((rubro, r) => (
        <section key={rubro.id} style={seccion} className="rubro">
          <h2 style={tituloDeRubro} className="titulo-de-rubro">
            <span style={numero}>{r + 1}.</span> {rubro.nombre}
          </h2>
          <table style={tabla}>
            <colgroup>
              <col style={{ width: ANCHO.item }} />
              <col />
              <col style={{ width: ANCHO.unidad }} />
              <col style={{ width: ANCHO.numero }} />
              <col style={{ width: ANCHO.numero }} />
              <col style={{ width: ANCHO.numero }} />
              {conIntegrado && <col style={{ width: ANCHO.numero }} />}
              <col style={{ width: ANCHO.numero }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th}>Ítem</th>
                <th style={thTexto}>Descripción</th>
                <th style={th}>Unidad</th>
                <th style={thNum}>Cantidad</th>
                <th style={thNum}>Materiales</th>
                <th style={thNum}>M.O.</th>
                {conIntegrado && <th style={thNum}>Integrado</th>}
                <th style={thNum}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {rubro.items.map((item, i) => (
                <tr key={item.id} className="renglon">
                  <td style={tdCentro}>
                    {r + 1}.{i + 1}
                  </td>
                  <td style={td}>{item.nombre}</td>
                  <td style={tdCentro}>{item.unidad}</td>
                  <td style={tdNum}>{formatCantidad(item.cantidad)}</td>
                  <td style={tdNum}>{item.tipos.mat ? formatMoney(item.precioMateriales) : "—"}</td>
                  <td style={tdNum}>{item.tipos.mo ? formatMoney(item.precioManoObra) : "—"}</td>
                  {conIntegrado && (
                    <td style={tdNum}>{item.tipos.int ? formatMoney(item.precioIntegrado) : "—"}</td>
                  )}
                  <td style={{ ...tdNum, fontWeight: 600 }}>{formatMoney(importeDe(item))}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={conIntegrado ? 7 : 6} style={subtotal}>
                  Subtotal {rubro.nombre}
                </td>
                <td style={{ ...subtotal, textAlign: "right" }}>{formatMoney(rubro.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      <section style={seccion} className="rubro">
        <h2 style={tituloDeRubro}>Resumen</h2>
        {/* Con las mismas columnas que los rubros: el importe cae justo debajo
            del de cada rubro, y la incidencia en la columna de al lado. */}
        <table style={tabla}>
          <colgroup>
            <col style={{ width: ANCHO.item }} />
            <col />
            <col style={{ width: ANCHO.numero }} />
            <col style={{ width: ANCHO.numero }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th}>Ítem</th>
              <th style={thTexto}>Rubro</th>
              <th style={thNum}>Incidencia</th>
              <th style={thNum}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {rubros.map((rubro, r) => (
              <tr key={rubro.id} className="renglon">
                <td style={tdCentro}>{r + 1}</td>
                <td style={td}>{rubro.nombre}</td>
                <td style={tdNum}>{total > 0 ? `${formatCantidad((rubro.total / total) * 100)} %` : "—"}</td>
                <td style={tdNum}>{formatMoney(rubro.total)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={totalGeneral}>
                Total
              </td>
              <td style={{ ...totalGeneral, textAlign: "right" }}>{formatMoney(total)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}

/** Lo que cuesta una unidad de la tarea: lo que lleva de cada tipo. */
function unitarioDe(item: ItemComputo) {
  return (
    (item.tipos.mat ? item.precioMateriales : 0) +
    (item.tipos.mo ? item.precioManoObra : 0) +
    (item.tipos.int ? item.precioIntegrado : 0)
  );
}

function importeDe(item: ItemComputo) {
  return item.cantidad * unitarioDe(item);
}

function formatCantidad(n: number) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/**
 * En papel: A4 con márgenes de imprenta, cada renglón entero en su hoja, el
 * título del rubro pegado a su tabla y los encabezados de la tabla repetidos
 * si sigue en la hoja siguiente.
 */
const IMPRESION = `
@page { size: A4; margin: 14mm 12mm; }
@media print {
  body { background: #ffffff !important; }
  .renglon { break-inside: avoid; }
  .titulo-de-rubro { break-after: avoid; }
  thead { display: table-header-group; }
}
`;

const hoja = {
  maxWidth: "960px",
  margin: "0 auto",
  padding: "28px 24px 48px",
  background: "#ffffff",
  color: "#111111",
  fontSize: "12px",
};

const barra = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
};

const volver = { color: "#555555", fontSize: "14px", textDecoration: "none" };

const encabezado = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "16px",
  borderBottom: "2px solid #111111",
  paddingBottom: "12px",
  marginBottom: "20px",
};

const sobretitulo = {
  fontSize: "11px",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "#777777",
  margin: 0,
};

const titulo = { fontSize: "24px", fontWeight: 700, margin: "4px 0 2px" };

const datos = { fontSize: "13px", color: "#555555", margin: 0 };

const seccion = { marginBottom: "22px" };

const tituloDeRubro = {
  fontSize: "15px",
  fontWeight: 700,
  margin: "0 0 6px",
  paddingBottom: "4px",
  borderBottom: "1px solid #dddddd",
};

const numero = { color: "#777777", marginRight: "4px" };

/**
 * Los anchos de las columnas, los mismos en todas las tablas de la hoja: los
 * números quedan uno debajo del otro de un rubro al siguiente y en el resumen,
 * todos con la misma separación.
 */
const ANCHO = { item: "7%", unidad: "8%", numero: "13%" };

const tabla = { width: "100%", borderCollapse: "collapse" as const, tableLayout: "fixed" as const };

// Todas las celdas con el mismo relleno, así el borde de un número queda en
// la misma vertical que el de su título.
const RELLENO = "7px 8px";

const th = {
  fontSize: "10px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  color: "#666666",
  padding: RELLENO,
  borderBottom: "1px solid #cccccc",
  textAlign: "center" as const,
  whiteSpace: "nowrap" as const,
};

const thTexto = { ...th, textAlign: "left" as const };

const thNum = { ...th, textAlign: "right" as const };

const td = { padding: RELLENO, borderBottom: "1px solid #eeeeee", verticalAlign: "top" as const };

const tdCentro = { ...td, textAlign: "center" as const, color: "#555555" };

const tdNum = { ...td, textAlign: "right" as const, whiteSpace: "nowrap" as const };

const subtotal = {
  padding: RELLENO,
  fontWeight: 700,
  borderTop: "1px solid #999999",
  background: "#f6f6f6",
};

const totalGeneral = {
  padding: "9px 8px",
  fontWeight: 700,
  fontSize: "14px",
  borderTop: "2px solid #111111",
};
