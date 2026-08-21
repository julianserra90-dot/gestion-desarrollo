import Link from "next/link";
import AppShell from "@/components/AppShell";
import GastoForm from "@/components/GastoForm";
import ObraHeader from "@/components/ObraHeader";
import * as ui from "@/components/ui";
import { getCaja } from "@/lib/caja";
import { getCotizacionActual } from "@/lib/dolar";
import { getObraPorSlug } from "@/lib/obras";
import {
  getPresupuestosConItems,
  getPresupuestosDeObra,
} from "@/lib/presupuestos";
import { getRubrosActivos } from "@/lib/rubros";
import { createClient } from "@/lib/supabase/server";
import { crearGasto } from "../actions";

export default async function NuevoGastoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId } = await params;
  const { error } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si el usuario pertenece a una empresa, el gasto va siempre a su nombre.
  // El admin no tiene empresa, así que puede elegir cuál pagó.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("empresa_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const [
    rubros,
    { data: socios },
    { data: proveedores },
    presupuestos,
    presupuestosConItems,
  ] = await Promise.all([
    getRubrosActivos(obra.id),
    supabase
      .from("obra_socios")
      .select("empresa_id, porcentaje, empresas(nombre)")
      .eq("obra_id", obra.id),
    supabase.from("proveedores").select("id, nombre, tipo").order("nombre"),
    getPresupuestosDeObra(obra.id),
    getPresupuestosConItems(obra.id),
  ]);

  // El catálogo de materiales, para el detalle de la factura. Es común a todas
  // las obras, igual que el de proveedores.
  const { data: materiales } = await supabase
    .from("materiales")
    .select("id, nombre, unidad, rubro_id")
    .order("nombre");

  const cotizacion = await getCotizacionActual();
  const caja = await getCaja(obra.id);

  const listaSocios = (socios ?? [])
    .map((s) => ({
      empresa_id: s.empresa_id,
      nombre: s.empresas?.nombre ?? "—",
      porcentaje: Number(s.porcentaje),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <AppShell>
      <ObraHeader obra={obra} activeSection="gastos" />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>Nuevo gasto</h2>
        <p style={ui.subtitle}>
          Cargá el gasto por el total. El sistema lo reparte según la
          participación de cada socia.
        </p>
      </section>

      {rubros.length === 0 && (
        <section style={avisoRubros}>
          Esta obra todavía no tiene rubros elegidos, así que el gasto va a
          quedar sin clasificar. Marcalos en la solapa{" "}
          <Link href={`/obras/${obra.slug}/rubros`} style={enlaceAviso}>
            Rubros
          </Link>
          .
        </section>
      )}

      {listaSocios.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Esta obra no tiene empresas socias cargadas, así que no se puede
            registrar quién pagó. Agregalas desde <strong>Editar obra</strong>.
          </p>
        </section>
      ) : (
        <GastoForm
          action={crearGasto}
          obraId={obra.id}
          slug={obra.slug}
          rubros={rubros}
          socios={listaSocios}
          proveedores={proveedores ?? []}
          saldosCaja={{ ars: caja.arsSaldo, usd: caja.usdSaldo }}
          presupuestos={presupuestos}
          presupuestosConItems={presupuestosConItems}
          error={error}
          empresaFija={perfil?.empresa_id ?? undefined}
          cotizacion={cotizacion?.promedio ?? null}
          inicioObra={obra.fecha_inicio}
          materiales={(materiales ?? []).map((m) => ({
            id: m.id,
            nombre: m.nombre,
            unidad: m.unidad,
            rubroId: m.rubro_id,
          }))}
        />
      )}
    </AppShell>
  );
}

const avisoRubros = {
  border: "1px solid #b91c1c",
  color: "#b91c1c",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
  lineHeight: 1.5,
};

const enlaceAviso = {
  color: "#b91c1c",
  textDecoration: "underline",
};
