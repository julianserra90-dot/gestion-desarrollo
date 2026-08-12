# Gestión de desarrollo

App para seguir obras entre varias empresas socias: presupuestos, gastos,
ingresos de fondos, avances, fotos, documentos y el saldo que queda entre las
socias.

## Cómo está armado

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase** para la base de datos y el login
- **Google Drive** para los archivos (fotos, planos, comprobantes)
- **Ámbito Financiero** para la cotización del dólar

Los archivos no se guardan en la base: van a un Drive propio de la aplicación,
ordenados en `Gestión de desarrollo / <obra> / <fotos|documentos|comprobantes>`.
En la base sólo queda el id del archivo. Nadie entra al Drive directamente: la
app verifica los permisos sobre la obra antes de servir cada archivo.

## Qué hace cada solapa de una obra

| Solapa | Para qué |
| --- | --- |
| **Economía** | Balance entre socias, terreno, total por empresa, en qué se gastó |
| **Presupuestos** | Cotizaciones por rubro; se aprueba la elegida |
| **Gastos** | Cada gasto por el 100%, repartido según participación |
| **Ingresos** | Plata que entra: aportes de socias, inversores, compradores |
| **Dinero en cuenta** | Lo disponible para gastar, en pesos y en dólares |
| **Lote** | La compra del terreno: pactado, pagos, escribanía, incidencia por m² |
| **Dólares** | Todo valuado al dólar de la fecha de cada movimiento |
| **Avances** | Historial de avance por rubro, período a período |
| **Documentos** | Planos y papeles, por ámbito y rubro, versionados |
| **Fotos** | Archivos de obra, en Drive |
| **Rubros** | Qué rubros usa esta obra |

### Rubros

Cada obra tiene el catálogo entero disponible y **marca cuáles usa**. Los
desplegables de gastos, avances y fotos ofrecen sólo los marcados. Desmarcar no
borra nada: un rubro con gastos cargados sigue mostrándolos, sólo deja de
ofrecerse para cargar cosas nuevas.

Al lado de cada rubro, en **Presupuestos**, se marca si lleva materiales, mano
de obra o las dos. No todo rubro lleva ambas: el terreno se compra y listo, una
demolición es puro trabajo, y los revestimientos se compran aparte de quien los
coloca.

### Presupuestos

Cada rubro se cotiza por separado para materiales y para mano de obra: pueden
entrar varias cotizaciones por bloque y se aprueba una, la elegida. A partir de
ahí los gastos de ese rubro se comparan contra lo cotizado, y el formulario
avisa cuando se pasa —**avisa, no frena**: siempre puede aparecer una compra de
urgencia que nadie cotizó.

Conviven dos números: el **presupuesto estimado** (el que se carga a mano en
Editar obra, calculado antes de arrancar) y el **presupuesto real** (la suma de
las cotizaciones aprobadas, que se arma a medida que la obra avanza).

### Avances

Se entra a un rubro y se carga **cuánto se avanzó en esos días**, no el total.
El acumulado lo arma la suma:

```
Albañilería   22/07 - 24/07   +20%   acumulado 20%   replanteo y mampostería PB
              29/07 - 31/07   +15%   acumulado 35%   mampostería PA y dinteles
```

Cargar el incremento y no el total hace que cada fila responda **qué se hizo esa
semana**, que es la pregunta que se hace en obra. Queda el historial completo:
antes había una sola fila por rubro y actualizarla borraba lo anterior.

El **estado no se elige**: sale del acumulado —0% sin iniciar, 100% finalizado,
en el medio en ejecución—. Guardarlo aparte dejaba rubros diciendo "Sin iniciar"
con 40% cargado.

El **avance general pondera cada rubro por lo que cuesta**, según las
cotizaciones aprobadas en Presupuestos: demoler al 100% mueve mucho menos que
albañilería al 50%. Sin cotizaciones aprobadas cae al promedio simple, para que
una obra recién arrancada muestre algo.

### Documentos

Un documento se clasifica por **dos ejes que no se mezclan**. El **ámbito** dice
para qué sirve el papel; el **rubro**, de qué parte de la obra habla.

| Ámbito | Qué va | Cómo se archiva |
| --- | --- | --- |
| **De obra** | Lo que se usa para construir: planos de obra, detalles, planillas | por rubro |
| **De proyecto** | Lo que define el proyecto: anteproyecto, plantas, cortes, vistas | por rubro |
| **Administrativa** | Avisos de obra, planos municipales, seguros, contratos | por título |

Lo administrativo no lleva rubro a propósito: un seguro no es de albañilería. En
su lugar lleva un título que se escribe la primera vez y después se ofrece solo,
armado de lo ya cargado en vez de un catálogo que alguien tenga que mantener.

Así, *el último plano de albañilería* se navega **De obra → Albañilería → V03**.

Un documento puede tener **varios archivos**: el mismo plano en PDF y en DWG es
un documento con dos adjuntos, no dos documentos sueltos.

#### Versiones

Al subir una versión se aprieta **Nueva versión** sobre el documento viejo, y
ese queda **Obsoleto** solo. No es cosmético: dos versiones "Vigentes" del mismo
plano conviviendo es justo lo que hace que alguien termine construyendo con el
plano viejo. Lo obsoleto no se borra —se esconde de la lista y está a un clic.

El encadenado es explícito (cada documento guarda de cuál es continuación), no
adivinado por nombre, así que un plano renombrado no rompe la cadena.

### Lote

La compra del terreno se lleva **aparte** del costo de construir: es una compra
de inmueble, casi siempre en dólares, y su valor no entra en el m² de obra —los
800 USD/m² son de construcción, no de tierra—. Por eso el lote no pasa por
`gastos` ni por el balance entre socias: tiene su propia tabla y su propia vista.

Se carga el **valor pactado** (USD) y los **pagos** a medida que se hacen (seña,
escritura, cuotas). Cada pago se clasifica: "Compra" abona el precio —y baja el
saldo pendiente—, mientras que escribanía, sellos y comisión son gastos de la
operación que van aparte. Un pago en pesos se valúa al dólar de su fecha.

De ahí salen tres lecturas: cuánto falta de la compra, cuánto salió la operación
completa, y la **incidencia del terreno por m² construido** —un terreno caro
sube el piso de toda la obra—. En Estado se ve el lote y la construcción sumados
como inversión total.

#### Cómo queda cada empresa

Cada uno tiene su propio reparto: el de la obra en **Economía**, el del terreno
en la solapa **Lote**. Que estén separados no es cosmético —el terreno no entra
en el costo de construir— pero tampoco alcanza con verlos por separado, porque la
plata sale del mismo bolsillo.

El caso típico: **una socia pone el terreno entero y la otra compensa pagando más
de la obra**. Ahí cada reparto sugiere una transferencia en sentido contrario, y
sólo sumados se sabe quién le debe a quién de verdad:

```
Obra (Economía)   Baffic le transfiere $ 500.000 a Estudio TAG
Terreno (Lote)    Estudio TAG le transfiere US$ 500 a Baffic
Total             Estudio TAG le transfiere $ 245.592,50 a Baffic
```

Por eso Economía cierra con **Total por empresa**, que suma los dos: esa última
liquidación es la que vale, las otras son la misma plata mirada por partes. El
terreno se valúa en pesos al dólar de cada pago para poder sumarlo, que es el
mismo criterio de la inversión total.

### Gastos

Cada gasto se carga **por el total** y se reparte entre las socias según su
participación. Lo que cambia de un gasto a otro es quién puso la plata: una
socia, **todas en partes iguales**, o el dinero en cuenta de la obra.

"Entre las socias" existe porque hay compras que se pagan juntas en el momento
—una entrega grande de material, mitad y mitad— y cargarlas como dos gastos
parte en dos el mismo comprobante. A cada una se le acredita la misma parte de lo
que salió de los bolsillos: con participaciones iguales los saldos no se mueven,
y si no lo son, la que puso más de lo que le tocaba lo ve en su saldo.

La factura, en cambio, es de una sola empresa: el crédito fiscal no se divide,
así que hay que decir a nombre de quién está.

### Dinero en cuenta

La cuenta de la obra tiene **dos lados que no se mezclan**: los pesos que entran
quedan como pesos y los dólares como dólares, hasta que se usen. Recién al pagar
un gasto se define a cuánto se vendieron esos dólares, que rara vez es el
oficial —por eso hay cotización personalizada.

Al pagar un gasto se elige cuánto sale de cada lado. Si el saldo no llega, la
cuenta pone lo que tiene y la diferencia queda a cargo de una socia, calculada
sola.

Reglas contables, que conviene tener presentes:

- El aporte de una socia **cuenta como aporte suyo**, igual que si hubiera
  pagado gastos por ese monto. Por eso lo que se paga con la cuenta no se le
  atribuye a nadie: contarlo dos veces inflaría lo que puso.
- Lo que ponen inversores y compradores **baja el gasto que se reparten** las
  socias.
- Si los dólares se venden mejor que el día que entraron, esa diferencia le
  rinde a la obra y beneficia a todas según su porcentaje.

Consecuencia: **la suma de los saldos ya no da cero**, da la plata de las socias
que todavía está en la cuenta. Cuando la cuenta se vacía, vuelve a dar cero.

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

## Trabajar en dos computadoras

La base y los archivos son los mismos para las dos: viven en Supabase y en
Drive. Lo único que hay que sincronizar es el código.

**Al sentarse a trabajar**, antes que nada:

```bash
git pull
```

**Al terminar**, para que la otra máquina lo tenga:

```bash
git add -A
git commit -m "qué se hizo"
git push
```

Si `npm install` hace falta lo va a decir el propio arranque (o si cambió
`package.json` en el pull).

### Cuando cambia el esquema de la base

La base es una sola y está en la nube, así que **una migración se aplica una vez
y desde cualquiera de las dos máquinas**. La otra sólo necesita el `git pull`
para tener el archivo `.sql` y los tipos actualizados.

El orden importa:

1. Se escribe la migración en `supabase/migrations/`
2. Se aplica: `npx supabase db push`
3. Se regeneran los tipos: `npx supabase gen types typescript --linked > lib/database.types.ts`
4. Se commitea todo junto: el `.sql` y `lib/database.types.ts`

Si se commitea la migración sin aplicarla, la otra máquina va a tener código que
pide columnas que no existen. Si se aplica sin commitear los tipos, la otra
máquina no compila.

Cuando el `git pull` trae migraciones nuevas **ya aplicadas** por la otra
máquina, no hay que hacer nada: la base ya las tiene.

## Base de datos

El esquema está versionado en `supabase/migrations/`. Para aplicar cambios
nuevos:

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

Dos cosas que hicieron fallar migraciones y conviene recordar:

- `create or replace view` **sólo deja agregar columnas al final**. Meter una en
  el medio Postgres lo lee como un renombre y lo rechaza.
- Antes de borrar una columna hay que borrar **todo lo que dependa de ella**:
  vistas, y también los triggers declarados con `update of <columna>`.

## Verificar que todo esté conectado

```bash
node --experimental-strip-types scripts/probar-drive.mjs
```

Confirma que las credenciales de Drive funcionan y crea la carpeta raíz si
falta. Para probar además que se puedan subir y bajar archivos:

```bash
node --experimental-strip-types scripts/probar-subida.mjs
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
