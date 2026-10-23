import Link from "next/link";
import AppShell from "@/components/AppShell";
import GastoForm, { type BorradorGasto } from "@/components/GastoForm";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import {
  facturasDelBorrador,
  itemsDelBorrador,
  type CamposBorrador,
} from "@/lib/borradores";
import { getCaja } from "@/lib/caja";
import { camposParaRepetir } from "@/lib/repetir-gasto";
import { getDetalles } from "@/lib/detalles";
import { getCotizacionActual } from "@/lib/dolar";
import { getMaterialesCatalogo } from "@/lib/materiales";
import { getObraPorSlug } from "@/lib/obras";
import {
  getPresupuestosConItems,
  getPresupuestosDeObra,
} from "@/lib/presupuestos";
import { getRubrosDeObra } from "@/lib/rubros";
import { createClient } from "@/lib/supabase/server";
import { crearGasto, descartarBorrador, guardarBorrador } from "../actions";

export default async function NuevoGastoPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string; borrador?: string; repetir?: string }>;
}) {
  const { obraId } = await params;
  const { error, borrador: borradorId, repetir: repetirId } = await searchParams;
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
    detallesPredefinidos,
  ] = await Promise.all([
    getRubrosDeObra(obra.id),
    supabase
      .from("obra_socios")
      .select("empresa_id, porcentaje, empresas(nombre)")
      .eq("obra_id", obra.id),
    supabase.from("proveedores").select("id, nombre, tipo").order("nombre"),
    getPresupuestosDeObra(obra.id),
    getPresupuestosConItems(obra.id),
    getDetalles("Gasto"),
  ]);

  // El catálogo de materiales, para el detalle de la factura. Es común a todas
  // las obras, igual que el de proveedores.
  const materiales = await getMaterialesCatalogo();

  const cotizacion = await getCotizacionActual();
  const caja = await getCaja(obra.id);

  // Se retoma un borrador: el formulario arranca con lo que tenía. Si ya no
  // existe (se terminó en otra pestaña, se descartó), arranca vacío.
  const { data: filaBorrador } = borradorId
    ? await supabase
        .from("gastos_borradores")
        .select("id, campos, comprobante_drive_id, comprobante_nombre")
        .eq("id", borradorId)
        .eq("obra_id", obra.id)
        .maybeSingle()
    : { data: null };
  const borrador: BorradorGasto | undefined = filaBorrador
    ? {
        id: filaBorrador.id,
        campos: filaBorrador.campos as CamposBorrador,
        comprobanteDriveId: filaBorrador.comprobante_drive_id,
        comprobanteNombre: filaBorrador.comprobante_nombre,
      }
    : undefined;

  // Se repite un gasto: el formulario arranca con lo suyo, con la fecha de
  // hoy. No es editarlo —se está creando uno nuevo—, así que va por la misma
  // puerta que un borrador: valores puestos y nada más. Si el gasto ya no
  // está, se arranca vacío, igual que con un borrador que se descartó.
  const { data: repetido } = repetirId
    ? await supabase
        .from("gastos")
        .select(
          "rubro_id, proveedor_id, empresa_receptora_id, tipo_gasto, es_acopio, concepto, tipo_pago, tipo_factura, alicuota_iva, precios_con_iva, pesos_con_dolares, empresa_factura_id, monto, monto_usd, moneda, caja_ars, caja_usd, cotizacion, descuento_detalle, observaciones, empresa_pagadora_id, compartido"
        )
        .eq("id", repetirId)
        .eq("obra_id", obra.id)
        .maybeSingle()
    : { data: null };

  const [{ data: itemsRepetidos }, { data: facturasRepetidas }] = repetido
    ? await Promise.all([
        supabase
          .from("gasto_materiales")
          .select("material_id, cantidad, precio_unitario")
          .eq("gasto_id", repetirId as string)
          .order("orden"),
        supabase
          .from("gasto_facturas")
          .select("empresa_id, monto, monto_usd")
          .eq("gasto_id", repetirId as string)
          .order("orden"),
      ])
    : [{ data: null }, { data: null }];

  // La fecha la pone la pantalla, no el módulo: el servidor corre en UTC y a
  // la noche "hoy" en Buenos Aires todavía es ayer allá.
  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const listaSocios = (socios ?? [])
    .map((s) => ({
      empresa_id: s.empresa_id,
      nombre: s.empresas?.nombre ?? "—",
      porcentaje: Number(s.porcentaje),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="gastos" />}
    >
      <ObraHeader obra={obra} activeSection="gastos" ocultarNav />

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>{obra.nombre}</p>
        <h2 style={ui.pageTitle}>
          {borrador ? "Borrador de gasto" : repetido ? "Repetir gasto" : "Nuevo gasto"}
        </h2>
      </section>

      {/* Dos avisos distintos: sin catálogo no hay nada que elegir y hay que
          ir a cargarlo; con catálogo pero sin ninguno marcado ya se resuelve
          acá, porque el desplegable los ofrece todos. */}
      {rubros.length === 0 ? (
        <section style={avisoRubros}>
          Esta obra no tiene rubros cargados, así que el gasto va a quedar sin
          clasificar. Cargalos en la solapa{" "}
          <Link href={`/obras/${obra.slug}/rubros`} style={enlaceAviso}>
            Rubros
          </Link>
          .
        </section>
      ) : rubros.every((r) => !r.activo) ? (
        <section style={avisoRubros}>
          Esta obra todavía no usa ningún rubro. Elegí uno en el desplegable
          —están todos ahí— y se suma a la obra al guardar.
        </section>
      ) : null}

      {listaSocios.length === 0 ? (
        <section style={ui.panel}>
          <p style={ui.vacio}>
            Esta obra no tiene empresas socias cargadas, así que no se puede
            registrar quién pagó. Agregalas desde <strong>Editar obra</strong>.
          </p>
        </section>
      ) : (
        // La `key` rearma el formulario al pasar de un borrador a otro (o a
        // uno nuevo): es la misma página, y sin ella el estado quedaría del
        // anterior.
        <GastoForm
          key={borrador?.id ?? (repetirId ? `repetir-${repetirId}` : "nuevo")}
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
          detallesPredefinidos={detallesPredefinidos}
          materiales={materiales}
          borrador={borrador}
          camposIniciales={repetido ? camposParaRepetir(repetido, hoy) : undefined}
          itemsIniciales={
            borrador
              ? itemsDelBorrador(borrador.campos)
              : repetido
                ? (itemsRepetidos ?? []).map((i) => ({
                    materialId: i.material_id,
                    cantidad: String(i.cantidad),
                    precio: i.precio_unitario === null ? "" : String(i.precio_unitario),
                  }))
                : undefined
          }
          facturasIniciales={
            borrador
              ? facturasDelBorrador(borrador.campos).map((f) => ({
                  ...f,
                  comprobanteDriveId: null,
                  comprobanteNombre: null,
                }))
              : repetido
                ? (facturasRepetidas ?? []).map((f) => ({
                    empresaId: f.empresa_id,
                    // En la moneda del papel, igual que al editar: `monto` son
                    // pesos siempre y `monto_usd` sólo está cuando aplica.
                    monto: Number(f.monto_usd ?? f.monto),
                    // El número no se repite: la factura de este mes es otra.
                    numero: null,
                    comprobanteDriveId: null,
                    comprobanteNombre: null,
                  }))
                : undefined
          }
          accionBorrador={guardarBorrador}
          accionDescartar={descartarBorrador}
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
