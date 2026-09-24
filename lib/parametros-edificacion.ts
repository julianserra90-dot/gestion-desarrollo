/**
 * Los números con los que el motor de tipologías (`lib/tipologias.ts`) lee
 * un lote: mínimos del Código de Edificación, reglas del Código Urbanístico y
 * criterios arquitectónicos propios. Están todos acá, y no repartidos por el
 * motor, para corregirlos sin tocar la lógica: es el "panel interno" de la
 * idea original, por ahora como archivo.
 *
 * Cada valor dice de dónde sale. Los que citan el Código llevan
 * `verificar: true` hasta que se los contraste con el texto vigente: se
 * escribieron de memoria del CE (Ley 6100) y del CUr (Ley 6099 y modif.), y
 * un número de memoria no es un número del Código.
 */

export type Parametro = {
  valor: number;
  unidad: string;
  fuente: string;
  verificar: boolean;
};

const ce = (valor: number, unidad: string, fuente: string): Parametro => ({
  valor,
  unidad,
  fuente: `Código de Edificación: ${fuente}`,
  verificar: true,
});
const cur = (valor: number, unidad: string, fuente: string): Parametro => ({
  valor,
  unidad,
  fuente: `Código Urbanístico: ${fuente}`,
  verificar: true,
});
const propio = (valor: number, unidad: string, fuente: string): Parametro => ({
  valor,
  unidad,
  fuente: `Criterio propio: ${fuente}`,
  verificar: false,
});

export const PARAMETROS = {
  // ---- Medios de salida y elevación (CE) ----
  ascensorDesdePlantasSobrePb: ce(4, "plantas sobre PB", "ascensor obligatorio a partir de PB + 4"),
  escaleraAnchoMin: ce(1.2, "m", "escalera principal de vivienda colectiva"),
  escaleraHuellaMin: ce(0.26, "m", "huella mínima"),
  escaleraContrahuellaMax: ce(0.18, "m", "contrahuella máxima"),

  // ---- Locales (CE) ----
  dormitorioPrincipalM2: ce(9, "m²", "primer dormitorio, local de primera clase"),
  dormitorioM2: ce(6.5, "m²", "dormitorios siguientes"),
  dormitorioLadoMin: ce(2.5, "m", "lado mínimo de dormitorio"),
  estarM2: ce(12, "m²", "estar-comedor"),
  cocinaM2: ce(3, "m²", "cocina"),
  banoM2: ce(3.2, "m²", "baño completo"),

  // ---- Patios y ventilación (CUr) ----
  patioAuxiliarLadoMin: cur(3, "m", "patio auxiliar, lado mínimo"),
  patioAuxiliarM2: cur(12, "m²", "patio auxiliar, superficie mínima"),
  espacioUrbanoLadoMin: cur(4, "m", "patio de espacio urbano para locales de primera clase, lado mínimo"),

  // ---- Cocheras (CE) ----
  cocheraAncho: ce(2.5, "m", "módulo de estacionamiento, ancho"),
  cocheraLargo: ce(5, "m", "módulo de estacionamiento, largo"),
  cocheraCalleCirculacion: ce(3, "m", "calle de circulación con módulos en paralelo"),
  rampaPendienteMax: ce(0.2, "m/m", "rampa vehicular, pendiente máxima"),
  rampaAnchoMin: ce(3, "m", "rampa vehicular de un sentido, ancho mínimo"),
  desnivelSubsuelo: propio(3, "m", "profundidad de un subsuelo de cocheras"),

  // ---- Geometría de la planta (criterios propios) ----
  murosMedianeros: propio(0.3, "m", "lo que los muros medianeros descuentan del frente"),
  profundidadAmbienteMax: propio(6.5, "m", "hasta dónde ilumina y ventila una ventana"),
  profundidadUnidadMax: propio(9, "m", "una unidad que ventila a un solo lado: ambientes al frente y servicios al patio"),
  profundidadPasanteMax: propio(18, "m", "más hondo que esto, una unidad pasante deja el medio sin luz"),
  profundidadDosBandasMin: propio(16, "m", "para poner una unidad al frente y otra al contrafrente"),
  frenteUnidadMin: propio(6, "m", "una unidad más angosta que esto no arma estar y dormitorio"),
  frenteDosAlFrente: propio(8.66, "m", "desde este frente entran dos unidades lado a lado"),
  anchoUnidadMin: propio(4, "m", "una unidad más angosta no cierra ni como monoambiente"),
  nucleoBanda: propio(5, "m", "profundidad de la banda de núcleo (escalera de dos tramos) y patio"),
  nucleoEscaleraAncho: propio(2.6, "m", "caja de escalera de dos tramos con descanso, ancho"),
  nucleoAscensorAncho: propio(1.9, "m", "hueco de ascensor con estructura, ancho"),
  nucleoAscensorLargo: propio(2.1, "m", "hueco de ascensor con estructura, largo"),
  nucleoPalierM2: propio(4, "m²", "palier por planta"),
  hallAcceso: propio(1.5, "m", "ancho del hall de entrada en PB, que se descuenta al local o a la unidad del frente"),
  localProfundidadMax: propio(15, "m", "más hondo que esto un local ya no vende"),
  entradaCocheras: propio(4, "m", "lo que la entrada de cocheras descuenta de la primera fila"),
  cocherasMinParaValerLaPena: propio(2, "cocheras", "con menos, el portón no se justifica"),

  // ---- Programa (criterios propios) ----
  monoambienteHastaM2: propio(38, "m²", "hasta acá, monoambiente"),
  unDormitorioHastaM2: propio(55, "m²", "hasta acá, un dormitorio"),
  dosDormitoriosHastaM2: propio(75, "m²", "hasta acá, dos dormitorios; de ahí en más, tres"),
  eficienciaObjetivo: propio(0.82, "vendible / construible", "un edificio bien resuelto entre medianeras"),
} as const;

export type ClaveParametro = keyof typeof PARAMETROS;

/** El número, a secas: para que el motor se lea sin `.valor` en cada renglón. */
export function p(clave: ClaveParametro): number {
  return PARAMETROS[clave].valor;
}
