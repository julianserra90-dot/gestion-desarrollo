import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  avances,
  documentos,
  formatMoney,
  fotos,
  gastos,
  obras,
} from "@/data/mockData";

export default async function ReportesPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;

  const obra = obras.find((item) => item.id === obraId);
  const gastosObra = gastos.filter((gasto) => gasto.obraId === obraId);
  const avancesObra = avances.filter((avance) => avance.obraId === obraId);
  const documentosObra = documentos.filter((doc) => doc.obraId === obraId);
  const fotosObra = fotos.filter((foto) => foto.obraId === obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const totalGastado = gastosObra.reduce((acc, gasto) => acc + gasto.monto, 0);

  const pagadoEmpresaA = gastosObra
    .filter((gasto) => gasto.empresaPagadora === "Empresa A")
    .reduce((acc, gasto) => acc + gasto.monto, 0);

  const pagadoEmpresaB = gastosObra
    .filter((gasto) => gasto.empresaPagadora === "Empresa B")
    .reduce((acc, gasto) => acc + gasto.monto, 0);

  const correspondeCadaEmpresa = totalGastado / 2;
  const diferenciaEmpresaA = pagadoEmpresaA - correspondeCadaEmpresa;
  const diferenciaEmpresaB = pagadoEmpresaB - correspondeCadaEmpresa;

  const textoCompensacion =
    diferenciaEmpresaA > 0
      ? `Empresa B debe compensar ${formatMoney(
          Math.abs(diferenciaEmpresaA)
        )} a Empresa A.`
      : diferenciaEmpresaB > 0
      ? `Empresa A debe compensar ${formatMoney(
          Math.abs(diferenciaEmpresaB)
        )} a Empresa B.`
      : "Las empresas están equilibradas.";

  const avanceFisico =
    avancesObra.length > 0
      ? Math.round(
          avancesObra.reduce((acc, item) => acc + item.avance, 0) /
            avancesObra.length
        )
      : 0;

  const avanceFinanciero =
    obra.gastoTotal > 0 ? Math.round((totalGastado / obra.gastoTotal) * 100) : 0;

  const totalFotos = fotosObra.reduce((acc, foto) => acc + foto.cantidad, 0);

  const rubros = Array.from(new Set(gastosObra.map((gasto) => gasto.rubro)));

  const gastoPorRubro = rubros.map((rubro) => {
    const total = gastosObra
      .filter((gasto) => gasto.rubro === rubro)
      .reduce((acc, gasto) => acc + gasto.monto, 0);

    const porcentaje = totalGastado > 0 ? Math.round((total / totalGastado) * 100) : 0;

    return {
      rubro,
      total,
      porcentaje,
    };
  });

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Reportes</h2>
          <p style={subtitle}>
            Lectura general de gastos, compensación entre empresas, avance físico
            y documentación cargada.
          </p>
        </div>

        <Link href={`/obras/${obra.id}`} style={backLink}>
          Volver al resumen
        </Link>
      </header>

      <section style={statsGrid}>
        <div style={statCard}>
          <p style={label}>Total gastado</p>
          <h3 style={number}>{formatMoney(totalGastado)}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>Empresa A pagó</p>
          <h3 style={number}>{formatMoney(pagadoEmpresaA)}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>Empresa B pagó</p>
          <h3 style={number}>{formatMoney(pagadoEmpresaB)}</h3>
        </div>

        <div style={statCard}>
          <p style={label}>Avance físico</p>
          <h3 style={number}>{avanceFisico}%</h3>
        </div>
      </section>

      <section style={alertPanel}>
        <div>
          <p style={eyebrow}>Compensación 50/50</p>
          <h3 style={alertTitle}>{textoCompensacion}</h3>
        </div>

        <div style={alertGrid}>
          <div>
            <span style={smallLabel}>Corresponde a cada empresa</span>
            <strong>{formatMoney(correspondeCadaEmpresa)}</strong>
          </div>

          <div>
            <span style={smallLabel}>Saldo Empresa A</span>
            <strong>{formatMoney(diferenciaEmpresaA)}</strong>
          </div>

          <div>
            <span style={smallLabel}>Saldo Empresa B</span>
            <strong>{formatMoney(diferenciaEmpresaB)}</strong>
          </div>
        </div>
      </section>

      <section style={contentLayout}>
        <div style={mainColumn}>
          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <p style={eyebrow}>Finanzas</p>
                <h3 style={sectionTitle}>Gasto por rubro</h3>
              </div>

              <Link href={`/obras/${obra.id}/gastos`} style={smallLink}>
                Ver gastos
              </Link>
            </div>

            <div style={rubrosList}>
              {gastoPorRubro.map((item) => (
                <div key={item.rubro} style={rubroRow}>
                  <div style={rubroTop}>
                    <strong>{item.rubro}</strong>
                    <span>{formatMoney(item.total)}</span>
                  </div>

                  <div style={progressBackground}>
                    <div
                      style={{
                        ...progressFill,
                        width: `${item.porcentaje}%`,
                      }}
                    />
                  </div>

                  <p style={percentageText}>{item.porcentaje}% del gasto cargado</p>
                </div>
              ))}
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <p style={eyebrow}>Avance</p>
                <h3 style={sectionTitle}>Físico vs financiero</h3>
              </div>

              <Link href={`/obras/${obra.id}/avances`} style={smallLink}>
                Ver avances
              </Link>
            </div>

            <div style={comparisonGrid}>
              <div style={comparisonCard}>
                <p style={label}>Avance físico</p>
                <h3 style={bigNumber}>{avanceFisico}%</h3>
                <div style={progressBackground}>
                  <div
                    style={{
                      ...progressFill,
                      width: `${avanceFisico}%`,
                    }}
                  />
                </div>
              </div>

              <div style={comparisonCard}>
                <p style={label}>Avance financiero</p>
                <h3 style={bigNumber}>{avanceFinanciero}%</h3>
                <div style={progressBackground}>
                  <div
                    style={{
                      ...progressFill,
                      width: `${avanceFinanciero}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <p style={note}>
              Si el avance financiero es mucho mayor que el avance físico, puede
              indicar que la obra está consumiendo presupuesto más rápido de lo
              esperado.
            </p>
          </section>
        </div>

        <aside style={sidePanel}>
          <p style={eyebrow}>Resumen documental</p>
          <h3 style={sideTitle}>Control de obra</h3>

          <div style={sideRow}>
            <span>Documentos</span>
            <strong>{documentosObra.length}</strong>
          </div>

          <div style={sideRow}>
            <span>Registros fotográficos</span>
            <strong>{fotosObra.length}</strong>
          </div>

          <div style={sideRow}>
            <span>Fotos cargadas</span>
            <strong>{totalFotos}</strong>
          </div>

          <div style={sideRow}>
            <span>Rubros con avance</span>
            <strong>{avancesObra.length}</strong>
          </div>

          <div style={exportBox}>
            <p style={eyebrow}>Exportación</p>
            <button style={exportButton}>Exportar PDF</button>
            <button style={secondaryExportButton}>Exportar Excel</button>
          </div>

          <p style={note}>
            Por ahora los botones son visuales. Más adelante se puede generar un
            PDF para socios o un Excel para contabilidad.
          </p>
        </aside>
      </section>
    </AppShell>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #e5e5e5",
  paddingBottom: "24px",
  marginBottom: "32px",
};

const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

const title = {
  fontSize: "36px",
  fontWeight: 400,
  margin: "8px 0",
};

const subtitle = {
  color: "#666666",
  margin: 0,
  maxWidth: "680px",
  lineHeight: 1.5,
};

const backLink = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
  paddingBottom: "4px",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "16px",
  marginBottom: "24px",
};

const statCard = {
  border: "1px solid #e5e5e5",
  padding: "22px",
};

const label = {
  fontSize: "13px",
  color: "#777777",
  margin: 0,
};

const number = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "10px 0 0",
};

const alertPanel = {
  border: "1px solid #111111",
  padding: "24px",
  marginBottom: "24px",
  display: "grid",
  gridTemplateColumns: "1.1fr 1fr",
  gap: "24px",
  alignItems: "center",
};

const alertTitle = {
  fontSize: "24px",
  fontWeight: 400,
  lineHeight: 1.35,
  margin: "10px 0 0",
};

const alertGrid = {
  display: "grid",
  gap: "12px",
};

const smallLabel = {
  display: "block",
  color: "#777777",
  fontSize: "13px",
  marginBottom: "6px",
};

const contentLayout = {
  display: "grid",
  gridTemplateColumns: "1fr 320px",
  gap: "24px",
  alignItems: "start",
};

const mainColumn = {
  display: "grid",
  gap: "24px",
};

const panel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
};

const panelHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #eeeeee",
  paddingBottom: "18px",
  marginBottom: "20px",
};

const sectionTitle = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "8px 0 0",
};

const smallLink = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
  paddingBottom: "4px",
  fontSize: "14px",
};

const rubrosList = {
  display: "grid",
  gap: "18px",
};

const rubroRow = {
  display: "grid",
  gap: "10px",
};

const rubroTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
};

const progressBackground = {
  height: "8px",
  background: "#eeeeee",
};

const progressFill = {
  height: "8px",
  background: "#111111",
};

const percentageText = {
  color: "#777777",
  fontSize: "13px",
  margin: 0,
};

const comparisonGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "16px",
};

const comparisonCard = {
  border: "1px solid #eeeeee",
  padding: "18px",
};

const bigNumber = {
  fontSize: "32px",
  fontWeight: 400,
  margin: "10px 0 18px",
};

const sidePanel = {
  border: "1px solid #e5e5e5",
  padding: "22px",
  position: "sticky" as const,
  top: "24px",
};

const sideTitle = {
  fontSize: "22px",
  fontWeight: 400,
  margin: "10px 0 22px",
};

const sideRow = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
  marginTop: "12px",
};

const exportBox = {
  borderTop: "1px solid #eeeeee",
  marginTop: "24px",
  paddingTop: "20px",
  display: "grid",
  gap: "10px",
};

const exportButton = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "11px",
  cursor: "pointer",
};

const secondaryExportButton = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "11px",
  cursor: "pointer",
};

const note = {
  color: "#777777",
  fontSize: "14px",
  lineHeight: 1.5,
  marginTop: "20px",
};