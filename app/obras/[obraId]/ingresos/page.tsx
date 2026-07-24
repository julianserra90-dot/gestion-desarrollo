import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonDescarga from "@/components/BotonDescarga";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCaja } from "@/lib/caja";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: ingresos }, caja] = await Promise.all([
    supabase
      .from("ingresos")
      .select(
        "id, fecha, origen, aportante, concepto, monto, monto_usd, moneda, comprobante_drive_id, empresas(nombre)"
      )
      .eq("obra_id", obra.id)
      .order("fecha", { ascending: false }),
    getCaja(obra.id),
  ]);

  const lista = ingresos ?? [];

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="ingresos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Control de obra</p>
        <h2 style={ui.pageTitle}>Ingreso de fondos</h2>
        <p style={ui.subtitle}>
          La plata que entra a la obra: aportes de las socias, inversores y
          compradores de unidades. Todo suma al dinero en cuenta.
        </p>
      </section>

      <section style={ui.statsGrid}>
        <div style={ui.statCard}>
          <p style={ui.label}>Total ingresado</p>
          <h3 style={ui.statNumber}>{formatMoney(caja.ingresos)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Aportes de socias</p>
          <h3 style={ui.statNumber}>{formatMoney(caja.ingresosSocias)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Inversores y compradores</p>
          <h3 style={ui.statNumber}>{formatMoney(caja.ingresosTerceros)}</h3>
        </div>
        <div style={ui.statCard}>
          <p style={ui.label}>Dinero en cuenta</p>
          <h3 style={ui.statNumber}>{formatMoney(caja.arsSaldo)}</h3>
          <p style={{ ...ui.note, margin: "6px 0 0" }}>
            {formatUSD(caja.usdSaldo)}
          </p>
        </div>
      </section>

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Listado de ingresos</h3>

        <Link href={`/obras/${obra.slug}/ingresos/nuevo`} style={ui.button}>
          Nuevo ingreso
        </Link>
      </div>

      <section style={ui.panel}>
        {lista.length === 0 ? (
          <p style={ui.vacio}>
            Todavía no hay ingresos cargados en esta obra.
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Origen</th>
                <th style={ui.th}>Quién</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.th}>Comprob.</th>
                <th style={ui.thRight}>Monto</th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((ingreso) => (
                <tr key={ingreso.id}>
                  <td style={ui.td}>{formatDate(ingreso.fecha)}</td>
                  <td style={ui.td}>
                    <span
                      style={
                        ingreso.origen === "Empresa socia" ? tagSocia : tagTercero
                      }
                    >
                      {ingreso.origen}
                    </span>
                  </td>
                  <td style={ui.td}>
                    {ingreso.empresas?.nombre ?? ingreso.aportante ?? "—"}
                  </td>
                  <td style={ui.td}>{ingreso.concepto}</td>
                  <td style={ui.td}>
                    {ingreso.comprobante_drive_id ? (
                      <div style={accionesArchivo}>
                        <Link
                          href={`/ver/${ingreso.comprobante_drive_id}?volver=${encodeURIComponent(
                            `/obras/${obra.slug}/ingresos`
                          )}`}
                          style={comprobanteLink}
                        >
                          Ver
                        </Link>
                        <BotonDescarga
                          fileId={ingreso.comprobante_drive_id}
                          variante="icono"
                          etiqueta={`Descargar comprobante de ${ingreso.concepto}`}
                        />
                      </div>
                    ) : (
                      <span style={{ color: "#bbbbbb" }}>—</span>
                    )}
                  </td>
                  <td style={ui.tdRight}>
                    <strong>{formatMoney(ingreso.monto)}</strong>
                    {ingreso.moneda === "USD" && (
                      <div style={montoOriginal}>
                        {formatUSD(ingreso.monto_usd)}
                      </div>
                    )}
                  </td>
                  <td style={ui.td}>
                    <Link
                      href={`/obras/${obra.slug}/ingresos/${ingreso.id}/editar`}
                      style={editarLink}
                    >
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

const accionesArchivo = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const tagSocia = {
  border: "1px solid #111111",
  background: "#111111",
  color: "#ffffff",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const tagTercero = {
  border: "1px solid #dcdcdc",
  padding: "3px 8px",
  fontSize: "12px",
  whiteSpace: "nowrap" as const,
};

const montoOriginal = {
  fontSize: "13px",
  color: "#999999",
  marginTop: "4px",
};

const editarLink = {
  color: "#111111",
  fontSize: "14px",
  textDecoration: "underline",
};

const comprobanteLink = {
  color: "#111111",
  textDecoration: "underline",
  fontSize: "14px",
};
