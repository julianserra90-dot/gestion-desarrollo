/**
 * El cómputo de una obra y su comparación contra lo cotizado y lo gastado.
 *
 * SÓLO SERVIDOR.
 *
 * Tres números por rubro: lo **estimado** (cantidad × precio de referencia),
 * lo **cotizado** (presupuestos aprobados) y lo **gastado**. Los tres se
 * llevan a valores del último CAC cargado antes de compararse: si no, un
 * estimado de marzo contra una cotización de septiembre mide la inflación y
 * no el precio.
 */

import { factorCac, mesDeFecha, type IndiceCac } from "@/lib/cac";
import { cantidadDesdeConsumo, envaseDelRenglon } from "@/lib/consumo";
import { createClient } from "@/lib/supabase/server";

/**
 * El orden de la revista: el de la obra, de la excavación a la limpieza final.
 * Por nombre alfabético el cómputo arranca en "Aislaciones" y la planilla se
 * lee salteada.
 */
const ORDEN_DE_OBRA = [
  "tareas preliminares",
  "demoliciones",
  "movimiento de tierra",
  "excavaciones",
  "fundaciones",
  "estructuras",
  "estructura de hormigón armado",
  "mamposterías y tabiquerías",
  "albañilería",
  "construcción en seco",
  "aislaciones",
  "impermeabilizaciones",
  "cubiertas y techos",
  "zinguería",
  "revoques",
  "yesería",
  "contrapisos",
  "cielorrasos",
  "revestimientos",
  "pisos",
  "zócalos",
  "carpinterías",
  "aberturas ventanas",
  "aberturas puertas",
  "herrería",
  "vidrios y espejos",
  "pintura",
  "instalación eléctrica",
  "instalación sanitaria",
  "instalación de gas",
  "instalación contra incendio",
  "equipamiento",
  "varios",
];

/** Para ordenar rubros como en la obra; lo que no está en la lista va al final. */
export function ordenDeRubro(nombre: string) {
  const i = ORDEN_DE_OBRA.indexOf(nombre.toLowerCase());
  return i < 0 ? ORDEN_DE_OBRA.length : i;
}

export type ItemComputo = {
  id: string;
  rubroId: string;
  tareaId: string | null;
  subrubro: string | null;
  nombre: string;
  unidad: string;
  cantidad: number;
  precioMateriales: number;
  precioManoObra: number;
  precioIntegrado: number;
  tipos: { mat: boolean; mo: boolean; int: boolean };
  /** Su desglose, por unidad de la tarea. De ahí salen los precios. */
  renglones: RenglonItem[];
};

export type RenglonItem = {
  tipo: "Materiales" | "Mano de obra" | "Integrado";
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio: number;
  /** El material del catálogo, cuando el renglón es uno. */
  materialId: string | null;
  /**
   * El consumo tal como se enunció: 18, de 18 kg por m². Null cuando se cargó
   * la cantidad directo. Con él puesto, `cantidad` sale de dividirlo por lo
   * que trae el envase del material.
   */
  consumo: number | null;
  /** La unidad del consumo (kg). Siempre junto con `consumo`. */
  consumoUnidad: string | null;
  presupuestoId: string | null;
  usarCotizado: boolean;
  /** La cotización enlazada, si se pidió. */
  cotizacion: CotizacionRenglon | null;
};

export type CotizacionRenglon = {
  estado: string;
  /** Lo cotizado para la obra entera, no por unidad. */
  monto: number;
  proveedor: string | null;
};

/** Una cotización con precio de verdad: ya no es un pedido ni se descartó. */
export function tienePrecioCotizado(c: CotizacionRenglon | null): c is CotizacionRenglon {
  return Boolean(c && (c.estado === "Pendiente" || c.estado === "Aprobado"));
}

/**
 * Lo que suma un renglón por unidad de la tarea.
 *
 * Si se eligió lo cotizado, la cotización es por la obra entera: se reparte
 * en la cantidad computada. Sin cantidad no hay cómo repartirla y vale lo
 * computado.
 */
export function porUnidadDe(r: RenglonItem, cantidadTarea: number) {
  if (r.usarCotizado && tienePrecioCotizado(r.cotizacion) && cantidadTarea > 0) {
    return r.cotizacion.monto / cantidadTarea;
  }
  return r.cantidad * r.precio;
}

export type Computo = {
  mesPrecios: string;
  items: ItemComputo[];
};

export async function getComputo(obraId: string): Promise<Computo | null> {
  const supabase = await createClient();

  const [{ data: computo }, { data: items }] = await Promise.all([
    supabase
      .from("computos")
      .select("mes_precios")
      .eq("obra_id", obraId)
      .maybeSingle(),
    supabase
      .from("computo_items")
      .select(
        "id, rubro_id, tarea_id, subrubro, nombre, unidad, cantidad, precio_materiales, precio_mano_obra, precio_integrado, usa_materiales, usa_mano_obra, usa_integrado, orden, computo_item_desglose(tipo, descripcion, unidad, cantidad, precio_unitario, consumo, consumo_unidad, orden, presupuesto_id, usar_cotizado, material_id, materiales(unidad, contenido, contenido_unidad), presupuestos(estado, monto, proveedores(nombre)))"
      )
      .eq("obra_id", obraId)
      .order("orden"),
  ]);

  if (!computo) return null;

  return {
    mesPrecios: mesDeFecha(computo.mes_precios),
    items: (items ?? []).map((i) => {
      const cantidad = Number(i.cantidad);
      // El orden se acomoda acá: ordenar un embebido de PostgREST es más
      // frágil que hacerlo con la lista ya traída.
      const renglones: RenglonItem[] = [...(i.computo_item_desglose ?? [])]
        .sort((a, b) => a.orden - b.orden)
        .map((r) => {
          // La cantidad se rehace acá cuando el renglón declaró su consumo:
          // 18 kg por m² sobre una bolsa de 30 kg son 0,6 bolsas. Así, cambiar
          // el envase en el catálogo corrige de una vez todas las tareas que
          // usan ese material, en vez de dejarlas con el cociente viejo. Sin
          // consumo declarado —o con una unidad que el envase no convierte—
          // vale la cantidad guardada, que es la que siempre mandó.
          const consumo = r.consumo === null ? null : Number(r.consumo);
          const envase = envaseDelRenglon(
            r.unidad,
            r.materiales
              ? {
                  unidad: r.materiales.unidad,
                  contenido:
                    r.materiales.contenido === null ? null : Number(r.materiales.contenido),
                  contenidoUnidad: r.materiales.contenido_unidad,
                }
              : null
          );
          const derivada = cantidadDesdeConsumo(consumo, r.consumo_unidad, envase);

          return {
            tipo: r.tipo as RenglonItem["tipo"],
            descripcion: r.descripcion,
            unidad: r.unidad,
            cantidad: derivada ?? Number(r.cantidad),
            precio: Number(r.precio_unitario),
            materialId: r.material_id,
            consumo,
            consumoUnidad: r.consumo_unidad,
            presupuestoId: r.presupuesto_id,
            usarCotizado: r.usar_cotizado,
            cotizacion: r.presupuestos
              ? {
                  estado: r.presupuestos.estado,
                  monto: Number(r.presupuestos.monto),
                  proveedor: r.presupuestos.proveedores?.nombre ?? null,
                }
              : null,
          };
        });

      // Los precios salen del desglose al leer, no de lo guardado en la
      // tarea: una cotización puede cambiar en su solapa sin pasar por acá.
      const suma = (tipo: RenglonItem["tipo"]) =>
        renglones.filter((r) => r.tipo === tipo).reduce((a, r) => a + porUnidadDe(r, cantidad), 0);

      return {
        id: i.id,
        rubroId: i.rubro_id,
        tareaId: i.tarea_id,
        subrubro: i.subrubro,
        nombre: i.nombre,
        unidad: i.unidad,
        cantidad,
        precioMateriales: renglones.length ? suma("Materiales") : Number(i.precio_materiales),
        precioManoObra: renglones.length ? suma("Mano de obra") : Number(i.precio_mano_obra),
        precioIntegrado: renglones.length ? suma("Integrado") : Number(i.precio_integrado),
        tipos: { mat: i.usa_materiales, mo: i.usa_mano_obra, int: i.usa_integrado },
        renglones,
      };
    }),
  };
}

export async function getIndicesCac(): Promise<IndiceCac[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("indices_cac")
    .select("mes, valor")
    .order("mes");

  return (data ?? []).map((i) => ({
    mes: mesDeFecha(i.mes),
    valor: Number(i.valor),
  }));
}

/**
 * La firma de un desglose: sirve para saber si el de una tarea del cómputo
 * sigue siendo la copia del de modelo o si ya se tocó en la obra. Se comparan
 * los números, no sólo cuántos renglones hay, porque cambiar un precio o una
 * cantidad del desglose es justamente el trabajo que no se puede perder sin
 * avisar.
 */
export function firmaDeDesglose(
  renglones: {
    tipo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio: number;
    materialId?: string | null;
    consumo?: number | null;
    consumoUnidad?: string | null;
  }[]
): string {
  // JSON y no un separador propio: no hay que elegir un carácter que no
  // aparezca en una descripción.
  //
  // El material entra en la firma: atar un renglón al catálogo es trabajo de
  // la obra, aunque la descripción haya quedado igual. El consumo también, y
  // en lugar de la cantidad: ver abajo por qué.
  return JSON.stringify(
    renglones.map((r) => [
      r.tipo,
      r.descripcion,
      r.unidad,
      // La cantidad entra sólo cuando no hay consumo declarado. Si lo hay, la
      // cantidad se deriva del envase, y entonces dos lados que la derivan con
      // envases distintos la tendrían distinta sin que nadie haya tocado el
      // desglose. Lo que se compara es lo que se cargó, no lo que se calcula.
      r.consumo == null ? r.cantidad : null,
      r.consumo ?? null,
      r.consumoUnidad ?? null,
      r.precio,
      r.materialId ?? null,
    ])
  );
}

/**
 * Qué tiene cargado cada tarea del cómputo, en palabras, para poder avisarlo
 * antes de sacarla.
 *
 * Sólo entran las tareas que tienen algo que se perdería: la cantidad
 * computada, un desglose que no se recupera volviendo a tildar, o un pedido a
 * cotizar. Una tarea recién tildada no tiene nada de eso —entra con cantidad
 * cero y con lo que le dé su modelo—, así que destildarla es deshacer el clic
 * y no hace falta preguntar.
 *
 * `modelos` es la firma del desglose de modelo de cada tarea del catálogo.
 * **Sin entrada quiere decir que la tarea no tiene modelo**, y entonces su
 * desglose es irrecuperable: volver a tildarla la trae vacía. Ese es hoy el
 * caso de la mayoría del catálogo, porque la migración del 07/10
 * (`computo_sin_precios_de_referencia`) borró los modelos de arranque de
 * Cifras mientras las copias que ya vivían en las obras se quedaron. Así que
 * un desglose igualito al de Cifras sí se avisa, y está bien: no hay de dónde
 * volver a sacarlo. Una tarea propia de la obra tampoco tiene modelo, por el
 * mismo camino.
 */
export function loCargadoPorTarea(
  items: ItemComputo[],
  modelos: Map<string, string>
): Record<string, string> {
  const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
  const cargado: Record<string, string> = {};

  for (const i of items) {
    if (!i.tareaId) continue;

    const partes: string[] = [];

    if (i.cantidad > 0) {
      partes.push(`la cantidad computada (${numero.format(i.cantidad)} ${i.unidad})`);
    }

    const modelo = modelos.get(i.tareaId) ?? "";
    if (i.renglones.length > 0 && firmaDeDesglose(i.renglones) !== modelo) {
      partes.push(
        i.renglones.length === 1
          ? "el desglose (1 renglón)"
          : `el desglose (${i.renglones.length} renglones)`
      );
    }

    const pedidos = i.renglones.filter((r) => r.cotizacion?.estado === "A cotizar").length;
    if (pedidos > 0) {
      partes.push(pedidos === 1 ? "1 pedido a cotizar" : `${pedidos} pedidos a cotizar`);
    }

    if (partes.length === 0) continue;

    const ultima = partes.pop()!;
    cargado[i.tareaId] = partes.length > 0 ? `${partes.join(", ")} y ${ultima}` : ultima;
  }

  return cargado;
}

export type ComparacionRubro = {
  rubroId: string;
  rubro: string;
  estimadoMateriales: number;
  estimadoManoObra: number;
  estimadoIntegrado: number;
  estimado: number;
  cotizado: number;
  gastado: number;
};

export type Comparacion = {
  filas: ComparacionRubro[];
  /** Cuántos montos quedaron en sus pesos por falta de índice para su mes. */
  sinAjustar: number;
};

/**
 * Estimado, cotizado y gastado por rubro, a valores del último CAC cargado
 * (o en pesos corrientes si `ajustar` es falso).
 *
 * Entra todo rubro que tenga algo en cualquiera de las tres columnas: uno con
 * cotización y sin cómputo es justo el que falta computar.
 */
export async function getComparacion(
  obraId: string,
  computo: Computo,
  indices: IndiceCac[],
  ajustar: boolean
): Promise<Comparacion> {
  const supabase = await createClient();

  const [{ data: rubros }, { data: presupuestos }, { data: gastos }] =
    await Promise.all([
      supabase
        .from("rubros")
        .select("id, nombre")
        .eq("obra_id", obraId),
      supabase
        .from("presupuestos")
        .select("rubro_id, monto, fecha")
        .eq("obra_id", obraId)
        .eq("estado", "Aprobado"),
      // Lo mismo que cuenta la vista obra_presupuesto: los tres tipos que se
      // cotizan, sin anulados. Un gasto administrativo no tiene estimado.
      supabase
        .from("gastos")
        .select("rubro_id, monto, fecha")
        .eq("obra_id", obraId)
        .neq("estado", "Anulado")
        .in("tipo_gasto", ["Materiales", "Mano de obra", "Mano de obra y materiales"]),
    ]);

  let sinAjustar = 0;

  const factor = (mes: string) => {
    if (!ajustar || indices.length === 0) return 1;
    const f = factorCac(indices, mes);
    if (!f.ajustado) sinAjustar++;
    return f.factor;
  };

  const porRubro = new Map<string, ComparacionRubro>();
  const nombres = new Map((rubros ?? []).map((r) => [r.id, r.nombre]));

  const fila = (rubroId: string) => {
    let f = porRubro.get(rubroId);
    if (!f) {
      f = {
        rubroId,
        rubro: nombres.get(rubroId) ?? "—",
        estimadoMateriales: 0,
        estimadoManoObra: 0,
        estimadoIntegrado: 0,
        estimado: 0,
        cotizado: 0,
        gastado: 0,
      };
      porRubro.set(rubroId, f);
    }
    return f;
  };

  // El cómputo entero está en los precios de un solo mes: un factor alcanza,
  // y se cuenta una sola vez si no se pudo ajustar.
  const conItems = computo.items.filter((i) => i.cantidad > 0);
  const factorComputo = conItems.length > 0 ? factor(computo.mesPrecios) : 1;

  // Los precios de cada tarea salen de su desglose: lo que no lleva un tipo
  // ya está en cero, así que se suman los tres sin mirar casillas.
  for (const i of conItems) {
    const f = fila(i.rubroId);
    const k = i.cantidad * factorComputo;
    f.estimadoMateriales += k * i.precioMateriales;
    f.estimadoManoObra += k * i.precioManoObra;
    f.estimadoIntegrado += k * i.precioIntegrado;
  }

  for (const p of presupuestos ?? []) {
    fila(p.rubro_id).cotizado += Number(p.monto) * factor(mesDeFecha(p.fecha));
  }

  for (const g of gastos ?? []) {
    if (!g.rubro_id) continue;
    fila(g.rubro_id).gastado += Number(g.monto) * factor(mesDeFecha(g.fecha));
  }

  const filas = [...porRubro.values()]
    .map((f) => ({
      ...f,
      estimado: f.estimadoMateriales + f.estimadoManoObra + f.estimadoIntegrado,
    }))
    .sort(
      (a, b) =>
        ordenDeRubro(a.rubro) - ordenDeRubro(b.rubro) ||
        a.rubro.localeCompare(b.rubro, "es")
    );

  return { filas, sinAjustar };
}

export type MaterialListado = {
  descripcion: string;
  unidad: string;
  cantidad: number;
  importe: number;
  /** En cuántas tareas aparece: el mismo cemento va en el revoque y en el contrapiso. */
  tareas: number;
};

/**
 * Todos los materiales de la obra, sumados: el pedido que se le hace al
 * corralón. Sale de los desgloses —por unidad de tarea— multiplicados por lo
 * computado de cada tarea.
 *
 * Se agrupa por nombre (sin mayúsculas) y unidad: "Cemento" en bolsa y en kg
 * son dos renglones, porque no se pueden sumar. El renglón genérico de la
 * referencia de Cifras no es un material que se pida: va con el nombre de su
 * tarea, para que se vea de dónde sale y que falta desglosarlo.
 */
export function listadoDeMateriales(items: ItemComputo[]): MaterialListado[] {
  const porClave = new Map<string, MaterialListado & { ids: Set<string> }>();

  for (const item of items) {
    if (item.cantidad <= 0) continue;

    for (const r of item.renglones) {
      if (r.tipo !== "Materiales" || r.cantidad <= 0) continue;

      const generico = /referencia cifras/i.test(r.descripcion) || r.descripcion === "Materiales";
      const descripcion = generico ? `${item.nombre} (sin desglosar)` : r.descripcion;
      // Dos renglones son el mismo material si apuntan al mismo del catálogo,
      // aunque uno diga "Bolsa cemento 25kg" y el otro "Bolsa Cemento 25 kg".
      // Sin enlace no queda más remedio que confiar en el texto, que es lo
      // que se hacía siempre.
      const clave = r.materialId
        ? `material:${r.materialId}`
        : `texto:${descripcion.toLowerCase()}|${r.unidad}`;

      const actual = porClave.get(clave) ?? {
        descripcion,
        unidad: r.unidad,
        cantidad: 0,
        importe: 0,
        tareas: 0,
        ids: new Set<string>(),
      };
      actual.cantidad += item.cantidad * r.cantidad;
      actual.importe += item.cantidad * porUnidadDe(r, item.cantidad);
      actual.ids.add(item.id);
      actual.tareas = actual.ids.size;
      porClave.set(clave, actual);
    }
  }

  return [...porClave.values()]
    .map((m) => ({
      descripcion: m.descripcion,
      unidad: m.unidad,
      cantidad: m.cantidad,
      importe: m.importe,
      tareas: m.tareas,
    }))
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));
}

export type IncidenciaRubro = {
  rubro: string;
  materiales: number;
  manoObra: number;
  integrado: number;
  total: number;
  porcentaje: number;
};

/** Cuánto pesa cada rubro sobre el total estimado, del más caro al más barato. */
export function incidenciaPorRubro(
  items: ItemComputo[],
  nombreDeRubro: (id: string) => string
): IncidenciaRubro[] {
  const porRubro = new Map<string, IncidenciaRubro>();

  for (const i of items) {
    const r = porRubro.get(i.rubroId) ?? {
      rubro: nombreDeRubro(i.rubroId),
      materiales: 0,
      manoObra: 0,
      integrado: 0,
      total: 0,
      porcentaje: 0,
    };
    r.materiales += i.cantidad * i.precioMateriales;
    r.manoObra += i.cantidad * i.precioManoObra;
    r.integrado += i.cantidad * i.precioIntegrado;
    r.total = r.materiales + r.manoObra + r.integrado;
    porRubro.set(i.rubroId, r);
  }

  const filas = [...porRubro.values()].filter((r) => r.total > 0);
  const total = filas.reduce((a, r) => a + r.total, 0);

  return filas
    .map((r) => ({ ...r, porcentaje: total > 0 ? (r.total / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
}
