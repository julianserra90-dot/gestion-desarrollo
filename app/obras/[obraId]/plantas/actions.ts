"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Json } from "@/lib/database.types";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { noTocoNada, sinPermisoPara } from "@/lib/permisos";
import { leerDibujo, leerEscala } from "@/lib/planta-dibujo";
import { createClient } from "@/lib/supabase/server";

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
