-- La semana con la que se identifica un gasto.
--
-- La semana de obra ya se calculaba de la fecha, pero era sólo una lectura: no
-- se podía marcar que un pago **es** el de la semana 13. Y hacía falta, porque
-- la semana venía escrita a mano adentro del concepto ("Semana 7"), donde es
-- texto suelto: no se puede filtrar, ni agrupar, ni sumar.
--
-- Es opcional (`null` = este gasto no se identifica por semana): un acopio de
-- material o un pago de ABL no son de ninguna semana. Al tildarlo, el formulario
-- propone la que sale de la fecha, y se puede pisar —un pago que se hace el
-- lunes puede corresponder al trabajo de la semana anterior—. Por eso se guarda
-- en vez de derivarse siempre.
--
-- Va sin clave foránea ni tabla de semanas: es un número y nada más. El rango de
-- fechas de cada semana sale de `obras.fecha_inicio` (`lib/semanas.ts`).

alter table gastos
  add column semana integer check (semana is null or semana > 0);

create index on gastos (obra_id, semana);

comment on column gastos.semana is
  'Semana de obra con la que se identifica el pago. Null si no aplica. Se propone desde la fecha pero se puede corregir.';
