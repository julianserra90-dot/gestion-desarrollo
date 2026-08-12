import Link from "next/link";
import AppShell from "@/components/AppShell";
import EditarNav from "@/components/EditarNav";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { guardarDatosLote } from "../../lote/actions";

/**
 * La ficha del terreno: cuánto salió y cómo se lo identifica.
 *
 * Vive acá y no en la solapa Lote porque son datos que se cargan una vez, al
 * comprar, y después casi no se tocan. La solapa Lote es para lo que pasa todos
 * los meses: los pagos.
 */
export default async function EditarDatosLotePage({
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

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={eyebrow}>{obra.nombre}</p>
          <h2 style={title}>Editar obra</h2>
          <p style={subtitle}>
            Los datos del terreno: lo que costó y cómo se lo identifica.
          </p>
        </div>

        <Link href={`/obras/${obra.slug}/lote`} style={backLink}>
          Volver al lote
        </Link>
      </header>

      <EditarNav slug={obra.slug} activa="lote" />

      {error && <p style={errorBox}>{error}</p>}

      <form action={guardarDatosLote}>
        <input type="hidden" name="obra_id" value={obra.id} />
        <input type="hidden" name="slug" value={obra.slug} />

        <section style={ui.panel}>
          <h3 style={ui.sectionTitle}>La compra</h3>

          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Valor del lote (USD)</span>
              <input
                type="number"
                name="lote_valor_usd"
                min="0"
                step="0.01"
                defaultValue={obra.lote_valor_usd ?? ""}
                placeholder="Ej: 200000"
                style={ui.input}
              />
              <span style={ayuda}>
                El precio pactado. Los pagos se cargan en la solapa Lote.
              </span>
            </label>

            <label style={field}>
              <span style={labelCampo}>Superficie del terreno (m²)</span>
              <input
                type="number"
                name="lote_superficie_m2"
                min="0"
                step="0.01"
                defaultValue={obra.lote_superficie_m2 ?? ""}
                placeholder="Ej: 300"
                style={ui.input}
              />
              <span style={ayuda}>
                La del terreno, distinta de las superficies de obra.
              </span>
            </label>

            <label style={field}>
              <span style={labelCampo}>Vendedor</span>
              <input
                type="text"
                name="lote_vendedor"
                defaultValue={obra.lote_vendedor ?? ""}
                placeholder="Quién vende"
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Propietario</span>
              <input
                type="text"
                name="lote_propietario"
                defaultValue={obra.lote_propietario ?? ""}
                placeholder="Titular registral"
                style={ui.input}
              />
              <span style={ayuda}>
                Puede no ser el mismo que vende: el que figura en el título.
              </span>
            </label>
          </div>
        </section>

        <section style={ui.panelConMargen}>
          <h3 style={ui.sectionTitle}>Identificación del inmueble</h3>
          <p style={{ ...ui.note, marginTop: 0, marginBottom: "20px" }}>
            Como figura en la escritura. La nomenclatura catastral va desglosada
            para poder leerla campo por campo.
          </p>

          <div style={grid}>
            <label style={field}>
              <span style={labelCampo}>Partida inmobiliaria</span>
              <input
                type="text"
                name="lote_partida"
                defaultValue={obra.lote_partida ?? ""}
                placeholder="Ej: 030-12345-6"
                style={ui.input}
              />
              <span style={ayuda}>Con ese número se pagan sus impuestos.</span>
            </label>
          </div>

          <div style={{ ...gridCatastro, marginTop: "20px" }}>
            <label style={field}>
              <span style={labelCampo}>Circunscripción</span>
              <input
                type="text"
                name="lote_circunscripcion"
                defaultValue={obra.lote_circunscripcion ?? ""}
                placeholder="Ej: II"
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Sección</span>
              <input
                type="text"
                name="lote_seccion"
                defaultValue={obra.lote_seccion ?? ""}
                placeholder="Ej: B"
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Manzana</span>
              <input
                type="text"
                name="lote_manzana"
                defaultValue={obra.lote_manzana ?? ""}
                placeholder="Ej: 45"
                style={ui.input}
              />
            </label>

            <label style={field}>
              <span style={labelCampo}>Parcela</span>
              <input
                type="text"
                name="lote_parcela"
                defaultValue={obra.lote_parcela ?? ""}
                placeholder="Ej: 12a"
                style={ui.input}
              />
            </label>
          </div>

          <label style={{ ...field, marginTop: "20px" }}>
            <span style={labelCampo}>Detalle</span>
            <input
              type="text"
              name="lote_detalle"
              defaultValue={obra.lote_detalle ?? ""}
              placeholder="Notas: linderos, restricciones, lo que no entre arriba"
              style={ui.input}
            />
          </label>
        </section>

        <div style={acciones}>
          <Link href={`/obras/${obra.slug}/lote`} style={ui.secondaryButton}>
            Cancelar
          </Link>

          <button type="submit" style={ui.button}>
            Guardar datos del lote
          </button>
        </div>
      </form>
    </AppShell>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #e5e5e5",
  paddingBottom: "24px",
  marginBottom: "24px",
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

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

// Los cuatro campos del catastro son cortos y se leen juntos: entran en una
// fila, como se los dicta.
const gridCatastro = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
  alignContent: "start" as const,
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const ayuda = {
  fontSize: "13px",
  color: "#999999",
};

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
