import Link from "next/link";
import AppShell from "@/components/AppShell";
import InversorForm from "@/components/InversorForm";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { formatDate, formatMoney, formatUSD } from "@/lib/format";
import { getInversor } from "@/lib/inversores";
import { getObraPorSlug } from "@/lib/obras";
import { createClient } from "@/lib/supabase/server";
import { actualizarInversor, eliminarInversor } from "../../actions";

/**
 * La ficha: por cuánto firmó, cuánto puso y con qué aportes lo fue poniendo.
 *
 * La lista de abajo es lo que hace útil al saldo: sin ver los aportes uno a
 * uno, un "resta poner" que no cierra no hay forma de auditarlo.
 */
export default async function EditarInversorPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; inversorId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId, inversorId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const inversor = await getInversor(obra.id, inversorId);

  if (!inversor) {
    return <AppShell>Inversor no encontrado</AppShell>;
  }

  const supabase = await createClient();

  const { data: aportes } = await supabase
    .from("ingresos")
    .select("id, fecha, concepto, moneda, monto, monto_usd")
    .eq("obra_id", obra.id)
    .eq("inversor_id", inversorId)
    .order("fecha", { ascending: false });

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="inversores" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>{inversor.nombreCompleto}</h2>
      </section>

      <InversorForm
        action={actualizarInversor}
        obraId={obra.id}
        slug={obra.slug}
        error={error}
        inversor={{
          id: inversor.id,
          tipo: inversor.tipo,
          nombre: inversor.nombre,
          apellido: inversor.apellido,
          comprometido_ars: inversor.comprometidoArs,
          comprometido_usd: inversor.comprometidoUsd,
          observaciones: inversor.observaciones,
        }}
        aportado={{ ars: inversor.aportadoArs, usd: inversor.aportadoUsd }}
        textoBoton="Guardar cambios"
      />

      <div style={ui.toolbar}>
        <h3 style={ui.sectionTitle}>Sus aportes</h3>
      </div>

      <section style={ui.panel}>
        {(aportes ?? []).length === 0 ? (
          <p style={ui.vacio}>
            Todavía no puso nada. Los aportes se cargan en Ingresos, eligiéndolo
            a él como quien aporta.
          </p>
        ) : (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Fecha</th>
                <th style={ui.th}>Detalle</th>
                <th style={ui.thRight}>Monto</th>
                <th style={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {(aportes ?? []).map((a) => (
                <tr key={a.id}>
                  <td style={{ ...ui.td, ...compacta }}>{formatDate(a.fecha)}</td>
                  <td style={ui.td}>{a.concepto}</td>
                  {/* En la moneda en que se aportó, no valuado: es la moneda en
                      la que descuenta. */}
                  <td style={ui.tdRight}>
                    {a.moneda === "USD"
                      ? formatUSD(Number(a.monto_usd ?? 0))
                      : formatMoney(Number(a.monto))}
                  </td>
                  <td style={ui.td}>
                    <Link
                      href={`/obras/${obra.slug}/ingresos/${a.id}/editar`}
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

      <section style={panelRiesgo}>
        <h3 style={ui.sectionTitle}>Dar de baja</h3>

        <p style={{ ...ui.text, marginBottom: "16px" }}>
          Se borra la ficha de la agenda. Los aportes ya cargados no se tocan:
          justamente por eso, si tiene alguno la base no deja borrarla. Primero
          hay que resolver esos ingresos.
        </p>

        <form action={eliminarInversor}>
          <input type="hidden" name="inversor_id" value={inversor.id} />
          <input type="hidden" name="slug" value={obra.slug} />
          <button type="submit" style={botonPeligro}>
            Eliminar definitivamente
          </button>
        </form>
      </section>
    </AppShell>
  );
}

const compacta = { whiteSpace: "nowrap" as const };

const editarLink = {
  color: "#111111",
  fontSize: "14px",
  textDecoration: "underline",
};

const panelRiesgo = {
  border: "1px solid #111111",
  padding: "24px",
  marginTop: "32px",
};

const botonPeligro = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};
