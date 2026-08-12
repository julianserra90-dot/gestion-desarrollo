import Link from "next/link";
import AppShell from "@/components/AppShell";
import EditarNav from "@/components/EditarNav";
import ObraForm from "@/components/ObraForm";
import { createClient } from "@/lib/supabase/server";
import { crearEmpresa } from "@/app/empresas/actions";
import {
  actualizarObra,
  archivarObra,
  desarchivarObra,
  eliminarObra,
  eliminarObraConTodo,
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
      "id, slug, nombre, ubicacion, estado, fecha_inicio, fecha_fin_estimada, presupuesto, valor_m2_usd, domicilio, unidades_funcionales, pisos, sup_construccion_m2, sup_venta_m2, archivada_en"
    )
    .eq("slug", obraId)
    .maybeSingle();

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const contar = (tabla: "gastos" | "avances" | "foto_registros" | "documentos") =>
    supabase
      .from(tabla)
      .select("*", { count: "exact", head: true })
      .eq("obra_id", obra.id);

  const [{ data: empresas }, { data: socios }, gastos, avances, fotos, documentos] =
    await Promise.all([
      supabase.from("empresas").select("id, nombre").order("nombre"),
      supabase
        .from("obra_socios")
        .select("empresa_id, porcentaje")
        .eq("obra_id", obra.id),
      contar("gastos"),
      contar("avances"),
      contar("foto_registros"),
      contar("documentos"),
    ]);

  const registros = [
    { etiqueta: "gastos", cantidad: gastos.count ?? 0 },
    { etiqueta: "avances", cantidad: avances.count ?? 0 },
    { etiqueta: "registros de fotos", cantidad: fotos.count ?? 0 },
    { etiqueta: "documentos", cantidad: documentos.count ?? 0 },
  ];

  const totalRegistros = registros.reduce((acc, r) => acc + r.cantidad, 0);
  const sePuedeBorrar = totalRegistros === 0;

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Editar obra</h2>
          <p style={subtitle}>
            Cambiá los datos generales o quién participa en la obra.
          </p>
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
        <p style={text}>
          Agregala acá y después seleccionala arriba como socia de la obra.
        </p>

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
            , los ingresos, los presupuestos y los archivos en Drive.{" "}
            <strong>No se puede deshacer.</strong>
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
};

const backLink = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
  paddingBottom: "4px",
};

const avisoArchivada = {
  border: "1px solid #111111",
  padding: "16px 20px",
  marginBottom: "24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  fontSize: "14px",
};

const panel = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  marginTop: "32px",
};

const panelRiesgo = {
  border: "1px solid #111111",
  padding: "24px",
  marginTop: "32px",
};

const sectionTitle = {
  fontSize: "18px",
  fontWeight: 400,
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
  padding: "12px 18px",
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
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
