"use client";

import Link from "next/link";
import { useState } from "react";
import ItemsDeMaterial, {
  type ItemCargado,
  type MaterialOpcion,
} from "@/components/ItemsDeMaterial";
import * as ui from "@/components/ui";
import { formatMoney } from "@/lib/format";

type Rubro = {
  id: string;
  nombre: string;
  usaMateriales: boolean;
  usaManoObra: boolean;
  usaCombinado: boolean;
};
export type Proveedor = { id: string; nombre: string; tipo: string };

const TIPOS = ["Materiales", "Mano de obra", "Mano de obra y materiales"];

/**
 * Los materiales los cotiza un proveedor; la mano de obra, un contratista. El
 * combinado también lo cotiza un contratista: es el mismo gremio, sólo que
 * ahora su precio incluye el material.
 */
const TIPO_PROVEEDOR: Record<string, string> = {
  Materiales: "Proveedor",
  "Mano de obra": "Contratista",
  "Mano de obra y materiales": "Contratista",
};

/** A qué casilla del rubro corresponde cada tipo, para saber si se ofrece. */
const FLAG_DEL_TIPO: Record<string, keyof Rubro> = {
  Materiales: "usaMateriales",
  "Mano de obra": "usaManoObra",
  "Mano de obra y materiales": "usaCombinado",
};

const NUEVO = "__nuevo__";

export type PresupuestoExistente = {
  id: string;
  rubro_id: string;
  tipo: string;
  numero: string | null;
  monto_desde_items: boolean;
  proveedor_id: string;
  fecha: string;
  validez_hasta: string | null;
  monto: number;
  moneda: string;
  monto_usd: number | null;
  detalle: string | null;
  observaciones: string | null;
  comprobante_drive_id: string | null;
  comprobante_nombre: string | null;
};

export default function PresupuestoForm({
  action,
  obraId,
  slug,
  rubros,
  proveedores,
  error,
  presupuesto,
  cotizacion,
  rubroSugerido,
  tipoSugerido,
  materiales = [],
  itemsIniciales = [],
  textoBoton = "Guardar cotización",
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  rubros: Rubro[];
  proveedores: Proveedor[];
  error?: string;
  /** Si viene, el formulario edita esa cotización en vez de crear una. */
  presupuesto?: PresupuestoExistente;
  /** Dólar blue de hoy, sólo para la vista previa de la conversión. */
  cotizacion?: number | null;
  /** Vienen de la solapa cuando se entra por "Cotizar" de un rubro puntual. */
  rubroSugerido?: string;
  tipoSugerido?: string;
  /** El catálogo de materiales, para detallar qué se cotizó. */
  materiales?: MaterialOpcion[];
  /** Los items ya cargados, al editar. */
  itemsIniciales?: ItemCargado[];
  textoBoton?: string;
}) {
  const [rubroId, setRubroId] = useState(
    presupuesto?.rubro_id ?? rubroSugerido ?? ""
  );
  const [tipo, setTipo] = useState(presupuesto?.tipo ?? tipoSugerido ?? "Materiales");
  const [proveedorId, setProveedorId] = useState(presupuesto?.proveedor_id ?? "");
  const [monto, setMonto] = useState(
    presupuesto
      ? String(
          presupuesto.moneda === "USD" ? (presupuesto.monto_usd ?? "") : presupuesto.monto
        )
      : ""
  );
  const [moneda, setMoneda] = useState(presupuesto?.moneda ?? "ARS");
  const [reemplazar, setReemplazar] = useState(false);

  // Si el monto sale de sumar los items en vez de escribirse a mano. En el
  // gasto esto no existiría —la factura trae IVA y flete que no son items—,
  // pero el total de un presupuesto de corralón **es** la suma de sus
  // renglones, y rehacerla a mano cada vez que cambia un precio es justo lo
  // que se desincroniza.
  const [desdeItems, setDesdeItems] = useState(
    presupuesto?.monto_desde_items ?? false
  );

  // `setSumaItems` va tal cual al hijo: la referencia de un `setState` es
  // estable, así que el efecto que la llama no se dispara de más.
  const [sumaItems, setSumaItems] = useState(0);

  // La mano de obra no tiene items que sumar, así que la casilla no se ofrece
  // y el monto vuelve a escribirse a mano. Se deriva del tipo en vez de
  // resetear el estado: si se vuelve a materiales, la elección sigue ahí.
  const sumando = desdeItems && tipo === "Materiales";

  const ingresado = sumando ? sumaItems : Number(monto) || 0;
  const total =
    moneda === "USD" ? (cotizacion ? ingresado * cotizacion : 0) : ingresado;

  // El desplegable muestra proveedores o contratistas según lo que se cotiza.
  const tipoProveedor = TIPO_PROVEEDOR[tipo] ?? "Proveedor";
  const disponibles = proveedores.filter((p) => p.tipo === tipoProveedor);
  const agregandoNuevo = proveedorId === NUEVO;

  function cambiarTipo(nuevoTipo: string) {
    setTipo(nuevoTipo);
    // El proveedor elegido era del otro tipo: deja de valer.
    setProveedorId("");
  }

  // Sólo se ofrece lo que el rubro admite: el terreno se compra y listo, una
  // demolición es puro trabajo.
  const rubroElegido = rubros.find((r) => r.id === rubroId);
  const tiposDisponibles = rubroElegido
    ? TIPOS.filter((t) => rubroElegido[FLAG_DEL_TIPO[t]])
    : TIPOS;

  function cambiarRubro(nuevoRubro: string) {
    setRubroId(nuevoRubro);

    const r = rubros.find((x) => x.id === nuevoRubro);
    if (!r) return;

    // Cambiar de rubro puede dejar el tipo elegido sin sentido: se acomoda al
    // primero que el rubro nuevo sí admite.
    if (!r[FLAG_DEL_TIPO[tipo]]) {
      const otro = TIPOS.find((t) => r[FLAG_DEL_TIPO[t]]);
      if (otro) cambiarTipo(otro);
    }
  }

  return (
    <form action={action} style={layout}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      {presupuesto && (
        <input type="hidden" name="presupuesto_id" value={presupuesto.id} />
      )}

      <div>
        {error && <p style={errorBox}>{error}</p>}

        <div style={ui.panel}>
          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Rubro</span>
              <select
                name="rubro_id"
                value={rubroId}
                onChange={(e) => cambiarRubro(e.target.value)}
                required
                style={ui.input}
              >
                <option value="">Seleccionar rubro</option>
                {rubros.map((rubro) => (
                  <option key={rubro.id} value={rubro.id}>
                    {rubro.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label style={field}>
              <span style={labelCampo}>Qué se cotiza</span>
              <select
                name="tipo"
                value={tipo}
                onChange={(e) => cambiarTipo(e.target.value)}
                style={ui.input}
              >
                {tiposDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {/* Sólo cuando el rubro deja una opción sola: explica por qué el
                  desplegable no ofrece la otra. El texto genérico —"un rubro
                  puede cotizarse para las dos cosas"— se fue: se deduce de ver
                  las dos opciones. */}
              {tiposDisponibles.length === 1 && rubroElegido && (
                <span style={ayudaCampo}>
                  En {rubroElegido.nombre} sólo se cotiza{" "}
                  {tiposDisponibles[0].toLowerCase()}.
                </span>
              )}
            </label>

            <div style={fieldAncho}>
              <span style={labelCampo}>
                {tipoProveedor === "Proveedor"
                  ? "Proveedor que cotiza"
                  : "Contratista que cotiza"}
              </span>

              <select
                name="proveedor_id"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                required
                style={ui.input}
              >
                <option value="">Seleccionar</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
                <option value={NUEVO}>
                  + Agregar {tipoProveedor.toLowerCase()} nuevo
                </option>
              </select>

              {agregandoNuevo && (
                <input
                  type="text"
                  name="proveedor_nuevo"
                  placeholder={
                    tipoProveedor === "Proveedor"
                      ? "Ej: Corralón Central"
                      : "Ej: Yesería Martínez"
                  }
                  required
                  autoFocus
                  style={{ ...ui.input, marginTop: "8px" }}
                />
              )}

            </div>

            {/* El número con el que el proveedor identifica su presupuesto.
                Va como texto porque no es un entero: lleva letras, barras y el
                año adentro. Es lo que después permite reconocer de qué papel
                salió una compra. */}
            <label style={field}>
              <span style={labelCampo}>
                Número de presupuesto <span style={opcional}>opcional</span>
              </span>
              <input
                type="text"
                name="numero"
                defaultValue={presupuesto?.numero ?? ""}
                placeholder="Ej: P-0012/26"
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Fecha de la cotización</span>
              <input
                type="date"
                name="fecha"
                defaultValue={presupuesto?.fecha ?? ""}
                required
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>
                Válida hasta <span style={opcional}>opcional</span>
              </span>
              <input
                type="date"
                name="validez_hasta"
                defaultValue={presupuesto?.validez_hasta ?? ""}
                style={ui.input}
              />
            </label>

            {/* Va en un `div` y no en un `label`: adentro hay una casilla que
                es su propio label, y anidarlos rompe a dónde va el clic. */}
            <div style={field}>
              <span style={labelCampo}>Monto cotizado</span>
              <input
                type="number"
                name="monto"
                min="0"
                step="0.01"
                placeholder="0"
                value={sumando ? (sumaItems || "") : monto}
                onChange={(e) => setMonto(e.target.value)}
                readOnly={sumando}
                required
                style={sumando ? montoCalculado : ui.input}
              />

              {/* Sólo en materiales: la mano de obra no tiene items que sumar. */}
              {tipo === "Materiales" && (
                <label style={casillaSuma}>
                  <input
                    type="checkbox"
                    name="monto_desde_items"
                    checked={desdeItems}
                    onChange={(e) => setDesdeItems(e.target.checked)}
                  />
                  Sumar los materiales cotizados
                </label>
              )}

              {sumando && (
                <span style={ayudaCampo}>
                  Sale del detalle de abajo, así que se actualiza solo al tocar
                  un renglón. Uno sin precio suma cero.
                </span>
              )}
            </div>

            <label style={field}>
              <span style={labelCampo}>Moneda</span>
              <select
                name="moneda"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                style={ui.input}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
              {moneda === "USD" && (
                <span style={ayudaCampo}>
                  {cotizacion
                    ? `Se guarda también en pesos al dólar de la fecha (hoy ≈ ${formatMoney(cotizacion)}).`
                    : "Se guarda también en pesos al dólar de la fecha."}
                </span>
              )}
            </label>

            <div style={fieldAncho}>
              <span style={labelCampo}>
                Detalle <span style={opcional}>opcional</span>
              </span>
              <input
                type="text"
                name="detalle"
                defaultValue={presupuesto?.detalle ?? ""}
                placeholder="Qué incluye y qué no: es lo que hace comparables dos cotizaciones"
                style={ui.input}
              />
            </div>

            {/* Un presupuesto de corralón **ya es** una lista de materiales
                con cantidades y precios: guardarlo como un monto solo era
                tirar casi todo el papel. Cargarlo acá no agrega trabajo —es
                transcribir lo que dice— y a cambio la compra lo trae hecho.

                Sólo en materiales: la mano de obra no se desglosa en items. */}
            {tipo === "Materiales" && (
              <div style={fieldAncho}>
                <span style={labelCampo}>Detallar materiales cotizados</span>
                <ItemsDeMaterial
                  materiales={materiales}
                  rubroId={rubroId}
                  slug={slug}
                  iniciales={itemsIniciales}
                  origen="presupuesto"
                  onTotal={setSumaItems}
                />
              </div>
            )}

            <div style={fieldAncho}>
              <span style={labelCampo}>
                Cotización en PDF <span style={opcional}>opcional</span>
              </span>

              {presupuesto?.comprobante_drive_id && !reemplazar ? (
                <div style={comprobanteActual}>
                  <span style={{ flex: 1 }}>
                    {presupuesto.comprobante_nombre ?? "Archivo cargado"}
                  </span>

                  <a
                    href={`/ver/${presupuesto.comprobante_drive_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={enlaceChico}
                  >
                    Ver
                  </a>

                  <button
                    type="button"
                    onClick={() => setReemplazar(true)}
                    style={ui.secondaryButton}
                  >
                    Reemplazar
                  </button>

                  <label style={quitarLabel}>
                    <input type="checkbox" name="quitar_comprobante" />
                    Quitar
                  </label>
                </div>
              ) : (
                <>
                  <input type="file" name="comprobante" style={ui.input} />
                  {/* Sólo cuando reemplaza: que el archivo viejo se pisa no se
                      deduce de ver el campo. */}
                  {presupuesto?.comprobante_drive_id && (
                    <span style={ayudaCampo}>
                      Al guardar reemplaza el archivo anterior.
                    </span>
                  )}
                </>
              )}
            </div>

            <label style={fieldAncho}>
              <span style={labelCampo}>
                Observaciones <span style={opcional}>opcional</span>
              </span>
              <textarea
                name="observaciones"
                defaultValue={presupuesto?.observaciones ?? ""}
                style={textarea}
              />
            </label>
          </div>
        </div>

        <div style={acciones}>
          <Link href={`/obras/${slug}/presupuestos`} style={ui.secondaryButton}>
            Cancelar
          </Link>

          <button type="submit" style={ui.button}>
            {textoBoton}
          </button>
        </div>
      </div>

      <aside style={resumen}>
        <p style={ui.eyebrow}>Cálculo automático</p>
        <h3 style={tituloResumen}>La cotización</h3>

        {moneda === "USD" && (
          <div style={filaDesglose}>
            <span>Cotizado en dólares</span>
            <span>US$ {ingresado.toLocaleString("es-AR")}</span>
          </div>
        )}

        <div style={filaDesglose}>
          <span>Qué se cotiza</span>
          <span>{tipo}</span>
        </div>

        <div style={filaTotal}>
          <span>{moneda === "USD" ? "Equivale a" : "Monto"}</span>
          <strong>{formatMoney(total)}</strong>
        </div>

      </aside>
    </form>
  );
}

const layout = {
  display: "grid",
  gridTemplateColumns: "1fr 360px",
  gap: "24px",
  alignItems: "start",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

// `alignContent: start` es lo que mantiene los campos alineados: sin eso, una
// celda con ayuda debajo estira a su vecina y el input de al lado queda
// flotando a media altura en vez de arrancar en la misma línea. Mismo criterio
// que en Editar obra → Datos lote.
const field = {
  display: "grid",
  gap: "8px",
  alignContent: "start" as const,
};

const fieldAncho = {
  ...field,
  gridColumn: "1 / -1",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const ayudaCampo = {
  fontSize: "13px",
  color: "#999999",
};

// "Opcional" al lado de la etiqueta y no en un renglón de ayuda debajo: dice lo
// mismo, no corre el campo de al lado y deja la ayuda para lo que de verdad hay
// que explicar.
const opcional = {
  color: "#aaaaaa",
  fontWeight: 400 as const,
};

const textarea = {
  ...ui.input,
  minHeight: "90px",
  resize: "vertical" as const,
};

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};

const resumen = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  position: "sticky" as const,
  top: "24px",
};

const tituloResumen = {
  fontSize: "20px",
  fontWeight: 400,
  margin: "12px 0 20px",
};

const filaDesglose = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "14px",
  color: "#666666",
  paddingTop: "8px",
};

const filaTotal = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "14px",
  marginTop: "10px",
};

const comprobanteActual = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  border: "1px solid #dcdcdc",
  padding: "10px 12px",
  fontSize: "14px",
  flexWrap: "wrap" as const,
};

const enlaceChico = {
  color: "#111111",
  fontSize: "14px",
};

// El monto calculado se ve distinto del que se escribe: gris de fondo, para
// que no se pierda el tiempo intentando tipear adentro.
const montoCalculado = {
  ...ui.input,
  background: "#f5f5f5",
  color: "#555555",
  cursor: "default" as const,
};

const casillaSuma = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  color: "#555555",
  cursor: "pointer",
};

const quitarLabel = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "14px",
  color: "#555555",
  cursor: "pointer",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
