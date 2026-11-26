import Link from "next/link";
import AppShell from "@/components/AppShell";
import BuscadorAgenda from "@/components/BuscadorAgenda";
import FilaProveedor, { AltaProveedor } from "@/components/FilaProveedor";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { ordenDeRubro } from "@/lib/computo";
import { formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { getCatalogoDesdeObra, type ProveedorDeCatalogo } from "@/lib/proveedores";
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

/**
 * La agenda: quién es quién en la obra, por rubro, con su teléfono, editable
 * en el lugar. Se filtra igual que las solapas de plata —mano de obra por un
 * lado, proveedores de materiales por el otro—, pero lo que se mira son las
 * personas, no los montos.
 */
const FILTROS_AGENDA = [
  { clave: "mano-de-obra", nombre: "Mano de obra", tipo: "Contratista" },
  { clave: "materiales", nombre: "Proveedores de materiales", tipo: "Proveedor" },
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
  searchParams: Promise<{
    tipo?: string;
    de?: string;
    error?: string;
    ok?: string;
  }>;
}) {
  const { obraId } = await params;
  const { tipo, de, error, ok } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  if (tipo === "agenda") {
    return <Agenda obra={obra} de={de} error={error} ok={ok} />;
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

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="gremios" />}
    >
      <Encabezado obra={obra} activa={solapa.clave} />

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

/** El título y las solapas, iguales en las de plata y en la agenda. */
function Encabezado({
  obra,
  activa,
}: {
  obra: Obra;
  activa: string;
}) {
  const base = `/obras/${obra.slug}/presupuestos/gremios`;
  const solapas = [
    ...SOLAPAS.map((s) => ({ clave: s.clave, nombre: s.nombre })),
    { clave: "agenda", nombre: "Agenda" },
  ];

  return (
    <>
      <ObraHeader obra={obra} activeSection="gremios" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Gremios</h2>
      </section>

      <nav style={barraSolapas}>
        {solapas.map((s) => (
          <Link
            key={s.clave}
            href={`${base}?tipo=${s.clave}`}
            style={s.clave === activa ? solapaActiva : solapaItem}
          >
            {s.nombre}
          </Link>
        ))}
      </nav>
    </>
  );
}

/**
 * La agenda de la obra: cada gremio o proveedor con su rubro y su teléfono,
 * agrupados por rubro y editables en el lugar. Muestra los que la obra tiene
 * marcados, los mismos que ofrecen los desplegables de gastos y cotizaciones.
 * Los que no tienen rubro van al final, para que se note que falta ponérselo.
 */
async function Agenda({
  obra,
  de,
  error,
  ok,
}: {
  obra: Obra;
  de?: string;
  error?: string;
  ok?: string;
}) {
  const filtro = FILTROS_AGENDA.find((f) => f.clave === de) ?? FILTROS_AGENDA[0];
  const { catalogo, rubros, deLaObra, uso, esAdmin } = await getCatalogoDesdeObra(
    obra.id
  );

  const base = `/obras/${obra.slug}/presupuestos/gremios?tipo=agenda`;
  const volver = `${base}&de=${filtro.clave}`;

  const nombreRubro = new Map(rubros.map((r) => [r.id, r.nombre]));
  const porRubro = new Map<string, ProveedorDeCatalogo[]>();
  for (const p of catalogo) {
    if (p.tipo !== filtro.tipo || !deLaObra.has(p.id)) continue;
    const rubro = (p.rubro_id && nombreRubro.get(p.rubro_id)) || SIN_RUBRO;
    porRubro.set(rubro, [...(porRubro.get(rubro) ?? []), p]);
  }
  const grupos = [...porRubro.entries()].sort(([a], [b]) => {
    if (a === SIN_RUBRO) return 1;
    if (b === SIN_RUBRO) return -1;
    return ordenDeRubro(a) - ordenDeRubro(b) || a.localeCompare(b, "es");
  });
  const cuantos = grupos.reduce((n, [, lista]) => n + lista.length, 0);

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="gremios" />}
    >
      <Encabezado obra={obra} activa="agenda" />

      <nav style={filtros}>
        {FILTROS_AGENDA.map((f) => (
          <Link
            key={f.clave}
            href={`${base}&de=${f.clave}`}
            style={f.clave === filtro.clave ? filtroActivo : filtroItem}
          >
            {f.nombre}
          </Link>
        ))}
      </nav>

      {error && <p style={avisoError}>{error}</p>}
      {ok && <p style={avisoOk}>Listo, se guardó.</p>}

      {!esAdmin && (
        <p style={avisoGris}>
          Podés agregar y sacar de esta obra, pero modificar y eliminar es cosa
          del administrador: el nombre y el teléfono son los mismos en todas las
          obras.
        </p>
      )}

      <details style={{ ...ui.panel, marginBottom: "16px" }}>
        <summary style={{ cursor: "pointer" }}>
          Agregar a la agenda{" "}
          <span style={ui.note}>
            · {cuantos} {filtro.tipo === "Contratista" ? "de mano de obra" : "proveedores de materiales"} en esta obra
          </span>
        </summary>
        <div style={{ marginTop: "20px" }}>
          <AltaProveedor obra={obra} rubros={rubros} volver={volver} tipo={filtro.tipo} />
        </div>
      </details>

      {grupos.length === 0 ? (
        <p style={ui.note}>
          Esta obra todavía no tiene ninguno. Agregalo arriba, o sumá uno de
          otra obra desde{" "}
          <Link href={`/obras/${obra.slug}/presupuestos/contratistas`} style={{ color: "#111111" }}>
            Contratistas y proveedores
          </Link>
          .
        </p>
      ) : (
        // Un acordeón por rubro, todos plegados: la agenda se recorre por
        // rubro y se abre el que se busca. El buscador abre solos los que
        // tienen coincidencias.
        <BuscadorAgenda>
          {grupos.map(([rubro, lista]) => (
            <details key={rubro} data-rubro={rubro} style={acordeonRubro}>
              <summary style={{ cursor: "pointer" }}>
                <span style={rubro === SIN_RUBRO ? tituloSinRubro : tituloRubro}>
                  {rubro}
                </span>{" "}
                <span style={ui.note}>· {lista.length}</span>
              </summary>
              <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
                {lista.map((p) => (
                  <FilaProveedor
                    key={p.id}
                    proveedor={p}
                    obra={obra}
                    rubros={rubros}
                    uso={uso.get(p.id)}
                    esAdmin={esAdmin}
                    volver={volver}
                    busca={`${p.nombre} ${p.telefono ?? ""}`}
                  />
                ))}
              </div>
            </details>
          ))}
        </BuscadorAgenda>
      )}
    </AppShell>
  );
}

type Obra = NonNullable<Awaited<ReturnType<typeof getObraPorSlug>>>;

const SIN_RUBRO = "Sin rubro asignado";

const ROJO = "#b91c1c";

const filtros = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px",
  marginBottom: "20px",
};

const filtroItem = {
  fontSize: "13px",
  color: "#555555",
  textDecoration: "none",
  padding: "6px 14px",
  // Borde en propiedades sueltas y no `border`: el activo cambia sólo el
  // color, y mezclar la abreviada con `borderColor` hace que React avise al
  // pasar de un filtro al otro.
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#dcdcdc",
  borderRadius: "999px",
};

const filtroActivo = {
  ...filtroItem,
  color: "#ffffff",
  background: "#111111",
  borderColor: "#111111",
};

const avisoError = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const avisoOk = {
  ...avisoError,
  borderColor: "#dcdcdc",
  color: "#555555",
};

const avisoGris = {
  ...avisoError,
  borderColor: "#dcdcdc",
  color: "#777777",
};

const acordeonRubro = {
  ...ui.panel,
  marginBottom: "12px",
};

const tituloRubro = {
  fontSize: "16px",
  fontWeight: 600,
};

const tituloSinRubro = {
  ...tituloRubro,
  color: "#999999",
};

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
