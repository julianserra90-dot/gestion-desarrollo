"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as ui from "@/components/ui";
import { formatMoney } from "@/lib/format";

/**
 * El detalle de un gasto de materiales: qué se compró, cuánto y a cuánto.
 *
 * Se agrega item por item tocando "+", como se lee una factura. El material
 * sale del catálogo (común a todas las obras) y trae su unidad; la cantidad y
 * el precio unitario se cargan a mano.
 *
 * **El total del gasto no sale de acá.** El monto es el de la factura, que
 * puede traer el IVA adentro, un flete o un descuento que no son items. Por eso
 * la suma del detalle se muestra al lado, como referencia, y no se exige que
 * coincida ni se avisa nada: sería un aviso permanente en toda factura A.
 *
 * Los campos se llaman `item_material`, `item_cantidad` y `item_precio` y van
 * repetidos: el server action los lee con `getAll` y los cruza por posición.
 */

export type MaterialOpcion = {
  id: string;
  nombre: string;
  unidad: string;
  rubroId: string | null;
};

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
  rubroId,
  slug,
  iniciales = [],
  origen = "factura",
  onTotal,
}: {
  materiales: MaterialOpcion[];
  /** El rubro elegido en el formulario: sus materiales se ofrecen primero. */
  rubroId: string;
  slug: string;
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

  const subtotal = (fila: Fila) =>
    (Number(fila.cantidad) || 0) * (Number(fila.precio) || 0);

  const total = filas.reduce((acc, f) => acc + subtotal(f), 0);

  // El formulario de arriba necesita el total para poder usarlo de monto. Va
  // en un efecto y no en el render porque escribe estado del padre.
  useEffect(() => {
    onTotal?.(total);
  }, [total, onTotal]);

  // Los del rubro que se está cargando arriba, el resto abajo: en una obra de
  // albañilería no hay que bajar veinte materiales de plomería para llegar al
  // ladrillo.
  const delRubro = materiales.filter((m) => rubroId && m.rubroId === rubroId);
  const resto = materiales.filter((m) => !rubroId || m.rubroId !== rubroId);

  const unidadDe = (id: string) =>
    materiales.find((m) => m.id === id)?.unidad ?? "";

  if (materiales.length === 0) {
    return (
      <p style={ui.note}>
        Todavía no hay materiales en el catálogo. Cargalos en{" "}
        <Link href={`/obras/${slug}/materiales/catalogo`} style={enlace}>
          Materiales
        </Link>{" "}
        (solapa Obra) y después volvé acá.
      </p>
    );
  }

  return (
    <div style={contenedor}>
      {filas.length === 0 ? (
        <p style={ui.note}>{VACIO[origen]}</p>
      ) : (
        <div style={tabla}>
          <div style={encabezado}>
            <span>Material</span>
            <span>Cantidad</span>
            <span style={derecha}>Precio unitario</span>
            <span style={derecha}>Subtotal</span>
            <span />
          </div>

          {filas.map((fila) => (
            <div key={fila.clave} style={renglon}>
              <select
                name="item_material"
                value={fila.materialId}
                onChange={(e) => cambiar(fila.clave, "materialId", e.target.value)}
                required
                style={ui.input}
              >
                <option value="">Elegí el material</option>
                {delRubro.length > 0 && (
                  <optgroup label="De este rubro">
                    {delRubro.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={delRubro.length > 0 ? "Otros" : "Materiales"}>
                  {resto.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </optgroup>
              </select>

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
                    se cuenta por unidad siempre. */}
                <span style={unidad}>{unidadDe(fila.materialId) || "—"}</span>
              </span>

              <input
                type="number"
                name="item_precio"
                min="0"
                step="0.01"
                placeholder="0"
                value={fila.precio}
                onChange={(e) => cambiar(fila.clave, "precio", e.target.value)}
                style={{ ...ui.input, textAlign: "right" }}
              />

              <span style={subtotalTexto}>
                {subtotal(fila) > 0 ? formatMoney(subtotal(fila)) : "—"}
              </span>

              {/* El "+" y la "✕" al final de cada fila: verde suma, rojo saca.
                  Es el mismo par que se ve en cualquier planilla, y evita el
                  botón suelto al pie que obligaba a bajar para seguir
                  cargando. */}
              <span style={botones}>
                <button
                  type="button"
                  onClick={() => agregar(fila.clave)}
                  style={botonSumar}
                  aria-label="Agregar otro item"
                  title="Agregar otro item"
                >
                  +
                </button>

                <button
                  type="button"
                  onClick={() => quitar(fila.clave)}
                  style={botonQuitar}
                  aria-label="Quitar item"
                  title="Quitar este item"
                >
                  ✕
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
        {/* Sin filas no hay dónde poner el "+" de una fila, así que va suelto:
            es la única manera de empezar. */}
        {filas.length === 0 && (
          <button
            type="button"
            onClick={() => agregar(null)}
            style={botonSumar}
            aria-label="Agregar el primer item"
            title="Agregar el primer item"
          >
            +
          </button>
        )}

        {/* Se abre en otra pestaña a propósito: yendo y viniendo se perdería
            el gasto a medio cargar. Al volver hay que recargar esta pantalla
            para que el material nuevo aparezca en el desplegable. */}
        <a
          href={`/obras/${slug}/materiales/catalogo`}
          target="_blank"
          rel="noopener noreferrer"
          style={enlaceChico}
        >
          Cargar un material nuevo al catálogo
        </a>
      </div>
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
const columnas = "minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1fr) 120px 64px";

const encabezado = {
  display: "grid",
  gridTemplateColumns: columnas,
  gap: "10px",
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

const derecha = {
  textAlign: "right" as const,
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
  gap: "4px",
};

// Verde suma, rojo saca: los mismos colores que los saldos en el resto de la
// app, que es lo que el ojo ya sabe leer.
const botonBase = {
  background: "none",
  border: "none",
  fontSize: "18px",
  cursor: "pointer",
  padding: "4px 6px",
  lineHeight: 1,
};

const botonSumar = {
  ...botonBase,
  color: "#15803d",
};

const botonQuitar = {
  ...botonBase,
  color: "#b91c1c",
  fontSize: "15px",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};

const enlaceChico = {
  ...enlace,
  fontSize: "13px",
};
