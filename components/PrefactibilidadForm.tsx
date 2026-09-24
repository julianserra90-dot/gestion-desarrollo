import Link from "next/link";
import InputMonto from "@/components/InputMonto";
import * as ui from "@/components/ui";
import type { Database } from "@/lib/database.types";

export type Prefactibilidad =
  Database["public"]["Tables"]["prefactibilidades"]["Row"];

export const ESTADOS = ["En estudio", "Interesa", "Descartado"];

const TIPOS_DESARROLLO = [
  "Vivienda colectiva",
  "Vivienda con local en PB",
  "Vivienda con cocheras",
  "Oficinas",
  "Uso mixto",
  "A definir",
];

// Las unidades de edificabilidad del Código Urbanístico. Es una lista de
// sugerencias, no un desplegable cerrado: las áreas especiales y las
// urbanizaciones determinadas tienen nombre propio y se escriben.
const UNIDADES_EDIFICABILIDAD = [
  "U.S.A.B. 0",
  "U.S.A.B. 1",
  "U.S.A.B. 2",
  "C.M.",
  "C.A.",
  "Área especial",
];

const MIXTURAS = ["Mixtura 1", "Mixtura 2", "Mixtura 3", "Mixtura 4"];

/**
 * La edición de un estudio de prefactibilidad: la corrección a mano de lo
 * que trajo la Ciudad, y la carga de lo que la Ciudad no da (valor del
 * terreno, tipo de desarrollo, LFI/LIB, patios, usos). Dos bloques: lo que
 * dice el terreno y lo que dice la normativa de la parcela. El alta no pasa
 * por acá: pide sólo la dirección.
 */
export default function PrefactibilidadForm({
  action,
  estudio,
  error,
  cancelarHref,
  textoBoton,
}: {
  action: (formData: FormData) => void;
  estudio?: Prefactibilidad;
  error?: string;
  cancelarHref: string;
  textoBoton: string;
}) {
  return (
    <form action={action}>
      {estudio && (
        <input type="hidden" name="prefactibilidad_id" value={estudio.id} />
      )}

      {error && <p style={errorBox}>{error}</p>}

      {estudio?.consultado_en && (
        <p style={notaCiudad}>
          Lo que cambies acá pisa lo que trajo la Ciudad, y la ficha lo marca
          como corregido a mano. Actualizar desde la Ciudad lo vuelve a traer
          todo y borra las correcciones.
        </p>
      )}

      <div style={ui.panel}>
        <h3 style={sectionTitle}>El terreno</h3>

        <div style={grid}>
          <label style={fieldLarge}>
            <span style={label}>Dirección</span>
            <input
              type="text"
              name="direccion"
              defaultValue={estudio?.direccion ?? ""}
              placeholder="Ej: Av. Corrientes 1234"
              required
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Barrio</span>
            <input
              type="text"
              name="barrio"
              defaultValue={estudio?.barrio ?? ""}
              placeholder="Ej: Villa Crespo"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Nomenclatura catastral</span>
            <input
              type="text"
              name="smp"
              defaultValue={estudio?.smp ?? ""}
              placeholder="Sección-Manzana-Parcela"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Frente (m)</span>
            <input
              type="number"
              name="ancho_m"
              min="0.01"
              step="0.01"
              defaultValue={estudio?.ancho_m ?? ""}
              placeholder="Ej: 8,66"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Fondo (m)</span>
            <input
              type="number"
              name="profundidad_m"
              min="0.01"
              step="0.01"
              defaultValue={estudio?.profundidad_m ?? ""}
              placeholder="Ej: 35"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Superficie (m²)</span>
            <input
              type="number"
              name="superficie_m2"
              min="0.01"
              step="0.01"
              defaultValue={estudio?.superficie_m2 ?? ""}
              placeholder="Ej: 303,10"
              style={ui.input}
            />
            <span style={ayudaCampo}>
              Si queda vacía se toma frente × fondo. Cargá la de la mensura
              cuando la tengas.
            </span>
          </label>

          <label style={field}>
            <span style={label}>Tipo de desarrollo a evaluar</span>
            <select
              name="tipo_desarrollo"
              defaultValue={estudio?.tipo_desarrollo ?? "A definir"}
              style={ui.input}
            >
              {TIPOS_DESARROLLO.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label style={field}>
            <span style={label}>Valor del terreno</span>
            <InputMonto
              name="valor_terreno"
              defaultValue={estudio?.valor_terreno ?? ""}
              placeholder="Ej: 350.000"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Moneda</span>
            <select
              name="moneda_valor"
              defaultValue={estudio?.moneda_valor ?? "USD"}
              style={ui.input}
            >
              <option value="USD">Dólares</option>
              <option value="ARS">Pesos</option>
            </select>
          </label>

          <label style={fieldLarge}>
            <span style={label}>
              Construcciones existentes <span style={opcional}>opcional</span>
            </span>
            <input
              type="text"
              name="construcciones_existentes"
              defaultValue={estudio?.construcciones_existentes ?? ""}
              placeholder="Ej: casa de PB a demoler, galpón en el fondo"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Estado del estudio</span>
            <select
              name="estado"
              defaultValue={estudio?.estado ?? "En estudio"}
              style={ui.input}
            >
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div style={ui.panelConMargen}>
        <h3 style={sectionTitle}>Normativa</h3>

        <div style={grid}>
          <label style={field}>
            <span style={label}>Unidad de edificabilidad</span>
            <input
              type="text"
              name="unidad_edificabilidad"
              list="unidades-edificabilidad"
              defaultValue={estudio?.unidad_edificabilidad ?? ""}
              placeholder="Ej: U.S.A.B. 2"
              style={ui.input}
            />
            <datalist id="unidades-edificabilidad">
              {UNIDADES_EDIFICABILIDAD.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>

          <label style={field}>
            <span style={label}>Mixtura de usos</span>
            <input
              type="text"
              name="mixtura_usos"
              list="mixturas-usos"
              defaultValue={estudio?.mixtura_usos ?? ""}
              placeholder="Ej: Mixtura 3"
              style={ui.input}
            />
            <datalist id="mixturas-usos">
              {MIXTURAS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>

          <label style={field}>
            <span style={label}>Altura máxima (m)</span>
            <input
              type="number"
              name="altura_maxima_m"
              min="0.01"
              step="0.01"
              defaultValue={estudio?.altura_maxima_m ?? ""}
              placeholder="Ej: 22,80"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Plano límite (m)</span>
            <input
              type="number"
              name="plano_limite_m"
              min="0.01"
              step="0.01"
              defaultValue={estudio?.plano_limite_m ?? ""}
              placeholder="Ej: 25,80"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Plantas sobre PB</span>
            <input
              type="number"
              name="plantas_sobre_pb"
              min="0"
              step="1"
              defaultValue={estudio?.plantas_sobre_pb ?? ""}
              placeholder="Ej: 6"
              style={ui.input}
            />
            <span style={ayudaCampo}>
              Las que da el Código para la unidad de edificabilidad. Corregilo
              si hay enrase o retiros que sumen o resten una.
            </span>
          </label>

          <label style={field}>
            <span style={label}>Área edificable en planta (m²)</span>
            <input
              type="number"
              name="sup_edificable_planta_m2"
              min="0"
              step="0.01"
              defaultValue={estudio?.sup_edificable_planta_m2 ?? ""}
              placeholder="Ej: 162,25"
              style={ui.input}
            />
            <span style={ayudaCampo}>
              La huella que calcula la Ciudad. Si está cargada, manda sobre
              frente × profundidad hasta la LFI.
            </span>
          </label>

          <label style={field}>
            <span style={label}>Retiro de frente (m)</span>
            <input
              type="number"
              name="retiro_frente_m"
              min="0"
              step="0.01"
              defaultValue={estudio?.retiro_frente_m ?? ""}
              placeholder="0"
              style={ui.input}
            />
          </label>

          <label style={field}>
            <span style={label}>Profundidad hasta la LFI (m)</span>
            <input
              type="number"
              name="lfi_m"
              min="0.01"
              step="0.01"
              defaultValue={estudio?.lfi_m ?? ""}
              placeholder="Ej: 26,50"
              style={ui.input}
            />
            <span style={ayudaCampo}>
              Desde la Línea Oficial. Si el lote es más corto, se construye
              hasta el fondo.
            </span>
          </label>

          <label style={field}>
            <span style={label}>Profundidad hasta la LIB (m)</span>
            <input
              type="number"
              name="lib_m"
              min="0.01"
              step="0.01"
              defaultValue={estudio?.lib_m ?? ""}
              placeholder="Ej: 30"
              style={ui.input}
            />
          </label>

          <label style={fieldLarge}>
            <span style={label}>
              Patios y retiros exigidos <span style={opcional}>opcional</span>
            </span>
            <input
              type="text"
              name="patios"
              defaultValue={estudio?.patios ?? ""}
              placeholder="Ej: patio de 3 × 4 m contra medianera derecha"
              style={ui.input}
            />
          </label>

          <label style={fieldLarge}>
            <span style={label}>
              Usos permitidos <span style={opcional}>opcional</span>
            </span>
            <input
              type="text"
              name="usos_permitidos"
              defaultValue={estudio?.usos_permitidos ?? ""}
              placeholder="Ej: vivienda colectiva, comercio minorista en PB, oficinas"
              style={ui.input}
            />
          </label>

          <div style={field}>
            <label style={casilla}>
              <input
                type="checkbox"
                name="aph"
                defaultChecked={estudio?.aph ?? false}
              />
              <span>Está en un Área de Protección Histórica</span>
            </label>
            <input
              type="text"
              name="aph_detalle"
              defaultValue={estudio?.aph_detalle ?? ""}
              placeholder="Cuál, y qué exige"
              style={ui.input}
            />
          </div>

          <div style={field}>
            <label style={casilla}>
              <input
                type="checkbox"
                name="catalogado"
                defaultChecked={estudio?.catalogado ?? false}
              />
              <span>El inmueble está catalogado</span>
            </label>
          </div>

          <label style={fieldLarge}>
            <span style={label}>
              Afectaciones <span style={opcional}>opcional</span>
            </span>
            <input
              type="text"
              name="afectaciones"
              defaultValue={estudio?.afectaciones ?? ""}
              placeholder="Ej: ensanche de calle, traza de autopista, servidumbre"
              style={ui.input}
            />
          </label>

          <label style={fieldLarge}>
            <span style={label}>
              Plusvalía urbana <span style={opcional}>opcional</span>
            </span>
            <input
              type="text"
              name="plusvalia"
              defaultValue={estudio?.plusvalia ?? ""}
              placeholder="Si aplica, y cuánto se estima"
              style={ui.input}
            />
          </label>
        </div>
      </div>

      <div style={ui.panelConMargen}>
        <h3 style={sectionTitle}>Observaciones</h3>
        <textarea
          name="observaciones"
          defaultValue={estudio?.observaciones ?? ""}
          placeholder="Lo que no entra en ningún campo: qué dijo el vendedor, qué hay que verificar, por qué interesa o no."
          style={textarea}
        />
      </div>

      <div style={actions}>
        <Link href={cancelarHref} style={ui.secondaryButton}>
          Cancelar
        </Link>

        <button type="submit" style={ui.button}>
          {textoBoton}
        </button>
      </div>
    </form>
  );
}

const sectionTitle = {
  ...ui.sectionTitle,
  margin: "0 0 20px",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "20px",
};

// `alignContent: start` mantiene los campos alineados: sin eso, una celda con
// ayuda debajo estira a su vecina y el input de al lado queda flotando a media
// altura en vez de arrancar en la misma línea.
const field = {
  display: "grid",
  gap: "8px",
  alignContent: "start" as const,
};

const fieldLarge = {
  ...field,
  gridColumn: "1 / -1",
};

const label = {
  fontSize: "13px",
  color: "#555555",
};

const opcional = {
  color: "#999999",
  marginLeft: "6px",
};

const ayudaCampo = {
  fontSize: "13px",
  color: "#999999",
};

const casilla = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  color: "#333333",
  cursor: "pointer",
};

const textarea = {
  ...ui.input,
  minHeight: "96px",
  resize: "vertical" as const,
};

const notaCiudad = {
  ...ui.note,
  margin: "0 0 20px",
};

const errorBox = {
  border: "1px solid #111111",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "28px",
};
