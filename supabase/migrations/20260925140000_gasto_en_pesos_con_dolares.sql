-- ===========================================================================
-- El gasto en pesos pagado con dólares de la cuenta recuerda que fue así
-- ===========================================================================
--
-- "El gasto es en pesos: descontar dólares al cambio" es un modo del
-- formulario: se escriben los pesos del papel y los dólares que salen de la
-- cuenta se calculan al cambio. Lo que se guardaba era el resultado —los
-- dólares y el cambio implícito, pesos ÷ dólares con cuatro decimales— pero
-- no el modo. Al editar, el formulario rearmaba el gasto como dólares
-- cargados a mano: el cambio se mostraba (y se volvía a mandar) redondeado a
-- dos decimales, los dólares ya no daban los pesos del papel, y aparecía un
-- faltante de centavos que "una empresa tenía que aportar". Se guarda la
-- intención, igual que `cotizacion_manual`: sin ella no se sabe cómo se cargó.
--
-- Los que ya estaban se reconocen por cómo quedaron: en pesos, sin pesos de la
-- cuenta y con dólares de ella. Un gasto cargado en dólares queda con moneda
-- USD, y uno con pesos y dólares de la cuenta tiene `caja_ars` > 0.

alter table gastos add column pesos_con_dolares boolean not null default false;

comment on column gastos.pesos_con_dolares is
  'Se cargó en pesos y los dólares que salieron de la cuenta se calcularon al cambio: el monto es el del papel y la cotización, la implícita.';

update gastos
set pesos_con_dolares = true
where moneda = 'ARS'
  and caja_usd > 0
  and caja_ars = 0;
