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
- **Los títulos de columna van en negro** (`ui.th`, 30/09/2026). En gris claro
  la fila de encabezados se leía como un renglón más de datos: el rótulo manda
  sobre lo que tiene debajo y el color es lo que lo dice. El tamaño chico y las
  mayúsculas se mantienen —un título grande le robaría la atención a los
  montos—. El triángulo del filtro también es negro (`ui.botonFiltro`), así que
  el estado ya no lo puede dar el color: lo da la forma, `ui.FILTRO_PUESTO`
  relleno cuando la columna filtra y `ui.FILTRO_SIN_PONER` de contorno cuando
  no. Los rótulos de tarjeta (`ui.label`, "TOTAL GASTADO") siguen en gris: son
  el nombre de un número, no el título de una columna.
- **Cada columna, alineada con su título** (06/10/2026): el `th` lleva el
  mismo relleno lateral que sus celdas y la misma alineación. Campos que se
  escriben (cantidades, precios unitarios) centrados bajo el título; montos
  calculados a la derecha. Con rellenos distintos (`ui.th` 12px y una celda de
  6px) la columna queda corrida y se nota.
- Los comentarios explican el **porqué**, no el qué. Mantener ese estilo.
- `formatMoney` y `formatUSD` muestran **dos decimales** (los gastos se cargan al
  centavo). En dólares importa igual o más: $ 1.200.000 al cambio de 1.433,90 son
  US$ 836,88, y mostrar US$ 837 inventa doce centavos. La conversión se guarda al
  centavo desde siempre —`convertirMonto`—; lo que redondeaba era el formato.
- **Todo campo de plata es `InputMonto`**, no un `<input type="number">`: se
  escribe con coma decimal —y **la tecla punto también es la coma**, porque es
  la que tiene el teclado numérico— y los puntos de miles aparecen solos
  (1.235.879,35), porque en un monto grande sin puntos no se sabe si son cientos de miles o
  millones hasta contar dígitos, y así se cargan ceros de más. Lo que viaja al
  servidor es el número limpio ("1235879.35") por un input oculto con el `name`
  del campo: los server actions siguen haciendo `Number(formData.get(...))`.
  Sirve controlado (`value` limpio + `onChange` limpio) o con `defaultValue`.
  Las cantidades que no son plata (m², unidades, pisos, cantidad de un item,
  porcentajes) siguen siendo `type="number"`.

## Modelo de dominio y decisiones (lo que no es obvio del código)

### Los cuatro roles (30/09/2026)
`admin`, `desarrollador`, `inversor` y `comprador`, en `lib/roles.ts` (módulo
puro: nombre, emoji y alcance de cada uno) y en el `check` de `perfiles.rol`.

**`empresa` pasó a llamarse `desarrollador`**: es el mismo usuario —el de una
socia, que ve las obras donde su empresa es socia— con el nombre con el que se
lo piensa. Por eso fue un rename y no un rol nuevo, y **ninguna policy se
tocó**: todas se apoyan en `empresa_id`, no en el nombre del rol. El alcance no
cambió: "ve todo" es todas las solapas de sus obras, no las obras de las demás.

**Inversor y comprador existen como rol pero no ven nada todavía.** No
pertenecen a ninguna empresa, así que `puede_ver_obra()` no les matchea
ninguna: entran y no encuentran obras. Es la falta segura mientras sus
pantallas no existan —la otra sería mostrarles la obra entera—. Lo que van a
ver (su parte y el avance, no la economía) está en Pendientes.

El `perfil_coherente` quedó en una línea: `rol = 'desarrollador' or empresa_id
is null`. Sólo el desarrollador pertenece a una empresa; el administrador las
ve todas y los otros dos no son de ninguna. Un desarrollador sin empresa sigue
siendo el pendiente de asignación de siempre.

**El emoji sale del rol y no se elige** (🔑 🏗️ 💰 🏠). Dos inversores se ven
iguales a propósito: lo que hay que reconocer de un vistazo es de qué lado está
cada uno, no quién es. Son objetos y no caras —la llave, la grúa, la plata, la
casa— para que no le compitan a los íconos de trazo del resto de la app, que
no usa ninguna librería de íconos.

Organizar usuarios es del administrador: `/usuarios` redirige al resto y la
barra lateral ni les ofrece el destino (`AppSidebar` pasó a ser server
component para poder leer el rol; la franja en sí quedó en
`AppSidebarRail`). La base ya lo garantizaba —la policy de `perfiles` sólo le
deja ver el suyo a los demás—, pero sin eso un desarrollador entraba a una
pantalla que se veía rota en vez de a una que no le corresponde.

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
- **Un gasto en pesos pagado con los dólares de la cuenta.** En la cuenta
  suele haber sólo dólares y el papel dice pesos. La casilla *El gasto es en
  pesos: descontar dólares al cambio* (dentro de "Pagar con el dinero en
  cuenta") pide el monto en pesos (`caja_pesos_en_dolares`) y los dólares
  salen de dividir por el cambio, al centavo, en `resolverMontos`. Como
  redondear los dólares desvía unos pesos (6,51 × 1.535 = 9.992,85), el cambio
  que se guarda es el **implícito** (pesos ÷ dólares) para que el gasto quede
  exactamente en los pesos cargados; la moneda del gasto queda en **ARS**
  aunque de la cuenta hayan salido dólares. Si los dólares no alcanzan, el
  resto lo pone una socia, como siempre. **Ojo con el redondeo**: `cotizacion`
  es numeric(14, 4), así que `caja_usd × cotizacion` (la columna calculada
  `monto_caja`) se aparta de `monto` hasta medio diezmilésimo por dólar —15
  centavos con US$ 3.000—. El check `gastos_caja_coherente` tolera un
  diezmilésimo por dólar además del centavo, y las pantallas que preguntan "¿la
  cuenta cubrió todo?" (listado de gastos, movimientos de Ingresos, ficha)
  comparan con **medio peso** de tolerancia, no al centavo.
  **El modo se guarda** (`gastos.pesos_con_dolares`, 25/09/2026). Antes sólo
  quedaba el resultado, y al editar el formulario rearmaba el gasto como
  dólares cargados a mano: la casilla aparecía destildada, el cambio se
  mostraba —y se volvía a mandar— redondeado a dos decimales (1.443,00 en vez
  del implícito 1.443,0005), y aparecía "el dinero en cuenta no alcanza, falta
  $ 0,11". Ahora se guarda la intención, igual que `cotizacion_manual`, y al
  editar vuelve el modo con los pesos del papel (el monto). La migración marcó
  los que ya estaban por cómo habían quedado: moneda ARS, dólares de la cuenta
  y ningún peso de ella (un gasto en dólares queda con moneda USD). La
  cotización manual se muestra siempre a dos decimales, que es lo que el campo
  manda.

**Aporte de todas las socias a la vez.** Cuando la obra pide plata la suelen
poner todas el mismo día, así que el desplegable de empresa ofrece "Ambas
empresas" (o "Todas las socias" si son más de dos). Se carga un monto total y
se **divide en partes iguales** —no por el porcentaje de participación: eso es
el reparto del gasto, no de lo que cada una decide poner—; con la casilla
*Aportan montos diferentes* aparece un campo por empresa y el total es la
suma. No hay un modelo nuevo: se guarda **un ingreso por socia** con su
parte, y el balance, la caja y los listados no se enteran. Cada uno se edita
y se borra por separado; el comprobante, si lo hubo, se sube una vez por
ingreso para que borrar uno no deje al otro sin archivo. La opción sólo está
al crear: un ingreso guardado es de una sola empresa.

**Agenda de ingresos** (botón al lado de *Nuevo ingreso*; ruta
`ingresos/agenda`). Los aportes de las socias a veces vienen en cuotas de
afuera —otro emprendimiento que se está cobrando y cuyas cuotas entran acá
como aporte de las empresas— y los ingresos reales no dicen cuánto falta ni
cuándo. La agenda es una capa de planificación encima: tabla
`ingresos_previstos` (empresa, fecha prevista, monto en su moneda, detalle,
serie y número de cuota), **sólo para socias** —los inversores y compradores
tienen su compromiso total en su propia agenda y con eso alcanza—. Nada de
esto toca la caja ni el balance: la plata cuenta recién cuando entra.

Se cargan **en serie**: cantidad, monto habitual y primera fecha, y la lista
se arma sola (una por mes, el 31 cae al último día del mes corto) con cada
fila editable, porque lo normal es "11 de 4.000 y una de 6.000". El detalle no
se escribe: es *Cuota Nº x*, con el concepto adelante si se puso. "Ambas
empresas" reparte cada cuota en partes iguales y da una serie por empresa.

**Cumplir una cuota es cargar el ingreso real** desde *Registrar ingreso* en
la fila: abre el alta de ingreso con todo precargado y el ingreso guarda
`previsto_id` (único: una cuota se cumple con un solo ingreso). La agenda
cuenta lo ingresado por lo que entró de verdad, no por lo previsto —si la
cuota de 4.000 entró como 3.800, faltan 200 aunque figure cumplida—. Borrar
la cuota no borra el ingreso (`set null`), y borrar el ingreso deja la cuota
pendiente otra vez. Estados: pendiente, vencida (pasó la fecha y no entró),
ingresada.

### Detalle predefinido (gastos e ingresos)
El detalle es texto libre y así "Jornales", "jornales sem 3" y "Pago jornales"
son lo mismo escrito distinto. Al lado de la etiqueta *Detalle* hay una casilla
**Predefinido** (`DetallePredefinido`, el mismo componente en `GastoForm` y en
`IngresoForm`): marcada, el texto se vuelve un desplegable con el catálogo y
una opción *Agregar uno nuevo…* que abre un campo; lo que se escribe ahí queda
en el catálogo al guardar. El catálogo (`detalles`) es **compartido entre
obras** como proveedores y rubros, y tiene **una lista por ámbito** —Gasto o
Ingreso—: "Jornales" no es un ingreso. El gasto y el ingreso siguen guardando
`concepto` como texto —no hay FK—: el catálogo es una ayuda para escribir
igual, y si sumar el nuevo fallara la carga se guarda lo mismo. Al editar, la
casilla arranca marcada si el detalle guardado está en su lista. Lo alimenta
cualquiera que cargue (los usuarios de empresa no son administradores); borrar
o renombrar es del administrador, por ahora sólo desde la base.

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

### Cómputo y presupuesto estimado (06/10/2026)
Presupuestos tiene dos solapas: **Cotizaciones** (lo de siempre) y **Cómputo**.
El cómputo es el tercer número de la obra, el de antes de cotizar: cantidad ×
precio de referencia, separado en materiales y mano de obra.

- **`tareas`**: catálogo común a todas las obras, cargado con la tabla de
  costos unitarios de **Revista Cifras #367** (236 tareas; costo directo, sin
  gastos generales, beneficio ni IVA). Lo que Cifras llama "costo de
  ejecución" es `precio_mano_obra`. El rubro va **por nombre** y se engancha
  sin mayúsculas con el rubro de la obra.
- **Rubros de Cifras**: se sumaron al catálogo los que no existían
  (Movimiento de Tierra, Estructuras, Mamposterías y Tabiquerías, Aislaciones,
  Revoques, Contrapisos, Equipamiento, Varios). Los que ya existían con otro
  nombre para lo mismo **no se duplicaron**: Pinturas → Pintura, Vidriería →
  Vidrios y espejos, Cubierta → Cubiertas y Techos, Preliminares de obra →
  Tareas Preliminares, Sanitaria/Incendio → Instalación Sanitaria.
- **`computos`** (uno por obra, con `mes_precios`) y **`computo_items`**:
  tildar una tarea **copia** nombre, unidad y precios; actualizar el catálogo
  no mueve un cómputo ya usado. Tildar marca el rubro como activo en la obra.
  Hay tareas propias de la obra (`tarea_id` null).
- **`indices_cac`**: un valor por mes, global, se carga a mano. Estimado,
  cotizado y gastado se llevan **a valores del último CAC cargado** antes de
  comparar (`lib/cac.ts`). Un mes sin índice todavía usa el último anterior;
  uno anterior a todo lo cargado queda sin ajustar y la pantalla lo cuenta.
- **Una sola pantalla, estilo SISMAT** (06/10/2026). El cómputo tiene
  cuatro pestañas por `?vista=`: **Tabla de cómputo** (default), **Listado de
  materiales**, **Incidencia de costos** y **Estimado vs. cotizado** (la
  comparación con CAC). Arriba a la derecha: **Excel** (CSV con `;` y coma
  decimal + BOM, que el Excel en castellano abre directo: ruta
  `computo/excel`, con `?vista=materiales` baja el listado), **Imprimir / PDF**
  (`window.print()`; lo marcado `data-no-imprimir` se esconde, ver
  `globals.css`) e **Índice CAC**.
- **Tabla de cómputo**: arriba, el catálogo como **acordeón a lo ancho**
  ("Agregar tareas", `CatalogoComputo`; abierto sólo si todavía no hay nada
  elegido), con buscador, "+ Crear ítem propio" y los rubros en dos columnas
  de diario como máximo (`columnCount: 2`; con tres se veía pegado), cada uno con "Agregar/Quitar todas". Al costado y
  en vertical se veía apretado. Tildar llama `alternarTarea` y agrega **en el
  momento** con su desglose de modelo; no hay "Guardar selección" (las rutas
  viejas `computo/tareas` e `item/[id]` redirigen). Debajo la planilla
  (`PlanillaComputo`) con encabezado agrupado: Tarea · U · Cantidad ·
  Materiales (Unitario | Subtotal) · Mano de obra (Unitario | Subtotal) ·
  [Integrado, sólo si el rubro lo usa] · Total · Desglose ▾ · 🗑. Los
  unitarios salen del desglose y no se editan ahí. El desglose se **despliega
  dentro de la fila** (`DesgloseTarea`, sin formulario propio: guarda con
  `guardarDesgloseDe` y refresca). El tacho llama `quitarItem`. Las
  cantidades siguen yendo juntas con "Guardar cantidades" (`guardarPlanilla`).
  Las acciones directas devuelven `{ error }` en vez de redirigir, y la
  planilla suma las filas nuevas que llegan al refrescar sin pisar lo que se
  está escribiendo.
- **Listado de materiales** (`listadoDeMateriales`): suma los renglones de
  Materiales de todos los desgloses × cantidad de cada tarea, agrupados por
  nombre y unidad. El renglón genérico de Cifras sale como "<tarea> (sin
  desglosar)". **Incidencia** (`incidenciaPorRubro`): % de cada rubro sobre el
  total estimado, sin ajuste CAC.
- **El precio de una tarea sale sólo de su desglose** (migración
  `20261006160000_desglose_modelo`). Materiales + mano de obra suman al
  total; lo integrado va solo.
- **Desglose por tarea** (`computo_item_desglose`): renglones de Materiales /
  Mano de obra / Integrado **por unidad de la tarea** (15 ladrillos por m²).
  `aplicarDesglose` rehace los precios de la tarea (suma por tipo; cero si no
  hay renglones de ese tipo), sus casillas `usa_*` y prende las del rubro
  para Cotizaciones. Para algo cotizado cerrado (el cartel), gl × 1 y
  desglose en montos.
- **Desglose de modelo** (`tarea_desglose`): cada tarea del catálogo trae
  uno, que se **copia** a la obra al tildarla. Arranca con la referencia de
  Cifras; la casilla "Usar también como modelo para otras obras" del
  desglose lo reemplaza para las obras que la tilden después.
- **Nombre y unidad** se corrigen con el lápiz de la fila (lista fija de
  unidades; Confirmar / Enter, Cancelar / Escape; `editarTareaDelComputo`,
  sólo esa fila). Son de la obra, no tocan el catálogo.
- La comparación es **por rubro** (todavía no por tarea). El desvío total usa
  sólo rubros con estimado y cotizado, para que un rubro sin cotizar no haga
  parecer barata la obra.

#### Configurar el catálogo de tareas: Rubros → Tareas (23/11/2026)
Decidido con el usuario: **el cómputo queda para elegir tareas, cargar
cantidades y ajustar el desglose de la obra**; el catálogo de tareas se
configura en **Rubros → "N tareas ›"** (`/obras/<slug>/rubros/<rubroId>`,
`TareasDelRubro`). El catálogo **sigue siendo común a todas las obras**, y la
página lo dice arriba. Ahí: corregir nombre y unidad, abrir la composición por
unidad, borrar, y **crear tareas nuevas del catálogo** (`crearTareaDelCatalogo`;
antes sólo existían los "ítems propios", que quedan en una obra). En el
cómputo, cada rubro de "Agregar tareas" tiene "Configurar tareas ›".

Las tareas del catálogo nombran su rubro **por texto**, y se buscan por el
nombre del rubro de la obra sin mayúsculas. Un rubro de la obra con otro
nombre que el del catálogo ("Aberturas Puertas", "Albañilería") muestra cero
tareas; las que se creen ahí quedan en el catálogo con ese nombre.

#### Corregir el catálogo de tareas (23/11/2026)
El lápiz de cada tarea en la página del rubro corrige **el catálogo**, que es de
todas las obras: nombre, unidad, o borrarla. Cada obra tiene su copia en el
cómputo (con su propio lápiz en la planilla), así que lo del catálogo les
llega sin pisar lo que se decidió en una obra:
- **El nombre** pasa a las copias que todavía tienen el nombre viejo; una
  renombrada a mano conserva el suyo.
- **La unidad** pasa sólo a las copias sin cantidad ni medición. Una que ya
  tiene 85 m² no pasa a "85 m³": queda, y se avisa cuántas obras quedaron así.
- **Borrar sólo se puede si no la usa nadie**: ni el cómputo de ninguna obra
  ni el dibujo de ninguna planta (que la nombra por id en el jsonb). Si está
  en uso dice dónde, para sacarla de ahí primero. Es para limpiar repetidas y
  mal cargadas, no para sacar una tarea de una obra: eso es destildarla.

#### La composición de una tarea del catálogo (23/11/2026)
Cada tarea del catálogo tiene su **composición**: qué lleva una unidad
—ladrillos, mortero, mano de obra por m²—. Es el desglose de modelo
(`tarea_desglose`) que existía desde el 06/10, que sólo se podía tocar con la
casilla "Usar también como modelo" del desglose de una obra. Ahora se edita
desde la página del rubro: "Composición (n)" de cada tarea, que abre el
mismo editor del desglose (`DesgloseTarea` con `modelo`), sin "en la obra"
ni cotizaciones, que son de cada obra.

Decidido con el usuario: **al cambiar la composición se actualizan las obras
que no la tocaron.** `reemplazarModelo` compara la firma del desglose de cada
obra (`firmaDeDesglose`) con la del modelo viejo:
- **Igual**: es lo que vino al tildarla, nadie lo decidió. Se reemplaza por el
  nuevo y se rehacen sus precios.
- **Distinta**, o con un renglón pedido a cotizar: es trabajo de esa obra, se
  conserva. Su desglose avisa "distinto de la composición del catálogo" con
  un botón **Traer la del catálogo**, que la carga sin guardar.
La casilla "Usar también como modelo" del desglose de una obra pasa por lo
mismo. Al guardar se dice en cuántas obras se actualizó y cuántas la
conservan.

#### Presentaciones comerciales y qué comprar (23/11/2026)
Un material declaraba un solo envase (bolsa de 25 kg). Ahora puede tener
varias **presentaciones** —lata de 1, 4 y 10 litros, balde de 20— en la tabla
`material_presentaciones` (migración `20261123120000`), que se cargan en el
catálogo de materiales debajo de cada uno ("Se vende en"). La unidad de una
presentación tiene que ser la del material o la de su envase: si no, no se
puede comparar con lo que pide el cómputo.

El **Listado de materiales** suma cada material **en su unidad base** —la de
lo que trae el envase si declara uno: 5 kg de cemento, no 0,2 bolsas— y
agrega la columna **A comprar** (también en el Excel), con la combinación que
cubre lo necesario sobrando lo menos posible y, a igual sobrante, con menos
envases (`lib/presentaciones.ts`, `compraMinima`): 27 litros son 1 balde de
20 + 1 lata de 4 + 3 latas de 1; 5 kg de cemento, 1 bolsa de 25. Sin
presentaciones vale el envase del material ("envase de 25 kg" si su unidad es
"un"); sin envase, lo que se compra de a uno (un, bolsa, barra, chapa, rollo,
caja, pallet) redondea a la unidad entera, y lo que va a granel (kg, m³) no
dice nada. Las presentaciones se leen aparte del catálogo y tolerando error:
si la tabla falla, los formularios de gasto siguen abriendo.

### De dónde sale cada número del cómputo (20/11/2026)
Tres capas nuevas con la misma idea atrás: **guardar lo que se sabe y derivar
lo que se necesita**, en vez de guardar el resultado y perder la cuenta. Antes,
un desglose decía "0,6 bolsas por m²" y una tarea decía "22,28 m³": los dos
números eran correctos y ninguno se podía verificar.

- **El envase del material** (`materiales.contenido`, `contenido_unidad`):
  cuánto trae la bolsa en la que se compra. Opcional, y las dos columnas van
  juntas o no va ninguna (`check` en la base): un "30" sin unidad no convierte
  nada. Va en el material y no en la tarea porque la misma bolsa de 30 kg
  sirve para el revoque grueso y para el fino.
- **El consumo del renglón** (`computo_item_desglose.consumo` y
  `consumo_unidad`; lo mismo en `tarea_desglose`): se carga **18 kg por m²** y
  la cantidad en bolsas sale de dividir por el contenido. `cantidad` sigue
  mandando en todos los precios; el consumo la **explica** y la rehace si
  mañana la bolsa cambia de tamaño. Se guardan las dos, y al leer el cómputo
  la cantidad se recalcula si el consumo está y su unidad es la del envase. La
  regla vive sola en `lib/consumo.ts`, sin importar nada, porque la usan el
  servidor al leer y la pantalla al escribir: si cada uno convirtiera a su
  manera, la fila mostraría un número y la base guardaría otro.
- **La medición de la tarea** (`computo_item_medicion`): de dónde salen los
  22,28 m³ de vigas. Un renglón por elemento medido, con `nivel` (texto
  libre), `etiqueta` (V-201), `forma` y `unidades`. La forma dice qué se
  multiplica —`prisma` a×b×c, `superficie` b×c (espesor por área),
  `directo` c (un volumen ya calculado aparte)— porque meter las tres en una
  sola columna es lo que vuelve ilegible una planilla. La cantidad de la tarea
  es la suma y **la calcula el servidor** al guardar: de ella salen los precios
  y el peso del avance físico. Un elemento al que le falta una medida de las
  que su forma pide **no suma** y se cuenta aparte, así lo que falta medir se
  ve restando. Reglas en `lib/medicion.ts`.
- **La medición se pide al abrir**, no viene con la planilla: una tarea puede
  tener 250 elementos y casi nunca se miran. En pantalla van en **bloques por
  nivel**, con el nombre del piso y su subtotal arriba, y plegables; una
  medición de más de 24 elementos llega plegada (las 132 vigas de Andonaegui
  medían 7.082 px abiertas y 482 plegadas). El bloque se identifica por una
  clave propia y no por el nombre del nivel, porque dos bloques nuevos se
  llaman los dos "" y agruparlos por texto los fundiría.
- **"Pegar desde Excel"** lee las columnas **por posición** (tipo · ID · ancho
  · alto · largo · unidades · volumen · estado · fuente · nivel) y usa seis. La
  columna de volumen se descarta: el resultado lo rehace la app. Se saltean
  solos los títulos, los subtotales y **el resumen del final**, que es el que
  casi se cuela — sus filas tienen números en las mismas columnas que un
  elemento y sumarlas contaba todo dos veces. Las distingue que una fila de
  totales trae un número donde los elementos traen su nombre.
- **Solapa "Por nivel"** (`lib/niveles.ts`): el cuadro que cierra cualquier
  planilla de hormigón, niveles abajo uno de otro y tareas como columnas. Cada
  celda va en la unidad de su tarea y **no se suman entre sí**; la última
  columna, que está en pesos, sí. Abajo dice cuántas tareas tienen cantidad y
  ninguna medición, y por cuánta plata: sin eso, una obra de la que sólo se
  midió el hormigón mostraría su total y parecería la obra entera.
- **Filtro por rubro** en la planilla: **esconde, no desmonta**. Las filas de
  los otros rubros siguen adentro del formulario, así que una cantidad escrita
  en un rubro y filtrada después se guarda igual. No hay filtro por nivel y es
  a propósito: una tarea vive en todos los pisos a la vez, y filtrarla por uno
  dejaría su cantidad completa abajo de un título que dice "sobre planta baja".
- **Probado con datos de verdad**: el cómputo de hormigón de Andonaegui, 251
  elementos en 5 niveles, pegado en sus cinco tareas. Da 103,080 m³ —22,281 de
  vigas, 48,361 de losas, 13,619 de columnas, 9,725 de escalera y 9,094 de
  tabiques— y el cuadro por nivel reproduce el resumen de la planilla original
  fila por fila, con los 6 elementos de altura pendiente marcados donde van.

### Plantas: medir calcando el plano (22/11/2026)
Solapa **Plantas** del grupo Obra (`/obras/<slug>/plantas`). Una planta es el
plano de un piso —subido como PDF o imagen— con lo que se calca encima: muros
y ambientes. De ahí salen los metros de muro, los m² de pared y los m² de cada
ambiente sin medir a mano. Y esas cantidades **se pasan al cómputo** con un
botón (ver "Del plano al cómputo", más abajo).

Se llama "Plantas" y no "Planos" para que no se lea como Documentos: allá el
plano se archiva, acá se mide. Va en solapa propia y no adentro del Cómputo
porque el dibujo va a servir para más que cotizar (avance, fotos por ambiente).

- **Tabla `plantas`**: una fila por planta, con `altura` (piso a techo: pasa
  metros de muro a m² de pared) y `repeticiones` (cuántos pisos son esa misma
  planta: PB una vez, la tipo de 1.º a 4.º cuatro). Mismo RLS que el cómputo:
  ve quien ve la obra, escribe el administrador.
- **El dibujo se guarda en píxeles de la imagen, no en metros** (`dibujo`,
  jsonb: `{muros, ambientes}`), y la escala son los dos puntos marcados sobre
  la regla del plano más sus metros (`escala`, jsonb: `{a, b, metros}`). Los
  metros se derivan. Así corregir la escala rehace todas las medidas sin mover
  nada, y el calco queda siempre encima del plano. Es jsonb y no una tabla por
  muro porque el dibujo se edita y se guarda entero; las cantidades las hace
  la app.
- **`lib/planta-dibujo.ts`**: la cuenta, pura y sin importar nada, porque la
  usan el editor y el listado. `medir()` devuelve **null sin escala** —no un
  dibujo "en píxeles" que parecería un dato—. Los lectores `leerDibujo` /
  `leerEscala` validan el jsonb al abrir **y** al guardar: un muro roto se
  pierde, el resto de la planta abre.
- **"Pared, una cara"** es largo × altura. No se multiplica por dos: qué cara
  lleva qué terminación es la etapa que sigue, y un total supondría que todas
  se terminan igual. **"Pared sin vanos"** le resta las aberturas, una vez
  —es una cara—; quien mida las dos tiene que descontarlas de las dos.
- **Aberturas** (puertas y ventanas; herramienta Abertura). Van en el mismo
  jsonb (`dibujo.aberturas`), sin migración: un dibujo viejo que no las trae
  abre con la lista vacía. Una abertura **no tiene coordenadas**: vive en su
  muro (`muroId`) a una fracción de su largo (`t`), así se mueve con él y no
  queda flotando si el muro se corrige; borrar el muro se las lleva. El ancho
  y el alto son datos de la carpintería, en metros. **El nombre es un tipo**
  (P1, V2), como en una planilla de carpinterías: cambiarle una medida a una
  P1 se la cambia a todas, y escribir un nombre que ya existe trae sus
  medidas. La planilla (`medir().aberturas`) junta por nombre **y** medidas:
  dos "P1" distintas salen en dos renglones, que es como se ve el error. Se
  colocan con un clic sobre el muro —no asoman por la punta— y con Seleccionar
  se deslizan a lo largo.
- **Una abertura se alinea agarrándola de una esquina.** Seleccionada, muestra
  sus cuatro esquinas —las dos jambas sobre las dos caras del muro—. Agarrada
  del medio se desliza libre, como siempre; agarrada de una esquina, **esa
  esquina** es la que se pega a lo que tenga cerca —la cara de otro muro, un
  rincón, la jamba de otra abertura, una guía— y la abertura va detrás, sin
  salirse de su muro. Hace falta porque lo que se quiere alinear de una puerta
  casi nunca es su centro: es la jamba contra el muro que llega. Sus propias
  esquinas no la atraen —se perseguiría—.
- **Hacer clic en el plano no corre la página.** El lienzo toma el foco al
  tocarlo (para sacarlo del campo donde se escribía), y sin
  `focus({ preventScroll: true })` el navegador desplazaba la página para
  mostrarlo entero: el plano saltaba debajo del puntero justo al hacer clic,
  y el arrastre que seguía caía en otro lado.
- **La mano de la puerta** (`mano`: derecha o izquierda; null en ventanas) y
  hacia qué lado del muro abre (`lado`: 1 o -1 sobre la normal del muro). La
  mano **no es parte del tipo**: la misma P1 se pide derecha en un ambiente e
  izquierda en el de al lado, así que la planilla da un renglón por mano
  ("P1 der. · 2 u", "P1 izq. · 1 u"), que es lo que hay que pedirle al
  carpintero. **Convención: de frente y empujando, el lado de las bisagras**
  (hay quien la nombra tirando, y da lo contrario; por eso la regla está
  escrita debajo del campo). Con la mano y el lado se dibuja la hoja y su
  barrido (`barridoDePuerta`), así lo que dice la planilla se puede comparar
  contra el arco del plano. El lado sale de dónde se hace clic respecto del
  muro, y se invierte desde la ficha; invertirlo mantiene la mano y cambia la
  bisagra de jamba. Una puerta guardada sin mano abre como derecha.
- **El antepecho de la ventana** (`antepecho`, en metros; null en puertas): a
  qué altura del piso arranca. Va **por ventana y no por tipo**, igual que la
  mano: la misma V1 se coloca a 0,90 en un dormitorio y a 1,10 sobre una
  mesada, y la planilla las separa en renglones. **Cero es una ventana hasta
  el piso; null es "sin cargar"**, y así lo dicen la ficha y la planilla: una
  ventana guardada antes de este dato no está a ras del piso, no se sabe. Por
  eso borrar el campo no lo deja en cero. No cambia el vano (ancho × alto);
  sirve para lo que viene —mampostería bajo ventana, dinteles— y para un
  control: si antepecho + alto pasa la altura de la planta, la ficha lo avisa
  en rojo. Una ventana con antepecho cero se lee **"al piso"** en la planilla.
- **Cómo abre la ventana** (`apertura` y `hojas`; null en puertas). Los ocho
  sistemas de cualquier fabricante —de abrir, corrediza, paño fijo,
  guillotina, ventiluz, banderola, desplazable, oscilobatiente— en `APERTURAS`
  (`lib/planta-dibujo.ts`), y de 1 a 6 hojas. Al revés que la mano y el
  antepecho, **son parte del tipo**: una V1 es "corrediza de 2 hojas de 1,20 ×
  1,10", que es lo que se le pide al fabricante, así que cambiarlo en una lo
  cambia en todas las V1 (`cambiarTipo`). La regla para decidir de qué lado
  cae un dato nuevo: **lo que define la carpintería es del tipo; lo que define
  dónde o cómo se coloca es de cada una.** En la planilla van en la segunda
  línea del renglón ("Corrediza · 2 hojas · antepecho 0,90 m"); un paño fijo
  cuenta paños, no hojas. Una ventana guardada sin estos datos dice "apertura
  sin cargar". Las puertas todavía no llevan sistema de apertura (corrediza,
  plegadiza, doble hoja).
- **Un PDF se convierte a imagen en el navegador** antes de subir
  (`NuevaPlantaForm`, pdf.js): lo que va a Drive (carpeta `plantas`) es siempre
  un JPG, de 4.000 px de lado mayor. El editor calca sobre una imagen y el
  servidor no necesita leer PDF. El formulario muestra la página elegida antes
  de subir. `pdfjs-dist` se importa recién al elegir un archivo, y es el build
  **`legacy`**: el común usa JavaScript que los navegadores de hace un año no
  tienen.
- **El editor** (`components/EditorPlanta.tsx`) es SVG puro. Herramientas:
  Seleccionar, Mover, Escala, Muro, Ambiente. La rueda acerca en cualquiera.
  Los muros se trazan **por su eje**, encadenados, y se dibujan con su espesor
  real. Todo punto nuevo se corrige (`ajustar`): se pega a un vértice cercano,
  y trazando a escuadra se alinea con el anterior y se frena a la altura de
  otra esquina o donde cruza un muro (el encuentro en T). Arrastrar un extremo
  mueve todos los muros que comparten esa esquina. Un solo **Guardar** manda
  datos, escala y dibujo juntos (`guardarPlanta`); hay Deshacer (Ctrl+Z).
- **La línea de referencia del muro** (`muros[].referencia`: exterior, centro
  o interior; 22/11/2026). Los dos puntos que se marcan pueden ser el eje del
  muro o una de sus caras, como en ArchiCAD. Hace falta porque un plano dibuja
  el muro con dos líneas —las caras— y el eje no está en ningún lado: calcando
  una cara se pisa una línea que existe. Con una cara el cuerpo crece entero
  hacia el otro lado; los nombres valen recorriendo el contorno en sentido
  horario (cara interior → el cuerpo queda afuera), y por eso el editor
  muestra el cuerpo antes de soltar el punto. **El largo se mide siempre sobre
  la línea marcada**, no sobre el eje. `cuerpoDeMuro` (`lib/planta-trazo.ts`)
  dice por dónde va el cuerpo y lo estira en cada esquina lo justo para tapar
  el espesor del muro vecino —sin eso dos muros por su cara dejan la esquina
  hueca—; en una esquina entrante no estira, y una punta suelta termina donde
  se marcó. **Las aberturas van sobre el eje del cuerpo**, no sobre la línea
  marcada (`murosPorSuCuerpo` en el editor). Un muro guardado sin referencia
  abre por su eje.
- **El tipo de muro** (`muros[].tarea`; null = sin tipo). De qué está hecho
  cada muro: una tarea del catálogo del cómputo —ladrillo hueco del 8, del 12
  portante, ladrillo común, un tabique de placa—. Con eso el dibujo da la
  mampostería por tipo sin medir nada aparte (`medirCaras().muros`). Se mide
  **por muro y no por cara**: el largo de la línea marcada por su altura,
  menos sus puertas y ventanas, una sola vez. **Van los m² y los m³**, y la
  unidad de la tarea dice cuál es la suya: el catálogo cotiza los ladrillos
  huecos por superficie y los comunes por volumen (superficie × espesor). Por
  eso los tipos de muro son las tareas de m² **y** de m³ (`getTiposDeMuro`),
  no sólo las de m² como las capas; el desplegable pone primero Mamposterías
  y Estructuras. Se elige al trazar —queda puesto para los muros que siguen,
  como el espesor—, en la ficha, y con **Copiar**, que sobre el cuerpo de un
  muro toma su tipo. La ficha ofrece además el atajo de todos los días:
  ponérselo a los otros muros **del mismo espesor que no tienen tipo**
  —nunca pisa uno elegido a mano—. Medidas dice cuántos m² de muro siguen sin
  tipo.
- **La estructura de hormigón** (`dibujo.estructura`: columnas, vigas y losas;
  cuentas en `lib/planta-estructura.ts`). Va **sobre el mismo plano**, en su
  propio modo: el editor tiene Arquitectura | Estructura, con la misma imagen
  y la misma escala, y lo que cambia es qué herramientas hay y qué se deja
  tocar; lo del otro modo se ve atenuado, porque la estructura se dibuja
  mirando los muros (y los muros se pegan a las columnas). Sin escala no hay
  modo Estructura: una sección en metros no tiene tamaño en el plano. No
  necesitó migración: es otra clave del jsonb y `leerDibujo` la tolera.
  **Cada planta dibuja la estructura de arriba**: las columnas que la
  atraviesan y las vigas y la losa que la cubren ("sobre planta baja").
  **Los niveles se miden desde el piso terminado de la planta, que es ±0,00**.
  **La estructura no está al nivel del piso terminado, y se la refiere al
  piso terminado que sostiene** (pedido del usuario): la losa de arriba
  sostiene el piso siguiente, que está a `pisos.altura` —NPT a NPT— del de la
  planta, y su cara de arriba queda `estructura.bajoNpt` más abajo: lo que
  ocupan el contrapiso, la carpeta y el piso. Se carga en la solapa Planta,
  en modo Estructura, que muestra lo que resulta (NPT que sostiene, cara de
  arriba, fondo de losa, arranque de columnas). Una losa rebajada —un baño,
  un balcón— lleva el suyo (`losa.bajoNpt`). **En pantalla se carga como un
  nivel, con su signo: −0,05** (`CampoBajoNpt`). Guardado va en positivo
  —cuánto más abajo—, pero el campo que pedía "0,05" rechazaba el "−0,05" sin
  avisar, que es como lo escribe cualquiera, y el usuario lo vio como "no me
  lo toma". Sin signo vale lo mismo. Las columnas arrancan en la losa
  de abajo, lo mismo por debajo del ±0,00, y llegan al fondo de la losa que
  las cubre. Sin `bajoNpt`, o si la planta no es de ningún piso, no hay de
  dónde colgarla: la losa va con su fondo a la altura de piso a techo de la
  planta, como antes (`nivelesDeLosa`). Si el fondo de losa que sale no es la
  altura de piso a techo de la planta, se avisa en rojo. Caso de control: NPT
  a NPT 2,80, `bajoNpt` 0,08, losa de 12 → losa de +2,60 a +2,72, columna de
  −0,08 a +2,60.
  **La columna se define como en ArchiCAD** (el usuario mandó la captura): no
  se le escribe la altura sino **cuánto se separa del piso terminado de
  arriba** (`arriba`, casi siempre negativo) **y del de la planta** (`desde`),
  y la altura es lo que resulta, sólo para leer (`AlturaDeColumna`). Vacíos,
  los dos campos dicen lo que le toca sola. Así un alto escrito a mano no
  queda viejo cuando se cambia el nivel de un piso.
  Cada pieza se dibuja como su par de arquitectura. La **columna** se pone con
  un toque, como una abertura: ancho (en horizontal), profundidad (en
  vertical) y **de dónde se agarra** —el centro o una de sus cuatro esquinas
  (`ancla`)—, que es el punto que se pega a la esquina del muro o al filo de
  la medianera y el que queda quieto si después se le cambia la sección;
  cambiarle el ancla ya puesta no la mueve (`puntoDeAncla`). La
  **viga** se traza como un muro, con su línea de referencia, y la **losa** se
  contornea como un ambiente (los mismos agarres: se arrastra un punto, se
  corre un lado, doble clic suma o saca un punto).
  **El nombre se puede escribir antes de poner la pieza** (campo Nombre de la
  herramienta; vacío es "el que sigue", que se lee en el campo como
  sugerencia). Lo escrito vale para esa pieza y después el campo se vacía: la
  que viene **sigue la serie de la última** (`nombreQueSigue`) —después de
  CM01 va CM02, después de P1 va P2, con las mismas cifras—. Las columnas y
  las vigas llevan dos series, una por material: C y CM, V y VM. También se
  corrige en la ficha.
  **La columna gira** (`giro`, en grados, horario como se ve en el plano)
  **alrededor de su ancla**, que no se mueve: tomada de una esquina se acomoda
  a un muro en diagonal sin soltarse de ella. La ficha tiene el ángulo y el
  atajo de un cuarto de vuelta.
  **Las columnas y las vigas son de hormigón o metálicas** (`material`). La
  metálica lleva además su `perfil` —texto libre: "IPN 200", "tubo
  100×100×4"; no hay catálogo de perfiles ni se calculan kilos—, se dibuja
  hueca (la columna con sus dos diagonales, la viga con su eje), **no suma
  hormigón ni se queda con el nudo** de nadie (su sección es el rectángulo
  que la envuelve, no lo que ocupa), y en Medidas va aparte, **por perfil y
  en metros**, que es como se pide. **La viga metálica va debajo de la losa**
  —la sostiene, no se cuela con ella—: su cara de arriba es el fondo de la
  losa, no su cara de arriba como en la de hormigón. Caso de control: IPN de
  20 de alto bajo losa con fondo en +2,60 → de +2,40 a +2,60.
  **El alto de la viga incluye la losa** (decidido con el usuario): una 12×45
  bajo una losa de 12 asoma 33. Su cara de arriba va al ras de arriba de la
  losa que tiene encima; sin losa, al fondo de losa de la planta; `viga.nivel`
  la pone a mano (una invertida).
  **El hormigón se mide descontando los cruces** (decidido con el usuario), y
  quién se queda con el nudo está fijo: **columna, después losa, después
  viga**; entre dos vigas, la que se dibujó primero. Es la regla de un cómputo
  métrico: la columna va de corrido, la losa entera, y la viga por lo que
  asoma debajo de la losa y entre caras de columnas. Cada pieza es un prisma
  (huella en planta + tramo de altura) y `medirEstructura` le saca a cada una
  lo que le pisan las de más prioridad, cortando su altura en tramos. Caso de
  control: paño de 4,00 × 3,00 a ejes, cuatro columnas de 20×20, cuatro vigas
  de 12×45 y losa de 12 hasta el filo de las columnas, planta de 2,60 →
  columnas 0,416, vigas 0,523, losa 1,613, total 2,552 m³.
  El listado de plantas muestra el hormigón de cada una.
- **Los pisos de la obra y su nivel** (tabla `pisos`, migración
  `20261122180000`; cuentas en `lib/pisos.ts`; diálogo
  `components/DefinicionDePisos.tsx`). Una planta dice cómo es un piso, no
  **dónde está**: para apilar las plantas en 3D hace falta el nivel de piso
  terminado de cada piso. El usuario pidió la **Definición de pisos de
  ArchiCAD**, y es eso: una tabla **de la obra entera** —N.º, nombre, cota de
  nivel, altura del piso— con Insertar encima, Insertar abajo y Borrar, más
  una columna que ArchiCAD no tiene: **qué planta dibujada es la de cada
  piso**. Se abre desde el botón "NPT …" de la barra del editor, al lado de
  Arquitectura | Estructura, y desde "Definir pisos" en el listado.
  El 0 es la planta baja; hacia arriba 1, 2, 3; los subsuelos, negativos.
  **Las cotas van encadenadas**: la de un piso es la del de abajo más su
  altura. Cambiar una altura sube o baja a todos los de arriba; escribir una
  cota le cambia la altura al piso de abajo (o la propia, en un subsuelo); la
  de la planta baja es el origen y mueve el edificio entero. Una cota que
  dejaría un piso sin altura no se toma: no se pueden encimar dos pisos.
  Mientras se edita, la definición es la lista de abajo hacia arriba más cuál
  es la planta baja y su nivel (`Definicion`): el número y la cota salen de
  ahí, y por eso insertar en el medio no obliga a renumerar a mano. Se guarda
  entera (`guardarPisos`: escribe por número y recién después borra los que
  sobran).
  **`pisos.altura` es de nivel de piso terminado a nivel de piso terminado
  (NPT a NPT); `plantas.altura`, de piso a techo.** No son la misma: entre
  las dos están la losa y el paquete de piso de arriba. El usuario lo remarcó
  y la pantalla lo dice: la columna se llama "Altura NPT a NPT", y la solapa
  Planta muestra las dos y **lo que queda entre ellas para losa y piso**
  (2,80 − 2,65 = 0,15), con un aviso en rojo si la de piso a techo no entra.
  **Varios pisos con la misma planta son una planta tipo**, y de ahí sale
  ahora cuántos pisos la repiten: al guardar los pisos se actualiza
  `plantas.repeticiones`, y en el editor "Pisos iguales" queda bloqueado
  mostrando esa cuenta. Una planta sin ningún piso asignado conserva lo que
  se le cargó a mano, y su botón dice "NPT sin definir" en naranja.
  Un piso insertado copia la altura **y la planta** del que se tomó de
  referencia (casi siempre se suma otro piso de la misma planta tipo).
  Antes de esto se había empezado a guardar los niveles dentro del dibujo de
  cada planta; se descartó: los pisos son de la obra, no de una planta.
- **La punta de un muro o de una viga se estira derecha** (`estirar` en el
  editor; el usuario veía que al alargar un muro "se movía entero"). Antes la
  punta seguía al puntero en cualquier dirección: arrastrada a pulso quedaba
  unos centímetros al costado y el muro cambiaba de dirección. Ahora, mientras
  el puntero esté a menos de `ESTIRAR` (24 px de pantalla) de **la línea que
  tenía el tramo al agarrarlo**, la punta va por esa línea, y se frena justo
  donde cruza a otro muro o a una de sus caras (el encuentro en T). Más lejos
  queda libre, que es como se lo gira a propósito. Con "Mover también los
  muros unidos" y más de un muro en la punta no hay línea que seguir.
  De paso se corrigió por qué se torcía aun con las guías: **los rincones**
  (donde las caras de dos muros se cortan) se guardaban entre las esquinas de
  los dos, así que al mover uno su rincón seguía atrayendo desde la lista del
  vecino, y la punta se alineaba con el rincón de su propia otra punta —medio
  espesor al costado—. Ahora van aparte, con los dos muros que los forman
  (`rincones` en el memo de `bordes`), y no atraen si uno de los dos se mueve.
- **Las aberturas no se corren cuando se estira su muro**
  (`aberturasEnSuLugar`, en `planta-trazo.ts`; era lo que el usuario veía
  como "el muro se mueve entero"). Una abertura guarda en qué **fracción** del
  largo de su muro está (`t`): eso la lleva con el muro cuando se lo mueve,
  pero al estirarlo la corría —la puerta al 30 % de un muro de 3 m, a 90 cm
  de la esquina, quedaba a 1,20 si el muro pasaba a 4—. Ahora, al arrastrar
  una punta, a cada abertura de los muros que cambian se le rehace la
  fracción para que su centro quede **donde estaba en el plano**; si el muro
  giró, en el punto más cercano de su nueva línea. Si el muro se acorta hasta
  pisarla, la abertura queda adentro, contra la punta, y nunca asoma. Se
  ubican contra el dibujo de **cuando empezó el arrastre** (`alAgarrar`), no
  contra el paso anterior: la que la punta empujó vuelve a su lugar si el
  muro se alarga otra vez en el mismo arrastre. El modelo no cambió: sigue
  guardando la fracción. Caso de control: muro de 3,00 con puerta a 0,90 de
  la punta, estirado a 4,00 → sigue a 0,90 (t pasa de 0,30 a 0,225).
- **La pantalla del editor es una mesa de trabajo**, no una página
  (reordenada el 22/11/2026 a pedido del usuario: antes los botones se
  partían en dos renglones, el panel se cortaba y había que correr la página).
  Ocupa la ventana entera y **mide justo su alto**: `AppShell` tiene para eso
  `pantallaCompleta` (sin el ancho máximo y con 16 px de margen), y la página
  de la planta no lleva `ObraHeader` —el "← Plantas" y el nombre van en la
  barra del editor—. Tres zonas: **arriba**, lo de la planta entera (volver,
  Arquitectura | Estructura, nombre, deshacer, encuadrar, guardar); **a la
  izquierda**, las herramientas del modo en una tira de íconos
  (`IconoHerramienta`, del mismo juego que `IconoObra`; el nombre sale al
  apoyar el puntero); **a la derecha**, el panel, de ancho fijo, en tres
  solapas: **Propiedades** (lo elegido o las opciones de la herramienta; se
  abre sola al tocar algo o elegir una herramienta con opciones), **Medidas**
  (cada apartado plegado con su total en la cabeza, `Grupo`: la solapa es una
  lista corta y el detalle se abre donde hace falta) y **Planta** (nombre,
  altura, pisos iguales, eliminar). Las solapas que no se miran siguen
  montadas (`display: none`) para no perder lo que se estaba escribiendo. Lo
  único que puede tener barra propia es el contenido del panel. La pista de la
  herramienta y las casillas "A escuadra" y "Guías" flotan sobre el plano.
  **El corte del panel era un bug de grilla**: un `display: grid` sin columnas
  declaradas estira su columna hasta el renglón más largo que no parte
  —"Ladrillos cerámicos huecos 12x18x33cm"— y empujaba la página; por eso
  `bloque` declara `minmax(0, 1fr)` y los nombres de los renglones bajan de
  línea en vez de cortarse.
- **Guías dinámicas** (`ajustar` devuelve `guias`). Al marcar o mover un
  punto, se alinea con cualquier esquina que tenga en la misma horizontal o
  vertical y dibuja la línea celeste contra la que se alineó; las dos a la vez
  dan el cruce exacto. Agarran desde más cerca que el imán de los vértices
  (0,6 de su alcance): alinearse con una esquina lejana es una ayuda, y si
  agarrara igual de lejos no dejaría poner un punto cerca de ninguna
  alineación. Se apagan con la casilla "Guías".
- **Todo se alinea con los bordes de los muros y de las aberturas**, no sólo
  con los puntos marcados. El contorno de un ambiente va por la **cara** del
  muro, que no es la línea con la que se lo trazó, así que el imán conoce los
  bordes de cada muro (`bordes` en el editor): las esquinas de su cuerpo
  (`esquinasDeCuerpo`), sus dos caras como líneas de apoyo (`carasDeCuerpo`),
  los **rincones** donde sus caras cortan a las de otro muro (`crucesDeCaras`:
  el de adentro de una L, los dos de una T —ninguno es un punto que haya
  marcado nadie—) y las cuatro esquinas de cada puerta y ventana sobre las dos
  caras. Sin escala no hay bordes: el espesor del trazo es de pantalla.
  **Lo que está dibujado le gana a lo que sólo está alineado**: `ajustar`
  busca primero un vértice, después una línea donde apoyarse o cruzar, y
  recién después una guía. Los bordes de un muro que se está moviendo no
  atraen a su propia punta —se perseguiría a sí mismo—. Todo esto se calcula
  con `useMemo`, cuando cambian los muros, las aberturas, la escala o el zoom,
  y no en cada movimiento del puntero.
- **El hormigón tiene prioridad sobre el muro** (pedido del usuario: "al muro
  de ladrillo se le descontaría el hormigón"). Donde hay una columna o una
  viga no se levanta ladrillo, y eso vale para las dos cosas que salen del
  dibujo:
  la **mampostería**, que ya no es largo por altura menos vanos sino eso
  menos lo que ocupa el hormigón (`mamposteriaDeMuro`; Medidas dice cuántos
  m² se descontaron); y el **3D**, donde el muro ya no pisa la estructura.
  Sale todo de una sola función, `panosDeMuro`: la elevación del muro —de
  punta a punta y del piso a su altura— menos sus **huecos**, que son los
  vanos de las aberturas y la **sombra** de cada pieza de hormigón
  (`sombraEnMuro`: el tramo del muro que ocupa y entre qué alturas). Se corta
  en una grilla, se tira lo tapado y lo que queda se vuelve a juntar: de ahí
  salen los m² y las cajas a dibujar. Una pieza cuenta cuando ocupa **al
  menos la mitad del espesor** del muro en ese tramo: una columna de 13 en un
  muro de 15 lo corta; una viga de 12 que pasa por uno de 30, no. Las
  metálicas no descuentan: el muro las rodea. **A las terminaciones no se les
  descuenta nada**: el revoque tapa la columna igual que al muro. Caso de
  control: muro de 4,00 × 2,60 de 15 con una puerta de 0,80 × 2,05, una
  columna de 20 en cada punta y una viga de 45 que lo corona → de 8,76 a
  6,10 m².
- **El edificio en 3D, en general** (`/obras/<slug>/plantas/3d`;
  `lib/planta-3d.ts`, `components/Edificio3D.tsx`; three.js, sumado para
  esto). Se entra desde "Ver en 3D" en el listado y desde el botón "3D" de la
  barra del editor. **Muestra lo guardado**, no lo que se está dibujando.
  Cada planta se vuelve **prismas** —una huella en metros y entre qué alturas
  está, desde su piso terminado— (`modeloDePlanta`): los muros partidos en
  paños, antepechos y dinteles alrededor de sus vanos, con el vidrio de las
  ventanas; el piso de cada ambiente con el espesor de sus capas, y su
  cielorraso si es suspendido; y la estructura con los mismos niveles con que
  se computa el hormigón (`medirEstructura`). Los prismas se arman **en el
  servidor** y al visor le llegan hechos: lo que se ve es lo que se computa.
  El visor repite el modelo de cada planta en cada piso que la tiene
  asignada, a su cota; se gira con el mouse, se prenden y apagan
  Arquitectura, Estructura y Cielorrasos (apagados de entrada: tapan), y se
  puede mirar un piso solo. Avisa cuántos pisos no aparecen por no tener
  planta, o por tener una sin escala.
  **Lo del mismo material se lee como una sola pieza** (pedido del usuario:
  "no dibujar líneas por todos lados"). Un muro con una puerta son varias
  cajas, y dos muros se pisan en la esquina: el borde de cada caja dejaba una
  línea en cada junta. Las aristas ya no las saca el visor de cada caja sino
  el servidor del **conjunto** (`aristasDe`): se mira alrededor de cada tramo
  de arista dónde hay sólido, y se dibuja sólo si es un quiebre de verdad
  —una esquina, un rincón, el filo de un vano—; si alrededor está todo lleno,
  o justo la mitad de corrido (una cara lisa que sigue de largo), es una
  junta y no va. Cada arista se parte antes donde otro prisma la cruza,
  porque la jamba de una puerta es filo hasta el dintel y junta de ahí para
  arriba, y se suman los rincones, que no son esquina de ninguna caja. Los
  conjuntos: los muros por su tipo —entre dos materiales distintos la línea
  queda, y dice algo—, y las columnas, las vigas y las losas cada una con las
  suyas.
  **Las puertas se ven**: la hoja, cerrada, en el vano.
  **Cada cosa se toca y dice qué es** (`Modelo.objetos`): un clic que no fue
  un arrastre la elige, queda resaltada y el panel de la derecha muestra su
  ficha —de un muro, su tipo, espesor, largo, altura y m² sin vanos; de una
  abertura, su nombre y medidas; de un ambiente, su superficie y sus capas;
  de una pieza de estructura, su material, sección, niveles y hormigón—, en
  qué piso está y un enlace a su planta. Las fichas se arman en el servidor,
  con los nombres de las tareas del catálogo. Donde una columna coincide con
  la cara de un muro, el clic elige la columna.
  **Girar | Mover** dice qué hace arrastrar con el botón izquierdo; el
  derecho mueve siempre.
  **Se puede corregir mirando el edificio**: la ficha de lo elegido trae sus
  medidas editables (`Ficha.campos`) —la altura y el espesor de un muro; el
  ancho, el alto y el antepecho de una abertura; la altura del cielorraso; las
  separaciones y la sección de una columna; la sección y el nivel de una viga;
  el espesor de una losa—. Se guarda al salir del campo (`editarEnPlanta`), y
  el modelo se rehace en el servidor sin mover la cámara. Qué se puede tocar
  lo decide una lista cerrada (`lib/planta-edicion.ts`): lo que no figura se
  rechaza. El ancho y el alto de una abertura cambian en todas las de su
  tipo, como en el editor. **Va contra lo guardado**: si la misma planta está
  abierta en el editor con cambios sin guardar, guardarla ahí pisa esto.
  Es a propósito un modelo general —el usuario lo pidió así, "porque faltan
  ajustar bastantes cosas"—: no dibuja las carpinterías en detalle. **Lo que
  le falta y se sabe**: las plantas se apilan por la esquina de su huella
  porque **no hay un punto de referencia común** entre planos distintos
  (coinciden si todos los pisos ocupan lo mismo); las terminaciones no se
  ven; y no hay techo ni terreno.
  Donde una columna coincide con un muro, la arquitectura se dibuja un pelo
  más atrás (`polygonOffset`) para que no salga rayado.
- **Las capas de piso y de cielorraso, dichas** (el usuario: "no están muy
  claras"). En la ficha del ambiente cada una va en su caja y dice **en qué
  orden van sus capas**: el piso, de la losa hacia arriba —la última es la
  que se pisa—; el cielorraso, hacia abajo —la última es la que se ve—; las
  paredes, del muro hacia afuera. El orden se corrige con "↑" en cada capa.
  Al pie va **cuánto suman** los espesores: el paquete de piso, que es lo que
  separa la losa del piso terminado, y si la estructura dice otra cosa
  (`estructura.bajoNpt`) se avisa. El cielorraso sin altura es aplicado,
  contra la losa; con altura, suspendido.
- **Cada capa lleva su espesor** (`Capa.espesor`, en metros; null = sin
  cargar; pedido del usuario: "no es lo mismo un revoque de 1 cm que uno de
  2"). La superficie alcanza para la mano de obra, pero **el material sale
  del volumen**, que es superficie por espesor. Se carga en centímetros
  debajo de cada capa, en paredes, pisos y cielorrasos, y Medidas muestra
  debajo de los m² de cada tarea su espesor y sus m³. Si la misma tarea va
  con espesores distintos, el volumen suma cada uno con el suyo y en vez del
  espesor dice que son varios; una capa sin espesor mide sus m² igual y no da
  m³. **Las capas de piso y de cielorraso pasaron a ser `Capa`** como las de
  pared —antes eran sólo el id de la tarea— justamente por el espesor: un
  contrapiso de 8 y una carpeta de 2; ahí `hasta` no dice nada. Lo guardado
  como ids sueltos se lee igual, sin espesor. Caso de control: el baño de
  2,00 × 1,50 con revoque de 2 cm → 16,56 m², 0,331 m³; contrapiso de 8 cm →
  3 m², 0,24 m³.
- **Las caras de los muros y sus capas** (22/11/2026). Es la terminación de
  las paredes, y la unidad es **la cara**: el tramo de un lado de un muro que
  queda a la vista. `carasVisibles` (`lib/planta-trazo.ts`) desglosa cada muro
  en sus dos lados y corta cada uno donde otro muro llega contra él —el
  encuentro en T, la esquina—; lo tapado no lleva nada. "Tapado" se decide
  mirando **apenas por delante** de la cara: si ahí hay cuerpo de otro muro no
  se ve. Mirar delante y no sobre la cara es lo que separa la esquina de
  afuera —el otro muro está detrás y la cara sigue a la vista— de un muro que
  llega de frente. Cada cara sabe a qué ambiente da (una sonda a 3, 10 y 25 cm
  de la cara: varias, porque un contorno a pulso puede no llegar hasta ella).
  - **Una puerta o una ventana parte la cara en partes, no en caras**
    (`ParteDeCara`, en `medirCaras`). A los costados queda el **paño**, de piso
    a techo; en el ancho del vano, lo que hay de pared arriba —el **dintel**—
    y, en una ventana, abajo —el **antepecho**—. Las tres son pared y llevan
    la terminación de su cara: se separan porque miden distinto y porque es la
    cuenta que hay que poder revisar ("1,20 m de paño × 2,60 · dintel de P1
    0,80 × 0,55"). La superficie de la cara es la suma de sus partes. En el
    plano la línea de la cara va donde hay pared a la altura del piso: entera
    en los paños, fina bajo una ventana y **cortada en una puerta**. Al
    principio la cara era un solo tramo con el vano descontado; daba el mismo
    número, pero el usuario no veía dónde estaba el dintel y tenía razón en
    desconfiar.
  - **Cada capa sube hasta donde sube** (`Capa.hasta`). No todas llegan a la
    misma altura: con un cielorraso suspendido a 2,40 el porcelanato llega al
    cielorraso, el revoque de abajo lo pasa unos centímetros y la pintura de
    un muro sin cielorraso va hasta la losa. Por eso la altura es de la capa
    y no de la pared: `"techo"` (toda la altura del muro), `"cielorraso"` (el
    del ambiente al que da la cara; si no tiene, la losa) o un número de
    metros desde el piso. La capa mide, de cada paño, antepecho y dintel, lo
    que queda por debajo de su altura: de un dintel que arranca a 2,05, un
    porcelanato hasta 2,40 cuenta 35 cm. Una capa guardada cuando era sólo el
    id de su tarea se lee como "hasta la losa", que es lo que medía. En
    pantalla las tres opciones se llaman **Losa · Cielorraso · Altura
    personalizada**, como las pidió el usuario: el valor guardado sigue
    siendo `"techo"`, pero "techo" en pantalla confundía —en un ambiente con
    cielorraso, el techo que se ve es el cielorraso—.
  - **El cielorraso y el piso son del ambiente** y se miden por su
    superficie: `ambiente.alturaCielorraso` (null = no hay suspendido, el
    techo es la losa), `ambiente.cielorraso` y `ambiente.piso`, los dos por
    capas —contrapiso, carpeta, porcelanato— con las mismas tareas del
    catálogo. No llevan altura: son la tarea sola. Cada desplegable de capas
    ofrece primero los rubros que tocan (Cielorrasos; Contrapisos y Pisos;
    Revoques, Revestimientos y Pintura) y después el resto. Medidas los suma
    en tres bloques —pared, pisos, cielorrasos—, cada uno con lo que falta, y
    en el total del edificio junta por tarea: la misma en la pared y en el
    piso es una sola cantidad a cotizar.
  - **Los cantos también son caras** (`Cara.punta`: "a" o "b"; null en las
    caras largas). Es la punta del muro, de cara a cara: mide su espesor por
    su altura y lleva la terminación del ambiente al que da. Casi siempre
    está tapada y no cuenta; la que queda suelta —un tabique que termina en
    medio de un dormitorio— es pared a la vista. Para un canto **no alcanza
    con mirar delante**: en una esquina los dos muros se estiran hasta
    llenarla y la punta de uno queda sobre la cara de afuera del otro, con
    aire delante, y sería la misma superficie contada dos veces. Por eso
    también se mira apenas detrás: si la punta está metida en el cuerpo de
    otro muro, no es un canto. Su clave lleva la punta donde las otras
    llevan el lado (`muro|a|ambiente`). Las mochetas de un vano siguen sin
    contar.
  - **Copiar** (herramienta) es el pincel de formato: el primer clic toma la
    terminación de una cara o de un ambiente y los siguientes se la ponen a
    lo que se toque; Esc o "Tomar otra" la suelta. De una cara se llevan sus
    capas; de un ambiente, todo —paredes, piso, cielorraso y su altura—. Se
    cruzan con sentido: lo tomado de un ambiente, sobre una cara le pone sus
    paredes; lo tomado de una cara, sobre un ambiente le cambia las paredes y
    le deja el piso y el cielorraso. Con Copiar se ven y se tocan todas las
    caras, también las que no tienen nada, que son las que hay que pintar.
    Existe porque terminar una planta cara por cara eran los mismos tres
    desplegables veinte veces.
  - **De dónde sale cada altura.** El paño mide la altura de su muro; el
    antepecho, el de la ventana; el dintel, lo que queda: altura del muro
    menos antepecho menos alto de la abertura. La altura del muro es la de la
    planta, salvo que tenga la suya (`muros[].altura`, null = la de la planta):
    un murete, un antepecho de balcón, una pared que no llega arriba. Se
    carga en la ficha del muro, y borrarla lo devuelve a la de la planta.
  - **Las capas son tareas del catálogo del cómputo** (las de m²: azotado,
    revoque, porcelanato, látex), guardadas por su id y en orden, del muro
    hacia afuera. No hay una lista de terminaciones aparte: lo que se marca
    sobre una cara es lo que después se cotiza. Cada capa suma la superficie
    entera de su cara; repetida en la misma cara cuenta una vez.
  - **Por ambiente, con excepciones por cara** — lo que el usuario eligió al
    principio, con la cara como excepción que pidió después. `ambiente.capas`
    vale para todas las caras que dan a él; `dibujo.caras[clave]` es la de una
    cara que lleva las suyas, o que no da a ningún ambiente (el frente, una
    medianera). Una lista vacía es "esta cara no lleva nada", distinto de no
    tener entrada, que es heredar.
  - **La ficha del ambiente muestra las capas que sus muros ya tienen.** Las
    paredes se pueden terminar desde dos lados —el ambiente o cada muro— y
    quien las cargó muro por muro encontraba "Paredes" vacío con el baño
    entero revestido: parecía que no había nada. Ahora, debajo de las capas
    del ambiente, se listan las caras que dan a él y llevan las suyas, cada
    una como un botón que lleva a su muro con esa cara abierta. Y dos atajos
    para dejar la terminación en un solo lugar, que es donde la altura de
    cada capa se ajusta una vez: **Pasarlas al ambiente** —sólo si todas son
    iguales y el ambiente no tiene las suyas, porque de otro modo habría que
    elegir cuál pisa a cuál— y **Que lleven las del ambiente**.
  - **La clave de una cara dice qué cara es, no dónde está**:
    `muro|lado|ambiente`. Una posición no aguanta que el muro se mueva o se
    alargue; "la cara de este muro que da al baño" sí. Dos tramos del mismo
    lado que no dan a ningún ambiente comparten clave y terminación. Borrar
    un muro o un ambiente se lleva sus claves, y partir un muro las copia a
    la mitad nueva.
  - En el editor: con un muro elegido se listan sus caras (ambiente, largo,
    m², capas) y se tocan en la ficha o en el plano; con un ambiente elegido,
    "Paredes". Cada cara terminada se dibuja con una línea del color de su
    última capa —la que queda a la vista—, el mismo color en el plano, la
    ficha y las medidas. Medidas suma los m² por capa y dice cuántos m² de
    cara siguen **sin terminación**: sin eso, un baño terminado y el resto sin
    tocar se leería como la planta entera.
- **Los lados de un ambiente se corren enteros** (`moverLado`): con el
  ambiente seleccionado se agarra un lado y se mueve en paralelo; los dos
  vecinos conservan su dirección y se alargan o acortan hasta donde los corta,
  como al mover una pared de un cuarto. Se frena a la altura de otras
  esquinas, así queda en línea con la cara de un muro. **Escuadrar**
  (`escuadrar`) deja horizontal o vertical cada lado que esté a menos de 15°
  de serlo y respeta las diagonales hechas a propósito; el botón aparece sólo
  si cambiaría algo. Un muro también se escuadra, girando sobre su primer
  punto.
- **A un ambiente se le suman y se le sacan puntos**: doble clic sobre un lado
  agrega uno, doble clic sobre un punto lo saca (con tres ya no). El punto
  nuevo cae **sobre el lado** —agregarlo no cambia la forma— y a lo largo se
  acomoda con el imán y las guías, porque casi siempre va a la altura de algo.
  El doble clic se detecta a mano, por la hora de los dos toques: el primer
  toque ya agarra el lado para arrastrarlo, y con el puntero capturado el
  `dblclick` del navegador no llega a la línea.
- **Correr un tramo arma el saliente** (`moverLado`): si el vecino de un lado
  sigue en la misma línea —el lado es un tramo de una pared más larga—, esa
  punta se queda y aparece un punto nuevo, así el tramo sale o entra dejando
  un escalón a escuadra. Es como se hace un placard o un nicho a partir de un
  rectángulo: un punto con doble clic y arrastrar el tramo. "En la misma
  línea" es a menos de 8° (`CASI_PARALELO`): calcado a pulso nunca queda
  paralelo exacto, y tratarlo como un lado que cruza mandaba la esquina a
  decenas de metros.
- **La punta de un muro se mueve sola.** Al principio arrastrar una punta se
  llevaba todas las que coincidían con ella, para que las esquinas no se
  desarmaran. Resultó una trampa: dos muros que se tocaban una vez ya no se
  podían separar nunca, y acortar uno torcía al vecino. Ahora se mueve sólo la
  del muro elegido, y la casilla "Mover también los muros unidos a la punta"
  —que aparece si hay alguno— trae lo de antes para correr una esquina entera.
  De los dos errores posibles se eligió el que se ve: una esquina abierta
  salta a la vista y el imán la cierra; un vecino torcido pasa desapercibido.
- **Un muro se parte con doble clic** (`partirMuro`): es su "agregar un
  punto". Las dos mitades heredan todo y cada abertura queda en la mitad donde
  estaba, en el mismo lugar —se rehace su fracción—: partir no mueve nada. Para
  continuar un muro alcanza con la herramienta Muro, que arranca pegada a la
  punta del que ya está.
- **Los muros encimados se avisan, no se corrigen** (`solapesDeMuros`). Dos
  muros uno encima del otro —el mismo trazado dos veces, uno largo sobre uno
  corto— cuentan ese tramo dos veces. El dibujo no lo impide, pero el editor
  los pinta de rojo y dice cuántos metros están contados de más, en la ficha
  del muro, en Medidas y en el listado de plantas. No se descuenta solo porque
  cuál de los dos sobra lo sabe quien dibuja. Se comparan los **cuerpos**, no
  las líneas marcadas: uno trazado por su cara y otro por su eje pueden
  pisarse con las líneas separadas. No cuentan dos en esquina, dos punta con
  punta ni una pared doble con las caras apoyadas.
- **Agarrar no es arrastrar hasta mover 3 px** (`UMBRAL_DE_ARRASTRE`). Sin el
  umbral, seleccionar un lado con un clic lo corría un píxel y ensuciaba el
  dibujo, y un doble clic nunca llegaba a ser doble.
- **Los atajos de teclado se escuchan en la ventana**, no en el lienzo: con el
  foco en el lienzo dejaban de andar apenas se tocaba un botón del panel, y el
  Ctrl+Z de después de Escuadrar no deshacía. Escribiendo en un campo las
  teclas son del campo.
- La geometría de dibujar (`ajustar`, `cuerpoDeMuro`, `moverLado`,
  `escuadrar`) vive en `lib/planta-trazo.ts`, sin React, para poder probarla
  sola; `lib/planta-dibujo.ts` queda para el modelo y las medidas.
- **Medir** es la cinta métrica: dos clics y dice cuánto hay entre ellos (y,
  si es una diagonal, cuánto corre en horizontal y en vertical). **No entra al
  dibujo**: vive en un estado aparte del editor, no se guarda, no pasa por
  Deshacer y no enciende el Guardar. Usa el mismo imán y la misma escuadra que
  las herramientas que dibujan —por eso va con ellas en `dibujando`—, que es
  lo que la hace exacta de esquina a esquina. Va en violeta, distinto de todo
  lo que queda.
- El editor recibe la **dirección** de la imagen, no el id de Drive: la página
  arma `/archivos/<id>`, que es la ruta que verifica el permiso
  (`buscarArchivoVisible` conoce la tabla nueva).

#### Muros por capas: tipos de muro (23/11/2026)
Decidido con el usuario, con la referencia del "muro compuesto" de ArchiCAD:
un muro es de un **tipo** de la obra (tabla `tipos_de_muro`, migración
`20261123140000`), y el tipo es una pila de capas reales: el **núcleo** (la
mampostería, lo que el hormigón reemplaza) y a cada lado sus capas del núcleo
hacia afuera —revoques, aislación, porcelanato, látex—, cada una con su tarea,
su espesor y **entre qué alturas va** (`desde`/`hasta`): el porcelanato de
0 a 2,10 y el látex de 2,10 al techo ya no se superponen. Todo en el muro,
también las terminaciones (el usuario lo prefirió así; un tabique con
porcelanato de un lado y látex del otro es su propio tipo).
- **Los tipos son de la obra**, no de la planta: el mismo "Muro exterior 30"
  en planta baja y en la tipo. Cambiar un tipo se guarda solo (700 ms después
  de dejar de tocarlo) y `guardarTipoDeMuro` les actualiza el espesor y la
  tarea a los muros que lo usan **en todas las plantas**.
- El muro guarda `tipo` (id); su `espesor` es la suma de las capas y su
  `tarea` la del núcleo, sincronizados: así el dibujo, el 3D y todo lo que
  ya leía `espesor` siguen igual. El **volumen de la mampostería sale del
  espesor del núcleo**, no del total con revoques.
- **Exterior** es el lado de la "cara exterior" de la referencia (el −normal);
  el canto lleva las capas del interior.
- **Zócalo por tramo**: cada muro elige la tarea de zócalo de cada lado
  (tareas en ml). Se mide por el pie de la cara, sin las puertas, y pasa al
  cómputo en metros.
- Un muro **sin tipo** sigue como antes (mampostería + espesor, terminaciones
  del ambiente), y su panel muestra esos dos campos.
- **La línea de referencia es la del núcleo** (pedido del usuario): marcar
  "cara exterior" es marcar la cara exterior del ladrillo; las capas
  exteriores crecen hacia afuera y las interiores hacia adentro sin correrlo.
  El muro guarda `revestimiento` (lo que suman las capas de cada lado, al día
  con el tipo, `medidasDelMuro`/`conSusTipos`) y `rangoDelCuerpo` ubica el
  cuerpo con eso. `Cuerpo.nucleo` es el eje y espesor del ladrillo solo: el
  hormigón se busca ahí, no en el revoque.
- **Mochetas**: una columna de hormigón que sobresale de la cara del ladrillo
  más que el revestimiento de ese lado suma sus dos costados (profundidad × 2)
  a cada capa de esa cara, en su franja de altura (`columnasEnLaCara`). Si
  sobresale menos, el revoque la absorbe.
- **Hormigón visto** (casilla de la columna): no hace mochetas, y se le resta
  a cada capa de la cara el ancho de su frente.
- **El ambiente puede tener terminación propia de paredes** (Paredes: "Las
  del muro" | "Propias"), que reemplaza las capas del lado del muro en todas
  sus caras: el baño con su revoque impermeable, porcelanato 0–2,10 y látex
  arriba, sin un tipo de muro para cada combinación. Orden en una cara: las
  suyas (`dibujo.caras`) > las del ambiente > las del lado del tipo. Al
  pasar a "Propias" arranca con las del muro. Las capas del ambiente también
  tienen `desde`.
- **Una cara que da a dos ambientes se corta donde cambia el ambiente**
  (`carasVisibles`): antes iba entera al ambiente de su punto medio, y el
  medianero entre dormitorio y baño llevaba una sola terminación.
- **Se agarra de** (antes "Línea de referencia" en el muro elegido): cambiarla
  ya **no mueve el muro**, como el ancla de una columna: el cuerpo queda y se
  corre la línea con sus puntos (`conOtraReferencia`); los muros que llegan a
  una punta van al cruce con la nueva línea para no despegarse. Así se toma el
  muro de la cara que se quiere alinear.
- **Mover el muro entero**: el cuadrado del medio de su línea. Se pega por sus
  puntas o por el medio a caras, esquinas y líneas de otros muros —gana la que
  menos corrige—; con "puntas unidas" los vecinos lo acompañan y sus aberturas
  se quedan donde estaban; las del muro van con él.
- **Caras terminadas** (`REFERENCIAS_DE_MURO`): un muro se agarra también de
  la cara exterior o interior **terminada** —el borde del revoque—, además de
  las del ladrillo y su centro. Es la que se alinea con la de otro muro cuando
  tiene que coincidir lo que se ve. Las vigas siguen con sus tres.
- **Precisión al mover muros**: arrastrando una punta, una esquina de otro
  muro a menos del imán manda sobre el "estirar derecha" —antes la punta
  quedaba atada a su línea y no llegaba a una esquina unos milímetros afuera—.
  Y con un muro elegido, las **flechas** lo corren 1 cm (10 con Shift)
  (`correrMuro`).
- **Uniones en corte** (`franjasEnPlanta`): cada muro se dibuja como tres
  polígonos —capa exterior, núcleo, capa interior— recortados en cada punta
  que comparte con otro muro. En una L, la capa del lado de afuera llega a la
  cara terminada de afuera del otro, el núcleo a la cara de afuera del núcleo
  del otro y la capa de adentro a la cara de adentro del núcleo del otro: cada
  capa forma su propia L, como lo dibujó el usuario. En una T (el otro sigue en
  línea con un compañero), el núcleo entra hasta el núcleo del otro y las capas
  terminan en su cara. Las capas se pintan en un grupo y los núcleos en otro,
  con la transparencia en el grupo: donde se pisan no se oscurece. El 3D usa
  los mismos cortes.
- **Esquinas con capas**: en la planta se dibujan primero las capas de todos
  los muros y encima los ladrillos, así en una esquina el ladrillo de uno corta
  las capas del otro (el revoque exterior da la vuelta, el interior se
  interrumpe). Y una cara cuenta como tapada si otro muro está a menos de 5 mm
  delante (`carasVisibles`): un desfasaje de milímetros dejaba un pedazo de
  cara suelto adentro de la esquina, que se computaba.
- **Herramienta Esquina**: clic en un muro y en otro, y se unen en escuadra
  como el chaflán de distancia cero de AutoCAD (`unirEnEsquina`): cada uno se
  alarga o se recorta hasta el cruce de sus líneas y comparten la punta. Con
  eso el cuerpo de cada uno tapa el del otro, el revoque exterior da la vuelta
  y no quedan pedazos de cara sueltos adentro de la esquina. Paralelos: avisa.
- **Herramienta Cortar** (tijera): parte un muro en tramos —el medianero en
  dormitorio, baño y pleno— para que cada tramo tenga su tipo. Al pasar sobre
  un muro muestra en rojo punteado dónde se lo puede cortar: las caras de los
  muros que llegan a él, prolongadas (`cortesDeMuro`); el corte se engancha
  ahí y un clic parte. Usa el mismo partir que el doble clic (`partirEn`).
- **Planta en corte**: un muro con capas se dibuja con el núcleo con el color
  de siempre y una franja gris clara por cada lado con capas, con su espesor
  (`franjasDelMuro`).
- **3D**: cada muro se levanta desde sus franjas de la planta
  (`franjasEnPlanta`), ya cortadas en las uniones: en una esquina cada capa
  forma su L con la del otro muro, igual que en la planta. El núcleo se arma en
  paños sin los vanos ni el hormigón; cada capa, como una piel que sólo se
  corta en los vanos y pasa por delante de columnas y vigas (cada paño se
  recorta de la franja, así conserva el bisel de la punta). Mismo grupo que el
  muro: se ve como una pieza.
- Sin hacer todavía: mochetas de vigas que cuelgan bajo el muro y columnas
  sueltas (que no tocan ningún muro), que no llevan terminación.
- Propiedades del muro, simple: tipo (+ Nuevo), la pila (exterior arriba,
  núcleo al medio, interior abajo, en una grilla alineada; la altura de cada
  capa se despliega abajo), zócalos, altura y referencia. El editor de capas
  por cara queda sólo para muros sin tipo.

#### Capas dibujadas sobre las caras, como polilíneas (23/11/2026)

Idea del usuario: el muro se dibuja igual y cada capa de terminación se dibuja
**encima de la cara**, como una polilínea de AutoCAD, con su tarea, espesor y
alturas. Lo que se ve es lo que se computa.

- **Modelo** (`Dibujo.capas: CapaDibujada[]`, `lib/planta-dibujo.ts`): tarea,
  espesor (0 = pintura), desde y hasta (techo / cielorraso / número) y
  **tramos**: `{muroId, cara: 1|-1|"a"|"b", desde, hasta}` en fracciones de la
  línea marcada del muro, como una abertura. Así la capa sigue al muro si se
  lo mueve o se lo alarga; al partir un muro (`partirEn`) cada tramo se
  reparte entre las dos mitades. El orden de la lista es la pila.
- **Geometría** (`lib/planta-capas.ts`): `piezasDeCapas` cruza cada tramo con
  las caras a la vista (`carasVisibles`) —si después llega otro muro, ese
  pedazo se va solo—, recorta la altura a la del muro (o al cielorraso del
  ambiente al que da la cara) y **apila**: cada pieza arranca donde termina la
  más alta de las capas anteriores que pisa en esa cara, tramo y franja de
  altura (el porcelanato sobre el revoque; el látex de 2,10 para arriba también
  sobre el revoque, no sobre el porcelanato). Las esquinas de una misma capa
  van **a inglete** (`ingletes`): da la vuelta como una sola polilínea, sin
  hueco afuera ni encimado adentro.
- **Dos maneras de ponerla** (herramienta Capa): **Por ambiente** — clic
  adentro de un ambiente y va por todo su perímetro (`tramosDeAmbiente`, caras
  con ese `ambienteId`, cantos incluidos); clic afuera de todos, por las caras
  que no dan a ningún ambiente (el revoque exterior). **A mano** — cada clic se
  pega a la cara más cercana (`puntoEnCara`); entre dos clics en caras
  distintas la polilínea dobla la esquina (`tramosDePolilinea`). Doble clic,
  Enter o "Terminar" la cierran; Esc la descarta. Con el puntero se ve antes
  la capa que saldría.
- **Panel**: el mismo renglón que las capas de un tipo de muro (`FilaDeCapa`,
  ahora exportado): tarea · espesor · altura. Con Seleccionar, tocar la capa
  la elige (contorno negro), con su superficie y Borrar capa.
- **Cómputo**: `medirCaras` mide cada pieza sobre las partes de su cara (sin
  vanos, en su franja de altura) más las mochetas de las columnas que tiene
  encima (`columnasEnLaCara` ahora dice dónde está cada columna), y la suma a
  `cara.capas` con `dibujada: true` y `capaId`. De ahí va a `porCapa`, a
  Medidas y al pase al cómputo sin nada aparte (`getPase` también junta sus
  tareas).
- **3D**: cada pieza con espesor es una piel entre sus alturas, sin los vanos
  de su muro, con el inglete de la planta. La pintura no se levanta.
- Probado con un ambiente de 4,00 × 3,00 con puerta: revoque 34,76 m²,
  revoque exterior 37,88, porcelanato 0–2,10 27,76, látex 2,10–techo 7,00;
  apoyos 0 / 0,02 / 0,02; ingletes exactos en planta y en 3D. En el baño de
  Andonaegui la capa por ambiente da 18,66 m², lo mismo que su azotado por
  terminación de ambiente.
- **Editar una capa** (con Seleccionar, tocándola): cada punta de sus tramos
  tiene un agarre, un poco hacia adentro del tramo —en un rincón caen dos y
  así no se tapan—, que se arrastra a lo largo de su cara y se pega a las caras
  de los muros que llegan, a las jambas y a las puntas de la cara. Tocar la
  capa elige también **el tramo** tocado (contorno más grueso): "Quitar tramo"
  lo saca. Sólo hay agarre donde termina el tramo, no donde lo corta otro muro.
- **La pila**: el panel de la capa lista las capas que la pisan o que ella
  pisa —en alguna cara, tramo y altura—, de la de contra el muro a la de
  afuera, con ↑ ↓ en la elegida. Mover es saltar sobre la vecina de esa pila
  en la lista de capas, que es lo que decide quién se apoya en quién.
- **Se mide por la línea media de cada capa** (`proporcionAlLargo`): con las
  esquinas a inglete, la capa de adentro de un rincón es más corta afuera que
  contra el muro. Así la pintura sobre el revoque mide la cara terminada, y
  superficie × espesor da el volumen justo.
- **Contorno del ambiente**: un borde de ambiente a menos de **15 cm** de la
  punta de una cara no la corta (`carasVisibles`): el contorno calcado sobre
  la cara terminada, o que termina antes de la punta de un muro que sigue unos
  centímetros, dejaba pedazos "sin ambiente" de 2 a 7 cm en rincones y puntas
  —el muro de 3,58 del dormitorio de Andonaegui tenía 5 caras en vez de 3—.
- **Qué cara es cuál**: en la lista de Caras del muro, pasar el puntero por una
  la marca en azul en la planta (el muro elegido ya va en naranja), afuera de
  sus capas dibujadas. La línea de color de cada cara que se dibujaba siempre
  queda sólo para las caras con capas de antes: las dibujadas ya se ven.
- **Pasar lo de antes** (`lib/capas-al-dibujo.ts`, acción
  `pasarCapasAlDibujo`, botón "Pasar capas al dibujo" en la barra del editor,
  sólo mientras haya algo que pasar y con el dibujo guardado): para **todas
  las plantas de la obra** —los tipos son de la obra—, mide cada cara como
  estaba, deja los muros con el núcleo **sin moverlos** (el que se agarraba de
  una cara terminada pasa a la del ladrillo con `conOtraReferencia`, y las
  aberturas quedan donde estaban), y le da a cada cara —reconocida por su
  clave muro|lado|ambiente— sus capas como tramos enteros. Capas iguales en el
  mismo lugar de la pila son una sola capa dibujada. Después vacía las capas
  de los tipos. Primero las plantas y después los tipos: si algo falla a mitad
  de camino ninguna planta pierde sus capas. Probado con un tipo de revoque 2
  + ladrillo 12 + grueso 1,5 + látex y con un baño con terminación propia: las
  capas pasan todas, el ladrillo no se corre y lo de antes queda vacío. Las
  superficies cambian décimas de m² porque cada capa pasa a medirse donde
  está (el revoque exterior antes se medía sobre la cara terminada).
- **Lo de antes, sólo mientras exista**: el tipo de muro muestra sus capas
  si las tiene pero ya no suma nuevas ("+ capa" no está: el tipo es el
  núcleo); las "Paredes" del ambiente y el editor de capas de una cara
  aparecen sólo si ese ambiente o esa cara tienen capas de antes. La lista de
  caras del muro queda para todos los muros: dice qué lleva cada cara.
- **La cara terminada incluye las capas dibujadas** (`Muro.acabado`, de
  `conAcabado` en `planta-dibujo.ts`; se calcula al leer el dibujo y en el
  editor cada vez, no se guarda): de cada lado, la pila más alta de capas
  dibujadas, apiladas por sus tramos sin geometría. `rangoDelCuerpo` la
  recibe aparte del revestimiento: cuenta para dónde está la cara terminada,
  pero el cuerpo termina antes. Así un muro agarrado de la "cara exterior
  terminada" tiene su línea —y sus puntos para moverlo— afuera de la última
  capa, y cambiar el agarre no lo mueve. En una esquina marcada por las caras
  terminadas, el ladrillo de cada muro llega al ladrillo del otro, no a la
  línea (`cuerpoDeMuro` ahora puede acortar una punta), y la capa da la
  vuelta con su inglete justo en la línea. Las esquinas y el borde de afuera
  de las capas dibujadas atraen al dibujar y al mover. Probado: L de 12 con
  2 de revoque exterior en los dos, agarrados de la cara terminada → ladrillo a
  2 cm, revoque de 0 a 2 con el inglete en el cruce de las líneas.
- **Capas por cara, desde Caras** (`CapasDeLaCara`): al elegir una cara del
  muro en su lista —también un canto, la punta del muro—, abajo aparecen las
  capas que lleva, con × para sacarlas de esa cara, y las que el muro lleva en
  otras caras, con + para que ésta las lleve también: es como el revoque da la
  vuelta por el canto de un muro partido, como la misma capa y no otra. Y "+
  nueva", con lo del molde. Un canto va entero; un lado, de punta a punta.
- **Un tipo nuevo desde un muro arranca igual al suyo** (`crearTipo`): con su
  núcleo y sus capas, para cambiar sólo lo distinto —lo de partir un muro y
  darle al tramo otro tipo—. Antes arrancaba sólo con ladrillo, del espesor
  total del muro con sus capas: el tramo perdía las capas del tipo y engordaba.
  Igual, las capas de un tipo son de todos sus muros; una vez pasadas al
  dibujo, cada muro lleva las suyas y no hace falta un tipo por cada variante.
- **Un tramo que llega a la punta marcada sigue hasta el final de la cara**
  (`piezasDeCapas`): un tramo de 0 a 1 —el que deja Copiar o el "+" del corte
  cuando la cara no pasaba de los puntos marcados— cortaba la capa en la
  punta marcada, y en una esquina la cara sigue un poco más allá (el cuerpo
  se estira hasta el del otro muro). La capa no llegaba al rincón: afuera
  quedaba el canto pelado y adentro se encimaba, sin inglete. Encontrado en la
  esquina del pasillo, el dormitorio y el estar de Andonaegui (muros de 8
  agarrados de la cara terminada, con capas de 2 cm): ahora el revoque da la
  vuelta por afuera y adentro hace el inglete.
- **Ingletes entre capas distintas** (`ingletes`, segunda pasada): una punta
  que no encontró pareja de su misma capa se une con la de otra capa que va a
  la misma profundidad y con el mismo espesor. Es la punta suelta de un muro
  con un revoque en el canto y otro en un lado —dos capas, el mismo revoque—,
  y el rincón donde llegan capas distintas. Cada punta se une una sola vez, y
  primero con las de su capa. Encontrado en la punta del muro de 0,61 entre
  los dos pedazos del dormitorio de Andonaegui.
- **Las aberturas en las capas**: en la planta, una capa se corta en los
  vanos de su muro que la cruzan **a su altura** (`trozosEnPlanta`): una puerta
  abre el revoque de piso a techo pero no el látex de 2,10 para arriba; las
  puntas conservan su inglete. Es sólo el dibujo: en el cómputo cada capa ya
  medía las partes de su cara —paños, y arriba de la puerta el dintel—, y el
  3D ya cortaba el vano a su altura. Verificado: muro de 3,00 × 2,60 con una
  puerta de 0,895 × 2,05 → revoque y mampostería 5,965 m² (7,80 − 1,835, con
  el dintel de 0,49 contado); el látex de 2,10 arriba, 1,50 entero.
- **Los costados de los vanos** (`costadosDeVanos`, en `medirCaras`): cada capa
  dibujada suma lo que entra en las puertas y ventanas de su muro —las dos
  jambas, el bajo del dintel y, en una ventana, el antepecho—, **hasta la mitad
  del ladrillo** de cada lado: la carpintería va al medio y cada cara termina
  lo suyo. Una jamba cuenta si la pieza llega hasta ella, en la franja de
  altura de la capa; el bajo del dintel y el antepecho, si la capa llega a esa
  altura (el revoque y el porcelanato hasta 2,10 sí sobre una puerta de 2,05;
  el látex de 2,10 para arriba no). Va sumado a la superficie de la capa, sin
  pasar por la línea media. Probado: muro de 12 con puerta de 0,895 × 2,05 →
  revoque 6,265 (5,965 + 0,246 de jambas + 0,054 de dintel); ventana de 1,20 ×
  1,10 con antepecho 0,90 → 6,756 (6,48 + 0,132 + 0,072 + 0,072).
- **Copiar es copiar las propiedades de un elemento a otros del mismo
  tipo** (como el igualar propiedades de AutoCAD): el primer clic toma y cada
  clic siguiente pone. Sirve para **muros** (también tocando sus capas
  dibujadas, que llevan a su muro), **aberturas** (nombre, medidas,
  antepecho, cómo abre y mano; se quedan en su muro y su lugar) y
  **ambientes** (piso y cielorraso). Ya no copia la terminación de una cara
  sola: con Copiar, cada cara tenía una franja invisible pegada al muro que se
  llevaba el clic, y se terminaba copiando la terminación de esa cara en vez
  del muro. El panel de Copiar usa las piezas nuevas: qué se tomó y qué se
  lleva, con × para tomar otro.
- **Copiar un muro se lleva sus capas dibujadas**: a la misma cara, salvo que
  cada muro tenga un solo lado que da afuera y no coincidan (se trazaron en
  sentidos contrarios), y entonces lo de afuera va afuera. Una capa que cubría
  toda su cara cubre toda la del otro; una parcial, la misma fracción. Lo que
  el otro tenía dibujado se reemplaza, y los tramos nuevos se suman a las
  mismas capas: siguen siendo una capa cada una.
- **Ojo, la mampostería** se sigue midiendo por el largo de la línea marcada
  (`mamposteriaDeMuro`): depende de qué línea se marcó. Al pasar, un muro
  marcado por la cara terminada pasa a la del ladrillo y su mampostería baja un
  poco. Medirla por el eje del ladrillo la haría independiente de eso.

#### Cómo se ve la planta (23/11/2026)

Pedido del usuario, con una planta de referencia: muros blancos con las capas
en líneas finas y el contorno de afuera con un poco de espesor, la estructura
con un rayado fino, los ambientes en pasteles, y poder ocultar el plano de
fondo y lo que se va dibujando.

- **Muros**: blancos. Cada pieza —núcleo, capas de un tipo de antes y capas
  dibujadas (cortadas en los vanos)— se dibuja primero con un trazo grueso y
  después todas llenas de blanco encima: de cada trazo queda la mitad de
  afuera del conjunto, así los muros que se tocan se leen como uno, sin línea
  en la juntura. Encima, las capas con línea fina gris; el núcleo no lleva
  línea propia, sólo se tiñe el elegido (naranja claro) o el encimado (rojo
  claro). Las capas dibujadas van blancas; la elegida y la que saldría con un
  clic, en el color de su tarea. Una pintura sigue siendo una línea de color.
- **Estructura**: columnas y vigas de hormigón con un rayado fino a 45°
  (patrón `rayado-de-hormigon`, del mismo tamaño en pantalla a cualquier
  zoom); la columna, blanca debajo para tapar lo que pisa. En modo
  arquitectura, al 70 %.
- **Las vigas, según el plano de corte** (`PLANO_DE_CORTE` = 1,20 m sobre el
  piso terminado, `enElCorte` en `planta-estructura`): la que está toda por
  encima va **en proyección**, sólo el contorno de trazos y sin relleno (es la
  de la losa de arriba, casi todas); la que está toda por debajo —una
  invertida, una de baranda— en **gris claro**, lleno; la que el plano
  atraviesa, **cortada**: rayada como las columnas. Las alturas salen de
  `medirEstructura` (las mismas del 3D y del cómputo). La metálica sigue
  hueca, con su eje de trazos, en el color que le toca.
- **Ambientes**: rellenos pastel (`PASTELES`), sin borde salvo el elegido.
- **Capas de dibujo** (botón "Capas" arriba a la derecha del plano): mostrar u
  ocultar el plano de fondo, ambientes, muros, capas, aberturas, cajones,
  estructura y cotas. Lo oculto no se toca. El botón dice cuántas hay ocultas.
- La línea de color de cada cara queda sólo para las del muro elegido.
- **Puertas** (`puertaEnPlanta`): un **marco** blanco con su línea en cada
  jamba —5 cm a lo largo—, la **hoja** como un rectángulo blanco de 4 cm,
  abierta a 90° desde el marco de la bisagra y apoyada en la cara del marco
  hacia donde abre, y el arco fino de la punta de la hoja al otro marco. Las
  puntas del muro en el vano se cierran con una línea de cara terminada a cara
  terminada (`jambas`), del grosor del contorno de los muros: los bordes del
  muro y de sus capas llegan hasta el marco. El vano de una puerta va sin
  borde de color. Las ventanas, como estaban.
- **El marco de una puerta** (`Abertura.marco`, en metros, del tipo como el
  ancho): de cara a cara. Se elige de una lista (`SelectorDeMarco`): el del
  muro —con sus capas—, 8, 10, 12, 15, 18, 20 cm, u "Otro" para escribirlo.
  Si es más angosto que el muro va al ras de la cara hacia donde abre. Se
  carga en la herramienta y en la puerta elegida (cambia todas las de su
  tipo).
- **El vano tapa el muro entero**: el blanco de una abertura va de cara
  terminada a cara terminada, capas dibujadas incluidas (`formaDeAbertura`).
  Antes tapaba sólo el cuerpo y los bordes de las capas asomaban en las jambas
  como un escalón al lado del marco.
- **El avance se marca en el 3D** (pedido del usuario: "un selector de tareas
  por rubro para ver y en base a eso ir marcando qué está realizado").
  Migración `20261125100000_el_avance_se_marca_en_el_3d` (la aplica el
  usuario): tabla `avances_del_plano` —planta, piso, cosa (`muro:<id>`,
  `capa:<id>`, `columna:<id>`…), tarea, cantidad en la unidad del cómputo,
  fecha— y la columna `avances.desde_el_plano`.
  - **En el 3D**: Ver / Avance. En Avance se elige rubro y tarea —sólo las
    que el dibujo lleva— y el edificio muestra sólo lo que la lleva: lo hecho
    en verde, lo que falta en blanco, el resto apenas insinuado. Piso por
    piso: una planta tipo son varios pisos y cada uno avanza aparte. El panel
    dice cuánto va de la tarea (m² o m³ y %), y al tocar una cosa, la lista
    de sus tareas para tildar (ver abajo).
  - **Qué lleva cada cosa** (`Ficha.tareas`, en `modeloDePlanta`): el muro su
    ladrillo (mampostería sin vanos ni hormigón); el ambiente su piso y su
    cielorraso; losa, viga y columna su hormigón neto. Con las mismas cuentas
    que el pase al cómputo (`prueba49`).
  - **Lo que va sobre el ladrillo, por cara** (pedido del usuario: "capaz se
    revocó sólo la parte interior y la exterior se hace en otro momento"):
    revoques, aislaciones y revestimientos se marcan cara por cara. Cada lado
    de un muro es su cosa, `cara:<muro>:<lado>` (lado 1 / -1, o la punta a /
    b), con las capas de su tipo o de su ambiente; cada capa dibujada se parte
    en sus caras, `capa:<capa>:<muro>:<lado>`. En el 3D las franjas del tipo
    son de su cara, y una cara con capas que no tienen franja —las que toma
    de su ambiente, las de una punta— lleva una piel fina para verla y
    tocarla. La ficha dice a qué ambiente da ("Cara · Estar-Comedor Frente").
    El total de la tarea es el mismo: sólo se reparte distinto.
  - **De lo marcado a Avances** (`marcarEnElPlano`, `lib/avance-del-plano.ts`):
    la cantidad la rehace el servidor; cada cosa pesa lo que mide sobre lo que
    el cómputo tiene de su tarea, y la tarea lo que cuesta en su rubro (igual
    si no hay precios). Las cargas del plano del rubro se rehacen enteras, una
    por día, comentadas "Marcado en el 3D". Como `avances.porcentaje` es
    entero, se redondea el **acumulado** y cada día lleva la diferencia: diez
    marcas del 0,4 % hacen 4 % (`prueba48`). Las cargas a mano no se tocan.
    Una tarea que no está en el cómputo no se puede marcar.
  - **Cada cosa, con todas sus tareas para tildar** (pedido del usuario: "una
    ventana tiene amure de premarco y colocación… cuando la selecciono que me
    figure qué tildar como realizado y qué queda pendiente"). En Avance, al
    tocar cualquier cosa —con o sin tarea elegida arriba— el panel lista
    **todas** sus tareas, cada una con su tilde, su rubro, lo que mide y
    "Pendiente" o el día en que se hizo; el día de arriba es con el que se
    marca. La tarea que se está mirando se resalta en la lista. Sin orden
    obligado entre pasos: se ve lo que falta, no se traba. Con un rubro
    elegido arriba, la lista trae sólo las de ese rubro (pedido del usuario:
    mirando Cielorrasos, el baño mostraba también el porcelanato y la
    cementicia); sin rubro, todas.
  - **Cada pieza, con sus tareas** (`Solido.tareas`): el piso de un ambiente
    lleva las de su piso (contrapiso, porcelanato y sus subtareas) y su
    cielorraso las suyas. En Avance se pinta, se toca y se resalta sólo la
    pieza que lleva la tarea mirada: con el contrapiso, el balcón ya no
    marca también la placa de su cielorraso. El cielorraso aplicado contra la
    losa tiene ahora su placa fina debajo de ella, para verlo y tocarlo aparte.
  - **Las aberturas llevan tareas** (migración
    `20261126100000_las_aberturas_llevan_tareas`: `tipos_de_abertura.tareas
    uuid[]`; `Abertura.tareas` en el dibujo). Son **del tipo**: en la
    herramienta Abertura y en la abertura elegida, "Tareas" con las suyas
    (× para sacar) y "Agregar tarea…" con todo el catálogo por rubro
    (`getTareasDelCatalogo`). Guardar el tipo las lleva a todas las de ese
    nombre en todas las plantas. Se miden según la unidad de la tarea
    (`cantidadEnUnidad`, `esPorUnidad`, `esPorMetro`): por unidad una cada una,
    en m² su vano, en ml su perímetro; gl no se mide. En el 3D son
    `abertura:<id>`; en el cómputo, un renglón por tipo, piso y tarea —"V01",
    con cuántas hay en unidades— (`delPlano`, `prueba-aberturas`).
  - **Subtareas** (pedido del usuario: "porcelanato canto rectificado y una
    subtarea, pastinado de juntas, que va de la mano"; migración
    `20261127100000_las_tareas_tienen_subtareas`: `tareas.madre_id`, un solo
    nivel; acción `vincularSubtarea`). Se arman en la lista de tareas del
    rubro: cada tarea tiene una flecha que la despliega, con sus subtareas
    (↳, × para soltarlas) y "Agregar subtarea…"; sin buscar, la subtarea
    sólo aparece debajo de su madre. La subtarea es **su propio renglón del
    cómputo**, con su precio, pero no se dibuja: donde el plano lleva la madre
    lleva también la subtarea, con su misma medida (`getSubtareas`, parámetro
    `subtareas` de `delPlano` y `modeloDePlanta`), si se cotiza en algo que
    mide lo mismo (`queMide`: m² con m², ml con ml…); una en gl no se pasa y se
    avisa. En el 3D va sangrada debajo de su madre en la lista para tildar, y
    con "↳" en el desplegable de tareas (`prueba-subtareas`).
  - El 3D busca los nombres y unidades en **todo** el catálogo
    (`getTareasDelCatalogo`), no sólo en las de m² y m³: una tarea de abertura
    por unidad salía "ya no está en el catálogo". Y el pase al cómputo junta
    también las tareas de las aberturas y las subtareas de todo lo dibujado.
- **Las vigas en las esquinas** (pregunta del usuario: "¿pasa lo mismo que
  con el muro?"). El nudo ya se contaba una vez: lo que dos vigas pisan es
  de la que se dibujó primero (`tapado`). Pero marcadas por el eje o por la
  cara de adentro no se pisaban: **faltaba** un cuarto o el rincón entero.
  Ahora `huellaDeVigaUnida` estira cada viga (y cada tabique) en sus puntas
  compartidas hasta tapar el ancho de la otra, como un muro, y el volumen se
  calcula con ese largo unido. Una L de 20 × 45 da 0,27 m³ marcada al eje,
  por adentro o por afuera (`prueba52`). En el balcón de Andonaegui
  (marcado por afuera) no cambia nada.
- **Varias formas de comprar un material** (pedido del usuario: el Sika
  Monotop en bolsa de 25 y de 5 kg, el ladrillo suelto o por pallet). Ya
  estaban las presentaciones (`material_presentaciones`), pero cargar una
  dejaba afuera el envase del material: con la de 5 kg, la de 25 desaparecía.
  Ahora el envase —o "suelto", si se compra de a uno— **siempre** cuenta y
  las presentaciones se le suman (`tamanosDe`, `envaseDe`; dos del mismo
  tamaño son una). En el catálogo, "Se vende en" muestra primero el suyo y
  después los agregados, y el "+" propone la unidad del material (kg en el
  Sika, un en el ladrillo). Cada material es su propio **desplegable**
  dentro del rubro: cerrado, una línea con su nombre y cómo se vende
  ("bolsa 25 kg · bolsa 5 kg"); abierto, arriba nombre, rubro y Guardar, y
  abajo una tabla "Se vende en · Cantidad · Unidad" con la forma propia
  (se guarda con Guardar: sus campos son del mismo formulario por el
  atributo `form`), las agregadas con su × y un renglón para agregar con +.
  Todo en las mismas columnas. 33 kg de Sika: 1 bolsa de 25 + 2 de 5; 300
  ladrillos: 2 pallets de 144 + 12 un (`prueba53`).
- **La barra de la obra, reordenada** (pedido del usuario: "que la
  funcionalidad sea mucho más simple"). En Obra: Estado, Presupuestos,
  Avances, Fotos, **Archivo** (era Documentos), **Plantas y 3D**, **Rubros y
  Tareas**, Materiales y **Gremios**, que salió de las solapas de
  Presupuestos (`/presupuestos/gremios`, ahora con su propio título y su
  ícono en la barra).
- **Archivo** (`/archivo`, `lib/archivo.ts`): todo lo que se fue cargando,
  en carpetas como un Drive, sin guardar nada dos veces —cada archivo sigue
  donde se cargó y se abre por `/archivos/<id>`, que controla el permiso—.
  Carpetas: Proyecto y Obra (documentos por rubro), Planos (el de cada
  planta), Fotos y Facturas (por mes), Cotizaciones (por rubro),
  Administrativa y Lote (por título; Lote también con los comprobantes de
  sus pagos). Sin obsoletos ni carpetas vacías. Mosaico de tarjetas del
  mismo tamaño, migas arriba ("Archivo › Cotizaciones › Demoliciones") y la
  carpeta en la dirección (`?ruta=`). "Subir documento" sigue siendo el de
  siempre, y al guardar vuelve al Archivo.
- **La lista de plantas, más simple** (pedido del usuario: "es clave ver un
  esquema muy simple, volumétrico, de todos los niveles… mucho más chiquito y
  sutil"). Arriba, tres tarjetas del mismo alto: Plantas, Pisos y **Niveles**
  —"±0,00 a +14,20" y al lado el **esquema** (`EsquemaDeNiveles`): cada piso
  de la definición de pisos como una caja apilada a su cota con su altura,
  con un poco de profundidad, sin textos adentro; al pasar el mouse dice
  piso, nivel, altura y planta, y un piso con planta se toca para abrirla
  (sin planta, punteado)—. Abajo, la tabla sólo con Planta, Pisos, Nivel,
  Altura y Superficie, en una línea, y al final de cada renglón subir, bajar
  (`moverPlanta`: renumera `plantas.orden`) y un ojo para abrirla. Así se
  ordenan las fundaciones abajo y el techo arriba de la planta tipo.
- **El cómputo como presupuesto, en PDF** (`/presupuestos/computo/presupuesto`,
  botón "Presupuesto PDF" en el cómputo): una hoja sin la barra de la app,
  con la obra, la fecha y el mes de los precios; cada rubro numerado como
  título ("3. Aislaciones"), sus tareas itemizadas (3.1, 3.2) con unidad,
  cantidad, materiales y M.O. (e integrado si alguna lo usa) por unidad e
  importe —sin columna de unitario—, y el subtotal del rubro; el logo de LAR
  arriba a la derecha; al final el resumen por rubro con su incidencia y el
  total. Todas las tablas con las mismas columnas (`ANCHO`, `table-layout:
  fixed`): los números del mismo ancho y con la misma separación, el título
  alineado como su dato, y el importe del resumen debajo del de cada rubro.
  Van sólo las tareas con cantidad. En el cómputo ya no están
  "Imprimir / PDF" (lo reemplaza este) ni la pestaña "Por nivel" (cada tarea
  muestra lo suyo por piso en su medición).
  "Imprimir / PDF" abre el diálogo del navegador, que la guarda en PDF (A4,
  cada renglón entero, los encabezados repetidos en cada hoja).
- **Sin "Pegar desde Excel"** en la medición de una tarea: era para cargar
  planillas de antes del plano y el 3D, que ahora miden solos.
- **Del cómputo al 3D** (pedido del usuario: "un botón que me lleve al plano
  y me muestre de dónde salen esos números"). En la medición de una tarea,
  la caja "Del plano" tiene "Ver en el 3D", y cada renglón (el piso) es un
  enlace: el 3D abre en Avance con esa tarea (`?desde=computo&tarea=…`), en
  ese piso (`&nivel=`, por su nombre) y, si el renglón es una pieza de la
  estructura —C03, V07—, con esa pieza elegida (`&cosa=`). El total del
  panel es el de los pisos que se miran, así coincide con el renglón; arriba
  aparece "← Cómputo" para volver. Si no coincide, es que el cómputo está
  viejo: el plano cambió desde el último pase ("Pasar de nuevo").
- **Esquina también en la estructura**: la herramienta Esquina está en el
  modo Estructura y une vigas y tabiques como une muros —clic en una, clic
  en la otra: se alargan o recortan hasta cruzarse sus líneas y comparten
  la punta—. `unirEnEsquina` es genérica (sólo usa las dos puntas de cada
  línea); con la punta compartida, `huellaDeVigaUnida` llena el rincón.
- **Tabiques de hormigón** (pedido del usuario: el núcleo del ascensor, "como
  las vigas pero con la altura de una columna"). Son una **variante de la
  viga** (`Viga.tabique`): se trazan igual —por su línea, con su espesor
  (`ancho`) y su línea de referencia, de punta a punta como los muros— con la
  herramienta Tabique del modo Estructura, y se nombran M01, M02 como en la
  planilla. En `medirEstructura` van **como una columna**: de la cara de
  arriba de la losa de abajo al fondo de la losa que tienen encima, y se
  quedan con el hormigón de los nudos (la losa y las vigas les ceden; ellos
  sólo a las columnas y a los tabiques de antes). Le sacan lugar al ladrillo
  como el resto del hormigón. En la planta van rayados (el plano de corte los
  atraviesa) con "M01 15"; en el 3D, del color de las columnas, con su ficha;
  al cómputo van por su tarea (sugerida: Tabiques H°A°) con espesor × alto ×
  largo; y se marcan en el avance como cualquier pieza (`prueba51`).
- **Del 3D se vuelve a la planta de la que se vino**: el botón 3D del editor
  abre `/plantas/3d?desde=<planta>`, y el 3D muestra arriba a la derecha
  "← <nombre de la planta>" para volver a ella sin pasar por la lista.
  Entrando desde la lista de plantas no aparece.
- **La estructura, en el rubro Estructuras del avance**: el 3D ya la ponía
  ahí por la tarea de cada pieza, pero las piezas dibujadas antes de que
  salieran con su tarea sugerida (`tareaSugerida`) no tenían ninguna —no se
  pasaban al cómputo ni aparecían para marcar—. En modo Estructura, solapa
  Planta, "Ponerles su tarea a las N piezas sin tarea" les pone a todas
  juntas la sugerida de su clase: Columnas H°A°, Vigas H°A°, Losa H°A°
  maciza (las metálicas no: se cotizan en kg). Después se guarda y se pasa
  el plano al cómputo; una losa de viguetas se cambia a mano.
- **La mampostería se computa por eje** (pregunta del usuario: en una
  esquina el 3D tomaba los dos muros, "¿se repite el material?"). No se
  repetía: **faltaba**. Se medía la línea marcada, y dos muros marcados por
  la cara de adentro de una L no contaban el rincón (marcados por la de
  afuera, lo contaban dos veces). Ahora `tramoDeMamposteria` mide por el eje
  del ladrillo de unión a unión: en una esquina cada muro llega al eje del
  otro —medio rincón cada uno, el rincón una vez—; en una T, hasta la cara del
  ladrillo de la pared a la que llega; suelto, donde se marcó. Una L de 20
  da 7,5 m² marcada al eje, por adentro o por afuera (`prueba50`). En la
  esquina del baño de Andonaegui: 2,26 → 2,47 m² (los 0,21 del rincón). Y el
  ladrillo de una esquina se corta **a inglete** (`franjasEnPlanta`): en el
  3D cada muro tiene su medio rincón y al tocar uno no se pinta el del otro.
  Los muros marcados por una cara cambian su cantidad: hay que volver a pasar
  el plano al cómputo.
- **Las capas de vista son las mismas en la planta y en el 3D**
  (`lib/capas-de-vista.ts`, `useCapasDeVista`): se guardan en el navegador
  —no en la base: son de quien mira— y lo que se oculta en uno se oculta en el
  otro, también en otra pestaña. El 3D muestra las que tienen volumen: Muros,
  Capas, Aberturas, Pisos (los ambientes), Cielorrasos (apagados al empezar:
  tapan el edificio desde arriba) y Estructura. Para eso las capas —las
  dibujadas y las de un tipo de antes— son su propia clase de sólido
  (`capa`), un pelo más cálidas que el ladrillo, con sus aristas aparte.
- **Espesores redondos**: la suma de las capas de un tipo se limpia del polvo
  de los decimales (0,16 y no 0,15999…, `espesorTotal`), y el espesor que se
  escribe —en la planta o en el 3D— va al medio centímetro
  (`aMedioCentimetro`): 12, 15, 16,5.
- **La cota del muro elegido** (`CotaDeMuro`): en vez del rótulo chico pegado
  al muro —quedaba encima del punto del medio y de la línea marcada—, una
  línea de cota de plano en naranja, afuera del muro pasando sus capas, del
  lado de la línea marcada (arriba o a la izquierda si va por el eje), con
  líneas de referencia, marcas a 45° y el largo en negrita en una pastilla.
  Mide el **muro terminado**: la línea marcada más el revoque de los cantos
  (las capas dibujadas en las puntas sueltas, `cantosDelElegido`): un
  tabique de 0,60 con 2 cm en la punta dice 0,62.
- **El largo a mano, desde la punta fija** (pedido del usuario): en Núcleo,
  "Largo" muestra ese largo terminado y se puede escribir (`darLargo`). La
  punta fija queda quieta y la otra corre por la línea del muro, descontando
  los cantos. La fija es la última que se tocó (`puntaFija`); sin tocar
  ninguna, la que está unida a otro muro. Se ve llena en el plano; la suelta,
  hueca. Con "se mueven juntos", lo que llega a la punta suelta va con ella.
- **En una T, ladrillo contra ladrillo** (pedido del usuario: "ahí pasa el
  revoque por adelante del ladrillo y no es real"). Un muro que llega contra
  otro —con la punta en el medio del otro (`muroQueLaRecibe`: la punta cae
  entre la cara terminada que tiene enfrente y el eje del otro, lejos de sus
  puntas), o donde el otro sigue de largo en un muro en línea— mete su
  ladrillo hasta el ladrillo del otro, y **las capas del otro de ese lado se
  cortan** entre las dos caras del ladrillo que llega (`franjasEnPlanta`,
  `deUnLado`): el revoque de la pared llega hasta el tabique y el del tabique
  termina contra él. Con capas dibujadas, el cuerpo del que llega se estira
  hasta el ladrillo del otro (`cuerpoDeMuro`, nunca se acorta), así la cara
  del otro queda tapada ahí y sus capas se cortan solas; las del tabique y
  las de la pared se unen a inglete en el rincón. Una punta más adentro que el
  eje del otro no es una T (un muro que nace en otro y sigue para el otro
  lado): sin eso, la pared que arrancaba adentro del tabique perdía un pedazo.
  Prueba: `prueba47` (T con revoque del tipo, con capas dibujadas, marcada al
  eje y a la cara del ladrillo; la del revoque da 24,96 m² como a mano).
- **Las capas que casi llegan al rincón, llegan** (`CASI_EN_LA_PUNTA` = 5 cm,
  `planta-capas`): un tramo que termina a menos de 5 cm de donde termina la
  cara va hasta ahí y hace su inglete con la del otro muro. A mano el rincón
  se marca sobre la cara terminada y la capa quedaba 2 cm corta, escalonada.
  Más de 5 cm se respeta: es que se quiso cortar ahí.
- **Muro recortado, capas cortas en la jamba** (la puerta del baño): cuando
  el vecino se toma por la cara terminada con capas dibujadas, el cuerpo del
  muro arranca *después* de su línea (estirar negativo). `carasVisibles` y el
  3D medían ese arranque con una distancia sin signo, así que las caras se
  corrían el doble del recorte y las capas terminaban unos centímetros antes
  del marco. Ahora usan `arranqueDe(cuerpo)`, con signo (`planta-trazo`).
- **Tipologías de abertura, de la obra** (tabla `tipos_de_abertura`,
  migración `20261124100000_las_aberturas_tienen_tipos_de_la_obra`; acción
  `guardarTipoDeAbertura`): en la herramienta Abertura, debajo de Tipo, el
  desplegable **Tipología** tiene los tipos —los de la obra, que mandan, más
  los ya colocados en la planta— con sus medidas y su marco, y al final
  "+ Nuevo tipo". Elegir uno lo pone en el molde; cambiarle ancho, alto, marco
  o cómo abre cambia el tipo (en la obra y en todas las suyas). "+ Nuevo tipo"
  propone el nombre que sigue (P3 después de P2; respeta los ceros: P03) y
  muestra el campo Nombre; el tipo nuevo —o uno que era sólo de la planta— se
  guarda en la obra solo al colocarlo, sin botón de guardar (`colocarAbertura`).
  Guardar un tipo lleva sus medidas, cómo abre y su marco a todas
  las aberturas de ese nombre en todas las plantas (como los tipos de muro);
  la mano, el antepecho y hacia dónde abre son de cada una. Cambiar un tipo
  de la obra desde una abertura lo guarda solo, un rato después de dejar de
  tocarlo. `Dibujo.tiposDeAbertura` (por planta) se sigue leyendo pero ya no
  se escribe. Un nombre que ya es tipo se coloca siempre con las medidas
  del tipo, y al elegir la herramienta el molde trae las de su nombre: antes
  quedaba en 0,80 aunque la P1 de la planta midiera 0,90. Cambiar medidas,
  cómo abre o el marco cambia también el tipo guardado; Copiar y renombrar
  llevan el marco.

#### Cajones de cielorraso (23/11/2026)

Pedido del usuario: el durlock puede cubrir todo el ambiente —eso ya estaba,
el cielorraso del ambiente— o ser un **cajón**, como el de una cocina sobre la
mesada, con un frente de 20 cm o más; hay que computar su fondo y también lo
que baja.

- **Modelo** (`Dibujo.cajones: Cajon[]`): su contorno, como un ambiente; la
  altura de su **fondo**; y sus capas, como las de un cielorraso (placa,
  pintura).
- **Cómputo** (`medirCaras` → `cielorrasos` y `cajones`): a cada capa, el
  fondo más **los frentes por lo que baja**. Frentes son los lados que no van
  contra un muro (`bordeLibre`: se mira 6 cm afuera de cada lado, en ocho
  puntos, si hay cuerpo de muro; un lado a medias cuenta a medias). Lo que
  baja va de su techo —el cielorraso del ambiente donde está, si es más alto
  que el fondo, o la losa— al fondo. Donde hay un cajón el cielorraso del
  ambiente no se hace: se le descuenta su fondo. Probado: cocina de 3,00 ×
  2,00; cajón de pared a pared de 0,60 a 2,40 → placa 2,40 (1,80 + 3,00 ×
  0,20) y la pintura de la losa 4,20; uno de 1,20 contra el muro del fondo →
  1,20 (0,72 + 2,40 × 0,20).
- **Herramienta Cajón**: se contornea como un ambiente (clic en la primera
  esquina o Enter para cerrar); el molde trae el fondo —vacío, 20 cm bajo el
  techo de la planta— y las capas. Se dibuja punteado, como un cielorraso en
  un plano, y se edita igual que un ambiente o una losa (puntos, lados, doble
  clic). Su panel: fondo, frente que resulta, capas y las medidas (fondo, m de
  frente, total). En el 3D es un volumen del fondo a su techo.

#### El panel de propiedades, más simple (23/11/2026)

Pedido del usuario, con una referencia de otro programa: un panel con
secciones que se pliegan, íconos y dibujos, y poco texto. Las piezas están en
`components/PanelPropiedades.tsx` y son para todo lo que se elige en la planta:

- **Cabecera** (`Encabezado`): una tesela con el color y el ícono de lo que
  es, el nombre, un detalle chico y las acciones como íconos (borrar,
  escuadrar).
- **Secciones** (`Seccion`) con su cuenta (Pila 2, Tramos 6), plegables; la
  de Caras del muro arranca cerrada.
- **Renglones** (`Fila`) en tres columnas fijas —ícono, nombre corto, valor en
  una pastilla gris—: todo baja alineado. Campos en pastilla: `CampoNumero`
  (se escribe en cm y se guarda en m), `SelectorDeTarea` (por rubro),
  `Desplegable`, `Segmentado` (opciones con figura).
- **Dibujos**: `AlturaDeCapa` (el muro de piso a techo con la franja de la
  capa y dos bordes que se arrastran; va en la columna del nombre),
  `Pila` (renglones que se arrastran para reordenar), `MiniPlanta` (la capa
  de cerca en planta, con los muros de fondo; tocar una pieza elige su tramo)
  y `CorteDeMuro` (núcleo al medio, lo de afuera a la izquierda y lo de
  adentro a la derecha, cada capa con su espesor).
- **Medidas** al pie, en tres cajas: de la capa superficie, volumen y largo
  (por su línea media); del muro largo, mampostería sin vanos ni hormigón y su
  volumen.

Hecho para **la capa** (la nueva y la elegida) y **el muro**. El muro muestra
el agarre como cinco figuras del muro en corte con la línea en rojo, y el
zócalo de cada lado con el nombre del ambiente al que da. Elegir una
herramienta de dibujar suelta lo elegido: el panel muestra sólo sus opciones.
**Capas desde el corte del muro** (idea del usuario): arriba del corte,
cada lado dice a qué da ("Pasillo", "Baño") con su "+". El "+" agrega una
capa en esa cara de punta a punta del muro, con lo del molde de la
herramienta Capa, encima de lo que ya tenga, y la abre para definirla.
Tocar una capa dibujada en el corte la marca y abajo aparece con dos
acciones: abrirla, o **quitarla de este muro** (`quitarCapaDelMuro`): sale
de las caras de éste y sigue en los demás —"Borrar capa", en cambio, la borra
en todos—. Si era el único muro que la llevaba, la capa se va. Desde una capa a la que
se llegó así, el ícono de muro de la cabecera vuelve a ese muro. El núcleo
va en gris oscuro, como en la planta, para no confundirse con las capas.

Falta pasar al mismo diseño el ambiente, la abertura y la estructura.

#### Del plano al cómputo (22/11/2026)
Botón **Pasar al cómputo** en el listado de Plantas. Lleva lo que el dibujo
mide a la medición de cada tarea (`computo_item_medicion`), y la cantidad de
la tarea sale de ahí como siempre. No hay nada que emparejar: el tipo de un
muro y cada capa **ya son tareas del catálogo**.

Decidido con el usuario:
- **Con un botón, no solo al guardar.** La cantidad de una tarea multiplica
  todos los precios, y un dibujo a medio hacer no tiene por qué moverlos. El
  botón muestra antes, tarea por tarea, lo que tiene hoy y con lo que queda.
- **Un renglón por tarea y por piso** —"Revoque grueso · 2.º piso · Paredes ·
  85,40 m²"—, no uno por cara: la cuenta cara por cara ya se revisa en el
  editor. El `nivel` es el nombre del piso (`nombreDePiso`), así el cuadro
  "Por nivel" los agrupa solo; la `etiqueta` dice de qué parte del dibujo
  sale (Muros, Paredes, Pisos, Cielorrasos). Una planta **sin piso asignado**
  va con su nombre y `unidades` = sus pisos iguales.
- **Lo que vino del plano lleva una marca** (`SignoDelPlano`, la plantita
  azul) al lado de la cantidad en la planilla, y dentro de la medición va
  aparte y **no se edita**: se corrige en el dibujo y se vuelve a pasar.
- **Lo de mano y lo del plano conviven, y se avisa.** Pasar el plano
  reemplaza **sólo** lo que había venido del plano; las vigas pegadas desde
  Excel no se tocan. La cantidad es la suma de las dos cosas. Si una tarea
  tiene de las dos, la marca va en ámbar y la medición lo dice: puede estar
  contada dos veces, y cuál sobra lo sabe quien computa.

Cómo está hecho:
- **Columna `origen`** en `computo_item_medicion` (`mano` | `plano`). Texto y
  no booleano: puede haber una tercera fuente. `guardarMedicionDe` borra y
  reescribe sólo lo de mano, y suma lo del plano a la cantidad.
- **`lib/planta-computo.ts`** (puro): `delPlano()` arma los renglones y
  `compararConComputo()` dice qué cambia. La unidad manda: en **m²** va la
  superficie; en **m³**, espesor × superficie (con un espesor único el renglón
  muestra la cuenta; una capa sin espesor queda en cero, a la vista); en otra
  unidad —ml, u— **no se pasa** y se avisa. Vale la unidad que la tarea tiene
  en el cómputo de la obra antes que la del catálogo.
- **`lib/pase-al-computo.ts`** (servidor): junta plantas, pisos, cómputo y
  catálogo. Lo usan la vista previa, el pase —que **rehace los números** y no
  toma los del navegador— y el cómputo.
- **`pasarAlComputo`** agrega al cómputo las tareas que faltan (con
  `alternarTarea`, o sea con su desglose de modelo) y crea el cómputo si la
  obra no tenía. Escribe los renglones nuevos **antes** de borrar los viejos:
  si falla en el medio quedan de más, que se ve, y no de menos.
- **Una tarea que el plano dejó de medir** y no tiene nada a mano queda en
  **cero**: su cantidad había salido del dibujo. Una que tenía la cantidad
  **escrita a mano, sin medición**, la pierde al pasar; la vista previa lo
  dice en la fila.
- **El cómputo avisa si el dibujo cambió** después del último pase: compara
  lo guardado como del plano con lo que el plano mide ahora (no hay fecha de
  pase que mantener). Sólo si alguna vez se pasó: una obra que no usa el plano
  no paga esa cuenta ni ve el aviso.
- Cada piso se mide con **su** altura de piso a piso, porque de ahí cuelga la
  estructura que le saca lugar al muro: dos pisos de la misma planta con
  distinta altura dan distinta mampostería.

**El hormigón** (23/11/2026) va por el mismo pase, **pieza por pieza**: un
renglón por columna, viga y losa, con su nombre de etiqueta (C01, V03), que
es como se computa una estructura y se controla contra su planilla.
- **Cada pieza lleva su tarea** (`tarea` en `Columna`, `Viga`, `Losa`, en el
  jsonb, sin migración), como un muro lleva su tipo. Columnas y vigas eligen
  entre las tareas en m³; una losa también entre las de m², que es como se
  cotiza la de viguetas. Sin tarea, la pieza no se pasa y la vista previa la
  cuenta como pendiente.
- **El molde arranca con una tarea sugerida**: la del catálogo cuyo nombre
  dice "columna", "viga" o "losa maciza", en m³ y de Estructuras
  (`tareaSugerida`). Así la primera pieza ya sale con tarea; si la obra usa
  otra se cambia en el molde una vez. En la pieza elegida, **"Ponérsela a las
  N columnas sin tarea"**, igual que con los muros: casi todas las piezas de
  una clase son la misma tarea, y elegirla una por una es trabajo sin
  decisión. Sólo toca las que no tienen.
- **La cuenta del renglón**: ancho × alto × largo (`prisma`) si la pieza no
  le cede nada a otra; si cedió un nudo —la viga que entra en la columna o
  que cubre la losa—, su volumen ya descontado (`directo`, con seis
  decimales), porque las tres medidas darían la pieza entera y el nudo se
  contaría dos veces. Una losa maciza va espesor × superficie (`superficie`).
- **Las metálicas no se pasan**: se cotizan en kg y el plano todavía no sabe
  cuánto pesa el metro de cada perfil. La vista previa lo dice.
- **El nivel de una pieza es el piso de su planta**: la estructura dibujada en
  la planta del 1.º piso es la que sostiene el 2.º, pero va con "1.º piso",
  igual que los muros de esa planta. Andonaegui la nombra "sobre 1.º" en su
  planilla de Excel: si hace falta que coincidan, es una etiqueta.

No va todavía: lo que se mide por perímetro (zócalos) y las aberturas por
unidad.

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
normal: el **gasto** no está atado a los flags del rubro
(`usa_materiales`/`usa_mano_obra`) — se puede cargar en cualquiera. En todo
lo demás es un gasto común: se reparte entre las socias, suma al total y al
balance, y **puede llevar Factura A con IVA/crédito fiscal** como el resto. El
"proveedor" de estos gastos va en una tercera categoría, **Varios** (junto a
Proveedor y Contratista); ahí se cargan los ABL, AFIP, agrimensores, etc.
Economía lo muestra como una tercera fila en "En qué se gastó", pero sólo si la
obra tiene alguno.

**También se cotiza** (08/10/2026). Al principio no: "un impuesto se paga, no
se contrata ni se presupuesta". Para un impuesto sigue siendo cierto, pero no
para un honorario profesional —una gestoría municipal pasa su presupuesto antes
de empezar, igual que un contratista—, y esa cotización había que forzarla como
"Mano de obra y materiales". Ahora es el cuarto tipo de cotización, con su
casilla `rubros.usa_administrativo` (apagada por defecto) y su bloque en la
solapa. Lo cotiza **cualquiera**: el trigger `chequear_presupuesto_coherente`
sólo exige contratista para la mano de obra y proveedor para los materiales, y
un tipo que no nombra pasa derecho —un honorario lo factura una gestoría
cargada como contratista, un agrimensor cargado en "Varios" o un estudio
cargado como proveedor—. En el formulario eso se ve en que el desplegable
ofrece las tres categorías y el rótulo pasa a "Quién lo cotiza".

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
saldo pendiente / gastos administrativos / total abonado por lote / incidencia
de lote (US$ por m² de venta). "Gastado en construcción" e "Inversión total
(lote + construcción)" se sacaron de este panel: esa pregunta —cuánto sale el
desarrollo entero— ya la contesta el pie de la torta de Economía/Dólares (más
abajo, "inversión total = obra + lote"), y repetida acá con otro nombre
("desembolsado") confundía más de lo que aclaraba.

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
cuatro columnas, el **balance entre empresas** (aporte por moneda y
diferencia), y el **terreno** reducido a qué puso cada socia y —si el precio
pactado no está saldado— cuánto le resta según su porcentaje.

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

Usa `repartirComprobantes` (`lib/comprobantes.ts`), un cálculo puro que antes
compartía con el balance entre empresas; desde que el balance se simplificó,
este desglose es el único lugar donde se ve lo facturado, lo efectivo y el
crédito fiscal **por empresa**.

El listado suma además el **total de lo que se está viendo** al lado del
contador ("34 gastos de 36 · $ 43.250.000"). Deja afuera anulados y ajustes de
saldo, igual que todos los totales de la app, así cuadra exacto con la tarjeta
de la que se vino.

#### La tabla "Balance entre empresas": aporte por moneda y diferencia
Cinco columnas: Empresa · Particip. · Aporte en dólares · Aporte en pesos ·
Diferencia. **Nada se valúa**: lo que cada socia puso en pesos son pesos y lo
que puso en dólares son dólares, como en el resto de la app. Antes eran nueve
columnas en tres bloques (comprobantes, lo que puso, el reparto) con una
liquidación sugerida abajo, y no se entendía cuál era el número que importaba.

**Qué cuenta como aporte** de una socia, en la moneda en que salió: lo que pagó
de su bolsillo (el gasto menos lo que salió de la cuenta; un gasto cargado en
dólares y pagado sin la cuenta salió en dólares, con parte de la cuenta la
diferencia la puso en pesos), su parte de los gastos compartidos (en partes
iguales, como en la vista), lo que metió en la cuenta (`ingresos` de socia) y
los ajustes de saldo (suma a la que transfirió, resta a la que recibió). Lo
pagado con la cuenta no es de nadie: esa plata ya contó como aporte cuando
entró. Se calcula en la página, sobre `gastos` e `ingresos`; `obra_balance`
sólo aporta la ficha y el porcentaje.

**La diferencia** es lo que cada una puso de más (+, verde) o de menos (−,
rojo) respecto de lo que le toca por su porcentaje del total que pusieron las
socias, **moneda por moneda**; suma cero entre todas. Es más simple que el
`saldo` de la vista, que descontaba lo puesto por inversores y compradores del
total a repartir: acá los terceros no entran, la tabla habla sólo de las socias
entre sí. La columna de dólares y su línea de diferencia aparecen sólo si
alguna socia puso dólares.

**Lo facturado, lo efectivo y el crédito fiscal por empresa** salieron de esta
tabla —eran la mitad de las columnas y otra pregunta— y siguen en el desglose
del listado de gastos, que llega por las tarjetas de arriba.

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

**El período se elige** (`?periodo=`, selector a la derecha del título del
gráfico, con la forma del segundo nivel de solapas): *Toda la obra* mes a mes
—lo de siempre—, **un año solo** mes a mes, o **Año a año** con una barra por
año. Una obra de dos o tres años junta treinta meses en un gráfico de ancho
fijo y las barras se vuelven palitos; con un año a la vista vuelven a leerse,
y el año a año contesta la otra pregunta —cuánto se fue en cada año— sin
sumar barras de reojo. Tocar un año en el año a año lo abre mes a mes. Las
tarjetas **Egresos**, **Ingresos a la cuenta** y **Promedio por mes**
responden al mismo período que el gráfico (con un año elegido la etiqueta lo
dice: "Egresos 2026"); la semana de obra es siempre la de hoy. El selector
sólo aparece con **dos años o más**: con uno, "toda la obra" y ese año son el
mismo gráfico y el año a año sería una sola barra. Un `periodo` inválido en la
URL cae a toda la obra sin error. En esta pantalla las series se llaman
**Egresos** e Ingresos, y no Gastos: es la pareja natural de un flujo.

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

### Borradores de gasto (25/09/2026)
Un gasto se carga con la factura en la mano, y a veces falta un dato —el
cambio, a nombre de quién salió, un precio— y había que elegir entre
inventarlo o perder todo lo escrito. Ahora el alta tiene **Guardar borrador**
(sin validar nada, `formNoValidate`) y el borrador aparece **arriba de todo en
el listado de Gastos, con fondo violeta** y la etiqueta *Borrador*; su enlace
dice **Seguir** y abre el alta con todo como estaba
(`/gastos/nuevo?borrador=<id>`, título "Borrador de gasto"). Desde ahí se
vuelve a guardar como borrador, se **descarta** (botón rojo a la izquierda,
pregunta antes) o se guarda como gasto con las validaciones de siempre, y
entonces el borrador se borra.

**No es un gasto con otro estado: es otra tabla** (`gastos_borradores`). Se
pensó `gastos.estado = 'Borrador'`, que reusaba la edición entera, y se
descartó: un gasto a medio cargar no cumple los checks de `gastos` (quién lo
pone, que la cuenta alcance, factura y titular coherentes) y las cuatro vistas
de saldos, el control de la cuenta y una veintena de consultas de la app
tendrían que saltearlo igual que a los anulados. Un olvido y un borrador
descuadra el balance. En tabla aparte no lo puede sumar nadie.

**Se guarda el formulario tal cual** (`campos` jsonb: nombre del campo →
valores, como los manda el navegador; `lib/borradores.ts`), no columnas
interpretadas: interpretar es lo que un gasto incompleto no permite (sin fecha
no hay cotización, sin monto no hay reparto). Así vuelve también lo que no es
columna de ningún lado, como el modo *el gasto es en pesos: descontar dólares
al cambio*. `GastoForm` recibe `borrador` y cada estado arranca de `gasto`
(editar), del borrador o vacío; `gasto` sigue vacío porque el gasto todavía no
existe. Un campo nuevo del formulario que no se lea del borrador no rompe
nada: sólo arranca vacío al retomarlo.

**El comprobante sí se guarda**: sube a Drive al guardar el borrador (columnas
`comprobante_*` de la tabla), se ve con *Ver* en `/ver/<id>` (`lib/archivos.ts`
lo busca también en los borradores) y al terminar **pasa al gasto** sin volver
a subirse. Si se reemplaza o se quita, el viejo se borra de Drive; al
descartar, también. Los archivos de *varias facturas, una por socia* **no** se
guardan en el borrador (sí sus montos y números): se adjuntan al terminar.
Borrar la obra se lleva los borradores por cascada y su comprobante de Drive.

**Los ve y los toca quien ve la obra** (RLS con `puede_ver_obra`), no sólo
quien lo empezó: está en el listado de todos, y si sólo lo pudiera borrar
quien lo cargó, el que lo termina crearía el gasto y el borrador quedaría en
la lista para cargarse dos veces. El gasto que sale de él pasa por las reglas
de siempre (una empresa carga a su nombre). Un error al guardar el gasto
vuelve al borrador (`?borrador=<id>&error=`), no a un alta vacía. Los
borradores no entran en filtros, búsqueda, contador ni totales del listado.

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
puede traer un flete o un descuento que no son items. Por eso el precio
unitario es opcional (la cantidad no) y una fila a medio llenar no se guarda,
en vez de rechazar el gasto entero.

**Número de factura** (`gastos.numero_factura`, texto y opcional): el campo
aparece en el formulario con cualquier comprobante, **también sin factura**
(25/09/2026): lo pagado en efectivo puede venir con un presupuesto o un remito
numerado, y ese papel es el que identifica la compra. Con efectivo el rótulo
dice *Nº de comprobante* en vez de *Nº de factura*; la columna es la misma,
que a pesar del nombre guarda el número del papel, sea cual sea. Es texto
porque el formato lleva punto de venta y guion (0001-00001234). Se ve en la
etiqueta del comprobante del listado de gastos ("Factura A · 0001-00001234",
"Efectivo · presupuesto 0452") y entra en la búsqueda. Y en el resumen
de **Materiales** cada material lista debajo sus compras —fecha, comprobante
con número, cantidad y costo— con enlace a la ficha del gasto: es lo que
vincula el material con la factura de la que salió.

**La ficha del gasto** (`/obras/<slug>/gastos/<gastoId>`, sólo lectura). Desde
Materiales se llegaba directo a la edición, y una pantalla llena de campos
invita a tocar algo sin querer. La ficha muestra todo lo cargado en una
grilla —fecha, estado, rubro, tipo, proveedor, comprobante con número, monto
(y su valuación si fue en dólares), IVA y titular del crédito fiscal, quién
pagó, lo que salió de la cuenta, observaciones— y la tabla de materiales de la
compra con los precios tal como se cargaron (dice "sin IVA" si son netos).
Arriba, dos acciones y nada más: **Ver factura** (sólo si hay archivo, abre el
visor y vuelve a la ficha) y **Editar gasto**. **Todo enlace a un gasto va a
la ficha**: la columna del listado de Gastos dice "Ver", los movimientos de
Ingresos dicen "Ver" en los gastos (y "Editar" en los ingresos, que no tienen
ficha), y las compras de Materiales también. La edición se alcanza sólo desde
el botón de la ficha.

**El "← Volver" sale solo.** `Volver` sin props, puesto en `ObraHeader`, se
muestra en toda pantalla más honda que `/obras/<slug>/<solapa>` (fichas,
formularios, catálogos, detalles) y vuelve a la pantalla anterior; si la
anterior es un formulario que acaba de guardar, o no hay historial, va a la
solapa. Antes cada pantalla de detalle ponía el suyo con destino fijo
(`<Volver href>` con el nombre de adónde va), que sigue existiendo para las de
primer nivel con un origen claro —Gastos entrando por una tarjeta del
Balance— pero se sacó de las hondas para no tener dos.

**Un gasto entre las socias facturado en varias facturas** (`gasto_facturas`).
El corralón parte una compra grande en dos facturas, una a nombre de cada
socia, con montos iguales o los que diga cada papel, para que cada una
compute su crédito fiscal. Se probó y se descartó "dos gastos enganchados":
el gasto es **uno** —un monto, un reparto entre las socias, un detalle de
materiales que cierra contra el total—; lo que se parte es el comprobante.
En el formulario, con "Entre las socias" **o pagando con la cuenta** (la plata
de la cuenta es de todas) y factura, la casilla *Se facturó en más de una
factura, una por socia* despliega una tarjeta por socia: monto
(`InputMonto`), número y archivo. Tienen que **sumar el gasto** (se muestra
la suma y lo que falta; el server action rechaza si no coincide al centavo).
Con eso el gasto queda sin titular, número ni archivo propios (`null`): cada
dato vive en su factura; tipo y alícuota siguen en el gasto. El **crédito
fiscal** se reparte proporcional al monto de cada factura
(`repartirComprobantes` lee `facturas` y saltea la cadena titular/pagadora),
y lo facturado también. Una factura por socia (`unique (gasto_id,
empresa_id)`); las de monto cero se descartan. Al editar, cada archivo se
conserva salvo que se suba otro o se marque Quitar; desmarcar la casilla borra
las facturas y sus archivos. La ficha lista las facturas con su parte del IVA y
un "Ver factura de X" por archivo; el listado y Materiales muestran los
números unidos con "+".

**Acopios** (`gastos.es_acopio`, `acopio_retiros`, `acopio_retiro_items`). Se
paga y se factura hoy, pero el material entra a la obra después y al pagar no
se sabe del todo qué va a ir. La casilla *Es un acopio* en el gasto de
materiales lo marca: es un gasto como cualquiera para el balance, el crédito
fiscal y lo gastado del rubro, pero **su detalle no tiene que cerrar con la
factura** (el aviso del cierre se reemplaza por una nota) y sus items, si se
cargan, son *lo que quedó acopiado* en el corralón, **no consumo**. Lo que
entra a la obra se registra desde la ficha del acopio, **retiro por retiro
con fecha** (`/gastos/<id>/retiros/nuevo`, `RetiroForm` con el mismo
`ItemsDeMaterial`); el precio del item es opcional y, si falta, se toma del
item del acopio para ese material (con el IVA sumado si el acopio se cargó
neto). En **Materiales**, el consumo del rubro suma los retiros y no los items
del acopio, cada retiro aparece como compra "Retiro del acopio · proveedor"
con la fecha del retiro, y debajo de la tabla del rubro va una línea por
acopio: pagado, cuánto entró en cuántos retiros y cuánto queda. El listado de
gastos lleva la etiqueta ámbar "Acopio". Se eligió retiros con fecha y no
"editar el acopio agregando items" para saber cuándo entró cada cosa.

**Precios con o sin IVA, y el cierre contra la factura.** El monto lleva el IVA
adentro, pero una factura A lista los precios netos y una compra sin factura
sólo tiene el precio final. La marca `gastos.precios_con_iva` (una por gasto,
no por renglón: una factura lista todos sus precios igual) dice cómo leer el
precio unitario: `true` = final; `false` = neto, sólo posible en factura A. En
el formulario la casilla *Los precios incluyen IVA* aparece sólo con factura A
y arranca destildada; para B, C o sin factura no se pregunta y se guarda
`true`. Debajo del detalle va la cuenta, en el orden en que se lee la factura
(así la pidió el usuario el 25/09/2026): **Total del detalle** (lo que suman
los renglones), **Descuento aplicado** (porcentaje y monto), el IVA de la
alícuota si son netos, y **Total abonado** —el monto de arriba del gasto, que
no se vuelve a escribir—. El resumen de Materiales le suma la alícuota a los
precios netos para que el costo no mezcle netos con finales. Los gastos
anteriores quedaron como finales, que es lo que se venía escribiendo.

**El descuento se calcula solo** (`gastos.descuento_detalle`, 25/09/2026). El
corralón lista a precio de lista y abajo descuenta —un 42 %, y redondea el
total—: el detalle sumaba $ 4,9 M contra una factura de $ 2,85 M y la cuenta
quedaba en rojo sin forma de decir por qué. El descuento es **lo que el
detalle suma de más sobre lo abonado**, llevado a la base de los precios (sin
IVA si son netos: la factura descuenta antes del IVA), y el renglón lo muestra
como "42,01 % · − $ 2.064.406,94", o "Sin descuento". **No hay campo para
escribirlo y siempre cierra.** Se probó antes con campos —monto y porcentaje,
después sólo el porcentaje de la factura con una *Diferencia* que mostraba el
redondeo— y el usuario lo simplificó: el total abonado ya está cargado arriba,
así que escribir el descuento era cargar dos veces lo mismo y abría una
diferencia que no existe. Un porcentaje que no figura en la factura es ahora
la señal de un precio mal escrito. Lo único que se avisa es lo contrario: si
el detalle suma **menos** que lo abonado no hay descuento posible, aparece
**Falta en el detalle** en rojo (falta un material o un precio, o hay un flete
que no es item) con el botón *Usar el total del detalle como monto* (no
cuando se paga con la cuenta, donde el monto sale de lo que se saca de cada
lado). En un acopio eso no es error —lo detallado puede ser una parte— y se
dice sin rojo. **No frena el guardado.**

Se guarda **el monto, no el porcentaje** (viaja en un campo oculto; el server
action lo recorta a la suma del detalle y lo pone en cero sin detalle): lo que
manda es el total de la factura, y el porcentaje se deriva. Al editar un gasto
se recalcula con lo que haya en pantalla, no se lee de la base. Los precios de
los items **quedan a precio de lista**, como en el papel —la ficha del gasto
muestra al pie el descuento aplicado con su porcentaje y el total con
descuento—, pero **el costo en Materiales sale descontado**: el descuento se
reparte entre los materiales en proporción a su subtotal (`factorDescuento` en
`lib/items-material.ts`). En un acopio, el precio que un retiro toma del
acopio también sale descontado; el que se escribe en el retiro, no. Los
gastos guardados antes del 25/09 tienen descuento cero hasta que se los abra y
se los vuelva a guardar.

En el formulario el bloque se llama **"Detallar materiales de compra"** y no
"Detalle": el campo de arriba ya se llama Detalle —el texto libre del gasto— y
dos cosas con el mismo nombre en la misma pantalla se confunden. Los items se
agregan con el **"+" de cada fila**, que inserta la siguiente **abajo de
ella** (así se lee una factura, renglón por renglón), y se sacan con el
**tacho** rojo. Sin filas no hay renglón donde poner el "+", y el primero se
agrega con un botón **+ Agregar material**. Hasta el 25/09/2026 eran un "+"
verde y una "✕" roja sueltos, y un guion en el subtotal y en la unidad vacíos
que se leía como un control más: ahora son botones cuadrados con el borde de
`ui.secondaryButton` y dos íconos nuevos del juego de la barra lateral
(`mas` y `tacho` en `IconoObra`), y lo vacío queda vacío.

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
cambió.

**Materiales y rubros se cruzan por nombre.** El catálogo de materiales es
común y su `rubro_id` apunta a los rubros de la **plantilla** (`obra_id` nulo);
un gasto apunta al rubro de su obra, que es otra fila con otro id. Durante un
tiempo el "De este rubro" del desplegable comparaba ids y nunca coincidía, y
el alta desde el gasto le pegaba al material el rubro de la obra (los dejaba en
"Sin rubro" en el catálogo; la migración `materiales_rubro_de_plantilla` los
enderezó). Ahora `getMaterialesCatalogo` (`lib/materiales.ts`) trae cada
material con el **nombre** de su rubro, los formularios pasan el rubro del
gasto por nombre, y el alta busca el rubro de la plantilla por nombre antes de
insertar.

**El desplegable de material es propio** (`SelectorMaterial`): un `<select>`
nativo no pliega grupos y con el catálogo entero se hacía infinito. Cada rubro
es un acordeón; el del gasto va primero, en negrita y abierto, los demás
cerrados pero a mano —una compra de albañilería puede traer un material de
impermeabilización—. Arriba un buscador que mira en todos los rubros y abre
los que tienen resultado. Manda el id por un input oculto `item_material`, así
el server action lee lo mismo de siempre. Al cambiar el rubro arriba, vuelve a
arrancar con ése abierto (ajuste de estado durante el render, no en un efecto).

**El alta desde el gasto no sale del formulario.** "Cargar un material nuevo
al catálogo" en `ItemsDeMaterial` era un enlace al catálogo (en otra pestaña) y
se perdía el gasto a medio cargar. Ahora abre un panel ahí mismo —nombre y
unidad— que llama a `crearMaterialDesdeGasto`, un server action que **devuelve
el material en vez de redirigir**; el componente lo suma a su catálogo en
estado y lo deja elegido en la primera fila sin material (o en una fila nueva).
El material queda con el rubro del gasto, para que la próxima vez aparezca en
su acordeón. Si el nombre ya existía, se devuelve ese. Dos cuidados: los
botones del panel son `type="button"` y el Enter en el nombre se frena, porque
un Enter suelto mandaría el gasto entero.

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
general pondera cada rubro por lo que cuesta: su **mejor costo conocido**, que
es la cotización aprobada si ya la hay y si no el estimado del cómputo, rubro
por rubro (20/11/2026). Un rubro sin ninguna de las dos pesa cero y queda
afuera del ponderado, en vez de entrar con peso inventado; sólo la obra que no
tiene ni cotizaciones ni cómputo cae al promedio simple. La fórmula está en
`lib/avances.ts` y, igual, en la vista `obra_resumen` de la base.

### Documentos (hechos en la otra máquina)
Se clasifican por dos ejes: **ámbito** (de obra / de proyecto / administrativa
/ lote) y **rubro**. Administrativa y Lote van por título en vez de rubro —el
boleto de compraventa o la escritura no son de un rubro de construcción, igual
que un seguro no es de albañilería—. Un documento puede tener varios archivos
(PDF + DWG). Versiones: "Nueva versión" deja la anterior Obsoleta sola; el
encadenado es explícito (`reemplaza_a`). `getTitulosUsados` da los títulos ya
usados **agrupados por ámbito**, para no sugerir "Escritura" al cargar un aviso
de obra. Desde la solapa Lote, el botón **Documentación** entra ya filtrado
(`documentos?ambito=Lote`).

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

### Imagen de portada
El listado de obras (`/`) muestra una imagen por obra, **apaisada 16:9**
(08/10/2026; pasó por 16:9, 4:3 y cuadrada antes de volver acá), para que las
tarjetas queden parejas entre sí tenga o no imagen cada una (sin imagen va un
bloque gris del mismo tamaño, no se achica la tarjeta). Se carga desde Editar
obra → Datos obra, con un encuadre a mano en el navegador
(`components/ImagenPortadaForm.tsx`): el usuario arrastra para mover y desliza
para acercar. Lo que se sube a Drive **ya sale armado** a 960×540: no se
guardan coordenadas, es una imagen más, lista para mostrar tal cual.

**El zoom mínimo entra la foto entera, no la que cubre el marco.** Era al
revés —`object-fit: cover`, nunca un borde vacío— y el usuario lo cambió: una
foto de obra recortada a la fuerza pierde justo el edificio. Lo que sobra a
los costados se rellena con el gris de la tarjeta (`#f4f4f4`), así que el
borde no se ve en el listado. Desde ahí se puede acercar hasta llenar el
marco. El alto del marco se **deriva** de la proporción de salida en vez de
escribirse a mano: con un alto redondeado, el encuadre guardado quedaba
corrido respecto del que se vio. Y el lienzo final se dibuja con la misma
cuenta que la vista previa (centrado, corrido por el pan, en la escala del
zoom) en lugar de calcular un rectángulo de recorte: alejada, la foto no cubre
el marco y ese rectángulo caería fuera de la imagen.

La grilla del listado (`obraGrid`) **ocupa todo el ancho, con un techo de
cuatro por fila** (08/10/2026; antes eran tarjetas de 264 px centradas, que en
un monitor ancho dejaban medio pantalla vacía a los costados). Es
`repeat(auto-fit, minmax(max(calc(25% - 18px), 280px), 1fr))`: el `calc`
descuenta las separaciones del 25% —sin eso entran tres y no cuatro—, el `max`
con los 280 px de ancho mínimo hace que baje sola a tres, dos o una columna al
angostarse, y `auto-fit` colapsa las columnas que sobran, así que con tres
obras cada una se estira a un tercio de la pantalla.

Mismas cuatro columnas que gastos/presupuestos/lote_pagos para su comprobante
(`imagen_drive_id`, `imagen_nombre`, `imagen_mime`, `imagen_tamano`), esta vez
en `obras` directo —una imagen por obra, no hace falta tabla aparte—. Subida y
borrado son server actions normales (`subirImagenObra`/`eliminarImagenObra` en
`app/obras/actions.ts`) que el componente llama **directo como función**, sin
`<form action>`: el archivo ya llega recortado desde el cliente, así que no
hay nada que un formulario nativo agregue.

Ojo, esto ya nos pasó: el componente necesita `key={obra.imagen_drive_id}` en
la página de Editar. Guardar redirige a la misma ruta, y sin la key React
reusa la instancia vieja —se queda mostrando "Guardando..." con el recorte
anterior en vez de la portada nueva—. Mismo problema que el filtro de Pagos
del lote, mismo arreglo.

### Solapas agrupadas (hecho en la otra máquina)
Las solapas de una obra están en dos grupos: **Economía** (Balance, Gastos,
Ingresos, Flujo, Lote, Dólares, Beneficio) y **Obra** (Estado, Presupuestos,
Avances, Fotos, Documentos, Rubros, Materiales).

### Prefactibilidades (estudios de terrenos en CABA)
Solapa nueva en la barra general y botón **Estudio prefactibilidad** al lado
de "Nueva obra" en la portada. Los estudios **no tienen nada que ver con las
obras**: son lotes que se evalúan antes de comprar, y la mayoría no llega a
obra. Tabla `prefactibilidades`, sin FK a `obras` ni a `empresas`; **sólo el
administrador** la ve y la toca (los usuarios de empresa ven las obras donde
participan, y un lote en estudio no es de nadie). Si un lote se compra, la
obra se crea aparte, como siempre.

**Se carga sólo la dirección** (24/09/2026). El alta pide calle y altura y
el resto lo contesta la Ciudad: `lib/ciudad.ts` (SÓLO SERVIDOR) normaliza
con USIG, ubica el centroide de la parcela y le pide a la API de Ciudad 3D
la ficha catastral (SMP, frente, fondo, superficie, lo construido según
AGIP) y la normativa (altura máxima y plano límite, superficie edificable en
planta, FOT, mixtura de usos, distritos especiales y APH, catalogación,
afectaciones, plusvalía, parcelas linderas, links al croquis de parcela).
`valoresDesdeCiudad` lo vuelca en las columnas del estudio. La unidad de
edificabilidad sale de la altura con la misma tabla que usa Ciudad 3D (9 →
U.S.A.B 0, 12 → U.S.A.B 1, 14,6 → U.S.A.B 2, 17,2 → U.S.A.M, 22,8 →
U.S.A.A, 31,2 → Corredor Medio, 38 → Corredor Alto; está en
`lib/prefactibilidad.ts`) y **las plantas son las del Código por unidad**:
PB + 2, 3, 4, 5, 7, 10 y 12 respectivamente. No es una división por altura
de piso —a 3 m por planta 14,6 m daban PB + 3, y el estudio a mano de
Andonaegui 1229 dice PB + 4—. Para una altura que no es la de una unidad
(enrase, área especial) se estima con PB de 3,4 m y pisos de 2,8 m, que
reproduce la tabla entera. Las respuestas crudas quedan en `ciudad` (jsonb)
con la fecha y los avisos de lo que no contestó.

**Todo se corrige a mano desde Editar**, y la ficha marca cada dato
corregido con el valor que traía la Ciudad: compara la columna contra
`valoresDesdeCiudad(ciudad)`, no hay una tabla de fuentes. *Actualizar
desde la Ciudad* vuelve a consultar —por SMP si lo hay, que es exacto; si no,
por dirección— y pisa las correcciones. **Lo que la Ciudad no contesta al
actualizar no borra lo que contestó antes** (`fusionarConsultas`): pasó que
un Actualizar con Ciudad 3D caído dejó un estudio sin normativa. Se conserva
pieza por pieza y el aviso dice de qué fecha es lo que quedó. Lo que la Ciudad no da se carga a
mano: valor del terreno, tipo de desarrollo, LFI y LIB numéricas (sí da la
huella, `sup_edificable_planta_m2`, que manda sobre frente × LFI en el
cálculo), patios, usos permitidos. La ficha es de sólo lectura con Editar
como acción, como la del gasto. Estado del estudio: En estudio · Interesa ·
Descartado.

Las cuentas viven en `lib/prefactibilidad.ts`, **puro** como `lib/reparto.ts`,
para probarlas contra lotes de prefactibilidad conocida sin levantar nada.
Primera aproximación con las simplificaciones del alcance inicial: lote
regular entre medianeras, un solo cuerpo a todo el ancho, hasta la LFI (o el
fondo si el lote es más corto) menos el retiro de frente, por PB más las
plantas cargadas. Da superficie del lote (la cargada, o frente × fondo), área
edificable en planta, superficie construible e **incidencia por m²
construible** —el número que compara lotes— y por m² de lote. Lo que no se
puede calcular da `null`, no cero: cero se leería como "no se construye".

La idea completa (spec del 24/09/2026, guardada en la memoria de Claude) tiene
cuatro etapas: 1 normativa; 2 recomendación programática (deptos, oficinas,
locales, cocheras, puntuadas por normativa, geometría, ubicación y
eficiencia, siempre explicando el porqué); 3 económica (vendible, eficiencia
= vendible / construida, plusvalía, tres alternativas A/B/C); 4 diseño
generativo de plantas. Sin IA: reglas y geometría, con los parámetros
editables desde un panel interno.

**El volumen en 3D** (`components/VolumenLote.tsx`, SVG puro, sin librería,
como la torta). El lote es el polígono real del catastro
(`catastro/geometria`, guardado en `ciudad`) pasado a metros en
`lib/geometria.ts`; sin polígono, un rectángulo de frente × fondo. La
huella edificable no viene como polígono sino como superficie, así que se
recorta como la banda desde el frente cuya área es esa (recorte por
semiplano y bisección sobre la profundidad): es lo que hace la LFI en un
lote entre medianeras, sobre la forma real. El frente es el lado más cercano
a la puerta que dio USIG; sin puerta, el lado más corto. Se levanta hasta la
altura máxima con una línea por planta (PB 3,4 m, pisos 2,8 m), el plano
límite va punteado si está más arriba, y se gira arrastrando. Es la
envolvente, no un proyecto: sin patios ni núcleo.

**Plusvalía** (Ley 6062, `plusvaliaUva` en `lib/prefactibilidad.ts`): se
paga en UVA por los m² que el Código nuevo deja construir de más respecto
del CPU. La fórmula salió de los números de `calcular_plusvalia` de Ciudad
3D y cierra exacta: capacidad del CPU = FOT × superficie de la parcela ×
1,25 (premios), y sobre el exceso incidencia (UVA/m²) × alícuota × 0,8. En
Núñez 4167 (053-128-020) da lo mismo que la API para 400, 800, 1.000 y
1.200 m²; en Andonaegui 1229 el CPU permitía 984,75 m² y no paga. La ficha
lo calcula en vivo sobre la superficie construible del estudio —sigue a las
plantas corregidas— y dice "No paga" o cuánto en UVA, pesos (UVA de
ArgentinaDatos, serie del BCRA, guardada en `ciudad.uva`) y dólares al blue.
En la consulta se le pide además a Ciudad 3D el monto para la superficie
estimada (`ciudad.plusvaliaCiudad`) y, si difiere de la fórmula en más de
una UVA, la tarjeta lo dice: es el chequeo de que la fórmula sigue vigente.

**Tipologías** (`lib/tipologias.ts`, puro; el panel es
`components/Tipologias.tsx`). De frente, profundidad edificable (la de la
huella, no el fondo), huella, plantas y mixtura, el motor deduce: el
**núcleo** (ascensor obligatorio desde PB + 4, escalera de dos tramos, m²
por planta y dónde va), la **planta tipo** entre cuatro candidatas —pasante,
frente y contrafrente, dos al frente, cuatro por planta— con el motivo de
cada descarte, las **unidades** con sus m² y dormitorios (por superficie:
hasta 38 monoambiente, 55 un dormitorio, 75 dos, más tres), el **patio
auxiliar** junto al núcleo, los **retiros** (frente, LFI, lo que queda entre
altura máxima y plano límite), y cuatro **alternativas de programa**
—vivienda, vivienda con local, vivienda con cocheras a nivel, oficinas con
local— con PB, unidades, vendible, eficiencia, a favor, en contra, alertas y
un puntaje 0-10 promedio de normativa, geometría, ubicación y eficiencia; la
mejor queda como recomendada. El modelo es una banda del frente, una banda
del medio de 5 m con núcleo y patio, y una banda del contrafrente; las
cocheras van en PB a nivel, en filas de 2,5 × 5 m con calle de 3 m, y el
subsuelo se descarta si la rampa al 20 % no entra. "Avenida" se lee de la
dirección normalizada de USIG (`AV.`).

**La planta tipo se dibuja** (`lib/plantas-tipo.ts` + `components/PlantaTipo.tsx`,
SVG a escala con la calle abajo), porque la arquitectura en texto no se
lee. El núcleo va en su banda —escalera de 2,6 × 5, ascensor de 1,9 × 2,1,
palier— con el patio auxiliar a la derecha si da el lado mínimo; cada
unidad se parte en una fila que mira a la ventana (estar y dormitorios
principales) y una fila de servicios contra el núcleo (paso de 1,2 m, cocina
que se queda con lo que sobra, baño, y el dormitorio que ventila al patio
cuando la unidad da al patio). Cada ambiente se chequea contra los mínimos
del Código y, si no dan, la unidad baja un dormitorio y lo dice en las
notas; **los dormitorios que dice el dibujo mandan sobre los que estimó la
superficie** (una unidad de 5 m de fondo no arma dos filas aunque los metros
den para un dormitorio), y la lista de unidades los lee del dibujo. Los
programas por dormitorios son datos (`PROGRAMAS`): es el catálogo gráfico
que el usuario quiere ir cargando; el paso siguiente es una tabla
`plantas_tipo` con programas y mínimos editables, y de ahí plantas guardadas
por estudio.

**La base de edificios de referencia** (`edificios_referencia`, pantalla
`prefactibilidades/referencias` con alta y ficha de edición por edificio).
El usuario pasó una planilla con 58 edificios construidos en CABA (estudio,
barrio, dirección, lote, superficie, unidades funcionales y el enlace a las
plantas publicadas, casi todos en ArchDaily) y dijo que el motor tenía
"muchos errores de interpretación de espacios, por ejemplo ingreso a
unidades": esta tabla es la base gráfica que se va cargando para
corregirlo. Cada edificio tiene campos de **resolución** (plantas, unidades
por planta, núcleo, ingreso, patios, tipologías, cocheras, local, notas) que
se completan mirando las plantas; `analizado_en` marca los cargados.

**La base no se muestra en el estudio** (25/09/2026). Hubo una sección de
*Edificios comparables* en la ficha (lotes parecidos, cuántas unidades
sacaron, qué daría esa densidad acá) y el usuario la sacó: la planilla la
mandó como **base de información para resolver plantas**, no para mirar
edificios ajenos en cada estudio. Lo que sale de la base entra al estudio
convertido en reglas y en dibujo, no como lista. La pantalla de referencias
sigue, desde el botón del listado.

Lo que enseñaron las tres primeras plantas leídas (Donado 4432, Zabala 3259,
Jorge Newbery 3136), ya aplicado al dibujo: **el ingreso es un pasillo
lateral de 1,2 m pegado a la medianera del núcleo, de la calle al palier**,
que en PB achica la unidad del frente; **el núcleo va contra la medianera en
la banda del medio, siempre pegado a un patio central** de 4 a 5 m que
ocupa casi todo el ancho restante e ilumina cocinas y baños de las dos
unidades, y el palier abre directo a las puertas; **dos monoambientes al
frente entran desde 8,5 m** (Donado lo hace en 8,67, con unidades de 4,1
m); en 8,5 m entran **seis cocheras en PB en dos columnas** con calle
central (Zabala). Por eso la planta baja también se dibuja (pasillo,
puertas desde el palier, y el frente como local, cocheras o unidad achicada
según la alternativa recomendada). Faltan leer 55 plantas más; las que
contradigan una regla van a `parametros-edificacion.ts`.

Todos los números están en `lib/parametros-edificacion.ts`, cada uno con su
fuente: Código de Edificación, Código Urbanístico o criterio propio. **Los
del Código se escribieron de memoria y llevan `verificar: true`** hasta que
el usuario los contraste con el texto vigente; el panel los lista con esa
marca. Es el "panel interno" de la idea original, por ahora como archivo.
Sin mixtura conocida (la Ciudad a veces no la contesta) no se descarta nada:
se avisa.

**Las fuentes, y sus mañas.** USIG (documentado): `normalizar` da la
dirección oficial, `cod_calle` y el punto de la puerta; el geocodificador
2.2 con `metodo=centroide` da el centro de la parcela de una puerta oficial
en Gauss-Krüger, y `rest/convertir_coordenadas` lo pasa a lon/lat. El
centroide hace falta porque el punto de la puerta cae en la vereda y la
consulta de parcela se la lleva un vecino, o nadie. `datos_utiles` da barrio
y comuna (la zonificación que trae es la del código viejo, no sirve). La API
de Ciudad 3D (`epok.buenosaires.gob.ar`) no está documentada: los endpoints
salen del código abierto del frontend (github.com/gcba/Ciudad-3D,
`source/src/utils/apiConfig.js`). Se usan `catastro/parcela` (por `lng/lat`
o por `smp`), `cur3d/seccion_edificabilidad`, `mixtura_usos`,
`fichadecatalogacion`, `monumento_historico_nacional` y
`parcela_en_microcentro`. Quedan sin usar `cuadrosdeuso/rubros` (los usos
permitidos por categoría y mixtura), `parcelas_plausibles_a_enrase` y
`calcular_plusvalia?area_edificar=`. BA Data (GeoJSON del Código Urbanístico
y de Superficie Edificable en Planta) quedó como plan B si la API de Ciudad
3D desaparece; no se usa, y evitó tener que habilitar PostGIS.

- USIG pierde entre un cuarto y un tercio de las conexiones al azar (una
  sola IP, el SYN no vuelve): `pedir` hace pedidos escalonados —otro cada
  1,5 s si el anterior no contestó— y gana el primero.
- Ciudad 3D corta la conexión (ECONNRESET) si se mandan cabeceras propias
  (User-Agent, Accept): se llama con el fetch pelado. Bajo carga tarda
  varios segundos o corta; la parcela y la edificabilidad van con tres
  intentos y las demás con uno solo, y lo que falte se recupera con
  *Actualizar desde la Ciudad*.
- Fuera de toda parcela `catastro/parcela` contesta `{}` con 200, no un
  error.
- La catalogación con `proteccion: "DESESTIMADO"` es un pedido rechazado: no
  cuenta como catalogado, pero se lista como aviso. `ley_3056: "SI"`
  (edificio anterior a 1941) se lista como afectación: demoler pasa por el
  CAAP.
- El paquete oficial `@usig-gcba/autocompleter` usa además
  `datosabiertos-catastro-apis.buenosaires.gob.ar/catastro/parcela/?codigo_calle=&altura=&geocodificar=true&srid=4326`,
  que daría el SMP directo desde la dirección; en la prueba del 24/09 no
  contestó. Vale reintentarlo: ahorraría dos llamadas a USIG.
- Las páginas cuyas acciones consultan llevan `maxDuration = 60`, por el
  límite de 10 s que Vercel pone por defecto.

## Flujo de trabajo entre dos máquinas

Al empezar: `git pull`. Al terminar: `git add -A && git commit && git push`.
Commits en `main` directo (proyecto de una persona; no usar ramas salvo pedido).
Mensajes de commit en español, explicando el porqué, con `Co-Authored-By`.

**En esta máquina `npx` está bloqueado** por la política de ejecución de
PowerShell (`npx.ps1` no carga). Hay que llamar al `.cmd`, que no pasa por esa
política: `.\node_modules\.bin\supabase.cmd <sub>`, `.\node_modules\.bin\tsc.cmd`,
`.\node_modules\.bin\eslint.cmd`.

**Cuando se AGREGA algo al esquema, el orden no se puede invertir** (20/11/2026,
después de romper la pantalla del catálogo de materiales):
1. Escribir la migración en `supabase/migrations/`.
2. Aplicarla (la corre el usuario, ver abajo).
3. Regenerar los tipos.
4. **Recién ahí** escribir código que nombre las columnas nuevas.
5. Commitear el `.sql` **y** los tipos juntos.

El paso 4 no es una formalidad: un `select` que pide una columna que todavía no
existe **falla entero**, así que la pantalla queda en cero con un "Could not
find the 'X' column of 'Y' in the schema cache". Pasó con `materiales.contenido`
y el catálogo mostró 0 de 213 materiales.

**Cuando se BORRA algo, el orden es al revés**: primero sacarlo del código,
después de la base. Si no, el código viejo sigue pidiendo lo que ya no está.

Regenerar los tipos, con la vuelta que hace falta en Windows:

```
.\node_modules\.bin\supabase.cmd gen types typescript --linked | Out-File "$env:TEMP\tipos.ts" -Encoding utf8
```

y después convertir a UTF-8 sin BOM con Node antes de escribir
`lib/database.types.ts`. **El `>` de PowerShell escribe UTF-16** y deja el
archivo como binario para git. Se verifica con `git diff --stat`: si el diff es
el archivo entero, salió mal.

La base es una sola: una migración se aplica **una vez** desde cualquier máquina.
Cuando el pull trae migraciones ya aplicadas por la otra, no hay que hacer nada.
Antes de subir: `tsc --noEmit`, `eslint .` y `npm run build`.

**Qué puede correr Claude y qué no.** `supabase db push` le está bloqueado por
el clasificador del modo automático: **lo corre el usuario**, y no es algo a
esquivar porque la base es producción. Claude escribe la migración, pasa el
comando y espera. Sí puede correr `supabase.cmd migration list` (`local` y
`remote` iguales en la última fila = aplicada), `migration repair` y
`gen types`. **No existe `supabase db query` en el CLI 2.109.1**, aunque este
documento lo dijera antes.

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

Cada rubro se **desglosa por tipo de gasto**, pero sólo en la leyenda, indentado
bajo el rubro atrás de un "+": material y mano de obra tienen ahí su propio
tono (`aclarar`, en `GraficoTorta.tsx`) y color de fila. En el **anillo no**: se
probó pintando el tono también en el arco (una porción, dos tonos) y el tono más
claro se leía como un color suelto que no está en la leyenda —como si a la
torta le faltara repartir un pedazo—, en vez de leerse como parte del rubro. En
el anillo cada rubro es un solo arco, en su color base, así una vuelta completa
son exactamente las filas de la leyenda y nada más.

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

- **Una migración con el mismo número y otro contenido no corre nunca.** Pasó
  el 13/09: se aplicó `20260913160000` (enganche entre gastos), después se
  descartó ese archivo y se creó otro con el mismo número. Supabase lo dio por
  aplicado y el listado quedaba vacío consultando una tabla inexistente. Si se
  reemplaza una migración ya aplicada: **otro número**, que deshaga lo viejo
  (`drop column if exists`), y `npx supabase migration repair --status reverted
  <número viejo>` para que `db push` no reclame el archivo que ya no existe.
- **La API no ve una tabla nueva hasta que recarga su caché de esquema.** El
  síntoma es "Could not find a relationship between X and Y in the schema
  cache" con la tabla ya creada. Se destraba con `npx supabase db query
  --linked "notify pgrst, 'reload schema';"`.
- **Un error de consulta no puede pasar por "no hay datos".** El listado de
  gastos ignoraba `error` y mostraba "Todavía no hay gastos". Ahora lo deja en
  el log del servidor (`console.error`); hacer lo mismo en cualquier consulta
  cuyo vacío se muestre como estado normal.
- **En `lib/database.types.ts` hay un esquema antes de `public`.** Al insertar
  tipos a mano, va dentro de `public.Tables`, no en el primer `Tables: {` del
  archivo. Y el `select(...)` del cliente tipado tiene que ser un **literal**:
  armado con `+` deja de tiparse y todo el resultado pasa a `GenericStringError`.
- **`cotizacion` tiene cuatro decimales.** Guardar un cambio implícito
  (pesos ÷ dólares) y esperar que `caja_usd × cotizacion` dé los pesos exactos
  falla por hasta medio diezmilésimo por dólar. Por eso el check de la cuenta
  y las comparaciones "¿cubrió todo?" tienen tolerancia (ver Ingresos).

## Pendientes / decisiones abiertas

- **Capas dibujadas, lo que sigue** (ver "Capas dibujadas sobre las caras").
  Hecho: puntas, quitar tramo, pila y el pase de lo de antes. Falta que el
  usuario pase las capas de Andonaegui (el botón escribe en la base de todas
  las plantas de la obra). Pendiente de decidir: medir la mampostería por el
  eje del ladrillo y no por la línea marcada.

- **Plantas, lo que sigue** (decidido con el usuario el 22/11/2026; hecha sólo
  la etapa 1: plano, escala, muros, ambientes y sus medidas).
  **Etapa 2 — terminaciones y cómputo.** Hecho: las terminaciones de pared,
  por capas (ver "Las caras de los muros y sus capas"), y **mandarlas al
  cómputo** junto con la mampostería, los pisos y los cielorrasos (ver "Del
  plano al cómputo"). **La escritura del pase no está probada contra la
  base**: se probaron las cuentas, las pantallas con acciones de mentira y la
  vista previa con la planta tipo de Andonaegui, que sólo lee. Falta que
  alguien lo pase de verdad y mire cómo queda el cómputo.
  Falta lo que se mide **por el perímetro del ambiente** —el
  zócalo, que en el catálogo va en metros lineales—: es el mismo mecanismo de
  capas, con otra unidad. Y las **mochetas**: los
  costados de un vano tienen superficie —el espesor del muro por el alto de
  la abertura, de cada lado— y hoy no cuentan. Las aberturas son cantidades por sí mismas: las carpinterías se
  computan por unidad y por tipo, y la planilla ya las da así.
  **Etapa 3 — vista 3D.** Hecha en general (ver "El edificio en 3D"),
  girable con el mouse, con three.js; la isométrica fija en SVG, como
  `VolumenLote`, se descartó. **Falta**: un punto de referencia común para
  alinear plantas calcadas sobre planos distintos; ver las terminaciones;
  techo y terreno; y decidir si hace falta verlo también adentro del editor,
  con lo que se está dibujando y no sólo con lo guardado.
  **Estructura, lo que falta**: el hormigón ya va al cómputo (ver "Del plano
  al cómputo"). Falta lo metálico —se cotiza en kg y necesita el peso por
  metro de cada perfil— y bases, fundaciones y encadenados. Ojo con
  Andonaegui: su hormigón ya está medido a mano (251 elementos pegados desde
  Excel), así que al pasarlo van a convivir las dos mediciones —con el aviso
  en ámbar— hasta que se borre una.
  **No detecta muros solo**: el plano se calca a mano, y es a propósito —la
  detección automática desde un PDF o un JPG no es confiable—.

- **Las pantallas del inversor y del comprador** (el rol ya existe desde el
  30/09/2026, la vista no). El inversor ve lo que puso y lo que le falta poner
  —su ficha de la agenda de inversores— más el avance de obra, y nada de la
  economía: ni el balance entre socias, ni los gastos, ni la caja. El comprador,
  lo mismo con lo que lleva pagado de su unidad. Falta decidir tres cosas:
  (a) cómo se ata un usuario a su ficha de `inversores` —hoy la agenda no tiene
  usuario—; (b) si ven una obra sola o la lista de las obras donde pusieron
  plata; (c) qué avance ven, porque el ponderado sale de las cotizaciones
  aprobadas —o del cómputo estimado donde todavía no hay— y las dos cosas son
  información de costos. El RLS es lo primero: hoy no ven
  nada porque no tienen empresa, y abrirles la obra por `puede_ver_obra()` les
  abriría todo.
- **Si un desarrollador tiene que cargar más que gastos.** Hoy sólo tiene la
  policy `gastos_insert_empresa`: lee todo de sus obras y escribe gastos. Si
  "ve todo igual que el administrador" también tiene que significar cargar
  avances, presupuestos o fotos, son policies nuevas, una por tabla.
- **Validar `lib/prefactibilidad.ts` contra estudios a mano.** Primer caso,
  Andonaegui 1229 (061-056-021): el estudio del usuario da PB + 4; la Ciudad
  da 14,6 m (U.S.A.B 2) y huella de 129,75 m². Faltan comparar superficie
  construible y vendible cuando el usuario pase sus números.
- **Verificar los parámetros del Código de Edificación** en
  `lib/parametros-edificacion.ts` (ascensor desde PB + 4, escalera 1,20 m,
  dormitorio 9 y 6,5 m², patio auxiliar 3 m y 12 m², cocheras 2,5 × 5 m con
  calle de 3 m, rampa 20 %) contra el texto vigente, y sacarles la marca. Y
  cuando molesten como archivo, pasarlos a una tabla con pantalla de edición.
- **Prefactibilidades, lo que sigue** (decisiones pendientes al 24/09/2026):
  (a) una tabla editable de parámetros del Código por unidad de edificabilidad
  —alturas, planos límite, retiros, patios— cargada por el usuario, no de
  memoria; con eso `plantas_sobre_pb` deja de cargarse a mano; (b) tres a
  cinco lotes reales con prefactibilidad conocida para validar
  `lib/prefactibilidad.ts`; (c) usos permitidos desde `cuadrosdeuso/rubros`
  de Ciudad 3D, por categoría y mixtura; (d) enrase desde
  `parcelas_plausibles_a_enrase` (devuelve `{"enrase": false}` y, si es
  true, las parcelas linderas con su altura: sumaría una franja al volumen);
  (e) etapa 2:
  las tres alternativas (vivienda + local, vivienda + cocheras, oficinas +
  local) con vendible, eficiencia y explicación.
- **Catálogo de núcleos** (propuesto el 25/09/2026, postergado por el
  usuario). En vez de describir el núcleo con texto en cada edificio de
  referencia, juntar núcleos con medidas: el usuario manda la planta tipo y
  la PB de un edificio (captura, PDF o DWG/DXF), se pasa a una ficha
  —caja, escalera, ascensor, palier y puertas, posición en el lote, patio,
  ingreso en PB, en qué lote se usó—, se dibuja en un catálogo para que él
  confirme la lectura, y el motor elige del catálogo en vez de inventar el
  núcleo. Guardado como archivo (`lib/nucleos.ts`, como los parámetros)
  mientras los cargue Claude. Empezar por Donado 4432, Zabala 3259 y Jorge
  Newbery 3136.
- **Borrar un estudio está en la ficha y pregunta antes** (`BotonConfirmar`,
  el primer confirm de la app). Estuvo al pie de Editar y no se encontraba:
  "no se puede eliminar" quería decir "no veo cómo". Los demás borrados de la
  app siguen sin preguntar; si alguno molesta, el botón ya existe.
- **Probar un acopio con retiros de punta a punta** con datos reales: marcar
  el gasto, cargar dos retiros, mirar la ficha y Materiales. La carga de gasto
  con dos facturas y la de pesos con dólares ya se probaron y se borraron.
- **Renombrar los 19 materiales que ya estaban** con el texto de la planilla
  (hoy conservan su nombre viejo: "Bolsa Cemento 25 kg" contra "Bolsa cemento
  25kg" de la planilla). Es una migración de `update` si se quiere.
- **"Más de una cotización aprobada por rubro"** (más abajo) puede estar
  resuelto: el commit `616719a` "Permitir varias cotizaciones aprobadas por
  rubro y tipo" es de la otra máquina. Revisar la nota antes de tomarla como
  pendiente.

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

**Lo último (20/11/2026)**: los dos hallazgos que quedaban de la revisión del
cómputo del 07/10 de los que podían costar datos. Armar el cómputo ya no
desploma el avance de la obra: el peso de un rubro pasa a ser su mejor costo
conocido —la cotización aprobada, y si no el estimado del cómputo— en
`lib/avances.ts` y en la vista `obra_resumen`, con la migración
`20261120120000_el_avance_pesa_el_computo` aplicada. Y destildar una tarea
del catálogo pregunta antes, como el tacho de la planilla, pero sólo cuando
hay algo que perder: la cantidad computada, un desglose que ya no es el de
modelo, o pedidos a cotizar; la pregunta nombra qué se borra.

De esa revisión quedan abiertos los once hallazgos de cálculo (el ajuste por
CAC aplicado en unos lugares y no en otros, cantidades que se descartan en
silencio, totales que no coinciden entre pantalla y Excel). El detalle no
quedó escrito: para retomarlos hay que volver a revisar el cómputo.

**Antes (22 y 23/10/2026)**: la revisión general de obra, gastos y economía,
con sus nueve hallazgos arreglados y desplegados —está entera en
`REVISION-2026-10-22.md`, que vale la pena leer porque explica qué quedó
bien resuelto y no hay que tocar—. Lo más grueso: el candado del borrado de
obra cuenta las ocho tablas que cuelgan, `gasto_facturas.monto` pasa a ser
pesos siempre con lo que dice el papel en `monto_usd`, ninguna action se
cree un guardado que el RLS frenó (`lib/permisos.ts`), un desarrollador
puede cargar la pantalla de gastos entera, y el login distingue una contraseña
mal puesta de un servicio que no responde. Las migraciones de esos días están
todas aplicadas.

**Antes, los mismos días**: un gasto que vuelve todos los meses se carga
repitiendo el anterior (el ↻ de la fila y de la ficha abre el alta precargada,
sin relación con el gasto que se repitió), un pago del lote puede llevar la
cotización con la que se hizo, un gasto puede agregarle a la obra un rubro que
no estaba marcado, y la fila del bloque con "Quitar" dejó de correr los montos
del rubro.

**Antes (08/10/2026)**: lo administrativo también se cotiza —cuarto tipo,
con `rubros.usa_administrativo` y migración `20261008120000`—, y las tres
casillas del encabezado del rubro se reemplazaron por un desplegable
"+ Agregar bloque" más un "Quitar" en cada bloque vacío (`BloquesDeRubro.tsx`).

**Antes, el mismo día**: el logo de LAT Desarrollos reemplaza al título en
el login, la portada y la ficha de obra (`components/Logo.tsx`; en pantalla
angosta el que acompaña se esconde, regla en `globals.css`). El listado de
obras pasa a ocupar todo el ancho con techo de cuatro por fila, y la imagen de
portada vuelve a 16:9, con el zoom del encuadre arrancando en la foto entera.

**Antes (06/10/2026)**: cómputo y presupuesto estimado dentro de
Presupuestos, con catálogo de tareas de Cifras #367 e índice CAC. Migraciones
`20261006120000_computo_y_cac`, `20261006130000_computo_precio_integrado` y
`20261006140000_computo_tipo_por_tarea`, `20261006150000_computo_desglose` y
`20261006160000_desglose_modelo` (tipos editados a mano).

**Antes (30/09/2026)**: los cuatro roles de usuario (administrador,
desarrollador, inversor, comprador) con su emoji, `empresa` renombrado a
`desarrollador` y Usuarios cerrado al administrador. Inversor y comprador
todavía no ven nada: sus pantallas son lo que sigue.

**Antes (25/09/2026)**: gastos con descuento automático, comprobante en
efectivo y pesos pagados con dólares; prefactibilidades con base de edificios
de referencia y la planta tipo dibujada ambiente por ambiente.

**Antes (14/09/2026)**: Flujo con selector de período (toda la obra, un
año, año a año) y tarjetas que responden al período.

**Antes (13/09/2026)**, para ubicarse rápido: obras centradas en la
portada; ingreso de todas las socias a la vez; agenda de ingresos (cuotas
previstas con fecha, `ingresos/agenda`); detalle predefinido en gastos e
ingresos (catálogo `detalles` por ámbito); balance entre empresas reducido a
aporte por moneda y diferencia; alta de material sin salir del gasto y
selector de material por rubro en acordeones; precios con o sin IVA y cierre
del detalle contra la factura; campos de plata con puntos de miles
(`InputMonto`, la tecla punto es la coma); número de factura; ficha del gasto
de sólo lectura (todo enlace a un gasto va ahí); catálogo de materiales
cargado desde la planilla; gasto en varias facturas (`gasto_facturas`);
pesos pagados con los dólares de la cuenta; acopios con retiros con fecha;
"← Volver" automático en toda pantalla honda. Todas las migraciones hasta
`20260913190000` están aplicadas.
