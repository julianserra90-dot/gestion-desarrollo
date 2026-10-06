-- ============================================================================
-- El desglose manda, y cada tarea del catálogo trae uno de modelo.
--
-- La planilla tenía columnas de precio unitario editables además del
-- desglose: dos lugares para el mismo número. Ahora el precio de una tarea
-- sale **sólo** de su desglose; la planilla muestra cantidad y totales.
--
-- Para no arrancar cada tarea en blanco, el catálogo guarda un desglose de
-- modelo por tarea (`tarea_desglose`). Al tildar una tarea en una obra, su
-- modelo se copia a la obra y ahí se ajusta. El modelo inicial es la
-- referencia de Cifras —un renglón de materiales y uno de mano de obra por
-- unidad de tarea—; desde la pantalla de desglose se puede guardar uno mejor
-- (cal, cemento y arena para un revoque) como modelo para las obras que
-- vengan.
-- ============================================================================

create table tarea_desglose (
  id              uuid primary key default gen_random_uuid(),
  tarea_id        uuid not null references tareas(id) on delete cascade,
  tipo            text not null
                  check (tipo in ('Materiales', 'Mano de obra', 'Integrado')),
  descripcion     text not null,
  unidad          text not null default 'u',
  cantidad        numeric(14, 4) not null default 0 check (cantidad >= 0),
  precio_unitario numeric(14, 2) not null default 0 check (precio_unitario >= 0),
  orden           integer not null default 0,
  creado_en       timestamptz not null default now()
);

create index on tarea_desglose (tarea_id);

comment on table tarea_desglose is
  'Desglose de modelo de cada tarea del catálogo. Se copia a la obra al tildar la tarea.';

-- El modelo de arranque: la referencia de Cifras partida en sus dos números.
insert into tarea_desglose (tarea_id, tipo, descripcion, unidad, cantidad, precio_unitario, orden)
select id, 'Materiales', 'Materiales (referencia Cifras)', unidad, 1, precio_materiales, 0
from tareas where precio_materiales > 0;

insert into tarea_desglose (tarea_id, tipo, descripcion, unidad, cantidad, precio_unitario, orden)
select id, 'Mano de obra', 'Mano de obra y equipos (referencia Cifras)', unidad, 1, precio_mano_obra, 1
from tareas where precio_mano_obra > 0;

alter table tarea_desglose enable row level security;

create policy tarea_desglose_select on tarea_desglose for select to authenticated
  using (true);
create policy tarea_desglose_admin on tarea_desglose for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

-- ============ Las tareas ya computadas pasan a tener su desglose ============
-- Las que tenían precios a mano y ningún renglón reciben uno por cada precio
-- que estaban usando, así no cambia el total de ninguna obra.

create temporary table sin_desglose on commit drop as
select i.id from computo_items i
where not exists (select 1 from computo_item_desglose d where d.item_id = i.id);

insert into computo_item_desglose (item_id, tipo, descripcion, unidad, cantidad, precio_unitario, orden)
select i.id, 'Materiales', 'Materiales', i.unidad, 1, i.precio_materiales, 0
from computo_items i join sin_desglose s on s.id = i.id
where i.usa_materiales and i.precio_materiales > 0;

insert into computo_item_desglose (item_id, tipo, descripcion, unidad, cantidad, precio_unitario, orden)
select i.id, 'Mano de obra', 'Mano de obra', i.unidad, 1, i.precio_mano_obra, 1
from computo_items i join sin_desglose s on s.id = i.id
where i.usa_mano_obra and i.precio_mano_obra > 0;

insert into computo_item_desglose (item_id, tipo, descripcion, unidad, cantidad, precio_unitario, orden)
select i.id, 'Integrado', 'Integrado', i.unidad, 1, i.precio_integrado, 2
from computo_items i join sin_desglose s on s.id = i.id
where i.usa_integrado and i.precio_integrado > 0;

-- Y los precios de cada tarea quedan como la suma de su desglose, por tipo.
-- Lo que no tiene renglones de un tipo queda en cero: ese precio ya no cuenta.
update computo_items i
set precio_materiales = coalesce(d.mat, 0),
    precio_mano_obra  = coalesce(d.mo, 0),
    precio_integrado  = coalesce(d.int, 0)
from (
  select item_id,
    sum(cantidad * precio_unitario) filter (where tipo = 'Materiales')   as mat,
    sum(cantidad * precio_unitario) filter (where tipo = 'Mano de obra') as mo,
    sum(cantidad * precio_unitario) filter (where tipo = 'Integrado')    as int
  from computo_item_desglose
  group by item_id
) d
where d.item_id = i.id;

update computo_items i
set precio_materiales = 0, precio_mano_obra = 0, precio_integrado = 0
where not exists (select 1 from computo_item_desglose d where d.item_id = i.id);
