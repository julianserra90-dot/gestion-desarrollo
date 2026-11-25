import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonConfirmar from "@/components/BotonConfirmar";
import CargarAvanceForm from "@/components/CargarAvanceForm";
import CargarAvancePorTarea from "@/components/CargarAvancePorTarea";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getTareasConAvance } from "@/lib/avance-del-rubro";
import { getCargasDeRubro } from "@/lib/avances";
import { estadoDe } from "@/lib/estado-avance";
import { formatDate } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { borrarAvanceDeTarea, cargarAvance, cargarAvancePorTarea } from "../actions";

export default async function AvanceDeRubroPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; rubroId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, rubroId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const { data: rubro } = await supabase
    .from("rubros")
    .select("id, nombre")
    .eq("id", rubroId)
    .eq("obra_id", obra.id)
    .maybeSingle();

  if (!rubro) {
    return <AppShell>Rubro no encontrado</AppShell>;
  }

  const [cargas, tareas] = await Promise.all([
    getCargasDeRubro(obra.id, rubro.id),
    getTareasConAvance(supabase, obra.id, rubro.id),
  ]);
  // El historial: una sola lista con todo lo que se cargó —a mano por tarea,
  // marcado en el 3D (por día, tarea y piso) y los porcentajes de antes—.
  const nombreDe = new Map(tareas.map((t) => [t.tareaId, t]));
  const idsDeTareas = tareas.map((t) => t.tareaId);
  const [{ data: aMano }, { data: enEl3d }] =
    idsDeTareas.length > 0
      ? await Promise.all([
          supabase
            .from("avances_de_tarea")
            .select("id, tarea_id, cantidad, fecha, fecha_inicio, comentario, piso, creado_por")
            .eq("obra_id", obra.id)
            .in("tarea_id", idsDeTareas),
          supabase
            .from("avances_del_plano")
            .select("tarea_id, cantidad, fecha, fecha_inicio, piso, creado_por")
            .eq("obra_id", obra.id)
            .in("tarea_id", idsDeTareas),
        ])
      : [{ data: [] }, { data: [] }];
  const quienes = Array.from(
    new Set([...(aMano ?? []), ...(enEl3d ?? [])].map((c) => c.creado_por).filter((id): id is string => !!id))
  );
  const { data: perfiles } =
    quienes.length > 0 ? await supabase.from("perfiles").select("id, nombre").in("id", quienes) : { data: [] };
  const nombreDePersona = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));
  const nivelDe = (tareaId: string, piso: number | null) =>
    piso === null ? "—" : nombreDe.get(tareaId)?.pisos.find((p) => p.piso === piso)?.nivel ?? `Piso ${piso}`;
  const cantidadDe = (tareaId: string, cantidad: number) =>
    `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(cantidad)} ${nombreDe.get(tareaId)?.unidad ?? ""}`;

  type Fila = {
    clave: string;
    desde: string;
    hasta: string;
    tarea: string;
    piso: string;
    avance: string;
    que: string;
    por: string;
    accion: "borrar" | "editar" | "3d" | null;
    id: string;
    tareaId?: string;
  };
  // Lo marcado en el 3D, junto por día, tarea y piso: una fila por cada vez.
  const del3d = new Map<string, Fila & { cosas: number; total: number }>();
  for (const m of enEl3d ?? []) {
    const desde = m.fecha_inicio ?? m.fecha;
    const clave = `${desde}|${m.fecha}|${m.tarea_id}|${m.piso}`;
    const ya = del3d.get(clave) ?? {
      clave: `3d|${clave}`,
      desde,
      hasta: m.fecha,
      tarea: nombreDe.get(m.tarea_id)?.nombre ?? "—",
      piso: nivelDe(m.tarea_id, m.piso),
      avance: "",
      que: "",
      por: (m.creado_por && nombreDePersona.get(m.creado_por)) || "—",
      accion: "3d" as const,
      id: "",
      tareaId: m.tarea_id,
      cosas: 0,
      total: 0,
    };
    ya.cosas += 1;
    ya.total += Number(m.cantidad);
    del3d.set(clave, ya);
  }
  const filas: Fila[] = [
    ...(aMano ?? []).map(
      (c): Fila => ({
        clave: `mano|${c.id}`,
        desde: c.fecha_inicio ?? c.fecha,
        hasta: c.fecha,
        tarea: nombreDe.get(c.tarea_id)?.nombre ?? "—",
        piso: nivelDe(c.tarea_id, c.piso),
        avance: cantidadDe(c.tarea_id, Number(c.cantidad)),
        que: c.comentario ?? "—",
        por: (c.creado_por && nombreDePersona.get(c.creado_por)) || "—",
        accion: "borrar",
        id: c.id,
      })
    ),
    ...Array.from(del3d.values()).map(
      (f): Fila => ({
        ...f,
        avance: cantidadDe(f.tareaId ?? "", f.total),
        que: `${f.cosas} ${f.cosas === 1 ? "cosa" : "cosas"} en el 3D`,
      })
    ),
    // Los porcentajes del rubro cargados antes de ir por tarea.
    ...cargas
      .filter((c) => !c.desdeElPlano)
      .map(
        (c): Fila => ({
          clave: `rubro|${c.id}`,
          desde: c.fechaDesde,
          hasta: c.fechaHasta,
          tarea: "Todo el rubro",
          piso: "—",
          avance: `+${c.porcentaje} %`,
          que: c.comentario ?? "—",
          por: c.cargadoPor ?? "—",
          accion: "editar",
          id: c.id,
        })
      ),
  ].sort((a, b) => b.hasta.localeCompare(a.hasta) || b.desde.localeCompare(a.desde));

  // Las cargas vienen de la más nueva a la más vieja, así que el acumulado
  // total es el de la primera.
  const acumulado = cargas[0]?.acumulado ?? 0;

  // La fecha de hoy en la zona de la obra: el servidor puede estar en UTC y
  // dar el día de mañana a la noche.
  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="avances" />}
    >
      <ObraHeader obra={obra} activeSection="avances" ocultarNav />


      <section style={cabecera}>
        <div>
          <p style={ui.eyebrow}>{estadoDe(acumulado)}</p>
          <h2 style={ui.pageTitle}>{rubro.nombre}</h2>
        </div>

        <div style={acumuladoCaja}>
          <p style={ui.label}>Acumulado</p>
          <strong style={numeroGrande}>{acumulado}%</strong>
        </div>
      </section>

      <div style={ui.progressBackground}>
        <div
          style={{ ...ui.progressFill, width: `${Math.min(acumulado, 100)}%` }}
        />
      </div>

      {error && <p style={errorBox}>{error}</p>}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Cargar avance</h3>
      </div>

      {/* Con tareas en el cómputo, tarea por tarea, con la misma cuenta que
          el 3D. Sin ellas, como siempre: el porcentaje del rubro. */}
      {tareas.length > 0 ? (
        <CargarAvancePorTarea
          action={cargarAvancePorTarea}
          obraId={obra.id}
          slug={obra.slug}
          rubroId={rubro.id}
          tareas={tareas}
          hoy={hoy}
        />
      ) : (
        <CargarAvanceForm
          action={cargarAvance}
          obraId={obra.id}
          slug={obra.slug}
          rubroId={rubro.id}
          acumuladoPrevio={acumulado}
          hoy={hoy}
        />
      )}

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Historial</h3>
      </div>

      <section style={ui.panel}>
        {filas.length === 0 ? (
          <p style={ui.vacio}>Sin avances.</p>
        ) : (
          <table style={{ ...ui.table, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "190px" }} />
              <col style={{ width: "70px" }} />
              <col />
              <col style={{ width: "100px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "70px" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={ui.th}>Período</th>
                <th style={ui.thRight}>Días</th>
                <th style={ui.th}>Tarea</th>
                <th style={ui.th}>Piso</th>
                <th style={ui.thRight}>Avance</th>
                <th style={ui.th}>Qué se hizo</th>
                <th style={ui.th}>Por</th>
                <th style={ui.th} />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave}>
                  <td style={ui.td}>
                    {f.desde === f.hasta ? formatDate(f.hasta) : `${formatDate(f.desde)} al ${formatDate(f.hasta)}`}
                  </td>
                  <td style={ui.tdRight}>{diasEntre(f.desde, f.hasta)}</td>
                  <td style={ui.td}>
                    <span style={unaLinea}>{f.tarea}</span>
                  </td>
                  <td style={ui.td}>{f.piso}</td>
                  <td style={ui.tdRight}>{f.avance}</td>
                  <td style={ui.td}>
                    <span style={unaLinea}>{f.que}</span>
                  </td>
                  <td style={ui.td}>
                    <span style={unaLinea}>{f.por}</span>
                  </td>
                  <td style={ui.td}>
                    {f.accion === "borrar" && (
                      <form action={borrarAvanceDeTarea}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="obra_id" value={obra.id} />
                        <input type="hidden" name="slug" value={obra.slug} />
                        <input type="hidden" name="rubro_id" value={rubro.id} />
                        <BotonConfirmar mensaje="¿Borrar esta carga?" style={botonBorrar}>
                          Borrar
                        </BotonConfirmar>
                      </form>
                    )}
                    {f.accion === "editar" && (
                      <Link href={`/obras/${obra.slug}/avances/${rubro.id}/${f.id}/editar`} style={editarLink}>
                        Editar
                      </Link>
                    )}
                    {f.accion === "3d" && f.tareaId && (
                      <Link
                        href={`/obras/${obra.slug}/plantas/3d?desde=avance:${rubro.id}&tarea=${f.tareaId}`}
                        title="Ver en el 3D"
                        style={boton3d}
                      >
                        3D
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}

/** Cuántos días van de una fecha a otra, las dos incluidas: del 10 al 14 son 5. */
function diasEntre(desde: string, hasta: string): number {
  const d = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const h = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((h - d) / 86_400_000) + 1;
}

const unaLinea = {
  display: "block",
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
  whiteSpace: "nowrap" as const,
};

/** El botón al 3D: negro con letra blanca, como en la carga. */
const boton3d = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "34px",
  height: "26px",
  background: "#111111",
  color: "#ffffff",
  borderRadius: "7px",
  fontSize: "11px",
  fontWeight: 700,
  textDecoration: "none",
};

const cabecera = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "20px",
};

const acumuladoCaja = {
  textAlign: "right" as const,
};

const numeroGrande = {
  fontSize: "34px",
  fontWeight: 400,
};

const editarLink = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
};

const botonBorrar = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#b91c1c",
  fontSize: "14px",
  fontFamily: "inherit",
  textDecoration: "underline",
  cursor: "pointer",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginTop: "20px",
  fontSize: "14px",
};
