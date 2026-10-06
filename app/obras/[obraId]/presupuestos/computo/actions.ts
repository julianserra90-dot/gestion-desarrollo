"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function base(slug: string) {
  return `/obras/${slug}/presupuestos/computo`;
}

function volver(destino: string, error: string): never {
  redirect(`${destino}?error=${encodeURIComponent(error)}`);
}

/** Arranca el cómputo de la obra: el catálogo para elegir tareas ya está al costado. */
export async function crearComputo(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const supabase = await createClient();

  const { error } = await supabase
    .from("computos")
    .upsert({ obra_id: obraId }, { onConflict: "obra_id", ignoreDuplicates: true });

  if (error) volver(base(slug), error.message);

  revalidatePath(base(slug));
  redirect(base(slug));
}

/**
 * El rubro de la obra que corresponde a un rubro del catálogo de tareas.
 *
 * Toda obra tiene el catálogo de rubros entero, así que casi siempre está; si
 * alguien lo borró o lo renombró, se crea de nuevo antes que dejar la tarea
 * colgada de nada.
 */
async function rubroDeObra(
  supabase: Supabase,
  obraId: string,
  porNombre: Map<string, { id: string; activo: boolean }>,
  nombre: string
) {
  const existente = porNombre.get(nombre.toLowerCase());
  if (existente) return existente;

  const { data, error } = await supabase
    .from("rubros")
    .insert({ obra_id: obraId, nombre, orden: 99, activo: true })
    .select("id, activo")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el rubro.");

  porNombre.set(nombre.toLowerCase(), data);
  return data;
}

type RenglonDesglose = {
  tipo: "Materiales" | "Mano de obra" | "Integrado";
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio: number;
};

const TIPOS_DESGLOSE = ["Materiales", "Mano de obra", "Integrado"] as const;

/**
 * Reemplaza el desglose de una tarea y rehace sus precios.
 *
 * El precio de una tarea sale **sólo** de su desglose: por cada tipo, la suma
 * de cantidad × precio de sus renglones. Sin renglones de un tipo, ese precio
 * queda en cero. Las casillas de tipo de la tarea siguen a los renglones, y el
 * rubro prende en Cotizaciones los tipos que usen sus tareas (nunca los
 * apaga: puede tener cotizaciones cargadas).
 *
 * Devuelve el error en vez de redirigir: la usan acciones distintas, cada una
 * con su pantalla a la que volver.
 */
async function aplicarDesglose(
  supabase: Supabase,
  itemId: string,
  rubroId: string,
  renglones: RenglonDesglose[]
): Promise<string | null> {
  const { error: errorBorrado } = await supabase
    .from("computo_item_desglose")
    .delete()
    .eq("item_id", itemId);
  if (errorBorrado) return errorBorrado.message;

  if (renglones.length > 0) {
    const { error } = await supabase.from("computo_item_desglose").insert(
      renglones.map((r, orden) => ({
        item_id: itemId,
        tipo: r.tipo,
        descripcion: r.descripcion,
        unidad: r.unidad,
        cantidad: r.cantidad,
        precio_unitario: r.precio,
        orden,
      }))
    );
    if (error) return error.message;
  }

  const suma = (tipo: RenglonDesglose["tipo"]) =>
    Math.round(
      renglones
        .filter((r) => r.tipo === tipo)
        .reduce((acc, r) => acc + r.cantidad * r.precio, 0) * 100
    ) / 100;
  const hay = (tipo: RenglonDesglose["tipo"]) => renglones.some((r) => r.tipo === tipo);

  const tipos = {
    usa_materiales: hay("Materiales"),
    usa_mano_obra: hay("Mano de obra"),
    usa_integrado: hay("Integrado"),
  };
  // Una tarea sin renglones no puede quedar sin ningún tipo (la base lo
  // rechaza): conserva los que tenía y queda en cero.
  const algunTipo = tipos.usa_materiales || tipos.usa_mano_obra || tipos.usa_integrado;

  const { error: errorItem } = await supabase
    .from("computo_items")
    .update({
      ...(algunTipo ? tipos : {}),
      precio_materiales: suma("Materiales"),
      precio_mano_obra: suma("Mano de obra"),
      precio_integrado: suma("Integrado"),
    })
    .eq("id", itemId);
  if (errorItem) return errorItem.message;

  if (!algunTipo) return null;

  const { data: rubro } = await supabase
    .from("rubros")
    .select("id, usa_materiales, usa_mano_obra, usa_mano_obra_y_materiales")
    .eq("id", rubroId)
    .maybeSingle();

  if (
    rubro &&
    ((tipos.usa_materiales && !rubro.usa_materiales) ||
      (tipos.usa_mano_obra && !rubro.usa_mano_obra) ||
      (tipos.usa_integrado && !rubro.usa_mano_obra_y_materiales))
  ) {
    await supabase
      .from("rubros")
      .update({
        usa_materiales: rubro.usa_materiales || tipos.usa_materiales,
        usa_mano_obra: rubro.usa_mano_obra || tipos.usa_mano_obra,
        usa_mano_obra_y_materiales:
          rubro.usa_mano_obra_y_materiales || tipos.usa_integrado,
      })
      .eq("id", rubro.id);
  }

  return null;
}

/**
 * Guarda qué tareas del catálogo lleva la obra.
 *
 * Las que se tildan entran con cantidad cero y con **una copia del desglose
 * de modelo** de la tarea, que da su precio; en la obra se ajusta. Las que se
 * destildan salen con su cantidad y su desglose. Las que siguen tildadas no
 * se tocan.
 *
 * Tildar una tarea marca su rubro en la obra: si se va a computar, se va a
 * cotizar y a gastar, y el rubro tiene que aparecer en los desplegables.
 */
export async function guardarTareas(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const destino = `${base(slug)}/tareas`;

  const elegidas = new Set(formData.getAll("tarea").map(String));
  const propiasQueQuedan = new Set(formData.getAll("propia").map(String));

  const supabase = await createClient();

  const [{ data: actuales }, { data: catalogo }, { data: rubros }] =
    await Promise.all([
      supabase.from("computo_items").select("id, tarea_id").eq("obra_id", obraId),
      supabase.from("tareas").select("id, rubro, subrubro, nombre, unidad, orden"),
      supabase.from("rubros").select("id, nombre, activo").eq("obra_id", obraId),
    ]);

  const yaEstan = new Set(
    (actuales ?? []).map((i) => i.tarea_id).filter(Boolean) as string[]
  );

  // Las del catálogo destildadas, y las propias a las que les sacaron la tilde.
  const aBorrar = (actuales ?? [])
    .filter((i) =>
      i.tarea_id ? !elegidas.has(i.tarea_id) : !propiasQueQuedan.has(i.id)
    )
    .map((i) => i.id);

  if (aBorrar.length > 0) {
    const { error } = await supabase.from("computo_items").delete().in("id", aBorrar);
    if (error) volver(destino, error.message);
  }

  const porNombre = new Map(
    (rubros ?? []).map((r) => [r.nombre.toLowerCase(), { id: r.id, activo: r.activo }])
  );

  const nuevas = (catalogo ?? []).filter(
    (t) => elegidas.has(t.id) && !yaEstan.has(t.id)
  );

  const filas = [];
  const rubrosAMarcar = new Set<string>();

  try {
    for (const t of nuevas) {
      const rubro = await rubroDeObra(supabase, obraId, porNombre, t.rubro);
      if (!rubro.activo) rubrosAMarcar.add(rubro.id);

      filas.push({
        obra_id: obraId,
        rubro_id: rubro.id,
        tarea_id: t.id,
        subrubro: t.subrubro,
        nombre: t.nombre,
        unidad: t.unidad,
        cantidad: 0,
        orden: t.orden,
      });
    }
  } catch (e) {
    volver(destino, e instanceof Error ? e.message : "No se pudo guardar.");
  }

  if (filas.length > 0) {
    const { data: creadas, error } = await supabase
      .from("computo_items")
      .insert(filas)
      .select("id, rubro_id, tarea_id");
    if (error) volver(destino, error.message);

    // Cada tarea nueva recibe su desglose de modelo.
    const { data: modelos } = await supabase
      .from("tarea_desglose")
      .select("tarea_id, tipo, descripcion, unidad, cantidad, precio_unitario, orden")
      .in(
        "tarea_id",
        nuevas.map((t) => t.id)
      )
      .order("orden");

    for (const item of creadas ?? []) {
      const renglones = (modelos ?? [])
        .filter((m) => m.tarea_id === item.tarea_id)
        .map((m) => ({
          tipo: m.tipo as RenglonDesglose["tipo"],
          descripcion: m.descripcion,
          unidad: m.unidad,
          cantidad: Number(m.cantidad),
          precio: Number(m.precio_unitario),
        }));
      if (renglones.length === 0) continue;

      const errorDesglose = await aplicarDesglose(
        supabase,
        item.id,
        item.rubro_id,
        renglones
      );
      if (errorDesglose) volver(destino, errorDesglose);
    }
  }

  if (rubrosAMarcar.size > 0) {
    const { error } = await supabase
      .from("rubros")
      .update({ activo: true })
      .in("id", [...rubrosAMarcar]);
    if (error) volver(destino, error.message);
  }

  revalidatePath("/", "layout");
  redirect(base(slug));
}

/** Una tarea que no está en el catálogo, sólo para esta obra. */
export async function agregarTareaPropia(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const unidad = String(formData.get("unidad") ?? "").trim() || "u";
  const destino = `${base(slug)}/tareas`;

  if (!rubroId) volver(destino, "Elegí el rubro de la tarea.");
  if (!nombre) volver(destino, "Poné el nombre de la tarea.");

  const supabase = await createClient();

  const { error } = await supabase.from("computo_items").insert({
    obra_id: obraId,
    rubro_id: rubroId,
    nombre,
    unidad,
    orden: 999,
  });

  if (error) volver(destino, error.message);

  await supabase.from("rubros").update({ activo: true }).eq("id", rubroId);

  revalidatePath("/", "layout");
  redirect(destino);
}

/**
 * Guarda cantidades y precios de la planilla, todo de una vez.
 *
 * Los campos llegan como `cantidad:<id>`, `pm:<id>` (materiales) y
 * `pmo:<id>` (mano de obra) y `pint:<id>` (integrado). Se actualizan sólo las filas que cambiaron.
 */
export async function guardarPlanilla(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const mes = String(formData.get("mes_precios") ?? "");

  const supabase = await createClient();

  if (/^\d{4}-\d{2}$/.test(mes)) {
    const { error } = await supabase
      .from("computos")
      .update({ mes_precios: `${mes}-01` })
      .eq("obra_id", obraId);
    if (error) volver(base(slug), error.message);
  }

  const { data: actuales } = await supabase
    .from("computo_items")
    .select("id, nombre, unidad, cantidad, precio_materiales, precio_mano_obra, precio_integrado")
    .eq("obra_id", obraId);

  const numero = (clave: string, previo: number) => {
    const valor = formData.get(clave);
    if (valor === null || String(valor).trim() === "") return previo;
    const n = Number(String(valor).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : previo;
  };

  for (const item of actuales ?? []) {
    const texto = (clave: string, previo: string) => {
      const valor = String(formData.get(clave) ?? "").trim();
      return valor === "" ? previo : valor;
    };
    const nombre = texto(`nombre:${item.id}`, item.nombre);
    const unidad = texto(`unidad:${item.id}`, item.unidad);
    const cantidad = numero(`cantidad:${item.id}`, Number(item.cantidad));
    const pm = numero(`pm:${item.id}`, Number(item.precio_materiales));
    const pmo = numero(`pmo:${item.id}`, Number(item.precio_mano_obra));
    const pint = numero(`pint:${item.id}`, Number(item.precio_integrado));

    if (
      nombre === item.nombre &&
      unidad === item.unidad &&
      cantidad === Number(item.cantidad) &&
      pm === Number(item.precio_materiales) &&
      pmo === Number(item.precio_mano_obra) &&
      pint === Number(item.precio_integrado)
    ) {
      continue;
    }

    const { error } = await supabase
      .from("computo_items")
      .update({
        nombre,
        unidad,
        cantidad,
        precio_materiales: pm,
        precio_mano_obra: pmo,
        precio_integrado: pint,
      })
      .eq("id", item.id);

    if (error) volver(base(slug), error.message);
  }

  revalidatePath(base(slug));
  redirect(`${base(slug)}?guardado=1`);
}

/** Carga o corrige el índice de un mes. */
export async function guardarIndiceCac(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const mes = String(formData.get("mes") ?? "");
  const valor = Number(formData.get("valor") ?? 0);
  const destino = `${base(slug)}/cac`;

  if (!/^\d{4}-\d{2}$/.test(mes)) volver(destino, "Elegí el mes del índice.");
  if (!Number.isFinite(valor) || valor <= 0) {
    volver(destino, "El índice tiene que ser mayor a cero.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("indices_cac")
    .upsert({ mes: `${mes}-01`, valor }, { onConflict: "mes" });

  if (error) volver(destino, error.message);

  revalidatePath("/", "layout");
  redirect(destino);
}

export async function eliminarIndiceCac(mes: string, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const destino = `${base(slug)}/cac`;
  const supabase = await createClient();

  const { error } = await supabase.from("indices_cac").delete().eq("mes", mes);
  if (error) volver(destino, error.message);

  revalidatePath("/", "layout");
  redirect(destino);
}

function leerRenglones(formData: FormData): RenglonDesglose[] | null {
  try {
    const crudo = JSON.parse(String(formData.get("renglones") ?? "[]"));
    return (Array.isArray(crudo) ? crudo : [])
      .map((r) => ({
        tipo: TIPOS_DESGLOSE.includes(r.tipo) ? r.tipo : "Materiales",
        descripcion: String(r.descripcion ?? "").trim(),
        unidad: String(r.unidad ?? "").trim() || "u",
        cantidad: Math.max(Number(r.cantidad) || 0, 0),
        precio: Math.max(Number(r.precio) || 0, 0),
      }))
      // Un renglón sin nombre es uno que se agregó y no se usó.
      .filter((r) => r.descripcion !== "");
  } catch {
    return null;
  }
}

/**
 * Guarda el desglose de una tarea de la obra y rehace sus precios.
 *
 * Los renglones llegan juntos como JSON en `renglones`: son una lista que se
 * edita entera, y se reemplaza entera, igual que los items de un presupuesto.
 * Con `como_modelo` además queda como desglose de modelo de la tarea en el
 * catálogo, y lo reciben las obras que la tilden de acá en adelante.
 */
export async function guardarDesglose(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const comoModelo = formData.get("como_modelo") === "1";
  const destino = `${base(slug)}/item/${itemId}`;

  const renglones = leerRenglones(formData);
  if (!renglones) volver(destino, "No se pudo leer el desglose.");

  const supabase = await createClient();

  const { data: item } = await supabase
    .from("computo_items")
    .select("id, rubro_id, tarea_id")
    .eq("id", itemId)
    .maybeSingle();

  if (!item) volver(base(slug), "La tarea ya no está en el cómputo.");

  const error = await aplicarDesglose(supabase, item!.id, item!.rubro_id, renglones!);
  if (error) volver(destino, error);

  if (comoModelo && item!.tarea_id) {
    const { error: errorBorrado } = await supabase
      .from("tarea_desglose")
      .delete()
      .eq("tarea_id", item!.tarea_id);
    if (errorBorrado) volver(destino, errorBorrado.message);

    if (renglones!.length > 0) {
      const { error: errorModelo } = await supabase.from("tarea_desglose").insert(
        renglones!.map((r, orden) => ({
          tarea_id: item!.tarea_id!,
          tipo: r.tipo,
          descripcion: r.descripcion,
          unidad: r.unidad,
          cantidad: r.cantidad,
          precio_unitario: r.precio,
          orden,
        }))
      );
      if (errorModelo) volver(destino, errorModelo.message);
    }
  }

  revalidatePath(base(slug));
  redirect(`${base(slug)}?guardado=1`);
}

/**
 * Corrige el nombre y la unidad de una tarea del cómputo, sola.
 *
 * Es lo que hace el "Confirmar" del lápiz en la planilla: se guarda esa fila
 * sin mandar el resto de la planilla, que puede tener cantidades a medio
 * cargar. Devuelve el error en vez de redirigir, porque la llama la pantalla
 * directo y sigue en el mismo lugar.
 */
export async function editarTareaDelComputo(
  itemId: string,
  nombre: string,
  unidad: string
): Promise<{ error?: string }> {
  const n = nombre.trim();
  const u = unidad.trim();

  if (!n) return { error: "La tarea necesita un nombre." };
  if (!u) return { error: "Elegí la unidad de la tarea." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("computo_items")
    .update({ nombre: n, unidad: u })
    .eq("id", itemId);

  if (error) return { error: error.message };

  revalidatePath("/obras", "layout");
  return {};
}

// ====================== Acciones directas de la planilla =====================
// Las llama la pantalla del cómputo sin formulario —tildar una tarea en el
// catálogo, el tacho de una fila, guardar un desglose desplegado— y siguen en
// el mismo lugar: devuelven el error en vez de redirigir, y la pantalla se
// refresca sola. Así no se pierde lo que se está cargando en otras filas.

type Resultado = { error?: string };

function revalidarComputo() {
  revalidatePath("/obras", "layout");
}

/** Tilda o destilda una tarea del catálogo en la obra. */
export async function alternarTarea(
  obraId: string,
  tareaId: string,
  incluir: boolean
): Promise<Resultado> {
  const supabase = await createClient();

  if (!incluir) {
    const { error } = await supabase
      .from("computo_items")
      .delete()
      .eq("obra_id", obraId)
      .eq("tarea_id", tareaId);
    if (error) return { error: error.message };
    revalidarComputo();
    return {};
  }

  const { data: ya } = await supabase
    .from("computo_items")
    .select("id")
    .eq("obra_id", obraId)
    .eq("tarea_id", tareaId)
    .maybeSingle();
  if (ya) return {};

  const [{ data: tarea }, { data: rubros }, { data: modelo }] = await Promise.all([
    supabase
      .from("tareas")
      .select("id, rubro, subrubro, nombre, unidad, orden")
      .eq("id", tareaId)
      .maybeSingle(),
    supabase.from("rubros").select("id, nombre, activo").eq("obra_id", obraId),
    supabase
      .from("tarea_desglose")
      .select("tipo, descripcion, unidad, cantidad, precio_unitario, orden")
      .eq("tarea_id", tareaId)
      .order("orden"),
  ]);

  if (!tarea) return { error: "La tarea ya no está en el catálogo." };

  const porNombre = new Map(
    (rubros ?? []).map((r) => [r.nombre.toLowerCase(), { id: r.id, activo: r.activo }])
  );

  let rubro: { id: string; activo: boolean };
  try {
    rubro = await rubroDeObra(supabase, obraId, porNombre, tarea.rubro);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo agregar." };
  }

  const { data: item, error } = await supabase
    .from("computo_items")
    .insert({
      obra_id: obraId,
      rubro_id: rubro.id,
      tarea_id: tarea.id,
      subrubro: tarea.subrubro,
      nombre: tarea.nombre,
      unidad: tarea.unidad,
      cantidad: 0,
      orden: tarea.orden,
    })
    .select("id")
    .single();
  if (error || !item) return { error: error?.message ?? "No se pudo agregar." };

  const renglones = (modelo ?? []).map((m) => ({
    tipo: m.tipo as RenglonDesglose["tipo"],
    descripcion: m.descripcion,
    unidad: m.unidad,
    cantidad: Number(m.cantidad),
    precio: Number(m.precio_unitario),
  }));
  if (renglones.length > 0) {
    const errorDesglose = await aplicarDesglose(supabase, item.id, rubro.id, renglones);
    if (errorDesglose) return { error: errorDesglose };
  }

  if (!rubro.activo) {
    await supabase.from("rubros").update({ activo: true }).eq("id", rubro.id);
  }

  revalidarComputo();
  return {};
}

/** Una tarea que no está en el catálogo, sólo para esta obra. */
export async function crearTareaPropia(
  obraId: string,
  rubroId: string,
  nombre: string,
  unidad: string
): Promise<Resultado> {
  const n = nombre.trim();
  if (!rubroId) return { error: "Elegí el rubro de la tarea." };
  if (!n) return { error: "Poné el nombre de la tarea." };

  const supabase = await createClient();

  const { error } = await supabase.from("computo_items").insert({
    obra_id: obraId,
    rubro_id: rubroId,
    nombre: n,
    unidad: unidad.trim() || "gl",
    orden: 999,
  });
  if (error) return { error: error.message };

  await supabase.from("rubros").update({ activo: true }).eq("id", rubroId);

  revalidarComputo();
  return {};
}

/** El tacho de una fila: saca la tarea del cómputo, con su desglose. */
export async function quitarItem(itemId: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("computo_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  revalidarComputo();
  return {};
}

export type RenglonParaGuardar = {
  tipo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio: number;
};

/**
 * Guarda el desglose desplegado de una fila. Con `comoModelo` además queda
 * como modelo de la tarea en el catálogo, para las obras que la tilden
 * después.
 */
export async function guardarDesgloseDe(
  itemId: string,
  crudos: RenglonParaGuardar[],
  comoModelo: boolean
): Promise<Resultado> {
  const renglones: RenglonDesglose[] = crudos
    .map((r) => ({
      tipo: (TIPOS_DESGLOSE as readonly string[]).includes(r.tipo)
        ? (r.tipo as RenglonDesglose["tipo"])
        : "Materiales",
      descripcion: String(r.descripcion ?? "").trim(),
      unidad: String(r.unidad ?? "").trim() || "u",
      cantidad: Math.max(Number(r.cantidad) || 0, 0),
      precio: Math.max(Number(r.precio) || 0, 0),
    }))
    .filter((r) => r.descripcion !== "");

  const supabase = await createClient();

  const { data: item } = await supabase
    .from("computo_items")
    .select("id, rubro_id, tarea_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { error: "La tarea ya no está en el cómputo." };

  const error = await aplicarDesglose(supabase, item.id, item.rubro_id, renglones);
  if (error) return { error };

  if (comoModelo && item.tarea_id) {
    const { error: errorBorrado } = await supabase
      .from("tarea_desglose")
      .delete()
      .eq("tarea_id", item.tarea_id);
    if (errorBorrado) return { error: errorBorrado.message };

    if (renglones.length > 0) {
      const { error: errorModelo } = await supabase.from("tarea_desglose").insert(
        renglones.map((r, orden) => ({
          tarea_id: item.tarea_id!,
          tipo: r.tipo,
          descripcion: r.descripcion,
          unidad: r.unidad,
          cantidad: r.cantidad,
          precio_unitario: r.precio,
          orden,
        }))
      );
      if (errorModelo) return { error: errorModelo.message };
    }
  }

  revalidarComputo();
  return {};
}
