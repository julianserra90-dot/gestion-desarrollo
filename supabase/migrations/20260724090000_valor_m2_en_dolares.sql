-- ===========================================================================
-- El valor del m² se piensa en dólares
-- ===========================================================================
--
-- Una obra no se planifica en pesos: se arranca diciendo "esto tiene que dar
-- 800 dólares el metro" y contra ese número se mide todo el tiempo. En pesos la
-- comparación no significa nada, porque el peso de febrero y el de noviembre no
-- son la misma unidad.
--
-- Por eso el objetivo se carga directo en dólares por m², y no se deriva del
-- presupuesto en pesos: es el número con el que se toma la decisión de arrancar.
--
-- Del otro lado, lo gastado ya se guarda con su equivalente en dólares al
-- cambio del día de cada gasto. Sumarlos da el gastado al dólar promedio real
-- de la obra —ponderado por cuánto se gastó en cada momento—, que es más fiel
-- que aplicar una cotización única a todo.

alter table obras
  add column valor_m2_usd numeric(10, 2)
    check (valor_m2_usd is null or valor_m2_usd > 0);

comment on column obras.valor_m2_usd is
  'Objetivo de costo por metro cuadrado, en dólares. Lo que se planeó al arrancar.';
