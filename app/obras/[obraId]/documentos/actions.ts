"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type Ambito, esAmbito, mismaLinea, usaRubro } from "@/lib/ambitos";
import { getDocumentosBreves, resolverLinea } from "@/lib/documentos";
import { eliminarArchivo, subirArchivo } from "@/lib/drive";
import { createClient } from "@/lib/supabase/server";

export async function subirDocumento(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const ambito = String(formData.get("ambito") ?? "").trim();
  const rubroId = String(formData.get("rubro_id") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const estado = String(formData.get("estado") ?? "Vigente");
  const fecha = String(formData.get("fecha") ?? "").trim();
  // De qué documento se precargó el formulario. No define nada: sirve para
  // volver a él si la carga rebota con un error.
  const origen = String(formData.get("origen") ?? "").trim();

  const archivos = formData
    .getAll("archivos")
    .filter((a): a is File => a instanceof File && a.size > 0);

  const volver = (mensaje: string): never => {
    const query = new URLSearchParams({ error: mensaje });
    if (origen) query.set("reemplaza", origen);
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

  if (!nombre) {
    volver(
      "Poné el nombre del documento: es lo que lo distingue dentro del rubro (Banquinas, Replanteo...)."
    );
    return;
  }

  if (archivos.length === 0) {
    volver("Seleccioná al menos un archivo.");
    return;
  }

  // La versión y a qué documento desplaza salen de lo ya cargado: si en este
  // rubro ya hay un "Banquinas", esto es su versión siguiente. El nombre que
  // traiga el archivo no cuenta: el DWG puede venir numerado por quien lo
  // dibuja y eso es otra cosa que las veces que se mandó a la obra.
  const { version, vigente } = await resolverLinea(obraId, {
    ambito,
    rubroId: llevaRubro ? rubroId : null,
    titulo: llevaRubro ? null : titulo,
    nombre,
  });

  // Sólo desplaza a la anterior si entra vigente. Una versión en revisión
  // todavía no es la que hay que usar en obra, así que la de antes sigue siendo
  // la buena hasta que se apruebe.
  const reemplazaA = estado === "Vigente" ? vigente?.id ?? null : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user?.id ?? "")
    .maybeSingle();

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
      reemplaza_a: reemplazaA,
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
    // los archivos que alcanzaron a subir, y la versión anterior vuelve a ser
    // la vigente, deshaciendo lo que hizo el trigger.
    await supabase.from("documentos").delete().eq("id", documento.id);
    await Promise.all(subidos.map((id) => eliminarArchivo(id).catch(() => {})));

    if (reemplazaA) {
      await supabase
        .from("documentos")
        .update({ estado: "Vigente" })
        .eq("id", reemplazaA);
    }

    volver(`No se pudo subir el archivo: ${e instanceof Error ? e.message : "error"}`);
    return;
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/documentos`);
}

/**
 * Corrige un documento ya cargado: dónde está archivado, cómo se llama, qué
 * versión es. A diferencia de la carga, acá la versión se escribe a mano: es la
 * pantalla para arreglar errores, incluido un número mal puesto.
 */
export async function actualizarDocumento(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const obraId = String(formData.get("obra_id") ?? "");
  const id = String(formData.get("documento_id") ?? "");
  const ambito = String(formData.get("ambito") ?? "").trim();
  const rubroId = String(formData.get("rubro_id") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const estado = String(formData.get("estado") ?? "Vigente");
  const fecha = String(formData.get("fecha") ?? "").trim();

  const nuevos = formData
    .getAll("archivos")
    .filter((a): a is File => a instanceof File && a.size > 0);

  const volver = (mensaje: string): never =>
    redirect(
      `/obras/${slug}/documentos/${id}/editar?error=${encodeURIComponent(mensaje)}`
    );

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
    volver("Poné un título para la documentación administrativa.");
    return;
  }

  if (!nombre) {
    volver("Poné el nombre del documento.");
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("documentos")
    .update({
      ambito,
      rubro_id: llevaRubro ? rubroId : null,
      titulo: llevaRubro ? null : titulo,
      nombre,
      version: version || null,
      estado,
      ...(fecha === "" ? {} : { fecha }),
    })
    .eq("id", id)
    .eq("obra_id", obraId);

  if (error) {
    volver(error.message);
    return;
  }

  // Si queda vigente, las otras versiones de la línea dejan de estarlo. Dos
  // planos vigentes con el mismo nombre es exactamente lo que hay que evitar.
  if (estado === "Vigente") {
    const linea = {
      ambito,
      rubroId: llevaRubro ? rubroId : null,
      titulo: llevaRubro ? null : titulo,
      nombre,
    };

    const hermanos = (await getDocumentosBreves(obraId)).filter(
      (d) =>
        d.id !== id &&
        d.estado === "Vigente" &&
        mismaLinea(linea, {
          ambito: d.ambito,
          rubroId: d.rubroId,
          titulo: d.titulo,
          nombre: d.nombre,
        })
    );

    if (hermanos.length > 0) {
      await supabase
        .from("documentos")
        .update({ estado: "Obsoleto" })
        .in(
          "id",
          hermanos.map((d) => d.id)
        );
    }
  }

  // Los archivos que se agreguen se suman a los que ya tenía.
  for (const archivo of nuevos) {
    const subida = await subirArchivo({
      archivo,
      nombre: archivo.name,
      obraSlug: slug,
      tipo: "documentos",
    }).catch(() => null);

    if (!subida) {
      volver(`No se pudo subir ${archivo.name}. Los otros cambios sí se guardaron.`);
      return;
    }

    await supabase.from("documento_archivos").insert({
      documento_id: id,
      drive_file_id: subida.id,
      nombre: archivo.name,
      tipo: archivo.name.split(".").pop()?.toUpperCase() ?? null,
      mime_type: subida.mimeType,
      tamano: subida.tamano,
    });
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/documentos`);
}

/** Saca un archivo de un documento sin tocar el resto de la ficha. */
export async function eliminarArchivoDeDocumento(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const documentoId = String(formData.get("documento_id") ?? "");
  const archivoId = String(formData.get("archivo_id") ?? "");

  const supabase = await createClient();

  const { data: archivo } = await supabase
    .from("documento_archivos")
    .select("drive_file_id")
    .eq("id", archivoId)
    .eq("documento_id", documentoId)
    .maybeSingle();

  const { error } = await supabase
    .from("documento_archivos")
    .delete()
    .eq("id", archivoId)
    .eq("documento_id", documentoId);

  if (error) {
    redirect(
      `/obras/${slug}/documentos/${documentoId}/editar?error=${encodeURIComponent(error.message)}`
    );
  }

  if (archivo?.drive_file_id) {
    await eliminarArchivo(archivo.drive_file_id).catch(() => {});
  }

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/documentos/${documentoId}/editar`);
}

export async function eliminarDocumento(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("documento_id") ?? "");

  const supabase = await createClient();

  // Se lee todo antes de borrar: el delete se lleva los archivos en cascada y
  // después no habría de dónde sacar los ids de Drive ni a qué línea pertenecía.
  const [{ data: archivos }, { data: doc }] = await Promise.all([
    supabase
      .from("documento_archivos")
      .select("drive_file_id")
      .eq("documento_id", id),
    supabase
      .from("documentos")
      .select("obra_id, ambito, rubro_id, titulo, nombre, estado")
      .eq("id", id)
      .maybeSingle(),
  ]);

  const hermanos =
    doc && doc.estado === "Vigente" && esAmbito(doc.ambito)
      ? (await getDocumentosBreves(doc.obra_id)).filter(
          (d) =>
            d.id !== id &&
            mismaLinea(
              {
                ambito: doc.ambito as Ambito,
                rubroId: doc.rubro_id,
                titulo: doc.titulo,
                nombre: doc.nombre,
              },
              {
                ambito: d.ambito,
                rubroId: d.rubroId,
                titulo: d.titulo,
                nombre: d.nombre,
              }
            )
        )
      : [];

  const { error } = await supabase.from("documentos").delete().eq("id", id);

  if (error) {
    redirect(`/obras/${slug}/documentos?error=${encodeURIComponent(error.message)}`);
  }

  // Si se borró la vigente y la línea tiene versiones anteriores, la más alta
  // vuelve a ser la vigente: si no, el rubro queda sin plano actual y la lista
  // no muestra nada.
  const heredera = hermanos.sort(
    (a, b) => numeroDeVersion(b.version) - numeroDeVersion(a.version)
  )[0];

  if (heredera) {
    await supabase
      .from("documentos")
      .update({ estado: "Vigente" })
      .eq("id", heredera.id);
  }

  await Promise.all(
    (archivos ?? []).map((a) => eliminarArchivo(a.drive_file_id).catch(() => {}))
  );

  revalidatePath("/", "layout");
  redirect(`/obras/${slug}/documentos`);
}

function numeroDeVersion(version: string | null): number {
  return Number(version?.match(/(\d+)/)?.[1] ?? 0);
}
