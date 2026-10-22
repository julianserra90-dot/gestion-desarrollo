-- ===========================================================================
-- El cambio con el que se hizo un pago del lote
-- ===========================================================================
--
-- `lote_pagos` guardaba `monto` y `moneda` y nada más, así que la conversión se
-- hacía al leer, con el blue de la fecha del pago: un pago en pesos se valuaba
-- a dólares para medir el lote, y uno en dólares a pesos para poder sumarlo con
-- los gastos de obra.
--
-- Eso alcanza para una escribanía, pero no para la compra: los dólares de un
-- lote se consiguen al cambio que se consiguen, que rara vez es el blue de
-- Ámbito de ese día. Sin poder decirlo, la incidencia del terreno y el reparto
-- entre socias salían valuados a un número que no pasó.
--
-- Es el mismo dato que `gastos.cotizacion` ya guardaba para un gasto de obra.
--
-- Null significa "no se cargó", no cero: ahí se sigue usando el blue de la
-- fecha, que es el caso de siempre. Por eso no hace falta un
-- `cotizacion_manual` como el de `gastos`: acá la columna se escribe **sólo**
-- cuando alguien puso el cambio a mano, así que no nula ya quiere decir eso.

alter table lote_pagos
  add column cotizacion numeric(14, 4)
  check (cotizacion is null or cotizacion > 0);

comment on column lote_pagos.cotizacion is
  'Pesos por dólar con los que se hizo este pago, cargados a mano. Null: se valúa al blue de la fecha del pago.';
