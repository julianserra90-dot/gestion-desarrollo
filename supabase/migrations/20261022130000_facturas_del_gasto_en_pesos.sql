-- ===========================================================================
-- `gasto_facturas.monto` pasa a ser pesos, con el monto del papel aparte
-- ===========================================================================
--
-- El monto de cada factura se guardaba en la moneda en que se había cargado el
-- gasto: un gasto en dólares pagado sin la cuenta se factura en dólares —es lo
-- que dice el papel— y ese número entraba tal cual. Pero `gastos.monto` son
-- siempre pesos, y las dos cifras se cruzan:
--
--   * `repartirComprobantes` suma `f.monto` a lo facturado de cada socia, que
--     en el resto de la app son pesos. Un gasto de US$ 10.000 aportaba $ 10.000
--     al desglose "A nombre de quién" en vez de $ 14.000.000.
--   * El crédito fiscal de cada factura es `iva * f.monto / g.monto`: con el
--     numerador en dólares y el denominador en pesos, la proporción salía
--     dividida por la cotización, o sea casi cero.
--
-- Ahora `monto` son pesos, igual que en `gastos` y en `ingresos`, y lo que dice
-- el papel vive en `monto_usd`. Mismo criterio que esas dos tablas: los pesos
-- son la unidad en la que la app suma, el dólar es el dato del movimiento.
--
-- `monto_usd` queda en null cuando la factura se escribió en pesos, que es el
-- caso de siempre: null es "no es un dato", no un cero.

alter table gasto_facturas
  add column monto_usd numeric(14, 2)
  check (monto_usd is null or monto_usd > 0);

comment on column gasto_facturas.monto is
  'El monto de esta factura, en pesos, como gastos.monto. Las facturas de un gasto suman su monto exacto.';

comment on column gasto_facturas.monto_usd is
  'Lo que dice el papel cuando la factura se escribió en dólares (gasto en dólares pagado sin la cuenta). Null si se escribió en pesos.';

-- Las filas que quedaron en dólares son las de un gasto cargado en dólares y
-- pagado sin tocar la cuenta: es la única combinación en la que el formulario
-- escribía las facturas en dólares (`!pagaCaja && moneda === "USD"`). Pagando
-- con la cuenta se validaban contra el monto en pesos, así que ya estaban bien.
--
-- El filtro por `cotizacion` es por las dudas: un gasto en dólares sin
-- cotización no puede existir —`convertirMonto` lo frena antes de guardar—,
-- pero sin el filtro una fila así quedaría en null, que la columna no acepta.
--
-- Cada fila se convierte por separado, así que la suma puede quedar a un
-- centavo del monto del gasto. Se deja así: son filas viejas, y el centavo
-- cae dentro de la tolerancia con la que la app compara montos.
update gasto_facturas f
set monto_usd = f.monto,
    monto     = round(f.monto * g.cotizacion, 2)
from gastos g
where g.id = f.gasto_id
  and g.moneda = 'USD'
  and g.caja_ars = 0
  and g.caja_usd = 0
  and g.cotizacion is not null;
