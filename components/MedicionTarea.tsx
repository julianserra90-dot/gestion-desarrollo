"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import * as ui from "@/components/ui";
import {
  cantidadDeElemento,
  ESTADOS,
  FORMAS,
  leerPegado,
  leFaltaMedida,
  medidasDe,
  totalDeMedicion,
  totalesPorNivel,
  type EstadoMedida,
  type Forma,
} from "@/lib/medicion";

export type ElementoInicial = {
  nivel: string | null;
  etiqueta: string | null;
  forma: Forma;
  a: number | null;
  b: number | null;
  c: number | null;
  unidades: number;
  estado: EstadoMedida;
  fuente: string | null;
};

export type ElementoAGuardar = {
  nivel: string | null;
  etiqueta: string | null;
  forma: string;
  a: number | null;
  b: number | null;
  c: number | null;
  unidades: number;
  estado: string;
  fuente: string | null;
};

export type LeerMedicion = (
  itemId: string
) => Promise<{ elementos?: ElementoInicial[]; error?: string }>;

export type GuardarMedicion = (
  itemId: string,
  elementos: ElementoAGuardar[]
) => Promise<{ error?: string }>;

type Fila = {
  /** Sólo para React: las filas no tienen id de la base mientras se editan. */
  clave: string;
  nivel: string;
  etiqueta: string;
  forma: Forma;
  a: string;
  b: string;
  c: string;
  unidades: string;
  estado: EstadoMedida;
  fuente: string;
};

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

/**
 * La medición de una tarea, desplegada dentro de su fila de la planilla.
 *
 * Cada fila es un elemento medido —la viga V-201, de 0,12 x 0,45 x 4,49— y la
 * cantidad de la tarea es la suma. Hasta ahora esa cuenta vivía en una planilla
 * aparte: el cómputo mostraba 22,28 m³ y no había forma de revisar de dónde
 * salían, ni de ver cuánto de eso era firme.
 *
 * Los elementos se piden al abrir y no vienen con la planilla: pueden ser
 * doscientos cincuenta y pico y casi nunca se miran.
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
}: {
  itemId: string;
  unidadTarea: string;
  /** La cantidad que hoy tiene la tarea, para avisar si la medición la cambia. */
  cantidadTarea: number;
  leer: LeerMedicion;
  guardar: GuardarMedicion;
  alGuardar?: () => void;
}) {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");
  const [pegado, setPegado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
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
      setFilas(
        (r.elementos ?? []).map((e) => ({
          clave: nuevaClave(),
          nivel: texto(e.nivel),
          etiqueta: texto(e.etiqueta),
          forma: e.forma,
          a: numero(e.a),
          b: numero(e.b),
          c: numero(e.c),
          unidades: String(e.unidades),
          estado: e.estado,
          fuente: texto(e.fuente),
        }))
      );
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

  const agregar = () =>
    setFilas((antes) => [
      ...(antes ?? []),
      {
        clave: nuevaClave(),
        // El nivel del último: se cargan de a bloques, piso por piso.
        nivel: antes?.[antes.length - 1]?.nivel ?? "",
        etiqueta: "",
        forma: "prisma",
        a: "",
        b: "",
        c: "",
        unidades: "1",
        estado: "firme",
        fuente: "",
      },
    ]);

  const quitar = (clave: string) =>
    setFilas((antes) => (antes ?? []).filter((f) => f.clave !== clave));

  const desdeExcel = (reemplazar: boolean) => {
    const leidas: Fila[] = leerPegado(pegado ?? "").map((e) => ({
      clave: nuevaClave(),
      nivel: texto(e.nivel),
      etiqueta: texto(e.etiqueta),
      forma: e.forma,
      a: numero(e.a),
      b: numero(e.b),
      c: numero(e.c),
      unidades: String(e.unidades),
      estado: e.estado,
      fuente: texto(e.fuente),
    }));

    if (leidas.length === 0) {
      setAviso("No encontré elementos ahí. ¿Pegaste las columnas con sus tabulaciones?");
      return;
    }

    setFilas((antes) => (reemplazar ? leidas : [...(antes ?? []), ...leidas]));
    setAviso(leidas.length === 1 ? "Leí 1 elemento." : `Leí ${leidas.length} elementos.`);
    setPegado(null);
  };

  const elementos = filas.map(comoElemento);
  const total = totalDeMedicion(elementos);
  const niveles = totalesPorNivel(
    filas.map((f, i) => ({ ...elementos[i], nivel: f.nivel }))
  );
  const pendientes = elementos.filter(leFaltaMedida).length;
  // Los niveles ya escritos, para no volver a tipearlos en cada elemento.
  const nivelesUsados = [...new Set(filas.map((f) => f.nivel).filter(Boolean))];

  const enviar = () =>
    iniciar(async () => {
      const r = await guardar(
        itemId,
        filas.map((f) => ({
          nivel: f.nivel.trim() || null,
          etiqueta: f.etiqueta.trim() || null,
          forma: f.forma,
          a: num(f.a),
          b: num(f.b),
          c: num(f.c),
          unidades: num(f.unidades) ?? 1,
          estado: f.estado,
          fuente: f.fuente.trim() || null,
        }))
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
        <span style={dato}>
          <span style={ui.label}>Cantidad de la tarea</span>
          <strong>
            {cantidadAR.format(total)} {unidadTarea}
          </strong>
        </span>
        <span style={dato}>
          <span style={ui.label}>Elementos</span>
          <strong>{filas.length}</strong>
        </span>
        {pendientes > 0 && (
          <span style={dato}>
            <span style={ui.label}>Sin medir</span>
            <strong style={{ color: ui.ROJO }}>{pendientes}</strong>
          </span>
        )}
        {niveles.length > 1 &&
          niveles.map((n) => (
            <span key={n.nivel} style={dato}>
              <span style={ui.label}>{n.nivel || "Sin nivel"}</span>
              <strong>
                {cantidadAR.format(n.cantidad)} {unidadTarea}
              </strong>
            </span>
          ))}
      </div>

      {filas.length > 0 && Math.abs(total - cantidadTarea) > 0.0005 && (
        <p style={notaCambio}>
          Al guardar, la cantidad de la tarea pasa de {cantidadAR.format(cantidadTarea)} a{" "}
          {cantidadAR.format(total)} {unidadTarea}.
        </p>
      )}

      {filas.length === 0 ? (
        <p style={vacio}>
          Sin medición: la cantidad de la tarea se escribe a mano en la planilla.
        </p>
      ) : (
        <div style={scroll}>
          <table style={tabla}>
            <thead>
              <tr>
                <th style={thIzq}>Nivel</th>
                <th style={thIzq}>Elemento</th>
                <th style={thIzq}>Se mide</th>
                <th style={thCentro}>Ancho</th>
                <th style={thCentro}>Alto / esp.</th>
                <th style={thCentro}>Largo / área</th>
                <th style={thCentro}>Unid.</th>
                <th style={thDer}>{unidadTarea}</th>
                <th style={thIzq}>Estado</th>
                <th style={thIzq}>De dónde sale</th>
                <th style={thIzq} />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => {
                const usa = medidasDe(f.forma);
                const cantidad = cantidadDeElemento(elementos[i]);
                return (
                  <tr key={f.clave}>
                    <td style={celda}>
                      <input
                        type="text"
                        list="niveles-medicion"
                        value={f.nivel}
                        onChange={(e) => aplicar(f.clave, { nivel: e.target.value })}
                        placeholder="Sobre planta baja"
                        style={{ ...inputBase, textAlign: "left", width: "150px" }}
                      />
                    </td>
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
                        onChange={(e) => aplicar(f.clave, { forma: e.target.value as Forma })}
                        style={{ ...inputBase, textAlign: "left", width: "165px" }}
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
                      <select
                        value={f.estado}
                        onChange={(e) =>
                          aplicar(f.clave, { estado: e.target.value as EstadoMedida })
                        }
                        style={{ ...inputBase, textAlign: "left", width: "130px" }}
                      >
                        {ESTADOS.map((x) => (
                          <option key={x.valor} value={x.valor}>
                            {x.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={celda}>
                      <input
                        type="text"
                        value={f.fuente}
                        onChange={(e) => aplicar(f.clave, { fuente: e.target.value })}
                        placeholder="Dimensiones del replanteo"
                        style={{ ...inputBase, textAlign: "left", minWidth: "220px" }}
                      />
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
          </table>
          <datalist id="niveles-medicion">
            {nivelesUsados.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      )}

      {pegado !== null && (
        <div style={cajaPegado}>
          <p style={ui.note}>
            Copiá las filas de tu planilla y pegalas acá, con las columnas en el orden en
            que están: tipo, ID, ancho, alto, largo, unidades, volumen, estado, fuente y
            nivel. Los títulos, los subtotales y el resumen del final se saltean solos.
          </p>
          <textarea
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            rows={6}
            placeholder="Viga → V-201 → 0,12 → 0,45 → 4,49 → 1 → …   (separado por tabulaciones)"
            style={areaPegado}
          />
          <div style={botonesPegado}>
            <button type="button" onClick={() => desdeExcel(false)} style={botonAgregar}>
              Agregar a lo que ya hay
            </button>
            <button type="button" onClick={() => desdeExcel(true)} style={botonAgregar}>
              Reemplazar todo
            </button>
            <button type="button" onClick={() => setPegado(null)} style={botonTexto}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={pie}>
        <div style={agregarFila}>
          <button type="button" onClick={agregar} style={botonAgregar}>
            + Agregar elemento
          </button>
          {pegado === null && (
            <button type="button" onClick={() => setPegado("")} style={botonAgregar}>
              Pegar desde Excel
            </button>
          )}
          {aviso && <span style={textoAviso}>{aviso}</span>}
        </div>

        <button type="button" onClick={enviar} disabled={guardando} style={botonGuardar}>
          {guardando ? "Guardando…" : "Guardar medición"}
        </button>
      </div>

      {error && <p style={textoError}>{error}</p>}
    </div>
  );
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
  minWidth: "1420px",
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

const botonTexto = {
  background: "none",
  border: "none",
  color: "#777777",
  fontSize: "13px",
  cursor: "pointer",
  padding: "7px 4px",
};

const botonGuardar = {
  ...ui.button,
  padding: "8px 14px",
  fontSize: "13px",
};

const cajaPegado = {
  background: "#ffffff",
  border: "1px solid #e4e4e4",
  borderRadius: "10px",
  padding: "12px 14px",
  margin: "12px 0 0",
};

const areaPegado = {
  ...ui.input,
  width: "100%",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "12px",
  padding: "8px 10px",
  margin: "8px 0",
};

const botonesPegado = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap" as const,
  alignItems: "center",
};

const textoAviso = {
  fontSize: "13px",
  color: "#777777",
};

const textoError = {
  color: ui.ROJO,
  fontSize: "13px",
  margin: "10px 0 0",
};
