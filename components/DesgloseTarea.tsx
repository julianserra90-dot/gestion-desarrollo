"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import InputMonto from "@/components/InputMonto";
import * as ui from "@/components/ui";
import { formatMoney } from "@/lib/format";

export type TipoRenglon = "Materiales" | "Mano de obra" | "Integrado";

export type RenglonInicial = {
  tipo: TipoRenglon;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio: number;
};

type Renglon = {
  /** Sólo para React: los renglones nuevos no tienen id de la base. */
  clave: string;
  tipo: TipoRenglon;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precio: string;
};

export type GuardarDesglose = (
  itemId: string,
  renglones: {
    tipo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio: number;
  }[],
  comoModelo: boolean
) => Promise<{ error?: string }>;

const TIPOS: TipoRenglon[] = ["Materiales", "Mano de obra", "Integrado"];

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

let siguiente = 0;
const nuevaClave = () => `n${siguiente++}`;

/**
 * El análisis de una tarea, desplegado dentro de su fila de la planilla.
 *
 * Los renglones van **por unidad de la tarea** —15 ladrillos por m² de muro—
 * y la última columna los multiplica por la cantidad computada, para ver lo
 * que suma en la obra. Así el análisis se arma una vez y sirve aunque
 * cambien los m².
 *
 * No es un formulario: vive adentro del de la planilla y se guarda solo, con
 * su botón, sin mandar las cantidades que se estén cargando en otras filas.
 */
export default function DesgloseTarea({
  itemId,
  unidadTarea,
  cantidadTarea,
  iniciales,
  puedeSerModelo,
  guardar,
  alGuardar,
}: {
  itemId: string;
  unidadTarea: string;
  cantidadTarea: number;
  iniciales: RenglonInicial[];
  /** Si la tarea viene del catálogo: sólo entonces tiene un modelo que pisar. */
  puedeSerModelo: boolean;
  guardar: GuardarDesglose;
  /** Para cerrar el desplegable cuando se guardó bien. */
  alGuardar?: () => void;
}) {
  const router = useRouter();
  const [renglones, setRenglones] = useState<Renglon[]>(() =>
    iniciales.map((r) => ({
      clave: nuevaClave(),
      tipo: r.tipo,
      descripcion: r.descripcion,
      unidad: r.unidad,
      cantidad: String(r.cantidad),
      precio: String(r.precio),
    }))
  );
  const [comoModelo, setComoModelo] = useState(false);
  const [error, setError] = useState("");
  const [guardando, iniciar] = useTransition();

  const cambiar = (clave: string, campo: keyof Renglon, valor: string) =>
    setRenglones((antes) =>
      antes.map((r) => (r.clave === clave ? { ...r, [campo]: valor } : r))
    );

  const agregar = (tipo: TipoRenglon) =>
    setRenglones((antes) => [
      ...antes,
      {
        clave: nuevaClave(),
        tipo,
        descripcion: "",
        unidad: tipo === "Mano de obra" ? "h" : "u",
        cantidad: "",
        precio: "",
      },
    ]);

  const quitar = (clave: string) =>
    setRenglones((antes) => antes.filter((r) => r.clave !== clave));

  const subtotal = (r: Renglon) => num(r.cantidad) * num(r.precio);
  const porTipo = (tipo: TipoRenglon) =>
    renglones.filter((r) => r.tipo === tipo).reduce((a, r) => a + subtotal(r), 0);
  const porUnidad = renglones.reduce((a, r) => a + subtotal(r), 0);

  const enviar = () =>
    iniciar(async () => {
      const r = await guardar(
        itemId,
        renglones.map((x) => ({
          tipo: x.tipo,
          descripcion: x.descripcion,
          unidad: x.unidad,
          cantidad: num(x.cantidad),
          precio: num(x.precio),
        })),
        comoModelo
      );
      if (r.error) {
        setError(r.error);
        return;
      }
      setError("");
      router.refresh();
      alGuardar?.();
    });

  return (
    <div style={caja}>
      <div style={resumen}>
        {TIPOS.map((t) => (
          <span key={t} style={dato}>
            <span style={ui.label}>
              {t} por {unidadTarea}
            </span>
            <strong>{formatMoney(porTipo(t))}</strong>
          </span>
        ))}
        <span style={dato}>
          <span style={ui.label}>Total por {unidadTarea}</span>
          <strong>{formatMoney(porUnidad)}</strong>
        </span>
        <span style={dato}>
          <span style={ui.label}>
            En la obra ({cantidadTarea.toLocaleString("es-AR")} {unidadTarea})
          </span>
          <strong>{formatMoney(porUnidad * cantidadTarea)}</strong>
        </span>
      </div>

      {renglones.length === 0 ? (
        <p style={vacio}>Sin desglose: la tarea no suma nada todavía.</p>
      ) : (
        <div style={scroll}>
          <table style={tabla}>
            <thead>
              <tr>
                <th style={thIzq}>Tipo</th>
                <th style={thIzq}>Descripción</th>
                <th style={thCentro}>Unidad</th>
                <th style={thCentro}>Cant. por {unidadTarea}</th>
                <th style={thCentro}>Precio unit.</th>
                <th style={thDer}>Por {unidadTarea}</th>
                <th style={thDer}>En la obra</th>
                <th style={thIzq} />
              </tr>
            </thead>
            <tbody>
              {renglones.map((r) => (
                <tr key={r.clave}>
                  <td style={celda}>
                    <select
                      value={r.tipo}
                      onChange={(e) => cambiar(r.clave, "tipo", e.target.value)}
                      style={{ ...inputBase, width: "140px", textAlign: "left" }}
                    >
                      {TIPOS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={celda}>
                    <input
                      type="text"
                      value={r.descripcion}
                      onChange={(e) => cambiar(r.clave, "descripcion", e.target.value)}
                      placeholder={ejemplo(r.tipo)}
                      style={{ ...inputBase, textAlign: "left", minWidth: "220px" }}
                    />
                  </td>
                  <td style={celdaCentro}>
                    <input
                      type="text"
                      value={r.unidad}
                      onChange={(e) => cambiar(r.clave, "unidad", e.target.value)}
                      style={{ ...inputBase, width: "64px", textAlign: "center" }}
                    />
                  </td>
                  <td style={celdaCentro}>
                    <input
                      type="number"
                      value={r.cantidad}
                      min={0}
                      step="any"
                      placeholder="0"
                      onChange={(e) => cambiar(r.clave, "cantidad", e.target.value)}
                      style={{ ...inputBase, width: "100px" }}
                    />
                  </td>
                  <td style={celdaCentro}>
                    <InputMonto
                      value={r.precio}
                      onChange={(x) => cambiar(r.clave, "precio", x)}
                      style={{ ...inputBase, width: "130px" }}
                    />
                  </td>
                  <td style={celdaNumero}>{formatMoney(subtotal(r))}</td>
                  <td style={celdaTotal}>{formatMoney(subtotal(r) * cantidadTarea)}</td>
                  <td style={celda}>
                    <button
                      type="button"
                      onClick={() => quitar(r.clave)}
                      style={botonQuitar}
                      aria-label="Quitar renglón"
                      title="Quitar renglón"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={pie}>
        <div style={agregarFila}>
          {TIPOS.map((t) => (
            <button key={t} type="button" onClick={() => agregar(t)} style={botonAgregar}>
              + {t}
            </button>
          ))}
        </div>

        <div style={guardarFila}>
          {/* Para que el próximo revoque no arranque de la referencia de
              Cifras sino de cal, cemento y arena. Apagado por defecto: un
              ajuste de esta obra no tiene por qué ser el de todas. */}
          {puedeSerModelo && (
            <label style={casillaModelo}>
              <input
                type="checkbox"
                checked={comoModelo}
                onChange={(e) => setComoModelo(e.target.checked)}
              />
              Usar también como modelo para otras obras
            </label>
          )}
          <button type="button" onClick={enviar} disabled={guardando} style={botonGuardar}>
            {guardando ? "Guardando…" : "Guardar desglose"}
          </button>
        </div>
      </div>

      {error && <p style={textoError}>{error}</p>}
    </div>
  );
}

function ejemplo(tipo: TipoRenglon) {
  if (tipo === "Materiales") return "Ej: Ladrillo hueco 12x18x33";
  if (tipo === "Mano de obra") return "Ej: Oficial albañil";
  return "Ej: Gráfica ploteada y colocada";
}

const caja = {
  background: "#fafafa",
  border: "1px solid #eeeeee",
  borderRadius: "12px",
  padding: "18px 20px",
  margin: "4px 0 12px",
};

const resumen = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "28px",
  marginBottom: "14px",
};

const dato = {
  display: "grid",
  gap: "6px",
  fontSize: "15px",
};

const vacio = {
  ...ui.note,
  margin: "0 0 8px",
};

const scroll = {
  overflowX: "auto" as const,
};

const tabla = {
  ...ui.table,
  minWidth: "900px",
};

const celda = {
  borderBottom: "1px solid #eeeeee",
  padding: "6px 8px",
  fontSize: "14px",
};

// Los campos que se escriben, centrados bajo su título.
const celdaCentro = {
  ...celda,
  textAlign: "center" as const,
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

// Mismo relleno lateral que las celdas, para que cada columna quede debajo de
// su rótulo.
const thIzq = {
  ...ui.th,
  padding: "10px 8px",
};

const thCentro = {
  ...thIzq,
  textAlign: "center" as const,
};

const thDer = {
  ...thIzq,
  textAlign: "right" as const,
};

const inputBase = {
  ...ui.input,
  padding: "7px 10px",
  textAlign: "right" as const,
};

const botonQuitar = {
  background: "none",
  border: "none",
  color: "#999999",
  fontSize: "18px",
  cursor: "pointer",
  padding: "0 6px",
};

const pie = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap" as const,
  marginTop: "14px",
};

const agregarFila = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const botonAgregar = {
  ...ui.secondaryButton,
  padding: "7px 12px",
  fontSize: "13px",
};

const guardarFila = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap" as const,
};

const botonGuardar = {
  ...ui.button,
  padding: "8px 14px",
  fontSize: "13px",
};

const casillaModelo = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  color: "#555555",
  cursor: "pointer",
};

const textoError = {
  color: ui.ROJO,
  fontSize: "13px",
  margin: "10px 0 0",
};
