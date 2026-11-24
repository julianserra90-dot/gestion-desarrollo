"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useConfirmacion } from "@/components/Confirmacion";
import DesgloseTarea, { type RenglonInicial } from "@/components/DesgloseTarea";
import { type MaterialOpcion } from "@/components/SelectorMaterial";
import * as ui from "@/components/ui";
import SelectorUnidad from "@/components/SelectorUnidad";

export type TareaDelRubro = {
  id: string;
  subrubro: string | null;
  nombre: string;
  unidad: string;
  /** Cuántos renglones tiene su composición por unidad. */
  renglones: number;
  /** Si esta obra la tiene en el cómputo. */
  enEstaObra: boolean;
  /** Si es subtarea, el id de su madre: el pastinado, del porcelanato. */
  madre: string | null;
};

type RenglonesDeComposicion = Parameters<React.ComponentProps<typeof DesgloseTarea>["guardar"]>[1];

/**
 * Las tareas del catálogo de un rubro, para configurarlas: nombre, unidad,
 * composición por unidad, y alta y baja.
 *
 * Se entra por los Rubros de una obra, pero **el catálogo es uno solo para
 * todas las obras**: lo que se cambia acá cambia en todas, y la pantalla lo
 * dice arriba. Qué les llega a las obras que ya tienen una tarea lo deciden
 * las acciones (\`editarTareaDelCatalogo\`, \`guardarModeloDeTarea\`).
 *
 * Vive acá y no en el cómputo para que el cómputo quede en lo suyo: elegir
 * tareas, cargar cantidades y ajustar el desglose de esa obra.
 */
export default function TareasDelRubro({
  rubro,
  tareas,
  materiales,
  crear,
  editar,
  eliminar,
  leerComposicion,
  guardarComposicion,
  vincular,
}: {
  /** Hace de una tarea la subtarea de otra, o la suelta (null). */
  vincular: (subtareaId: string, madreId: string | null) => Promise<{ error?: string }>;
  rubro: string;
  tareas: TareaDelRubro[];
  materiales: MaterialOpcion[];
  crear: (
    rubro: string,
    subrubro: string,
    nombre: string,
    unidad: string
  ) => Promise<{ error?: string; id?: string }>;
  editar: (
    tareaId: string,
    nombre: string,
    unidad: string
  ) => Promise<{ error?: string; aviso?: string }>;
  eliminar: (tareaId: string) => Promise<{ error?: string }>;
  leerComposicion: (tareaId: string) => Promise<{
    renglones?: Omit<RenglonInicial, "presupuestoId" | "usarCotizado" | "cotizacion">[];
    error?: string;
  }>;
  guardarComposicion: (
    tareaId: string,
    renglones: RenglonesDeComposicion
  ) => Promise<{ error?: string; aviso?: string }>;
}) {
  const router = useRouter();
  const { preguntar, dialogo } = useConfirmacion();
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, iniciar] = useTransition();
  const [buscar, setBuscar] = useState("");

  const [corrigiendo, setCorrigiendo] = useState<{
    id: string;
    nombre: string;
    unidad: string;
  } | null>(null);
  const [componiendo, setComponiendo] = useState<TareaDelRubro | null>(null);
  const [nueva, setNueva] = useState({ subrubro: "", nombre: "", unidad: "m²" });

  /** Las tareas desplegadas, para ver y agregar sus subtareas. */
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set());

  const subrubros = [...new Set(tareas.map((t) => t.subrubro).filter(Boolean) as string[])];
  const termino = buscar.trim().toLowerCase();
  const delRubro = new Set(tareas.map((t) => t.id));
  const hijasDe = (id: string) => tareas.filter((t) => t.madre === id);
  // Sin buscar, cada subtarea va debajo de su madre y no suelta en la lista.
  const visibles = tareas.filter((t) =>
    termino ? t.nombre.toLowerCase().includes(termino) : !(t.madre && delRubro.has(t.madre))
  );

  const alternar = (id: string) =>
    setAbiertas((antes) => {
      const despues = new Set(antes);
      if (despues.has(id)) despues.delete(id);
      else despues.add(id);
      return despues;
    });

  const unir = (subtareaId: string, madreId: string | null) =>
    iniciar(async () => {
      const r = await vincular(subtareaId, madreId);
      if (r.error) {
        setError(r.error);
        return;
      }
      limpiar();
      router.refresh();
    });

  const limpiar = () => {
    setError("");
    setAviso("");
  };

  const confirmarCorreccion = () => {
    if (!corrigiendo) return;
    const { id, nombre, unidad } = corrigiendo;
    iniciar(async () => {
      const r = await editar(id, nombre, unidad);
      if (r.error) {
        setError(r.error);
        return;
      }
      setError("");
      setAviso(r.aviso ?? "");
      setCorrigiendo(null);
      router.refresh();
    });
  };

  const borrar = async (t: TareaDelRubro) => {
    const si = await preguntar(
      `¿Borrar "${t.nombre}" del catálogo? Deja de aparecer en todas las obras, con su composición. No se puede deshacer.`,
      "Borrar del catálogo"
    );
    if (!si) return;
    iniciar(async () => {
      const r = await eliminar(t.id);
      if (r.error) {
        setError(r.error);
        return;
      }
      limpiar();
      setCorrigiendo(null);
      router.refresh();
    });
  };

  const agregar = () =>
    iniciar(async () => {
      const r = await crear(rubro, nueva.subrubro, nueva.nombre, nueva.unidad);
      if (r.error) {
        setError(r.error);
        return;
      }
      limpiar();
      setAviso(`"${nueva.nombre.trim()}" agregada.`);
      setNueva({ ...nueva, nombre: "" });
      router.refresh();
    });

  /** Una tarea en la lista: su fila, o la de corregirla. `hija`: es subtarea. */
  const renglonDe = (t: TareaDelRubro, hija: boolean, hijas: number) => {
    const enEdicion = corrigiendo?.id === t.id ? corrigiendo : null;
    return enEdicion ? (
      <div style={filaEdicion}>
        <input
          type="text"
          value={enEdicion.nombre}
          autoFocus
          aria-label="Nombre de la tarea"
          onChange={(e) => setCorrigiendo({ ...enEdicion, nombre: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmarCorreccion();
            }
            if (e.key === "Escape") setCorrigiendo(null);
          }}
          style={{ ...campoChico, flex: 1, minWidth: "240px" }}
        />
        <SelectorUnidad
          value={enEdicion.unidad}
          onChange={(u) => setCorrigiendo({ ...enEdicion, unidad: u })}
          corto
          style={{ ...campoChico, width: "110px" }}
        />
        <button
          type="button"
          onClick={confirmarCorreccion}
          disabled={ocupado}
          style={botonFuerte}
        >
          {ocupado ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setCorrigiendo(null)} style={enlace}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void borrar(t)}
          disabled={ocupado}
          style={enlaceBorrar}
        >
          Borrar del catálogo
        </button>
      </div>
    ) : (
      <div style={{ ...(t.enEstaObra ? filaEnObra : fila), ...(hija ? filaDeSubtarea : {}) }}>
        {hija ? (
          <span style={lugarDeFlecha}>↳</span>
        ) : (
          <button
            type="button"
            onClick={() => alternar(t.id)}
            aria-expanded={abiertas.has(t.id)}
            aria-label={`Subtareas de ${t.nombre}`}
            title="Subtareas"
            style={{ ...lugarDeFlecha, ...flecha, color: hijas > 0 ? "#111111" : "#bbbbbb" }}
          >
            {abiertas.has(t.id) ? "▾" : "▸"}
          </button>
        )}
        <span style={nombreTarea}>
          {t.nombre}
          {hijas > 0 && <span style={marcaObra}>{hijas === 1 ? "1 subtarea" : `${hijas} subtareas`}</span>}
          {t.enEstaObra && <span style={marcaObra}>en el cómputo de esta obra</span>}
        </span>
        <span style={unidad}>{t.unidad}</span>
        <button
          type="button"
          onClick={() => {
            limpiar();
            setCorrigiendo(null);
            setComponiendo(t);
          }}
          style={t.renglones > 0 ? botonComposicion : botonSinComposicion}
          title="Qué lleva una unidad de la tarea"
        >
          {t.renglones > 0
            ? `Composición (${t.renglones})`
            : "Sin composición"}
        </button>
        <button
          type="button"
          onClick={() => {
            limpiar();
            setCorrigiendo({ id: t.id, nombre: t.nombre, unidad: t.unidad });
          }}
          style={botonLapiz}
          title="Corregir nombre o unidad, o borrar del catálogo"
          aria-label={`Corregir ${t.nombre}`}
        >
          ✎
        </button>
        {/* El mismo lugar en todas, para que el lápiz quede en columna. */}
        <span style={lugarDeQuitar}>
          {hija && (
            <button
              type="button"
              onClick={() => unir(t.id, null)}
              disabled={ocupado}
              style={botonLapiz}
              title="Que deje de ser subtarea"
              aria-label={`Que ${t.nombre} deje de ser subtarea`}
            >
              ×
            </button>
          )}
        </span>
      </div>
    );
  };

  return (
    <>
      {componiendo && (
        <ComposicionDeTarea
          key={componiendo.id}
          tarea={componiendo}
          rubro={rubro}
          materiales={materiales}
          leer={leerComposicion}
          guardar={guardarComposicion}
          alCerrar={(final) => {
            setComponiendo(null);
            if (final) setAviso(final);
            router.refresh();
          }}
        />
      )}

      {dialogo}

      {error && <p style={textoError}>{error}</p>}
      {aviso && <p style={textoAviso}>{aviso}</p>}

      <section style={ui.panel}>
        <div style={barra}>
          <input
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar tarea"
            style={{ ...ui.input, padding: "9px 12px", maxWidth: "320px" }}
          />
          <span style={ui.note}>
            {tareas.length === 1 ? "1 tarea" : `${tareas.length} tareas`}
          </span>
        </div>

        {visibles.length === 0 ? (
          <p style={ui.vacio}>
            {tareas.length === 0
              ? "Este rubro todavía no tiene tareas en el catálogo."
              : `Ninguna tarea coincide con "${buscar}".`}
          </p>
        ) : (
          <div>
            {visibles.map((t, i) => {
              const nuevoSub = t.subrubro && t.subrubro !== visibles[i - 1]?.subrubro;
              const hijas = t.madre ? [] : hijasDe(t.id);
              // Puede ser subtarea la que no es madre ni hija de nadie.
              const candidatas = tareas.filter(
                (c) => c.id !== t.id && c.madre === null && hijasDe(c.id).length === 0
              );
              return (
                <div key={t.id}>
                  {nuevoSub && <p style={subrubro}>{t.subrubro}</p>}
                  {renglonDe(t, t.madre !== null, hijas.length)}
                  {!t.madre && abiertas.has(t.id) && (
                    <>
                      {hijas.map((h) => (
                        <div key={h.id}>{renglonDe(h, true, 0)}</div>
                      ))}
                      <div style={agregarSubtarea}>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) unir(e.target.value, t.id);
                          }}
                          disabled={ocupado}
                          aria-label={`Agregar una subtarea a ${t.nombre}`}
                          style={{ ...campoChico, width: "100%" }}
                        >
                          <option value="">Agregar subtarea…</option>
                          {candidatas.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} ({c.unidad})
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Nueva tarea del catálogo</h3>
        <div style={formNueva}>
          <input
            type="text"
            value={nueva.nombre}
            onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
            placeholder="Nombre de la tarea"
            aria-label="Nombre de la tarea"
            style={{ ...campoChico, flex: "1 1 260px" }}
          />
          <SelectorUnidad
            value={nueva.unidad}
            onChange={(u) => setNueva({ ...nueva, unidad: u })}
            style={{ ...campoChico, width: "150px" }}
          />
          <input
            type="text"
            list="subrubros-del-rubro"
            value={nueva.subrubro}
            onChange={(e) => setNueva({ ...nueva, subrubro: e.target.value })}
            placeholder="Subrubro (opcional)"
            aria-label="Subrubro"
            style={{ ...campoChico, flex: "0 1 220px" }}
          />
          <datalist id="subrubros-del-rubro">
            {subrubros.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={agregar}
            disabled={ocupado || !nueva.nombre.trim()}
            style={botonFuerte}
          >
            Agregar
          </button>
        </div>

      </section>
    </>
  );
}

/**
 * La composición de una tarea del catálogo, pedida al abrirla: un rubro tiene
 * decenas de tareas y traerlas todas con su composición para abrir una sería
 * pagarlas todas.
 */
function ComposicionDeTarea({
  tarea,
  rubro,
  materiales,
  leer,
  guardar,
  alCerrar,
}: {
  tarea: TareaDelRubro;
  rubro: string;
  materiales: MaterialOpcion[];
  leer: (tareaId: string) => Promise<{
    renglones?: Omit<RenglonInicial, "presupuestoId" | "usarCotizado" | "cotizacion">[];
    error?: string;
  }>;
  guardar: (
    tareaId: string,
    renglones: RenglonesDeComposicion
  ) => Promise<{ error?: string; aviso?: string }>;
  alCerrar: (aviso?: string) => void;
}) {
  const [renglones, setRenglones] = useState<RenglonInicial[] | null>(null);
  const [error, setError] = useState("");
  const caja = useRef<HTMLElement>(null);

  // Se abre arriba de la lista y la tarea que la abrió puede estar muy abajo.
  useEffect(() => {
    caja.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    let vigente = true;
    leer(tarea.id).then((r) => {
      if (!vigente) return;
      if (r.error) {
        setError(r.error);
        return;
      }
      setRenglones(
        (r.renglones ?? []).map((x) => ({
          ...x,
          presupuestoId: null,
          usarCotizado: false,
          cotizacion: null,
        }))
      );
    });
    return () => {
      vigente = false;
    };
  }, [tarea.id, leer]);

  return (
    <section ref={caja} style={cajaComposicion}>
      <div style={cabezaComposicion}>
        <div>
          <p style={ui.label}>Composición · por 1 {tarea.unidad}</p>
          <h4 style={tituloComposicion}>{tarea.nombre}</h4>

        </div>
        <button type="button" onClick={() => alCerrar()} style={enlace}>
          Cerrar
        </button>
      </div>
      {error ? (
        <p style={textoError}>{error}</p>
      ) : renglones === null ? (
        <p style={ui.note}>Buscando la composición…</p>
      ) : (
        <DesgloseTarea
          modelo
          itemId={tarea.id}
          unidadTarea={tarea.unidad}
          cantidadTarea={1}
          iniciales={renglones}
          puedeSerModelo={false}
          materiales={materiales}
          rubroNombre={rubro}
          guardar={(id, lista) => guardar(id, lista)}
          alGuardar={(final) => alCerrar(final ?? "Composición guardada.")}
        />
      )}
    </section>
  );
}

const barra = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  marginBottom: "12px",
};

const fila = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "8px 8px",
  borderRadius: "8px",
  fontSize: "14px",
  borderBottom: "1px solid #f4f4f4",
};

const filaEnObra = {
  ...fila,
  background: "#fafafa",
};

const nombreTarea = {
  flex: 1,
  display: "flex",
  alignItems: "baseline",
  gap: "10px",
  flexWrap: "wrap" as const,
};

const marcaObra = {
  fontSize: "11px",
  color: "#888888",
};

/** Lo de la izquierda de cada fila: la flecha de la madre, el ↳ de la hija. */
const lugarDeFlecha = {
  width: "18px",
  flex: "0 0 18px",
  textAlign: "center" as const,
  color: "#999999",
  fontSize: "12px",
};

const flecha = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
};

/** Una subtarea, debajo de su madre. */
const filaDeSubtarea = { paddingLeft: "34px" };

const lugarDeQuitar = { width: "22px", flex: "0 0 22px", textAlign: "center" as const };

// A la altura del nombre de las subtareas: 34 de sangría, 18 de flecha y 12
// de separación.
const agregarSubtarea = { padding: "6px 8px 10px 64px" };

const unidad = {
  color: "#999999",
  fontSize: "12px",
  width: "40px",
  textAlign: "right" as const,
};

const botonComposicion = {
  ...ui.secondaryButton,
  padding: "5px 12px",
  fontSize: "12px",
  minWidth: "140px",
};

// Sin composición la tarea entra a la obra sin desglose: se nota más.
const botonSinComposicion = {
  ...botonComposicion,
  color: "#8a5a00",
  borderColor: "#f0d9a8",
  background: "#fffaf0",
};

const botonLapiz = {
  background: "none",
  border: "none",
  color: "#999999",
  fontSize: "14px",
  cursor: "pointer",
  padding: "0 4px",
};

const subrubro = {
  fontSize: "10px",
  fontWeight: 600,
  color: "#888888",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  margin: "16px 0 4px 8px",
};

const filaEdicion = {
  display: "flex",
  flexWrap: "wrap" as const,
  alignItems: "center",
  gap: "8px",
  padding: "8px",
  margin: "2px 0",
  background: "#fafafa",
  border: "1px solid #eeeeee",
  borderRadius: "10px",
};

const formNueva = {
  display: "flex",
  flexWrap: "wrap" as const,
  alignItems: "center",
  gap: "8px",
  marginTop: "12px",
};

const campoChico = {
  ...ui.input,
  padding: "8px 10px",
  fontSize: "13px",
};

const botonFuerte = {
  ...ui.button,
  padding: "8px 14px",
  fontSize: "13px",
};

const enlace = {
  background: "none",
  border: "none",
  padding: "0 6px",
  color: "#111111",
  textDecoration: "underline",
  fontSize: "12px",
  cursor: "pointer",
};

const enlaceBorrar = {
  ...enlace,
  color: ui.ROJO,
};

const textoAviso = {
  color: "#8a5a00",
  background: "#fff4d6",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "13px",
  margin: "0 0 16px",
};

const textoError = {
  color: ui.ROJO,
  fontSize: "13px",
  margin: "0 0 16px",
};

const cajaComposicion = {
  ...ui.panel,
  marginBottom: "20px",
};

const cabezaComposicion = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "10px",
};

const tituloComposicion = {
  fontSize: "16px",
  fontWeight: 600,
  margin: "4px 0",
};

