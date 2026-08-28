-- ============================================================================
-- "Lote" como ámbito de documentos.
--
-- El terreno se lleva aparte de la obra en todo lo demás —gastos, balance,
-- presupuestos— porque es una compra de inmueble y no una parte de la
-- construcción. Sus papeles (boleto de compraventa, escritura, la
-- documentación de la operación) tampoco son de un rubro, así que hasta ahora
-- no tenían dónde archivarse aparte de mezclarse en "Administrativa" con
-- avisos de obra y seguros.
--
-- Se agrega como un cuarto ámbito, con la misma forma que Administrativa: sin
-- rubro, con título libre.
-- ============================================================================

alter table documentos drop constraint documentos_ambito_check;
alter table documentos add constraint documentos_ambito_check
  check (ambito in ('Obra', 'Proyecto', 'Administrativa', 'Lote'));

alter table documentos drop constraint documentos_clasificacion_check;
alter table documentos add constraint documentos_clasificacion_check check (
  (ambito in ('Obra', 'Proyecto') and rubro_id is not null and titulo is null)
  or
  (ambito in ('Administrativa', 'Lote') and rubro_id is null and titulo is not null)
);
