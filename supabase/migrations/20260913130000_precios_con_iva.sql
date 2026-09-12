-- ===========================================================================
-- Si los precios unitarios del detalle de materiales llevan el IVA adentro
-- ===========================================================================
--
-- El monto del gasto es el total con IVA adentro, pero el precio de cada item
-- se escribía sin decir cómo venía: una factura A lista los precios netos y
-- una compra sin factura tiene sólo el precio final. Sin la marca no se podía
-- comparar la suma del detalle con la factura, ni saber cómo leer esos
-- precios después.
--
-- `true` = el precio unitario es el precio final (IVA adentro, o sin IVA que
-- separar). `false` = neto, y el IVA de la alícuota va aparte; sólo tiene
-- sentido en factura A. Los gastos ya cargados quedan como finales: es lo que
-- se venía escribiendo, y para una compra sin factura es lo único posible.

alter table gastos
  add column precios_con_iva boolean not null default true;

comment on column gastos.precios_con_iva is
  'Cómo se leen los precios unitarios del detalle: true = precio final (IVA adentro); false = neto, sólo en factura A.';
