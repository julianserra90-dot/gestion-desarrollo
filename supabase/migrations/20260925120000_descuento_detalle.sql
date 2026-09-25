-- ===========================================================================
-- Descuento sobre el detalle de materiales
-- ===========================================================================
--
-- El corralón lista los materiales a precio de lista y abajo hace un descuento
-- (42 %, y redondea el total). El monto del gasto ya es el de la factura, con
-- el descuento aplicado; lo que faltaba era decir que la diferencia con el
-- detalle **es** un descuento, para que el detalle cierre y para que cada
-- material cueste lo que costó de verdad y no el precio de lista.
--
-- Se guarda el monto y no el porcentaje: el número que manda es el total de
-- la factura, y un porcentaje redondeado (42 %) no lo reproduce al centavo. El
-- porcentaje se deriva: descuento / suma del detalle. Va en la misma base que
-- los precios del detalle —neto si se cargaron netos, final si no—, que es
-- donde lo hace la factura: el IVA se calcula después del descuento.

alter table gastos add column descuento_detalle numeric(14, 2) not null default 0
  check (descuento_detalle >= 0);

comment on column gastos.descuento_detalle is
  'Descuento de la factura sobre la suma del detalle de materiales, en la misma base que los precios (neto o final). El costo de cada material se reduce en la misma proporción.';
