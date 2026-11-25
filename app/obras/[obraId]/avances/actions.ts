"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { noTocoNada, sinPermisoPara } from "@/lib/permisos";
import { getTareasConAvance, rehacerCargasDelRubro } from "@/lib/avance-del-rubro";
import type { TablesInsert } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type Campos = {
  porcentaje: number;
  fechaDesde: string;
  fechaHasta: string;
  comentario: string;
};

function leerCampos(formData: FormData): Campos {
  return {
    porcentaje: Number(formData.get("porcentaje") ?? 0),
    fechaDesde: String(formData.get("fecha_desde") ?? "").trim(),
    fechaHasta: String(formData.get("fecha_hasta") ?? "").trim(),
    comentario: String(formData.get("comentario") ?? "").trim(),
  };
}

/** Devuelve el problema, o null si está todo bien. */
function validar({ porcentaje, fechaDesde, fechaHasta }: Campos): string | null {
  if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
    return "El avance del período tiene que ser mayor a 0 y hasta 100.";
  }

  if (!fechaDesde || !fechaHasta) {
    return "Poné desde y hasta qué día se hizo este avance.";
  }

  if (fechaHasta < fechaDesde) {
    return "El día de fin no puede ser anterior al de inicio.";
  }

  return null;
}

/**
 * Suma una carga al historial del rubro. El porcentaje es lo que se avanzó en
 * esos días, no el total: el acumulado lo arma la suma de las cargas.
 */
export async function cargarAvance(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const campos = leerCampos(formData);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/avances/${rubroId}?error=${encodeURIComponent(mensaje)}`
    );

  const problema = validar(campos);

  if (problema) {
    volver(problema);
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { error } = await supabase.from("avances").insert({
    obra_id: obraId,
    rubro_id: rubroId,
    porcentaje: campos.porcentaje,
    fecha_desde: campos.fechaDesde,
    fecha_hasta: campos.fechaHasta,
    comentario: campos.comentario === "" ? null : campos.comentario,
    actualizado_por: user?.id ?? null,
    actualizado_por_nombre: perfil?.nombre ?? null,
  });

  if (error) {
    volver(error.message);
    return;
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/avances/${rubroId}`);
}

export async function actualizarAvance(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const avanceId = String(formData.get("avance_id") ?? "");
  const campos = leerCampos(formData);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/avances/${rubroId}/${avanceId}/editar?error=${encodeURIComponent(mensaje)}`
    );

  const problema = validar(campos);

  if (problema) {
    volver(problema);
    return;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("avances")
    .update({
      porcentaje: campos.porcentaje,
      fecha_desde: campos.fechaDesde,
      fecha_hasta: campos.fechaHasta,
      comentario: campos.comentario === "" ? null : campos.comentario,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", avanceId)
    .eq("obra_id", obraId)
    .select("id");

  if (error) {
    volver(error.message);
    return;
  }

  if (noTocoNada(data)) {
    volver(sinPermisoPara("modificar este avance"));
    return;
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/avances/${rubroId}`);
}

export async function eliminarAvance(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const avanceId = String(formData.get("avance_id") ?? "");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("avances")
    .delete()
    .eq("id", avanceId)
    .eq("obra_id", obraId)
    .select("id");

  if (error) {
    redirect(
      `/obras/${slug}/avances/${rubroId}?error=${encodeURIComponent(error.message)}`
    );
  }

  if (noTocoNada(data)) {
    redirect(
      `/obras/${slug}/avances/${rubroId}?error=${encodeURIComponent(
        sinPermisoPara("borrar este avance")
      )}`
    );
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/avances/${rubroId}`);
}

/**
 * Carga lo hecho de cada tarea del rubro en un día: "12 m² de carpeta". Es la
 * misma lógica que marcar en el 3D (`lib/avance-del-rubro.ts`): cada tarea pesa
 * lo que cuesta en su rubro, y las cargas del rubro se rehacen con lo marcado
 * en el 3D y lo cargado acá, juntos.
 *
 * Del formulario: `fecha`, `comentario` y, por tarea, un `pct_<tarea>_<piso>`
 * por piso —el porcentaje de ese piso— o, si no tiene pisos, `cantidad_<tarea>`.
 * Los vacíos o en cero no se cargan.
 */
export async function cargarAvancePorTarea(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const desde = String(formData.get("fecha_inicio") ?? "").trim();
  const comentario = String(formData.get("comentario") ?? "").trim();

  const volver = (mensaje: string): never =>
    redirect(`/obras/${slug}/avances/${rubroId}?error=${encodeURIComponent(mensaje)}`);

  const esFecha = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f);
  if (!esFecha(fecha)) volver("Poné qué día se hizo.");
  if (desde !== "" && !esFecha(desde)) volver("La fecha de inicio no se entiende.");
  if (desde > fecha) volver("El inicio no puede ser después del fin.");
  // Desde y hasta el mismo día es en el día.
  const fechaInicio = desde !== "" && desde < fecha ? desde : null;

  const supabase = await createClient();
  // Sólo las tareas del rubro en el cómputo: lo que llega del formulario no se
  // escribe sin más.
  const tareas = await getTareasConAvance(supabase, obraId, rubroId);
  const numero = (nombre: string) => {
    const crudo = String(formData.get(nombre) ?? "").trim().replace(",", ".");
    const n = Number(crudo);
    return crudo !== "" && Number.isFinite(n) && n > 0 ? n : null;
  };
  // Con pisos, el porcentaje de cada uno —`pct_<tarea>_<piso>`— hecho
  // cantidad de ese piso. Sin pisos, la cantidad de la tarea.
  const cargas = tareas.flatMap((t): TablesInsert<"avances_de_tarea">[] => {
    if (t.pisos.length > 0) {
      return t.pisos.flatMap((p) => {
        const pct = numero(`pct_${t.tareaId}_${p.piso}`);
        if (pct === null) return [];
        const cantidad = (Math.min(pct, 100) / 100) * p.cantidad;
        return [
          {
            obra_id: obraId,
            tarea_id: t.tareaId,
            piso: p.piso,
            cantidad,
            fecha,
            fecha_inicio: fechaInicio,
            comentario: comentario || null,
          },
        ];
      });
    }
    const cantidad = numero(`cantidad_${t.tareaId}`);
    return cantidad === null
      ? []
      : [
          {
            obra_id: obraId,
            tarea_id: t.tareaId,
            piso: null,
            cantidad,
            fecha,
            fecha_inicio: fechaInicio,
            comentario: comentario || null,
          },
        ];
  });
  if (cargas.length === 0) volver("Poné cuánto se hizo de alguna tarea.");

  const { data, error } = await supabase.from("avances_de_tarea").insert(cargas).select("id");
  if (error) volver(error.message);
  if (noTocoNada(data)) volver(sinPermisoPara("cargar el avance"));

  const rehecho = await rehacerCargasDelRubro(supabase, obraId, rubroId);
  if (rehecho.error) volver(rehecho.error);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/avances/${rubroId}`);
}

/** Borra una carga por tarea y rehace las cargas del rubro. */
export async function borrarAvanceDeTarea(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const rubroId = String(formData.get("rubro_id") ?? "");
  const id = String(formData.get("id") ?? "");

  const volver = (mensaje: string): never =>
    redirect(`/obras/${slug}/avances/${rubroId}?error=${encodeURIComponent(mensaje)}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avances_de_tarea")
    .delete()
    .eq("id", id)
    .eq("obra_id", obraId)
    .select("id");
  if (error) volver(error.message);
  if (noTocoNada(data)) volver(sinPermisoPara("borrar esa carga"));

  const rehecho = await rehacerCargasDelRubro(supabase, obraId, rubroId);
  if (rehecho.error) volver(rehecho.error);

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/avances/${rubroId}`);
}
