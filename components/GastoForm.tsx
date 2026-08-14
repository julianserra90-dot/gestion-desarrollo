"use client";

import Link from "next/link";
import { useState } from "react";
import * as ui from "@/components/ui";
import { formatMoney, formatUSD } from "@/lib/format";
import { GASTO_COMPARTIDO, repartirPago } from "@/lib/reparto";
import { semanaDeObra } from "@/lib/semanas";

type Socio = { empresa_id: string; nombre: string; porcentaje: number };
type Rubro = {
  id: string;
  nombre: string;
  usaMateriales: boolean;
  usaManoObra: boolean;
};
export type Proveedor = { id: string; nombre: string; tipo: string };

const TIPOS_GASTO = [
  "Materiales",
  "Mano de obra",
  "Administrativo",
  "Ajuste de saldo",
];
const AJUSTE = "Ajuste de saldo";
const ADMINISTRATIVO = "Administrativo";

/**
 * Cada tipo de gasto se le paga a una categoría de proveedor distinta:
 * materiales a un proveedor, mano de obra a un contratista, y lo administrativo
 * —impuestos, honorarios, gastos municipales— a la categoría "Varios".
 */
const TIPO_PROVEEDOR: Record<string, string> = {
  Materiales: "Proveedor",
  "Mano de obra": "Contratista",
  Administrativo: "Varios",
};

/** Cómo se rotula el desplegable de proveedor según la categoría. */
const PROVEEDOR_LABEL: Record<string, { label: string; placeholder: string }> = {
  Proveedor: { label: "Proveedor", placeholder: "Ej: Corralón Central" },
  Contratista: { label: "Contratista", placeholder: "Ej: Yesería Martínez" },
  Varios: { label: "Varios", placeholder: "Ej: ABL, honorarios agrimensor" },
};

const NUEVO = "__nuevo__";

/**
 * El comprobante define si hay IVA que recuperar. Sólo la factura A lo
 * discrimina; B y C lo tienen adentro o no lo tienen, pero no dan crédito. Sin
 * factura es el efectivo de siempre.
 */
const COMPROBANTES = [
  { valor: "A", label: "Factura A", tipoPago: "Facturado" },
  { valor: "B", label: "Factura B", tipoPago: "Facturado" },
  { valor: "C", label: "Factura C", tipoPago: "Facturado" },
  { valor: "sin", label: "Sin factura (efectivo)", tipoPago: "Efectivo" },
];

const ALICUOTAS = ["21", "10.5"];

export type GastoExistente = {
  id: string;
  fecha: string;
  rubro_id: string | null;
  proveedor_id: string | null;
  empresa_receptora_id: string | null;
  tipo_gasto: string;
  concepto: string | null;
  tipo_pago: string;
  tipo_factura: string | null;
  alicuota_iva: number | null;
  empresa_factura_id: string | null;
  monto: number;
  caja_ars: number;
  caja_usd: number;
  cotizacion: number | null;
  cotizacion_manual: boolean;
  moneda: string;
  monto_usd: number | null;
  observaciones: string | null;
  empresa_pagadora_id: string | null;
  compartido: boolean;
  estado: string;
  comprobante_drive_id: string | null;
  comprobante_nombre: string | null;
};

/** Los dos lados de la cuenta de la obra. */
export type SaldosCaja = { ars: number; usd: number };

/** Lo cotizado y lo ya gastado de cada rubro, para avisar si se pasa. */
export type PresupuestoRubro = {
  rubro_id: string;
  tipo: string;
  cotizado: number;
  gastado: number;
  proveedor: string | null;
};

export default function GastoForm({
  action,
  obraId,
  slug,
  rubros,
  socios,
  proveedores,
  saldosCaja,
  presupuestos = [],
  error,
  empresaFija,
  gasto,
  cotizacion,
  inicioObra,
  textoBoton = "Guardar gasto",
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  rubros: Rubro[];
  socios: Socio[];
  proveedores: Proveedor[];
  /** Lo que hay hoy en la cuenta de la obra, de cada lado. */
  saldosCaja: SaldosCaja;
  /** Cotizado y gastado por rubro, para avisar si el gasto se pasa. */
  presupuestos?: PresupuestoRubro[];
  error?: string;
  /** Si el usuario pertenece a una empresa, el gasto va siempre a su nombre. */
  empresaFija?: string;
  /** Si viene, el formulario edita ese gasto en vez de crear uno nuevo. */
  gasto?: GastoExistente;
  /** Dólar oficial de hoy, sólo para la vista previa de la conversión. */
  cotizacion?: number | null;
  /** Arranque de la obra: con eso la fecha elegida dice en qué semana cae. */
  inicioObra?: string | null;
  textoBoton?: string;
}) {
  // Al editar se muestra el número tal como se cargó: si el gasto se ingresó en
  // dólares, se ve en dólares, no su equivalente en pesos.
  const [monto, setMonto] = useState(
    gasto ? String(gasto.moneda === "USD" ? (gasto.monto_usd ?? "") : gasto.monto) : ""
  );
  const [moneda, setMoneda] = useState(gasto?.moneda ?? "ARS");
  const [fecha, setFecha] = useState(gasto?.fecha ?? "");
  // Al editar: efectivo -> "sin"; facturado sin tipo cargado (gastos viejos)
  // arranca en A, el caso más común, pero no se guarda hasta que se confirme.
  const [comprobante, setComprobante] = useState(
    gasto
      ? gasto.tipo_pago === "Efectivo"
        ? "sin"
        : (gasto.tipo_factura ?? "A")
      : "A"
  );
  const [alicuota, setAlicuota] = useState(
    gasto?.alicuota_iva ? String(gasto.alicuota_iva) : "21"
  );
  // El titular de la factura arranca vacío y sigue a la pagadora hasta que se
  // elija uno a mano. Así "arranca en la que pagó" sin quedar pegado si después
  // cambia quién pagó.
  const [empresaFactura, setEmpresaFactura] = useState(
    gasto?.empresa_factura_id ?? ""
  );
  // "Entre las socias" ocupa el lugar de una empresa en el desplegable: es otra
  // respuesta a la misma pregunta de quién puso la plata.
  const [pagadora, setPagadora] = useState(
    gasto?.compartido
      ? GASTO_COMPARTIDO
      : (gasto?.empresa_pagadora_id ?? empresaFija ?? "")
  );
  const [reemplazar, setReemplazar] = useState(false);
  const [tipoGasto, setTipoGasto] = useState(gasto?.tipo_gasto ?? "Materiales");
  const [proveedorId, setProveedorId] = useState(gasto?.proveedor_id ?? "");
  const [receptora, setReceptora] = useState(gasto?.empresa_receptora_id ?? "");
  const [rubroId, setRubroId] = useState(gasto?.rubro_id ?? "");
  const [usarCaja, setUsarCaja] = useState(
    Number(gasto?.caja_ars ?? 0) > 0 || Number(gasto?.caja_usd ?? 0) > 0
  );
  // Al editar se reconstruye lo que se había pedido: lo que salió de la cuenta
  // más lo que tuvo que poner una empresa, que siempre fue un faltante en pesos.
  const [cajaArs, setCajaArs] = useState(() => {
    if (!gasto) return "";
    const deCuenta =
      Number(gasto.caja_ars) + Number(gasto.caja_usd) * Number(gasto.cotizacion ?? 0);
    if (deCuenta <= 0) return "";
    const pedido = Number(gasto.caja_ars) + Math.max(Number(gasto.monto) - deCuenta, 0);
    return pedido > 0 ? String(Math.round(pedido * 100) / 100) : "";
  });
  const [cajaUsd, setCajaUsd] = useState(
    gasto && Number(gasto.caja_usd) > 0 ? String(gasto.caja_usd) : ""
  );
  const [cotizManual, setCotizManual] = useState(gasto?.cotizacion_manual ?? false);
  const [cotizValor, setCotizValor] = useState(
    gasto?.cotizacion_manual ? String(gasto.cotizacion ?? "") : ""
  );

  // La semana sale de la fecha y no se carga: todos los gastos quedan
  // identificados igual, sin depender de que alguien se acuerde de marcarla.
  const semanaObra = semanaDeObra(fecha, inicioObra);

  // Un ajuste de saldo no compra nada: es plata que pasa de una socia a otra.
  const esAjuste = tipoGasto === AJUSTE;
  const pagaCaja = usarCaja && !esAjuste;
  // Lo pusieron todas juntas: no hay una socia que lo haya adelantado.
  const esCompartido = pagadora === GASTO_COMPARTIDO;

  // La cotización cargada a mano manda sobre todo el gasto, no sólo sobre los
  // dólares que salen de la cuenta: si conseguiste otro cambio, ese es el valor
  // real de lo que pagaste.
  const cotizIngresada = Number(cotizValor) || 0;
  const cotizEfectiva =
    cotizManual && cotizIngresada > 0 ? cotizIngresada : (cotizacion ?? null);

  // Al editar, lo que este gasto ya tenía tomado de la cuenta sigue disponible
  // para él. Si está anulado no tomó nada: el saldo ya lo contempla.
  const tomadoAntes = gasto && gasto.estado !== "Anulado";
  const dispArs = saldosCaja.ars + (tomadoAntes ? Number(gasto.caja_ars) : 0);
  const dispUsd = saldosCaja.usd + (tomadoAntes ? Number(gasto.caja_usd) : 0);

  // Lo que se carga es cuánto se quiere pagar con la cuenta, y eso define el
  // gasto. Si el saldo no llega, la cuenta pone lo que tiene y la diferencia
  // queda a cargo de una socia: se calcula sola, no se tipea.
  const pedidoArs = pagaCaja ? Number(cajaArs) || 0 : 0;
  const pedidoUsd = pagaCaja ? Number(cajaUsd) || 0 : 0;

  const pago = repartirPago({
    pedidoArs,
    pedidoUsd,
    disponibleArs: dispArs,
    disponibleUsd: dispUsd,
    cotizacion: cotizEfectiva,
  });

  // Sin la cuenta, el monto se carga a mano como siempre.
  const ingresado = Number(monto) || 0;
  const totalSinCaja =
    moneda === "USD" ? (cotizEfectiva ? ingresado * cotizEfectiva : 0) : ingresado;

  const total = pagaCaja ? pago.total : totalSinCaja;
  const deCaja = pagaCaja ? pago.cubierto : 0;
  const deEmpresa = pagaCaja ? pago.deEmpresa : totalSinCaja;

  // La empresa sólo hace falta si hay algo que ella tenga que poner.
  const pideEmpresa = !pagaCaja || deEmpresa > 0.01;
  const noAlcanza = pagaCaja && deEmpresa > 0.01;
  const faltaCotizacion = pedidoUsd > 0 && !cotizEfectiva;

  // Cuánto de lo pedido no había en cada lado, para explicar el faltante.
  const faltanArs = Math.max(pedidoArs - Math.max(dispArs, 0), 0);
  const faltanUsd = Math.max(pedidoUsd - Math.max(dispUsd, 0), 0);

  // El IVA que se recupera: sólo la factura A lo discrimina. El monto es el
  // total con IVA adentro, así que el neto se saca hacia atrás y el IVA es la
  // diferencia. Un ajuste de saldo no compra nada, así que nunca lleva IVA.
  const esFacturaA = comprobante === "A" && !esAjuste;
  const alic = Number(alicuota) || 21;
  const iva = esFacturaA ? Math.round((total - total / (1 + alic / 100)) * 100) / 100 : 0;
  const neto = total - iva;

  // El crédito fiscal es de la empresa de la factura. Mientras no se elija una,
  // sigue a la que pagó (o a la del usuario si tiene empresa fija). Un gasto
  // entre todas no tiene a quién seguir: la factura está a nombre de una sola,
  // y hay que decir cuál.
  const titularEfectivo =
    empresaFactura || (esCompartido ? "" : pagadora || empresaFija || "");
  const nombreTitular = socios.find((s) => s.empresa_id === titularEfectivo)?.nombre;

  function cambiarUsarCaja(activo: boolean) {
    setUsarCaja(activo);
    // Los campos del modo anterior dejan de valer: el monto se carga de una
    // forma o de la otra, nunca de las dos.
    setMonto("");
    setMoneda("ARS");
    setCajaArs("");
    setCajaUsd("");
  }

  // El desplegable muestra proveedores, contratistas o varios según el tipo.
  const tipoProveedor = TIPO_PROVEEDOR[tipoGasto] ?? "Proveedor";
  const rotuloProveedor = PROVEEDOR_LABEL[tipoProveedor] ?? PROVEEDOR_LABEL.Proveedor;
  const disponibles = proveedores.filter((p) => p.tipo === tipoProveedor);
  const agregandoNuevo = proveedorId === NUEVO;

  const otrasSocias = socios.filter((s) => s.empresa_id !== pagadora);

  function cambiarTipoGasto(nuevoTipo: string) {
    setTipoGasto(nuevoTipo);
    // Los campos del tipo anterior dejan de valer.
    setProveedorId("");
    setReceptora("");
    // Un ajuste va de una socia puntual a otra: "entre las socias" deja de
    // tener sentido y hay que volver a elegir quién transfiere.
    if (nuevoTipo === AJUSTE && pagadora === GASTO_COMPARTIDO) setPagadora("");
  }

  /**
   * Cambiar de rubro puede dejar el tipo elegido sin sentido: si se pasa a un
   * rubro que sólo se compra, "mano de obra" no corresponde. Se acomoda solo
   * al que sí admite.
   */
  function cambiarRubro(nuevoRubro: string) {
    setRubroId(nuevoRubro);

    const r = rubros.find((x) => x.id === nuevoRubro);
    if (!r || esAjuste) return;

    if (tipoGasto === "Materiales" && !r.usaMateriales && r.usaManoObra) {
      cambiarTipoGasto("Mano de obra");
    } else if (tipoGasto === "Mano de obra" && !r.usaManoObra && r.usaMateriales) {
      cambiarTipoGasto("Materiales");
    }
  }

  // El desplegable de tipo ofrece sólo lo que el rubro admite. Sin rubro
  // elegido se ofrecen los dos: todavía no hay con qué decidir.
  const rubroElegido = rubros.find((r) => r.id === rubroId);
  const tiposDisponibles = TIPOS_GASTO.filter((t) => {
    // Ajuste y Administrativo no dependen del rubro: un impuesto o un honorario
    // no se cotiza, va en cualquier rubro.
    if (t === AJUSTE || t === ADMINISTRATIVO || !rubroElegido) return true;
    if (t === "Materiales") return rubroElegido.usaMateriales;
    return rubroElegido.usaManoObra;
  });

  const reparto = socios.map((socio) => {
    const leCorresponde = (total * socio.porcentaje) / 100;
    const esPagadora = socio.empresa_id === pagadora;

    return {
      ...socio,
      leCorresponde,
      // La que paga adelanta el total: su efecto neto es lo que puso de más.
      efecto: esPagadora ? total - leCorresponde : -leCorresponde,
      esPagadora,
    };
  });

  const nombrePagadora = socios.find((s) => s.empresa_id === pagadora)?.nombre;

  // Un gasto entre todas se divide por igual, sin mirar el porcentaje. Si las
  // participaciones son parejas los saldos quedan quietos; si no, la diferencia
  // contra lo que le toca a cada una se ve en el balance.
  const porSocia = socios.length > 0 ? deEmpresa / socios.length : 0;
  const repartoParejo =
    socios.length > 0 &&
    socios.every((s) => s.porcentaje === socios[0].porcentaje);

  // Si el rubro tiene una cotización aprobada, se avisa cuando este gasto hace
  // que se pase. Es un aviso, no un freno: puede haber una compra de urgencia
  // que nadie cotizó y hay que poder cargarla igual.
  const presupuesto = presupuestos.find(
    (p) => p.rubro_id === rubroId && p.tipo === tipoGasto
  );

  // Al editar, lo que este gasto ya aportaba al acumulado no se cuenta dos veces.
  const gastadoAntes =
    presupuesto && gasto && gasto.rubro_id === rubroId && gasto.tipo_gasto === tipoGasto
      ? Number(gasto.monto)
      : 0;

  const acumulado = (presupuesto?.gastado ?? 0) - gastadoAntes + total;
  const cotizado = presupuesto?.cotizado ?? 0;
  const sePasa = !esAjuste && cotizado > 0 && acumulado > cotizado + 0.01;

  return (
    <form action={action} style={layout}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />
      {gasto && <input type="hidden" name="gasto_id" value={gasto.id} />}

      <div>
        {error && <p style={errorBox}>{error}</p>}

        <div style={ui.panel}>
          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Fecha</span>
              <input
                type="date"
                name="fecha"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                style={ui.input}
              />
              {/* La semana sale de la fecha: es como se nombra el pago de un
                  contratista ("semana 11") y así no hay que contarla a mano.
                  Antes del arranque no hay semana que valga: eso es un acopio
                  o un anticipo, y conviene saberlo al cargarlo. */}
              {semanaObra !== null ? (
                <span style={ayudaCampo}>Semana {semanaObra} de obra.</span>
              ) : (
                fecha &&
                inicioObra && (
                  <span style={ayudaCampo}>
                    Anterior al arranque de la obra: acopio o anticipo.
                  </span>
                )
              )}
            </label>

            <div style={{ ...fieldAncho, display: esAjuste ? "none" : "grid" }}>
              <span style={labelCampo}>Dinero en cuenta</span>

              <label style={checkboxFila}>
                <input
                  type="checkbox"
                  name="usar_caja"
                  checked={usarCaja}
                  onChange={(e) => cambiarUsarCaja(e.target.checked)}
                />
                <span>Pagar con el dinero en cuenta de la obra</span>
              </label>

              {!pagaCaja ? (
                <span style={ayudaCampo}>
                  {dispArs > 0 || dispUsd > 0
                    ? `Hay ${formatMoney(dispArs)} y ${formatUSD(dispUsd)} en la cuenta.`
                    : "Esta obra no tiene plata en cuenta todavía."}
                </span>
              ) : (
                <>
                  <span style={ayudaCampo}>
                    Cargá cuánto querés pagar con la cuenta: eso es el gasto, no
                    hace falta repetir el monto abajo.
                  </span>

                  <div style={grid}>
                    <label style={field}>
                      <span style={labelCampo}>Pesos de la cuenta</span>
                      <input
                        type="number"
                        name="caja_ars"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={cajaArs}
                        onChange={(e) => setCajaArs(e.target.value)}
                        style={ui.input}
                      />
                      <span style={ayudaCampo}>
                        Disponible: {formatMoney(Math.max(dispArs, 0))}
                      </span>
                    </label>

                    <label style={field}>
                      <span style={labelCampo}>Dólares de la cuenta</span>
                      <input
                        type="number"
                        name="caja_usd"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={cajaUsd}
                        onChange={(e) => setCajaUsd(e.target.value)}
                        style={ui.input}
                      />
                      <span style={ayudaCampo}>
                        Disponible: {formatUSD(Math.max(dispUsd, 0))}
                        {pedidoUsd > 0 &&
                          cotizEfectiva &&
                          ` · rinden ${formatMoney(pedidoUsd * cotizEfectiva)}`}
                      </span>
                    </label>
                  </div>

                  {/* La cotización sólo hace falta si hay dólares de por medio:
                      es lo que define cuántos pesos son. */}
                  {pedidoUsd > 0 && (
                    <div style={{ ...field, marginTop: "4px" }}>
                      <label style={checkboxFila}>
                        <input
                          type="checkbox"
                          name="cotizacion_manual"
                          checked={cotizManual}
                          onChange={(e) => setCotizManual(e.target.checked)}
                        />
                        <span>Cotización personalizada</span>
                      </label>

                      {cotizManual ? (
                        <>
                          <input
                            type="number"
                            name="cotizacion_valor"
                            min="0"
                            step="0.01"
                            placeholder={
                              cotizacion ? String(Math.round(cotizacion)) : "0"
                            }
                            value={cotizValor}
                            onChange={(e) => setCotizValor(e.target.value)}
                            required
                            style={ui.input}
                          />
                          <span style={ayudaCampo}>
                            Pesos por dólar. Manda sobre todo el gasto: a este
                            cambio se valúan los dólares que salen de la cuenta.
                          </span>
                        </>
                      ) : (
                        <span style={faltaCotizacion ? ayudaError : ayudaCampo}>
                          {faltaCotizacion
                            ? "No se pudo traer el dólar oficial: cargá la cotización a mano."
                            : `Se usa el dólar oficial de la fecha del gasto${cotizacion ? ` (hoy ≈ ${formatMoney(cotizacion)})` : ""}. Tildá si conseguiste otro cambio.`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Si el saldo no llega, la cuenta pone lo que tiene y el
                      resto lo cubre una socia. El monto sale solo. */}
                  {noAlcanza && (
                    <div style={avisoFaltante}>
                      <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
                        <strong>El dinero en cuenta no alcanza.</strong> Falta
                        {faltanArs > 0 && ` ${formatMoney(faltanArs)}`}
                        {faltanArs > 0 && faltanUsd > 0 && " y"}
                        {faltanUsd > 0 && ` ${formatUSD(faltanUsd)}`}: la cuenta
                        pone {formatMoney(deCaja)} y una empresa tiene que
                        aportar <strong>{formatMoney(deEmpresa)}</strong>.
                      </p>

                      {empresaFija ? (
                        <>
                          <input
                            type="hidden"
                            name="empresa_pagadora_id"
                            value={esCompartido ? GASTO_COMPARTIDO : empresaFija}
                          />
                          <div style={campoFijo}>
                            {esCompartido
                              ? "Entre las socias (partes iguales)"
                              : (socios.find((s) => s.empresa_id === empresaFija)
                                  ?.nombre ?? "Tu empresa")}
                          </div>
                        </>
                      ) : (
                        <select
                          name="empresa_pagadora_id"
                          value={pagadora}
                          onChange={(e) => setPagadora(e.target.value)}
                          required
                          style={ui.input}
                        >
                          <option value="">Elegí qué empresa lo aporta</option>
                          {socios.map((socio) => (
                            <option key={socio.empresa_id} value={socio.empresa_id}>
                              {socio.nombre}
                            </option>
                          ))}
                          <option value={GASTO_COMPARTIDO}>
                            Entre las socias (partes iguales)
                          </option>
                        </select>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pagando con la cuenta, la empresa se pide sólo si hay faltante,
                y ahí arriba junto a la advertencia. */}
            <label
              style={{ ...field, display: pideEmpresa && !noAlcanza ? "grid" : "none" }}
            >
              <span style={labelCampo}>
                {esAjuste ? "Empresa que transfiere" : "Empresa que pagó"}
              </span>

              {!pideEmpresa ? (
                // La cuenta cubre el gasto entero: no hay socia que lo adelante.
                <div style={campoFijo}>Lo cubre el dinero en cuenta</div>
              ) : empresaFija ? (
                <>
                  {/* Un gasto que pusieron todas se conserva al editarlo: si el
                      campo fijo lo pisara con la empresa del usuario, dejaría de
                      ser compartido sin que nadie lo haya pedido. */}
                  <input
                    type="hidden"
                    name="empresa_pagadora_id"
                    value={esCompartido ? GASTO_COMPARTIDO : empresaFija}
                  />
                  <div style={campoFijo}>
                    {esCompartido
                      ? "Entre las socias (partes iguales)"
                      : (socios.find((s) => s.empresa_id === empresaFija)
                          ?.nombre ?? "Tu empresa")}
                  </div>
                  {!esCompartido && (
                    <span style={ayudaCampo}>
                      Los gastos que cargás quedan a nombre de tu empresa.
                    </span>
                  )}
                </>
              ) : (
                <select
                  name="empresa_pagadora_id"
                  value={pagadora}
                  onChange={(e) => setPagadora(e.target.value)}
                  required
                  style={ui.input}
                >
                  <option value="">Seleccionar empresa</option>
                  {socios.map((socio) => (
                    <option key={socio.empresa_id} value={socio.empresa_id}>
                      {socio.nombre}
                    </option>
                  ))}
                  {/* Un ajuste de saldo va de una socia puntual a otra: ahí no
                      hay nada que poner entre todas. */}
                  {!esAjuste && (
                    <option value={GASTO_COMPARTIDO}>
                      Entre las socias (partes iguales)
                    </option>
                  )}
                </select>
              )}
            </label>

            {/* Con la cuenta cubriendo todo no hay empresa pagadora, pero el
                campo tiene que decirlo en algún lado. */}
            {pagaCaja && !pideEmpresa && (
              <label style={field}>
                <span style={labelCampo}>Empresa que pagó</span>
                <div style={campoFijo}>Lo cubre el dinero en cuenta</div>
              </label>
            )}

            <label style={{ ...field, display: esAjuste ? "none" : "grid" }}>
              <span style={labelCampo}>Rubro</span>
              <select
                name="rubro_id"
                value={rubroId}
                onChange={(e) => cambiarRubro(e.target.value)}
                disabled={esAjuste}
                style={ui.input}
              >
                <option value="">Sin rubro</option>
                {rubros.map((rubro) => (
                  <option key={rubro.id} value={rubro.id}>
                    {rubro.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label style={field}>
              <span style={labelCampo}>Tipo de gasto</span>
              <select
                name="tipo_gasto"
                value={tipoGasto}
                onChange={(e) => cambiarTipoGasto(e.target.value)}
                style={ui.input}
              >
                {tiposDisponibles.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>

              {rubroElegido && tiposDisponibles.length < TIPOS_GASTO.length && (
                <span style={ayudaCampo}>
                  En {rubroElegido.nombre} sólo se carga{" "}
                  {rubroElegido.usaMateriales ? "material" : "mano de obra"}.
                  Cambialo en la solapa Rubros si hace falta.
                </span>
              )}
            </label>

            {esAjuste && (
              <label style={field}>
                <span style={labelCampo}>Empresa que recibe</span>
                <select
                  name="empresa_receptora_id"
                  value={receptora}
                  onChange={(e) => setReceptora(e.target.value)}
                  required
                  style={ui.input}
                >
                  <option value="">Seleccionar empresa</option>
                  {otrasSocias.map((socio) => (
                    <option key={socio.empresa_id} value={socio.empresa_id}>
                      {socio.nombre}
                    </option>
                  ))}
                </select>
                <span style={ayudaCampo}>
                  A quién se le transfiere para nivelar.
                </span>
              </label>
            )}

            <div style={{ ...field, display: esAjuste ? "none" : "grid" }}>
              <span style={labelCampo}>{rotuloProveedor.label}</span>

              <select
                name="proveedor_id"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                disabled={esAjuste}
                style={ui.input}
              >
                <option value="">Sin especificar</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
                <option value={NUEVO}>+ Agregar nuevo</option>
              </select>

              {agregandoNuevo && (
                <input
                  type="text"
                  name="proveedor_nuevo"
                  placeholder={rotuloProveedor.placeholder}
                  required
                  autoFocus
                  style={{ ...ui.input, marginTop: "8px" }}
                />
              )}
            </div>

            <div style={fieldAncho}>
              <span style={labelCampo}>Detalle</span>

              {esAjuste ? (
                // Todos los ajustes se llaman igual: así son fáciles de
                // identificar y filtrar en el listado.
                <>
                  <input type="hidden" name="concepto" value={AJUSTE} />
                  <div style={campoFijo}>{AJUSTE}</div>
                </>
              ) : (
                <>
                  {/* Opcional: con la fecha, el rubro, el destino y el monto el
                      gasto ya está identificado. El texto queda para lo que
                      haga falta aclarar —antes era obligatorio y terminaba
                      siendo la semana escrita a mano, que ahora sale sola—. */}
                  <input
                    type="text"
                    name="concepto"
                    defaultValue={gasto?.concepto ?? ""}
                    placeholder="Opcional: qué se compró o para qué"
                    style={ui.input}
                  />
                </>
              )}
            </div>

            <label style={{ ...field, display: esAjuste ? "none" : "grid" }}>
              <span style={labelCampo}>Comprobante</span>

              {/* Se manda el tipo de factura; la empresa deriva de acá si el
                  gasto es facturado o efectivo. */}
              <input
                type="hidden"
                name="tipo_factura"
                value={comprobante === "sin" ? "" : comprobante}
              />

              <select
                value={comprobante}
                onChange={(e) => setComprobante(e.target.value)}
                style={ui.input}
              >
                {COMPROBANTES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </select>

              <span style={ayudaCampo}>
                {comprobante === "A"
                  ? "Discrimina IVA: da crédito fiscal."
                  : comprobante === "sin"
                    ? "Sin factura."
                    : "Con factura, pero no da crédito fiscal."}
              </span>
            </label>

            {esFacturaA && (
              <label style={field}>
                <span style={labelCampo}>Alícuota de IVA</span>
                <select
                  name="alicuota_iva"
                  value={alicuota}
                  onChange={(e) => setAlicuota(e.target.value)}
                  style={ui.input}
                >
                  {ALICUOTAS.map((a) => (
                    <option key={a} value={a}>
                      {a.replace(".", ",")}%
                    </option>
                  ))}
                </select>
                <span style={ayudaCampo}>
                  {total > 0
                    ? `De ${formatMoney(total)}, el IVA es ${formatMoney(iva)}.`
                    : "Sobre el neto, no sobre el total."}
                </span>
              </label>
            )}

            {esFacturaA && (
              <label style={field}>
                <span style={labelCampo}>Empresa de la factura</span>

                {empresaFija ? (
                  <>
                    <input
                      type="hidden"
                      name="empresa_factura_id"
                      value={empresaFija}
                    />
                    <div style={campoFijo}>
                      {socios.find((s) => s.empresa_id === empresaFija)?.nombre ??
                        "Tu empresa"}
                    </div>
                  </>
                ) : (
                  <select
                    name="empresa_factura_id"
                    value={titularEfectivo}
                    onChange={(e) => setEmpresaFactura(e.target.value)}
                    required
                    style={ui.input}
                  >
                    <option value="">Seleccionar empresa</option>
                    {socios.map((socio) => (
                      <option key={socio.empresa_id} value={socio.empresa_id}>
                        {socio.nombre}
                      </option>
                    ))}
                  </select>
                )}

                <span style={ayudaCampo}>
                  A nombre de quién está la factura: esa empresa computa el
                  crédito fiscal. Arranca en la que pagó.
                </span>
              </label>
            )}

            {/* Pagando con la cuenta el monto ya quedó definido arriba: lo que
                sale de cada lado ES el gasto. Pedirlo de nuevo sería cargar el
                mismo número dos veces. */}
            {!pagaCaja && (
              <>
                <label style={field}>
                  <span style={labelCampo}>Monto</span>
                  <input
                    type="number"
                    name="monto"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    required
                    style={ui.input}
                  />
                </label>

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
                      Se guarda también en pesos, a la cotización de abajo.
                    </span>
                  )}
                </label>
              </>
            )}

            {/* Pagando con la cuenta la cotización ya se pidió arriba, junto a
                los dólares que se sacan. */}
            {!pagaCaja && (
              <div style={{ ...fieldAncho, display: esAjuste ? "none" : "grid" }}>
                <span style={labelCampo}>Cotización</span>

                <label style={checkboxFila}>
                  <input
                    type="checkbox"
                    name="cotizacion_manual"
                    checked={cotizManual}
                    onChange={(e) => setCotizManual(e.target.checked)}
                  />
                  <span>Cotización personalizada</span>
                </label>

                {cotizManual ? (
                  <>
                    <input
                      type="number"
                      name="cotizacion_valor"
                      min="0"
                      step="0.01"
                      placeholder={cotizacion ? String(Math.round(cotizacion)) : "0"}
                      value={cotizValor}
                      onChange={(e) => setCotizValor(e.target.value)}
                      required
                      style={ui.input}
                    />
                    <span style={ayudaCampo}>
                      Pesos por dólar. Manda sobre todo el gasto: define su
                      equivalente en dólares.
                    </span>
                  </>
                ) : (
                  <span style={ayudaCampo}>
                    {cotizacion
                      ? `Se usa el dólar oficial de la fecha del gasto (hoy ≈ ${formatMoney(cotizacion)}). Tildá si conseguiste otro cambio.`
                      : "Se usa el dólar oficial de la fecha del gasto."}
                  </span>
                )}
              </div>
            )}

            <div style={fieldAncho}>
              <span style={labelCampo}>Comprobante / factura</span>

              {gasto?.comprobante_drive_id && !reemplazar ? (
                <div style={comprobanteActual}>
                  <span style={{ flex: 1 }}>
                    {gasto.comprobante_nombre ?? "Comprobante cargado"}
                  </span>

                  <a
                    href={`/ver/${gasto.comprobante_drive_id}`}
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
                  <span style={ayudaCampo}>
                    {gasto?.comprobante_drive_id
                      ? "Al guardar reemplaza el comprobante anterior."
                      : "Opcional. PDF, foto o escaneo de la factura del gasto."}
                  </span>
                </>
              )}
            </div>

            <label style={fieldAncho}>
              <span style={labelCampo}>Observaciones</span>
              <textarea
                name="observaciones"
                defaultValue={gasto?.observaciones ?? ""}
                placeholder="Opcional"
                style={textarea}
              />
            </label>
          </div>
        </div>

        <div style={acciones}>
          <Link href={`/obras/${slug}/gastos`} style={ui.secondaryButton}>
            Cancelar
          </Link>

          <button type="submit" style={ui.button}>
            {textoBoton}
          </button>
        </div>
      </div>

      <aside style={resumen}>
        <p style={ui.eyebrow}>Cálculo automático</p>
        <h3 style={tituloResumen}>
          {esAjuste ? "Movimiento entre socias" : "Reparto entre socias"}
        </h3>

        {esAjuste ? (
          <>
            <div style={filaTotal}>
              <span>Monto a transferir</span>
              <strong>{formatMoney(total)}</strong>
            </div>

            <div style={caja}>
              <p style={tituloCaja}>Efecto en los saldos</p>

              {!pagadora || !receptora || total <= 0 ? (
                <p style={{ margin: 0, fontSize: "14px" }}>
                  Elegí quién transfiere, quién recibe y el monto.
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
                  <strong>{nombrePagadora}</strong> le transfiere{" "}
                  <strong>{formatMoney(total)}</strong> a{" "}
                  <strong>
                    {socios.find((s) => s.empresa_id === receptora)?.nombre}
                  </strong>
                  . La deuda entre ambas baja en ese monto.
                </p>
              )}
            </div>

            <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
              Un ajuste de saldo <strong>no es un gasto de la obra</strong>: no
              suma al total gastado. Sólo mueve plata de una socia a la otra
              para emparejar lo que cada una puso.
            </p>
          </>
        ) : (
          <>
        <div style={filaDesglose}>
          <span>Comprobante</span>
          <span>
            {COMPROBANTES.find((c) => c.valor === comprobante)?.label ?? "—"}
          </span>
        </div>

        {/* Con la cuenta el total se arma sumando; sin ella, es el monto que se
            cargó a mano. */}
        {pagaCaja ? (
          <>
            {pedidoUsd > 0 && (
              <div style={filaDesglose}>
                <span>{formatUSD(pedidoUsd)} de la cuenta</span>
                <span>
                  {cotizEfectiva
                    ? formatMoney(pedidoUsd * cotizEfectiva)
                    : "falta cotización"}
                </span>
              </div>
            )}
            {pedidoArs > 0 && (
              <div style={filaDesglose}>
                <span>Pesos de la cuenta</span>
                <span>{formatMoney(pedidoArs)}</span>
              </div>
            )}
            {deEmpresa > 0 && (
              <div style={filaDesglose}>
                <span>
                  {esCompartido
                    ? "Lo ponen las socias"
                    : `Lo pone ${nombrePagadora ?? "una socia"}`}
                </span>
                <span>{formatMoney(deEmpresa)}</span>
              </div>
            )}
          </>
        ) : (
          moneda === "USD" && (
            <div style={filaDesglose}>
              <span>Cargado en dólares</span>
              <span>US$ {ingresado.toLocaleString("es-AR")}</span>
            </div>
          )
        )}

        <div style={filaTotal}>
          <span>
            {!pagaCaja && moneda === "USD" ? "Equivale a" : "Monto total"}
          </span>
          <strong>{formatMoney(total)}</strong>
        </div>

        {/* La factura A discrimina IVA: se muestra el neto y cuánto de crédito
            fiscal deja este gasto. */}
        {esFacturaA && total > 0 && (
          <div style={{ marginTop: "6px" }}>
            <div style={filaDesglose}>
              <span>Neto</span>
              <span>{formatMoney(neto)}</span>
            </div>
            <div style={filaDesglose}>
              <span>IVA {alicuota.replace(".", ",")}%</span>
              <span>{formatMoney(iva)}</span>
            </div>
            <div style={filaDesglose}>
              <span>Crédito fiscal de</span>
              <span>{nombreTitular ?? "—"}</span>
            </div>
          </div>
        )}

        {pagaCaja && total > 0 && (
          <div style={{ marginTop: "6px" }}>
            <div style={filaDesglose}>
              <span>Sale de la cuenta</span>
              <span>{formatMoney(deCaja)}</span>
            </div>
            <div style={filaDesglose}>
              <span>Queda en cuenta</span>
              {/* Lo que sale de verdad, no lo pedido: si no alcanzaba, la
                  cuenta se vacía y el resto lo puso una socia. */}
              <span>
                {formatMoney(Math.max(dispArs, 0) - pago.ars)} y{" "}
                {formatUSD(Math.max(dispUsd, 0) - pago.usd)}
              </span>
            </div>
          </div>
        )}


        <table style={{ ...ui.table, marginTop: "16px" }}>
          <thead>
            <tr>
              <th style={thChico}>Empresa</th>
              <th style={{ ...thChico, textAlign: "right" }}>Le toca</th>
            </tr>
          </thead>
          <tbody>
            {reparto.map((socio) => (
              <tr key={socio.empresa_id}>
                <td style={tdChico}>
                  {socio.nombre}{" "}
                  <span style={{ color: "#999999" }}>{socio.porcentaje}%</span>
                </td>
                <td style={{ ...tdChico, textAlign: "right" }}>
                  {formatMoney(socio.leCorresponde)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={caja}>
          <p style={tituloCaja}>Efecto en los saldos</p>

          {total <= 0 || (!pagadora && deEmpresa > 0.01) ? (
            <p style={{ margin: 0, fontSize: "14px" }}>
              Elegí la empresa que pagó y cargá el monto para ver la
              compensación.
            </p>
          ) : deEmpresa <= 0.01 ? (
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
              Lo paga entero el dinero en cuenta, así que{" "}
              <strong>no cambia lo que puso ninguna socia</strong>. El gasto sí
              se reparte entre todas según su participación.
            </p>
          ) : esCompartido ? (
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
              Lo ponen todas en partes iguales:{" "}
              <strong>{formatMoney(porSocia)}</strong> cada una.
              {deCaja > 0 &&
                ` Los otros ${formatMoney(deCaja)} salen del dinero en cuenta y no se le suman a ninguna.`}
              {repartoParejo
                ? " Como participan por partes iguales, los saldos entre ellas no se mueven."
                : " Como las participaciones no son iguales, la diferencia contra lo que le toca a cada una queda en su saldo."}
            </p>
          ) : deCaja > 0 ? (
            // Con la caja de por medio no se puede decir "A le debe X a B": la
            // pagadora sólo adelantó su parte, no el gasto entero.
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
              <strong>{nombrePagadora}</strong> adelanta{" "}
              <strong>{formatMoney(deEmpresa)}</strong> de su bolsillo. Los
              otros {formatMoney(deCaja)} salen del dinero en cuenta y no se le
              suman a ninguna socia. A cada una le toca lo que dice el cuadro
              de arriba.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", lineHeight: 1.7 }}>
              {reparto
                .filter((s) => !s.esPagadora)
                .map((socio) => (
                  <li key={socio.empresa_id}>
                    {socio.nombre} le debe{" "}
                    <strong>{formatMoney(socio.leCorresponde)}</strong> a{" "}
                    {nombrePagadora}.
                  </li>
                ))}
            </ul>
          )}
        </div>

        {cotizado > 0 && (
          <div style={sePasa ? cajaExcedido : caja}>
            <p style={tituloCaja}>Contra lo cotizado</p>

            <div style={filaDesglose}>
              <span>Cotizado y aprobado</span>
              <span>{formatMoney(cotizado)}</span>
            </div>
            <div style={filaDesglose}>
              <span>Gastado con este</span>
              <span>{formatMoney(acumulado)}</span>
            </div>

            {sePasa ? (
              <p style={{ margin: "12px 0 0", fontSize: "14px", lineHeight: 1.6 }}>
                Este gasto deja el rubro{" "}
                <strong>{formatMoney(acumulado - cotizado)}</strong> por encima
                de lo cotizado
                {presupuesto?.proveedor ? ` por ${presupuesto.proveedor}` : ""}.
                Se puede guardar igual: revisá si corresponde.
              </p>
            ) : (
              <p style={{ margin: "12px 0 0", fontSize: "14px", lineHeight: 1.6 }}>
                Queda {formatMoney(cotizado - acumulado)} de margen
                {presupuesto?.proveedor
                  ? ` sobre lo que cotizó ${presupuesto.proveedor}`
                  : ""}
                .
              </p>
            )}
          </div>
        )}

        <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
          El gasto se registra por el 100%. El reparto sale del porcentaje de
          participación de cada socia en esta obra.
        </p>
          </>
        )}
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

const field = {
  display: "grid",
  gap: "8px",
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

const quitarLabel = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "14px",
  color: "#555555",
  cursor: "pointer",
};

const ayudaError = {
  fontSize: "13px",
  color: "#b91c1c",
};

// El faltante se avisa en rojo porque cambia quién pone la plata: no es un
// detalle de formato, es una empresa que queda comprometida.
const avisoFaltante = {
  border: "1px solid #b91c1c",
  color: "#b91c1c",
  padding: "14px",
  marginTop: "8px",
  fontSize: "14px",
  display: "grid",
  gap: "4px",
};

const checkboxFila = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  border: "1px solid #dcdcdc",
  background: "#ffffff",
  padding: "12px",
  fontSize: "14px",
  cursor: "pointer",
};

const campoFijo = {
  border: "1px solid #eeeeee",
  background: "#fafafa",
  padding: "12px",
  fontSize: "14px",
  color: "#111111",
};

const caja = {
  border: "1px solid #111111",
  padding: "16px",
  marginTop: "20px",
};

// Pasarse del presupuesto no impide guardar, pero tiene que saltar a la vista.
const cajaExcedido = {
  border: "1px solid #b91c1c",
  color: "#b91c1c",
  padding: "16px",
  marginTop: "20px",
};

const tituloCaja = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#555555",
  margin: "0 0 10px",
};

const thChico = {
  textAlign: "left" as const,
  fontSize: "11px",
  color: "#777777",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  borderBottom: "1px solid #e5e5e5",
  padding: "8px 0",
};

const tdChico = {
  borderBottom: "1px solid #f2f2f2",
  padding: "10px 0",
  fontSize: "14px",
  color: "#333333",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
