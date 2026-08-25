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
- **Ámbito Financiero** para la cotización del dólar blue (endpoint `informal`).

Convenciones de código:
- Helpers de servidor en `lib/*.ts` (leen la base, marcados "SÓLO SERVIDOR").
  El cálculo puro que también usa el cliente va aparte (ej. `lib/reparto.ts`),
  para no arrastrar Supabase al bundle del navegador.
- Server actions en `app/**/actions.ts`.
- Estilos inline en objetos al final de cada archivo (no hay CSS aparte).
- **Formularios**: el `field` de la grilla de dos columnas lleva siempre
  `alignContent: "start"`. Sin eso, una celda con ayuda debajo estira a su
  vecina y el input de al lado queda flotando a media altura: las filas dejan de
  alinearse y la pantalla se lee torcida.
- **La ayuda debajo de un campo es para lo que no se deduce mirándolo**: cuánto
  hay en la cuenta, cuánto da el IVA, por qué el desplegable ofrece una sola
  opción. Lo que ya dicen la etiqueta o el placeholder no se repite abajo, y
  **"opcional" va al lado de la etiqueta** —en gris, no en un renglón propio—:
  dice lo mismo, no corre el campo vecino y deja la ayuda libre para lo que de
  verdad hay que explicar.
- **Los títulos alcanzan.** Se barrió la app de subtítulos que contaban de qué
  se trataba la pantalla ("Registro visual de avances", "Corregí los datos del
  gasto") y de ayudas que definían el campo que tenían encima ("La localidad,
  que es lo que se lee en el listado"). Se leían como un manual pegado a la
  pantalla y empujaban los datos para abajo. Lo que sobrevive es de tres clases:
  un **número** que no está en ningún otro lado (el disponible de la cuenta, el
  IVA, lo ya cargado contra un presupuesto), una **cotización de dólar** —a qué
  cambio se guarda, de qué fecha, de dónde sale— o una **consecuencia que
  sorprende** (que el archivo pise al anterior, que el catálogo sea el mismo en
  todas las obras, que un ajuste de saldo no sume al total gastado). Si un texto
  no entra en ninguna, no va: al escribir una pantalla nueva, ese es el filtro.
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
Van en **una sola solapa, Ingresos**: "Dinero en cuenta" se fusionó adentro. Eran
dos pantallas de lo mismo —todo ingreso suma a la cuenta, y la lista de
movimientos de la cuenta repetía el listado de ingresos entero—. Quedó: cuatro
tarjetas y **una sola tabla de movimientos**, cada fila con lo que entró o salió
y nada más. Las entradas dicen su origen y las salidas son los gastos que
tocaron la cuenta. La ruta vieja `dinero-en-cuenta` **redirige** a `ingresos`,
para no romper enlaces guardados.

**Se edita desde una columna Editar**, la última, igual que en el listado de
gastos. Antes el enlace era el texto del detalle: nada anunciaba que llevaba a
un formulario, y se hacía clic esperando la ficha del movimiento para aparecer
editándolo. La tabla mezcla ingresos y gastos y cada fila va al formulario que
le toca, así que la columna sirve para las dos.

**Cuánto queda lo contestan las tarjetas, y una sola vez.** La tabla llevaba una
columna *Quedan* con el saldo corriente después de cada movimiento: la primera
fila repetía la tarjeta de arriba y las de abajo eran saldos intermedios que
nadie pregunta. Con la columna se fue también el acumulado —la lista se ordena
del más nuevo al más viejo y listo—. Por lo mismo salió de las dos tarjetas de
cuenta la nota *entró …*: con Gastos al lado, lo que entró es el saldo más lo
gastado, un número que se deduce mirando.

**Nada se valúa en pesos para mostrarlo.** Las cuatro tarjetas son *Cuenta en
pesos · Cuenta en dólares · Gastos en pesos · Gastos en dólares*: son dos
cuentas distintas, cada una en su moneda, y las dos primeras van en verde
(saldos que no pueden ser negativos). Antes
arriba iban *Total ingresado · Aportes de socias · Inversores y compradores*,
las tres valuadas en pesos: un aporte de US$ 5.000 aparecía como $ 7.725.000,
que es un número que no existe en ningún lado —los dólares siguen siendo
dólares hasta que un gasto los use, y ahí el cambio lo pone el gasto—. Lo único
que sí se dice en pesos es cuánto **rindieron** los dólares que salieron, al
cambio con que se cargó cada gasto, porque eso sí pasó de verdad.

Se fue con eso la tabla *entró / se usó / disponible*, que repetía los mismos
cuatro números, y el corte **socias vs. terceros**, que sólo se podía expresar
en pesos; sigue en la tabla de movimientos, fila por fila, y en el balance como
`fondos_terceros`.

### La agenda de inversores
Solapa **Inversores**, al lado de Ingresos porque es su otra mitad: Ingresos
dice qué entró, Inversores dice **cuánto falta que entre**.

Un inversor era antes un nombre escrito a mano en cada ingreso
(`ingresos.aportante`). Servía para saber de dónde vino la plata, pero no para
la pregunta de todos los días —por cuánto firmó y cuánto le falta—: con el
nombre suelto no hay a qué colgarle el compromiso, y dos aportes del mismo
inversor sólo se juntaban si el nombre se escribía igual las dos veces. Ahora
cada uno tiene ficha (`inversores`, por obra) y los ingresos cuelgan de ella
(`ingresos.inversor_id`).

Los **compradores de unidades van en la misma tabla**, con un `tipo` que toma
los mismos valores que `ingresos.origen`. Tienen exactamente la misma forma
—firman por un monto y lo pagan en cuotas—, así que dos tablas gemelas no se
justificaban.

**El compromiso se lleva en pesos y en dólares por separado**, como los dos
lados de la cuenta: quien firmó por US$ 100.000 los debe en dólares, y aportar
pesos no le baja esa deuda. Nada se valúa de un lado al otro. El dato para
netear existe (cada ingreso guarda su `cotizacion`), pero es una decisión de
negocio que no se tomó: mezclarlas obligaría a elegir a qué cambio se cancela
una deuda, y esa elección cambia el saldo.

Los dos montos pueden quedar en **cero, que significa "no se sabe"** y así lo
dice la pantalla. Hacía falta para la migración: los inversores que ya estaban
cargados a mano pasaron a la agenda con sus aportes, pero nadie sabe por cuánto
firmaron. Un cero mostrado como saldo se leería "ya no debe nada", que es lo
contrario.

Borrar una ficha con aportes está **frenado por la base** (`restrict`): sería
borrar plata que entró de verdad. Y `ingresos.aportante` quedó como respaldo de
los nombres viejos —no se escribe más, se lee sólo si un ingreso no tiene ficha.

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
Cotizaciones por rubro, separadas para materiales y mano de obra. Cada tipo es
un **acordeón a lo ancho** que arranca cerrado: con varias cotizaciones cargadas
el bloque se hacía interminable. En el encabezado viven los números —monto
aprobado **en verde**, gastado y diferencia, en columnas alineadas entre
rubros— y la lista es el detalle que se abre. En el encabezado va **sólo el
monto**: con el nombre de quien cotizó al lado se cortaba, y el nombre ya está
en la ficha al abrir, donde la aprobada aparece primera y en verde.

La tercera columna es **Restante** —aprobado menos gastado, en rojo—, no
"diferencia": lo que se quiere saber es cuánto falta poner. La ficha de arriba
usa el mismo número que la de "Resta pagar" del Balance y se calcula igual
(sólo lo cotizado, sólo saldos positivos); antes eran dos números distintos
para la misma pregunta.

De cada bloque se aprueba una (la elegida), que engancha con el
proveedor/contratista de gastos. El gasto avisa si se pasa de lo cotizado, pero **no frena** (puede haber
compra de urgencia). Dos números conviven: presupuesto **estimado** (manual, en
Editar obra) y **real** (suma de lo aprobado).

### Contratistas y proveedores (el catálogo)
Proveedores, contratistas y "varios" viven en una sola tabla (`proveedores`)
separada por `tipo`, y el catálogo es **uno solo para todas las obras**: el mismo
plomero sirve en dos edificios. Hasta ahora se creaban al vuelo desde el
formulario de un gasto o una cotización y no había forma de tocarlos: un nombre
mal escrito quedaba así para siempre.

Se editan en **Presupuestos → Contratistas**
(`presupuestos/contratistas`). El botón está al lado de "Nueva cotización"
porque es ahí donde uno se da cuenta de que el nombre está mal: al ir a cargar.
Se guardan **nombre y apellido** (el mismo campo `nombre` de siempre, que es como
figura en los desplegables) y **teléfono**. Se probó agregar un campo "contacto"
aparte y se sacó: en un contratista el nombre ya es el de la persona, así que
repetía el mismo dato.

La pantalla entra por una obra pero edita el catálogo entero, así que lo dice
arriba y muestra, de cada uno, el uso **en esta obra** (cotizaciones y gastos)
aparte del de las demás. Son dos preguntas distintas: "¿con este trabajé acá?" y
"¿por qué no me deja borrarlo?". Sólo se puede eliminar el que no tiene nada
cargado en ninguna obra; las dos claves foráneas son `on delete restrict`.

Ojo con el RLS: **agregar lo puede hacer cualquiera** (la política
`proveedores_insert` estaba abierta desde siempre, porque el form de gastos lo
necesitaba), pero **modificar y borrar son de admin**. Un update bloqueado por
RLS no da error: no toca ninguna fila y parece que guardó. Por eso las acciones
piden `.select()` y avisan si no volvió nada.

No se puede cambiar el `tipo` desde acá, y es a propósito: el trigger
`chequear_presupuesto_coherente` exige que la mano de obra la cotice un
contratista, pero corre al escribir el **presupuesto**, no al cambiar el
proveedor. Mover un contratista a proveedor dejaría sus cotizaciones
inconsistentes y la base recién lo rechazaría en la próxima edición de cada una.

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

Ese titular manda también en la columna **Facturado** del balance: un gasto
compartido con factura a nombre de una socia se le atribuye **entero** a ella,
no la mitad a cada una. La plata se sigue partiendo al medio; lo que no se parte
es el comprobante.

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

### La solapa Balance (Economía), de arriba abajo
En este orden, todo a lo ancho y **sin párrafos explicativos**: las tarjetas en
una línea (Total gastado · Facturado · En efectivo · Crédito fiscal · Dinero en
cuenta · Resta pagar), el gráfico de torta, la ejecución presupuestaria en
cuatro columnas, el **balance entre empresas** con su liquidación, y el
**terreno** reducido a qué puso cada socia y —si el precio pactado no está
saldado— cuánto le resta según su porcentaje.

La pantalla mostraba lo mismo varias veces: dos tablas de saldos, dos
liquidaciones, y el desglose de la torta repetido en tarjetas. Se fue todo lo
duplicado, más Plazos (vive en Estado) y Últimos gastos (vive en Gastos).

Las tarjetas van en **orden de jerarquía**: el total gastado primero y al lado
su desglose —facturado, en efectivo, crédito fiscal, que son partes de ese
mismo total—, después el dinero en cuenta y al final **Resta pagar**, en rojo.
Esa última es lo aprobado menos lo pagado de cada rubro **y tipo** (la
cotización de la mano de obra no se mide contra lo gastado en materiales) y
lleva a Presupuestos, que es donde está el desglose. Se probó como una tabla
rubro por rubro en el Balance y sobraba, porque ese detalle ya estaba a un
click.

**Dinero en cuenta va en verde**, el contrario del rojo de Resta pagar: es plata
que está, y sus dos saldos no pueden ser negativos. Los dos van con el **mismo
tamaño** —no hay un número principal con una aclaración chica abajo—, porque son
dos cuentas distintas y ninguna manda sobre la otra. **El lado que está en cero
no se muestra**: si todo entró en dólares, un "$ 0,00" arriba se lee como que no
hay plata. Con la cuenta vacía queda el cero en pesos, que es cómo se dice "no
hay". Mismo criterio en la columna "Quedan" de Ingresos, salvo que ahí se
muestran siempre los dos para que las filas no queden de alturas distintas.

`VERDE` y `ROJO` viven en `components/ui.ts` desde que los comparten el balance
y los ingresos.

Dos cosas de ese número: un rubro que se pasó **no compensa** lo que falta en
otro —no devuelve plata—, así que suma sólo lo que todavía hay que poner; y
debajo va cuántas combinaciones no tienen cotización aprobada, porque hoy casi
ningún material está cotizado y sin esa línea se lee como todo lo que falta de
la obra.

**Las tarjetas son enlaces**: llevan al listado de gastos con la columna
Comprobante ya filtrada (`gastos?ver=efectivo`, `facturado`, `credito-fiscal`,
`todos`), que es la pregunta que sigue al número —"¿en qué se fue todo eso en
efectivo?"—. No hay pantallas nuevas: reusa el listado con sus filtros estilo
Excel, así que al llegar se puede seguir acotando a mano. El atajo viaja como
una **intención** y no como una lista de valores, porque cuáles existen depende
de los datos de cada obra (una puede no tener ninguna factura C): se resuelven
contra los que hay. La de Dinero en cuenta lleva a Ingresos, que es donde está
su detalle.

Ojo: la de **crédito fiscal** lleva a las facturas A —las únicas que lo
discriminan—, pero el total de la tarjeta del listado es lo facturado, no el
IVA. El IVA aparece en el desglose por empresa, no gasto por gasto: la columna
de IVA del listado se sacó y no volvió.

**El desglose "A nombre de quién"**, arriba del listado: qué parte de lo que se
está viendo es de cada socia —facturado, efectivo y crédito fiscal—, que es la
pregunta que sigue a entrar por una tarjeta ("de estos $ 10.404.662, ¿cuánto es
mío?"). Tres decisiones: se **rehace con cada filtro** (vive en `GastosLista`,
no en la página, y se calcula sobre lo filtrado) así siempre habla de las filas
de abajo; cada columna aparece **sólo si tiene algo** —entrando por Facturado no
hay efectivo que poner, entrando por Efectivo no hay crédito—; y sale **sólo al
llegar por una tarjeta** (`ver` presente), porque la solapa Gastos se abre para
cargar y revisar movimientos, no para leer un resumen.

Usa `repartirComprobantes` (`lib/comprobantes.ts`), el mismo cálculo puro que el
balance entre empresas: los dos tienen que dar el mismo número, y sin filtrar
nada el desglose es exactamente las columnas de comprobantes del Balance.

El listado suma además el **total de lo que se está viendo** al lado del
contador ("34 gastos de 36 · $ 43.250.000"). Deja afuera anulados y ajustes de
saldo, igual que todos los totales de la app, así cuadra exacto con la tarjeta
de la que se vino.

#### La tabla "Balance entre empresas": tres bloques que no suman entre sí
Las columnas contestan tres preguntas distintas sobre los mismos gastos, y por
eso van agrupadas bajo un rótulo y separadas por una línea vertical: **sólo
suman dentro de su bloque**.

- **Comprobantes** (Facturado · Efectivo · Crédito fiscal): a nombre de quién
  salió cada gasto. Toma el **monto entero** del gasto, no lo que salió del
  bolsillo: la factura es por el total aunque una parte la haya cubierto el
  dinero en cuenta —mismo criterio que el crédito fiscal, que computa el IVA
  completo del comprobante—. El total de Facturado cuadra con la tarjeta
  "Facturado" de arriba, y el de Efectivo con "En efectivo".
- **Lo que puso** (De su bolsillo · Puso en cuenta · Ajustes · Total obra): de
  dónde salió la plata. Los tres primeros suman **Total obra**, que es el
  `pagado` de `obra_balance` y lo único que alimenta el saldo.
- **El reparto** (Le corresponde · Saldo).

**A quién se le facturó no es quién pagó.** Es el arreglo del que salió esta
tabla: la columna Facturado atribuía por `empresa_pagadora_id`, así que una
compra grande pagada "Entre las socias" se partía al medio aunque la factura
saliera a nombre de una sola. Ahora el orden es `empresa_factura_id` →
`empresa_pagadora_id` → partes iguales si es compartido. Las **B y C son
consumidor final**: no llevan CUIT (el `check` de la base sólo admite titular en
la A), así que van por quien pagó — pero siguen siendo facturado, porque lo son;
lo único que se reserva para la A es el crédito fiscal, que es lo único que la A
tiene de distinto. Los gastos viejos sin tipo de factura caen en el mismo lugar.

Lo que no se puede atribuir —pagado entero con el dinero en cuenta y sin factura
a nombre de una socia— **no se reparte**: va en una línea debajo de la tabla,
mismo criterio que los pagos del lote sin socia. Así las columnas de
comprobantes quedan cortas contra el total gastado sin que parezca un error.

Todo esto se calcula en **`lib/comprobantes.ts`** —`repartirComprobantes`, puro y
sin base— y no en la vista: `obra_balance.pagado_facturado` y `pagado_efectivo`
—que atribuyen por pagadora y descuentan la caja— **quedaron sin uso**. Siguen
ahí porque son otra pregunta válida ("de lo que puso de su bolsillo, cuánto
tenía factura"), por si alguna vez hace falta.

El módulo es puro porque lo usan los dos lados: el Balance en el servidor y el
desglose del listado de gastos en el navegador, que lo rehace con cada filtro.
Si el cálculo viviera en la página, el listado tendría que copiarlo y los dos
números se irían separando.

**Lo que se perdió a propósito**: la tabla "Total por empresa" —obra + terreno
sumados— y su liquidación consolidada. Resolvía un caso real: una socia pone el
terreno entero y la otra compensa pagando la obra diaria, y las dos
liquidaciones por separado apuntan en direcciones opuestas. Si vuelve a hacer
falta, `SocioLote` (en `lib/lote.ts`) ya devuelve el reparto **en las dos
monedas** —los pesos salen de valuar cada pago al dólar de su fecha— justamente
para poder sumarlo con la obra, que se lleva en pesos.

El reparto del lote entre socias vive en la solapa Lote, que es donde se lo va a
buscar. Si hay pagos sin socia asignada, lo puesto queda corto contra el total:
por eso el aviso debajo de la tabla.

Ojo: `getPagoLote` —el que alimenta el formulario de edición— no convierte nada,
así que devuelve `usd: null` y `ars: 0`. No es un dato, es "no calculado".

### Detalle por rubro
En "En qué se gastó", cada rubro es un enlace a `/obras/<slug>/rubro/<rubroId>`:
arriba **cotizado / gastado / falta pagar** del rubro, y abajo los gastos
separados en **Materiales / Mano de obra / Administrativo**, un bloque por tipo
con su propia comparación contra lo cotizado (y quién cotizó).

Lo cotizado sale de `getPresupuestosDeObra` —las cotizaciones **aprobadas**—. Un
tipo aparece si tiene gastos **o** si tiene cotización, para que un rubro
cotizado y todavía sin gastar se pueda mirar.

**No hay totales del rubro entero, y es a propósito.** Los había, arriba, en tres
tarjetas, y mentían: comparaban la cotización de la mano de obra contra lo
gastado en materiales *más* mano de obra. En Albañilería daba "cotizado
$82.000.000, gastado $21.504.662, falta pagar $60.495.338" cuando los $82M eran
sólo lo de Hugo y de los $21M la mitad era material que nadie había cotizado. El
número no significaba nada. Se sacaron: la comparación vive en cada bloque,
contra su propia cotización, que es la única que cierra.

Cada tipo es un **acordeón** (`details` nativo, sin JavaScript) y arrancan todos
**cerrados**: los números viven en el encabezado, que es lo que se viene a mirar,
y la tabla de gastos es el detalle que se abre cuando hace falta.

Ojo con el `summary`: ponerle `display: flex` **borra el triangulito nativo**, que
es la única señal de que el bloque se abre. Por eso el contenido va adentro de un
`span` inline-flex con `width: calc(100% - 28px)`, y el summary queda con su
display por defecto. Mismo patrón en la pantalla de contratistas.

Los tres números (cotizado / gastado / falta pagar) van **siempre**, con el
**mismo rótulo en todos los bloques** y en columnas de **ancho fijo**, para que
arranquen en la misma vertical. Nada de "Cotizado · Hugo" ni "Sin cotización
aprobada": un rótulo que cambia de largo de bloque en bloque corre la columna y
la pantalla se lee torcida. Quién cotizó pasó adentro del bloque, al abrirlo.

Lo que no se puede calcular es un **guión**, no un cero: un cero se leería como
"no falta nada". Y pasarse de lo cotizado sale como **número negativo bajo el
mismo rótulo**, en vez de cambiarlo por "Se pasó" —el signo ya lo dice y la
columna queda igual—. Va en **rojo pleno**, igual que el falta: se probó con un
rojo suave y quedaba desdibujado justo en el número que más se mira.

La tabla de adentro tiene las columnas en **el mismo orden que Gastos** (fecha,
destino, detalle, comprobante, pagó, monto), para no tener que releer el
encabezado al saltar de una pantalla a la otra. No están Rubro ni Tipo: acá
serían la misma respuesta en todas las filas. El detalle **no es un enlace**: se
probó llevando al gasto y sobra, porque a esta pantalla se entra a leer.

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

### Destino, comprobante y detalle por proveedor
La columna del listado de gastos se llama **Destino**, no "Proveedor /
Contratista": es adónde fue la plata, valga quien valga (proveedor, contratista
o varios). Cada destino es un enlace a `proveedor/[proveedorId]`, **la cuenta
corriente con esa persona en la obra**: cuánto cotizó, cuánto se le pagó, cuánto
falta y la lista de pagos. Acá la comparación cierra porque los dos lados son
del mismo destino —a diferencia de los totales por rubro, que mezclaban la
cotización de uno con los gastos de todos y hubo que sacar—.

El comprobante es **una sola columna** y la etiqueta es el comprobante entero
(`components/EtiquetaComprobante.tsx`): gris para efectivo, celeste pastel para
factura, y si el archivo está cargado la etiqueta misma abre el visor, que es
donde se descarga. No hay "Ver" aparte ni renglón de IVA bajo el monto:
"Factura A" ya dice que lo tiene. El verde y el rojo no se usan acá porque ya
significan plata a favor o en contra en toda la app.

Con el comprobante en una columna y las columnas cortas sin partirse
(`white-space: nowrap`), el ancho que sobra se lo queda **Detalle**, que es lo
único que se escribe largo.

### Semanas de obra y flujo
Cada gasto sabe en qué **semana de obra** cae: se calcula de la fecha, no se
carga. `lib/semanas.ts` es puro (lo usan el listado y el formulario, que corren
en el cliente) y no necesitó migración: sale de `obras.fecha_inicio`.

Las semanas van de **lunes a domingo**, contadas desde el lunes de la semana en
que arrancó la obra —no en bloques de siete días desde la fecha exacta—. En obra
la semana es la del calendario y a los contratistas se les paga el viernes; con
un inicio que cayó miércoles, contar de a siete días correría el número. Si la
obra arrancó un miércoles, esos tres días son igual la semana 1.

Ojo, esto ya nos pasó: **el número depende de `fecha_inicio`**, así que si ese
campo está mal las semanas salen corridas y no se parecen a las que uno viene
escribiendo a mano. En 3 De Febrero decía 02/02/2026 y la obra había arrancado
el 20/02: daba dos semanas de más.

Lo anterior al arranque —acopios de material, anticipos, señas— **no cae en
ninguna semana**. En vez de dejar el lugar en blanco (que se lee como un dato
que falta) va la etiqueta **"Previo al arranque"** en ámbar (`ui.tagPrevio`);
el formulario lo avisa al elegir la fecha, y en el flujo tienen su propia fila,
que entra al acumulado para que la columna cierre con el total.

La semana se muestra debajo de la fecha, no en su propia columna: es la misma
respuesta contada de otra manera. También la encuentra el buscador ("semana 22").

**La semana no se muestra en el listado de gastos.** Se calcula de la fecha y su
trabajo es agrupar en el flujo; en la tabla no ocupa lugar. La columna Detalle
tiene sólo lo que se escribió, y si no se escribió nada **queda vacía** —tampoco
va "Previo al arranque"—. El buscador sí la encuentra: "semana 11" filtra igual
aunque no esté a la vista.

Se probó al revés, con una etiqueta "Semana 22" delante del texto en las cuatro
tablas de gastos (había un `DetalleDeGasto` para eso). Con datos reales quedaba
al lado del texto que uno escribe, que muchas veces dice lo mismo, y la columna
se veía cargada de una información que ya está en la fecha.

**Y el detalle es opcional.** Era obligatorio y casi siempre terminaba siendo la
semana escrita a mano; con la fecha, el rubro, el destino y el monto el gasto ya
está identificado. Vacío se guarda como `null`, no como cadena en blanco. Ojo con
eso al mostrarlo: un `null` en JSX **no dibuja nada y TypeScript no lo marca**,
así que una columna Detalle vacía pasa desapercibida. En la tabla de movimientos
de Ingresos cae a "Sin detalle", para que la fila no quede con un hueco mudo que
se confunda con un dato que faltó cargar.

Hubo un intento de que la semana fuera un **dato cargado y corregible**
(`gastos.semana`, con una casilla en el formulario), pensando en el pago del
lunes que corresponde al trabajo de la semana anterior. Se descartó al día
siguiente por simplicidad: que la semana salga siempre de la fecha deja a todos
los gastos identificados igual, sin depender de que alguien se acuerde de
marcarla, y el flujo puede agrupar por semana con todo adentro. La columna se
borró en vez de dejarla sin uso —mismo criterio que con `contacto` en
proveedores—; si el caso vuelve, es agregarla de nuevo.

La solapa **Flujo** contesta *cuándo* se gastó, que es lo que los totales no
dicen: un gráfico de barras por mes (gastos e ingresos, `GraficoBarras`, SVG sin
librerías como el de torta) y nada más. Los meses sin movimiento aparecen igual:
una obra parada es información y saltearlos deformaría el gráfico. El promedio
por mes se calcula sobre los meses **con** gasto —dividir por los parados lo
hunde y no
dice nada del ritmo real—.

Los ingresos de esa pantalla son lo que entró **a la cuenta**; muchos gastos los
paga una socia de su bolsillo sin pasar por ahí, así que las dos columnas no se
restan entre sí: el acumulado es de gastos, no un saldo de cuenta.

Ojo con el `viewBox` de `GraficoBarras`: es de **ancho fijo** y los grupos se
reparten adentro. Con un ancho proporcional a la cantidad de meses, dos meses
estirados al ancho de la pantalla agrandaban la tipografía cuatro veces.

**La solapa Flujo es sólo el gráfico.** Tenía debajo una tabla mes a mes y un
acordeón semana a semana, y entre las tres decía lo mismo de tres maneras. Acá se
viene a ver la forma; el monto exacto de cada barra aparece **al pasar el mouse**
(el `title` de cada rectángulo) y lo que da la magnitud es el **eje de la
izquierda**, con sus líneas de referencia. Se probó escribir los montos sobre las
barras —girados, con halo blanco— y ensuciaba justo lo que tiene que leerse de un
vistazo.

Las marcas del eje usan `formatMoneyEje` ("$ 4 M", "$ 500 k"), el **único lugar
de la app donde se redondea**: no es un dato sino una referencia para leer una
altura de reojo. El techo se redondea al múltiplo lindo más cercano
(`escalaDe`), porque marcas en "$ 12.904.662" no se leen de costado.

**Tocando un mes se entra a `flujo/[mes]`**: ese mes semana por semana, con cada
barra de gastos **partida por rubro** —apilada, en los colores de
`lib/paleta-rubros.ts`—, la tabla de semanas y en qué se gastó el mes. El
desglose por rubro va acá y no en el gráfico de meses a propósito: arriba lo que
se busca es el ritmo, y partir cada barra en cinco colores lo tapaba; recién
entrando a un mes uno pregunta "¿en qué se fue?". El orden del apilado sale del
peso de cada rubro **en el mes entero**, no semana a semana, o las barras no se
pueden comparar entre sí.

El **arranque de la obra** se marca con una línea de puntos ámbar rotulada
"Arranque de obra" (`PuntoBarras.marca`), en el gráfico de meses y en el del mes.
Sin eso, lo que queda a la izquierda parece obra y no lo es: son acopios de
material, anticipos e impuestos del terreno, que a veces se vienen pagando de
mucho antes. Se probó en cambio partir lo previo por tipo de gasto y se descartó:
el problema no era qué tipo eran sino que no se entendía por qué estaban ahí.

La marca sólo aparece si **quedó algo a la izquierda**: pegada al borde no separa
nada. En el gráfico de meses eso significa que la obra tiene movimientos en un
mes anterior al de arranque; en el del mes, que hay gastos previos. Los hitos se
dibujan en su propia pasada y **fuera del enlace** de cada grupo: una línea
clickeable que lleve a otro mes sería una trampa.

Ojo con filtrar un mes: **`fecha` es una columna `date`, no texto**, así que
`like "2026-05-%"` no filtra nada y la consulta vuelve vacía **sin dar error**
—pasó, y el mes se veía en cero—. Va por rango, `gte(desde)` y `lt(hasta)`, con
`hasta` en el primer día del mes siguiente para no tener que saber si el mes
tiene 28, 30 o 31 días (`rangoDeMes` en `lib/meses.ts`).

En Flujo **no hay "resultado del mes"** aunque el gráfico muestre las dos series
juntas, por lo mismo de siempre: los ingresos son lo que entró a la cuenta y
muchos gastos los paga una socia de su bolsillo sin pasar por ahí. Restarlos
daría un número que no es el saldo de nada.

**Los colores todavía no coinciden con la torta de Economía.** Comparten la
paleta, pero cada gráfico la reparte según el orden en que le llegan los rubros,
y en Economía el lote ocupa un lugar y corre a todos los demás: albañilería sale
azul allá y negra acá. Para unificarlo habría que darle al lote un color fijo
—no es un rubro— y dejar que los rubros tomen la paleta por su propio orden.

### Cómo se sale de una pantalla de detalle
A un mes del flujo, a un rubro, a un proveedor, a los contratistas se entra
desde otra pantalla y **no están en las solapas**, así que salir dependía del
botón del navegador. Cada una lo resolvía a su manera —un botón a mitad de
página, una nota gris al pie, o nada— y en el mes del flujo directamente no se
encontraba.

`components/Volver.tsx`: siempre el mismo, siempre **arriba del título**, con el
nombre de adónde vuelve ("← Balance", "← Gastos", "← Flujo"). Dice adónde va y
no "volver" a secas, que obliga a adivinar. La pantalla de destino se llama
**Balance** —el nombre de la solapa que queda marcada al llegar— aunque su
título grande diga "Economía": lo importante es que todas las vueltas al mismo
lugar se llamen igual.

**Gastos es un caso aparte**: es una solapa, así que normalmente no lleva
vuelta —se sale por las mismas solapas—, pero entrando desde una tarjeta del
Balance funciona como detalle y ahí sí la muestra. De eso se encarga el `ver` de
la URL; un `ver` inventado se ignora y la pantalla abre sin filtro ni vuelta.

Los formularios no llevan: ya tienen **Cancelar** al lado de Guardar, que es la
salida que corresponde ahí.

### Beneficio estimado (si el negocio cierra)
La app contestaba cuánto sale la obra, pero no si conviene. La solapa
**Beneficio** (última de Economía) pone las dos patas juntas:

    Venta estimada     = valor de venta por m² × superficie de **venta**
    − Costo de obra    = objetivo por m² × superficie de **construcción**
    − Terreno          = lo pactado + los gastos de la operación
    = Beneficio, y el margen sobre la venta

El **valor de venta** (`obras.valor_venta_m2_usd`) se carga a mano en Editar
obra: es una estimación que se corrige con el mercado, no sale de ningún dato
del sistema. Por eso es una columna suelta y no una vista.

Va por m² de **venta** y no de construcción porque lo que se cobra es lo
vendible. Y el costo de obra se mide contra el **objetivo**, no contra lo
cotizado ni lo gastado: es el número con el que se decidió arrancar, está
completo desde el día uno y no se mueve. Lo aprobado hoy cubre casi sólo mano
de obra y lo gastado sube mientras la obra avanza; con cualquiera de los dos el
beneficio saldría inflado. El terreno entra por lo pactado y no por lo pagado:
el saldo también hay que ponerlo.

Con cualquiera de las cuatro patas en falta **no muestra medio número**: dice
qué hay que cargar. `lib/beneficio.ts` es puro y devuelve null en ese caso.

Vive en Economía y no en Obra —donde estuvo un rato—: no habla de cómo va la
construcción sino de si el negocio cierra. Es la pregunta del desarrollador, no
la del director de obra. En **Estado** quedó lo otro: el valor del m² real
(objetivo, cotizado, gastado, gastado por m² de venta) en cuatro números
pelados. Se sacó de ahí la proyección "si sigue a este ritmo termina en", que
con 4% de avance daba US$ 2.744 el metro contra un objetivo de 800: no servía
para decidir nada. El cálculo sigue en `lib/metro-cuadrado.ts` por si vuelve.

### Fotos por rubro
Las fotos se agrupan **por rubro en acordeones cerrados** —"Albañilería · 2
fotos · 2 cargas"—, y adentro va una carga por registro con sus miniaturas. Con
varias cargas la lista de tarjetas era interminable. Con un solo rubro a la
vista (filtrando por uno) el acordeón abre solo: cerrado sería una pantalla con
una línea y nada más.

El visor ampliado recorre todas las fotos con las flechas **en el orden en que
se ven**: la lista plana se arma sobre el orden ya agrupado, o las flechas
irían a otro lado que la vista.

Ojo con el compilador de React acá: los `useCallback` atados a listas que se
arman en el render lo obligan a saltear el componente entero
(`react-hooks/preserve-manual-memoization`, que es **error** y no warning).
Quedaron como funciones sueltas —de memoizar se encarga el compilador— y el
efecto del teclado depende sólo de cuántas fotos hay, que es un número.

### Materiales: qué se compró, no sólo cuánto salió
Un gasto de materiales dice "Corralón Chivilcoy, $ 5.218.446": sirve para la
plata, no para la obra. El **detalle** lo completa: 2.500 ladrillos, 40 bolsas
de cemento, y a cuánto cada uno.

Dos tablas (`20260820130000_materiales.sql`). El **catálogo** (`materiales`:
nombre, unidad, rubro opcional) es **uno solo para todas las obras**, como el de
proveedores, y con su mismo RLS: agregar lo puede hacer cualquiera —hace falta
al cargar un gasto—, modificar y borrar es de admin. El **detalle**
(`gasto_materiales`) cuelga del gasto con `on delete cascade` —sin él no
significa nada—, pero el material usado no se puede borrar del catálogo
(`restrict`).

**El monto del gasto no sale del detalle.** Sigue siendo el de la factura, que
puede traer el IVA adentro, un flete o un descuento que no son items. La suma se
muestra al lado como referencia y **no se avisa si no coincide**: en toda
factura A sería un aviso permanente. Por eso el precio unitario es opcional (la
cantidad no) y una fila a medio llenar no se guarda, en vez de rechazar el gasto
entero.

En el formulario el bloque se llama **"Detallar materiales de compra"** y no
"Detalle": el campo de arriba ya se llama Detalle —el texto libre del gasto— y
dos cosas con el mismo nombre en la misma pantalla se confunden. Los items se
agregan con el **"+" verde de cada fila**, que inserta la siguiente **abajo de
ella** (así se lee una factura, renglón por renglón), y se sacan con la "✕"
roja. Sin filas, el "+" va suelto: no hay dónde ponerlo.

La solapa **Materiales vive en Obra**, no en Economía: la plata de esas compras
ya está en Gastos; acá interesan las cantidades.

Adentro tiene **dos solapas propias** (`components/MaterialesNav.tsx`, mismo
patrón y estilo que `EditarNav`, con una ruta por solapa):

- **Resumen** (`materiales`) — "lo que se usó por rubro": acordeones que se
  arman solos con el detalle de cada gasto, sumando las compras del mismo
  material en un renglón. Acá no se carga nada.
- **Catálogo** (`materiales/catalogo`) — la lista que se ofrece al detallar una
  compra, con el alta y la edición, también en acordeones por rubro.

Estaban las dos apiladas en una sola pantalla y el catálogo quedaba abajo de
todo el consumo: para corregir un nombre mal escrito había que bajar una pared
de acordeones. Son dos preguntas distintas —qué entró a la obra, y qué se puede
elegir al cargar—, y una se consulta mientras la otra se edita.

Ojo con los server actions: viven en `materiales/actions.ts` (compartidos) pero
`rutaDeVuelta` apunta a **`materiales/catalogo`**, que es donde están los
formularios. Volver al resumen dejaría el "listo, se guardó" sin mostrar qué
cambió. Por lo mismo, los enlaces de `ItemsDeMaterial` ("cargar un material
nuevo al catálogo") van a la solapa del catálogo y no a la sección.

Sin precio cargado el costo va con guion y no con cero, que se leería como
"salió gratis".

Los items viajan al server action como **tres listas paralelas**
(`item_material`, `item_cantidad`, `item_precio`) que se cruzan por posición:
es como el navegador manda un campo repetido, y evita inventar un formato propio
adentro de un input. Al guardar se reemplaza el detalle entero (borrar e
insertar): no tiene historia propia y nadie referencia sus `id`.

### El presupuesto también lleva los materiales
Un presupuesto de corralón **ya es** una lista de materiales con cantidades y
precios: guardarlo como un monto solo (`presupuestos.monto`) era tirar casi todo
el papel. Ahora lleva su **número** (`presupuestos.numero`, texto: viene
"P-0012/26", con letras y barras) y sus items en `presupuesto_materiales`,
espejo de `gasto_materiales` (`20260821120000_presupuesto_materiales.sql`).

Al cargar un gasto de materiales, si el proveedor elegido tiene presupuestos con
items aparece **"Traer de un presupuesto"**: se elige uno por número/fecha/monto
y los items entran hechos. Después se sacan con la ✕ los que no vinieron y se
corrigen las cantidades. `gastos.presupuesto_id` guarda de cuál salió.

Cuatro decisiones que conviene no deshacer:

- **La carga a mano en el gasto no se sacó.** Los presupuestos grandes se
  cotizan primero; la compra chica se carga directo en el gasto, como siempre.
  El presupuesto es de dónde se **copia**, no dónde viven los items.
- **El gasto se queda con copia propia**, no apunta a la lista del presupuesto.
  Lo cotizado y lo comprado son dos hechos distintos: si el gasto la
  referenciara, corregir un presupuesto viejo reescribiría qué se compró. Por
  eso `presupuesto_id` es `on delete set null` —la compra ocurrió igual— y los
  items del gasto siguen colgando del gasto.
- **No se elige solo aunque haya uno.** Un corralón puede tener varios
  presupuestos abiertos en la misma obra, y traer el equivocado en silencio es
  peor que un click de más. Se filtra por **proveedor y no por rubro**: la
  compra puede ir a otro rubro que la cotización.
- **El monto puede salir de los items, pero sólo en el presupuesto.** Con la
  casilla *"Sumar los materiales cotizados"* el campo pasa a sólo lectura (gris)
  y muestra la suma, que se actualiza sola al tocar un renglón. Destildada, se
  escribe a mano como siempre. En el **gasto no existe la casilla**: ahí el monto
  es el de la factura, que trae IVA, flete o descuentos que no son items —esa
  decisión no cambió—. Lo que cambió es el presupuesto, donde el total del
  corralón **es** la suma de sus renglones y rehacerla a mano se desincroniza.
  Se guarda la intención (`presupuestos.monto_desde_items`) y no sólo el número,
  igual que `gastos.cotizacion_manual`: sin eso, al reabrir un presupuesto no se
  sabría si el monto se escribió o se calculó, y editar un renglón dejaría el
  total viejo mintiendo. El monto se **recalcula en el server action**, que no le
  cree al campo del formulario: llega de sólo lectura, pero llega igual.
  La casilla se ata al tipo (`sumando = desdeItems && tipo === "Materiales"`) en
  vez de resetear el estado: si no, pasar a mano de obra dejaba el monto de sólo
  lectura y vacío, sin forma de escribirlo.

#### Un presupuesto, dos facturas
El proveedor puede partir un presupuesto en **dos facturas, una por socia**, para
repartir el crédito fiscal: la factura es de un solo CUIT
(`gastos.empresa_factura_id`) y así cada empresa computa su parte. En la app son
**dos gastos con el mismo `presupuesto_id`** —la FK no es única, no hizo falta
tocar nada— y cada uno con su titular. La plata cierra sola: el *Restante* del
rubro suma los dos contra lo cotizado.

Lo que sí hubo que resolver es el **doble conteo de materiales**. El material
entró una sola vez; partir la factura es un acto fiscal, no una segunda entrega.
Si se trae la lista del presupuesto en las dos facturas, Materiales muestra 6.600
ladrillos donde entraron 3.300, **y nadie avisa**. Por eso:

- El detalle va en **un** gasto y el otro queda sin items, enganchado igual al
  mismo presupuesto. Por eso el desplegable dejó de llamarse "Traer de un
  presupuesto" y ahora es **"Presupuesto del proveedor"**: hace dos cosas
  —vincular y copiar— y sólo la primera es obligatoria.
- Por eso también `getPresupuestosConItems` devuelve **todos** los de materiales
  y no sólo los que tienen items: al segundo gasto hay que poder vincularlo.
- Si los materiales ya están detallados en otra factura del mismo presupuesto,
  **no se traen** y se explica por qué, en ámbar, con un *"Traerlos igual"* por
  si de verdad fue una segunda entrega.
- La etiqueta del desplegable y la ficha del presupuesto dicen **cuánto se
  facturó contra él** ("ya cargado $ 1.000,00", "Facturado $ 1.000,00 en 1 gasto
  · restan $ 9.208.280,90"), que es lo que deja ver si falta la otra mitad.

Ojo con la **auto-exclusión**: al editar un gasto, lo suyo no cuenta como "otra
factura" (`otrasFacturas` filtra por `gasto?.id`). Sin eso, abrir el gasto que
tiene el detalle se avisaría a sí mismo y mostraría su propio monto como ya
cargado.

En la solapa Presupuestos, cada ficha abre **qué se cotizó** en un acordeón
—"7 materiales cotizados · $ 9.209.280,90"— con la tabla material / cantidad /
precio unitario / subtotal, en el mismo orden que el formulario. Antes la ficha
decía cuánto salía pero no qué era, y para verlo había que entrar a Editar. Sin
precio va **guion y no cero**, que se leería como gratis. Acá el `summary` no
lleva `display: flex` —el contenido es una línea sola— así que no hace falta el
truco del `span` para conservar el triangulito.

Ojo con el componente: `ItemsDeMaterial` guarda las filas en estado propio, así
que cambiarle `iniciales` no lo mueve. Traer otro presupuesto lo **remonta** con
un `key` que sube. Y tiene un prop `origen` que sólo cambia los textos (la
factura dice qué se compró; el presupuesto, qué se cotizó). Para que el
formulario pueda usar la suma de monto, avisa el total por `onTotal`: se le pasa
el `setState` de arriba **directamente**, porque su referencia es estable y si no
el efecto se dispararía en cada render.

`lib/items-material.ts` es el módulo puro que comparten los dos server actions:
lee las tres listas paralelas del formulario. `getPresupuestosConItems`
(`lib/presupuestos.ts`) devuelve los presupuestos que **tienen** items —uno sin
detalle sería un renglón que al elegirlo no hace nada— sin filtrar por estado,
porque del que se está por comprar es justamente del que todavía no se aprobó.

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
Ingresos, Flujo, Lote, Dólares, Beneficio) y **Obra** (Estado, Presupuestos,
Avances, Fotos, Documentos, Rubros, Materiales).

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
- **El histórico del blue repite fechas**: cotiza varias veces por día y trae una
  fila por movimiento, no una por día. Vienen de la más nueva a la más vieja, así
  que se guarda la **primera** de cada fecha —el último valor de ese día— y las
  siguientes no la pisan; con un `set` a secas ganaba la más vieja. También trae
  menos días que el oficial (el hueco más grande visto es de 5), que el fallback
  al día anterior más cercano ya cubre.
- **Conversión a dólares**: un monto en pesos no siempre da un número redondo de
  dólares (el centavo de dólar vale ~$15). Redondear siempre para abajo para no
  sobrestimar lo que salió de la cuenta.
- **Errores fantasma de `.next`**: si `tsc` pasa pero el dev server muestra
  errores tipo "defined multiple times" o rutas viejas, es caché. Borrar `.next`
  y recargar.
- **Una migración ya aplicada no se edita**: Supabase la registra por el número
  de versión (el timestamp del nombre), no por el contenido. Si se cambia el
  `.sql` —o se lo renombra manteniendo el timestamp— el `db push` la ve aplicada
  y la saltea: la base queda como estaba y el archivo pasa a mentir sobre lo que
  hay. Pasó agregando `contacto` a proveedores y sacándolo al toque. Se arregla
  dejando la vieja tal cual se aplicó y escribiendo **una migración nueva** que
  deshaga. Antes de tocar un `.sql` ya escrito, `npx supabase migration list`
  dice si está aplicado.
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

Cada rubro se **desglosa por tipo de gasto** dentro de su propia porción, en
**tonos del mismo color**: si Albañilería es verde, su material y su mano de obra
son dos verdes. El tono dice "esto sigue siendo albañilería" y el corte dice
"hasta acá fue material" — con colores distintos se perdía a qué rubro pertenecía
cada pedazo. La leyenda repite el desglose indentado bajo el rubro, atrás de un
"+".

El "+" aparece **aunque el rubro tenga un solo tipo**. Al principio se desglosaba
sólo con dos o más —partir una porción en una sola parte no cambia nada en el
anillo—, pero en pantalla quedaban rubros con "+" y rubros sin, y a los que no lo
tenían parecía faltarles algo: en 3 De Febrero, Instalación sanitaria y Eléctrica
son mano de obra pura y no se podían abrir. Que todo un rubro haya sido mano de
obra es un dato. El anillo sigue igual (un arco solo es la porción entera, y el
primer tono es el color base); lo que cambia es que se puede abrir. El lote no
lleva desglose, que es una compra sola.

`aclarar()` mezcla el color con blanco (0 lo deja igual, 1 lo vuelve blanco); el
paso entre tonos es 0,34. Lo que las partes no cubran —un ajuste de saldo, que no
es Materiales ni Mano de obra ni Administrativo— se dibuja al final en el color
base, para que el anillo no quede con un hueco. `lib/tipos-gasto.ts` tiene la
lista y el orden, que antes repetían Economía, Dólares y el detalle del rubro.

### Buscar / filtrar gastos y pagos del lote
Las listas grandes se filtran del lado del cliente (todo ya viene cargado, se
filtra en JS). Gastos: `components/GastosLista.tsx`, con **filtro estilo Excel**
en cada columna corta (Rubro, Tipo, Destino, Comprobante, Pagó): el ▾ del
encabezado abre un desplegable con una casilla por valor y un "Todos" para
restaurar; el ▾ queda negro cuando esa columna filtra. El desplegable ofrece
**exactamente el texto que muestra la celda** (`valorDe`), así lo que se ve es
lo que se puede elegir. Sin filtro guardado todas las casillas están tildadas, y
volver a tildarlas todas borra el filtro: "sin filtro" es el estado natural de
la columna. Convive con el buscador de texto —el filtro acota, el buscador
encuentra— y con "ocultar anulados".

La columna **Pagó** distingue de qué lado de la cuenta salió el gasto: "Dinero
en cuenta (dólares)", "(pesos)" o "(mixto)". No es lo mismo haber usado dólares
que pesos —los dólares hubo que venderlos, y a un cambio que decide el gasto—, y
como es el texto de la celda el filtro los separa solo. Lote: `components/PagosLoteLista.tsx` (buscador de texto). Las páginas
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
- **"Mano de obra con materiales" como tercer tipo de cotización**: hay
  contratistas (un plomero, por ejemplo) que cotizan con los materiales
  incluidos, y hoy hay que partirlo en dos o mentirle al tipo. Toca el `check`
  de `presupuestos.tipo`, el trigger `chequear_presupuesto_coherente` (lo
  cotizaría un Contratista), qué bloques muestra la solapa Presupuestos, y —para
  que la comparación cierre— también `gastos.tipo_gasto`, el form de gastos y la
  fila de "En qué se gastó". Falta decidir si necesita su propia casilla en el
  rubro o alcanza con `usa_mano_obra`.
- **Más de una cotización aprobada por rubro**: hoy lo impide el índice único
  `presupuestos_una_aprobada` (obra, rubro, tipo). El caso real es un contratista
  que deja la obra por la mitad y otro que cotiza para terminarla. Antes de
  sacarlo hay que definir **qué es "lo cotizado"** de ese rubro: no es la suma de
  las dos (el segundo no rehace lo que ya hizo el primero) ni sólo la primera.
  De eso dependen la ejecución presupuestaria, el detalle por rubro y el avance
  ponderado, que se apoyan todos en `obra_presupuesto`.
- **Semana por contratista**: la semana se cuenta desde el arranque de la obra,
  pero en el concepto de los gastos está escrita a mano la del contratista
  ("Semana 2" de Franco, "Semana 8" de Patricio, que entraron después). Marcar
  la semana en el gasto lo alivia —se puede corregir el número—, pero la cuenta
  sigue siendo una sola y la del contratista queda escrita en el texto. Si
  conviene, se puede numerar desde el primer gasto de cada proveedor.
- **Filtrar por semana en Gastos**: ahora que la semana es un dato y no texto,
  puede sumarse a los filtros estilo Excel del listado, al lado de Rubro y Tipo.
  Quedó afuera de esta tanda.
- **Acopios en el gráfico mensual**: lo previo al arranque está separado en la
  tabla semanal, pero en el gráfico por mes suma como un gasto más de febrero.
  Falta decidir si el mes también los distingue.
- **Datos de prueba en 3 De Febrero**: el valor pactado del lote, las cuotas y la
  superficie (160 m²) son de prueba. Reemplazarlos por los reales cuando se
  cargue la obra en serio.
- **Los presupuestos de compra van a llenar la solapa Presupuestos**. Hoy
  `presupuestos` significa "el presupuesto del rubro": la ejecución
  presupuestaria, "Resta pagar", el detalle por rubro y el avance ponderado
  salen todos de la cotización **aprobada**, una sola por obra+rubro+tipo (índice
  único `presupuestos_una_aprobada`). Pero el corralón pasa **un presupuesto por
  entrega**, y ahora que llevan items van a entrar todos en la misma tabla. Por
  ahora quedan en Pendiente, así que no tocan ninguna de esas cuentas y el
  acordeón del rubro los lista como una cotización más. Cuando molesten hay dos
  salidas: separarlos visualmente de la cotización del rubro, o decidir que "lo
  cotizado" de materiales es la suma de varios aprobados —que es el mismo nudo
  de "más de una cotización aprobada por rubro", más arriba—. Los datos ya
  quedan cargados para cualquiera de las dos.
- **Comparar cotizado contra comprado, item por item**: ahora que el presupuesto
  y el gasto guardan las mismas filas, se puede contestar "el ladrillo se cotizó
  a $450 y se facturó a $470" o "pediste 2.500 y vinieron 2.400". No está hecho:
  hoy los items del gasto se traen del presupuesto y ahí se corta.

## Cómo retomar en una sesión nueva

Decir: "leé CONTEXTO.md y el README para ponerte al día". Con eso alcanza para
tener el panorama completo: qué es la app, cómo está armada, qué se decidió y qué
falta.
