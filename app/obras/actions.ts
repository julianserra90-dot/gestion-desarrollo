"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Socio = { empresa_id: string; porcentaje: number };

/**
 * Los porcentajes se comparan contra 100 con tolerancia, porque repartir entre
 * 3 empresas da 33,33 + 33,33 + 33,34 y sumas así no dan exactamente 100 en
 * punto flotante.
 */
const TOLERANCIA = 0.05;

export async function crearObra(formData: FormData) {
  const datos = leerDatosObra(formData);
  const socios = leerSocios(formData);

  const errorValidacion = validar(datos.nombre, socios);
  if (errorValidacion) {
    volverCon("/obras/nueva", errorValidacion);
  }

  const supabase = await createClient();
  const slug = await generarSlug(datos.nombre);

  const { data: obra, error } = await supabase
    .from("obras")
    .insert({ ...datos, slug })
    .select("id, slug")
    .single();

  if (error || !obra) {
    volverCon("/obras/nueva", error?.message ?? "No se pudo crear la obra.");
    return;
  }

  const { error: errorSocios } = await supabase.rpc("set_obra_socios", {
    p_obra: obra.id,
    p_socios: socios,
  });

  if (errorSocios) {
    // La obra quedó creada pero sin socias: se avisa y se manda a editarla,
    // en vez de dejar el error mudo.
    volverCon(
      `/obras/${obra.slug}/editar`,
      `La obra se creó pero no se pudieron guardar las socias: ${errorSocios.message}`
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${obra.slug}`);
}

export async function actualizarObra(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const datos = leerDatosObra(formData);
  const socios = leerSocios(formData);

  const errorValidacion = validar(datos.nombre, socios);
  if (errorValidacion) {
    volverCon(`/obras/${slug}/editar`, errorValidacion);
  }

  const supabase = await createClient();

  const { error } = await supabase.from("obras").update(datos).eq("id", obraId);

  if (error) {
    volverCon(`/obras/${slug}/editar`, error.message);
  }

  const { error: errorSocios } = await supabase.rpc("set_obra_socios", {
    p_obra: obraId,
    p_socios: socios,
  });

  if (errorSocios) {
    volverCon(`/obras/${slug}/editar`, errorSocios.message);
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}`);
}

export async function archivarObra(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("obras")
    .update({ archivada_en: new Date().toISOString() })
    .eq("id", obraId);

  if (error) {
    volverCon(`/obras/${formData.get("slug")}/editar`, error.message);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function desarchivarObra(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");

  const supabase = await createClient();
  await supabase.from("obras").update({ archivada_en: null }).eq("id", obraId);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function eliminarObra(formData: FormData) {
  const obraId = String(formData.get("obra_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const supabase = await createClient();

  // Los socios no bloquean el borrado, pero hay que sacarlos primero porque
  // apuntan a la obra. El trigger de la base es el que decide si se puede.
  await supabase.from("obra_socios").delete().eq("obra_id", obraId);

  const { error } = await supabase.from("obras").delete().eq("id", obraId);

  if (error) {
    volverCon(`/obras/${slug}/editar`, error.message);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

// ============================== helpers =====================================

function leerDatosObra(formData: FormData) {
  const texto = (campo: string) => {
    const valor = String(formData.get(campo) ?? "").trim();
    return valor === "" ? null : valor;
  };

  const presupuesto = String(formData.get("presupuesto") ?? "").trim();

  return {
    nombre: String(formData.get("nombre") ?? "").trim(),
    ubicacion: texto("ubicacion"),
    estado: String(formData.get("estado") ?? "Proyecto"),
    fecha_inicio: texto("fecha_inicio"),
    fecha_fin_estimada: texto("fecha_fin_estimada"),
    presupuesto: presupuesto === "" ? null : Number(presupuesto),
  };
}

function leerSocios(formData: FormData): Socio[] {
  const empresas = formData.getAll("socio_empresa_id").map(String);
  const porcentajes = formData.getAll("socio_porcentaje").map(String);

  return empresas
    .map((empresa_id, i) => ({
      empresa_id,
      porcentaje: Number(porcentajes[i] ?? 0),
    }))
    .filter((socio) => socio.empresa_id !== "");
}

function validar(nombre: string, socios: Socio[]) {
  if (!nombre) {
    return "La obra necesita un nombre.";
  }

  if (socios.length === 0) {
    return "La obra necesita al menos una empresa socia.";
  }

  const ids = new Set(socios.map((s) => s.empresa_id));
  if (ids.size !== socios.length) {
    return "Hay una empresa repetida en la lista de socias.";
  }

  if (socios.some((s) => !Number.isFinite(s.porcentaje) || s.porcentaje <= 0)) {
    return "Todos los porcentajes tienen que ser mayores a cero.";
  }

  const suma = socios.reduce((acc, s) => acc + s.porcentaje, 0);
  if (Math.abs(suma - 100) > TOLERANCIA) {
    return `Los porcentajes suman ${suma.toFixed(2)}%. Tienen que sumar 100%.`;
  }

  return null;
}

async function generarSlug(nombre: string) {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "obra";

  const supabase = await createClient();
  const { data } = await supabase
    .from("obras")
    .select("slug")
    .like("slug", `${base}%`);

  const usados = new Set((data ?? []).map((o) => o.slug));

  if (!usados.has(base)) return base;

  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function volverCon(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(mensaje)}`);
}
