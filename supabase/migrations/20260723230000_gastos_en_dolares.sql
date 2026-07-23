-- ============================================================================
-- Un gasto queda guardado en las dos monedas.
--
-- El problema que resuelve: `monto` guardaba el número tal cual lo tipeaba el
-- usuario, en la moneda que hubiera elegido. Si alguien cargaba USD 1.000, esos
-- 1.000 se sumaban a los pesos como si fueran $1.000 y rompían todos los
-- totales y el balance entre socias.
--
-- Ahora:
--   * monto      -> SIEMPRE en pesos. Es lo que suman las vistas y los totales.
--   * monto_usd  -> el equivalente en dólares.
--   * cotizacion -> el dólar usado para convertir (pesos por dólar).
--   * moneda     -> en qué moneda se cargó, para mostrarlo como se ingresó.
--
-- La conversión se hace al dólar oficial de la FECHA DEL GASTO, no al del día
-- en que se carga: así un gasto viejo no queda valuado al dólar de hoy.
-- ============================================================================

alter table gastos
  add column monto_usd  numeric(14, 2),
  add column cotizacion numeric(14, 4);

alter table gastos
  add constraint gastos_cotizacion_positiva
  check (cotizacion is null or cotizacion > 0);

comment on column gastos.monto is
  'Siempre en pesos, sin importar en qué moneda se cargó. Es lo que suman los totales.';
comment on column gastos.monto_usd is
  'Equivalente en dólares al oficial de la fecha del gasto. Null si no se pudo cotizar.';
comment on column gastos.cotizacion is
  'Pesos por dólar usados en la conversión (oficial, promedio compra/venta).';
comment on column gastos.moneda is
  'Moneda en que se cargó el gasto. El monto se guarda igual en pesos.';
