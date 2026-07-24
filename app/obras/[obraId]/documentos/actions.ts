"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { esAmbito, usaRubro } from "@/lib/ambitos";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

export async function subirDocumento(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const ambito = String(formData.get("ambito") ?? "").trim();
  const rubroId = String(formData.get("rubro_id") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const nombreManual = String(formData.get("nombre") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim() || "V01";
  const estado = String(formData.get("estado") ?? "Vigente");
  const fecha = String(formData.get("fecha") ?? "").trim();
  const reemplazaA = String(formData.get("reemplaza_a") ?? "").trim();

  const archivos = formData
    .getAll("archivos")
    .filter((a): a is File => a instanceof File && a.size > 0);

  const volver = (mensaje: string): never => {
    const query = new URLSearchParams({ error: mensaje });
    if (reemplazaA) query.set("reemplaza", reemplazaA);
    redirect(`/obras/${slug}/documentos/nuevo?${query}`);
  };

  // ---- Validación antes de subir nada -------------------------------------
  //
  // Se valida primero a propósito: un DWG puede pesar, y no tiene sentido
  // mandarlo a Drive para después rebotar por un campo vacío.

  if (!esAmbito(ambito)) {
    volver("Elegí si es documentación de obra, de proyecto o administrativa.");
    return;
  }

  const llevaRubro = usaRubro(ambito);

  if (llevaRubro && !rubroId) {
    volver(`La documentación de ${ambito.toLowerCase()} se archiva por rubro: elegí uno.`);
    return;
  }

  if (!llevaRubro && !titulo) {
    volver("Poné un título para la documentación administrativa (aviso de obra, plano municipal...).");
    return;
  }

  if (archivos.length === 0) {
    volver("Seleccioná al menos un archivo.");
    return;
  }

  // El nombre visible: el que puso el usuario, o el del primer archivo sin
  // extensión, que con varios adjuntos es el que da la referencia.
  const nombre = nombreManual || archivos[0].name.replace(/\.[^.]+$/, "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  // Si es una versión nueva se recuerda cómo estaba la anterior: al insertar,
  // el trigger la pasa a Obsoleto, y si después falla la subida hay que poder
  // dejarla como estaba.
  let estadoAnterior: string | null = null;

  if (reemplazaA) {
    const { data: previo } = await supabase
      .from("documentos")
      .select("estado")
      .eq("id", reemplazaA)
      .maybeSingle();

    estadoAnterior = previo?.estado ?? null;
  }

  const { data: documento, error } = await supabase
    .from("documentos")
    .insert({
      obra_id: obraId,
      nombre,
      ambito,
      rubro_id: llevaRubro ? rubroId : null,
      titulo: llevaRubro ? null : titulo,
      version,
      estado,
      fecha: fecha === "" ? undefined : fecha,
      reemplaza_a: reemplazaA === "" ? null : reemplazaA,
      subido_por: user?.id ?? null,
      subido_por_nombre: perfil?.nombre ?? null,
    })
    .select("id")
    .single();

  if (error || !documento) {
    volver(error?.message ?? "No se pudo guardar el documento.");
    return;
  }

  // ---- Recién ahora los archivos ------------------------------------------

  const subidos: string[] = [];

  try {
    for (const archivo of archivos) {
      const subida = await subirArchivo({
        archivo,
        nombre: archivo.name,
        obraSlug: slug,
        tipo: "documentos",
      });

      subidos.push(subida.id);

      const { error: errorArchivo } = await supabase
        .from("documento_archivos")
        .insert({
          documento_id: documento.id,
          drive_file_id: subida.id,
          nombre: archivo.name,
          // El formato sale de la extensión: PDF, DWG, XLS.
          tipo: archivo.name.split(".").pop()?.toUpperCase() ?? null,
          mime_type: subida.mimeType,
          tamano: subida.tamano,
        });

      if (errorArchivo) throw new Error(errorArchivo.message);
    }
  } catch (e) {
    // Si algo falla a mitad no queda un documento a medias: se borra la ficha,
    // los archivos que alcanzaron a subir, y la versión anterior vuelve al
    // estado que tenía antes de que el trigger la obsoletara.
    await supabase.from("documentos").delete().eq("id", documento.id);
    await Promise.all(subidos.map((id) => eliminarArchivo(id).catch(() => {})));

    if (reemplazaA && estadoAnterior) {
      await supabase
        .from("documentos")
        .update({ estado: estadoAnterior })
        .eq("id", reemplazaA);
    }

    volver(`No se pudo subir el archivo: ${e instanceof Error ? e.message : "error"}`);
    return;
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/documentos`);
}

export async function eliminarDocumento(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("documento_id") ?? "");

  const supabase = await createClient();

  // Los archivos se leen antes: el delete de la ficha se los lleva en cascada
  // y después no habría de dónde sacar los ids de Drive.
  const { data: archivos } = await supabase
    .from("documento_archivos")
    .select("drive_file_id")
    .eq("documento_id", id);

  const { error } = await supabase.from("documentos").delete().eq("id", id);

  if (error) {
    redirect(`/obras/${slug}/documentos?error=${encodeURIComponent(error.message)}`);
  }

  await Promise.all(
    (archivos ?? []).map((a) => eliminarArchivo(a.drive_file_id).catch(() => {}))
  );

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/documentos`);
}
