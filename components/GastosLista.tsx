"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EtiquetaComprobante from "@/components/EtiquetaComprobante";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { semanaDeObra } from "@/lib/semanas";

export type GastoFila = {
  id: string;
  fecha: string;
  /** Aclaración libre, opcional: puede venir vacío. */
  concepto: string | null;
  monto: number;
  montoCaja: number;
  tipoFactura: string | null;
  tipoGasto: string;
  tipoPago: string | null;
  estado: string;
  comprobanteDriveId: string | null;
  rubro: string | null;
  proveedor: string | null;
  proveedorId: string | null;
  pagadora: string | null;
  receptora: string | null;
  compartido: boolean;
};

/**
 * Columnas con filtro estilo Excel: el desplegable de la columna lista sus
 * valores con una casilla cada uno, y se destilda lo que no se quiere ver.
 * Convive con el buscador de texto: el filtro acota, el buscador encuentra.
 */
const COLUMNAS_FILTRABLES = [
  { clave: "rubro", rotulo: "Rubro" },
  { clave: "tipo", rotulo: "Tipo" },
  { clave: "destino", rotulo: "Destino" },
  { clave: "comprobante", rotulo: "Comprobante" },
  { clave: "pago", rotulo: "Pagó" },
] as const;

type ColumnaFiltrable = (typeof COLUMNAS_FILTRABLES)[number]["clave"];

/**
 * El valor de un gasto en cada columna filtrable: el mismo texto que muestra
 * la celda, así el desplegable ofrece exactamente lo que se ve en pantalla.
 */
function valorDe(g: GastoFila, col: ColumnaFiltrable): string {
  const ajuste = g.tipoGasto === "Ajuste de saldo";

  switch (col) {
    case "rubro":
      return g.rubro ?? "—";
    case "tipo":
      return g.tipoGasto;
    case "destino":
      return ajuste ? `→ ${g.receptora ?? "—"}` : (g.proveedor ?? "—");
    case "comprobante":
      return ajuste ? "—" : g.tipoFactura ? `Factura ${g.tipoFactura}` : "Efectivo";
    case "pago":
      if (g.compartido) return "Entre las socias";
      if (g.montoCaja >= g.monto) return "Dinero en cuenta";
      return g.pagadora ?? "—";
  }
}

/**
 * Los atajos de las tarjetas de Economía: se llega al listado con la columna
 * Comprobante ya filtrada, en vez de tener que armar el filtro a mano.
 *
 * Se expresa como una intención ("efectivo", "facturado") y no como una lista
 * de valores porque los valores reales dependen de los datos de cada obra —una
 * puede no tener ninguna factura C—: acá se resuelven contra los que existen.
 */
export type VistaGastos = "todos" | "efectivo" | "facturado" | "credito-fiscal";

function filtroDe(ver: VistaGastos | undefined, comprobantes: string[]) {
  // "todos" no filtra nada: existe para que la tarjeta de Total gastado también
  // se reconozca como una entrada desde el Balance y ofrezca la vuelta.
  if (!ver || ver === "todos") return {};

  const valores = comprobantes.filter((v) =>
    ver === "efectivo"
      ? v === "Efectivo"
      : ver === "facturado"
        ? v.startsWith("Factura")
        : // El crédito fiscal lo da sólo la factura A: es la única que
          // discrimina el IVA.
          v === "Factura A"
  );

  return valores.length > 0 ? { comprobante: new Set(valores) } : {};
}

export default function GastosLista({
  gastos,
  slug,
  inicioObra,
  ver,
}: {
  gastos: GastoFila[];
  slug: string;
  /** Arranque de la obra: con eso cada fecha sabe en qué semana cae. */
  inicioObra: string | null;
  /** Con qué filtro arranca la pantalla, si se entró por un atajo. */
  ver?: VistaGastos;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [ocultarAnulados, setOcultarAnulados] = useState(false);
  const [filtros, setFiltros] = useState<
    Partial<Record<ColumnaFiltrable, Set<string>>>
  >(() =>
    filtroDe(ver, [...new Set(gastos.map((g) => valorDe(g, "comprobante")))])
  );
  const [abierto, setAbierto] = useState<ColumnaFiltrable | null>(null);

  const opciones = useMemo(() => {
    const mapa = {} as Record<ColumnaFiltrable, string[]>;
    for (const col of COLUMNAS_FILTRABLES) {
      mapa[col.clave] = [
        ...new Set(gastos.map((g) => valorDe(g, col.clave))),
      ].sort((a, b) => a.localeCompare(b));
    }
    return mapa;
  }, [gastos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return gastos.filter((g) => {
      if (ocultarAnulados && g.estado === "Anulado") return false;

      for (const col of COLUMNAS_FILTRABLES) {
        const elegidos = filtros[col.clave];
        if (elegidos && !elegidos.has(valorDe(g, col.clave))) return false;
      }

      if (!q) return true;

      // Un solo texto busca en todo lo que se ve de un gasto, incluida la
      // semana: "semana 11" es como se lo nombra en la obra.
      const semana = semanaDeObra(g.fecha, inicioObra);
      const campos = [
        g.concepto,
        g.rubro,
        g.proveedor,
        valorDe(g, "pago"),
        g.receptora,
        g.tipoGasto,
        g.tipoFactura ? `factura ${g.tipoFactura}` : g.tipoPago,
        formatDate(g.fecha),
        semana !== null ? `semana ${semana}` : null,
        String(g.monto),
      ];

      return campos.some((c) => c?.toLowerCase().includes(q));
    });
  }, [gastos, busqueda, ocultarAnulados, filtros, inicioObra]);

  const hayFiltros = Object.keys(filtros).length > 0;

  // Cuánto suma lo que se está viendo. Es el número que se viene a buscar
  // cuando se entra por una tarjeta de Economía ("¿en qué se fue el efectivo?"),
  // y cuadra con ella: quedan afuera los anulados y los ajustes de saldo, que
  // no son gasto de obra en ninguna otra pantalla.
  const totalFiltrado = filtrados
    .filter((g) => g.estado !== "Anulado" && g.tipoGasto !== "Ajuste de saldo")
    .reduce((acc, g) => acc + g.monto, 0);

  // Sin filtro guardado, todas las casillas están tildadas. Destildar una crea
  // el filtro con el resto; volver a tildarlas todas lo borra, así "sin
  // filtro" queda como el estado natural de la columna.
  const alternar = (col: ColumnaFiltrable, valor: string) => {
    setFiltros((prev) => {
      const nuevo = new Set(prev[col] ?? opciones[col]);
      if (nuevo.has(valor)) {
        nuevo.delete(valor);
      } else {
        nuevo.add(valor);
      }

      const copia = { ...prev };
      if (nuevo.size === opciones[col].length) {
        delete copia[col];
      } else {
        copia[col] = nuevo;
      }
      return copia;
    });
  };

  const limpiar = (col: ColumnaFiltrable) => {
    setFiltros((prev) => {
      const copia = { ...prev };
      delete copia[col];
      return copia;
    });
  };

  const thFiltrable = (clave: ColumnaFiltrable) => {
    const col = COLUMNAS_FILTRABLES.find((c) => c.clave === clave)!;
    const activo = Boolean(filtros[clave]);

    return (
      <th style={{ ...ui.th, position: "relative" }}>
        <span style={contenidoTh}>
          {col.rotulo}
          <button
            type="button"
            onClick={() => setAbierto(abierto === clave ? null : clave)}
            style={{ ...botonFiltro, color: activo ? "#111111" : "#bbbbbb" }}
            title={`Filtrar por ${col.rotulo.toLowerCase()}`}
          >
            ▾
          </button>
        </span>

        {abierto === clave && (
          <>
            {/* Capa invisible que cierra el desplegable al tocar afuera. */}
            <div style={fondoCerrar} onClick={() => setAbierto(null)} />

            <div style={popover}>
              <button
                type="button"
                onClick={() => limpiar(clave)}
                style={botonTodos}
              >
                Todos
              </button>

              {opciones[clave].map((valor) => (
                <label key={valor} style={opcionFiltro}>
                  <input
                    type="checkbox"
                    checked={!filtros[clave] || filtros[clave].has(valor)}
                    onChange={() => alternar(clave, valor)}
                  />
                  {valor}
                </label>
              ))}
            </div>
          </>
        )}
      </th>
    );
  };

  return (
    <section style={ui.panel}>
      {gastos.length > 0 && (
        <div style={barra}>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por detalle, destino, quién pagó…"
            style={{ ...ui.input, flex: "1 1 240px" }}
          />

          <label style={toggle}>
            <input
              type="checkbox"
              checked={ocultarAnulados}
              onChange={(e) => setOcultarAnulados(e.target.checked)}
            />
            Ocultar anulados
          </label>
        </div>
      )}

      {gastos.length === 0 ? (
        <p style={ui.vacio}>Todavía no hay gastos cargados en esta obra.</p>
      ) : filtrados.length === 0 ? (
        <p style={ui.vacio}>Ningún gasto coincide con la búsqueda o los filtros.</p>
      ) : (
        <>
          <p style={contador}>
            {filtrados.length}{" "}
            {filtrados.length === 1 ? "gasto" : "gastos"}
            {(busqueda || ocultarAnulados || hayFiltros) &&
              ` de ${gastos.length}`}
            {totalFiltrado > 0 && (
              <span style={totalContador}>{formatMoney(totalFiltrado)}</span>
            )}
          </p>

          <table style={ui.table}>
            <thead>
              {/* "Destino" y no "Proveedor / Contratista": es adónde fue la
                  plata, valga quien valga. El comprobante va en una sola
                  columna (tipo + archivo), así el detalle —que es lo que se
                  escribe largo— se queda con el ancho libre. */}
              <tr>
                <th style={ui.th}>Fecha</th>
                {thFiltrable("rubro")}
                {thFiltrable("tipo")}
                {thFiltrable("destino")}
                <th style={ui.th}>Detalle</th>
                {thFiltrable("comprobante")}
                {thFiltrable("pago")}
                <th style={ui.thRight}>Monto</th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((gasto) => {
                const anulado = gasto.estado === "Anulado";
                const ajuste = gasto.tipoGasto === "Ajuste de saldo";
                const celda = anulado ? tdAnulado : ajuste ? tdAjuste : ui.td;

                return (
                  <tr
                    key={gasto.id}
                    style={ajuste && !anulado ? filaAjuste : undefined}
                  >
                    {/* Sólo la fecha: la semana sale de ella y se muestra en
                        Detalle, que es donde se nombra el pago. Tenerla en los
                        dos lugares era decir dos veces lo mismo. */}
                    <td style={{ ...celda, ...compacta }}>
                      {formatDate(gasto.fecha)}
                    </td>
                    <td style={{ ...celda, ...compacta }}>
                      {gasto.rubro ?? "—"}
                    </td>
                    <td style={{ ...celda, ...compacta }}>
                      {ajuste ? (
                        <span style={tagAjuste}>Ajuste de saldo</span>
                      ) : (
                        gasto.tipoGasto
                      )}
                    </td>
                    <td style={{ ...celda, ...compacta }}>
                      {/* El destino es la puerta al detalle de pagos a ese
                          proveedor. Los que se cargaron sin destino (o el
                          ajuste, que va hacia una socia) no llevan a ningún
                          lado. */}
                      {ajuste ? (
                        `→ ${gasto.receptora ?? "—"}`
                      ) : gasto.proveedorId ? (
                        <Link
                          href={`/obras/${slug}/proveedor/${gasto.proveedorId}`}
                          style={destinoLink}
                        >
                          {gasto.proveedor ?? "—"}
                        </Link>
                      ) : (
                        (gasto.proveedor ?? "—")
                      )}
                    </td>
                    {/* Sólo lo que se escribió, y si no se escribió nada la
                        celda queda vacía. La semana no se muestra: sale de la
                        fecha y su trabajo es agrupar en el flujo, no ocupar
                        lugar acá. El buscador sí la encuentra ("semana 11"). */}
                    <td style={celda}>
                      {gasto.concepto}
                      {anulado && <span style={tagAnulado}>Anulado</span>}
                    </td>
                    <td style={{ ...celda, ...compacta }}>
                      {ajuste ? (
                        "—"
                      ) : (
                        <EtiquetaComprobante
                          tipoFactura={gasto.tipoFactura}
                          driveId={gasto.comprobanteDriveId}
                          volver={`/obras/${slug}/gastos`}
                        />
                      )}
                    </td>
                    <td style={{ ...celda, ...compacta }}>
                      {gasto.compartido ? (
                        "Entre las socias"
                      ) : gasto.montoCaja >= gasto.monto ? (
                        "Dinero en cuenta"
                      ) : gasto.montoCaja > 0 ? (
                        <>
                          {gasto.pagadora ?? "—"}
                          <div style={aporteCuenta}>
                            + {formatMoney(gasto.montoCaja)} de la cuenta
                          </div>
                        </>
                      ) : (
                        (gasto.pagadora ?? "—")
                      )}
                    </td>
                    {/* Sin el IVA abajo del monto: "Factura A" ya dice que lo
                        tiene, y el renglón extra ensuciaba la columna. */}
                    <td style={anulado ? tdAnuladoRight : ui.tdRight}>
                      <strong>{formatMoney(gasto.monto)}</strong>
                    </td>
                    <td style={celda}>
                      <Link
                        href={`/obras/${slug}/gastos/${gasto.id}/editar`}
                        style={editarLink}
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

const barra = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "12px",
  alignItems: "center",
  marginBottom: "20px",
};

const toggle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "14px",
  color: "#555555",
  whiteSpace: "nowrap" as const,
};

const contador = {
  fontSize: "13px",
  color: "#999999",
  margin: "0 0 12px",
};

// El total va en negro al lado de la cuenta de gastos: es el dato, no el
// pie de página.
const totalContador = {
  color: "#111111",
  marginLeft: "10px",
};

const contenidoTh = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
};

const botonFiltro = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 2px",
  fontSize: "11px",
  lineHeight: 1,
};

const fondoCerrar = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 10,
};

// El th escribe en mayúsculas espaciadas; el desplegable vuelve al texto
// normal. La sombra es la única de la app: sin ella el recuadro se funde con
// las filas que tapa.
const popover = {
  position: "absolute" as const,
  top: "calc(100% - 6px)",
  left: "8px",
  zIndex: 20,
  background: "#ffffff",
  border: "1px solid #dcdcdc",
  padding: "10px 12px",
  minWidth: "210px",
  maxHeight: "300px",
  overflowY: "auto" as const,
  boxShadow: "0 6px 16px rgba(0, 0, 0, 0.08)",
  textTransform: "none" as const,
  letterSpacing: "normal",
  fontWeight: 400,
  textAlign: "left" as const,
};

const botonTodos = {
  background: "none",
  border: "none",
  padding: "0 0 8px",
  color: "#111111",
  textDecoration: "underline",
  fontSize: "13px",
  cursor: "pointer",
  display: "block",
};

const opcionFiltro = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "5px 0",
  fontSize: "13px",
  color: "#333333",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const filaAjuste = { background: "#fafafa" };

const tdAjuste = { ...ui.td, borderBottom: "1px solid #e0e0e0" };

const tagAjuste = {
  border: "1px solid #111111",
  background: "#111111",
  color: "#ffffff",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const aporteCuenta = {
  fontSize: "13px",
  color: "#999999",
  marginTop: "4px",
};



// Las columnas cortas no se parten: el ancho que sobra se lo queda el detalle,
// que es lo único que se escribe largo.
const compacta = { whiteSpace: "nowrap" as const };

const destinoLink = {
  color: "#333333",
  textDecoration: "underline",
};

const tdAnulado = {
  ...ui.td,
  color: "#aaaaaa",
  textDecoration: "line-through" as const,
};

const tdAnuladoRight = { ...tdAnulado, textAlign: "right" as const };

const tagAnulado = {
  marginLeft: "8px",
  border: "1px solid #aaaaaa",
  color: "#aaaaaa",
  padding: "2px 6px",
  fontSize: "11px",
  textDecoration: "none" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const editarLink = {
  color: "#111111",
  fontSize: "14px",
  textDecoration: "underline",
};
