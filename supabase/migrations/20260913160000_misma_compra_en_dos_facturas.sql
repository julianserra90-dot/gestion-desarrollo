-- ===========================================================================
-- Una compra partida en dos facturas: dos gastos, un solo detalle de materiales
-- ===========================================================================
--
-- El corralón parte una compra grande en dos facturas, una a nombre de cada
-- socia, para repartir el crédito fiscal. Cada factura es un gasto —con su
-- monto, quién la pagó, su titular y su archivo, y así el balance y el
-- crédito fiscal siguen como siempre—, pero el material entró una sola vez:
-- cargar los items en las dos lo contaría dos veces en Materiales.
--
-- `compra_de_gasto_id` dice "esta factura es de la misma compra que aquel
-- gasto, y los materiales están allá". El gasto apuntado es el principal y
-- es el único con items; los enganchados no tienen. Una cadena (enganchar a
-- un enganchado) no se permite desde la app: se resuelve al principal.
--
-- `set null` y no `cascade`: borrar la factura principal no borra a la otra,
-- que es plata que salió de verdad; queda suelta, sin materiales, y se le
-- pueden cargar.

alter table gastos
  add column compra_de_gasto_id uuid references gastos(id) on delete set null;

create index on gastos (compra_de_gasto_id);

comment on column gastos.compra_de_gasto_id is
  'Otra factura de la misma compra: los materiales están en el gasto apuntado (el principal), no en éste.';
