# Gestión de desarrollo

App para seguir obras entre varias empresas socias: gastos, avances, fotos,
documentos y el saldo que queda entre las socias.

## Cómo está armado

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase** para la base de datos y el login
- **Google Drive** para los archivos (fotos, planos, comprobantes)
- **Ámbito Financiero** para la cotización del dólar

Los archivos no se guardan en la base: van a un Drive propio de la aplicación,
ordenados en `Gestión de desarrollo / <obra> / <fotos|documentos|comprobantes>`.
En la base sólo queda el id del archivo. Nadie entra al Drive directamente: la
app verifica los permisos sobre la obra antes de servir cada archivo.

## Levantarlo en otra computadora

Los datos (base y archivos) están en la nube, así que no hay nada que migrar.
Lo único que no viaja por git son las credenciales.

```bash
git clone https://github.com/julianserra90-dot/gestion-desarrollo.git
cd gestion-desarrollo
npm install
```

Después hay que crear el archivo **`.env.local`** en la raíz. No está en el
repositorio a propósito: contiene claves. Copialo desde la máquina donde ya
funciona (por un gestor de contraseñas o un pendrive, nunca por mail o chat).

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
```

De dónde sale cada una:

| Variable | Dónde conseguirla |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys (la *publishable*, no la secreta) |
| `GOOGLE_DRIVE_CLIENT_ID` | Google Cloud → Plataforma de autenticación → Clientes |
| `GOOGLE_DRIVE_CLIENT_SECRET` | El mismo cliente de Google Cloud |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Lo genera `node scripts/autorizar-drive.mjs` |

Con eso ya arranca:

```bash
npm run dev
```

## Verificar que todo esté conectado

```bash
node --experimental-strip-types scripts/probar-drive.mjs
```

Confirma que las credenciales de Drive funcionan y crea la carpeta raíz si
falta. Para probar además que se puedan subir y bajar archivos:

```bash
node --experimental-strip-types scripts/probar-subida.mjs
```

## Base de datos

El esquema está versionado en `supabase/migrations/`. Para aplicar cambios
nuevos a la base:

```bash
npx supabase db push
```

Si es una máquina nueva, primero hay que vincularla (pide la contraseña de la
base, que está en el gestor de contraseñas):

```bash
npx supabase login
npx supabase link --project-ref axhgdxvxukyueuqiomgt
```

Después de tocar el esquema, hay que regenerar los tipos de TypeScript:

```bash
npx supabase gen types typescript --linked > lib/database.types.ts
```

## Usuarios

El primero que se registra queda como administrador. Los demás se crean desde
Supabase (Authentication → Users → Add user, con *Auto Confirm User*) y aparecen
en la pantalla **Usuarios** de la app para asignarles nombre y empresa.

Un usuario de empresa ve únicamente las obras donde su empresa es socia. Eso lo
garantizan las reglas de la base (RLS), no la interfaz: aunque alguien consulte
la API directamente, no obtiene datos de otras obras.

## Antes de subir cambios

```bash
npx tsc --noEmit && npx eslint . && npm run build
```
