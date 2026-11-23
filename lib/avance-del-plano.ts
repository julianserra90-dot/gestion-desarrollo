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

/** Una cosa marcada como hecha, de una tarea, con lo que mide y su día. */
export type MarcaDelPlano = { tareaId: string; cantidad: number; fecha: string };

/** Una tarea del rubro en el cómputo: cuánto tiene y cuánto cuesta. */
export type TareaDelRubro = { tareaId: string; cantidad: number; costo: number };

/** Una carga de Avances que sale del plano. */
export type CargaDelPlano = { fecha: string; porcentaje: number; cosas: number };

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

  const hecho = new Map<string, number>();
  const cargas: CargaDelPlano[] = [];
  let anterior = 0;
  let cosas = 0;
  for (const dia of dias) {
    for (const m of delRubro) {
      if (m.fecha !== dia) continue;
      hecho.set(m.tareaId, (hecho.get(m.tareaId) ?? 0) + m.cantidad);
      cosas += 1;
    }
    let acumulado = 0;
    for (const [tareaId, p] of peso) {
      acumulado += p * Math.min(1, (hecho.get(tareaId) ?? 0) / cantidad.get(tareaId)!);
    }
    const redondo = Math.min(100, Math.round(acumulado * 100));
    if (redondo > anterior) {
      cargas.push({ fecha: dia, porcentaje: redondo - anterior, cosas });
      anterior = redondo;
      cosas = 0;
    }
  }
  return cargas;
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
