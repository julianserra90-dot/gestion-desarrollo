-- ============================================================================
-- Un gasto puede pagarse en parte facturado y en parte en efectivo.
--
-- Antes había un único `monto`, sin distinción de cómo se pagó. En obra es
-- habitual que una misma compra se cubra parte con factura y parte en efectivo,
-- y esa distinción importa para la contabilidad.
--
-- `monto` sigue existiendo como el total (lo usan las vistas de balance), pero
-- ahora tiene que ser exactamente la suma de las dos partes: un constraint lo
-- garantiza, así los números no pueden quedar descolgados.
-- ============================================================================

alter table gastos
  add column monto_facturado numeric(14, 2) not null default 0,
  add column monto_efectivo  numeric(14, 2) not null default 0;

alter table gastos
  add constraint gastos_montos_no_negativos
  check (monto_facturado >= 0 and monto_efectivo >= 0);

-- Los gastos ya cargados no tienen desglose. Se asumen facturados, que es lo
-- más común cuando hay comprobante; se pueden corregir editando el gasto.
update gastos set monto_facturado = monto where monto_facturado = 0;

alter table gastos
  add constraint gastos_montos_cierran
  check (monto = monto_facturado + monto_efectivo);

comment on column gastos.monto is
  'Total del gasto. Siempre igual a monto_facturado + monto_efectivo.';
