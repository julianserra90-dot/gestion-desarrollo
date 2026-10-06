-- ============================================================================
-- Precio integrado en el cómputo.
--
-- Al elegir las tareas, cada rubro dice qué se va a cotizar: materiales, mano
-- de obra, o las dos cosas juntas en un solo precio (el caso del herrero que
-- cotiza la reja colocada). Es la misma casilla que ya usa Presupuestos
-- (`rubros.usa_mano_obra_y_materiales`).
--
-- Para el integrado hace falta un precio propio: no es materiales más mano
-- de obra por separado, es un número cerrado que da un solo gremio. Al tildar
-- la tarea arranca en la suma de las dos referencias de Cifras.
-- ============================================================================

alter table computo_items
  add column precio_integrado numeric(14, 2) not null default 0
  check (precio_integrado >= 0);

comment on column computo_items.precio_integrado is
  'Precio unitario de materiales y mano de obra juntos, para rubros que se cotizan integrados.';

update computo_items set precio_integrado = precio_materiales + precio_mano_obra;
