"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import SignoDelPlano, { AMBAR } from "@/components/SignoDelPlano";
import * as ui from "@/components/ui";
import {
  cantidadDeElemento,
  FORMAS,
  leFaltaMedida,
  medidasDe,
  totalDeMedicion,
  type Forma,
} from "@/lib/medicion";

export type ElementoInicial = {
  /** De dónde salió. Sin decirlo, es de mano: lo pegado desde Excel. */
  origen?: "mano" | "plano";
  nivel: string | null;
  etiqueta: string | null;
  forma: Forma;
  a: number | null;
  b: number | null;
  c: number | null;
  unidades: number;
};

export type ElementoAGuardar = {
  nivel: string | null;
  etiqueta: string | null;
  forma: string;
  a: number | null;
  b: number | null;
  c: number | null;
  unidades: number;
};

export type LeerMedicion = (
  itemId: string
) => Promise<{ elementos?: ElementoInicial[]; error?: string }>;

export type GuardarMedicion = (
  itemId: string,
  elementos: ElementoAGuardar[]
) => Promise<{ error?: string; cantidad?: number }>;

type Fila = {
  /** Sólo para React: las filas no tienen id de la base mientras se editan. */
  clave: string;
  /**
   * A qué bloque pertenece.
   *
   * Es una clave propia y no el nombre del nivel: dos bloques recién creados
   * se llaman los dos "" y agruparlos por el texto los fundiría en uno, que es
   * justo lo que no se quiere al empezar a separar los pisos.
   */
  grupo: string;
  etiqueta: string;
  forma: Forma;
  a: string;
  b: string;
  c: string;
  unidades: string;
};

type Grupo = { clave: string; nivel: string; filas: Fila[] };

let siguiente = 0;
const nuevaClave = () => `m${siguiente++}`;

const texto = (v: string | null) => v ?? "";
const numero = (v: number | null) => (v === null ? "" : String(v));

const num = (v: string): number | null => {
  const limpio = v.trim();
  if (!limpio) return null;
  const n = Number(limpio.includes(",") ? limpio.split(",").join(".") : limpio);
  return Number.isFinite(n) ? n : null;
};

const comoElemento = (f: Fila) => ({
  forma: f.forma,
  a: num(f.a),
  b: num(f.b),
  c: num(f.c),
  unidades: num(f.unidades) ?? 1,
});

const cantidadAR = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

/** A partir de acá la lista no entra en una pantalla y conviene plegarla. */
const MUCHOS = 24;

/**
 * La medición de una tarea, desplegada dentro de su fila de la planilla.
 *
 * Cada fila es un elemento medido —la viga V-201, de 0,12 x 0,45 x 4,49— y la
 * cantidad de la tarea es la suma. Hasta ahora esa cuenta vivía en una planilla
 * aparte: el cómputo mostraba 22,28 m³ y no había forma de revisar de dónde
 * salían.
 *
 * Los elementos van **en bloques por nivel**, con su nombre y su subtotal
 * arriba, porque es como se piensa y se revisa una estructura: las vigas de
 * sobre planta baja juntas, y abajo las de sobre el primero. Ciento treinta y
 * dos vigas en una lista corrida, con el piso repetido en cada renglón, no hay
 * forma de controlarlas contra el plano.
 *
 * Los elementos se piden al abrir y no vienen con la planilla: pueden ser
 * doscientos cincuenta y pico y casi nunca se miran.
 *
 * Lo que **vino del plano** va aparte, arriba, y no se edita: son los
 * renglones que midió el dibujo de las plantas, uno por piso, y se corrigen
 * en el dibujo. Suman a la cantidad igual que los de mano; si los dos miden
 * lo mismo la tarea queda contada dos veces, y eso se avisa.
 *
 * No es un formulario: vive adentro del de la planilla y se guarda solo, con
 * su botón, sin mandar las cantidades que se estén cargando en otras filas.
 */
export default function MedicionTarea({
  itemId,
  unidadTarea,
  cantidadTarea,
  leer,
  guardar,
  alGuardar,
  enEl3D,
}: {
  /**
   * Adónde se ve lo que midió el plano: el 3D abierto en esta tarea. Cada
   * renglón le suma su piso, y si es una pieza de la estructura, la pieza.
   */
  enEl3D?: string;
  itemId: string;
  unidadTarea: string;
  /** La cantidad que hoy tiene la tarea, para avisar si la medición la cambia. */
  cantidadTarea: number;
  leer: LeerMedicion;
  guardar: GuardarMedicion;
  /** Con la cantidad que quedó, para que la planilla la muestre sin recargar. */
  alGuardar?: (cantidad: number) => void;
}) {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  /** Lo que midió el plano: se muestra, no se toca. */
  const [delPlano, setDelPlano] = useState<ElementoInicial[]>([]);
  const [niveles, setNiveles] = useState<Record<string, string>>({});
  /**
   * Los bloques plegados.
   *
   * Una medición de verdad es grande: las ciento treinta y dos vigas de este
   * edificio ocupan ocho pantallas y ochocientos campos, y abajo de todo eso
   * siguen las demás tareas de la planilla. Plegados, los cinco pisos entran
   * en uno y se ve lo que uno quiere ver —cuánto lleva cada nivel— sin tener
   * que recorrer nada.
   */
  const [plegados, setPlegados] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [guardando, iniciar] = useTransition();

  useEffect(() => {
    let vigente = true;
    leer(itemId).then((r) => {
      if (!vigente) return;
      if (r.error) {
        setError(r.error);
        setFilas([]);
        return;
      }
      const todos = r.elementos ?? [];
      const { filas, niveles } = agrupar(todos.filter((e) => e.origen !== "plano"));
      setDelPlano(todos.filter((e) => e.origen === "plano"));
      setFilas(filas);
      setNiveles(niveles);
      // Una medición cargada llega plegada; una que se está armando, no. El
      // corte está en lo que entra en una pantalla.
      if (filas.length > MUCHOS) setPlegados(new Set(filas.map((f) => f.grupo)));
    });
    return () => {
      vigente = false;
    };
  }, [itemId, leer]);

  if (filas === null) {
    return (
      <div style={caja}>
        <p style={ui.note}>Buscando la medición…</p>
      </div>
    );
  }

  const aplicar = (clave: string, cambios: Partial<Fila>) =>
    setFilas((antes) =>
      (antes ?? []).map((f) => (f.clave === clave ? { ...f, ...cambios } : f))
    );

  const filaNueva = (grupo: string): Fila => ({
    clave: nuevaClave(),
    grupo,
    etiqueta: "",
    forma: "prisma",
    a: "",
    b: "",
    c: "",
    unidades: "1",
  });

  /**
   * Un elemento va al final de su bloque, no al final de todo: si no, al
   * agregarle una viga a planta baja aparecería abajo de la terraza.
   */
  const desplegar = (grupo: string) =>
    setPlegados((antes) => {
      const nuevo = new Set(antes);
      nuevo.delete(grupo);
      return nuevo;
    });

  const alternarPlegado = (grupo: string) =>
    setPlegados((antes) => {
      const nuevo = new Set(antes);
      if (nuevo.has(grupo)) nuevo.delete(grupo);
      else nuevo.add(grupo);
      return nuevo;
    });

  const agregarEn = (grupo: string) => {
    // Agregarle un elemento a un bloque plegado y no mostrárselo sería
    // agregarlo en ningún lado.
    desplegar(grupo);
    setFilas((antes) => {
      const lista = [...(antes ?? [])];
      let ultimo = -1;
      lista.forEach((f, i) => {
        if (f.grupo === grupo) ultimo = i;
      });
      lista.splice(ultimo + 1, 0, filaNueva(grupo));
      return lista;
    });
  };

  const agregarNivel = () => {
    const grupo = nuevaClave();
    setNiveles((antes) => ({ ...antes, [grupo]: "" }));
    setFilas((antes) => [...(antes ?? []), filaNueva(grupo)]);
  };

  const renombrar = (grupo: string, nombre: string) =>
    setNiveles((antes) => ({ ...antes, [grupo]: nombre }));

  const quitar = (clave: string) =>
    setFilas((antes) => (antes ?? []).filter((f) => f.clave !== clave));

  // Los bloques, en el orden en que aparece su primer elemento.
  const grupos: Grupo[] = [];
  for (const f of filas) {
    const ya = grupos.find((g) => g.clave === f.grupo);
    if (ya) ya.filas.push(f);
    else grupos.push({ clave: f.grupo, nivel: niveles[f.grupo] ?? "", filas: [f] });
  }

  const totalDelPlano = totalDeMedicion(delPlano);
  const total = totalDeMedicion(filas.map(comoElemento)) + totalDelPlano;
  const sinMedir =
    filas.map(comoElemento).filter(leFaltaMedida).length + delPlano.filter(leFaltaMedida).length;

  const enviar = () =>
    iniciar(async () => {
      const r = await guardar(
        itemId,
        grupos.flatMap((g) =>
          g.filas.map((f) => ({
            nivel: g.nivel.trim() || null,
            etiqueta: f.etiqueta.trim() || null,
            forma: f.forma,
            a: num(f.a),
            b: num(f.b),
            c: num(f.c),
            unidades: num(f.unidades) ?? 1,
          }))
        )
      );
      if (r.error) {
        setError(r.error);
        return;
      }
      setError("");
      router.refresh();
      alGuardar?.(r.cantidad ?? total);
    });

  return (
    <div style={caja}>
      <div style={resumen}>
        <span style={dato}>
          <span style={ui.label}>Cantidad de la tarea</span>
          <strong>
            {cantidadAR.format(total)} {unidadTarea}
          </strong>
        </span>
        <span style={dato}>
          <span style={ui.label}>Elementos</span>
          <strong>{filas.length + delPlano.length}</strong>
        </span>
        {sinMedir > 0 && (
          <span style={dato}>
            <span style={ui.label}>Sin medir</span>
            <strong style={{ color: ui.ROJO }}>{sinMedir}</strong>
          </span>
        )}
      </div>

      {filas.length + delPlano.length > 0 && Math.abs(total - cantidadTarea) > 0.0005 && (
        <p style={notaCambio}>
          Al guardar, la cantidad de la tarea pasa de {cantidadAR.format(cantidadTarea)} a{" "}
          {cantidadAR.format(total)} {unidadTarea}.
        </p>
      )}

      {delPlano.length > 0 && (
        <div style={cajaDelPlano}>
          <div style={cabezaDelPlano}>
            <p style={tituloDelPlano}>
              <SignoDelPlano /> Del plano · {cantidadAR.format(totalDelPlano)} {unidadTarea}
            </p>
            {enEl3D && (
              <Link href={enEl3D} style={enlaceAl3D}>
                Ver en el 3D
              </Link>
            )}
          </div>
          <table style={tablaDelPlano}>
            <tbody>
              {delPlano.map((e, i) => {
                const cantidad = cantidadDeElemento(e);
                // El renglón en el 3D: su piso, y la pieza si es una de la
                // estructura (las paredes, los pisos y los muros van juntos).
                const href = enEl3D
                  ? `${enEl3D}${e.nivel ? `&nivel=${encodeURIComponent(e.nivel)}` : ""}${
                      e.etiqueta && !GENERICAS.has(e.etiqueta) ? `&cosa=${encodeURIComponent(e.etiqueta)}` : ""
                    }`
                  : null;
                return (
                  <tr key={i}>
                    <td style={celdaDelPlano}>
                      {href ? (
                        <Link href={href} style={enlaceDeRenglon}>
                          {e.nivel ?? "Sin nivel"}
                        </Link>
                      ) : (
                        (e.nivel ?? "Sin nivel")
                      )}
                    </td>
                    <td style={celdaDelPlano}>{e.etiqueta ?? ""}</td>
                    <td style={cuentaDelPlano}>{cuentaDe(e, unidadTarea)}</td>
                    <td style={cantidad > 0 ? cantidadDelPlano : faltaDelPlano}>
                      {cantidad > 0
                        ? `${cantidadAR.format(cantidad)} ${unidadTarea}`
                        : "falta el espesor"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filas.length > 0 && (
            <p style={avisoConvive}>También medida a mano: las dos suman.</p>
          )}
        </div>
      )}

      {filas.length === 0 ? (
        delPlano.length === 0 && (
          <p style={vacio}>
            Sin medición: la cantidad de la tarea se escribe a mano en la planilla.
          </p>
        )
      ) : (
        <div style={scroll}>
          <table style={tabla}>
            <thead>
              <tr>
                <th style={thIzq}>Elemento</th>
                <th style={thIzq}>Se mide</th>
                <th style={thCentro}>Ancho</th>
                <th style={thCentro}>Alto / esp.</th>
                <th style={thCentro}>Largo / área</th>
                <th style={thCentro}>Unid.</th>
                <th style={thDer}>{unidadTarea}</th>
                <th style={thIzq} />
              </tr>
            </thead>
            {grupos.map((g) => {
              const plegado = plegados.has(g.clave);
              return (
              <tbody key={g.clave}>
                <tr>
                  <td colSpan={8} style={celdaNivel}>
                    <span style={filaNivel}>
                      <button
                        type="button"
                        onClick={() => alternarPlegado(g.clave)}
                        style={botonPlegar}
                        aria-expanded={!plegado}
                        title={plegado ? "Mostrar los elementos" : "Plegar el nivel"}
                      >
                        {plegado ? "▸" : "▾"}
                      </button>
                      <input
                        type="text"
                        value={g.nivel}
                        onChange={(e) => renombrar(g.clave, e.target.value)}
                        placeholder="Sobre planta baja"
                        style={inputNivel}
                        aria-label="Nombre del nivel"
                      />
                      <span style={subtotalNivel}>
                        {g.filas.length} ·{" "}
                        {cantidadAR.format(totalDeMedicion(g.filas.map(comoElemento)))}{" "}
                        {unidadTarea}
                      </span>
                      <button
                        type="button"
                        onClick={() => agregarEn(g.clave)}
                        style={botonEnNivel}
                      >
                        + Elemento
                      </button>
                    </span>
                  </td>
                </tr>
                {!plegado &&
                  g.filas.map((f) => {
                  const usa = medidasDe(f.forma);
                  const cantidad = cantidadDeElemento(comoElemento(f));
                  return (
                    <tr key={f.clave}>
                      <td style={celda}>
                        <input
                          type="text"
                          value={f.etiqueta}
                          onChange={(e) => aplicar(f.clave, { etiqueta: e.target.value })}
                          placeholder="V-201"
                          style={{ ...inputBase, textAlign: "left", width: "110px" }}
                        />
                      </td>
                      <td style={celda}>
                        <select
                          value={f.forma}
                          onChange={(e) =>
                            aplicar(f.clave, { forma: e.target.value as Forma })
                          }
                          style={{ ...inputBase, textAlign: "left", width: "195px" }}
                        >
                          {FORMAS.map((x) => (
                            <option key={x.valor} value={x.valor} title={x.cuenta}>
                              {x.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      {(["a", "b", "c"] as const).map((cual) => (
                        <td key={cual} style={celdaCentro}>
                          <input
                            type="number"
                            value={f[cual]}
                            min={0}
                            step="any"
                            disabled={!usa.includes(cual)}
                            placeholder={usa.includes(cual) ? "0" : "—"}
                            onChange={(e) => aplicar(f.clave, { [cual]: e.target.value })}
                            style={
                              usa.includes(cual)
                                ? { ...inputBase, width: "92px" }
                                : { ...inputBase, width: "92px", ...apagado }
                            }
                          />
                        </td>
                      ))}
                      <td style={celdaCentro}>
                        <input
                          type="number"
                          value={f.unidades}
                          min={0}
                          step="any"
                          placeholder="1"
                          onChange={(e) => aplicar(f.clave, { unidades: e.target.value })}
                          style={{ ...inputBase, width: "64px" }}
                        />
                      </td>
                      <td style={cantidad > 0 ? celdaTotal : celdaFalta}>
                        {cantidad > 0 ? cantidadAR.format(cantidad) : "—"}
                      </td>
                      <td style={celda}>
                        <button
                          type="button"
                          onClick={() => quitar(f.clave)}
                          style={botonQuitar}
                          aria-label="Quitar elemento"
                          title="Quitar elemento"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              );
            })}
          </table>
        </div>
      )}

      <div style={pie}>
        <div style={agregarFila}>
          <button type="button" onClick={agregarNivel} style={botonAgregar}>
            + Agregar nivel
          </button>
        </div>

        <button type="button" onClick={enviar} disabled={guardando} style={botonGuardar}>
          {guardando ? "Guardando…" : "Guardar medición"}
        </button>
      </div>

      {error && <p style={textoError}>{error}</p>}
    </div>
  );
}

/**
 * La cuenta de un renglón del plano, para leerla: "0,08 × 12 m²", o "× 3
 * pisos" en una planta que se repite sin tener pisos asignados.
 */
function cuentaDe(e: ElementoInicial, unidadTarea: string): string {
  const partes: string[] = [];
  if (e.forma === "superficie" && e.b !== null && e.c !== null) {
    partes.push(`${cantidadAR.format(e.b)} m × ${cantidadAR.format(e.c)} m²`);
  } else if (e.unidades !== 1 && e.c !== null) {
    partes.push(`${cantidadAR.format(e.c)} ${unidadTarea}`);
  }
  if (e.unidades !== 1) partes.push(`× ${cantidadAR.format(e.unidades)} pisos`);
  return partes.join(" ");
}

/**
 * Reparte una lista de elementos en bloques por nivel.
 *
 * Un nivel que ya apareció recupera su bloque aunque entre otro en el medio:
 * una planilla pegada puede traer las vigas de planta baja, las del primero y
 * de nuevo algo de planta baja, y lo que se quiere ver son dos bloques, no
 * tres.
 */
function agrupar(elementos: ElementoInicial[]) {
  const porNivel = new Map<string, string>();
  const niveles: Record<string, string> = {};

  const filas = elementos.map((e) => {
    const nivel = (e.nivel ?? "").trim();
    let grupo = porNivel.get(nivel);
    if (!grupo) {
      grupo = nuevaClave();
      porNivel.set(nivel, grupo);
      niveles[grupo] = nivel;
    }
    return {
      clave: nuevaClave(),
      grupo,
      etiqueta: texto(e.etiqueta),
      forma: e.forma,
      a: numero(e.a),
      b: numero(e.b),
      c: numero(e.c),
      unidades: String(e.unidades),
    };
  });

  return { filas, niveles };
}

const caja = {
  background: "#fafafa",
  border: "1px solid #eeeeee",
  borderRadius: "12px",
  padding: "18px 20px",
  margin: "4px 0 12px",
};

// Lo que vino del plano: apartado, con el azul de su marca, y sin campos.
const cajaDelPlano = {
  background: "#f5f8ff",
  border: "1px solid #dbe5fb",
  borderRadius: "10px",
  padding: "10px 14px",
  margin: "0 0 14px",
};

const tituloDelPlano = {
  fontSize: "13px",
  fontWeight: 600,
  margin: "0 0 6px",
};

const cabezaDelPlano = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "12px",
};

const enlaceAl3D = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#1d4ed8",
  textDecoration: "none",
  border: "1px solid #bfdbfe",
  borderRadius: "999px",
  padding: "3px 10px",
  background: "#ffffff",
};

const enlaceDeRenglon = {
  color: "inherit",
  textDecoration: "underline",
  textDecorationColor: "#bfdbfe",
  textUnderlineOffset: "3px",
};

/** Los renglones del plano que no son una pieza: van juntos, por piso. */
const GENERICAS = new Set(["Muros", "Paredes", "Pisos", "Cielorrasos", "Zócalos"]);


const tablaDelPlano = {
  borderCollapse: "collapse" as const,
  fontSize: "13px",
};

const celdaDelPlano = {
  padding: "3px 18px 3px 0",
  whiteSpace: "nowrap" as const,
};

const cuentaDelPlano = {
  ...celdaDelPlano,
  color: "#888888",
};

const cantidadDelPlano = {
  ...celdaDelPlano,
  textAlign: "right" as const,
  fontWeight: 600,
};

const faltaDelPlano = {
  ...cantidadDelPlano,
  fontWeight: 400,
  color: AMBAR,
};

const avisoConvive = {
  fontSize: "12px",
  color: AMBAR,
  margin: "8px 0 0",
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

const notaCambio = {
  fontSize: "13px",
  color: "#8a5a00",
  background: "#fff4d6",
  borderRadius: "8px",
  padding: "8px 12px",
  margin: "0 0 12px",
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

const celdaCentro = {
  ...celda,
  textAlign: "center" as const,
};

const celdaTotal = {
  ...celda,
  textAlign: "right" as const,
  whiteSpace: "nowrap" as const,
  fontWeight: 600,
  color: "#111111",
};

// Un elemento sin medir no suma: se ve que falta en vez de parecer un cero.
const celdaFalta = {
  ...celdaTotal,
  color: "#bbbbbb",
  fontWeight: 400,
};

// El encabezado de un bloque: el nivel, lo que suma y cómo agregarle uno más.
const celdaNivel = {
  borderBottom: "1px solid #e4e4e4",
  padding: "14px 8px 6px",
};

const filaNivel = {
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap" as const,
};

const inputNivel = {
  ...ui.input,
  padding: "5px 8px",
  width: "200px",
  fontSize: "13px",
  fontWeight: 600,
  background: "transparent",
  borderColor: "transparent",
};

const subtotalNivel = {
  fontSize: "12px",
  color: "#888888",
  whiteSpace: "nowrap" as const,
};

const botonEnNivel = {
  background: "none",
  border: "none",
  color: "#777777",
  fontSize: "12px",
  cursor: "pointer",
  padding: "2px 4px",
};

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

// La medida que la forma no usa queda a la vista pero desactivada: así se ve
// que la columna existe y que ese elemento no la necesita.
const apagado = {
  background: "#f4f4f4",
  color: "#bbbbbb",
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
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap" as const,
};

const botonAgregar = {
  ...ui.secondaryButton,
  padding: "7px 12px",
  fontSize: "13px",
};

const botonGuardar = {
  ...ui.button,
  padding: "8px 14px",
  fontSize: "13px",
};

const textoError = {
  color: ui.ROJO,
  fontSize: "13px",
  margin: "10px 0 0",
};

// El triangulito que pliega un nivel. Aparte del nombre, que es un campo de
// texto: hacer clickeable la fila entera haría que escribir el nivel lo
// plegara.
const botonPlegar = {
  background: "none",
  border: "none",
  color: "#777777",
  fontSize: "13px",
  cursor: "pointer",
  padding: "2px 2px",
  lineHeight: 1,
};
