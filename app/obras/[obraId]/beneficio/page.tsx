import Link from "next/link";
import AppShell from "@/components/AppShell";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { calcularBeneficio } from "@/lib/beneficio";
import { formatUSD } from "@/lib/format";
import { getLote } from "@/lib/lote";
import { getObraPorSlug } from "@/lib/obras";
import { superficieConstruccion, superficieVenta } from "@/lib/superficies";

/**
 * Si el negocio cierra: lo que se espera vender contra lo que se espera pagar.
 *
 * Vive en Economía y no en Obra —donde estuvo un rato— porque no habla de cómo
 * va la construcción sino de si conviene: es la pregunta del desarrollador, no
 * la del director de obra.
 *
 * Es una estimación **con el plan**, no con lo que va saliendo: el valor de
 * venta se carga a mano y el costo sale del objetivo por m². Lo que va dando de
 * verdad vive en Estado, en el valor del m².
 */

export default async function BeneficioPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const lote = await getLote(
    obra.id,
    obra.lote_valor_usd,
    obra.lote_superficie_m2,
    obra.lote_vendedor,
    obra.lote_detalle
  );

  const supConstruccion = superficieConstruccion(obra);
  const supVenta = superficieVenta(obra);

  // El terreno entra por lo pactado —no por lo que se lleva pagado—, más los
  // gastos de la operación: la escribanía también se paga.
  const costoTerreno =
    (lote.valorUsd ?? lote.pagadoCompraUsd) + lote.asociadosUsd;

  const beneficio = calcularBeneficio({
    valorVentaM2Usd: obra.valor_venta_m2_usd,
    supVentaM2: supVenta,
    objetivoM2Usd: obra.valor_m2_usd,
    supConstruccionM2: supConstruccion,
    costoTerrenoUsd: costoTerreno,
  });

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="beneficio" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Situación económica</p>
        <h2 style={ui.pageTitle}>Beneficio</h2>
      </section>

      {!beneficio ? (
        /* Media cuenta es peor que ninguna: en vez de un número a medias, se
           dice qué falta cargar. */
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Para saber si el negocio cierra hacen falta el valor de venta por m²
            y el objetivo de costo, más las dos superficies. Cargalos en{" "}
            <Link href={`/obras/${obra.slug}/editar`} style={enlace}>
              Editar obra
            </Link>
            .
          </p>
        </section>
      ) : (
        <>
          <section style={ui.statsGrid}>
            {/* Las fichas son sólo los cuatro números; de dónde sale cada uno
                está en la tabla de abajo y repetirlo acá sobraba. */}
            <div style={ui.statCard}>
              <p style={ui.label}>Venta estimada</p>
              <h3 style={ui.statNumber}>{formatUSD(beneficio.ventaUsd)}</h3>
            </div>
            <div style={ui.statCard}>
              <p style={ui.label}>Costo total</p>
              <h3 style={ui.statNumber}>{formatUSD(beneficio.costoTotalUsd)}</h3>
            </div>
            <div style={ui.statCard}>
              <p style={ui.label}>Beneficio estimado</p>
              <h3
                style={{
                  ...ui.statNumber,
                  ...(beneficio.beneficioUsd < 0 ? enRojo : enVerde),
                }}
              >
                {formatUSD(beneficio.beneficioUsd)}
              </h3>
            </div>
            <div style={ui.statCard}>
              <p style={ui.label}>Margen sobre la venta</p>
              <h3
                style={{
                  ...ui.statNumber,
                  ...(beneficio.margen < 0 ? enRojo : enVerde),
                }}
              >
                {beneficio.margen}%
              </h3>
            </div>
          </section>

          <section style={ui.panelConMargen}>
            <h3 style={ui.sectionTitle}>La cuenta</h3>

            <table style={ui.table}>
              <tbody>
                {/* Cada fila dice de dónde sale su número y nada más: el
                    porqué de la cuenta vive en el comentario de arriba, no en
                    la pantalla. */}
                <tr>
                  <td style={ui.td}>
                    Venta estimada
                    <span style={aclaracion}>
                      {formatUSD(obra.valor_venta_m2_usd ?? 0)} /m² × {supVenta}{" "}
                      m² de venta
                    </span>
                  </td>
                  <td style={{ ...ui.td, ...celdaNumero }}>
                    {formatUSD(beneficio.ventaUsd)}
                  </td>
                </tr>

                <tr>
                  <td style={ui.td}>
                    Costo de obra
                    <span style={aclaracion}>
                      {formatUSD(obra.valor_m2_usd ?? 0)} /m² × {supConstruccion}{" "}
                      m² de construcción
                    </span>
                  </td>
                  <td style={{ ...ui.td, ...celdaNumero }}>
                    − {formatUSD(beneficio.costoObraUsd)}
                  </td>
                </tr>

                <tr>
                  <td style={ui.td}>Terreno</td>
                  <td style={{ ...ui.td, ...celdaNumero }}>
                    − {formatUSD(beneficio.costoTerrenoUsd)}
                  </td>
                </tr>

                <tr>
                  <td style={tdCierre}>Beneficio estimado</td>
                  <td style={{ ...tdCierre, ...celdaNumero }}>
                    <strong
                      style={beneficio.beneficioUsd < 0 ? enRojo : enVerde}
                    >
                      {formatUSD(beneficio.beneficioUsd)}
                    </strong>
                    <span style={margenTexto}>
                      {beneficio.margen}% de la venta
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Lo único que no se deduce de la tabla: que estos números son el
                plan y no lo que va saliendo. */}
            <p style={aclaracionPie}>
              Es el plan. Lo que va dando de verdad, en{" "}
              <Link href={`/obras/${obra.slug}/estado`} style={enlace}>
                Estado
              </Link>
              .
            </p>
          </section>
        </>
      )}
    </AppShell>
  );
}

// Verde el beneficio, rojo si el negocio no cierra: los mismos colores que los
// saldos entre socias en todo el resto de la app.
const enVerde = { color: "#15803d" };
const enRojo = { color: "#b00020" };

const celdaNumero = {
  textAlign: "right" as const,
};

const tdCierre = {
  padding: "14px 12px",
  borderTop: "2px solid #111111",
  color: "#111111",
  fontWeight: 600,
};

const aclaracion = {
  display: "block",
  fontSize: "13px",
  color: "#999999",
  marginTop: "4px",
  lineHeight: 1.5,
};

const margenTexto = {
  display: "block",
  fontSize: "13px",
  color: "#777777",
  marginTop: "4px",
};

const aclaracionPie = {
  fontSize: "13px",
  color: "#999999",
  marginTop: "16px",
};

const enlace = {
  color: "#111111",
  textDecoration: "underline",
};
