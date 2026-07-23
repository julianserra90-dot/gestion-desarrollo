"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import * as ui from "@/components/ui";

type Rubro = { id: string; nombre: string };

const MAX_LADO = 1600; // px del lado más largo tras comprimir
const CALIDAD = 0.8; // calidad JPEG

/**
 * Achica una imagen en el navegador antes de subirla.
 *
 * Una foto de celular pesa ~4 MB; reescalada a 1600px y JPEG 0.8 baja a
 * ~400 KB, más que suficiente para revisar obra. Así no se llena el Drive.
 */
async function comprimir(file: File): Promise<Blob> {
  // Los que no son imagen (o un HEIC que el navegador no decodifica) se dejan
  // tal cual: mejor subir el original que perder la foto.
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CALIDAD)
    );

    // Si por algún motivo comprimir agrandó el archivo, gana el original.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export default function SubirFotosForm({
  action,
  obraId,
  slug,
  rubros,
  error,
}: {
  action: (formData: FormData) => void;
  obraId: string;
  slug: string;
  rubros: Rubro[];
  error?: string;
}) {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (archivos.length === 0) return;

    setSubiendo(true);

    const form = formRef.current!;
    const fd = new FormData(form);
    fd.delete("imagenes"); // se reemplaza por las versiones comprimidas

    for (const [i, file] of archivos.entries()) {
      const comprimida = await comprimir(file);
      const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      fd.append("imagenes", comprimida, nombre);
      void i;
    }

    action(fd);
  }

  const pesoTotal = archivos.reduce((acc, f) => acc + f.size, 0);

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="slug" value={slug} />

      {error && <p style={errorBox}>{error}</p>}

      <div style={ui.panel}>
        <div style={grid}>
          <label style={field}>
            <span style={labelCampo}>Fecha</span>
            <input type="date" name="fecha" required style={ui.input} />
          </label>

          <label style={field}>
            <span style={labelCampo}>Rubro</span>
            <select name="rubro_id" defaultValue="" style={ui.input}>
              <option value="">Sin rubro</option>
              {rubros.map((rubro) => (
                <option key={rubro.id} value={rubro.id}>
                  {rubro.nombre}
                </option>
              ))}
            </select>
          </label>

          <label style={field}>
            <span style={labelCampo}>Estado</span>
            <select name="estado" defaultValue="Registrado" style={ui.input}>
              <option value="Registrado">Registrado</option>
              <option value="Pendiente de revisión">Pendiente de revisión</option>
            </select>
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>Descripción</span>
            <input
              type="text"
              name="descripcion"
              placeholder="Ej: Colado de hormigón en fundaciones"
              style={ui.input}
            />
          </label>

          <label style={fieldAncho}>
            <span style={labelCampo}>Fotos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
              style={ui.input}
            />
          </label>
        </div>

        {archivos.length > 0 && (
          <p style={{ ...ui.note, marginTop: "16px", marginBottom: 0 }}>
            {archivos.length} {archivos.length === 1 ? "foto" : "fotos"}{" "}
            seleccionada{archivos.length === 1 ? "" : "s"} ·{" "}
            {(pesoTotal / 1024 / 1024).toFixed(1)} MB antes de comprimir. Se
            reducen automáticamente al subir.
          </p>
        )}
      </div>

      <div style={acciones}>
        <Link href={`/obras/${slug}/fotos`} style={ui.secondaryButton}>
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={subiendo || archivos.length === 0}
          style={subiendo || archivos.length === 0 ? botonInactivo : ui.button}
        >
          {subiendo ? "Subiendo..." : "Subir fotos"}
        </button>
      </div>
    </form>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "20px",
};

const field = {
  display: "grid",
  gap: "8px",
};

const fieldAncho = {
  display: "grid",
  gap: "8px",
  gridColumn: "1 / -1",
};

const labelCampo = {
  fontSize: "13px",
  color: "#555555",
};

const acciones = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};

const botonInactivo = {
  ...ui.button,
  background: "#999999",
  border: "1px solid #999999",
  cursor: "not-allowed",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};
