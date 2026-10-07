-- ============================================================================
-- Las unidades del cómputo, como se dicen en obra.
--
-- El catálogo vino de Cifras con "u" para unidad, "m" para metro lineal y
-- "día" para el alquiler del volquete. En obra se dice "un" y "ml", y el
-- tiempo no es unidad de cómputo: el volquete se cuenta por unidad. Se pasan
-- el catálogo, los modelos de desglose y lo ya computado en las obras, para
-- que la lista de la pantalla coincida con lo guardado.
-- ============================================================================

create temporary table equivalencias (vieja text primary key, nueva text not null)
on commit drop;

insert into equivalencias values
  ('u', 'un'),
  ('m', 'ml'),
  ('día', 'un'),
  ('t', 'tn'),
  ('l', 'litro');

update tareas x set unidad = e.nueva from equivalencias e where x.unidad = e.vieja;
update tarea_desglose x set unidad = e.nueva from equivalencias e where x.unidad = e.vieja;
update computo_items x set unidad = e.nueva from equivalencias e where x.unidad = e.vieja;
update computo_item_desglose x set unidad = e.nueva from equivalencias e where x.unidad = e.vieja;

-- Los valores por defecto de las tablas, igual.
alter table tarea_desglose alter column unidad set default 'un';
alter table computo_item_desglose alter column unidad set default 'un';
