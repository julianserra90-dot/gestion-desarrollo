import { readFileSync } from "node:fs";

for (const linea of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const t = linea.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const { subirArchivo, descargarArchivo, eliminarArchivo } = await import("../lib/drive.ts");

// PNG rojo de 1x1 — sirve para probar el round-trip sin depender de un archivo.
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const bytes = Buffer.from(pngBase64, "base64");
const blob = new Blob([bytes], { type: "image/png" });

console.log("Subiendo imagen de prueba a Drive...");
const subida = await subirArchivo({
  archivo: blob,
  nombre: "prueba-round-trip.png",
  obraSlug: "prueba-tecnica",
  tipo: "fotos",
});
console.log("  Subida OK. id:", subida.id, "| tamaño:", subida.tamano, "bytes");

console.log("Descargando el mismo archivo...");
const respuesta = await descargarArchivo(subida.id);
const descargado = Buffer.from(await respuesta.arrayBuffer());
const coincide = descargado.equals(bytes);
console.log("  Descarga OK. Bytes idénticos al original:", coincide);

console.log("Borrando la imagen de prueba...");
await eliminarArchivo(subida.id);
console.log("  Borrada.");

console.log(coincide ? "\nROUND-TRIP OK" : "\nFALLO: el archivo bajó distinto");
process.exit(coincide ? 0 : 1);
