/**
 * Autorización de una única vez contra el Drive de la aplicación.
 *
 * Qué hace: abre el navegador para que inicies sesión con la cuenta de Gmail
 * de la app, y a cambio imprime un "refresh token" que la aplicación usa desde
 * ahí en adelante para subir y bajar archivos sin volver a pedir permiso.
 *
 * Cómo se corre:   node scripts/autorizar-drive.mjs
 *
 * Antes necesitás tener en .env.local:
 *   GOOGLE_DRIVE_CLIENT_ID
 *   GOOGLE_DRIVE_CLIENT_SECRET
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const PUERTO = 53682;
const REDIRECT_URI = `http://localhost:${PUERTO}`;

// Sólo los archivos que crea la app. No da acceso al resto del Drive.
const SCOPE = "https://www.googleapis.com/auth/drive.file";

const env = leerEnvLocal();
const clientId = env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "\nFaltan GOOGLE_DRIVE_CLIENT_ID y/o GOOGLE_DRIVE_CLIENT_SECRET en .env.local.\n"
  );
  process.exit(1);
}

const url =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    // access_type=offline + prompt=consent es lo que hace que Google devuelva
    // un refresh token. Sin esto sólo manda un token que dura una hora.
    access_type: "offline",
    prompt: "consent",
  });

const server = createServer(async (req, res) => {
  const code = new URL(req.url, REDIRECT_URI).searchParams.get("code");

  if (!code) {
    res.writeHead(400).end("Falta el parámetro code.");
    return;
  }

  try {
    const respuesta = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const datos = await respuesta.json();

    if (!datos.refresh_token) {
      res.writeHead(500).end("Google no devolvió refresh token. Mirá la consola.");
      console.error("\nRespuesta de Google:", datos);
      console.error(
        "\nSi dice invalid_grant o no vino refresh_token, revocá el acceso en\n" +
          "https://myaccount.google.com/permissions y volvé a correr el script.\n"
      );
      server.close();
      process.exit(1);
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(
      "<h2>Listo.</h2><p>Ya podés cerrar esta pestaña y volver a la terminal.</p>"
    );

    console.log("\n" + "=".repeat(70));
    console.log("Pegá esta línea en .env.local:\n");
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${datos.refresh_token}`);
    console.log("\n" + "=".repeat(70));
    console.log("\nOJO: es una credencial. No la compartas ni la subas a git.\n");

    server.close();
    process.exit(0);
  } catch (error) {
    res.writeHead(500).end("Error al canjear el código.");
    console.error(error);
    server.close();
    process.exit(1);
  }
});

server.listen(PUERTO, () => {
  console.log("\nAbriendo el navegador para autorizar...");
  console.log("Si no se abre solo, entrá a esta dirección:\n");
  console.log(url + "\n");
  abrirNavegador(url);
});

function leerEnvLocal() {
  try {
    const contenido = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const env = {};

    for (const linea of contenido.split("\n")) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#")) continue;

      const corte = limpia.indexOf("=");
      if (corte === -1) continue;

      env[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim();
    }

    return env;
  } catch {
    console.error("\nNo se pudo leer .env.local.\n");
    process.exit(1);
  }
}

function abrirNavegador(destino) {
  const comando =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", destino]]
      : process.platform === "darwin"
        ? ["open", [destino]]
        : ["xdg-open", [destino]];

  spawn(comando[0], comando[1], { stdio: "ignore", detached: true }).unref();
}
