"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import DesgloseTarea, {
  type GuardarDesglose,
  type RenglonInicial,
} from "@/components/DesgloseTarea";
import * as ui from "@/components/ui";
import { formatMoney } from "@/lib/format";

export type FilaPlanilla = {
  id: string;
  tareaId: string | null;
  subrubro: string | null;
  nombre: string;
  unidad: string;
  cantidad: number;
  /** Precios por unidad de la tarea: salen de su desglose. */
  precioMateriales: number;
  precioManoObra: number;
  precioIntegrado: number;
  renglones: RenglonInicial[];
};

export type RubroPlanilla = {
  rubroId: string;
  rubro: string;
  filas: FilaPlanilla[];
};

type Editable = { nombre: string; unidad: string; cantidad: string };
type Suma = { mat: number; mo: number; int: number };

const CERO: Suma = { mat: 0, mo: 0, int: 0 };

/** Las unidades que se pueden elegir para una tarea. */
const UNIDADES = [
  { valor: "gl", nombre: "gl — global" },
  { valor: "u", nombre: "u — unidad" },
  { valor: "m", nombre: "m — metro" },
  { valor: "ml", nombre: "ml — metro lineal" },
  { valor: "m²", nombre: "m² — metro cuadrado" },
  { valor: "m³", nombre: "m³ — metro cúbico" },
  { valor: "kg", nombre: "kg — kilo" },
  { valor: "t", nombre: "t — tonelada" },
  { valor: "l", nombre: "l — litro" },
  { valor: "h", nombre: "h — hora" },
  { valor: "día", nombre: "día" },
  { valor: "mes", nombre: "mes" },
  { valor: "jgo", nombre: "jgo — juego" },
];

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sumar = (a: Suma, b: Suma): Suma => ({
  mat: a.mat + b.mat,
  mo: a.mo + b.mo,
  int: a.int + b.int,
});

const totalDe = (s: Suma) => s.mat + s.mo + s.int;

const editableDe = (f: FilaPlanilla): Editable => ({
  nombre: f.nombre,
  unidad: f.unidad,
  cantidad: f.cantidad ? String(f.cantidad) : "",
});

/**
 * La planilla del cómputo, rubro por rubro.
 *
 * Por tarea: unidad, cantidad y, para materiales y mano de obra, el precio
 * unitario al lado de lo que suma —con el encabezado agrupado, como se lee
 * una planilla de costos—. El integrado aparece sólo en los rubros que lo
 * usan. Los precios no se escriben acá: salen del desglose, que se despliega
 * dentro de la fila.
 *
 * Las cantidades se guardan juntas con un botón: cargar un cómputo es pasar
 * números de un plano, renglón tras renglón. El nombre y la unidad (lápiz),
 * el desglose y el tacho guardan solos, sin tocar lo demás.
 */
export default function PlanillaComputo({
  slug,
  obraId,
  mesPrecios,
  rubros,
  superficie,
  abrirInicial,
  guardar,
  editarTarea,
  guardarDesglose,
  quitarItem,
}: {
  slug: string;
  obraId: string;
  mesPrecios: string;
  rubros: RubroPlanilla[];
  /** La superficie de construcción, para el costo por m². */
  superficie: number | null;
  /** Una fila que llega desplegada (un enlace viejo al desglose). */
  abrirInicial?: string;
  guardar: (formData: FormData) => void;
  editarTarea: (id: string, nombre: string, unidad: string) => Promise<{ error?: string }>;
  guardarDesglose: GuardarDesglose;
  quitarItem: (id: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const todas = rubros.flatMap((r) => r.filas);

  const [valores, setValores] = useState<Record<string, Editable>>(() =>
    Object.fromEntries(todas.map((f) => [f.id, editableDe(f)]))
  );
  const [confirmados, setConfirmados] = useState<Record<string, Editable>>(() =>
    Object.fromEntries(todas.map((f) => [f.id, editableDe(f)]))
  );

  // Tildar una tarea en el catálogo refresca la página y llegan filas nuevas.
  // Se suman al estado sin pisar lo que ya se estaba escribiendo en las otras.
  const firma = todas.map((f) => f.id).join(",");
  const [firmaPrevia, setFirmaPrevia] = useState(firma);
  if (firma !== firmaPrevia) {
    setFirmaPrevia(firma);
    setValores((antes) =>
      Object.fromEntries(todas.map((f) => [f.id, antes[f.id] ?? editableDe(f)]))
    );
    setConfirmados((antes) =>
      Object.fromEntries(todas.map((f) => [f.id, antes[f.id] ?? editableDe(f)]))
    );
  }

  const [cambios, setCambios] = useState(false);
  const [editando, setEditando] = useState<Set<string>>(() => new Set());
  const [abiertos, setAbiertos] = useState<Set<string>>(
    () => new Set(abrirInicial ? [abrirInicial] : [])
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [ocupado, iniciar] = useTransition();

  const conmutar = (setter: typeof setEditando, id: string, abrir?: boolean) =>
    setter((antes) => {
      const nuevo = new Set(antes);
      const va = abrir ?? !nuevo.has(id);
      if (va) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });

  const cambiar = (id: string, campo: keyof Editable, valor: string) => {
    setValores((antes) => ({ ...antes, [id]: { ...antes[id], [campo]: valor } }));
    // Nombre y unidad se confirman en su fila; sólo la cantidad espera al botón.
    if (campo === "cantidad") setCambios(true);
  };

  const cancelarEdicion = (id: string) => {
    const previo = confirmados[id];
    setValores((antes) => ({
      ...antes,
      [id]: { ...antes[id], nombre: previo.nombre, unidad: previo.unidad },
    }));
    setErrores((antes) => ({ ...antes, [id]: "" }));
    conmutar(setEditando, id, false);
  };

  const confirmarEdicion = (id: string) => {
    const { nombre, unidad } = valores[id];
    iniciar(async () => {
      const r = await editarTarea(id, nombre, unidad);
      if (r.error) {
        setErrores((antes) => ({ ...antes, [id]: r.error ?? "" }));
        return;
      }
      setConfirmados((antes) => ({ ...antes, [id]: { ...antes[id], nombre, unidad } }));
      setErrores((antes) => ({ ...antes, [id]: "" }));
      conmutar(setEditando, id, false);
    });
  };

  const quitar = (f: FilaPlanilla) => {
    if (!window.confirm(`¿Sacar "${valores[f.id]?.nombre ?? f.nombre}" del cómputo?`)) return;
    iniciar(async () => {
      const r = await quitarItem(f.id);
      if (r.error) {
        setErrores((antes) => ({ ...antes, [f.id]: r.error ?? "" }));
        return;
      }
      router.refresh();
    });
  };

  const subtotal = (f: FilaPlanilla): Suma => {
    const cantidad = num(valores[f.id]?.cantidad ?? "");
    return {
      mat: cantidad * f.precioMateriales,
      mo: cantidad * f.precioManoObra,
      int: cantidad * f.precioIntegrado,
    };
  };

  const totalRubro = (r: RubroPlanilla) =>
    r.filas.reduce((acc, f) => sumar(acc, subtotal(f)), CERO);
  const totalObra = rubros.reduce((acc, r) => sumar(acc, totalRubro(r)), CERO);
  const total = totalDe(totalObra);

  return (
    <form action={guardar}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="obra_id" value={obraId} />

      <div style={barra}>
        <label style={campoMes}>
          <span style={ui.label}>Mes de los precios</span>
          <input
            type="month"
            name="mes_precios"
            defaultValue={mesPrecios}
            onChange={() => setCambios(true)}
            style={{ ...ui.input, width: "180px" }}
          />
        </label>

        <button type="submit" style={cambios ? ui.button : ui.secondaryButton}>
          {cambios ? "Guardar cantidades" : "Guardar"}
        </button>
      </div>

      {rubros.length === 0 && (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Tildá tareas en el catálogo de la izquierda para armar el cómputo.
          </p>
        </section>
      )}

      <div style={lista}>
        {rubros.map((r) => {
          const t = totalRubro(r);
          const conIntegrado = r.filas.some((f) => f.precioIntegrado > 0);
          const columnas = 3 + 4 + (conIntegrado ? 2 : 0) + 2;

          return (
            <details key={r.rubroId} open style={panelRubro}>
              <summary style={resumen}>
                <span style={tituloRubro}>{r.rubro}</span>
                <span style={totalResumen}>{formatMoney(totalDe(t))}</span>
              </summary>

              <div style={scroll}>
                <table style={tabla}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={thIzq}>
                        Tarea
                      </th>
                      <th rowSpan={2} style={thCentro}>
                        U
                      </th>
                      <th rowSpan={2} style={thCentro}>
                        Cantidad
                      </th>
                      <th colSpan={2} style={thGrupo}>
                        Materiales
                      </th>
                      <th colSpan={2} style={thGrupo}>
                        Mano de obra
                      </th>
                      {conIntegrado && (
                        <th colSpan={2} style={thGrupo}>
                          Integrado
                        </th>
                      )}
                      <th rowSpan={2} style={thDer}>
                        Total
                      </th>
                      <th rowSpan={2} style={thIzq} />
                    </tr>
                    <tr>
                      <th style={thSub}>Unitario</th>
                      <th style={thSub}>Subtotal</th>
                      <th style={thSub}>Unitario</th>
                      <th style={thSub}>Subtotal</th>
                      {conIntegrado && (
                        <>
                          <th style={thSub}>Unitario</th>
                          <th style={thSub}>Subtotal</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {r.filas.map((f, i) => {
                      const v = valores[f.id] ?? editableDe(f);
                      const s = subtotal(f);
                      const nuevoSub =
                        f.subrubro && f.subrubro !== r.filas[i - 1]?.subrubro;
                      const abierto = abiertos.has(f.id);

                      return (
                        <Fragment key={f.id}>
                          {nuevoSub && (
                            <tr>
                              <td colSpan={columnas} style={celdaSubrubro}>
                                {f.subrubro}
                              </td>
                            </tr>
                          )}
                          <tr style={num(v.cantidad) === 0 ? filaVacia : undefined}>
                            {editando.has(f.id) ? (
                              <>
                                <td style={celdaNombre}>
                                  <div style={filaEdicion}>
                                    <input
                                      type="text"
                                      value={v.nombre}
                                      onChange={(e) => cambiar(f.id, "nombre", e.target.value)}
                                      onKeyDown={(e) => {
                                        // Enter confirma la fila, no manda la planilla.
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          confirmarEdicion(f.id);
                                        }
                                        if (e.key === "Escape") cancelarEdicion(f.id);
                                      }}
                                      style={inputNombre}
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => confirmarEdicion(f.id)}
                                      disabled={ocupado}
                                      style={botonChico}
                                    >
                                      Confirmar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => cancelarEdicion(f.id)}
                                      style={botonTexto}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </td>
                                <td style={celdaUnidad}>
                                  <select
                                    value={v.unidad}
                                    onChange={(e) => cambiar(f.id, "unidad", e.target.value)}
                                    style={selectUnidad}
                                  >
                                    {/* Una unidad que vino de Cifras y no está
                                        en la lista se conserva como opción. */}
                                    {!UNIDADES.some((u) => u.valor === v.unidad) && (
                                      <option value={v.unidad}>{v.unidad}</option>
                                    )}
                                    {UNIDADES.map((u) => (
                                      <option key={u.valor} value={u.valor}>
                                        {u.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={celdaNombre}>
                                  <span style={nombreFila}>
                                    {v.nombre}
                                    <button
                                      type="button"
                                      onClick={() => conmutar(setEditando, f.id, true)}
                                      style={botonLapiz}
                                      title="Editar nombre y unidad"
                                      aria-label={`Editar nombre y unidad de ${v.nombre}`}
                                    >
                                      ✎
                                    </button>
                                  </span>
                                </td>
                                <td style={celdaUnidad}>{v.unidad}</td>
                              </>
                            )}
                            <td style={celdaInput}>
                              <input
                                type="number"
                                name={`cantidad:${f.id}`}
                                value={v.cantidad}
                                min={0}
                                step="any"
                                placeholder="0"
                                onChange={(e) => cambiar(f.id, "cantidad", e.target.value)}
                                style={inputCantidad}
                              />
                            </td>
                            <td style={celdaUnit}>{monto(f.precioMateriales)}</td>
                            <td style={celdaNumero}>{monto(s.mat)}</td>
                            <td style={celdaUnit}>{monto(f.precioManoObra)}</td>
                            <td style={celdaNumero}>{monto(s.mo)}</td>
                            {conIntegrado && (
                              <>
                                <td style={celdaUnit}>{monto(f.precioIntegrado)}</td>
                                <td style={celdaNumero}>{monto(s.int)}</td>
                              </>
                            )}
                            <td style={celdaTotal}>{formatMoney(totalDe(s))}</td>
                            <td style={celdaAcciones}>
                              <button
                                type="button"
                                onClick={() => conmutar(setAbiertos, f.id)}
                                style={f.renglones.length > 0 ? botonDesglose : botonDesglosar}
                                aria-expanded={abierto}
                              >
                                {f.renglones.length > 0
                                  ? `Desglose (${f.renglones.length})`
                                  : "Desglosar"}{" "}
                                {abierto ? "▴" : "▾"}
                              </button>
                              <button
                                type="button"
                                onClick={() => quitar(f)}
                                disabled={ocupado}
                                style={botonTacho}
                                title="Sacar del cómputo"
                                aria-label={`Sacar ${v.nombre} del cómputo`}
                              >
                                🗑
                              </button>
                            </td>
                          </tr>
                          {errores[f.id] && (
                            <tr>
                              <td colSpan={columnas} style={celdaError}>
                                {errores[f.id]}
                              </td>
                            </tr>
                          )}
                          {abierto && (
                            <tr>
                              <td colSpan={columnas} style={celdaDesplegada}>
                                <DesgloseTarea
                                  itemId={f.id}
                                  unidadTarea={v.unidad}
                                  cantidadTarea={num(v.cantidad)}
                                  iniciales={f.renglones}
                                  puedeSerModelo={f.tareaId !== null}
                                  guardar={guardarDesglose}
                                  alGuardar={() => conmutar(setAbiertos, f.id, false)}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    <tr>
                      <td colSpan={3} style={celdaPie}>
                        Subtotal {r.rubro}
                      </td>
                      <td style={celdaPie} />
                      <td style={celdaPieNumero}>{formatMoney(t.mat)}</td>
                      <td style={celdaPie} />
                      <td style={celdaPieNumero}>{formatMoney(t.mo)}</td>
                      {conIntegrado && (
                        <>
                          <td style={celdaPie} />
                          <td style={celdaPieNumero}>{formatMoney(t.int)}</td>
                        </>
                      )}
                      <td style={celdaPieNumero}>{formatMoney(totalDe(t))}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>

      {rubros.length > 0 && (
        <section style={resumenFinal}>
          <span style={lineaFinal}>Materiales {formatMoney(totalObra.mat)}</span>
          <span style={lineaFinal}>Mano de obra {formatMoney(totalObra.mo)}</span>
          {totalObra.int > 0 && (
            <span style={lineaFinal}>Integrado {formatMoney(totalObra.int)}</span>
          )}
          <strong style={totalFinal}>Total estimado {formatMoney(total)}</strong>
          {superficie && superficie > 0 ? (
            <span style={lineaFinal}>{formatMoney(total / superficie)} por m²</span>
          ) : null}
        </section>
      )}

      {cambios && (
        <div style={{ ...barra, justifyContent: "flex-end", marginTop: "20px" }}>
          <button type="submit" style={ui.button}>
            Guardar cantidades
          </button>
        </div>
      )}
    </form>
  );
}

/** Un guion en vez de $ 0,00 donde la tarea no lleva ese tipo. */
function monto(valor: number) {
  return valor > 0 ? formatMoney(valor) : "—";
}

const barra = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "24px",
  flexWrap: "wrap" as const,
  marginBottom: "20px",
};

const campoMes = {
  display: "grid",
  gap: "8px",
};

const lista = {
  display: "grid",
  gap: "16px",
};

// `minWidth: 0` porque es un item de grilla: sin eso se estira al ancho de la
// tabla y la página entera gana scroll horizontal, en vez de la tabla sola.
const panelRubro = {
  ...ui.panel,
  minWidth: 0,
  padding: "20px 22px",
};

const resumen = {
  cursor: "pointer",
};

const tituloRubro = {
  fontSize: "18px",
  fontWeight: 400,
  marginRight: "14px",
};

const totalResumen = {
  fontSize: "15px",
  fontWeight: 600,
};

const scroll = {
  overflowX: "auto" as const,
  marginTop: "12px",
};

const tabla = {
  ...ui.table,
  minWidth: "900px",
};

// Los títulos con el mismo relleno lateral que las celdas, y alineados igual
// que lo que tienen abajo: los campos que se escriben y los unitarios,
// centrados; los subtotales y el total, a la derecha.
const thIzq = {
  ...ui.th,
  padding: "10px 8px",
  verticalAlign: "bottom" as const,
};

const thCentro = {
  ...thIzq,
  textAlign: "center" as const,
};

const thDer = {
  ...thIzq,
  textAlign: "right" as const,
};

// El grupo ("Materiales") va centrado sobre sus dos columnas, con una raya
// debajo que lo ata a ellas.
const thGrupo = {
  ...thCentro,
  borderBottom: "1px solid #dddddd",
  paddingBottom: "6px",
};

const thSub = {
  ...thIzq,
  fontSize: "10px",
  color: "#555555",
  textAlign: "center" as const,
  paddingTop: "6px",
};

const celda = {
  borderBottom: "1px solid #f2f2f2",
  padding: "6px 8px",
  fontSize: "14px",
  color: "#333333",
};

const celdaNombre = {
  ...celda,
  minWidth: "220px",
};

const celdaUnidad = {
  ...celda,
  color: "#888888",
  whiteSpace: "nowrap" as const,
  textAlign: "center" as const,
};

const celdaInput = {
  ...celda,
  padding: "4px 8px",
  textAlign: "center" as const,
};

const celdaUnit = {
  ...celda,
  textAlign: "center" as const,
  whiteSpace: "nowrap" as const,
  color: "#888888",
};

const celdaNumero = {
  ...celda,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
  color: "#555555",
};

const celdaTotal = {
  ...celdaNumero,
  color: "#111111",
  fontWeight: 600,
};

const celdaAcciones = {
  ...celda,
  whiteSpace: "nowrap" as const,
  textAlign: "right" as const,
};

const celdaSubrubro = {
  ...celda,
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#777777",
  paddingTop: "14px",
};

const celdaDesplegada = {
  padding: "0 8px",
};

const celdaError = {
  padding: "0 8px 8px",
  color: ui.ROJO,
  fontSize: "12px",
};

const celdaPie = {
  padding: "12px 8px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#111111",
};

const celdaPieNumero = {
  ...celdaPie,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
};

// Una tarea tildada sin cantidad no suma nada: va apagada, para que salte a la
// vista lo que falta computar.
const filaVacia = {
  background: "#fafafa",
};

const inputCantidad = {
  ...ui.input,
  padding: "7px 10px",
  textAlign: "right" as const,
  width: "96px",
};

const inputTexto = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  borderRadius: "8px",
  background: "#ffffff",
  padding: "6px 8px",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111111",
};

const inputNombre = {
  ...inputTexto,
  minWidth: "200px",
};

const selectUnidad = {
  ...inputTexto,
  width: "auto",
  minWidth: "90px",
};

const nombreFila = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const filaEdicion = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const botonLapiz = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#999999",
  fontSize: "14px",
  padding: "2px 4px",
  lineHeight: 1,
};

const botonChico = {
  ...ui.button,
  padding: "7px 12px",
  fontSize: "13px",
};

const botonTexto = {
  background: "none",
  border: "none",
  color: "#777777",
  fontSize: "13px",
  textDecoration: "underline",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

// Con la misma forma que "Confirmar", para que se lea como un botón que abre
// algo. Negro cuando la tarea ya tiene desglose; con borde cuando todavía no.
const botonDesglose = {
  ...ui.button,
  padding: "7px 12px",
  fontSize: "13px",
};

const botonDesglosar = {
  ...ui.secondaryButton,
  padding: "7px 12px",
  fontSize: "13px",
};

const botonTacho = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "15px",
  padding: "4px 6px",
  marginLeft: "4px",
  opacity: 0.6,
};

const resumenFinal = {
  ...ui.panelConMargen,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "flex-end",
  gap: "6px",
  background: "#111111",
  color: "#ffffff",
};

const lineaFinal = {
  fontSize: "15px",
  color: "#dddddd",
};

const totalFinal = {
  fontSize: "22px",
  fontWeight: 600,
  marginTop: "4px",
};
