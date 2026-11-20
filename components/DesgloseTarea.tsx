"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import InputMonto from "@/components/InputMonto";
import {
  cantidadDesdeConsumo,
  consumoDesdeCantidad,
  envaseDelRenglon,
  mismaUnidad,
  unidadesDeConsumo,
  type Envase,
} from "@/lib/consumo";
import SelectorMaterial, { type MaterialOpcion } from "@/components/SelectorMaterial";
import * as ui from "@/components/ui";
import SelectorUnidad from "@/components/SelectorUnidad";
import { formatMoney } from "@/lib/format";

export type TipoRenglon = "Materiales" | "Mano de obra" | "Integrado";

export type CotizacionDelRenglon = {
  estado: string;
  /** Lo cotizado para la obra entera, no por unidad. */
  monto: number;
  proveedor: string | null;
};

export type RenglonInicial = {
  tipo: TipoRenglon;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio: number;
  materialId: string | null;
  /** El consumo enunciado (18, de 18 kg por m²), si se cargó así. */
  consumo: number | null;
  consumoUnidad: string | null;
  presupuestoId: string | null;
  usarCotizado: boolean;
  cotizacion: CotizacionDelRenglon | null;
};

type Renglon = {
  /** Sólo para React: los renglones nuevos no tienen id de la base. */
  clave: string;
  tipo: TipoRenglon;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precio: string;
  /** El material del catálogo, cuando el renglón es uno. */
  materialId: string | null;
  /**
   * El consumo enunciado y su unidad: 18 y "kg", de 18 kg por m². Mientras
   * estén puestos, `cantidad` es el resultado de dividirlos por lo que trae
   * el envase, y se mantiene al día en cada tecla: todo lo demás —subtotales,
   * cotizaciones, lo que se guarda— sigue leyendo la cantidad y nada más.
   */
  consumo: string;
  consumoUnidad: string;
  /** Sólo para la pantalla: si la subtarea se escribe en vez de elegirse. */
  aMano: boolean;
  presupuestoId: string | null;
  /** La casilla "Cotización". */
  cotizar: boolean;
  usarCotizado: boolean;
  cotizacion: CotizacionDelRenglon | null;
};

export type GuardarDesglose = (
  itemId: string,
  renglones: {
    tipo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio: number;
    materialId: string | null;
    consumo: number | null;
    consumoUnidad: string | null;
    presupuestoId: string | null;
    cotizar: boolean;
    usarCotizado: boolean;
  }[],
  comoModelo: boolean
) => Promise<{ error?: string }>;

const TIPOS: TipoRenglon[] = ["Materiales", "Mano de obra", "Integrado"];

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const cantidadAR = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });

/** Los decimales que la base guarda de una cantidad: más no se escriben. */
const cuatroDecimales = (n: number) => Math.round(n * 10000) / 10000;

/** Ya tiene proveedor y precio: no es un pedido ni se descartó. */
const conPrecio = (c: CotizacionDelRenglon | null): c is CotizacionDelRenglon =>
  Boolean(c && (c.estado === "Pendiente" || c.estado === "Aprobado"));

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
  unidadesUsadas = [],
  materiales = [],
  rubroNombre = "",
}: {
  /** El catálogo, para atar un renglón de materiales a su ficha. */
  materiales?: MaterialOpcion[];
  /** El rubro de la tarea: el selector lo abre primero. */
  rubroNombre?: string;
  /** Las unidades ya usadas en la obra, para ofrecer las agregadas a mano. */
  unidadesUsadas?: string[];
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
      materialId: r.materialId,
      consumo: r.consumo === null ? "" : String(r.consumo),
      consumoUnidad: r.consumoUnidad ?? "",
      // Lo que ya estaba escrito y no apunta al catálogo arranca a mano: si no,
      // se vería "Elegí el material" encima de un renglón que ya tiene nombre.
      aMano: r.materialId === null,
      presupuestoId: r.presupuestoId,
      cotizar: r.presupuestoId !== null,
      usarCotizado: r.usarCotizado,
      cotizacion: r.cotizacion,
    }))
  );
  const [comoModelo, setComoModelo] = useState(false);
  const [error, setError] = useState("");
  const [guardando, iniciar] = useTransition();

  const aplicar = (clave: string, cambios: Partial<Renglon>) =>
    setRenglones((antes) =>
      antes.map((r) => (r.clave === clave ? { ...r, ...cambios } : r))
    );

  const cambiar = (clave: string, campo: keyof Renglon, valor: string | boolean) =>
    aplicar(clave, { [campo]: valor } as Partial<Renglon>);

  // Una sola forma de agregar: el tipo se elige en la fila, como cualquier
  // otro dato de la subtarea.
  const agregar = () =>
    setRenglones((antes) => [
      ...antes,
      {
        clave: nuevaClave(),
        tipo: "Materiales",
        descripcion: "",
        unidad: "un",
        cantidad: "",
        precio: "",
        materialId: null,
        consumo: "",
        consumoUnidad: "",
        aMano: false,
        presupuestoId: null,
        cotizar: false,
        usarCotizado: false,
        cotizacion: null,
      },
    ]);

  const quitar = (clave: string) =>
    setRenglones((antes) => antes.filter((r) => r.clave !== clave));

  // Atar un renglón al catálogo le pone también el nombre y la unidad del
  // material: que los dos digan lo mismo es el punto de atarlo, y es lo que
  // deja que el listado de materiales sume el mismo ladrillo una sola vez.
  const elegirMaterial = (clave: string, id: string) => {
    const m = materiales.find((x) => x.id === id);
    if (!m) return;
    setRenglones((antes) =>
      antes.map((r) =>
        r.clave === clave
          ? {
              ...r,
              materialId: m.id,
              descripcion: m.nombre,
              unidad: m.unidad,
              // Otro material es otro envase: un consumo en kg de la bolsa
              // anterior no quiere decir nada acá.
              consumo: "",
              consumoUnidad: "",
            }
          : r
      )
    );
  };

// Pasar a mano suelta el material y deja el nombre puesto: no todo lo que
  // entra en un desglose merece una ficha en el catálogo. Volver al catálogo
  // no borra nada; lo que se escribió se pisa recién al elegir un material.
  const alternarModo = (clave: string) =>
    setRenglones((antes) =>
      antes.map((r) =>
        r.clave === clave
          ? { ...r, aMano: !r.aMano, materialId: null, consumo: "", consumoUnidad: "" }
          : r
      )
    );

  // El envase que se le puede aplicar a un renglón, buscado en el catálogo.
  // Sin material —o con la unidad del renglón cambiada a otra cosa— no hay
  // envase, y la celda de cantidad es la de siempre.
  const envaseDe = (r: Renglon): Envase | null => {
    const m = r.materialId ? materiales.find((x) => x.id === r.materialId) : undefined;
    return envaseDelRenglon(
      r.unidad,
      m
        ? {
            unidad: m.unidad,
            contenido: m.contenido ?? null,
            contenidoUnidad: m.contenidoUnidad ?? null,
          }
        : null
    );
  };

  // Lo que se guarda del consumo. Sólo cuenta si hay envase y la unidad
  // elegida no es la del renglón: si es la misma, el número de la celda es la
  // cantidad a secas y no hay nada que explicar.
  const declarado = (r: Renglon) => {
    const envase = envaseDe(r);
    const unidades = envase ? unidadesDeConsumo(envase) : [];
    const elegida = unidades.find((u) => mismaUnidad(u, r.consumoUnidad));
    return unidades.length > 1 && elegida && !mismaUnidad(elegida, r.unidad)
      ? { consumo: num(r.consumo), consumoUnidad: elegida }
      : { consumo: null, consumoUnidad: null };
  };

  const computado = (r: Renglon) => num(r.cantidad) * num(r.precio);
  // Lo que suma por unidad de la tarea. Si se eligió lo cotizado, la
  // cotización es por la obra entera y se reparte en la cantidad computada.
  const usaCotizado = (r: Renglon) =>
    r.cotizar && r.usarCotizado && conPrecio(r.cotizacion) && cantidadTarea > 0;
  const subtotal = (r: Renglon) =>
    usaCotizado(r) ? r.cotizacion!.monto / cantidadTarea : computado(r);
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
          materialId: x.materialId,
          ...declarado(x),
          presupuestoId: x.presupuestoId,
          cotizar: x.cotizar,
          usarCotizado: x.usarCotizado,
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
                <th style={thIzq}>Subtarea</th>
                <th style={thCentro}>Unidad</th>
                <th style={thCentro}>Cant. por {unidadTarea}</th>
                <th style={thCentro}>Precio unit.</th>
                <th style={thDer}>Por {unidadTarea}</th>
                <th style={thDer}>En la obra</th>
                <th style={thIzq}>Cotización</th>
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
                    {r.tipo === "Materiales" && materiales.length > 0 ? (
                      // Un solo control, del alto de los demás: o se elige del
                      // catálogo o se escribe, y el botón de al lado cambia de
                      // uno a otro. Apilar los dos hacía la fila el doble de
                      // alta que las vecinas y se leía peor.
                      <div style={celdaMaterial}>
                        <div style={{ flex: 1, minWidth: "180px" }}>
                          {r.aMano ? (
                            <input
                              type="text"
                              value={r.descripcion}
                              onChange={(e) =>
                                cambiar(r.clave, "descripcion", e.target.value)
                              }
                              placeholder={ejemplo(r.tipo)}
                              style={{ ...inputBase, textAlign: "left", width: "100%" }}
                            />
                          ) : (
                            <SelectorMaterial
                              name={`material_${r.clave}`}
                              materiales={materiales}
                              rubroNombre={rubroNombre}
                              value={r.materialId ?? ""}
                              onChange={(id) => elegirMaterial(r.clave, id)}
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => alternarModo(r.clave)}
                          style={botonModo}
                          title={
                            r.aMano
                              ? "Elegirlo del catálogo de materiales"
                              : "Escribirlo a mano"
                          }
                          aria-label={
                            r.aMano
                              ? "Elegirlo del catálogo de materiales"
                              : "Escribirlo a mano"
                          }
                        >
                          {r.aMano ? "⌕" : "✎"}
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={r.descripcion}
                        onChange={(e) => cambiar(r.clave, "descripcion", e.target.value)}
                        placeholder={ejemplo(r.tipo)}
                        style={{ ...inputBase, textAlign: "left", minWidth: "220px" }}
                      />
                    )}
                  </td>
                  <td style={celdaCentro}>
                    <SelectorUnidad
                      value={r.unidad}
                      onChange={(u) => cambiar(r.clave, "unidad", u)}
                      extras={[...unidadesUsadas, ...renglones.map((x) => x.unidad)]}
                      corto
                      style={{ ...inputBase, width: "100px", textAlign: "left" }}
                    />
                  </td>
                  <td style={celdaCentro}>
                    <CeldaCantidad
                      renglon={r}
                      envase={envaseDe(r)}
                      aplicar={(cambios) => aplicar(r.clave, cambios)}
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
                  <td style={celdaTotal}>
                    {formatMoney(subtotal(r) * cantidadTarea)}
                    {usaCotizado(r) && <span style={marcaCotizado}>cotizado</span>}
                  </td>
                  <td style={celda}>
                    <CeldaCotizacion
                      renglon={r}
                      computadoEnObra={computado(r) * cantidadTarea}
                      alTildar={(v) => cambiar(r.clave, "cotizar", v)}
                      alElegir={(v) => cambiar(r.clave, "usarCotizado", v)}
                    />
                  </td>
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
          <button type="button" onClick={agregar} style={botonAgregar}>
            + Agregar subtarea
          </button>
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

/**
 * La casilla para pedir cotización y, cuando ya llegó, la elección entre lo
 * computado y lo cotizado.
 */
function CeldaCotizacion({
  renglon: r,
  computadoEnObra,
  alTildar,
  alElegir,
}: {
  renglon: Renglon;
  computadoEnObra: number;
  alTildar: (v: boolean) => void;
  alElegir: (v: boolean) => void;
}) {
  const c = r.cotizacion;
  const vinculada = r.cotizar && r.presupuestoId !== null;

  let estado: React.ReactNode = null;
  if (r.cotizar && !vinculada) {
    estado = <span style={notaCotizacion}>Se pide al guardar</span>;
  } else if (vinculada && c?.estado === "A cotizar") {
    estado = <span style={etiquetaPedido}>A cotizar</span>;
  } else if (vinculada && c?.estado === "Descartado") {
    estado = <span style={notaCotizacion}>Descartada</span>;
  }

  return (
    <div style={celdaCotizacionCaja}>
      <label style={casillaCotizar} title="Pedir cotización de esta subtarea">
        <input type="checkbox" checked={r.cotizar} onChange={(e) => alTildar(e.target.checked)} />
        {estado}
      </label>

      {vinculada && conPrecio(c) && (
        // Lo cotizado al lado de lo computado, y se elige con cuál se queda
        // el cómputo. Un clic en el que no está elegido lo cambia.
        <div style={eleccion} role="radiogroup" aria-label="Precio que usa el cómputo">
          <button
            type="button"
            role="radio"
            aria-checked={!r.usarCotizado}
            onClick={() => alElegir(false)}
            style={!r.usarCotizado ? opcionElegida : opcion}
          >
            Computado {formatMoney(computadoEnObra)}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={r.usarCotizado}
            onClick={() => alElegir(true)}
            style={r.usarCotizado ? opcionElegida : opcion}
            title={c.proveedor ?? undefined}
          >
            Cotizado {formatMoney(c.monto)}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * El número que entra por unidad de la tarea.
 *
 * Cuando el renglón apunta a un material que declara su envase hay dos formas
 * de decir lo mismo, y la celda deja elegir con qué unidad se carga: **0,6
 * bolsa** o **18 kg**. En kg se guarda el 18 y la cantidad en bolsas se
 * deriva: acá para mostrarla, y otra vez en el servidor, que es el que decide.
 * Así el renglón se puede verificar contra la ficha del producto —que habla en
 * kg— y el día que la bolsa pase a 25 kg se rehace solo.
 *
 * Sin envase que aplicar es el campo de cantidad de siempre.
 */
function CeldaCantidad({
  renglon: r,
  envase,
  aplicar,
}: {
  renglon: Renglon;
  envase: Envase | null;
  aplicar: (cambios: Partial<Renglon>) => void;
}) {
  const unidades = envase ? unidadesDeConsumo(envase) : [];

  if (!envase || unidades.length < 2) {
    return (
      <input
        type="number"
        value={r.cantidad}
        min={0}
        step="any"
        placeholder="0"
        onChange={(e) =>
          aplicar({ cantidad: e.target.value, consumo: "", consumoUnidad: "" })
        }
        style={{ ...inputBase, width: "100px" }}
      />
    );
  }

  const elegida = unidades.find((u) => mismaUnidad(u, r.consumoUnidad)) ?? r.unidad;
  const enConsumo = !mismaUnidad(elegida, r.unidad);
  const derivada = enConsumo ? cantidadDesdeConsumo(num(r.consumo), elegida, envase) : null;

  // En kg se guarda el 18 y la cantidad derivada queda al día en cada tecla:
  // el subtotal de la fila, lo que suma en la obra y lo que se manda al
  // guardar siguen leyendo la cantidad y nada más.
  const escribir = (valor: string) => {
    if (!enConsumo) {
      aplicar({ cantidad: valor, consumo: "", consumoUnidad: "" });
      return;
    }
    const cantidad = cantidadDesdeConsumo(num(valor), elegida, envase);
    aplicar({
      consumo: valor,
      consumoUnidad: elegida,
      cantidad: valor.trim() === "" || cantidad === null ? "" : String(cantidad),
    });
  };

  // Cambiar de unidad no pierde lo escrito: 0,6 bolsa pasa a 18 kg y al revés,
  // en vez de quedar como 0,6 kg.
  const cambiarUnidad = (u: string) => {
    if (mismaUnidad(u, r.unidad)) {
      aplicar({ consumo: "", consumoUnidad: "" });
      return;
    }
    const c = consumoDesdeCantidad(num(r.cantidad), u, envase);
    aplicar({ consumoUnidad: u, consumo: c === null ? "" : String(cuatroDecimales(c)) });
  };

  return (
    <span style={celdaConsumo}>
      <input
        type="number"
        value={enConsumo ? r.consumo : r.cantidad}
        min={0}
        step="any"
        placeholder="0"
        onChange={(e) => escribir(e.target.value)}
        style={{ ...inputBase, width: "72px" }}
      />
      <select
        value={elegida}
        onChange={(e) => cambiarUnidad(e.target.value)}
        style={selectUnidadConsumo}
        aria-label="Unidad en la que se carga el consumo"
        title={`El envase trae ${envase.contenido} ${envase.contenidoUnidad}`}
      >
        {unidades.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      {enConsumo && (
        <span style={notaDerivada}>
          {derivada === null ? "—" : `= ${cantidadAR.format(derivada)} ${r.unidad}`}
        </span>
      )}
    </span>
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
  // Más ancha que antes: la columna de cantidad lleva su unidad al lado y, en
  // kg, la cantidad derivada. Todo en una línea, para que la fila mida lo
  // mismo que las vecinas.
  minWidth: "1180px",
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

const marcaCotizado = {
  display: "block",
  fontSize: "10px",
  fontWeight: 600,
  color: "#888888",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const celdaCotizacionCaja = {
  display: "grid",
  gap: "6px",
  minWidth: "150px",
};

const casillaCotizar = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
};

const notaCotizacion = {
  fontSize: "12px",
  color: "#888888",
};

const etiquetaPedido = {
  fontSize: "11px",
  fontWeight: 600,
  background: "#fff4d6",
  color: "#8a5a00",
  borderRadius: "999px",
  padding: "2px 8px",
};

const eleccion = {
  display: "inline-flex",
  flexDirection: "column" as const,
  gap: "4px",
};

const opcion = {
  background: "#ffffff",
  border: "1px solid #dddddd",
  borderRadius: "8px",
  padding: "4px 8px",
  fontSize: "12px",
  color: "#777777",
  cursor: "pointer",
  textAlign: "left" as const,
  whiteSpace: "nowrap" as const,
};

const opcionElegida = {
  ...opcion,
  background: "#111111",
  borderColor: "#111111",
  color: "#ffffff",
  fontWeight: 600,
};

// El control y, al lado, el botón que cambia de modo. En fila y no apilados:
// la celda tiene que medir lo mismo que las vecinas.
const celdaMaterial = {
  display: "flex",
  gap: "6px",
  alignItems: "center",
  minWidth: "220px",
};

const botonModo = {
  background: "none",
  border: "1px solid #dddddd",
  borderRadius: "6px",
  width: "30px",
  height: "30px",
  flexShrink: 0,
  cursor: "pointer",
  fontSize: "14px",
  color: "#777777",
  lineHeight: 1,
};

// El número, su unidad y la cantidad que sale de convertirlo, en una línea.
const celdaConsumo = {
  display: "inline-flex",
  gap: "6px",
  alignItems: "center",
  whiteSpace: "nowrap" as const,
};

const selectUnidadConsumo = {
  ...inputBase,
  width: "76px",
  textAlign: "left" as const,
  padding: "7px 4px",
};

const notaDerivada = {
  fontSize: "12px",
  color: "#888888",
  whiteSpace: "nowrap" as const,
};
