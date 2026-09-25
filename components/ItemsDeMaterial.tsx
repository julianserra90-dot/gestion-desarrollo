"use client";

import { useEffect, useState } from "react";
import IconoObra from "@/components/IconoObra";
import InputMonto from "@/components/InputMonto";
import { crearMaterialDesdeGasto } from "@/app/obras/[obraId]/materiales/actions";
import SelectorMaterial, { type MaterialOpcion } from "@/components/SelectorMaterial";
import * as ui from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { UNIDADES } from "@/lib/unidades";

/**
 * El detalle de un gasto de materiales: qué se compró, cuánto y a cuánto.
 *
 * Se agrega item por item tocando "+", como se lee una factura. El material
 * sale del catálogo (común a todas las obras) y trae su unidad; la cantidad y
 * el precio unitario se cargan a mano.
 *
 * **El total del gasto no sale de acá.** El monto es el de la factura, que
 * puede traer un flete o un descuento que no son items. La suma del detalle se
 * muestra al pie como referencia; la comparación con la factura —con el IVA
 * sumado si los precios son netos— la hace el formulario del gasto, que sabe
 * qué comprobante es, y avisa sin frenar cuando no cierra.
 *
 * Los campos se llaman `item_material`, `item_cantidad` y `item_precio` y van
 * repetidos: el server action los lee con `getAll` y los cruza por posición.
 */

export type { MaterialOpcion } from "@/components/SelectorMaterial";

export type ItemCargado = {
  materialId: string;
  cantidad: string;
  precio: string;
};

type Fila = ItemCargado & { clave: number };

/**
 * Qué papel se está detallando. Cambia sólo los textos: la factura dice qué se
 * compró y el presupuesto qué se cotizó, y llamarlos igual confunde justo
 * cuando los dos están en pantalla.
 */
type Origen = "factura" | "presupuesto";

const VACIO: Record<Origen, string> = {
  factura:
    "Sin detalle. Si querés dejar registro de qué se compró, agregá los items de la factura.",
  presupuesto:
    "Sin detalle. Cargá los items que cotizó el proveedor: después la compra los trae sola.",
};

export default function ItemsDeMaterial({
  materiales,
  rubroNombre,
  iniciales = [],
  origen = "factura",
  onTotal,
}: {
  materiales: MaterialOpcion[];
  /**
   * El rubro elegido en el formulario, **por nombre**: el catálogo apunta a
   * los rubros de la plantilla y el gasto al de su obra, y lo único que las
   * dos filas comparten es el nombre. Su acordeón arranca abierto y primero.
   */
  rubroNombre: string;
  /** Ya no se usa: el alta se hace acá mismo. Queda para no romper llamadas. */
  slug?: string;
  iniciales?: ItemCargado[];
  origen?: Origen;
  /**
   * Avisa cuánto suman los items. Lo usa el presupuesto, donde el monto puede
   * salir del detalle. Pasar el `setState` de arriba directamente: hace falta
   * que la función sea estable o el efecto se dispara en cada render.
   */
  onTotal?: (total: number) => void;
}) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    iniciales.map((item, i) => ({ ...item, clave: i }))
  );

  // La clave sube siempre, aunque se borren filas del medio: si se reusara el
  // índice, React confundiría una fila con otra al quitar una.
  const [proxima, setProxima] = useState(iniciales.length);

  // El catálogo vive en estado porque el alta en línea lo agranda sin recargar
  // la página: el material recién creado tiene que aparecer en el desplegable
  // en el acto.
  const [catalogo, setCatalogo] = useState(materiales);

  // El alta de un material sin salir del formulario. Antes era un enlace al
  // catálogo y se perdía el gasto a medio cargar.
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [altaNombre, setAltaNombre] = useState("");
  const [altaUnidad, setAltaUnidad] = useState<string>("un");
  const [altaError, setAltaError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /**
   * El "+" de una fila agrega la siguiente **abajo de ella**, no al final: se
   * carga la factura renglón por renglón, y esperar que aparezca al pie
   * obligaría a buscarla. Sin fila (`null`) es el primer item.
   */
  const agregar = (despuesDe: number | null) => {
    const nueva = { clave: proxima, materialId: "", cantidad: "", precio: "" };

    setFilas((previas) => {
      if (despuesDe === null) return [...previas, nueva];

      const i = previas.findIndex((f) => f.clave === despuesDe);
      return [...previas.slice(0, i + 1), nueva, ...previas.slice(i + 1)];
    });

    setProxima((n) => n + 1);
  };

  const quitar = (clave: number) =>
    setFilas((previas) => previas.filter((f) => f.clave !== clave));

  const cambiar = (clave: number, campo: keyof ItemCargado, valor: string) =>
    setFilas((previas) =>
      previas.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f))
    );

  /**
   * Guarda el material y lo deja elegido: en la primera fila que todavía no
   * tiene material, o en una fila nueva al final si todas tienen.
   */
  const guardarMaterial = async () => {
    if (guardando) return;
    setGuardando(true);
    setAltaError(null);

    const resultado = await crearMaterialDesdeGasto(
      altaNombre,
      altaUnidad,
      rubroNombre || null
    ).catch(() => ({ ok: false as const, error: "No se pudo guardar el material." }));

    setGuardando(false);

    if (!resultado.ok) {
      setAltaError(resultado.error);
      return;
    }

    const nuevo = resultado.material;
    setCatalogo((previos) =>
      previos.some((m) => m.id === nuevo.id) ? previos : [...previos, nuevo]
    );

    setFilas((previas) => {
      const vacia = previas.find((f) => f.materialId === "");
      if (vacia) {
        return previas.map((f) =>
          f.clave === vacia.clave ? { ...f, materialId: nuevo.id } : f
        );
      }
      return [...previas, { clave: proxima, materialId: nuevo.id, cantidad: "", precio: "" }];
    });
    setProxima((n) => n + 1);

    setAltaAbierta(false);
    setAltaNombre("");
    setAltaUnidad("un");
  };

  const subtotal = (fila: Fila) =>
    (Number(fila.cantidad) || 0) * (Number(fila.precio) || 0);

  const total = filas.reduce((acc, f) => acc + subtotal(f), 0);

  // El formulario de arriba necesita el total para poder usarlo de monto. Va
  // en un efecto y no en el render porque escribe estado del padre.
  useEffect(() => {
    onTotal?.(total);
  }, [total, onTotal]);

  const unidadDe = (id: string) =>
    catalogo.find((m) => m.id === id)?.unidad ?? "";

  // El panel de alta. Los botones son `type="button"` y el Enter se frena a
  // mano: esto vive adentro del formulario del gasto, y un Enter suelto lo
  // mandaría entero antes de tiempo.
  const alta = altaAbierta ? (
    <div style={panelAlta}>
      <div style={camposAlta}>
        <label style={campoAlta}>
          <span style={etiquetaAlta}>Material nuevo</span>
          <input
            type="text"
            value={altaNombre}
            onChange={(e) => setAltaNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void guardarMaterial();
              }
            }}
            placeholder="Ej: Ladrillo común"
            autoFocus
            style={ui.input}
          />
        </label>
        <label style={campoAlta}>
          <span style={etiquetaAlta}>Unidad</span>
          <select
            value={altaUnidad}
            onChange={(e) => setAltaUnidad(e.target.value)}
            style={ui.input}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>

      {altaError && <p style={errorAlta}>{altaError}</p>}

      <div style={accionesAlta}>
        <button
          type="button"
          onClick={() => {
            setAltaAbierta(false);
            setAltaError(null);
          }}
          style={ui.secondaryButton}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void guardarMaterial()}
          disabled={guardando}
          style={ui.button}
        >
          {guardando ? "Guardando…" : "Guardar material"}
        </button>
      </div>

      {/* Queda en el catálogo de todas las obras, y con el rubro del gasto
          para que la próxima vez aparezca arriba. */}
      <span style={notaAlta}>
        Se guarda en el catálogo, el mismo en todas las obras.
      </span>
    </div>
  ) : null;

  return (
    <div style={contenedor}>
      {catalogo.length === 0 && filas.length === 0 && (
        <p style={ui.note}>
          Todavía no hay materiales en el catálogo. Cargá el primero acá abajo.
        </p>
      )}

      {filas.length === 0 ? (
        <p style={ui.note}>{VACIO[origen]}</p>
      ) : (
        <div style={tabla}>
          <div style={encabezado}>
            <span>Material</span>
            <span>Cantidad</span>
            <span>Precio unitario</span>
            <span>Subtotal</span>
            <span />
          </div>

          {filas.map((fila) => (
            <div key={fila.clave} style={renglon}>
              {/* Agrupado por rubro en acordeones, con el del gasto abierto:
                  el catálogo entero en una lista se hacía infinito. */}
              <SelectorMaterial
                name="item_material"
                materiales={catalogo}
                rubroNombre={rubroNombre}
                value={fila.materialId}
                onChange={(id) => cambiar(fila.clave, "materialId", id)}
              />

              <span style={conUnidad}>
                <input
                  type="number"
                  name="item_cantidad"
                  min="0"
                  step="0.001"
                  placeholder="0"
                  value={fila.cantidad}
                  onChange={(e) => cambiar(fila.clave, "cantidad", e.target.value)}
                  required
                  style={ui.input}
                />
                {/* La unidad la pone el catálogo, no se elige acá: el ladrillo
                    se cuenta por unidad siempre. Sin material no hay unidad, y
                    un guion en su lugar se leía como un botón más. */}
                <span style={unidad}>{unidadDe(fila.materialId)}</span>
              </span>

              <InputMonto
                name="item_precio"
                value={fila.precio}
                onChange={(limpio) => cambiar(fila.clave, "precio", limpio)}
                style={{ ...ui.input, textAlign: "right" }}
              />

              {/* Vacío hasta que haya cantidad y precio: el guion que iba
                  acá quedaba pegado al "+" y parecía otro control. */}
              <span style={subtotalTexto}>
                {subtotal(fila) > 0 ? formatMoney(subtotal(fila)) : ""}
              </span>

              {/* Sumar y tirar al final de cada fila, como en una planilla:
                  evita el botón suelto al pie que obligaba a bajar para seguir
                  cargando. Botones cuadrados con el borde de los de la app y
                  un ícono del mismo juego que la barra lateral: eran un "+" y
                  una "✕" sueltos que se perdían. El tacho en rojo, porque
                  saca. */}
              <span style={botones}>
                <button
                  type="button"
                  onClick={() => agregar(fila.clave)}
                  style={botonIcono}
                  aria-label="Agregar otro item"
                  title="Agregar otro item abajo de éste"
                >
                  <IconoObra nombre="mas" size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => quitar(fila.clave)}
                  style={botonTacho}
                  aria-label="Quitar item"
                  title="Quitar este item"
                >
                  <IconoObra nombre="tacho" size={18} />
                </button>
              </span>
            </div>
          ))}

          <div style={pie}>
            <span>
              {filas.length} {filas.length === 1 ? "item" : "items"}
            </span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </div>
      )}

      <div style={acciones}>
        {/* Sin filas no hay dónde poner el "+" de una fila, así que va un
            botón: es la única manera de empezar. Con el estilo de los botones
            de la app y con palabras, no un "+" verde suelto, que se perdía al
            lado del enlace y no se sabía que era por donde se arranca. */}
        {filas.length === 0 && (
          <button
            type="button"
            onClick={() => agregar(null)}
            style={ui.secondaryButton}
          >
            + Agregar material
          </button>
        )}

        {/* Abre el alta acá mismo: ir al catálogo y volver perdía el gasto
            a medio cargar. */}
        {!altaAbierta && (
          <button
            type="button"
            onClick={() => setAltaAbierta(true)}
            style={botonEnlace}
          >
            Cargar un material nuevo al catálogo
          </button>
        )}
      </div>

      {alta}
    </div>
  );
}

const contenedor = {
  display: "grid",
  gap: "12px",
};

const tabla = {
  display: "grid",
  gap: "10px",
};

// Las mismas columnas en el encabezado y en cada renglón, para que los títulos
// caigan sobre su campo.
const columnas = "minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1fr) 120px 88px";

// Cada título centrado sobre su campo, como lo pidió el usuario: alineados a
// los costados quedaban corridos respecto del recuadro que nombran.
const encabezado = {
  display: "grid",
  gridTemplateColumns: columnas,
  gap: "10px",
  textAlign: "center" as const,
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#777777",
};

const renglon = {
  display: "grid",
  gridTemplateColumns: columnas,
  gap: "10px",
  alignItems: "center",
};

const conUnidad = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const unidad = {
  fontSize: "13px",
  color: "#777777",
  whiteSpace: "nowrap" as const,
};

const subtotalTexto = {
  textAlign: "right" as const,
  fontSize: "14px",
  whiteSpace: "nowrap" as const,
};

const pie = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
  fontSize: "14px",
  color: "#555555",
};

const acciones = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const botones = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "6px",
};

// El borde y las esquinas de `ui.secondaryButton`, en cuadrado.
const botonIcono = {
  ...ui.secondaryButton,
  width: "40px",
  height: "40px",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#111111",
};

const botonTacho = {
  ...botonIcono,
  color: ui.ROJO,
};

// Un botón que se ve como el enlace que había antes: hace lo mismo que
// aquél, sólo que sin irse de la pantalla.
const botonEnlace = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#111111",
  textDecoration: "underline",
  fontSize: "13px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const panelAlta = {
  border: "1px solid #dcdcdc",
  borderRadius: "10px",
  padding: "16px",
  display: "grid",
  gap: "12px",
};

const camposAlta = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
  gap: "12px",
};

const campoAlta = {
  display: "grid",
  gap: "6px",
  alignContent: "start" as const,
};

const etiquetaAlta = {
  fontSize: "13px",
  color: "#555555",
};

const accionesAlta = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
};

const notaAlta = {
  fontSize: "13px",
  color: "#999999",
};

const errorAlta = {
  margin: 0,
  fontSize: "13px",
  color: "#b91c1c",
};
