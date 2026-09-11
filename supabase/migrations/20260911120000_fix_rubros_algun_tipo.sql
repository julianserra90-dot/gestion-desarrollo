-- El constraint "al menos un tipo" se escribió antes de que existiera
-- "Mano de obra y materiales" y nunca se actualizó: un rubro que sólo usa el
-- tipo combinado (los otros dos en false) es una combinación válida en la
-- app, pero la base la rechazaba con "violates check constraint
-- rubros_algun_tipo".
alter table rubros drop constraint rubros_algun_tipo;

alter table rubros add constraint rubros_algun_tipo
  check (usa_materiales or usa_mano_obra or usa_mano_obra_y_materiales);
