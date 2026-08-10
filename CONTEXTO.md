# Contexto del proyecto

Este documento es la memoria del proyecto: para retomar en una sesión nueva (o
en la otra computadora) sin perder lo decidido. El `README.md` explica cómo usar
y levantar la app; esto explica **por qué** las cosas son como son y qué queda
pendiente.

## Qué es

App para seguir obras de construcción entre varias empresas socias. Cada obra
lleva su economía (gastos, ingresos, balance entre socias), sus presupuestos
(cotizaciones), sus avances, fotos y documentos. Un solo desarrollador la usa
desde **dos computadoras**, sincronizando por git; la base y los archivos están
en la nube y son los mismos para las dos.

## Stack y arquitectura

- **Next.js 16** (App Router, React 19, TypeScript). Ojo: en Next 16 el
  middleware se llama `proxy.ts`, no `middleware.ts`.
- **Supabase** (Postgres + Auth). La seguridad real es el **RLS**: una empresa
  ve sólo sus obras aunque consulte la API directo. El proxy sólo redirige
  rápido.
- **Google Drive** para archivos (fotos, comprobantes, documentos). En la base
  va sólo el id de Drive; se sirve por una ruta del server que verifica permiso.
- **Ámbito Financiero** para la cotización del dólar oficial.

Convenciones de código:
- Helpers de servidor en `lib/*.ts` (leen la base, marcados "SÓLO SERVIDOR").
  El cálculo puro que también usa el cliente va aparte (ej. `lib/reparto.ts`),
  para no arrastrar Supabase al bundle del navegador.
- Server actions en `app/**/actions.ts`.
- Estilos inline en objetos al final de cada archivo (no hay CSS aparte).
- Los comentarios explican el **porqué**, no el qué. Mantener ese estilo.
- `formatMoney` muestra **dos decimales** (los gastos se cargan al centavo).

## Modelo de dominio y decisiones (lo que no es obvio del código)

### Reparto entre socias
Cada obra tiene N empresas socias con un porcentaje (suman 100). Los gastos se
cargan por el 100% indicando quién pagó; el reparto sale del porcentaje. El
"total gastado" no se guarda: se deriva.

### Ingresos de fondos y dinero en cuenta
La plata que **entra**: aportes de socias, inversores o compradores de unidades.
La cuenta de la obra tiene **dos lados que no se mezclan**: pesos y dólares. Un
aporte en dólares queda en dólares hasta que se use; recién al pagar un gasto se
define a cuánto se vendieron (cotización personalizada si fue otro cambio).
- Aporte de socia → cuenta como aporte suyo (igual que pagar un gasto). Por eso
  lo pagado con la cuenta no se le atribuye a nadie (sino se contaría dos veces).
- Aporte de inversor/comprador → baja el gasto que se reparten las socias.
- **Invariante nuevo**: la suma de los saldos ya NO da cero; da la plata que
  todavía está en la cuenta. Vacía la cuenta, vuelve a dar cero.
- Al pagar un gasto con la cuenta se elige cuánto sale de cada lado; si no
  alcanza, la diferencia la pone una socia, calculada sola.

### Rubros por obra
Cada obra tiene el catálogo entero y **marca cuáles usa** (columna `activo`).
Los desplegables ofrecen sólo los marcados. Desmarcar no borra: un rubro con
gastos sigue mostrándolos. Cada rubro además dice qué se cotiza en él
(`usa_materiales`, `usa_mano_obra`) — el terreno se compra, una demolición es
puro trabajo. Eso se marca en la solapa **Presupuestos**, al lado del rubro.

### Presupuestos
Cotizaciones por rubro, separadas para materiales y mano de obra. De cada bloque
se aprueba una (la elegida), que engancha con el proveedor/contratista de
gastos. El gasto avisa si se pasa de lo cotizado, pero **no frena** (puede haber
compra de urgencia). Dos números conviven: presupuesto **estimado** (manual, en
Editar obra) y **real** (suma de lo aprobado).

### IVA y crédito fiscal
El monto del gasto es el **total con IVA adentro**. El comprobante define si hay
crédito: **Factura A** discrimina IVA (da crédito), **B** lo tiene incluido pero
no computable, **C** sin IVA, **Sin factura** efectivo. El IVA se saca hacia
atrás (neto = total / (1+alícuota)), no es el 21% del total. La columna `iva` en
la base es generada (0 salvo factura A). **El crédito fiscal es de la empresa
cuyo CUIT está en la factura** (`empresa_factura_id`), que puede NO ser la que
pagó — es un dato propio, arranca en la pagadora. Economía muestra el total y
una columna por empresa en el balance.

### Gastos administrativos
Cuarto tipo de gasto, al lado de Materiales, Mano de obra y Ajuste de saldo. Es
para lo que la obra paga pero no compra ni contrata: impuestos del terreno (ABL),
honorarios de agrimensor, tasas municipales. Se cargan en el rubro **Impuestos**
(está en el catálogo, inactivo hasta que se lo marque). Diferencias con un gasto
normal: no se cotiza ni aparece en Presupuestos, y no está atado a los flags del
rubro (`usa_materiales`/`usa_mano_obra`) — se puede cargar en cualquiera. En todo
lo demás es un gasto común: se reparte entre las socias, suma al total y al
balance, y **puede llevar Factura A con IVA/crédito fiscal** como el resto. El
"proveedor" de estos gastos va en una tercera categoría, **Varios** (junto a
Proveedor y Contratista); ahí se cargan los ABL, AFIP, agrimensores, etc.
Economía lo muestra como una tercera fila en "En qué se gastó", pero sólo si la
obra tiene alguno.

### Lote (la compra del terreno)
El terreno se lleva **aparte** de los gastos de construcción: es una compra de
inmueble en dólares, y su valor no debe inflar el m² de obra. Decisión de diseño
tomada con el usuario: el lote NO pasa por `gastos` ni por el balance entre
socias (queda fuera de la liquidación; si una socia pone más del terreno, esa
diferencia se lleva por afuera por ahora). Vive en columnas de la obra
(`lote_valor_usd`, `lote_superficie_m2`, `lote_vendedor`, `lote_detalle`) más una
tabla `lote_pagos`. Una obra, un lote.

Cada pago tiene una `categoria`: **Compra** abona el precio pactado (baja el
saldo), y Escribanía/Sellos/Comisión/Otro son gastos de la operación (aparte del
saldo). Los montos se guardan en su moneda (`monto` + `moneda`); la conversión a
USD se hace **en la lectura** con `getConvertidor` (al dólar de la fecha de cada
pago), no se persiste. Todo se mide en dólares porque así se compra un inmueble.

La vista Lote (solapa bajo Economía) muestra pactado / pagado / saldo / gastos
asociados / total desembolsado / incidencia por m² construido / inversión total
(lote + construcción). Estado repite un resumen compacto. `lib/lote-tipos.ts`
tiene las categorías puras (sin base), porque el form cliente las necesita y
`lib/lote.ts` es sólo servidor —mismo patrón que `ambitos.ts`/`documentos.ts`—.

Cada pago lleva la **socia que lo hizo** (`lote_pagos.empresa_id`, obligatorio en
el form, nullable en la base para no romper pagos viejos sin asignar). Con eso el
lote tiene su **propia liquidación** —aparte del balance de obra—: cada socia
pone su porcentaje del terreno, y se sugiere quién le transfiere a quién,
reusando `calcularLiquidacion`. El reparto se calcula sólo sobre lo **atribuido**
(pagos con empresa); lo que queda "sin asignar" se muestra aparte y no descuadra
los saldos. Un pago sin empresa aparece marcado en rojo hasta que se le asigna
una socia editándolo.

### Avances (hechos en la otra máquina)
Historial por período: se carga cuánto se avanzó en esos días, no el total; el
acumulado lo arma la suma. El estado sale del acumulado (no se elige). El avance
general pondera cada rubro por lo que cuesta (cotizaciones aprobadas).

### Documentos (hechos en la otra máquina)
Se clasifican por dos ejes: **ámbito** (de obra / de proyecto / administrativa)
y **rubro**. Los administrativos van por título en vez de rubro. Un documento
puede tener varios archivos (PDF + DWG). Versiones: "Nueva versión" deja la
anterior Obsoleta sola; el encadenado es explícito (`reemplaza_a`).

### Ficha de obra (hecha en la otra máquina + esta)
`domicilio` (calle y altura, aparte de `ubicacion` = localidad),
`unidades_funcionales`, `pisos` (número sobre PB), `valor_m2_usd`. El listado de
obras muestra domicilio/unidades/pisos, no el total gastado; el
nombre/domicilio/localidad van en tres escalones de jerarquía.

### Superficies (dos campos a mano)
Dos números directos: **superficie de construcción** (`sup_construccion_m2`, lo
que se levanta, con muros) y **superficie de venta** (`sup_venta_m2`, la neta
vendible de las unidades). Son distintos y no se derivan uno del otro: un depto
vende 35 m² y se construye 36. Se cargan a mano en Editar obra. (Hubo un intento
con desglose cubierta/semi/descubierta + coeficientes; se simplificó a dos
campos.) La superficie del **lote** (terreno) va aparte, en la solapa Lote
(`lote_superficie_m2`).

`lib/superficies.ts` (puro, sin base) devuelve las dos. Con ellas —más el valor
del lote— salen: incidencia del lote (valor lote / m²), valor del m² de obra
(gastado / construcción) y valor del m² de venta (gastado / venta). La incidencia
y el gastado/m² se muestran sobre las dos superficies; el objetivo y el desvío
siguen sobre la de construcción.

### Solapas agrupadas (hecho en la otra máquina)
Las solapas de una obra están en dos grupos: **Economía** (Balance, Gastos,
Ingresos, Dinero en cuenta, Lote, Dólares) y **Obra** (Estado, Presupuestos,
Avances, Fotos, Documentos, Rubros).

## Flujo de trabajo entre dos máquinas

Al empezar: `git pull`. Al terminar: `git add -A && git commit && git push`.
Commits en `main` directo (proyecto de una persona; no usar ramas salvo pedido).
Mensajes de commit en español, explicando el porqué, con `Co-Authored-By`.

**Cuando cambia el esquema** (el orden importa):
1. Escribir la migración en `supabase/migrations/`.
2. Aplicar: `npx supabase db push`.
3. Regenerar tipos: `npx supabase gen types typescript --linked > lib/database.types.ts`.
4. Commitear el `.sql` **y** los tipos juntos.

La base es una sola: una migración se aplica **una vez** desde cualquier máquina.
Cuando el pull trae migraciones ya aplicadas por la otra, no hay que hacer nada.
Antes de subir: `npx tsc --noEmit && npx eslint . && npm run build`.

## Pozos en los que ya caímos (no repetir)

- **`create or replace view` sólo agrega columnas al final.** Meter una en el
  medio, Postgres lo lee como renombre y lo rechaza.
- **Antes de borrar una columna, borrar todo lo que dependa de ella**: vistas y
  también triggers declarados con `update of <columna>`.
- **El histórico de Ámbito excluye la fecha de fin** del rango y no devuelve nada
  para un rango de un solo día. Por eso `getCotizacionDeFecha` pide con margen
  (15 días atrás, 1 adelante). Sin esto todo caía al dólar de hoy.
- **Conversión a dólares**: un monto en pesos no siempre da un número redondo de
  dólares (el centavo de dólar vale ~$15). Redondear siempre para abajo para no
  sobrestimar lo que salió de la cuenta.
- **Errores fantasma de `.next`**: si `tsc` pasa pero el dev server muestra
  errores tipo "defined multiple times" o rutas viejas, es caché. Borrar `.next`
  y recargar.
- **PowerShell** mastica mal `git add -A` junto a un heredoc largo, y
  `HEAD@{1}`. Usar archivos explícitos y hashes de commit.
- La MCP de Supabase de esta sesión **no tiene permiso** para consultar/escribir
  la base. Las migraciones las corre el usuario con `db push`.
- **Supabase (plan gratuito) se pausa por inactividad** (~1 semana sin uso). Con
  la base dormida no se puede ingresar (el login queda en "Email o contraseña
  incorrectos" aunque sean correctos) y `supabase db push` da "Connection
  terminated due to connection timeout". Se reactiva desde el dashboard (Project
  → Restore/Resume, tarda 1-2 min). Si el login falla y el CLI da timeout, es el
  primer sospechoso.

## Pendientes / decisiones abiertas

- **Rubros tipo "Colocación de revestimientos"**: se pueden crear por obra, pero
  no están en el catálogo. Si conviene que aparezcan en todas las obras nuevas,
  hay que definir cuáles y hacer una migración.
- **Revisar Pisos, Mesadas y Vidrios**: quedaron con material + mano de obra por
  defecto; si el material va separado de la colocación, desmarcar M.O.
- **Gastos viejos sin tipo de factura**: los "Facturado" previos al IVA quedaron
  sin tipo (crédito fiscal 0, conservador). Al editarlos, el selector arranca en
  Factura A; se van marcando A/B/C a medida que se tocan.
- Ver la nota de "queda margen" (gasto por debajo de lo cotizado) en vivo — nunca
  se dio con datos reales.

## Cómo retomar en una sesión nueva

Decir: "leé CONTEXTO.md y el README para ponerte al día". Con eso alcanza para
tener el panorama completo: qué es la app, cómo está armada, qué se decidió y qué
falta.
