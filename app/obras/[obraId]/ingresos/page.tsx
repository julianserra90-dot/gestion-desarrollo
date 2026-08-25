import Link from "next/link";
import AppShell from "@/components/AppShell";
import EtiquetaComprobante from "@/components/EtiquetaComprobante";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCaja } from "@/lib/caja";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { nombreCompleto } from "@/lib/inversores";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

/**
 * La plata que entra a la obra y la cuenta donde queda, en una sola solapa.
 *
 * Ingresos y Dinero en cuenta eran dos pantallas de lo mismo: todo ingreso
 * suma a la cuenta, y la lista de movimientos de la cuenta repetía el listado
 * de ingresos entero. Acá queda una sola historia: cómo están los dos lados de
 * la cuenta (los pesos quedan pesos y los dólares quedan dólares hasta que se
 * usan) y qué movimientos la dejaron así.
 */

type Movimiento = {
  id: string;
  fecha: string;
  orden: string;
  entrada: boolean;
  etiqueta: string;
  detalle: string;
  quien: string;
  /** Positivo si entra, negativo si sale. */
  ars: number;
  usd: number;
  href: string;
  tipoFactura: string | null;
  comprobanteDriveId: string | null;
};

export default async function IngresosPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const [{ data: ingresos }, { data: gastos }, caja] = await Promise.all([
    supabase
      .from("ingresos")
      .select(
        "id, fecha, creado_en, origen, aportante, concepto, monto, monto_usd, moneda, comprobante_drive_id, empresas(nombre), inversores(nombre, apellido)"
      )
      .eq("obra_id", obra.id),
    // Sólo los gastos que efectivamente tocaron la cuenta.
    supabase
      .from("gastos")
      .select(
        "id, fecha, creado_en, concepto, monto, caja_ars, caja_usd, cotizacion, monto_caja, tipo_factura, comprobante_drive_id, proveedores(nombre)"
      )
      .eq("obra_id", obra.id)
      .eq("estado", "Pagado")
      .or("caja_ars.gt.0,caja_usd.gt.0"),
    getCaja(obra.id),
  ]);

  const volver = `/obras/${obra.slug}/ingresos`;

  const movimientos: Movimiento[] = [
    ...(ingresos ?? []).map((i) => ({
      id: `i-${i.id}`,
      fecha: i.fecha,
      orden: i.creado_en,
      entrada: true,
      etiqueta: i.origen,
      detalle: i.concepto,
      // El nombre sale de la agenda; `aportante` queda de respaldo para los
      // ingresos viejos, cargados antes de que la agenda existiera.
      quien:
        i.empresas?.nombre ??
        (i.inversores
          ? nombreCompleto(i.inversores.nombre, i.inversores.apellido)
          : null) ??
        i.aportante ??
        "—",
      // Un aporte en dólares queda en dólares; uno en pesos, en pesos.
      ars: i.moneda === "USD" ? 0 : Number(i.monto),
      usd: i.moneda === "USD" ? Number(i.monto_usd ?? 0) : 0,
      href: `/obras/${obra.slug}/ingresos/${i.id}/editar`,
      tipoFactura: null,
      comprobanteDriveId: i.comprobante_drive_id,
    })),
    ...(gastos ?? []).map((g) => ({
      id: `g-${g.id}`,
      fecha: g.fecha,
      orden: g.creado_en,
      entrada: false,
      // Un gasto pagado en parte con la cuenta se aclara, para que no parezca
      // que la cuenta se hizo cargo de todo.
      etiqueta:
        Number(g.monto_caja) < Number(g.monto) ? "Gasto (parcial)" : "Gasto",
      // El detalle del gasto es opcional; sin esto la celda queda muda y
      // parece un dato que faltó cargar.
      detalle: g.concepto ?? "Sin detalle",
      quien: g.proveedores?.nombre ?? "—",
      ars: -Number(g.caja_ars),
      usd: -Number(g.caja_usd),
      href: `/obras/${obra.slug}/gastos/${g.id}/editar`,
      tipoFactura: g.tipo_factura,
      comprobanteDriveId: g.comprobante_drive_id,
    })),
  ];

  // Del más nuevo al más viejo: lo último que pasó es lo que se viene a ver.
  movimientos.sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || b.orden.localeCompare(a.orden)
  );

  // Los dólares que se vendieron para pagar gastos rindieron más (o menos) que
  // su valor de entrada. Esa diferencia le queda a la obra, no a quien los puso.
  const usadoDeDolares = (gastos ?? []).reduce(
    (acc, g) => acc + Number(g.caja_usd) * Number(g.cotizacion ?? 0),
    0
  );

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="ingresos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Ingresos</h2>
      </section>

      {/* Cuatro tarjetas y no una: son **dos cuentas distintas**, cada una en
          su moneda. Un aporte en dólares no se valúa en pesos para mostrarlo,
          porque los dólares siguen siendo dólares hasta que un gasto los use
          —y ahí el cambio lo pone el gasto, no Ámbito—. Antes las tarjetas de
          arriba estaban todas en pesos y un ingreso de US$ 5.000 aparecía como
          $ 7.725.000, que es un número que no existe en ningún lado. */}
      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Cuenta en pesos</p>
          <h3 style={{ ...ui.statNumber, color: ui.VERDE }}>
            {formatMoney(caja.arsSaldo)}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Cuenta en dólares</p>
          <h3 style={{ ...ui.statNumber, color: ui.VERDE }}>
            {formatUSD(caja.usdSaldo)}
          </h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Gastos en pesos</p>
          <h3 style={ui.statNumber}>{formatMoney(caja.arsUsado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Gastos en dólares</p>
          <h3 style={ui.statNumber}>{formatUSD(caja.usdUsado)}</h3>
          {/* Lo único que sí se dice en pesos, porque es lo que realmente
              pasó: a cuánto se vendieron esos dólares al pagar. */}
          {caja.usdUsado > 0 && (
            <p style={{ ...ui.note, margin: "6px 0 0" }}>
              rindieron {formatMoney(usadoDeDolares)}
            </p>
          )}
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Movimientos</h3>

        <Link href={`/obras/${obra.slug}/ingresos/nuevo`} style={ui.button}>
          Nuevo ingreso
        </Link>
      </div>

      <section style={ui.panel}>
        {movimientos.length === 0 ? (
          <p style={ui.vacio}>
            Todavía no entró ni salió plata de la cuenta de esta obra.
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Movimiento</th>
                <th style={ui.th}>Quién</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.th}>Comprobante</th>
                <th style={ui.thRight}>Pesos</th>
                <th style={ui.thRight}>Dólares</th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((mov) => (
                <tr key={mov.id}>
                  <td style={{ ...ui.td, ...compacta }}>
                    {formatDate(mov.fecha)}
                  </td>
                  <td style={{ ...ui.td, ...compacta }}>
                    <span style={mov.entrada ? tagEntrada : tagSalida}>
                      {mov.etiqueta}
                    </span>
                  </td>
                  <td style={ui.td}>{mov.quien}</td>
                  <td style={ui.td}>{mov.detalle}</td>
                  <td style={{ ...ui.td, ...compacta }}>
                    {mov.entrada ? (
                      mov.comprobanteDriveId ? (
                        <Link
                          href={`/ver/${mov.comprobanteDriveId}?volver=${encodeURIComponent(volver)}`}
                          style={comprobanteLink}
                        >
                          Comprobante
                        </Link>
                      ) : (
                        <span style={{ color: "#bbbbbb" }}>—</span>
                      )
                    ) : (
                      <EtiquetaComprobante
                        tipoFactura={mov.tipoFactura}
                        driveId={mov.comprobanteDriveId}
                        volver={volver}
                      />
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    {mov.ars === 0 ? (
                      <span style={{ color: "#bbbbbb" }}>—</span>
                    ) : (
                      `${mov.ars > 0 ? "+" : "−"} ${formatMoney(Math.abs(mov.ars))}`
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    {mov.usd === 0 ? (
                      <span style={{ color: "#bbbbbb" }}>—</span>
                    ) : (
                      `${mov.usd > 0 ? "+" : "−"} ${formatUSD(Math.abs(mov.usd))}`
                    )}
                  </td>
                  {/* Editar en su propia columna, como en el listado de gastos.
                      Antes el enlace era el texto del detalle: nada anunciaba
                      que llevaba a un formulario, y se entraba a editar
                      creyendo que se abría la ficha. Acá conviven ingresos y
                      gastos, y cada uno va a su formulario. */}
                  <td style={ui.td}>
                    <Link href={mov.href} style={editarLink}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}

// Mismo lenguaje que las etiquetas de comprobante: colores suaves, nada de
// recuadros negros. La entrada dice su origen (socia, inversor, comprador) y
// la salida es siempre un gasto; el signo de las columnas ya marca el sentido.
const tagBase = {
  display: "inline-block",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tagEntrada = {
  ...tagBase,
  background: "#f2f2f2",
  color: "#555555",
};

const tagSalida = {
  ...tagBase,
  border: "1px solid #e5e5e5",
  color: "#777777",
};

const compacta = { whiteSpace: "nowrap" as const };

const editarLink = {
  color: "#111111",
  fontSize: "14px",
  textDecoration: "underline",
};

const comprobanteLink = {
  color: "#333333",
  textDecoration: "underline",
  fontSize: "13px",
};
