import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonDescarga from "@/components/BotonDescarga";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

export default async function GastosPage({
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
  const { data: gastos } = await supabase
    .from("gastos")
    .select(
      "id, fecha, concepto, monto, monto_caja, tipo_gasto, tipo_pago, estado, comprobante_drive_id, rubros(nombre), proveedores(nombre), pagadora:empresas!gastos_empresa_pagadora_id_fkey(nombre), receptora:empresas!gastos_empresa_receptora_id_fkey(nombre)"
    )
    .eq("obra_id", obra.id)
    .order("fecha", { ascending: false });

  const lista = gastos ?? [];

  // Los ajustes de saldo no son gasto de obra: se muestran en el listado pero
  // no suman a los totales.
  const vigentes = lista.filter(
    (g) => g.estado !== "Anulado" && g.tipo_gasto !== "Ajuste de saldo"
  );

  const total = vigentes.reduce((acc, g) => acc + Number(g.monto), 0);

  const totalFacturado = vigentes
    .filter((g) => g.tipo_pago === "Facturado")
    .reduce((acc, g) => acc + Number(g.monto), 0);

  const totalEfectivo = vigentes
    .filter((g) => g.tipo_pago === "Efectivo")
    .reduce((acc, g) => acc + Number(g.monto), 0);

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="gastos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Gastos</h2>
        <p style={ui.subtitle}>
          Cada gasto se carga por el total y se reparte entre las empresas
          socias según su participación.
        </p>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Total gastado</p>
          <h3 style={ui.statNumber}>{formatMoney(total)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Facturado</p>
          <h3 style={ui.statNumber}>{formatMoney(totalFacturado)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>En efectivo</p>
          <h3 style={ui.statNumber}>{formatMoney(totalEfectivo)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Gastos cargados</p>
          <h3 style={ui.statNumber}>{vigentes.length}</h3>
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Listado de gastos</h3>

        <Link href={`/obras/${obra.slug}/gastos/nuevo`} style={ui.button}>
          Nuevo gasto
        </Link>
      </div>

      <section style={ui.panel}>
        {lista.length === 0 ? (
          <p style={ui.vacio}>
            Todavía no hay gastos cargados en esta obra.
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Rubro</th>
                <th style={ui.th}>Tipo</th>
                <th style={ui.th}>Proveedor / Contratista</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.th}>Tipo de pago</th>
                <th style={ui.th}>Pagó</th>
                <th style={ui.th}>Comprob.</th>
                <th style={ui.thRight}>Monto</th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((gasto) => {
                const anulado = gasto.estado === "Anulado";
                const ajuste = gasto.tipo_gasto === "Ajuste de saldo";
                const celda = anulado
                  ? tdAnulado
                  : ajuste
                    ? tdAjuste
                    : ui.td;

                return (
                <tr key={gasto.id} style={ajuste && !anulado ? filaAjuste : undefined}>
                  <td style={celda}>{formatDate(gasto.fecha)}</td>
                  <td style={celda}>{gasto.rubros?.nombre ?? "—"}</td>
                  <td style={celda}>
                    {ajuste ? (
                      <span style={tagAjuste}>Ajuste de saldo</span>
                    ) : (
                      gasto.tipo_gasto
                    )}
                  </td>
                  <td style={celda}>
                    {ajuste
                      ? `→ ${gasto.receptora?.nombre ?? "—"}`
                      : (gasto.proveedores?.nombre ?? "—")}
                  </td>
                  <td style={celda}>
                    {gasto.concepto}
                    {anulado && <span style={tagAnulado}>Anulado</span>}
                  </td>
                  <td style={celda}>
                    {ajuste ? (
                      "—"
                    ) : (
                      <span
                        style={
                          gasto.tipo_pago === "Efectivo" ? tagEfectivo : tagFacturado
                        }
                      >
                        {gasto.tipo_pago}
                      </span>
                    )}
                  </td>
                  <td style={celda}>
                    {/* Un gasto puede salir de la caja, de una socia, o de
                        las dos cuando la caja no alcanzaba. */}
                    {Number(gasto.monto_caja) >= Number(gasto.monto) ? (
                      <span style={tagCuenta}>Dinero en cuenta</span>
                    ) : Number(gasto.monto_caja) > 0 ? (
                      <>
                        {gasto.pagadora?.nombre ?? "—"}
                        <div style={aporteCuenta}>
                          + {formatMoney(gasto.monto_caja)} de la cuenta
                        </div>
                      </>
                    ) : (
                      (gasto.pagadora?.nombre ?? "—")
                    )}
                  </td>
                  <td style={celda}>
                    {gasto.comprobante_drive_id ? (
                      <div style={accionesArchivo}>
                        <Link
                          href={`/ver/${gasto.comprobante_drive_id}?volver=${encodeURIComponent(
                            `/obras/${obra.slug}/gastos`
                          )}`}
                          style={comprobanteLink}
                        >
                          Ver
                        </Link>
                        <BotonDescarga
                          fileId={gasto.comprobante_drive_id}
                          variante="icono"
                          etiqueta={`Descargar comprobante de ${gasto.concepto}`}
                        />
                      </div>
                    ) : (
                      <span style={{ color: "#bbbbbb" }}>—</span>
                    )}
                  </td>
                  <td style={anulado ? tdAnuladoRight : ui.tdRight}>
                    <strong>{formatMoney(gasto.monto)}</strong>
                  </td>
                  <td style={celda}>
                    <Link
                      href={`/obras/${obra.slug}/gastos/${gasto.id}/editar`}
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
        )}
      </section>
    </AppShell>
  );
}

const accionesArchivo = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

// El ajuste se distingue con un fondo apenas gris y un borde negro al costado:
// se nota que es distinto sin gritar.
const filaAjuste = {
  background: "#fafafa",
};

const tdAjuste = {
  ...ui.td,
  borderBottom: "1px solid #e0e0e0",
};

const tagAjuste = {
  border: "1px solid #111111",
  background: "#111111",
  color: "#ffffff",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tagCuenta = {
  border: "1px solid #dcdcdc",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const aporteCuenta = {
  fontSize: "13px",
  color: "#999999",
  marginTop: "4px",
};

const tdAnulado = {
  ...ui.td,
  color: "#aaaaaa",
  textDecoration: "line-through" as const,
};

const tdAnuladoRight = {
  ...tdAnulado,
  textAlign: "right" as const,
};

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

const tagFacturado = {
  border: "1px solid #dcdcdc",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tagEfectivo = {
  ...tagFacturado,
  border: "1px solid #111111",
  background: "#111111",
  color: "#ffffff",
};

const comprobanteLink = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
};
