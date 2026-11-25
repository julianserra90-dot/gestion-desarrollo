/**
 * El avance que se marca en el 3D, hecho cargas de la solapa de Avances.
 *
 * En el 3D se marca **cosa por cosa**: este muro, esta columna, en este piso,
 * de esta tarea. El avance de obra, en cambio, se lleva **por rubro y por
 * período**: "+12 % en Albañilería el 23/11". Acá se pasa de lo uno a lo otro.
 *
 *   una cosa    pesa lo que mide sobre lo que el cómputo tiene de su tarea:
 *               un muro de 15 m² en una tarea de 300 m² es el 5 % de la tarea.
 *   una tarea   pesa lo que cuesta dentro de su rubro (cantidad × precio, como
 *               en el avance general); si el rubro no tiene precios, todas sus
 *               tareas pesan igual.
 *
 * Las cargas son **una por día**, con lo que avanzó ese día. El porcentaje de
 * una carga es entero, y una columna suele ser menos del 1 % de su rubro: por
 * eso se redondea el **acumulado** y cada día lleva la diferencia. Así no se
 * pierde nada por el camino: diez columnas del 0,4 % hacen un 4 %, aunque
 * ninguna sola llegue a 1.
 *
 * Sin React y sin base.
 */

/**
 * Una cosa marcada como hecha, de una tarea, con lo que mide y su día. O una
 * carga a mano de la tarea (`aMano`): cuánto se hizo, sin decir dónde.
 *
 * **Se suman**, piso por piso (`hechoDeTarea`): 10 % marcado en el 3D y 10 %
 * cargado a mano son 20 %. Lo de a mano es lo que se hizo y no se marcó cosa
 * por cosa —en el 3D se pinta en verde claro sobre lo pendiente—. Lo cargado
 * a mano sin piso va aparte, como su propio piso. Lo de la tarea, con tope en
 * su cantidad. (Hubo un tiempo en que valía el mayor de los dos: el usuario
 * lo encontró confuso.) Lo cargado a mano es "por lo menos
 * esto"; marcar en el 3D dice dónde, y al alcanzarlo lo absorbe. Sumadas, los
 * 10 m² cargados a mano se volvían a contar cuando después se tildaban esos
 * mismos cielorrasos. Una tarea que el plano no mide sólo tiene lo de a mano.
 */
export type MarcaDelPlano = {
  tareaId: string;
  cantidad: number;
  fecha: string;
  aMano?: boolean;
  /** En qué piso. Lo del 3D siempre tiene; lo de a mano puede no tener. */
  piso?: number | null;
  /** El día en que se empezó; null, en el día. */
  inicio?: string | null;
};

/** Una tarea del rubro en el cómputo: cuánto tiene y cuánto cuesta. */
export type TareaDelRubro = { tareaId: string; cantidad: number; costo: number };

/** Una carga de Avances que sale del plano: cuántas cosas del 3D y cuántas
 *  cargas a mano la hicieron. */
export type CargaDelPlano = {
  /** Desde el primer día que empezó algo de lo que la hizo, hasta `fecha`. */
  desde: string;
  fecha: string;
  porcentaje: number;
  cosas: number;
  aMano: number;
};

/**
 * Las cargas del plano de un rubro, del primer día al último. Los días que no
 * mueven el entero no llevan carga: lo que avanzaron se suma al siguiente.
 */
export function cargasDelPlano(marcas: MarcaDelPlano[], tareas: TareaDelRubro[]): CargaDelPlano[] {
  const conCantidad = tareas.filter((t) => t.cantidad > 0);
  if (conCantidad.length === 0) return [];
  const costoTotal = conCantidad.reduce((s, t) => s + Math.max(0, t.costo), 0);
  const peso = new Map(
    conCantidad.map((t) => [
      t.tareaId,
      costoTotal > 0 ? Math.max(0, t.costo) / costoTotal : 1 / conCantidad.length,
    ])
  );
  const cantidad = new Map(conCantidad.map((t) => [t.tareaId, t.cantidad]));

  const delRubro = marcas.filter((m) => peso.has(m.tareaId));
  const dias = Array.from(new Set(delRubro.map((m) => m.fecha))).sort();

  // Por tarea y piso: "tarea|piso". Sin piso, "tarea|".
  const enEl3d = new Map<string, number>();
  const aManoPorTarea = new Map<string, number>();
  const claveDe = (m: MarcaDelPlano) => `${m.tareaId}|${m.piso ?? ""}`;
  const cargas: CargaDelPlano[] = [];
  let anterior = 0;
  let cosas = 0;
  let aMano = 0;
  let desde: string | null = null;
  for (const dia of dias) {
    for (const m of delRubro) {
      if (m.fecha !== dia) continue;
      const dondeVa = m.aMano ? aManoPorTarea : enEl3d;
      dondeVa.set(claveDe(m), (dondeVa.get(claveDe(m)) ?? 0) + m.cantidad);
      if (m.aMano) aMano += 1;
      else cosas += 1;
      const empezo = m.inicio ?? m.fecha;
      if (desde === null || empezo < desde) desde = empezo;
    }
    let acumulado = 0;
    for (const [tareaId, p] of peso) {
      const claves = new Set(
        [...enEl3d.keys(), ...aManoPorTarea.keys()].filter((k) => k.startsWith(`${tareaId}|`))
      );
      let hecho = 0;
      for (const k of claves) hecho += hechoDeTarea(enEl3d.get(k) ?? 0, aManoPorTarea.get(k) ?? 0);
      acumulado += p * Math.min(1, hecho / cantidad.get(tareaId)!);
    }
    const redondo = Math.min(100, Math.round(acumulado * 100));
    if (redondo > anterior) {
      cargas.push({ desde: desde ?? dia, fecha: dia, porcentaje: redondo - anterior, cosas, aMano });
      anterior = redondo;
      cosas = 0;
      aMano = 0;
      desde = null;
    }
  }
  return cargas;
}

/**
 * Lo hecho de una tarea en un piso: lo marcado en el 3D más lo cargado a mano,
 * con tope en lo que el piso tiene, si se sabe.
 */
export function hechoDeTarea(enEl3d: number, aMano: number, tope = Infinity): number {
  return Math.min(tope, enEl3d + aMano);
}

/** Una tarea que se cotiza por unidad: "un", "u", "c/u". */
export const esPorUnidad = (unidad: string) =>
  /^(un|u|u\.|ud|unid|unidad|unidades|c\/u|n[°º]|nro)$/i.test(unidad.trim());

/** Una que se cotiza por metro lineal. */
export const esPorMetro = (unidad: string) => /^(ml|m)$/i.test(unidad.trim());

/**
 * Qué mide una unidad: superficie, volumen, largo o cantidad de cosas. Dos
 * tareas en "m²" y "m2" miden lo mismo; null es una que el plano no mide (gl).
 */
export function queMide(unidad: string | null): "superficie" | "volumen" | "largo" | "unidades" | null {
  if (unidad === null) return null;
  const u = unidad.trim().toLowerCase();
  if (u === "m²" || u === "m2") return "superficie";
  if (u === "m³" || u === "m3") return "volumen";
  if (esPorMetro(u)) return "largo";
  if (esPorUnidad(u)) return "unidades";
  return null;
}

/**
 * Lo que mide una cosa en la unidad con que se cotiza su tarea: el volumen si
 * es en m³, la superficie si es en m², el largo si es en metros y cuántas son
 * si es por unidad —una ventana es una—. Null si es una unidad que el plano no
 * mide (gl).
 */
export function cantidadEnUnidad(
  medida: { superficie: number; volumen: number; largo?: number; unidades?: number },
  unidad: string
): number | null {
  const u = unidad.trim().toLowerCase();
  if (u === "m³" || u === "m3") return medida.volumen;
  if (u === "m²" || u === "m2") return medida.superficie;
  if (esPorMetro(u)) return medida.largo ?? null;
  if (esPorUnidad(u)) return medida.unidades ?? null;
  return null;
}
