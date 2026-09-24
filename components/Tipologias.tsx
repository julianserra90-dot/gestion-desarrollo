import PlantaTipo from "@/components/PlantaTipo";
import * as ui from "@/components/ui";
import { formatM2 } from "@/lib/format";
import { PARAMETROS } from "@/lib/parametros-edificacion";
import { dibujarPlantaBaja, dibujarPlantaTipo, type Dibujo, type UsoPlantaBaja } from "@/lib/plantas-tipo";
import { leerLote, tipoPorDormitorios, type Alternativa, type Terreno } from "@/lib/tipologias";

/**
 * Lo que el motor de tipologías lee del lote: núcleo, planta tipo, unidades,
 * retiros y las alternativas de programa comparadas, cada una con su porqué.
 * Server component: no hay nada que tocar, es una lectura.
 */
export default function Tipologias({ terreno }: { terreno: Terreno }) {
  const lectura = leerLote(terreno);
  const { nucleo, plantaElegida, plantas, alternativas, retiros } = lectura;
  const descartadas = plantas.filter((pl) => !pl.viable);
  const dibujo = plantaElegida.viable ? dibujarPlantaTipo(terreno, plantaElegida, nucleo) : null;
  // La PB se dibuja como la resuelve la alternativa recomendada.
  const recomendada = alternativas.find((a) => a.recomendada) ?? null;
  const usoPb: UsoPlantaBaja =
    recomendada?.clave === "vivienda-local" || recomendada?.clave === "oficinas-local"
      ? "local"
      : recomendada?.clave === "vivienda-cocheras"
        ? "cocheras"
        : "vivienda";
  const dibujoPb = plantaElegida.viable ? dibujarPlantaBaja(terreno, plantaElegida, nucleo, usoPb) : null;
  // Los dormitorios que dice el dibujo mandan sobre los que estimó la
  // superficie: una unidad de 5 m de fondo no arma dos filas aunque los
  // metros den para un dormitorio.
  const dormitoriosDibujados = (nombre: string) => contarDormitorios(dibujo, nombre);

  return (
    <section style={ui.panelConMargen}>
      <h3 style={ui.sectionTitle}>Tipologías posibles</h3>

      <div style={grilla}>
        <Dato etiqueta="Núcleo">
          {nucleo.ascensor ? "Escalera y ascensor" : "Sólo escalera"} · {formatM2(nucleo.m2)} por planta
          <p style={nota}>{nucleo.motivo} Va {nucleo.ubicacion}.</p>
        </Dato>

        <Dato etiqueta="Planta tipo">
          {plantaElegida.nombre}
          <p style={nota}>{plantaElegida.motivo}</p>
          <ul style={lista}>
            {plantaElegida.unidades.map((u) => {
              const dibujados = dormitoriosDibujados(u.nombre);
              const nombre =
                dibujados === null ? u.nombre : `${u.nombre.split(":")[0]}: ${tipoPorDormitorios(dibujados)}`;
              return (
                <li key={u.nombre}>
                  {nombre} · {formatM2(u.m2)} · ventila {u.ventila}
                </li>
              );
            })}
          </ul>
          {plantaElegida.patios.map((patio) => (
            <p key={patio} style={nota}>
              {patio}
            </p>
          ))}
        </Dato>

        <Dato etiqueta="Retiros y límites">
          <ul style={lista}>
            {retiros.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Dato>

        {descartadas.length > 0 && (
          <Dato etiqueta="Plantas descartadas">
            <ul style={lista}>
              {descartadas.map((pl) => (
                <li key={pl.clave}>
                  {pl.nombre}: {pl.motivo}.
                </li>
              ))}
            </ul>
          </Dato>
        )}
      </div>

      {dibujo && (
        <>
          <h4 style={subtitulo}>Planta tipo dibujada</h4>
          <PlantaTipo dibujo={dibujo} />
          <p style={nota}>
            Esquema a escala: la calle abajo, el núcleo con su patio, y cada
            ambiente con su medida. El trazo grueso es la ventana; los arcos, las
            puertas desde el palier. Es la distribución que sale de las reglas,
            para ver si la tipología cierra; no reemplaza a un anteproyecto.
          </p>
        </>
      )}

      {dibujoPb && (
        <>
          <h4 style={subtitulo}>
            Planta baja{recomendada ? ` · ${recomendada.nombre.toLowerCase()}` : ""}
          </h4>
          <PlantaTipo dibujo={dibujoPb} />
          <p style={nota}>
            El pasillo de ingreso va pegado a la medianera del núcleo, de la calle al
            palier, como en los edificios de referencia; lo que hay al frente es lo que
            decide la alternativa recomendada.
          </p>
        </>
      )}

      <h4 style={subtitulo}>Alternativas de programa</h4>
      <div style={{ overflowX: "auto" }}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Alternativa</th>
              <th style={ui.th}>Planta baja</th>
              <th style={ui.thRight}>Unidades</th>
              <th style={ui.thRight}>Vendible</th>
              <th style={ui.thRight}>Eficiencia</th>
              <th style={ui.thRight}>Puntaje</th>
            </tr>
          </thead>
          <tbody>
            {alternativas.map((a) => (
              <FilaAlternativa key={a.clave} a={a} />
            ))}
          </tbody>
        </table>
      </div>

      {alternativas.map((a) => (
        <details key={a.clave} style={detalle}>
          <summary style={resumen}>
            {a.nombre}
            {a.recomendada && <span style={{ color: ui.VERDE }}> · recomendada</span>}
            {!a.viable && <span style={{ color: "#999999" }}> · descartada</span>}
          </summary>
          <div style={cuerpoDetalle}>
            {a.ventajas.length > 0 && (
              <div>
                <p style={ui.label}>A favor</p>
                <ul style={lista}>
                  {a.ventajas.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            )}
            {a.desventajas.length > 0 && (
              <div>
                <p style={ui.label}>En contra</p>
                <ul style={lista}>
                  {a.desventajas.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            )}
            {a.alertas.length > 0 && (
              <div>
                <p style={ui.label}>Alertas</p>
                <ul style={lista}>
                  {a.alertas.map((v) => (
                    <li key={v} style={{ color: "#8a5a12" }}>
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p style={nota}>
              Puntaje: normativa {a.puntaje.normativa} · geometría {a.puntaje.geometria} · ubicación{" "}
              {a.puntaje.ubicacion} · eficiencia {a.puntaje.eficiencia}. Planta:{" "}
              {a.planta.nombre.toLowerCase()}.
            </p>
          </div>
        </details>
      ))}

      <p style={{ ...ui.note, marginTop: "20px", marginBottom: 0 }}>
        Reglas y cuentas, sin inteligencia artificial: lote regular entre medianeras, un solo
        cuerpo, núcleo en una banda del medio y unidades que ventilan al frente o al
        contrafrente. Los dormitorios salen de la superficie de cada unidad. Es para comparar
        lotes y descartar rápido, no un anteproyecto.
      </p>

      <details style={detalle}>
        <summary style={resumen}>Parámetros usados</summary>
        <div style={{ overflowX: "auto" }}>
          <table style={ui.table}>
            <tbody>
              {Object.entries(PARAMETROS).map(([clave, par]) => (
                <tr key={clave}>
                  <td style={celdaChica}>
                    {String(par.valor).replace(".", ",")} {par.unidad}
                  </td>
                  <td style={celdaChica}>
                    {par.fuente}
                    {par.verificar && (
                      <span style={{ color: "#8a5a12" }}> · a verificar contra el texto vigente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={nota}>Están en lib/parametros-edificacion.ts. Los del Código se escribieron de memoria y hay que contrastarlos.</p>
      </details>
    </section>
  );
}

/** Cuántos dormitorios quedaron adentro del recinto de una unidad en el dibujo, o null si no se dibujó. */
function contarDormitorios(dibujo: Dibujo | null, nombre: string): number | null {
  const u = dibujo?.unidades.find((r) => r.nombre === nombre);
  if (!dibujo || !u) return null;
  const dentro = (x: number, y: number) =>
    x >= u.x - 0.01 && x <= u.x + u.ancho + 0.01 && y >= u.y - 0.01 && y <= u.y + u.alto + 0.01;
  return dibujo.ambientes.filter(
    (a) => a.tipo === "dormitorio" && dentro(a.x, a.y) && dentro(a.x + a.ancho, a.y + a.alto)
  ).length;
}

function FilaAlternativa({ a }: { a: Alternativa }) {
  const apagado = a.viable ? undefined : { color: "#999999" };
  return (
    <tr>
      <td style={{ ...ui.td, ...apagado }}>
        {a.recomendada ? <strong>{a.nombre}</strong> : a.nombre}
        {a.recomendada && <div style={{ ...ui.note, color: ui.VERDE }}>recomendada</div>}
        {!a.viable && <div style={ui.note}>descartada</div>}
      </td>
      <td style={{ ...ui.td, ...apagado }}>{a.pb}</td>
      <td style={{ ...ui.tdRight, ...apagado }}>
        {a.unidadesTotales}
        {a.cocheras !== null && <div style={ui.note}>{a.cocheras} cocheras</div>}
        {a.localM2 !== null && <div style={ui.note}>local {formatM2(a.localM2)}</div>}
      </td>
      <td style={{ ...ui.tdRight, ...apagado }}>
        {formatM2(a.vendibleM2)}
        <div style={ui.note}>de {formatM2(a.construibleM2)}</div>
      </td>
      <td style={{ ...ui.tdRight, ...apagado }}>{Math.round(a.eficiencia * 100)} %</td>
      <td style={{ ...ui.tdRight, ...apagado }}>{a.viable ? a.puntaje.total.toFixed(1).replace(".", ",") : "—"}</td>
    </tr>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div style={dato}>
      <p style={ui.label}>{etiqueta}</p>
      <div style={valor}>{children}</div>
    </div>
  );
}

const grilla = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: "20px 28px",
};

const dato = {
  display: "grid",
  gap: "6px",
  alignContent: "start" as const,
};

const valor = {
  fontSize: "15px",
  color: "#111111",
};

const nota = {
  ...ui.note,
  margin: "6px 0 0",
};

const lista = {
  margin: "6px 0 0",
  paddingLeft: "18px",
  fontSize: "14px",
  color: "#333333",
  lineHeight: 1.5,
};

const subtitulo = {
  fontSize: "14px",
  fontWeight: 600,
  margin: "28px 0 12px",
};

const detalle = {
  marginTop: "12px",
  borderTop: "1px solid #f2f2f2",
  paddingTop: "10px",
};

const resumen = {
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
};

const cuerpoDetalle = {
  display: "grid",
  gap: "12px",
  padding: "10px 0 4px",
};

const celdaChica = {
  ...ui.td,
  padding: "8px 12px",
  fontSize: "13px",
};
