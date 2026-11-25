"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Json } from "@/lib/database.types";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { capasAlDibujo, soloNucleo, tieneCapasDeAntes } from "@/lib/capas-al-dibujo";
import { getPase, type Pase } from "@/lib/pase-al-computo";
import { noTocoNada, sinPermisoPara } from "@/lib/permisos";
import { leerPisos } from "@/lib/pisos";
import { leerDibujo, leerEscala, leerTiposDeAbertura, metrosPorPixel } from "@/lib/planta-dibujo";
import { type Pincelada, pintar } from "@/lib/planta-pintura";
import { getPisos, getPlantas, getSubtareas, getTiposDeMuroDeObra } from "@/lib/plantas";
import { cantidadEnUnidad, cargasDelPlano, type TareaDelRubro } from "@/lib/avance-del-plano";
import { modeloDePlanta } from "@/lib/planta-3d";
import { aplicarCambio } from "@/lib/planta-edicion";
import { conSusTipos, leerComposicion, medidasDelMuro } from "@/lib/tipos-de-muro";
import { createClient } from "@/lib/supabase/server";
import { alternarTarea } from "../presupuestos/computo/actions";

type Resultado = { error?: string };

/** De piso a techo: entre un entrepiso bajo y un local de doble altura. */
function alturaValida(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 && n < 100 ? n : null;
}

function repeticionesValidas(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : null;
}

/**
 * Da de alta una planta con su plano.
 *
 * La imagen llega ya convertida: si se eligió un PDF, el navegador dibujó la
 * página y mandó eso (`NuevaPlantaForm`). Por eso acá sólo se aceptan
 * imágenes, y el ancho y el alto vienen del formulario, que es quien la tuvo
 * abierta: son el sistema de coordenadas del dibujo.
 *
 * Devuelve el id de la planta creada, o el error.
 */
export async function crearPlanta(
  formData: FormData
): Promise<Resultado & { id?: string }> {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const altura = alturaValida(formData.get("altura"));
  const repeticiones = repeticionesValidas(formData.get("repeticiones"));
  const ancho = Math.round(Number(formData.get("imagen_ancho")));
  const alto = Math.round(Number(formData.get("imagen_alto")));
  const imagen = formData.get("imagen");

  // Se valida antes de subir nada: un plano pesa, y no tiene sentido mandarlo
  // a Drive para después rebotar por un campo vacío.
  if (!nombre) return { error: "Poné el nombre de la planta (Planta baja, Planta tipo...)." };
  if (altura === null) return { error: "La altura de piso a techo tiene que ser un número mayor que cero." };
  if (repeticiones === null) return { error: "Los pisos iguales tienen que ser un número entero, de 1 en adelante." };
  if (!(imagen instanceof File) || imagen.size === 0) {
    return { error: "Elegí el plano: un PDF o una imagen." };
  }
  if (!imagen.type.startsWith("image/")) {
    return { error: "El plano no llegó como imagen. Probá de nuevo o subilo como JPG o PNG." };
  }
  if (!(ancho > 0) || !(alto > 0)) {
    return { error: "No se pudo leer el tamaño del plano. Probá de nuevo." };
  }

  let subida;
  try {
    subida = await subirArchivo({
      archivo: imagen,
      nombre: imagen.name,
      obraSlug: slug,
      tipo: "plantas",
    });
  } catch (e) {
    return { error: `No se pudo subir el plano: ${e instanceof Error ? e.message : "error"}` };
  }

  const supabase = await createClient();

  const { data: planta, error } = await supabase
    .from("plantas")
    .insert({
      obra_id: obraId,
      nombre,
      altura,
      repeticiones,
      imagen_drive_id: subida.id,
      imagen_nombre: imagen.name,
      imagen_mime: subida.mimeType,
      imagen_ancho: ancho,
      imagen_alto: alto,
    })
    .select("id")
    .single();

  if (error || !planta) {
    // Que no quede en Drive un plano que ninguna planta nombra.
    await eliminarArchivo(subida.id).catch(() => {});
    return {
      error: error?.message ?? sinPermisoPara("crear plantas en esta obra"),
    };
  }

  revalidatePath("/", "layout");
  // Sin `redirect`: esto se llama desde el formulario, que es quien navega al
  // editor. Así el formulario sabe si terminó bien o si tiene que mostrar un
  // error, sin distinguir una redirección de una falla.
  return { id: planta.id };
}

export type PlantaParaGuardar = {
  nombre: string;
  altura: number;
  repeticiones: number;
  escala: unknown;
  dibujo: unknown;
};

/**
 * Guarda la planta entera: sus datos, la escala y el dibujo.
 *
 * Va todo junto porque en pantalla es un solo "Guardar": la altura cambia los
 * m² de pared igual que mover un muro, y dos botones dejarían la mitad sin
 * guardar. El dibujo y la escala pasan por los mismos lectores que al abrir,
 * así lo que entra a la base es lo que después se va a poder leer.
 */
export async function guardarPlanta(
  slug: string,
  plantaId: string,
  datos: PlantaParaGuardar
): Promise<Resultado> {
  const nombre = String(datos.nombre ?? "").trim();
  const altura = alturaValida(datos.altura);
  const repeticiones = repeticionesValidas(datos.repeticiones);

  if (!nombre) return { error: "La planta necesita un nombre." };
  if (altura === null) return { error: "La altura de piso a techo tiene que ser un número mayor que cero." };
  if (repeticiones === null) return { error: "Los pisos iguales tienen que ser un número entero, de 1 en adelante." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plantas")
    .update({
      nombre,
      altura,
      repeticiones,
      escala: leerEscala(datos.escala) as Json,
      dibujo: leerDibujo(datos.dibujo) as unknown as Json,
    })
    .eq("id", plantaId)
    .select("id");

  if (error) return { error: error.message };
  if (noTocoNada(data)) return { error: sinPermisoPara("modificar esta planta") };

  revalidatePath("/", "layout");
  return {};
}

/**
 * Guarda la definición de pisos de la obra, entera.
 *
 * Va la lista completa y no piso por piso porque así se edita: insertar uno
 * en el medio renumera a los de arriba y les corre la cota, y guardarlos de a
 * uno dejaría la obra, por un rato, con dos pisos en el mismo número.
 *
 * Primero se escriben los que quedan —por su número, que es lo que los
 * identifica— y recién después se borran los que sobran: si algo falla en el
 * medio, la obra queda con pisos de más, que se ve y se arregla, y no sin
 * ninguno.
 *
 * De paso deja al día `plantas.repeticiones`: cuántos pisos repiten una planta
 * es ahora cuántos pisos la tienen asignada, y todo lo que multiplica por los
 * pisos iguales —las medidas del edificio— sale de esa columna.
 */
export async function guardarPisos(
  slug: string,
  obraId: string,
  lista: unknown
): Promise<Resultado> {
  const leidos = leerPisos(lista);
  if ("error" in leidos) return { error: leidos.error };
  const { pisos } = leidos;

  const supabase = await createClient();

  // Qué plantas tenían pisos antes, para saber cuáles se quedan sin ninguno.
  const { data: previos } = await supabase
    .from("pisos")
    .select("planta_id")
    .eq("obra_id", obraId);

  if (pisos.length > 0) {
    const { data, error } = await supabase
      .from("pisos")
      .upsert(
        pisos.map((p) => ({
          obra_id: obraId,
          numero: p.numero,
          nombre: p.nombre,
          cota: p.cota,
          altura: p.altura,
          planta_id: p.plantaId,
        })),
        { onConflict: "obra_id,numero" }
      )
      .select("id");

    if (error) return { error: error.message };
    if (noTocoNada(data)) return { error: sinPermisoPara("definir los pisos de esta obra") };
  }

  // Los que ya no están en la lista.
  let sobrantes = supabase.from("pisos").delete().eq("obra_id", obraId);
  if (pisos.length > 0) {
    sobrantes = sobrantes.not("numero", "in", `(${pisos.map((p) => p.numero).join(",")})`);
  }
  const { error: alBorrar } = await sobrantes;
  if (alBorrar) return { error: alBorrar.message };

  // Cuántos pisos tiene cada planta. La que tenía y se quedó sin ninguno
  // vuelve a uno; la que nunca tuvo no se toca: conserva los "pisos iguales"
  // que se le cargaron a mano.
  const porPlanta = new Map<string, number>();
  for (const previo of previos ?? []) {
    if (previo.planta_id) porPlanta.set(previo.planta_id, 1);
  }
  const asignados = new Map<string, number>();
  for (const p of pisos) {
    if (p.plantaId) asignados.set(p.plantaId, (asignados.get(p.plantaId) ?? 0) + 1);
  }
  for (const [plantaId, cantidad] of asignados) porPlanta.set(plantaId, cantidad);
  for (const [plantaId, repeticiones] of porPlanta) {
    const { error } = await supabase
      .from("plantas")
      .update({ repeticiones })
      .eq("id", plantaId)
      .eq("obra_id", obraId);
    if (error) return { error: error.message };
  }

  revalidatePath("/", "layout");
  return {};
}

/**
 * Cambia una medida de una cosa de una planta, desde el 3D.
 *
 * Lee el dibujo guardado, le aplica el cambio (`aplicarCambio`, que es quien
 * decide qué se puede tocar) y lo vuelve a guardar. Va contra lo guardado y
 * no contra lo que haya abierto en un editor: si la misma planta está abierta
 * con cambios sin guardar, al guardarla ahí se pisa esto.
 */
export async function editarEnPlanta(
  slug: string,
  plantaId: string,
  objeto: string,
  clave: string,
  valor: number | null
): Promise<Resultado> {
  const supabase = await createClient();

  const { data: planta, error: alLeer } = await supabase
    .from("plantas")
    .select("dibujo")
    .eq("id", plantaId)
    .maybeSingle();

  if (alLeer) return { error: alLeer.message };
  if (!planta) return { error: "No se encontró la planta." };

  const resultado = aplicarCambio(
    leerDibujo(planta.dibujo),
    String(objeto),
    String(clave),
    valor === null ? null : Number(valor)
  );
  if ("error" in resultado) return { error: resultado.error };

  const { data, error } = await supabase
    .from("plantas")
    .update({ dibujo: resultado.dibujo as unknown as Json })
    .eq("id", plantaId)
    .select("id");

  if (error) return { error: error.message };
  if (noTocoNada(data)) return { error: sinPermisoPara("modificar esta planta") };

  revalidatePath("/", "layout");
  return {};
}

/**
 * Una pincelada del bote de pintura del 3D (`lib/planta-pintura.ts`): pinta, o
 * despinta si ya tenía esa pintura, lo que se tocó. Como `editarEnPlanta`, va
 * contra lo guardado.
 */
export async function pintarEnPlanta(
  plantaId: string,
  tarea: string,
  pincelada: Pincelada
): Promise<Resultado> {
  const supabase = await createClient();

  const [{ data: planta, error: alLeer }, { data: pintura }, { data: revestimientos }] = await Promise.all([
    supabase.from("plantas").select("dibujo, escala, altura").eq("id", plantaId).maybeSingle(),
    supabase.from("tareas").select("id").eq("id", String(tarea)).maybeSingle(),
    // Lo que no se pinta: la pintura arranca donde termina.
    supabase.from("tareas").select("id").eq("rubro", "Revestimientos"),
  ]);
  if (alLeer) return { error: alLeer.message };
  if (!planta) return { error: "No se encontró la planta." };
  if (!pintura) return { error: "Esa pintura no está en el catálogo." };

  const mpp = metrosPorPixel(leerEscala(planta.escala));
  if (mpp === null) return { error: "La planta no tiene escala." };

  // Lo que llega del navegador, con lo justo y en su forma.
  const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  let toque: Pincelada | null = null;
  if (pincelada?.donde === "cara") {
    const t = pincelada.tramo;
    const desde = numero(t?.desde);
    const hasta = numero(t?.hasta);
    const cara = t?.cara === 1 || t?.cara === -1 || t?.cara === "a" || t?.cara === "b" ? t.cara : null;
    if (typeof t?.muroId === "string" && cara !== null && desde !== null && hasta !== null) {
      toque = { donde: "cara", tramo: { muroId: t.muroId, cara, desde, hasta } };
    }
  } else if (pincelada?.donde === "cielorraso" && typeof pincelada.ambienteId === "string") {
    toque = { donde: "cielorraso", ambienteId: pincelada.ambienteId };
  } else if (pincelada?.donde === "cajon" && typeof pincelada.cajonId === "string") {
    toque = { donde: "cajon", cajonId: pincelada.cajonId };
  }
  if (!toque) return { error: "Eso no se puede pintar." };

  const resultado = pintar(
    leerDibujo(planta.dibujo),
    mpp,
    Number(planta.altura),
    pintura.id,
    toque,
    new Set((revestimientos ?? []).map((t) => t.id))
  );
  if ("error" in resultado) return { error: resultado.error };

  const { data, error } = await supabase
    .from("plantas")
    .update({ dibujo: resultado.dibujo as unknown as Json })
    .eq("id", plantaId)
    .select("id");

  if (error) return { error: error.message };
  if (noTocoNada(data)) return { error: sinPermisoPara("modificar esta planta") };

  revalidatePath("/", "layout");
  return {};
}

/**
 * Lo que pasaría si se pasa el plano al cómputo: tarea por tarea, lo que tiene
 * hoy y con lo que queda. No escribe nada: es lo que se muestra antes.
 */
export async function verPaseAlComputo(
  obraId: string
): Promise<{ pase?: Pase; error?: string }> {
  const resultado = await getPase(obraId);
  return "error" in resultado ? { error: resultado.error } : { pase: resultado.pase };
}

/** De a cuántos se borran los renglones viejos: los ids van en la dirección. */
const TANDA = 80;

/**
 * Pasa al cómputo lo que miden las plantas.
 *
 * Reemplaza **sólo lo que había venido del plano**: lo medido a mano o pegado
 * desde Excel no se toca, y la cantidad de cada tarea queda en la suma de las
 * dos cosas. Las tareas que el dibujo usa y el cómputo no tenía se agregan,
 * con su desglose de modelo, igual que al tildarlas en el catálogo.
 *
 * No recibe los números: los rehace acá, con lo guardado. Lo que se mostró en
 * la vista previa pudo cambiar mientras estaba abierta, y la cantidad de una
 * tarea multiplica todos los precios del cómputo.
 *
 * Primero se escriben los renglones nuevos y recién después se borran los
 * viejos: si algo falla en el medio, la medición queda con renglones de más
 * —que se ven, y se arreglan pasando de nuevo— y no sin ninguno.
 */
export async function pasarAlComputo(
  slug: string,
  obraId: string
): Promise<Resultado & { tareas?: number; agregadas?: number }> {
  const resultado = await getPase(obraId);
  if ("error" in resultado) return { error: resultado.error };
  const { pase } = resultado;

  const lineas = pase.lineas.filter((l) => l.cambia || Math.abs(l.hoy - l.queda) > 0.0005);
  if (lineas.length === 0) return { tareas: 0, agregadas: 0 };

  const supabase = await createClient();

  if (!pase.hayComputo) {
    const { error } = await supabase
      .from("computos")
      .upsert({ obra_id: obraId }, { onConflict: "obra_id", ignoreDuplicates: true });
    if (error) return { error: error.message };
  }

  // Las tareas que el cómputo todavía no tiene.
  const faltan = lineas.filter((l) => l.itemId === null && l.renglones.length > 0);
  for (const l of faltan) {
    const { error } = await alternarTarea(obraId, l.tareaId, true);
    if (error) return { error: `No se pudo agregar "${l.nombre}" al cómputo: ${error}` };
  }

  const itemDe = new Map<string, string>();
  for (const l of lineas) if (l.itemId) itemDe.set(l.tareaId, l.itemId);
  if (faltan.length > 0) {
    const { data: agregados, error } = await supabase
      .from("computo_items")
      .select("id, tarea_id")
      .eq("obra_id", obraId)
      .in(
        "tarea_id",
        faltan.map((l) => l.tareaId)
      );
    if (error) return { error: error.message };
    for (const i of agregados ?? []) if (i.tarea_id) itemDe.set(i.tarea_id, i.id);
    // Agregar una tarea sin permiso no da error: no la agrega.
    if (faltan.some((l) => !itemDe.has(l.tareaId))) {
      return { error: sinPermisoPara("agregar tareas al cómputo de esta obra") };
    }
  }

  const itemIds = [...new Set(itemDe.values())];

  // Lo que hoy está guardado como del plano en estas tareas: es lo que se va.
  const { data: viejos, error: alLeerViejos } = await supabase
    .from("computo_item_medicion")
    .select("id")
    .eq("origen", "plano")
    .in("item_id", itemIds);
  if (alLeerViejos) return { error: alLeerViejos.message };

  const nuevos = lineas.flatMap((l) =>
    l.renglones.map((r) => ({
      item_id: itemDe.get(l.tareaId)!,
      origen: "plano",
      nivel: r.nivel,
      etiqueta: r.etiqueta,
      forma: r.forma,
      a: r.a,
      b: r.b,
      c: r.c,
      unidades: r.unidades,
      cantidad: r.cantidad,
    }))
  );
  if (nuevos.length > 0) {
    const { data: escritos, error } = await supabase
      .from("computo_item_medicion")
      // Después de lo medido a mano, en el orden del edificio.
      .insert(nuevos.map((n, i) => ({ ...n, orden: 100000 + i })))
      .select("id");
    if (error) return { error: error.message };
    if (noTocoNada(escritos)) return { error: sinPermisoPara("modificar el cómputo de esta obra") };
  }

  const aBorrar = (viejos ?? []).map((v) => v.id);
  for (let i = 0; i < aBorrar.length; i += TANDA) {
    const { data: borrados, error } = await supabase
      .from("computo_item_medicion")
      .delete()
      .in("id", aBorrar.slice(i, i + TANDA))
      .select("id");
    if (error) return { error: error.message };
    if (noTocoNada(borrados)) return { error: sinPermisoPara("modificar el cómputo de esta obra") };
  }

  // La cantidad de cada tarea: lo del plano más lo que tenía medido a mano.
  for (const l of lineas) {
    const id = itemDe.get(l.tareaId);
    if (!id) continue;
    const { data: tocados, error } = await supabase
      .from("computo_items")
      .update({ cantidad: l.queda })
      .eq("id", id)
      .select("id");
    if (error) return { error: error.message };
    if (noTocoNada(tocados)) return { error: sinPermisoPara("modificar el cómputo de esta obra") };
  }

  revalidatePath("/", "layout");
  return { tareas: lineas.length, agregadas: faltan.length };
}

/**
 * Guarda un tipo de muro de la obra —nuevo, o uno que se cambió— y lo lleva
 * a **todos** los muros que lo usan, en todas las plantas de la obra: su
 * espesor pasa a ser la suma de las capas y su tarea la del núcleo. Sin eso,
 * una planta que no está abierta seguiría dibujando y midiendo el muro viejo.
 *
 * Devuelve el id, que es lo que el muro guarda.
 */
export async function guardarTipoDeMuro(
  obraId: string,
  tipo: { id: string | null; nombre: string; composicion: unknown }
): Promise<Resultado & { id?: string }> {
  const nombre = String(tipo.nombre ?? "").trim();
  if (!nombre) return { error: "El tipo necesita un nombre." };
  const composicion = leerComposicion(tipo.composicion);

  const supabase = await createClient();
  const fila = { obra_id: obraId, nombre, composicion: composicion as unknown as Json };
  const { data, error } = tipo.id
    ? await supabase.from("tipos_de_muro").update(fila).eq("id", tipo.id).select("id")
    : await supabase.from("tipos_de_muro").insert(fila).select("id");
  if (error?.code === "23505") return { error: "Ya hay un tipo con ese nombre." };
  if (error) return { error: error.message };
  if (noTocoNada(data)) return { error: sinPermisoPara("cambiar los tipos de muro") };
  const id = data[0].id;

  // Los muros que lo usan, en todas las plantas de la obra.
  const { data: plantas, error: alLeer } = await supabase
    .from("plantas")
    .select("id, dibujo")
    .eq("obra_id", obraId);
  if (alLeer) return { error: alLeer.message };

  const delTipo = medidasDelMuro(composicion);
  for (const planta of plantas ?? []) {
    const dibujo = leerDibujo(planta.dibujo);
    if (!dibujo.muros.some((m) => m.tipo === id)) continue;
    const muros = dibujo.muros.map((m) => (m.tipo === id ? { ...m, ...delTipo } : m));
    const { error: alGuardar } = await supabase
      .from("plantas")
      .update({ dibujo: { ...dibujo, muros } as unknown as Json })
      .eq("id", planta.id);
    if (alGuardar) return { error: alGuardar.message };
  }

  revalidatePath("/", "layout");
  return { id };
}

/**
 * Pasa las capas de antes de **todas las plantas de la obra** a capas
 * dibujadas (`capasAlDibujo`) y deja cada tipo de muro sólo con su núcleo.
 *
 * Es de la obra entera porque los tipos son de la obra: vaciar un tipo con
 * una planta sin pasar le sacaría las capas. Primero las plantas y después los
 * tipos: si algo falla a mitad de camino, ninguna planta pierde sus capas.
 */
export async function pasarCapasAlDibujo(obraId: string): Promise<Resultado> {
  const supabase = await createClient();
  const [{ data: plantas, error: alLeer }, tiposDeLaObra] = await Promise.all([
    supabase.from("plantas").select("id, dibujo, escala, altura").eq("obra_id", obraId),
    getTiposDeMuroDeObra(obraId),
  ]);
  if (alLeer) return { error: alLeer.message };
  const tipos = new Map(tiposDeLaObra.map((t) => [t.id, t] as const));

  for (const planta of plantas ?? []) {
    const dibujo = leerDibujo(planta.dibujo);
    if (!tieneCapasDeAntes(dibujo, tipos)) continue;
    const pasado = capasAlDibujo(dibujo, leerEscala(planta.escala), Number(planta.altura), tipos);
    const { data, error } = await supabase
      .from("plantas")
      .update({ dibujo: pasado as unknown as Json })
      .eq("id", planta.id)
      .select("id");
    if (error) return { error: error.message };
    if (noTocoNada(data)) return { error: sinPermisoPara("cambiar las plantas de esta obra") };
  }

  for (const tipo of tiposDeLaObra) {
    if (tipo.exterior.length + tipo.interior.length === 0) continue;
    const { data, error } = await supabase
      .from("tipos_de_muro")
      .update({ composicion: soloNucleo(tipo) as unknown as Json })
      .eq("id", tipo.id)
      .select("id");
    if (error) return { error: error.message };
    if (noTocoNada(data)) return { error: sinPermisoPara("cambiar los tipos de muro") };
  }

  revalidatePath("/", "layout");
  return {};
}

/**
 * Guarda un tipo de abertura de la obra —nuevo o cambiado— y lo lleva a todas
 * las aberturas de ese nombre en todas las plantas: sus medidas, cómo abre,
 * su marco y sus tareas. La mano, el antepecho y hacia dónde abre son de cada una y no se
 * tocan.
 */
export async function guardarTipoDeAbertura(obraId: string, crudo: unknown): Promise<Resultado> {
  const [tipo] = leerTiposDeAbertura([crudo]);
  if (!tipo) return { error: "El tipo necesita nombre, ancho y alto." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipos_de_abertura")
    .upsert(
      {
        obra_id: obraId,
        tipo: tipo.tipo,
        nombre: tipo.nombre,
        ancho: tipo.ancho,
        alto: tipo.alto,
        antepecho: tipo.antepecho,
        apertura: tipo.apertura,
        hojas: tipo.hojas,
        marco: tipo.marco,
        tareas: tipo.tareas,
      },
      { onConflict: "obra_id,tipo,nombre" }
    )
    .select("id");
  if (error) return { error: error.message };
  if (noTocoNada(data)) return { error: sinPermisoPara("cambiar los tipos de abertura") };

  const { data: plantas, error: alLeer } = await supabase
    .from("plantas")
    .select("id, dibujo")
    .eq("obra_id", obraId);
  if (alLeer) return { error: alLeer.message };

  const delTipo = (a: { tipo: string; nombre: string }) => a.tipo === tipo.tipo && a.nombre === tipo.nombre;
  for (const planta of plantas ?? []) {
    const dibujo = leerDibujo(planta.dibujo);
    if (!dibujo.aberturas.some(delTipo)) continue;
    const aberturas = dibujo.aberturas.map((a) =>
      delTipo(a)
        ? {
            ...a,
            ancho: tipo.ancho,
            alto: tipo.alto,
            apertura: tipo.apertura,
            hojas: tipo.hojas,
            marco: tipo.marco,
            tareas: tipo.tareas,
          }
        : a
    );
    const { error: alGuardar } = await supabase
      .from("plantas")
      .update({ dibujo: { ...dibujo, aberturas } as unknown as Json })
      .eq("id", planta.id);
    if (alGuardar) return { error: alGuardar.message };
  }

  revalidatePath("/", "layout");
  return {};
}

/** Borra un tipo de muro, si ningún muro de la obra lo usa. */
export async function eliminarTipoDeMuro(obraId: string, id: string): Promise<Resultado> {
  const supabase = await createClient();
  const { data: plantas, error: alLeer } = await supabase
    .from("plantas")
    .select("nombre, dibujo")
    .eq("obra_id", obraId);
  if (alLeer) return { error: alLeer.message };

  const usan = (plantas ?? []).filter((p) => leerDibujo(p.dibujo).muros.some((m) => m.tipo === id));
  if (usan.length > 0) {
    return { error: `Lo usan muros de ${usan.map((p) => p.nombre).join(", ")}.` };
  }

  const { data, error } = await supabase
    .from("tipos_de_muro")
    .delete()
    .eq("id", id)
    .eq("obra_id", obraId)
    .select("id");
  if (error) return { error: error.message };
  if (noTocoNada(data)) return { error: sinPermisoPara("borrar tipos de muro") };

  revalidatePath("/", "layout");
  return {};
}

export async function eliminarPlanta(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("planta_id") ?? "");

  const supabase = await createClient();

  // El id de Drive se lee antes: después del borrado no hay de dónde sacarlo.
  const { data: planta } = await supabase
    .from("plantas")
    .select("imagen_drive_id")
    .eq("id", id)
    .maybeSingle();

  const { data: borradas, error } = await supabase
    .from("plantas")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    redirect(`/obras/${slug}/plantas?error=${encodeURIComponent(error.message)}`);
  }

  // Antes de Drive: si el borrado no pasó, el plano tiene que seguir ahí.
  if (noTocoNada(borradas)) {
    redirect(
      `/obras/${slug}/plantas?error=${encodeURIComponent(
        sinPermisoPara("borrar esta planta")
      )}`
    );
  }

  if (planta?.imagen_drive_id) {
    await eliminarArchivo(planta.imagen_drive_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/plantas`);
}

/** Lo que llega del 3D al marcar una cosa. */
export type MarcaEnElPlano = {
  planta: string;
  piso: number;
  objeto: string;
  tarea: string;
  hecho: boolean;
  /** El día que se hizo, AAAA-MM-DD. */
  fecha: string;
};

const ES_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Una cosa del 3D: un muro, un ambiente, una pieza de la estructura; una cara
// de un muro (`cara:<muro>:<lado>`), o una capa dibujada en una cara
// (`capa:<capa>:<muro>:<lado>`). El lado es 1, -1, o la punta a o b.
const UUID = "[0-9a-f-]{36}";
const LADO = "(1|-1|a|b)";
const ES_OBJETO = new RegExp(
  `^((muro|ambiente|losa|viga|columna|abertura):${UUID}|cara:${UUID}:${LADO}|capa:${UUID}:${UUID}:${LADO})$`,
  "i"
);
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Marca —o desmarca— una cosa del 3D como hecha: este muro, en este piso, de
 * esta tarea. Lo que mide no lo dice el navegador: se rehace el modelo de la
 * planta y se lo lee de ahí, en la unidad con que el cómputo cotiza la tarea.
 *
 * Después se rehacen **todas** las cargas del plano del rubro de esa tarea
 * (`cargasDelPlano`): una por día, con lo que avanzó. Las cargas a mano no se
 * tocan.
 */
export async function marcarEnElPlano(obraId: string, crudo: MarcaEnElPlano): Promise<Resultado> {
  const { planta: plantaId, objeto, tarea: tareaId, hecho, fecha } = crudo;
  const piso = Number(crudo.piso);
  if (!ES_ID.test(String(plantaId)) || !ES_ID.test(String(tareaId)) || !ES_OBJETO.test(String(objeto))) {
    return { error: "Eso no se puede marcar." };
  }
  if (!Number.isInteger(piso) || !ES_FECHA.test(String(fecha))) return { error: "Falta el piso o el día." };

  const supabase = await createClient();
  const [plantas, pisos, tiposDeLaObra, subtareas] = await Promise.all([
    getPlantas(obraId),
    getPisos(obraId),
    getTiposDeMuroDeObra(obraId),
    getSubtareas(),
  ]);
  const planta = plantas.find((p) => p.id === plantaId);
  const suPiso = pisos.find((p) => p.numero === piso && p.plantaId === plantaId);
  if (!planta || !suPiso) return { error: "Ese piso no tiene esa planta." };

  // La tarea en el cómputo: su rubro y en qué se cotiza.
  const { data: items, error: alLeerItems } = await supabase
    .from("computo_items")
    .select("rubro_id, tarea_id, unidad, cantidad, precio_materiales, precio_mano_obra, precio_integrado")
    .eq("obra_id", obraId)
    .not("tarea_id", "is", null);
  if (alLeerItems) return { error: alLeerItems.message };
  const deLaTarea = (items ?? []).find((i) => i.tarea_id === tareaId);
  if (!deLaTarea) {
    return { error: "Esa tarea no está en el cómputo: pasá el plano al cómputo para poder marcar su avance." };
  }

  if (hecho) {
    // Lo que mide, del modelo de la planta, como lo levanta el 3D.
    const primerPiso = pisos.find((p) => p.plantaId === plantaId) ?? suPiso;
    const tipos = new Map(tiposDeLaObra.map((t) => [t.id, t]));
    const modelo = modeloDePlanta(
      { ...planta, dibujo: { ...planta.dibujo, muros: conSusTipos(planta.dibujo.muros, tipos) } },
      primerPiso.altura,
      new Map(),
      tipos,
      subtareas
    );
    const medida = modelo?.objetos[objeto]?.tareas?.find((t) => t.tarea === tareaId);
    const cantidad = medida ? cantidadEnUnidad(medida, deLaTarea.unidad) : null;
    if (cantidad === null) return { error: "Esa cosa no lleva esa tarea, o el plano no la mide en su unidad." };

    const { data, error } = await supabase
      .from("avances_del_plano")
      .upsert(
        { obra_id: obraId, planta_id: plantaId, piso, objeto, tarea_id: tareaId, cantidad, fecha },
        { onConflict: "obra_id,planta_id,piso,objeto,tarea_id" }
      )
      .select("id");
    if (error) return { error: error.message };
    if (noTocoNada(data)) return { error: sinPermisoPara("marcar el avance") };
  } else {
    const { data, error } = await supabase
      .from("avances_del_plano")
      .delete()
      .eq("obra_id", obraId)
      .eq("planta_id", plantaId)
      .eq("piso", piso)
      .eq("objeto", objeto)
      .eq("tarea_id", tareaId)
      .select("id");
    if (error) return { error: error.message };
    if (noTocoNada(data)) return { error: sinPermisoPara("marcar el avance") };
  }

  // Las cargas del plano del rubro, de nuevo y enteras.
  const rubroId = deLaTarea.rubro_id;
  const porTarea = new Map<string, TareaDelRubro>();
  for (const i of items ?? []) {
    if (i.rubro_id !== rubroId || !i.tarea_id) continue;
    const ya = porTarea.get(i.tarea_id) ?? { tareaId: i.tarea_id, cantidad: 0, costo: 0 };
    ya.cantidad += Number(i.cantidad);
    ya.costo +=
      Number(i.cantidad) * (Number(i.precio_materiales) + Number(i.precio_mano_obra) + Number(i.precio_integrado));
    porTarea.set(i.tarea_id, ya);
  }
  const { data: marcas, error: alLeerMarcas } = await supabase
    .from("avances_del_plano")
    .select("tarea_id, cantidad, fecha")
    .eq("obra_id", obraId)
    .in("tarea_id", Array.from(porTarea.keys()));
  if (alLeerMarcas) return { error: alLeerMarcas.message };

  const cargas = cargasDelPlano(
    (marcas ?? []).map((m) => ({ tareaId: m.tarea_id, cantidad: Number(m.cantidad), fecha: m.fecha })),
    Array.from(porTarea.values())
  );

  const { error: alBorrar } = await supabase
    .from("avances")
    .delete()
    .eq("obra_id", obraId)
    .eq("rubro_id", rubroId)
    .eq("desde_el_plano", true);
  if (alBorrar) return { error: alBorrar.message };

  if (cargas.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre")
      .eq("id", user?.id ?? "")
      .maybeSingle();
    const { error: alCargar } = await supabase.from("avances").insert(
      cargas.map((c) => ({
        obra_id: obraId,
        rubro_id: rubroId,
        porcentaje: c.porcentaje,
        fecha_desde: c.fecha,
        fecha_hasta: c.fecha,
        comentario: `Marcado en el 3D: ${c.cosas} ${c.cosas === 1 ? "cosa" : "cosas"}`,
        desde_el_plano: true,
        actualizado_por: user?.id ?? null,
        actualizado_por_nombre: perfil?.nombre ?? null,
      }))
    );
    if (alCargar) return { error: alCargar.message };
  }

  revalidatePath("/", "layout");
  return {};
}

/**
 * Sube o baja una planta en la lista de la obra —las fundaciones abajo de la
 * planta baja, el techo arriba de la planta tipo—. Se renumera el orden de
 * todas, así dos plantas nunca quedan empatadas.
 */
export async function moverPlanta(slug: string, obraId: string, plantaId: string, haciaArriba: boolean) {
  const supabase = await createClient();
  const { data: plantas, error } = await supabase
    .from("plantas")
    .select("id")
    .eq("obra_id", obraId)
    .order("orden")
    .order("creado_en");
  if (error || !plantas) return;

  const ids = plantas.map((p) => p.id);
  const i = ids.indexOf(plantaId);
  const j = haciaArriba ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];

  await Promise.all(ids.map((id, orden) => supabase.from("plantas").update({ orden }).eq("id", id)));
  revalidatePath(`/obras/${slug}/plantas`);
}
