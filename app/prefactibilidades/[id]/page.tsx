import Link from "next/link";
import AppShell from "@/components/AppShell";
import AppSidebar from "@/components/AppSidebar";
import EstadoPrefactibilidad from "@/components/EstadoPrefactibilidad";
import Volver from "@/components/Volver";
import * as ui from "@/components/ui";
import Tipologias from "@/components/Tipologias";
import VolumenLote from "@/components/VolumenLote";
import { valoresDesdeCiudad, type ConsultaCiudad, type ValoresCiudad } from "@/lib/ciudad";
import { formatDate, formatM2, formatMoney, formatUSD } from "@/lib/format";
import {
  aMetros,
  anilloExterior,
  frenteDe,
  huellaPorSuperficie,
  rectangulo,
  simplificar,
  type Punto,
} from "@/lib/geometria";
import { getCotizacionActual } from "@/lib/dolar";
import { capacidadCpu, plusvaliaUva, resumenLote } from "@/lib/prefactibilidad";
import { createClient } from "@/lib/supabase/server";
import BotonConfirmar from "@/components/BotonConfirmar";
import { eliminarPrefactibilidad, reconsultarPrefactibilidad } from "../actions";

// "Actualizar desde la Ciudad" encadena USIG y Ciudad 3D con reintentos:
// puede pasar de los 10 segundos que Vercel da por defecto a una acción.
export const maxDuration = 60;

/**
 * La ficha de un estudio: lo que trajo la Ciudad, lo que se corrigió a mano
 * —dicho al lado, con el valor original— y arriba la primera aproximación
 * del volumen. Sin campos editables: para cambiar algo está Editar, y para
 * volver a traer todo, Actualizar desde la Ciudad.
 */
export default async function FichaPrefactibilidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: estudio } = await supabase
    .from("prefactibilidades")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!estudio) {
    return <AppShell>Estudio no encontrado</AppShell>;
  }

  const ciudad = estudio.ciudad as unknown as ConsultaCiudad | null;
  const deCiudad = ciudad ? valoresDesdeCiudad(ciudad) : null;
  const cuentas = resumenLote(estudio);
  const enDolares = estudio.moneda_valor === "USD";
  const formatValor = enDolares ? formatUSD : formatMoney;
  const superficieDerivada =
    estudio.superficie_m2 === null && cuentas.superficieLote !== null;

  // Si el valor guardado no es el que trajo la Ciudad, alguien lo corrigió:
  // se dice al lado, con lo que decía la Ciudad, para no perder ninguno.
  const corregido = (campo: keyof ValoresCiudad, mostrar: (v: number | string) => string) => {
    if (!deCiudad) return null;
    const original = deCiudad[campo];
    const actual = estudio[campo];
    if (original === actual || original === null || original === undefined) return null;
    if (typeof original === "boolean") return null;
    return (
      <span style={ui.note}>
        {" "}
        · corregido a mano; la Ciudad dice {mostrar(original)}
      </span>
    );
  };
  const metros = (v: number | string) => `${formatMetros(Number(v))} m`;
  const m2 = (v: number | string) => formatM2(Number(v));
  const talCual = (v: number | string) => String(v);

  const terreno = [
    estudio.barrio ? fila("Barrio", <>{estudio.barrio}{corregido("barrio", talCual)}</>) : null,
    estudio.comuna ? fila("Comuna", estudio.comuna) : null,
    estudio.smp
      ? fila("Nomenclatura catastral", <>{estudio.smp}{corregido("smp", talCual)}</>)
      : null,
    estudio.ancho_m !== null
      ? fila("Frente", <>{metros(estudio.ancho_m)}{corregido("ancho_m", metros)}</>)
      : null,
    estudio.profundidad_m !== null
      ? fila("Fondo", <>{metros(estudio.profundidad_m)}{corregido("profundidad_m", metros)}</>)
      : null,
    cuentas.superficieLote !== null
      ? fila(
          "Superficie",
          <>
            {formatM2(cuentas.superficieLote)}
            {superficieDerivada && <span style={ui.note}> · frente × fondo</span>}
            {corregido("superficie_m2", m2)}
          </>
        )
      : null,
    estudio.valor_terreno !== null
      ? fila("Valor del terreno", formatValor(estudio.valor_terreno))
      : null,
    estudio.tipo_desarrollo && estudio.tipo_desarrollo !== "A definir"
      ? fila("Tipo de desarrollo a evaluar", estudio.tipo_desarrollo)
      : null,
    estudio.construcciones_existentes
      ? fila(
          "Construcciones existentes",
          <>{estudio.construcciones_existentes}{corregido("construcciones_existentes", talCual)}</>,
          true
        )
      : null,
  ].filter(esFila);

  const e = ciudad?.edificabilidad ?? null;
  const franjas = (e?.altura_max ?? []).filter((a) => a > 0);

  // El volumen: el polígono real de la parcela si la Ciudad lo dio, o un
  // rectángulo de frente × fondo. La huella es la banda desde el frente que
  // suma la superficie edificable en planta; el frente es el lado más
  // cercano a la puerta.
  const anillo = ciudad?.geometria ? anilloExterior(ciudad.geometria) : null;
  const centro: [number, number] = ciudad?.parcela?.centroide ?? [
    estudio.lng ?? 0,
    estudio.lat ?? 0,
  ];
  const lote: Punto[] | null =
    anillo && anillo.length >= 3
      ? simplificar(aMetros(anillo, centro))
      : estudio.ancho_m && estudio.profundidad_m
        ? rectangulo(estudio.ancho_m, estudio.profundidad_m)
        : null;
  const puerta =
    anillo && ciudad?.puerta
      ? aMetros([[ciudad.puerta.lng, ciudad.puerta.lat]], centro)[0]
      : null;
  const frente = lote ? frenteDe(lote, puerta) : null;
  const huella =
    lote && frente && cuentas.areaEdificablePlanta !== null
      ? huellaPorSuperficie(lote, frente, cuentas.areaEdificablePlanta)
      : null;

  // El motor de tipologías lee la huella (profundidad edificable real, no
  // el fondo), las plantas y la mixtura. Sin frente o sin plantas no hay
  // qué leer.
  const profundidadEdificable = huella?.profundidad ?? cuentas.profundidadEdificable;
  const datosTipologia =
    estudio.ancho_m && profundidadEdificable && cuentas.areaEdificablePlanta && estudio.plantas_sobre_pb !== null
      ? {
          frente: estudio.ancho_m,
          profundidad: profundidadEdificable,
          huellaM2: cuentas.areaEdificablePlanta,
          plantasSobrePb: estudio.plantas_sobre_pb,
          alturaMax: estudio.altura_maxima_m,
          planoLimite: estudio.plano_limite_m,
          mixtura: Number(estudio.mixtura_usos?.match(/\d/)?.[0] ?? NaN) || null,
          enAvenida: /\bAV\.?(\s|$)/i.test(estudio.direccion_normalizada ?? estudio.direccion),
          retiroFrente: estudio.retiro_frente_m ?? 0,
        }
      : null;

  // La plusvalía se calcula acá y no en la consulta, para que siga a las
  // plantas y a la huella que el usuario corrija.
  const datosPlusvalia = {
    fot: e?.fot.fot_medianera ?? null,
    superficieParcela: e?.superficie_parcela ?? null,
    incidenciaUva: e?.plusvalia.incidencia_uva ?? null,
    alicuota: e?.plusvalia.alicuota ?? null,
  };
  const plusvalia = plusvaliaUva({
    superficieConstruible: cuentas.superficieConstruible,
    ...datosPlusvalia,
  });
  const capacidad = capacidadCpu(datosPlusvalia.fot, datosPlusvalia.superficieParcela);
  const uva = ciudad?.uva ?? null;
  // En dólares al blue de hoy, que es como se habla de un terreno; sólo si
  // hay algo que pagar.
  const dolar = plusvalia && uva ? await getCotizacionActual() : null;
  // Si la Ciudad calculó otra cosa para la misma superficie, se dice: es el
  // chequeo de la fórmula propia.
  const chequeo = ciudad?.plusvaliaCiudad ?? null;
  const chequeoPropio = chequeo
    ? plusvaliaUva({ superficieConstruible: chequeo.areaEdificar, ...datosPlusvalia })
    : null;
  const chequeoDifiere =
    chequeo !== null && chequeoPropio !== null && Math.abs(chequeoPropio - chequeo.uva) > 1;

  const normativa = [
    estudio.unidad_edificabilidad
      ? fila(
          "Unidad de edificabilidad",
          <>{estudio.unidad_edificabilidad}{corregido("unidad_edificabilidad", talCual)}</>
        )
      : null,
    estudio.mixtura_usos
      ? fila("Mixtura de usos", <>{estudio.mixtura_usos}{corregido("mixtura_usos", talCual)}</>)
      : null,
    estudio.altura_maxima_m !== null
      ? fila(
          "Altura máxima",
          <>
            {metros(estudio.altura_maxima_m)}
            {franjas.length > 1 && (
              <span style={ui.note}> · franjas: {franjas.map((a) => metros(a)).join(", ")}</span>
            )}
            {corregido("altura_maxima_m", metros)}
          </>
        )
      : null,
    estudio.plano_limite_m !== null
      ? fila("Plano límite", <>{metros(estudio.plano_limite_m)}{corregido("plano_limite_m", metros)}</>)
      : null,
    estudio.plantas_sobre_pb !== null
      ? fila(
          "Plantas",
          <>
            {estudio.plantas_sobre_pb === 0 ? "Sólo PB" : `PB + ${estudio.plantas_sobre_pb}`}
            {deCiudad && deCiudad.plantas_sobre_pb === estudio.plantas_sobre_pb && (
              <span style={ui.note}> · las de la unidad de edificabilidad</span>
            )}
            {corregido("plantas_sobre_pb", (v) => `PB + ${v}`)}
          </>
        )
      : null,
    estudio.sup_edificable_planta_m2 !== null
      ? fila(
          "Área edificable en planta",
          <>{m2(estudio.sup_edificable_planta_m2)}{corregido("sup_edificable_planta_m2", m2)}</>
        )
      : null,
    estudio.fot !== null ? fila("FOT entre medianeras", String(estudio.fot).replace(".", ",")) : null,
    estudio.retiro_frente_m !== null && estudio.retiro_frente_m > 0
      ? fila("Retiro de frente", metros(estudio.retiro_frente_m))
      : null,
    estudio.lfi_m !== null ? fila("Profundidad hasta la LFI", metros(estudio.lfi_m)) : null,
    estudio.lib_m !== null ? fila("Profundidad hasta la LIB", metros(estudio.lib_m)) : null,
    estudio.patios ? fila("Patios y retiros exigidos", estudio.patios, true) : null,
    estudio.usos_permitidos ? fila("Usos permitidos", estudio.usos_permitidos, true) : null,
    estudio.aph || estudio.aph_detalle
      ? fila(
          estudio.aph ? "Protección histórica" : "Distrito especial",
          <>
            {estudio.aph ? "Está en un APH" : ""}
            {estudio.aph_detalle && (
              <span style={estudio.aph ? ui.note : undefined}>
                {estudio.aph ? " · " : ""}
                {estudio.aph_detalle}
              </span>
            )}
          </>,
          true
        )
      : null,
    estudio.catalogado ? fila("Catalogación", "Inmueble catalogado") : null,
    estudio.afectaciones ? fila("Afectaciones", estudio.afectaciones, true) : null,
    estudio.plusvalia ? fila("Plusvalía urbana", estudio.plusvalia, true) : null,
    e && e.parcelas_linderas.smp_linderas.length > 0
      ? fila(
          "Parcelas linderas",
          <>
            {e.parcelas_linderas.smp_linderas.join(", ")}
            {e.parcelas_linderas.aph_linderas && (
              <span style={ui.note}> · alguna lindera está en un APH</span>
            )}
          </>,
          true
        )
      : null,
  ].filter(esFila);

  const documentos = e
    ? [
        e.link_imagen.croquis_parcela ? { titulo: "Croquis de parcela", href: e.link_imagen.croquis_parcela } : null,
        e.link_imagen.perimetro_manzana ? { titulo: "Perímetro de manzana", href: e.link_imagen.perimetro_manzana } : null,
        e.link_imagen.plano_indice ? { titulo: "Plano índice", href: e.link_imagen.plano_indice } : null,
      ].filter((d): d is { titulo: string; href: string } => d !== null)
    : [];

  const tarjetas = [
    cuentas.superficieLote !== null
      ? tarjeta("Superficie del lote", formatM2(cuentas.superficieLote))
      : null,
    cuentas.areaEdificablePlanta !== null
      ? tarjeta(
          "Área edificable en planta",
          formatM2(cuentas.areaEdificablePlanta),
          estudio.sup_edificable_planta_m2
            ? "según Ciudad 3D"
            : cuentas.profundidadEdificable !== null
              ? `${formatMetros(estudio.ancho_m ?? 0)} × ${formatMetros(cuentas.profundidadEdificable)} m${
                  estudio.lfi_m === null ? " · sin LFI, se toma el lote entero" : ""
                }`
              : undefined
        )
      : null,
    cuentas.superficieConstruible !== null
      ? tarjeta(
          "Superficie construible",
          formatM2(cuentas.superficieConstruible),
          `PB + ${estudio.plantas_sobre_pb} plantas`
        )
      : null,
    cuentas.incidenciaConstruible !== null
      ? tarjeta(
          "Incidencia por m² construible",
          formatValor(cuentas.incidenciaConstruible),
          cuentas.incidenciaLote !== null
            ? `${formatValor(cuentas.incidenciaLote)} por m² de lote`
            : undefined
        )
      : cuentas.incidenciaLote !== null
        ? tarjeta("Incidencia por m² de lote", formatValor(cuentas.incidenciaLote))
        : null,
    plusvalia === null
      ? null
      : plusvalia === 0
        ? tarjeta(
            "Plusvalía urbana",
            "No paga",
            capacidad !== null
              ? `el CPU ya permitía ${formatM2(capacidad)}, más que lo construible`
              : "alícuota cero en esta parcela"
          )
        : tarjeta(
            "Plusvalía urbana",
            `${formatUva(plusvalia)} UVA`,
            [
              uva
                ? `≈ ${formatMoney(plusvalia * uva.valor)}${
                    dolar ? ` o ${formatUSD((plusvalia * uva.valor) / dolar.venta)} al blue` : ""
                  } · UVA a ${formatMoney(uva.valor)} del ${formatDate(uva.fecha)}`
                : null,
              capacidad !== null
                ? `sobre ${formatM2(Math.max(0, (cuentas.superficieConstruible ?? 0) - capacidad))} que exceden el CPU`
                : null,
              chequeoDifiere && chequeo
                ? `Ciudad 3D calcula ${formatUva(chequeo.uva)} UVA para ${formatM2(chequeo.areaEdificar)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          ),
  ].filter(esTarjeta);

  const avisos = ciudad?.avisos ?? [];

  return (
    <AppShell sidebar={<AppSidebar activo="prefactibilidades" />}>
      <Volver href="/prefactibilidades">Prefactibilidades</Volver>

      <section style={ui.sectionHeader}>
        <p style={ui.eyebrow}>Prefactibilidad</p>
        <h2 style={ui.pageTitle}>{estudio.direccion}</h2>
        <p style={ui.subtitle}>
          <EstadoPrefactibilidad valor={estudio.estado} />
          <span style={ui.note}>
            {estudio.direccion_normalizada && ` · ${estudio.direccion_normalizada}`}
            {estudio.barrio && ` · ${estudio.barrio}`}
            {estudio.consultado_en
              ? ` · consultado a la Ciudad el ${formatDate(estudio.consultado_en.slice(0, 10))}`
              : " · sin consultar a la Ciudad"}
          </span>
        </p>
      </section>

      {error && <p style={errorBox}>{error}</p>}

      {avisos.length > 0 && (
        <div style={avisoBox}>
          {avisos.map((a) => (
            <p key={a} style={{ margin: 0 }}>
              {a}
            </p>
          ))}
        </div>
      )}

      {/* Dos acciones: corregir a mano, o volver a preguntarle a la Ciudad.
          La segunda pisa las correcciones, y el botón lo dice. */}
      <div style={acciones}>
        <form action={reconsultarPrefactibilidad}>
          <input type="hidden" name="prefactibilidad_id" value={estudio.id} />
          <button
            type="submit"
            style={ui.secondaryButton}
            title="Vuelve a traer todo de USIG y Ciudad 3D y pisa las correcciones a mano"
          >
            Actualizar desde la Ciudad
          </button>
        </form>
        <Link href={`/prefactibilidades/${estudio.id}/editar`} style={ui.button}>
          Editar estudio
        </Link>
      </div>

      {/* El volumen primero: es la pregunta que trae a esta pantalla. Los
          datos de abajo son de dónde sale. */}
      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Primera aproximación</h3>
        {tarjetas.length === 0 ? (
          <p style={ui.vacio}>
            Con frente, fondo y plantas se calcula el volumen. Todavía no hay
            con qué.
          </p>
        ) : (
          <>
            <div style={ui.statsGrid}>
              {tarjetas.map((t) => (
                <div key={t.etiqueta} style={ui.statCard}>
                  <p style={ui.label}>{t.etiqueta}</p>
                  <p style={ui.statNumber}>{t.valor}</p>
                  {t.nota && <p style={notaTarjeta}>{t.nota}</p>}
                </div>
              ))}
            </div>
            <p style={notaFinal}>
              Un solo cuerpo sobre el área edificable, sin patios ni descuentos
              de núcleo: es el techo que da la normativa, no el proyecto. Lo
              vendible sale de acá para abajo.
            </p>
          </>
        )}
      </section>

      {lote && frente && (
        <section style={ui.panelConMargen}>
          <h3 style={ui.sectionTitle}>Volumen edificable</h3>
          <VolumenLote
            lote={lote}
            huella={huella?.huella ?? lote}
            frente={frente}
            alturaMaxima={estudio.altura_maxima_m}
            planoLimite={estudio.plano_limite_m}
            plantasSobrePb={estudio.plantas_sobre_pb}
            etiquetaFrente={
              estudio.ancho_m !== null ? `${formatMetros(estudio.ancho_m)} m de frente` : undefined
            }
            etiquetaProfundidad={
              huella
                ? `huella hasta ${formatMetros(huella.profundidad)} m desde la Línea Oficial`
                : undefined
            }
          />
          <p style={notaFinal}>
            {anillo
              ? "La forma del lote es la del catastro de la Ciudad. "
              : "Sin el polígono de la Ciudad, el lote se dibuja como un rectángulo de frente por fondo. "}
            La huella es la banda desde el frente que suma la superficie
            edificable en planta, levantada hasta la altura máxima: la
            envolvente, no un proyecto.
          </p>
        </section>
      )}

      {datosTipologia && <Tipologias terreno={datosTipologia} />}

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>El terreno</h3>
        {terreno.length === 0 ? (
          <p style={ui.vacio}>Sólo la dirección, por ahora.</p>
        ) : (
          <div style={grilla}>
            {terreno.map((f) => (
              <Dato key={f.etiqueta} etiqueta={f.etiqueta} ancho={f.ancho}>
                {f.valor}
              </Dato>
            ))}
          </div>
        )}
      </section>

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Normativa</h3>
        {normativa.length === 0 ? (
          <p style={ui.vacio}>
            La Ciudad no devolvió la normativa de la parcela. Actualizá desde la
            Ciudad, o cargala a mano desde Editar.
          </p>
        ) : (
          <div style={grilla}>
            {normativa.map((f) => (
              <Dato key={f.etiqueta} etiqueta={f.etiqueta} ancho={f.ancho}>
                {f.valor}
              </Dato>
            ))}
          </div>
        )}
        {documentos.length > 0 && (
          <p style={{ ...notaFinal, display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {documentos.map((d) => (
              <a key={d.href} href={d.href} target="_blank" rel="noreferrer" style={enlaceDoc}>
                {d.titulo} ↗
              </a>
            ))}
          </p>
        )}
        <p style={notaFinal}>
          Fuente: USIG y Ciudad 3D, Gobierno de la Ciudad. Es una lectura
          automática: verificar contra la mensura y la normativa vigente antes
          de decidir.
        </p>
      </section>

      {estudio.observaciones && (
        <section style={ui.panelConMargen}>
          <h3 style={ui.sectionTitle}>Observaciones</h3>
          <p style={parrafo}>{estudio.observaciones}</p>
        </section>
      )}

      {/* Borrar vive acá y no en Editar: se decide mirando el estudio entero,
          y en Editar nadie lo encontraba. Un estudio no tiene nada colgado
          —ni gastos ni archivos—, así que borrarlo es borrar sólo esto. */}
      <section style={zonaBorrar}>
        <form action={eliminarPrefactibilidad}>
          <input type="hidden" name="prefactibilidad_id" value={estudio.id} />
          <BotonConfirmar
            mensaje={`¿Eliminar el estudio de ${estudio.direccion}? No se puede deshacer.`}
            style={botonBorrar}
          >
            Eliminar estudio
          </BotonConfirmar>
        </form>
      </section>
    </AppShell>
  );
}

type Fila = { etiqueta: string; valor: React.ReactNode; ancho: boolean };
type Tarjeta = { etiqueta: string; valor: string; nota?: string };

function fila(etiqueta: string, valor: React.ReactNode, ancho = false): Fila {
  return { etiqueta, valor, ancho };
}

function tarjeta(etiqueta: string, valor: string, nota?: string): Tarjeta {
  return { etiqueta, valor, nota };
}

function esFila(f: Fila | null): f is Fila {
  return f !== null;
}

function esTarjeta(t: Tarjeta | null): t is Tarjeta {
  return t !== null;
}

function Dato({
  etiqueta,
  ancho = false,
  children,
}: {
  etiqueta: string;
  ancho?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={ancho ? { ...dato, gridColumn: "1 / -1" } : dato}>
      <p style={ui.label}>{etiqueta}</p>
      <div style={valor}>{children}</div>
    </div>
  );
}

function formatMetros(valor: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(valor);
}

function formatUva(valor: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(valor);
}

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginBottom: "20px",
};

const grilla = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
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

const notaTarjeta = {
  ...ui.note,
  margin: "6px 0 0",
};

const notaFinal = {
  ...ui.note,
  marginTop: "20px",
  marginBottom: 0,
};

const enlaceDoc = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
};

const parrafo = {
  ...ui.text,
  whiteSpace: "pre-wrap" as const,
  margin: 0,
};

const errorBox = {
  border: "1px solid #111111",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const zonaBorrar = {
  marginTop: "40px",
  paddingTop: "24px",
  borderTop: "1px solid #eeeeee",
  display: "flex",
  justifyContent: "flex-end",
};

const botonBorrar = {
  ...ui.secondaryButton,
  color: ui.ROJO,
  borderColor: "#f1c8c8",
};

// Ámbar, como la etiqueta de "previo" en las semanas: es un aviso, no un
// error ni plata.
const avisoBox = {
  background: "#fdf0dd",
  color: "#8a5a12",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
  display: "grid",
  gap: "6px",
};
