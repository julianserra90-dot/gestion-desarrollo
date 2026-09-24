/**
 * El motor de tipologías: de la geometría del lote y su normativa a una
 * propuesta de planta, núcleo, unidades y alternativas de programa, con el
 * porqué de cada una. Puro: reglas y cuentas, sin base ni inteligencia
 * artificial. Los números viven en `lib/parametros-edificacion.ts`.
 *
 * Lo que sale es una lectura para comparar lotes y descartar rápido, no un
 * anteproyecto: un lote regular entre medianeras, un solo cuerpo, el núcleo
 * en una banda del medio con un patio al lado, y las unidades ventilando al
 * frente o al contrafrente. Todo lo que el lote no da, la alternativa lo
 * dice como desventaja o como alerta, nunca lo esconde.
 */

import { p } from "@/lib/parametros-edificacion";

export type Terreno = {
  frente: number;
  /** Profundidad edificable desde la Línea Oficial: hasta la LFI, sin el retiro de frente. */
  profundidad: number;
  huellaM2: number;
  plantasSobrePb: number;
  alturaMax: number | null;
  planoLimite: number | null;
  /** Área de Mixtura de Usos, 1 a 4. */
  mixtura: number | null;
  enAvenida: boolean;
  retiroFrente: number;
};

export type Unidad = { nombre: string; m2: number; dormitorios: number; ventila: string };

export type Nucleo = { ascensor: boolean; motivo: string; m2: number; ubicacion: string };

export type Planta = {
  clave: "pasante" | "frente-contrafrente" | "dos-al-frente" | "cuatro-por-planta";
  nombre: string;
  viable: boolean;
  motivo: string;
  unidades: Unidad[];
  patios: string[];
  /** La unidad del contrafrente, si la planta tiene, para saber qué queda en PB cuando el frente es local. */
  contrafrente: Unidad | null;
};

export type Alternativa = {
  clave: string;
  nombre: string;
  viable: boolean;
  planta: Planta;
  pb: string;
  unidadesTotales: number;
  localM2: number | null;
  cocheras: number | null;
  construibleM2: number;
  vendibleM2: number;
  eficiencia: number;
  ventajas: string[];
  desventajas: string[];
  alertas: string[];
  puntaje: { normativa: number; geometria: number; ubicacion: number; eficiencia: number; total: number };
  recomendada: boolean;
};

export type Lectura = {
  nucleo: Nucleo;
  plantas: Planta[];
  plantaElegida: Planta;
  alternativas: Alternativa[];
  retiros: string[];
};

export function leerLote(t: Terreno): Lectura {
  const nucleo = calcularNucleo(t);
  const plantas = [
    plantaCuatro(t),
    plantaFrenteContrafrente(t),
    plantaDosAlFrente(t),
    plantaPasante(t, nucleo),
  ];
  const plantaElegida = elegirPlanta(plantas);

  const alternativas = [
    vivienda(t, nucleo, plantaElegida),
    viviendaConLocal(t, nucleo, plantaElegida),
    viviendaConCocheras(t, nucleo, plantaElegida),
    oficinasConLocal(t, nucleo),
  ];
  const mejor = alternativas
    .filter((a) => a.viable)
    .reduce<Alternativa | null>((m, a) => (m === null || a.puntaje.total > m.puntaje.total ? a : m), null);
  for (const a of alternativas) a.recomendada = a === mejor;

  return { nucleo, plantas, plantaElegida, alternativas, retiros: leerRetiros(t) };
}

// ------------------------------ Núcleo ------------------------------------

export function calcularNucleo(t: Terreno): Nucleo {
  const desde = p("ascensorDesdePlantasSobrePb");
  const ascensor = t.plantasSobrePb >= desde;
  const escalera = p("nucleoEscaleraAncho") * p("nucleoBanda");
  const hueco = ascensor ? p("nucleoAscensorAncho") * p("nucleoAscensorLargo") : 0;
  return {
    ascensor,
    motivo: ascensor
      ? `PB + ${t.plantasSobrePb}: desde PB + ${desde} el Código de Edificación exige ascensor. Escalera de dos tramos de ${formatear(p("escaleraAnchoMin"))} m de ancho, hueco de ${formatear(p("nucleoAscensorAncho"))} × ${formatear(p("nucleoAscensorLargo"))} m y palier.`
      : `PB + ${t.plantasSobrePb}: hasta PB + ${desde - 1} alcanza con la escalera, de dos tramos y ${formatear(p("escaleraAnchoMin"))} m de ancho.`,
    m2: redondear(escalera + hueco + p("nucleoPalierM2")),
    ubicacion:
      t.profundidad >= p("profundidadDosBandasMin")
        ? "en una banda del medio del lote, entre la unidad del frente y la del contrafrente, con el patio al lado"
        : "contra una medianera, al fondo, para dejar el frente entero a la unidad",
  };
}

// ------------------------------ Plantas -----------------------------------

/** Cómo se reparte la profundidad: banda del frente, banda del núcleo y banda del contrafrente. */
export function bandas(t: Terreno) {
  const anchoUtil = t.frente - p("murosMedianeros");
  const medio = p("nucleoBanda");
  if (t.profundidad < p("profundidadDosBandasMin")) {
    return { anchoUtil, frente: t.profundidad, medio: 0, contrafrente: 0, sobrante: 0 };
  }
  const resto = t.profundidad - medio;
  const frente = Math.min(p("profundidadUnidadMax"), resto * 0.55);
  const contrafrente = Math.min(p("profundidadUnidadMax"), resto - frente);
  return { anchoUtil, frente, medio, contrafrente, sobrante: resto - frente - contrafrente };
}

function patioDelMedio(t: Terreno, nucleo?: Nucleo): string[] {
  const b = bandas(t);
  if (b.medio === 0) return [];
  const anchoNucleo =
    p("nucleoEscaleraAncho") + (nucleo?.ascensor ?? t.plantasSobrePb >= p("ascensorDesdePlantasSobrePb") ? p("nucleoAscensorAncho") : 0);
  const anchoPatio = redondear(b.anchoUtil - anchoNucleo);
  const patio =
    anchoPatio >= p("patioAuxiliarLadoMin") && anchoPatio * b.medio >= p("patioAuxiliarM2")
      ? `Patio auxiliar de ${formatear(anchoPatio)} × ${b.medio} m junto al núcleo: ventila baños y cocinas.`
      : `Al lado del núcleo quedan ${formatear(anchoPatio)} m: no alcanza para un patio auxiliar de ${p("patioAuxiliarLadoMin")} m de lado, los baños y cocinas van a ventilación forzada o el núcleo se corre al frente.`;
  const fondo =
    b.sobrante > 0.5
      ? `Quedan ${formatear(b.sobrante)} m libres al fondo, hacia el pulmón de manzana.`
      : null;
  return [patio, fondo].filter((x): x is string => x !== null);
}

function unidad(nombre: string, m2: number, ventila: string): Unidad {
  const d = dormitoriosPara(m2);
  return { nombre: `${nombre}: ${tipoPorDormitorios(d)}`, m2: redondear(m2), dormitorios: d, ventila };
}

export function dormitoriosPara(m2: number): number {
  if (m2 <= p("monoambienteHastaM2")) return 0;
  if (m2 <= p("unDormitorioHastaM2")) return 1;
  if (m2 <= p("dosDormitoriosHastaM2")) return 2;
  return 3;
}

export function tipoPorDormitorios(d: number) {
  return d === 0 ? "monoambiente" : `${d} dormitorio${d > 1 ? "s" : ""}`;
}

function plantaPasante(t: Terreno, nucleo: Nucleo): Planta {
  const nombre = "Una unidad por planta, pasante";
  if (t.frente < p("frenteUnidadMin")) {
    return noViable("pasante", nombre, `con ${formatear(t.frente)} m de frente no se arma estar y dormitorio: hace falta ${p("frenteUnidadMin")} m`);
  }
  if (t.profundidad > p("profundidadPasanteMax")) {
    return noViable("pasante", nombre, `con ${formatear(t.profundidad)} m de profundidad el medio queda sin luz: una pasante funciona hasta ${p("profundidadPasanteMax")} m`);
  }
  const necesitaPatio = t.profundidad > 2 * p("profundidadAmbienteMax");
  const m2 = t.huellaM2 - nucleo.m2 - (necesitaPatio ? p("patioAuxiliarM2") : 0);
  return {
    clave: "pasante",
    nombre,
    viable: m2 >= p("monoambienteHastaM2") * 0.8,
    motivo: `Todo el frente y todo el fondo para una sola unidad, que ventila a los dos lados. Sin pasillos: se entra desde el palier.`,
    unidades: [unidad("Unidad pasante", m2, "al frente y al contrafrente")],
    patios: necesitaPatio
      ? [`Patio auxiliar de ${p("patioAuxiliarM2")} m² en el medio, para baños y cocina: más de ${2 * p("profundidadAmbienteMax")} m de profundidad no se ventilan desde las puntas.`]
      : [],
    contrafrente: null,
  };
}

function plantaFrenteContrafrente(t: Terreno): Planta {
  const nombre = "Frente y contrafrente: dos unidades por planta";
  const b = bandas(t);
  if (t.frente < p("frenteUnidadMin")) {
    return noViable("frente-contrafrente", nombre, `con ${formatear(t.frente)} m de frente no se arma estar y dormitorio`);
  }
  if (b.medio === 0) {
    return noViable("frente-contrafrente", nombre, `con ${formatear(t.profundidad)} m de profundidad no entran dos unidades y el núcleo en el medio: hacen falta ${p("profundidadDosBandasMin")} m`);
  }
  const frente = unidad("Unidad al frente", b.anchoUtil * b.frente, "a la calle");
  const contra = unidad("Unidad al contrafrente", b.anchoUtil * b.contrafrente, "al pulmón de manzana");
  return {
    clave: "frente-contrafrente",
    nombre,
    viable: b.contrafrente >= 5,
    motivo: `Una unidad mira a la calle (${formatear(b.frente)} m de profundidad) y otra al fondo (${formatear(b.contrafrente)} m); el núcleo y el patio van en la banda del medio. Las dos ventilan directo y no hay pasillos.`,
    unidades: [frente, contra],
    patios: patioDelMedio(t),
    contrafrente: contra,
  };
}

function plantaDosAlFrente(t: Terreno): Planta {
  const nombre = "Dos unidades al frente";
  const b = bandas(t);
  const ancho = (b.anchoUtil - 0.15) / 2;
  if (t.frente < p("frenteDosAlFrente")) {
    return noViable("dos-al-frente", nombre, `con ${formatear(t.frente)} m de frente no entran dos unidades lado a lado: desde ${formatear(p("frenteDosAlFrente"))} m`);
  }
  if (ancho < p("anchoUnidadMin")) {
    return noViable("dos-al-frente", nombre, `cada unidad quedaría de ${formatear(ancho)} m de ancho, menos que los ${p("anchoUnidadMin")} m de un monoambiente`);
  }
  if (b.medio > 0) {
    // Con profundidad para dos bandas, la que manda es la de cuatro.
    return noViable("dos-al-frente", nombre, "con esta profundidad conviene dos al frente y dos al contrafrente, ver la planta de cuatro");
  }
  const profundidad = Math.min(p("profundidadUnidadMax"), t.profundidad - p("nucleoBanda"));
  return {
    clave: "dos-al-frente",
    nombre,
    viable: profundidad >= 5,
    motivo: `Dos unidades de ${formatear(ancho)} m de ancho mirando a la calle; el núcleo al fondo. Angostas: son monoambientes o un dormitorio.`,
    unidades: [
      unidad("Unidad al frente, izquierda", ancho * profundidad, "a la calle"),
      unidad("Unidad al frente, derecha", ancho * profundidad, "a la calle"),
    ],
    patios: [],
    contrafrente: null,
  };
}

function plantaCuatro(t: Terreno): Planta {
  const nombre = "Dos al frente y dos al contrafrente: cuatro por planta";
  const b = bandas(t);
  const ancho = (b.anchoUtil - 0.15) / 2;
  if (t.frente < p("frenteDosAlFrente") || ancho < p("anchoUnidadMin")) {
    return noViable("cuatro-por-planta", nombre, `con ${formatear(t.frente)} m de frente no entran dos unidades lado a lado: desde ${formatear(p("frenteDosAlFrente"))} m`);
  }
  if (b.medio === 0) {
    return noViable("cuatro-por-planta", nombre, `con ${formatear(t.profundidad)} m de profundidad no entran las dos bandas y el núcleo: hacen falta ${p("profundidadDosBandasMin")} m`);
  }
  return {
    clave: "cuatro-por-planta",
    nombre,
    viable: b.contrafrente >= 5,
    motivo: `Cuatro unidades de ${formatear(ancho)} m de ancho: dos a la calle y dos al pulmón de manzana, con el núcleo y el patio en el medio. Es la planta que más unidades saca, a costa de unidades chicas.`,
    unidades: [
      unidad("Frente, izquierda", ancho * b.frente, "a la calle"),
      unidad("Frente, derecha", ancho * b.frente, "a la calle"),
      unidad("Contrafrente, izquierda", ancho * b.contrafrente, "al pulmón de manzana"),
      unidad("Contrafrente, derecha", ancho * b.contrafrente, "al pulmón de manzana"),
    ],
    patios: patioDelMedio(t),
    contrafrente: unidad("Contrafrente", ancho * b.contrafrente, "al pulmón de manzana"),
  };
}

function noViable(clave: Planta["clave"], nombre: string, motivo: string): Planta {
  return { clave, nombre, viable: false, motivo, unidades: [], patios: [], contrafrente: null };
}

/**
 * Entre las plantas viables: la de cuatro si sus unidades no quedan de menos
 * de 5 m de ancho (unidades de 4 m se venden mal), si no frente y
 * contrafrente, si no dos al frente, y la pasante al final: es la que menos
 * unidades saca, aunque sea la mejor unidad.
 */
function elegirPlanta(plantas: Planta[]): Planta {
  const viables = plantas.filter((pl) => pl.viable);
  const cuatro = viables.find((pl) => pl.clave === "cuatro-por-planta");
  if (cuatro && anchoUnidad(cuatro) >= 5) return cuatro;
  const orden: Planta["clave"][] = ["frente-contrafrente", "cuatro-por-planta", "dos-al-frente", "pasante"];
  for (const clave of orden) {
    const pl = viables.find((v) => v.clave === clave);
    if (pl) return pl;
  }
  return plantas[plantas.length - 1];
}

function anchoUnidad(planta: Planta) {
  // Las plantas de dos al frente reparten el frente en dos: el ancho de cada
  // una es la mitad de lo que reparten; se reconstruye desde las cuentas.
  return planta.unidades.length >= 2 && planta.clave !== "frente-contrafrente"
    ? Math.sqrt(planta.unidades[0].m2 / Math.max(1, p("profundidadUnidadMax"))) * Math.sqrt(p("profundidadUnidadMax"))
    : Infinity;
}

// ---------------------------- Alternativas --------------------------------

function base(t: Terreno, planta: Planta) {
  const porPlanta = planta.unidades.reduce((s, u) => s + u.m2, 0);
  const construibleM2 = redondear(t.huellaM2 * (t.plantasSobrePb + 1));
  return { porPlanta, construibleM2, plantasTipo: t.plantasSobrePb };
}

function vivienda(t: Terreno, nucleo: Nucleo, planta: Planta): Alternativa {
  const { porPlanta, construibleM2, plantasTipo } = base(t, planta);
  const b = bandas(t);
  // En PB la unidad del frente cede el hall de entrada.
  const hall = p("hallAcceso") * (b.medio > 0 ? b.frente : Math.min(t.profundidad, p("profundidadUnidadMax")));
  const pbM2 = Math.max(0, porPlanta - hall);
  const vendibleM2 = redondear(plantasTipo * porPlanta + pbM2);
  const unidadesTotales = planta.unidades.length * (plantasTipo + 1);
  return armar(t, planta, {
    clave: "vivienda",
    nombre: "Vivienda colectiva",
    viable: planta.viable,
    pb: `unidades como en la planta tipo, menos ${formatear(hall)} m² del hall de entrada`,
    unidadesTotales,
    localM2: null,
    cocheras: null,
    construibleM2,
    vendibleM2,
    ventajas: ["Todo el edificio es vivienda: un solo producto para vender y un solo tipo de comprador.", "La PB también vende, con patio propio la unidad del fondo."],
    desventajas: [
      "La unidad de PB al frente vale menos: da a la vereda.",
      ...(t.enAvenida ? ["Sobre una avenida, la PB rinde más como local que como vivienda."] : []),
    ],
    alertas: [],
    ubicacion: t.enAvenida ? 6 : 8,
    geometria: geometriaDe(planta, t),
  });
}

function viviendaConLocal(t: Terreno, nucleo: Nucleo, planta: Planta): Alternativa {
  const { porPlanta, construibleM2, plantasTipo } = base(t, planta);
  const b = bandas(t);
  const profundidadLocal = Math.min(b.medio > 0 ? b.frente + b.medio : t.profundidad, p("localProfundidadMax"));
  const localM2 = redondear((b.anchoUtil - p("hallAcceso")) * profundidadLocal);
  const pbContra = planta.contrafrente ? planta.contrafrente.m2 : 0;
  const vendibleM2 = redondear(plantasTipo * porPlanta + localM2 + pbContra);
  const unidadesTotales = planta.unidades.length * plantasTipo + (planta.contrafrente ? 1 : 0);
  const comercioFlojo = !t.enAvenida && t.mixtura !== null && t.mixtura <= 1;
  const sinMixtura = t.mixtura === null && !t.enAvenida;
  return armar(t, planta, {
    clave: "vivienda-local",
    nombre: "Vivienda con local en planta baja",
    viable: planta.viable,
    pb: `local de ${formatear(localM2)} m² (${formatear(b.anchoUtil - p("hallAcceso"))} m de vidriera por ${formatear(profundidadLocal)} m de fondo)${planta.contrafrente ? " y la unidad del contrafrente" : ""}`,
    unidadesTotales,
    localM2,
    cocheras: null,
    construibleM2,
    vendibleM2,
    ventajas: [
      t.enAvenida ? "Sobre una avenida el local es lo que más vale por metro de la planta baja." : "El local saca de la vereda la vivienda que menos vale.",
      "Se vende o se alquila aparte del edificio.",
    ],
    desventajas: comercioFlojo
      ? ["Calle interna y mixtura baja: el local puede tardar en alquilarse."]
      : [],
    alertas: comercioFlojo
      ? ["Mixtura 1: verificar en el cuadro de usos del Código Urbanístico qué comercios admite la parcela."]
      : sinMixtura
        ? ["La Ciudad no informó la mixtura de usos: verificar en el cuadro de usos qué comercios admite la parcela."]
        : [],
    ubicacion: t.enAvenida ? 9 : (t.mixtura ?? 2) >= 3 ? 7 : (t.mixtura ?? 2) === 2 ? 6 : 4,
    geometria: geometriaDe(planta, t),
  });
}

function viviendaConCocheras(t: Terreno, nucleo: Nucleo, planta: Planta): Alternativa {
  const { porPlanta, construibleM2, plantasTipo } = base(t, planta);
  const b = bandas(t);
  const filas =
    b.anchoUtil >= 2 * p("cocheraAncho") + p("cocheraCalleCirculacion")
      ? 2
      : b.anchoUtil >= p("cocheraAncho") + p("cocheraCalleCirculacion")
        ? 1
        : 0;
  const porFila = Math.floor((t.profundidad - p("entradaCocheras")) / p("cocheraLargo"));
  const unidadesTotales = planta.unidades.length * plantasTipo;
  const cocheras = Math.min(filas * porFila, Math.max(unidadesTotales, 0));
  const vendibleM2 = redondear(plantasTipo * porPlanta);
  const rampa = redondear(p("desnivelSubsuelo") / p("rampaPendienteMax"));
  const pbPerdida = redondear(porPlanta);
  const alcanza = cocheras >= Math.ceil(unidadesTotales / 2);
  return armar(t, planta, {
    clave: "vivienda-cocheras",
    nombre: "Vivienda con cocheras en planta baja",
    viable: planta.viable && cocheras >= p("cocherasMinParaValerLaPena"),
    pb: cocheras > 0
      ? `${cocheras} cocheras en ${filas} fila${filas > 1 ? "s" : ""} de ${formatear(p("cocheraAncho"))} × ${formatear(p("cocheraLargo"))} m, a nivel de vereda, sin rampa`
      : "no entra ni una fila de cocheras con calle de circulación",
    unidadesTotales,
    localM2: null,
    cocheras,
    construibleM2,
    vendibleM2,
    ventajas: [
      `${cocheras} cocheras vendibles o alquilables, sin rampa porque van a nivel.`,
      ...(alcanza ? ["Alcanza para la mitad de las unidades o más."] : []),
    ],
    desventajas: [
      `Se pierde la planta baja como vivienda: ${formatear(pbPerdida)} m² vendibles menos que con unidades.`,
      ...(!alcanza ? [`Sólo ${cocheras} cocheras para ${unidadesTotales} unidades.`] : []),
      `Un subsuelo pediría una rampa de ${formatear(rampa)} m al ${p("rampaPendienteMax") * 100} %${t.profundidad < rampa + 8 ? ", que no entra en este lote" : ""}.`,
    ],
    alertas: ["Verificar en el Código Urbanístico si la parcela exige guarda de vehículos según cantidad de unidades."],
    ubicacion: t.enAvenida ? 5 : 7,
    geometria: geometriaDe(planta, t) - (alcanza ? 0 : 2),
  });
}

function oficinasConLocal(t: Terreno, nucleo: Nucleo): Alternativa {
  const b = bandas(t);
  const dos = t.frente >= p("frenteDosAlFrente") && b.medio > 0;
  const patio = b.medio > 0 ? p("patioAuxiliarM2") : 0;
  const porPlanta = Math.max(0, t.huellaM2 - nucleo.m2 - patio);
  const construibleM2 = redondear(t.huellaM2 * (t.plantasSobrePb + 1));
  const profundidadLocal = Math.min(b.medio > 0 ? b.frente + b.medio : t.profundidad, p("localProfundidadMax"));
  const localM2 = redondear((b.anchoUtil - p("hallAcceso")) * profundidadLocal);
  const vendibleM2 = redondear(t.plantasSobrePb * porPlanta + localM2);
  // Sin mixtura conocida no se descarta: se avisa que hay que verificarla.
  const admite = t.enAvenida || t.mixtura === null || t.mixtura >= 2;
  const planta: Planta = {
    clave: "pasante",
    nombre: dos ? "Dos oficinas por planta" : "Una oficina por planta",
    viable: porPlanta >= 40,
    motivo: "Planta libre alrededor del núcleo: las oficinas no piden dormitorios ni patios por ambiente.",
    unidades: dos
      ? [
          { nombre: "Oficina al frente", m2: redondear(porPlanta / 2), dormitorios: 0, ventila: "a la calle" },
          { nombre: "Oficina al contrafrente", m2: redondear(porPlanta / 2), dormitorios: 0, ventila: "al pulmón de manzana" },
        ]
      : [{ nombre: "Oficina de planta entera", m2: redondear(porPlanta), dormitorios: 0, ventila: "al frente y al contrafrente" }],
    patios: b.medio > 0 ? [`Patio auxiliar de ${p("patioAuxiliarM2")} m² junto al núcleo, para baños y office.`] : [],
    contrafrente: null,
  };
  return armar(t, planta, {
    clave: "oficinas-local",
    nombre: "Oficinas con local en planta baja",
    viable: planta.viable && admite,
    pb: `local de ${formatear(localM2)} m²`,
    unidadesTotales: planta.unidades.length * t.plantasSobrePb,
    localM2,
    cocheras: null,
    construibleM2,
    vendibleM2,
    ventajas: ["La planta libre rinde más metros vendibles que la vivienda: sin patios por unidad ni muros divisorios.", "Núcleo y baños compartidos por planta."],
    desventajas: [
      ...(!t.enAvenida ? ["En una calle interna la demanda de oficinas es chica."] : []),
      "Se vende más lento que la vivienda y depende del barrio.",
    ],
    alertas: !admite
      ? ["Mixtura 1 en calle interna: las oficinas pueden no estar admitidas; verificar el cuadro de usos."]
      : t.mixtura === null && !t.enAvenida
        ? ["La Ciudad no informó la mixtura de usos: verificar en el cuadro de usos si admite oficinas."]
        : [],
    ubicacion: t.enAvenida ? 8 : (t.mixtura ?? 2) >= 3 ? 6 : 3,
    geometria: b.medio > 0 ? 8 : 6,
  });
}

function geometriaDe(planta: Planta, t: Terreno) {
  if (!planta.viable) return 0;
  const b = bandas(t);
  switch (planta.clave) {
    case "cuatro-por-planta":
      return (b.anchoUtil - 0.15) / 2 >= 5 ? 9 : 6;
    case "frente-contrafrente":
      return b.contrafrente >= 6 ? 8 : 7;
    case "dos-al-frente":
      return 6;
    case "pasante":
      return t.profundidad <= 14 ? 8 : 6;
  }
}

function armar(
  t: Terreno,
  planta: Planta,
  a: Omit<Alternativa, "planta" | "eficiencia" | "puntaje" | "recomendada"> & { ubicacion: number; geometria: number }
): Alternativa {
  const eficiencia = a.construibleM2 > 0 ? redondear(a.vendibleM2 / a.construibleM2) : 0;
  const normativa = a.viable ? Math.max(0, 10 - a.alertas.length * 2) : 0;
  const puntajeEficiencia = Math.min(10, Math.round((eficiencia / p("eficienciaObjetivo")) * 10));
  const total = a.viable
    ? Math.round(((normativa + a.geometria + a.ubicacion + puntajeEficiencia) / 4) * 10) / 10
    : 0;
  const { ubicacion, geometria, ...resto } = a;
  return {
    ...resto,
    planta,
    eficiencia,
    puntaje: { normativa, geometria, ubicacion, eficiencia: puntajeEficiencia, total },
    recomendada: false,
  };
}

// ------------------------------ Retiros -----------------------------------

function leerRetiros(t: Terreno): string[] {
  const salida: string[] = [];
  salida.push(
    t.retiroFrente > 0
      ? `Retiro de frente obligatorio de ${formatear(t.retiroFrente)} m: la fachada va detrás de la Línea Oficial.`
      : "Sin retiro de frente: se construye sobre la Línea Oficial."
  );
  salida.push(`Al fondo, la LFI deja libre lo que pasa de ${formatear(t.profundidad)} m desde la Línea Oficial.`);
  if (t.alturaMax !== null && t.planoLimite !== null && t.planoLimite > t.alturaMax) {
    const sobra = t.planoLimite - t.alturaMax;
    salida.push(
      sobra >= 2.6
        ? `Entre la altura máxima y el plano límite hay ${formatear(sobra)} m: ${Math.floor(sobra / 2.8)} planta${Math.floor(sobra / 2.8) === 1 ? "" : "s"} retirada${Math.floor(sobra / 2.8) === 1 ? "" : "s"} posible${Math.floor(sobra / 2.8) === 1 ? "" : "s"}, con el retiro que exija el Código Urbanístico.`
        : `Sobre la altura máxima quedan ${formatear(sobra)} m hasta el plano límite: sólo tanques, sala de máquinas y pérgolas.`
    );
  } else if (t.alturaMax !== null) {
    salida.push("El plano límite coincide con la altura máxima: nada por encima, ni retirado.");
  }
  return salida;
}

// ------------------------------ Utiles ------------------------------------

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

function formatear(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}
