import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import PresupuestosNav from "@/components/PresupuestosNav";
import * as ui from "@/components/ui";
import { ordenDeRubro } from "@/lib/computo";
import { formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

/**
 * Lo que se le pagó a cada gremio y lo que le resta, rubro por rubro.
 *
 * Dos solapas porque se miran por separado: la mano de obra se sigue por
 * contratista (y su "mano de obra y materiales" es el mismo gremio), los
 * materiales por proveedor. "Aprobado" suma las cotizaciones aprobadas;
 * "Pagado", los gastos no anulados. Un gasto a alguien sin cotización
 * aprobada igual aparece: lo pagado tiene que verse aunque no haya contra qué
 * compararlo.
 */
const SOLAPAS = [
  {
    clave: "mano-de-obra",
    nombre: "Mano de obra",
    tipos: ["Mano de obra", "Mano de obra y materiales"],
    quien: "Gremio",
  },
  {
    clave: "materiales",
    nombre: "Materiales",
    tipos: ["Materiales"],
    quien: "Proveedor",
  },
] as const;

type Fila = {
  rubroId: string | null;
  rubro: string;
  proveedor: string;
  aprobado: number;
  pagado: number;
};

export default async function GremiosPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { obraId } = await params;
  const { tipo } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const solapa = SOLAPAS.find((s) => s.clave === tipo) ?? SOLAPAS[0];
  const tipos = [...solapa.tipos];

  const supabase = await createClient();

  const [{ data: aprobadas }, { data: gastos }, { data: rubros }] = await Promise.all([
    supabase
      .from("presupuestos")
      .select("rubro_id, proveedor_id, monto, proveedores(nombre)")
      .eq("obra_id", obra.id)
      .eq("estado", "Aprobado")
      .in("tipo", tipos),
    supabase
      .from("gastos")
      .select("rubro_id, proveedor_id, monto, proveedores(nombre)")
      .eq("obra_id", obra.id)
      .neq("estado", "Anulado")
      .in("tipo_gasto", tipos),
    supabase.from("rubros").select("id, nombre").eq("obra_id", obra.id),
  ]);

  const nombreRubro = new Map((rubros ?? []).map((r) => [r.id, r.nombre]));

  const filas = new Map<string, Fila>();
  const fila = (
    rubroId: string | null,
    proveedorId: string | null,
    proveedor: string | null | undefined
  ) => {
    const clave = `${rubroId ?? "-"}|${proveedorId ?? "-"}`;
    let f = filas.get(clave);
    if (!f) {
      f = {
        rubroId,
        rubro: rubroId ? (nombreRubro.get(rubroId) ?? "—") : "Sin rubro",
        proveedor: proveedor ?? "Sin proveedor",
        aprobado: 0,
        pagado: 0,
      };
      filas.set(clave, f);
    }
    return f;
  };

  for (const p of aprobadas ?? []) {
    fila(p.rubro_id, p.proveedor_id, p.proveedores?.nombre).aprobado += Number(p.monto);
  }
  for (const g of gastos ?? []) {
    fila(g.rubro_id, g.proveedor_id, g.proveedores?.nombre).pagado += Number(g.monto);
  }

  const lista = [...filas.values()].sort(
    (a, b) =>
      ordenDeRubro(a.rubro) - ordenDeRubro(b.rubro) ||
      a.rubro.localeCompare(b.rubro, "es") ||
      a.proveedor.localeCompare(b.proveedor, "es")
  );

  const total = lista.reduce(
    (acc, f) => ({ aprobado: acc.aprobado + f.aprobado, pagado: acc.pagado + f.pagado }),
    { aprobado: 0, pagado: 0 }
  );
  // Lo que resta se cuenta sólo donde hay algo aprobado: pagarle a alguien
  // sin cotización no descuenta de lo que se le debe a otro.
  const resta = lista
    .filter((f) => f.aprobado > 0)
    .reduce((acc, f) => acc + (f.aprobado - f.pagado), 0);

  const base = `/obras/${obra.slug}/presupuestos/gremios`;

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="presupuestos" />}
    >
      <ObraHeader obra={obra} activeSection="presupuestos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Presupuestos</h2>
      </section>

      <PresupuestosNav slug={obra.slug} activa="gremios" />

      <nav style={barraSolapas}>
        {SOLAPAS.map((s) => (
          <Link
            key={s.clave}
            href={`${base}?tipo=${s.clave}`}
            style={s.clave === solapa.clave ? solapaActiva : solapaItem}
          >
            {s.nombre}
          </Link>
        ))}
      </nav>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Aprobado</p>
          <p style={ui.statNumber}>{formatMoney(total.aprobado)}</p>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Pagado</p>
          <p style={ui.statNumber}>{formatMoney(total.pagado)}</p>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Resta pagar</p>
          <p style={{ ...ui.statNumber, color: resta > 0 ? ROJO : "#111111" }}>
            {formatMoney(resta)}
          </p>
        </div>
      </section>

      {lista.length === 0 ? (
        <p style={{ ...ui.note, marginTop: "24px" }}>
          Todavía no hay cotizaciones aprobadas ni pagos de{" "}
          {solapa.nombre.toLowerCase()} en esta obra.
        </p>
      ) : (
        <div style={{ ...ui.panel, overflowX: "auto", marginTop: "24px" }}>
          <table style={{ ...ui.table, minWidth: "600px" }}>
            <thead>
              <tr>
                <th style={ui.th}>Rubro</th>
                <th style={ui.th}>{solapa.quien}</th>
                <th style={ui.thRight}>Aprobado</th>
                <th style={ui.thRight}>Pagado</th>
                <th style={ui.thRight}>Resta</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((f, i) => {
                // El nombre del rubro sólo en su primera fila: se lee como
                // grupo sin repetirlo en cada gremio.
                const primeraDelRubro = f.rubro !== lista[i - 1]?.rubro;
                const restaFila = f.aprobado - f.pagado;
                return (
                  <tr key={`${f.rubroId}-${f.proveedor}-${i}`}>
                    <td style={primeraDelRubro ? celdaRubro : celdaRubroVacia}>
                      {primeraDelRubro ? f.rubro : ""}
                    </td>
                    <td style={celda}>{f.proveedor}</td>
                    <td style={celdaNumero}>
                      {f.aprobado > 0 ? formatMoney(f.aprobado) : <span style={guion}>—</span>}
                    </td>
                    <td style={celdaNumero}>{formatMoney(f.pagado)}</td>
                    <td
                      style={{
                        ...celdaNumero,
                        fontWeight: 600,
                        color: f.aprobado > 0 && restaFila > 0 ? ROJO : "#111111",
                      }}
                    >
                      {f.aprobado > 0 ? formatMoney(restaFila) : <span style={guion}>—</span>}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td style={celdaPie} colSpan={2}>
                  Total {solapa.nombre.toLowerCase()}
                </td>
                <td style={celdaPieNumero}>{formatMoney(total.aprobado)}</td>
                <td style={celdaPieNumero}>{formatMoney(total.pagado)}</td>
                <td style={celdaPieNumero}>{formatMoney(resta)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

const ROJO = "#b91c1c";

const barraSolapas = {
  display: "flex",
  gap: "24px",
  margin: "0 0 24px",
  borderBottom: "1px solid #e5e5e5",
};

const solapaItem = {
  color: "#777777",
  textDecoration: "none",
  fontSize: "14px",
  padding: "0 0 12px",
  borderBottom: "2px solid transparent",
  marginBottom: "-1px",
};

const solapaActiva = {
  ...solapaItem,
  color: "#111111",
  borderBottom: "2px solid #111111",
};

const celda = {
  ...ui.td,
  padding: "12px",
};

const celdaRubro = {
  ...celda,
  fontWeight: 600,
  color: "#111111",
  borderTop: "1px solid #e5e5e5",
};

const celdaRubroVacia = {
  ...celda,
};

const celdaNumero = {
  ...celda,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
};

const guion = {
  color: "#aaaaaa",
};

const celdaPie = {
  ...celda,
  fontWeight: 600,
  color: "#111111",
  borderBottom: "none",
  borderTop: "2px solid #111111",
};

const celdaPieNumero = {
  ...celdaPie,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
};
