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
- `formatMoney` y `formatUSD` muestran **dos decimales** (los gastos se cargan al
  centavo). En dólares importa igual o más: $ 1.200.000 al cambio de 1.433,90 son
  US$ 836,88, y mostrar US$ 837 inventa doce centavos. La conversión se guarda al
  centavo desde siempre —`convertirMonto`—; lo que redondeaba era el formato.

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

### Gastos entre las socias
Un gasto común lo puede poner **una socia, todas en partes iguales, o el dinero
en cuenta**. "Entre las socias (partes iguales)" es una opción más del
desplegable "Empresa que pagó": guarda `gastos.compartido = true` y deja
`empresa_pagadora_id` en null, igual que el pago compartido del lote. El
centinela del desplegable es `GASTO_COMPARTIDO` en `lib/reparto.ts` (el módulo
puro que comparten el form cliente y el server action).

El balance (`obra_balance`) le acredita a cada socia **la misma parte** de lo que
salió de los bolsillos (`monto - monto_caja`), sin mirar el porcentaje. Con
socias 50/50 los saldos no se mueven; con 60/40 la del 40 queda poniendo de más y
aparece en la liquidación —que es lo correcto: puso más de lo que le tocaba—. Lo
que se sigue repartiendo por porcentaje es el gasto (`le_corresponde`): eso no
cambió.

Tres bordes que ya están resueltos: no aplica al **ajuste de saldo** (ese va de
una socia puntual a otra); si la cuenta cubre el gasto entero **no queda
compartido**, porque no lo puso nadie de su bolsillo; y la **factura sigue siendo
de una sola empresa** —el crédito fiscal no se divide—, así que el titular hay
que elegirlo a mano en vez de heredarlo de la pagadora, que no existe.

### Lote (la compra del terreno)
El terreno se lleva **aparte** de los gastos de construcción: es una compra de
inmueble en dólares, y su valor no debe inflar el m² de obra. Decisión de diseño
tomada con el usuario: el lote NO pasa por `gastos` ni por el balance entre
socias (queda fuera de la liquidación; si una socia pone más del terreno, esa
diferencia se lleva por afuera por ahora). Vive en columnas de la obra
(`lote_valor_usd`, `lote_superficie_m2`, `lote_vendedor`, `lote_detalle`) más una
tabla `lote_pagos`. Una obra, un lote.

Cada pago tiene una `categoria`: **Compra** abona el valor del lote (baja el
saldo), y Escribanía/Sellos/Comisión/Otro son gastos administrativos de la
operación (aparte del saldo). La categoría es lo único que decide de qué lado
cae un pago: una comisión cargada como "Compra" abona el terreno y no aparece en
administrativos —pasó con una comisión inmobiliaria, y desde afuera parece un
error de suma—. Los montos se guardan en su moneda (`monto` + `moneda`); la
conversión a USD se hace **en la lectura** con `getConvertidor` (al dólar de la
fecha de cada pago), no se persiste. Todo se mide en dólares porque así se compra
un inmueble.

La vista Lote (solapa bajo Economía) muestra valor lote / pago a la fecha /
saldo pendiente / gastos administrativos / total desembolsado / incidencia por m²
construido / inversión total (lote + construcción).

**Qué se edita dónde.** La solapa Lote quedó para lo que se consulta y lo que
pasa todos los meses: los números, el reparto y los pagos. Lo demás se fue:

- La **ficha del terreno** se edita en **Editar obra → Datos lote** (esa pantalla
  tiene dos solapas: *Datos obra* y *Datos lote*). Son datos que se cargan al
  comprar y después casi no se tocan. En la solapa Lote se muestran en sólo
  lectura, con enlace a editarlos, porque son la identidad del terreno.
- El **alta de un pago** tiene su propia pantalla (`lote/nuevo`), a la que se
  entra por el botón de arriba, igual que "Nuevo gasto" en Gastos. Antes el
  formulario vivía desplegado al pie y era lo más largo de la página.

La ficha incluye, además de valor/superficie/vendedor: **propietario** (titular
registral, que puede no ser quien vende), **partida inmobiliaria** y la
nomenclatura catastral desglosada en **circunscripción / sección / manzana /
parcela**. Va desglosada porque así figura en la escritura y así la pide el
municipio; en la solapa Lote se muestra armada (`Circ. II · Secc. B · Mz. 45`).
Todo se guarda como texto, incluso lo que parece número: una parcela puede ser
"12a" y una sección "B".

En la tabla de pagos cada uno ocupa **una sola columna de moneda: la que se
cargó**. Un pago en dólares deja "Monto en $" vacío; uno en pesos muestra los
pesos ahí y su dolarización al cambio de esa fecha en "Monto en U$D". Antes las
dos columnas repetían el mismo número en los pagos en dólares, que son casi
todos. La columna en dólares siempre tiene algo, porque el lote se mide así. Estado repite un resumen compacto. `lib/lote-tipos.ts`
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

Un pago puede ser **entre las socias** (`compartido = true`, `empresa_id` null):
en el desplegable "Pagó" está la opción "Entre las socias (partes iguales)". Una
cuota de US$ 2.000 compartida suma US$ 1.000 al "puso" de cada socia (monto /
cantidad de socias). Sirve para las cuotas del terreno que ponen las dos juntas
sin tener que cargar dos pagos. El centinela del desplegable es
`PAGO_COMPARTIDO` en `lib/lote-tipos.ts`.

### Terreno y total por empresa (en Economía)
Economía muestra, en este orden: **Balance entre empresas** (la obra), **Terreno**
(sólo cuánto salió el lote, en dólares y en pesos) y **Total por empresa** (los
dos sumados, con su liquidación).

El reparto del lote entre socias **no está en Economía**: vive en la solapa Lote.
Se probó ponerlo acá y la pantalla quedó cargadísima —dos tablas de saldos
seguidas—; además es donde uno lo va a buscar. En Economía quedó sólo el valor,
que es lo que hace falta para entender la inversión. Por la misma razón se sacó
la tarjeta "Presupuesto consumido" de arriba: el dato sigue en "Ejecución
presupuestaria", que es donde tiene contra qué compararse.

El "Total por empresa" existe porque hacía falta una lectura que ninguna de las
dos partes daba.

El caso que la motiva: una socia pone el terreno entero y la otra compensa
pagando más de la obra diaria. Ahí las dos liquidaciones apuntan en direcciones
opuestas ("A le transfiere a B" en una, "B le transfiere a A" en la otra) y
mirándolas por separado no se sabe si la compensación cierra. La consolidada las
resuelve en una sola transferencia.

Para poder sumarlas hay que salvar que están en monedas distintas: la obra se
lleva en pesos y el lote en dólares. `SocioLote` (en `lib/lote.ts`) devuelve el
reparto **en las dos monedas**; los pesos salen de valuar cada pago al dólar de
su fecha, igual que `totalArs` y que el gráfico de torta. La solapa Lote muestra
el reparto en dólares (que es como se compra un inmueble) y la consolidada de
Economía en pesos (que es la moneda de esa pantalla).

Si hay pagos del lote sin socia asignada, la columna "En el terreno" queda corta
contra el total: por eso el aviso debajo de la tabla.

Ojo: `getPagoLote` —el que alimenta el formulario de edición— no convierte nada,
así que devuelve `usd: null` y `ars: 0`. No es un dato, es "no calculado".

### Detalle por rubro
En "En qué se gastó", cada rubro es un enlace a `/obras/<slug>/rubro/<rubroId>`:
arriba **cotizado / gastado / falta pagar** del rubro, y abajo los gastos
separados en **Materiales / Mano de obra / Administrativo**, un bloque por tipo
con su propia comparación contra lo cotizado (y quién cotizó).

Lo cotizado sale de `getPresupuestosDeObra` —las cotizaciones **aprobadas**—. Sin
cotización aprobada no se muestran ni "cotizado" ni "falta": un "falta" sin
contra qué comparar sería el gasto cambiado de signo. Un tipo aparece si tiene
gastos **o** si tiene cotización, para que un rubro cotizado y todavía sin gastar
se pueda mirar.

Ojo con eso último: hoy a esa pantalla se entra sólo desde el gráfico de torta,
que lista los rubros **con gastos**. Un rubro cotizado y sin gastar no tiene
puerta de entrada desde Economía; se llega por URL. Si molesta, hay que decidir
si Economía los lista. La
porción "Lote / Terreno" lleva a la solapa Lote; los gastos sin rubro no llevan a
ningún lado, porque no hay adónde ir.

La ruta es `rubro/[rubroId]`, en singular, para no confundirla con la solapa
`rubros`, que es otra cosa (qué rubros usa la obra). `GraficoTorta` acepta un
`href` opcional por porción: así el mismo componente sigue sirviendo en Dólares,
donde no hay enlaces.

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
del lote— salen: incidencia del lote, valor del m² de obra (gastado /
construcción) y valor del m² de venta (gastado / venta). El gastado/m² se muestra
sobre las dos superficies; el objetivo y el desvío van sobre la de construcción.

La **incidencia va siempre sobre la superficie de venta**, nunca sobre la de
construcción: lo que se recupera es lo vendible, así que es contra eso que se
mide cuánto pesa la tierra. Se mostraban las dos y sobraba una.

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

### Gráfico de torta "en qué se gastó" (con el lote)
Economía y Dólares tienen un gráfico de torta por rubro que **incluye el lote**
como una porción más (`components/GraficoTorta.tsx`, SVG puro, sin librería). En
Economía va en pesos (el lote se valúa a pesos al dólar de cada pago,
`lote.totalArs`); en Dólares va en USD (`lote.totalUsd`). Debajo se muestra la
**inversión total** = obra + lote.

Decisión: el lote NO se sumó a la tarjeta "Total gastado" de arriba, porque esa
cuadra con "facturado + efectivo" y meterle el lote la rompía. En su lugar está
la "inversión total". Si se quiere, se puede reconsiderar.

### Buscar / filtrar gastos y pagos del lote
Las listas grandes se filtran del lado del cliente (todo ya viene cargado, se
filtra en JS). Gastos: `components/GastosLista.tsx` (buscador de texto que pega en
concepto/proveedor/quién pagó/rubro/monto/fecha, filtro por rubro, y "ocultar
anulados"). Lote: `components/PagosLoteLista.tsx` (buscador de texto). Las páginas
(server components) traen los datos y se los pasan al componente cliente; la
acción de borrar el pago del lote viaja como prop.

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
- **Datos de prueba en 3 De Febrero**: el valor pactado del lote, las cuotas y la
  superficie (160 m²) son de prueba. Reemplazarlos por los reales cuando se
  cargue la obra en serio.

## Cómo retomar en una sesión nueva

Decir: "leé CONTEXTO.md y el README para ponerte al día". Con eso alcanza para
tener el panorama completo: qué es la app, cómo está armada, qué se decidió y qué
falta.
