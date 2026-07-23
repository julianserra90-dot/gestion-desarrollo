import { readFileSync } from "node:fs";

// Carga .env.local en process.env (Node puro no lo hace solo).
for (const linea of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const t = linea.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const { probarConexion } = await import("../lib/drive.ts");

try {
  const r = await probarConexion();
  console.log("CONEXION OK — carpeta raiz creada en Drive, id:", r.carpetaRaiz);
} catch (e) {
  console.error("FALLO:", e.message);
  process.exit(1);
}
