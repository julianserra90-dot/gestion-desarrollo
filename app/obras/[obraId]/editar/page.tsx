import Link from "next/link";
import AppShell from "@/components/AppShell";
import EditarNav from "@/components/EditarNav";
import ImagenPortadaForm from "@/components/ImagenPortadaForm";
import ObraForm from "@/components/ObraForm";
import ObraSidebar from "@/components/ObraSidebar";
import { createClient } from "@/lib/supabase/server";
import { crearEmpresa } from "@/app/empresas/actions";
import {
  actualizarObra,
  archivarObra,
  desarchivarObra,
  eliminarImagenObra,
  eliminarObra,
  eliminarObraConTodo,
  subirImagenObra,
} from "../../actions";

export default async function EditarObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { obraId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: obra } = await supabase
    .from("obras")
    .select(
      "id, slug, nombre, ubicacion, estado, fecha_inicio, fecha_fin_estimada, presupuesto, valor_m2_usd, valor_venta_m2_usd, domicilio, unidades_funcionales, pisos, sup_construccion_m2, sup_venta_m2, archivada_en, imagen_drive_id, imagen_nombre"
    )
    .eq("slug", obraId)
    .maybeSingle();

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  // Las mismas ocho tablas que cuenta el trigger de la base
  // (`impedir_borrar_obra_con_datos`). Tienen que ser las mismas: si acá
  // faltara una, la pantalla ofrecería el borrado rápido para una obra que la
  // base va a frenar, o —peor, que es lo que pasaba con los ingresos, las
  // cotizaciones, el cómputo y los pagos del lote— uno que se lleva por
  // cascada datos que nadie contó y comprobantes que nadie borra de Drive.
  const CUELGAN_DE_LA_OBRA = [
    { tabla: "gastos", etiqueta: "gastos" },
    { tabla: "avances", etiqueta: "avances" },
    { tabla: "foto_registros", etiqueta: "registros de fotos" },
    { tabla: "documentos", etiqueta: "documentos" },
    { tabla: "ingresos", etiqueta: "ingresos" },
    { tabla: "presupuestos", etiqueta: "cotizaciones" },
    { tabla: "computo_items", etiqueta: "tareas del cómputo" },
    { tabla: "lote_pagos", etiqueta: "pagos del lote" },
  ] as const;

  const contar = (tabla: (typeof CUELGAN_DE_LA_OBRA)[number]["tabla"]) =>
    supabase
      .from(tabla)
      .select("*", { count: "exact", head: true })
      .eq("obra_id", obra.id);

  // Anidado y no una lista sola para que TypeScript siga viendo la tupla de
  // los dos primeros: las ocho cuentas salen igual todas juntas.
  const [[{ data: empresas }, { data: socios }], cuentas] = await Promise.all([
    Promise.all([
      supabase.from("empresas").select("id, nombre").order("nombre"),
      supabase
        .from("obra_socios")
        .select("empresa_id, porcentaje")
        .eq("obra_id", obra.id),
    ]),
    Promise.all(CUELGAN_DE_LA_OBRA.map((t) => contar(t.tabla))),
  ]);

  const registros = CUELGAN_DE_LA_OBRA.map((t, i) => ({
    etiqueta: t.etiqueta,
    cantidad: cuentas[i].count ?? 0,
  }));

  const totalRegistros = registros.reduce((acc, r) => acc + r.cantidad, 0);
  const sePuedeBorrar = totalRegistros === 0;

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="estado" />}
    >
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Editar obra</h2>
        </div>

        <Link href={`/obras/${obra.slug}`} style={backLink}>
          Volver a la obra
        </Link>
      </header>

      <EditarNav slug={obra.slug} activa="obra" />

      {obra.archivada_en && (
        <section style={avisoArchivada}>
          <div>
            <strong>Esta obra está archivada.</strong> No aparece en el listado
            principal, pero no se perdió nada.
          </div>

          <form action={desarchivarObra}>
            <input type="hidden" name="obra_id" value={obra.id} />
            <button type="submit" style={secondaryButton}>
              Desarchivar
            </button>
          </form>
        </section>
      )}

      <ImagenPortadaForm
        // Fuerza a remontar cuando cambia la imagen guardada: sin esto, al
        // guardar (que redirige a esta misma ruta) React reutiliza el mismo
        // componente y se queda mostrando "Guardando..." con el recorte
        // viejo en vez de la portada nueva.
        key={obra.imagen_drive_id ?? "sin-imagen"}
        obraId={obra.id}
        slug={obra.slug}
        imagenActual={
          obra.imagen_drive_id
            ? { driveId: obra.imagen_drive_id, nombre: obra.imagen_nombre }
            : null
        }
        subirAction={subirImagenObra}
        eliminarAction={eliminarImagenObra}
      />

      <ObraForm
        action={actualizarObra}
        obra={obra}
        empresas={empresas ?? []}
        socios={(socios ?? []).map((s) => ({
          empresa_id: s.empresa_id,
          porcentaje: Number(s.porcentaje),
        }))}
        error={error}
        cancelarHref={`/obras/${obra.slug}`}
        textoBoton="Guardar cambios"
      />

      <section style={panel}>
        <h3 style={sectionTitle}>¿Falta una empresa?</h3>

        <form action={crearEmpresa} style={inlineForm}>
          <input
            type="hidden"
            name="volver_a"
            value={`/obras/${obra.slug}/editar`}
          />
          <input
            type="text"
            name="nombre"
            placeholder="Nombre de la empresa"
            required
            style={input}
          />
          <button type="submit" style={secondaryButton}>
            Agregar empresa
          </button>
        </form>
      </section>

      <section style={panelRiesgo}>
        <h3 style={sectionTitle}>Archivar o eliminar</h3>

        <p style={text}>
          Esta obra tiene{" "}
          {totalRegistros === 0 ? (
            <strong>nada cargado todavía</strong>
          ) : (
            <>
              {registros
                .filter((r) => r.cantidad > 0)
                .map((r) => `${r.cantidad} ${r.etiqueta}`)
                .join(", ")}
            </>
          )}
          .
        </p>

        <div style={acciones}>
          {!obra.archivada_en && (
            <form action={archivarObra}>
              <input type="hidden" name="obra_id" value={obra.id} />
              <input type="hidden" name="slug" value={obra.slug} />
              <button type="submit" style={secondaryButton}>
                Archivar obra
              </button>
            </form>
          )}

          {sePuedeBorrar && (
            <form action={eliminarObra}>
              <input type="hidden" name="obra_id" value={obra.id} />
              <input type="hidden" name="slug" value={obra.slug} />
              <button type="submit" style={botonPeligro}>
                Eliminar definitivamente
              </button>
            </form>
          )}

          {!sePuedeBorrar && !obra.archivada_en && (
            <p style={notaBloqueo}>
              El borrado definitivo está bloqueado porque la obra tiene datos
              cargados. Archivala: sale del listado y no se pierde nada. Si
              después querés borrarla de verdad, se puede desde ahí.
            </p>
          )}
        </div>
      </section>

      {!sePuedeBorrar && obra.archivada_en && (
        <section style={panelRiesgo}>
          <h3 style={sectionTitle}>Borrar la obra con todo adentro</h3>

          <p style={text}>
            Esta obra está archivada. Borrarla se lleva{" "}
            {registros
              .filter((r) => r.cantidad > 0)
              .map((r) => `${r.cantidad} ${r.etiqueta}`)
              .join(", ")}
            {" "}
            y los archivos en Drive. <strong>No se puede deshacer.</strong>
          </p>

          <p style={text}>
            Sirve para descartar una obra de prueba, y libera lo que quedaba
            enganchado a ella: las empresas que sólo participaban acá pasan a
            poder eliminarse desde{" "}
            <Link href="/empresas" style={enlaceEmpresas}>
              Empresas
            </Link>
            .
          </p>

          <form action={eliminarObraConTodo} style={inlineForm}>
            <input type="hidden" name="obra_id" value={obra.id} />
            <input type="hidden" name="slug" value={obra.slug} />
            <input
              type="text"
              name="confirmacion"
              placeholder={`Escribí: ${obra.nombre}`}
              required
              style={input}
            />
            <button type="submit" style={botonPeligro}>
              Borrar con todo
            </button>
          </form>
        </section>
      )}
    </AppShell>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #eeeeee",
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
  fontWeight: 500,
  letterSpacing: "-0.01em",
  margin: "8px 0",
};

const backLink = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
  paddingBottom: "4px",
};

const avisoArchivada = {
  border: "1px solid #111111",
  borderRadius: "14px",
  padding: "16px 20px",
  marginBottom: "24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  fontSize: "14px",
};

const panel = {
  border: "1px solid rgba(17, 17, 17, 0.06)",
  borderRadius: "18px",
  boxShadow:
    "0 1px 2px rgba(17, 17, 17, 0.04), 0 12px 28px -14px rgba(17, 17, 17, 0.16)",
  padding: "26px 28px",
  marginTop: "32px",
};

// La zona de riesgo (archivar, borrar) mantiene el borde negro sólido en vez
// de la sombra suave del resto: acá interesa que se note como distinta, no
// que se sienta parte del mismo grupo de tarjetas.
const panelRiesgo = {
  border: "1px solid #111111",
  borderRadius: "18px",
  padding: "26px 28px",
  marginTop: "32px",
};

const sectionTitle = {
  fontSize: "17px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  margin: "0 0 8px",
};

const text = {
  color: "#666666",
  fontSize: "14px",
  margin: "0 0 16px",
};

const acciones = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const notaBloqueo = {
  color: "#666666",
  fontSize: "14px",
  margin: 0,
  maxWidth: "520px",
};

const enlaceEmpresas = {
  color: "#111111",
  textDecoration: "underline",
};

const inlineForm = {
  display: "flex",
  gap: "12px",
  maxWidth: "520px",
};

const input = {
  flex: 1,
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  borderRadius: "10px",
  background: "#ffffff",
  padding: "12px",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111111",
};

const secondaryButton = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  borderRadius: "10px",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const botonPeligro = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
  borderRadius: "10px",
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};
