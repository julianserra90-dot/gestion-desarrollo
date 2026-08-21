-- ===========================================================================
-- El monto del presupuesto puede ser la suma de lo cotizado
-- ===========================================================================
--
-- En el gasto el monto es el de la factura y **no** sale del detalle: la
-- factura trae el IVA adentro, un flete o un descuento que no son items. En un
-- presupuesto de corralón eso no pasa: el total es justamente la suma de los
-- renglones, y hacer la cuenta a mano para copiarla al campo de arriba es
-- trabajo que la pantalla puede hacer sola —y que a la larga se desincroniza,
-- porque cambiar un precio obliga a acordarse de rehacer el total—.
--
-- Se guarda la intención y no sólo el número, igual que `gastos.cotizacion_manual`:
-- sin esto, al reabrir un presupuesto no se sabe si el monto se escribió a mano
-- o salió de los items, y editar un renglón dejaría el total viejo mintiendo.
--
-- Arranca en `false` para todo lo que ya está cargado: esos montos se
-- escribieron a mano, que es lo único que había hasta ahora.
alter table presupuestos
  add column monto_desde_items boolean not null default false;

comment on column presupuestos.monto_desde_items is
  'Si el monto se calcula sumando los items cotizados. En false es un número escrito a mano.';
