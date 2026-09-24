/**
 * SÓLO SERVIDOR. Consulta a la Ciudad de Buenos Aires por un terreno.
 *
 * Dos fuentes públicas del Gobierno de la Ciudad:
 * - **USIG** (Unidad de Sistemas de Información Geográfica): normaliza la
 *   dirección y la ubica. El método `centroide` del geocodificador devuelve
 *   el centro de la parcela de una puerta oficial, que es el punto que hace
 *   falta: el de la puerta cae en la vereda y la consulta de parcela se la
 *   lleva un vecino, o nadie.
 * - **La API de Ciudad 3D** (`epok.buenosaires.gob.ar`): la ficha catastral
 *   de la parcela y la normativa del Código Urbanístico por SMP. No está
 *   documentada para terceros; los endpoints salen del código abierto del
 *   propio Ciudad 3D (github.com/gcba/Ciudad-3D, `utils/apiConfig.js`). Si
 *   la Ciudad los cambia, esto deja de andar y hay que volver a mirar ahí.
 *
 * USIG se queda mudo seguido —de cada dos pedidos uno no contesta hasta el
 * timeout—, así que todo pasa por `pedir`, con timeout corto y reintentos.
 * Lo que no se pudo traer no frena el estudio: queda como aviso y se puede
 * volver a consultar.
 */

import {
  nombreUnidadEdificabilidad,
  plantasSobrePbEstimadas,
} from "@/lib/prefactibilidad";

const USIG_SERVICIOS = "https://servicios.usig.buenosaires.gob.ar";
const USIG_WS = "https://ws.usig.buenosaires.gob.ar";
const EPOK = "https://epok.buenosaires.gob.ar";

export type DireccionUsig = {
  altura: number | null;
  cod_calle: number;
  cod_partido: string;
  coordenadas: { x: string | number; y: string | number; srid: number };
  direccion: string;
  nombre_calle: string;
  tipo: string;
};

/** `catastro/parcela`. Los números vienen como texto; AGIP (2008) es la fuente. */
export type ParcelaCatastro = {
  direccion: string;
  smp: string;
  seccion: string;
  manzana: string;
  parcela: string;
  centroide: [number, number];
  srid: number;
  superficie_total: string;
  superficie_cubierta: string;
  frente: string;
  fondo: string;
  propiedad_horizontal: string;
  pisos_bajo_rasante: string;
  pisos_sobre_rasante: string;
  unidades_funcionales: string;
  locales: string;
  fuente: string;
  puertas?: { calle: string; altura: number; codigo_calle: number; puerta_oficial: boolean }[];
};

/** `cur3d/seccion_edificabilidad`. Las alturas van por franja: la primera es la de la unidad. */
export type Edificabilidad = {
  sup_max_edificable: number;
  sup_edificable_planta: number;
  altura_max: number[];
  altura_max_plano_limite: number;
  unidad_edificabilidad: number[];
  plusvalia: {
    plusvalia_em: number;
    plusvalia_pl: number;
    plusvalia_sl: number;
    incidencia_uva: number;
    alicuota: number;
    distrito_cpu: string;
  };
  fot: { fot_medianera: number; fot_perim_libre: number; fot_semi_libre: number };
  parcelas_linderas: { smp_linderas: string[]; aph_linderas: boolean };
  catalogacion: {
    denominacion: string | null;
    proteccion: string | null;
    estado: string | null;
    ley_3056: string | null;
    catalogacion: string | null;
  };
  distrito_especial: { distrito_agrupado: string; distrito_especifico: string }[];
  tipica: string;
  afectaciones: Record<string, number>;
  subzona: string;
  link_imagen: { croquis_parcela: string; perimetro_manzana: string; plano_indice: string };
  irregular: boolean;
  superficie_parcela: number;
  microcentr: string;
};

export type ConsultaCiudad = {
  consultadoEn: string;
  direccionNormalizada: string | null;
  codCalle: number | null;
  altura: number | null;
  coordenadas: { lng: number; lat: number } | null;
  /** El punto de la puerta según USIG: dice de qué lado del lote está la calle. */
  puerta: { lng: number; lat: number } | null;
  /** El polígono de la parcela (GeoJSON de `catastro/geometria`). */
  geometria: unknown | null;
  /** El valor de la UVA del día de la consulta, para pasar la plusvalía a pesos. */
  uva: { fecha: string; valor: number } | null;
  /** Lo que Ciudad 3D calculó de plusvalía para la superficie construible estimada, como chequeo de la fórmula propia. */
  plusvaliaCiudad: { areaEdificar: number; uva: number } | null;
  barrio: string | null;
  comuna: string | null;
  parcela: ParcelaCatastro | null;
  edificabilidad: Edificabilidad | null;
  /** El número de Área de Mixtura de Usos (1 a 4), o null si la Ciudad no lo dio. */
  mixtura: number | null;
  afectaciones: Record<string, number> | null;
  catalogado: boolean | null;
  monumentoHistorico: boolean | null;
  microcentro: boolean | null;
  avisos: string[];
};

/**
 * Por dirección escrita a mano. Falla sólo si USIG no la reconoce en CABA o
 * si no es calle y altura (una esquina no identifica una parcela). Todo lo
 * demás que no se pudo traer queda en `avisos`.
 */
export async function consultarPorDireccion(texto: string): Promise<ConsultaCiudad> {
  const avisos: string[] = [];
  const candidatas = await normalizarDireccion(texto);

  if (candidatas === null) {
    throw new Error(
      "USIG no contestó. Suele pasar: probá de nuevo en un momento."
    );
  }
  if (candidatas.length === 0) {
    throw new Error(
      "USIG no reconoce esa dirección en la Ciudad de Buenos Aires. Probá con calle y altura, sin piso ni departamento."
    );
  }

  const d = candidatas[0];
  if (candidatas.length > 1) {
    avisos.push(
      `USIG encontró ${candidatas.length} direcciones posibles y se tomó "${d.direccion}". Si no es esa, corregí la dirección y volvé a consultar.`
    );
  }
  if (d.tipo !== "calle_altura" || !d.altura) {
    throw new Error(
      "Hace falta calle y altura: una esquina o un lugar no identifican una parcela."
    );
  }

  let coordenadas = await centroideDePuerta(d.cod_calle, d.altura);
  let busqueda: BusquedaParcela = coordenadas ? await parcelaEnPunto(coordenadas) : null;

  if (busqueda === null) {
    // Sin centroide (la altura no es puerta oficial, o USIG no contestó), o
    // con el centroide fuera de toda parcela, se prueba con el punto de la
    // puerta: a veces cae adentro.
    const puerta = { lng: Number(d.coordenadas.x), lat: Number(d.coordenadas.y) };
    busqueda = await parcelaEnPunto(puerta);
    coordenadas ??= puerta;
  }

  const parcela = busqueda === "mudo" ? null : busqueda;
  if (!parcela) {
    avisos.push(
      busqueda === "mudo"
        ? "Ciudad 3D no contestó la consulta de la parcela. Actualizá desde la Ciudad en un rato."
        : "No se encontró la parcela: la altura no es una puerta oficial o USIG no ubicó el centroide. Cargá la nomenclatura catastral (sección-manzana-parcela) desde Editar y actualizá desde la Ciudad."
    );
  }

  return completar(
    {
      direccionNormalizada: d.direccion,
      codCalle: d.cod_calle,
      altura: d.altura,
      coordenadas,
      puerta: { lng: Number(d.coordenadas.x), lat: Number(d.coordenadas.y) },
    },
    parcela,
    avisos
  );
}

/** Por nomenclatura catastral, cuando ya se sabe cuál es la parcela. */
export async function consultarPorSmp(
  smp: string,
  base: Pick<ConsultaCiudad, "direccionNormalizada" | "codCalle" | "altura"> = {
    direccionNormalizada: null,
    codCalle: null,
    altura: null,
  }
): Promise<ConsultaCiudad> {
  const busqueda = await parcelaPorSmp(smp);
  if (busqueda === "mudo") {
    throw new Error("Ciudad 3D no contestó. Suele pasar: probá de nuevo en un momento.");
  }
  if (!busqueda) {
    throw new Error(
      `La Ciudad no tiene una parcela ${smp}. El formato es sección-manzana-parcela, como 061-056-019.`
    );
  }
  const parcela = busqueda;
  // La puerta dice de qué lado está la calle, y el volumen 3D la necesita
  // para saber cuál es el frente. Por SMP no hay dirección escrita, pero la
  // parcela trae sus puertas oficiales: se geocodifica la principal.
  const principal =
    parcela.puertas?.find((p) => p.puerta_oficial) ?? parcela.puertas?.[0] ?? null;
  const puerta =
    principal && principal.codigo_calle && principal.altura
      ? await geocodificar(principal.codigo_calle, principal.altura, "puertas")
      : null;

  return completar(
    {
      ...base,
      coordenadas: { lng: parcela.centroide[0], lat: parcela.centroide[1] },
      puerta,
    },
    parcela,
    []
  );
}

async function completar(
  base: Pick<
    ConsultaCiudad,
    "direccionNormalizada" | "codCalle" | "altura" | "coordenadas" | "puerta"
  >,
  parcela: ParcelaCatastro | null,
  avisos: string[]
): Promise<ConsultaCiudad> {
  const punto = parcela
    ? { lng: parcela.centroide[0], lat: parcela.centroide[1] }
    : base.coordenadas;
  const smp = parcela?.smp ?? null;

  // Lo esencial con paciencia; lo secundario con un solo intento, porque
  // Ciudad 3D bajo carga tarda varios segundos o corta, y esperar cuatro
  // reintentos por cada dato menor dejaba el alta en más de un minuto. Lo que
  // falte se recupera con "Actualizar desde la Ciudad".
  const [utiles, edificabilidad] = await Promise.all([
    punto ? datosUtiles(punto) : null,
    smp ? epok<Edificabilidad>(`cur3d/seccion_edificabilidad/?smp=${smp}`, ESENCIAL) : null,
  ]);
  // La plusvalía se le pide a la Ciudad para la superficie construible que
  // sale de sus propios datos, como chequeo de la fórmula de
  // `lib/prefactibilidad.ts`; con alícuota 0 no hace falta preguntar.
  const alturaBase = edificabilidad?.altura_max.find((a) => a > 0) ?? null;
  const plantas = plantasSobrePbEstimadas(alturaBase);
  const areaEstimada =
    edificabilidad && edificabilidad.sup_edificable_planta > 0 && plantas !== null
      ? Math.round(edificabilidad.sup_edificable_planta * (plantas + 1) * 100) / 100
      : null;
  const pedirPlusvalia =
    smp !== null && areaEstimada !== null && (edificabilidad?.plusvalia.alicuota ?? 0) > 0;

  const [mixtura, ficha, monumento, microcentro, geometria, plusvalia, uva] = await Promise.all([
    smp ? epok<{ usos: number[] | null }>(`cur3d/mixtura_usos/?smp=${smp}`, SECUNDARIO) : null,
    smp ? epok<{ exists: boolean }>(`cur3d/fichadecatalogacion/?smp=${smp}`, SECUNDARIO) : null,
    smp
      ? epok<{ data: unknown[] }>(`cur3d/monumento_historico_nacional/?smp=${smp}`, SECUNDARIO)
      : null,
    smp ? epok<{ in: boolean }>(`cur3d/parcela_en_microcentro/?smp=${smp}`, SECUNDARIO) : null,
    smp ? epok<unknown>(`catastro/geometria/?smp=${smp}`, SECUNDARIO) : null,
    pedirPlusvalia
      ? epok<{ plusvalia_em: number }>(
          `cur3d/calcular_plusvalia/?smp=${smp}&area_edificar=${areaEstimada}`,
          SECUNDARIO
        )
      : null,
    valorUva(),
  ]);
  // Las afectaciones vienen adentro de la edificabilidad; el endpoint aparte
  // repite lo mismo.
  const afectaciones = edificabilidad?.afectaciones ?? null;

  if (smp && !edificabilidad) {
    avisos.push(
      "Ciudad 3D no devolvió la edificabilidad de la parcela. Se puede volver a consultar más tarde."
    );
  }
  if (punto && !utiles) {
    avisos.push("USIG no devolvió barrio y comuna.");
  }

  return {
    consultadoEn: new Date().toISOString(),
    ...base,
    coordenadas: punto,
    barrio: utiles?.barrio || null,
    comuna: utiles?.comuna || null,
    parcela,
    geometria: geometria && typeof geometria === "object" && "type" in geometria ? geometria : null,
    uva,
    plusvaliaCiudad:
      plusvalia && areaEstimada !== null && typeof plusvalia.plusvalia_em === "number"
        ? { areaEdificar: areaEstimada, uva: plusvalia.plusvalia_em }
        : null,
    edificabilidad: edificabilidad && "altura_max" in edificabilidad ? edificabilidad : null,
    mixtura: mixtura?.usos?.find((u) => u > 0) ?? null,
    afectaciones,
    catalogado: ficha ? Boolean(ficha.exists) : null,
    monumentoHistorico: monumento ? monumento.data.length > 0 : null,
    microcentro: microcentro ? Boolean(microcentro.in) : null,
    avisos,
  };
}

// ------------------- Volver a consultar sin perder lo que había ------------

/**
 * Al volver a consultar, lo que la Ciudad no contestó esta vez no borra lo
 * que contestó la vez anterior: un "Actualizar" con Ciudad 3D caído dejaba
 * el estudio sin normativa. Se conserva pieza por pieza, y el aviso dice de
 * cuándo es lo que quedó. Lo que sí contestó pisa lo viejo, que es el
 * sentido de actualizar.
 */
export function fusionarConsultas(
  vieja: ConsultaCiudad | null,
  nueva: ConsultaCiudad
): ConsultaCiudad {
  if (!vieja) return nueva;

  const conservado: string[] = [];
  const elegir = <T>(n: T | null | undefined, v: T | null | undefined, nombre: string): T | null => {
    if (n !== null && n !== undefined) return n;
    if (v !== null && v !== undefined) {
      conservado.push(nombre);
      return v;
    }
    return null;
  };

  const fusion: ConsultaCiudad = {
    ...nueva,
    coordenadas: nueva.coordenadas ?? vieja.coordenadas ?? null,
    puerta: nueva.puerta ?? vieja.puerta ?? null,
    barrio: nueva.barrio ?? vieja.barrio ?? null,
    comuna: nueva.comuna ?? vieja.comuna ?? null,
    parcela: elegir(nueva.parcela, vieja.parcela, "la parcela"),
    edificabilidad: elegir(nueva.edificabilidad, vieja.edificabilidad, "la edificabilidad"),
    geometria: elegir(nueva.geometria, vieja.geometria, "el polígono"),
    mixtura: elegir(nueva.mixtura, vieja.mixtura, "la mixtura de usos"),
    afectaciones: nueva.afectaciones ?? vieja.afectaciones ?? null,
    catalogado: elegir(nueva.catalogado, vieja.catalogado, "la catalogación"),
    monumentoHistorico: elegir(nueva.monumentoHistorico, vieja.monumentoHistorico, "los monumentos"),
    microcentro: elegir(nueva.microcentro, vieja.microcentro, "el microcentro"),
    uva: elegir(nueva.uva, vieja.uva, "la UVA"),
    plusvaliaCiudad: elegir(nueva.plusvaliaCiudad, vieja.plusvaliaCiudad, "el chequeo de plusvalía"),
  };

  let avisos = nueva.avisos;
  if (conservado.length > 0) {
    // El aviso genérico de "no devolvió" se reemplaza por uno que dice qué
    // quedó y de cuándo.
    avisos = avisos.filter((a) => !a.startsWith("Ciudad 3D no devolvió") && !a.startsWith("Ciudad 3D no contestó"));
    const [y, m, d] = vieja.consultadoEn.slice(0, 10).split("-");
    avisos = [
      ...avisos,
      `La Ciudad no contestó ${enumerar(conservado)}: quedó lo de la consulta del ${d}/${m}/${y}. Se puede volver a actualizar más tarde.`,
    ];
  }

  return { ...fusion, avisos };
}

function enumerar(partes: string[]) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

// ------------------- De la consulta a las columnas del estudio -------------

/** Las columnas de `prefactibilidades` que nacen de la consulta. */
export type ValoresCiudad = {
  direccion_normalizada: string | null;
  cod_calle: number | null;
  lng: number | null;
  lat: number | null;
  barrio: string | null;
  comuna: string | null;
  smp: string | null;
  ancho_m: number | null;
  profundidad_m: number | null;
  superficie_m2: number | null;
  construcciones_existentes: string | null;
  unidad_edificabilidad: string | null;
  altura_maxima_m: number | null;
  plano_limite_m: number | null;
  plantas_sobre_pb: number | null;
  sup_edificable_planta_m2: number | null;
  fot: number | null;
  mixtura_usos: string | null;
  aph: boolean;
  aph_detalle: string | null;
  catalogado: boolean;
  afectaciones: string | null;
  plusvalia: string | null;
};

const ETIQUETAS_AFECTACION: Record<string, string> = {
  riesgo_hidrico: "Riesgo hídrico",
  lep: "Línea de edificación particularizada (LEP)",
  ensanche: "Ensanche de calle",
  apertura: "Apertura de calle",
  ci_digital: "Cinturón digital (corredores radioeléctricos)",
};

/**
 * Lo que dijo la Ciudad, en las columnas del estudio. Se usa al crear y al
 * volver a consultar, y la ficha lo recalcula sobre `ciudad` para decir, al
 * lado de cada dato corregido a mano, qué valor traía.
 */
export function valoresDesdeCiudad(c: ConsultaCiudad): ValoresCiudad {
  const p = c.parcela;
  const e = c.edificabilidad;

  // Las alturas vienen por franja y las que no aplican son 0; la primera
  // franja es la de la unidad de edificabilidad.
  const alturaBase = e?.altura_max.find((a) => a > 0) ?? null;
  const planoLimite = e && e.altura_max_plano_limite > 0 ? e.altura_max_plano_limite : null;

  const distritos = unicos(
    (e?.distrito_especial ?? [])
      .map((d) => [d.distrito_agrupado, d.distrito_especifico].filter(Boolean).join(" ").trim())
      .filter(Boolean)
  );

  // "DESESTIMADO" es una catalogación que se pidió y se rechazó: el inmueble
  // no está protegido, pero conviene saber que pasó por el CAAP.
  const cat = e?.catalogacion;
  const catalogacionVigente = Boolean(cat?.catalogacion) ||
    (Boolean(cat?.proteccion) && cat?.proteccion !== "DESESTIMADO");

  const afectaciones = [
    ...Object.entries(c.afectaciones ?? e?.afectaciones ?? {})
      .filter(([, valor]) => valor !== 0)
      .map(([clave]) => ETIQUETAS_AFECTACION[clave] ?? clave),
    ...(c.monumentoHistorico ? ["Monumento histórico nacional"] : []),
    ...(c.microcentro ? ["Área Microcentro"] : []),
    ...(e?.irregular ? ["Parcela irregular"] : []),
    ...(e && e.tipica && e.tipica !== "T" ? ["Manzana atípica"] : []),
    // Ley 3056: edificio anterior a 1941, la demolición pasa antes por el
    // Consejo Asesor de Asuntos Patrimoniales.
    ...(cat?.ley_3056 === "SI"
      ? ["Alcanzada por la Ley 3056: edificio anterior a 1941, demoler requiere el aval del CAAP"]
      : []),
    ...(cat?.proteccion === "DESESTIMADO"
      ? [`Catalogación desestimada${cat.estado ? ` (${cat.estado})` : ""}`]
      : []),
  ];

  return {
    direccion_normalizada: c.direccionNormalizada,
    cod_calle: c.codCalle,
    lng: c.coordenadas?.lng ?? null,
    lat: c.coordenadas?.lat ?? null,
    barrio: c.barrio,
    comuna: c.comuna,
    smp: p?.smp ?? null,
    ancho_m: numero(p?.frente),
    profundidad_m: numero(p?.fondo),
    superficie_m2: numero(p?.superficie_total),
    construcciones_existentes: p ? describirConstruccion(p) : null,
    unidad_edificabilidad:
      nombreUnidadEdificabilidad(alturaBase) ??
      (alturaBase ? `Altura ${alturaBase} m (sin unidad conocida)` : null),
    altura_maxima_m: alturaBase,
    plano_limite_m: planoLimite,
    plantas_sobre_pb: plantasSobrePbEstimadas(alturaBase),
    sup_edificable_planta_m2:
      e && e.sup_edificable_planta > 0 ? redondear(e.sup_edificable_planta) : null,
    fot: e && e.fot.fot_medianera > 0 ? e.fot.fot_medianera : null,
    mixtura_usos: c.mixtura ? `Mixtura ${c.mixtura}` : null,
    aph: distritos.some((d) => /APH/i.test(d)),
    aph_detalle: distritos.length > 0 ? distritos.join(", ") : null,
    catalogado: c.catalogado === true || catalogacionVigente,
    afectaciones: afectaciones.length > 0 ? afectaciones.join("; ") : null,
    plusvalia: e ? describirPlusvalia(e) : null,
  };
}

/** Lo que hay construido según AGIP, en una línea: "359 m² cubiertos · 1 piso sobre rasante · 2 UF · PH". */
function describirConstruccion(p: ParcelaCatastro): string | null {
  const cubierta = numero(p.superficie_cubierta);
  if (!cubierta) return null;

  const pisos = numero(p.pisos_sobre_rasante);
  const uf = numero(p.unidades_funcionales);
  const locales = numero(p.locales);
  const partes = [
    `${formatear(cubierta)} m² cubiertos`,
    pisos ? `${pisos} ${pisos === 1 ? "piso" : "pisos"} sobre rasante` : null,
    uf ? `${uf} ${uf === 1 ? "unidad funcional" : "unidades funcionales"}` : null,
    locales ? `${locales} ${locales === 1 ? "local" : "locales"}` : null,
    p.propiedad_horizontal === "Si" ? "propiedad horizontal" : null,
  ].filter(Boolean);

  return `${partes.join(" · ")} (según ${p.fuente})`;
}

function describirPlusvalia(e: Edificabilidad): string {
  const { alicuota, incidencia_uva, distrito_cpu } = e.plusvalia;
  const distrito = distrito_cpu ? ` · distrito ${distrito_cpu} del CPU` : "";
  if (!alicuota) return `No aplica según Ciudad 3D${distrito}`;
  return `Alícuota ${formatear(alicuota * 100)} % · incidencia ${formatear(incidencia_uva)} UVA/m²${distrito}`;
}

/** Los números de catastro vienen como texto y "0.00" quiere decir "no se sabe". */
function numero(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined || texto === "") return null;
  const n = Number(texto);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatear(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

function unicos(lista: string[]) {
  return Array.from(new Set(lista));
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

// ----------------------------- USIG ---------------------------------------

/** Las direcciones de CABA que USIG entiende, o null si USIG no contestó (no es lo mismo que ninguna). */
async function normalizarDireccion(texto: string): Promise<DireccionUsig[] | null> {
  const r = json<{ direccionesNormalizadas?: DireccionUsig[] }>(
    await pedir(
      `${USIG_SERVICIOS}/normalizar/?direccion=${encodeURIComponent(texto)}&geocodificar=true`
    )
  );
  if (!r) return null;
  // El normalizador contesta también por el conurbano; acá sólo sirve CABA.
  return (r.direccionesNormalizadas ?? []).filter((d) => d.cod_partido === "caba");
}

/** El centroide de la parcela de una puerta oficial. */
function centroideDePuerta(codCalle: number, altura: number) {
  return geocodificar(codCalle, altura, "centroide");
}

/**
 * Calle y altura a un punto: el centroide de la parcela (`centroide`, sólo
 * para puertas oficiales) o la puerta misma (`puertas`). El geocodificador
 * lo da en Gauss-Krüger Buenos Aires; USIG mismo lo pasa a lon/lat.
 */
async function geocodificar(codCalle: number, altura: number, metodo: "centroide" | "puertas") {
  const gk = json<{ x: string | number; y: string | number }>(
    await pedir(
      `${USIG_WS}/geocoder/2.2/geocoding?cod_calle=${codCalle}&altura=${altura}&metodo=${metodo}`
    )
  );
  if (!gk?.x || !gk?.y) return null;

  const ll = json<Record<string, unknown>>(
    await pedir(`${USIG_WS}/rest/convertir_coordenadas?x=${gk.x}&y=${gk.y}&output=lonlat`)
  );
  return extraerLonLat(ll);
}

/** Acepta `{x, y}` o `{resultado: {x, y}}`: la documentación no dice cuál. */
function extraerLonLat(obj: Record<string, unknown> | null) {
  if (!obj) return null;
  const fuente =
    "x" in obj ? obj : ((obj.resultado as Record<string, unknown> | undefined) ?? null);
  if (!fuente) return null;
  const lng = Number(fuente.x);
  const lat = Number(fuente.y);
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180
    ? { lng, lat }
    : null;
}

async function datosUtiles(p: { lng: number; lat: number }) {
  return json<{ barrio?: string; comuna?: string; seccion_catastral?: string }>(
    await pedir(`${USIG_WS}/datos_utiles?x=${p.lng}&y=${p.lat}`)
  );
}

// ------------------------------ UVA ---------------------------------------

/**
 * El valor de la UVA de hoy (o el último publicado hasta hoy): la plusvalía
 * se liquida en UVA y hay que decir cuántos pesos son. La serie es la del
 * BCRA republicada por ArgentinaDatos, que no pide clave; la API propia del
 * BCRA cambia de versión y corta las viejas.
 */
async function valorUva(): Promise<{ fecha: string; valor: number } | null> {
  const serie = json<{ fecha: string; valor: number }[]>(
    await pedir("https://api.argentinadatos.com/v1/finanzas/indices/uva", {
      intentos: 2,
      timeoutMs: 8000,
      escalonadoMs: 4000,
    })
  );
  if (!Array.isArray(serie) || serie.length === 0) return null;

  // Viene ordenada por fecha y publica también los días que vienen.
  const hoy = new Date().toISOString().slice(0, 10);
  const hastaHoy = serie.filter((d) => d.fecha <= hoy && Number.isFinite(d.valor));
  const ultimo = hastaHoy[hastaHoy.length - 1] ?? serie[serie.length - 1];
  return ultimo ? { fecha: ultimo.fecha, valor: ultimo.valor } : null;
}

// --------------------------- Ciudad 3D (epok) -----------------------------

/**
 * Tres respuestas distintas, que piden tres reacciones distintas: la
 * parcela; `null` cuando la Ciudad contestó que ahí no hay ninguna (`{}`
 * con 200, no un error); y "mudo" cuando no contestó, que no dice nada
 * sobre la parcela y sólo pide reintentar.
 */
type BusquedaParcela = ParcelaCatastro | null | "mudo";

async function parcelaEnPunto(p: { lng: number; lat: number }): Promise<BusquedaParcela> {
  return buscarParcela(`catastro/parcela/?lng=${p.lng}&lat=${p.lat}`);
}

async function parcelaPorSmp(smp: string): Promise<BusquedaParcela> {
  return buscarParcela(`catastro/parcela/?smp=${encodeURIComponent(smp.trim())}`);
}

async function buscarParcela(ruta: string): Promise<BusquedaParcela> {
  const r = await epok<ParcelaCatastro | Record<string, never>>(ruta);
  if (r === null) return "mudo";
  return "smp" in r ? (r as ParcelaCatastro) : null;
}

type Opciones = { intentos?: number; timeoutMs?: number; escalonadoMs?: number };

/** Para la parcela y la edificabilidad: sin ellas no hay estudio. */
const ESENCIAL: Opciones = { intentos: 3, timeoutMs: 12000, escalonadoMs: 6000 };
/** Para lo demás: si no contesta, queda para la próxima. */
const SECUNDARIO: Opciones = { intentos: 1, timeoutMs: 8000 };

async function epok<T>(ruta: string, opciones: Opciones = ESENCIAL): Promise<T | null> {
  return json<T>(await pedir(`${EPOK}/${ruta}`, opciones));
}

// ------------------------------ Red ---------------------------------------

/**
 * Un GET con timeout y reintentos. Devuelve el cuerpo como texto, o null si
 * ningún intento contestó bien: acá nada es fatal, el que llama decide.
 *
 * Sin cabeceras propias a propósito: con un User-Agent o un Accept que no
 * sean los de Node, la API de Ciudad 3D corta la conexión (ECONNRESET). Los
 * valores por defecto son para USIG, que cuando no contesta no contesta
 * nunca: mejor cortar a los 4 segundos y volver a pedir.
 */
function pedir(
  url: string,
  { intentos = 5, timeoutMs = 5000, escalonadoMs = 1500 }: Opciones = {}
): Promise<string | null> {
  // Pedidos escalonados: si el primero no contestó a los 1,5 s sale otro en
  // paralelo, y gana el primero que conteste. USIG pierde entre un cuarto y
  // un tercio de las conexiones al azar, y cuando una se pierde no vuelve:
  // esperar el timeout entero para recién reintentar sumaba segundos por
  // cada llamada de la cadena.
  return new Promise((resolve) => {
    let lanzados = 0;
    let enVuelo = 0;
    let listo = false;
    let reloj: ReturnType<typeof setInterval> | null = null;

    const terminar = (valor: string | null) => {
      if (listo) return;
      listo = true;
      if (reloj) clearInterval(reloj);
      resolve(valor);
    };

    const lanzar = () => {
      if (listo || lanzados >= intentos) return;
      lanzados++;
      enVuelo++;
      intentar(url, timeoutMs).then((texto) => {
        enVuelo--;
        if (texto !== null) terminar(texto);
        else if (lanzados < intentos) lanzar();
        else if (enVuelo === 0) terminar(null);
      });
    };

    lanzar();
    reloj = setInterval(() => {
      if (listo || lanzados >= intentos) {
        if (reloj) clearInterval(reloj);
        return;
      }
      lanzar();
    }, escalonadoMs);
  });
}

/** Un solo GET: el cuerpo si contestó bien y con algo, null si no. */
async function intentar(url: string, timeoutMs: number): Promise<string | null> {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: control.signal, cache: "no-store" });
    if (!r.ok) return null;
    const texto = await r.text();
    return texto.trim() === "" ? null : texto;
  } catch {
    // Timeout o conexión perdida.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** USIG envuelve algunas respuestas entre paréntesis, al estilo JSONP. */
function json<T>(texto: string | null): T | null {
  if (!texto) return null;
  const limpio = texto.trim().replace(/^\(/, "").replace(/\)\s*;?$/, "");
  try {
    return JSON.parse(limpio) as T;
  } catch {
    return null;
  }
}
