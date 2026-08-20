-- ===========================================================================
-- Cuánto se espera vender el metro: el otro lado del negocio
-- ===========================================================================
--
-- Hasta ahora la app contestaba cuánto sale la obra, pero no si conviene: para
-- eso falta contra qué compararlo. Con el valor de venta, la superficie
-- vendible y el costo (objetivo por m² + terreno) sale el beneficio estimado.
--
-- Va en dólares por m² de **venta**, no de construcción: lo que se cobra es lo
-- vendible —un depto vende 35 m² y se construye 36—, y así queda en la misma
-- unidad que el objetivo de costo, que ya está en dólares por metro.
--
-- Es una estimación que se carga a mano en Editar obra y se corrige a medida
-- que el mercado se mueve: no se deriva de ningún dato del sistema. Por eso es
-- una columna suelta y no una vista.

alter table obras
  add column valor_venta_m2_usd numeric(10, 2)
    check (valor_venta_m2_usd is null or valor_venta_m2_usd > 0);

comment on column obras.valor_venta_m2_usd is
  'Valor de venta estimado por m² vendible, en dólares. Se carga a mano y es lo que se compara contra el costo para saber el beneficio.';
