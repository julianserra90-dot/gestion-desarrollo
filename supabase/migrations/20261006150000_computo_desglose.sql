-- ============================================================================
-- Desglose interno de cada tarea del cómputo.
--
-- Una tarea del cómputo es un renglón con cantidad (m² de muro, metros de
-- cerco) y un precio unitario. Pero ese precio sale de algo: el muro lleva
-- ladrillos, mezcla y la mano de obra del albañil; el cerco lleva la gráfica
-- ploteada y lo que cobra el herrero. Ese análisis es lo que después se sale
-- a cotizar, y tiene que quedar adentro de la tarea.
--
-- Cada renglón del desglose va **por unidad de la tarea**: 15 ladrillos por
-- m², 0,8 horas de oficial por m². El total de la tarea es su cantidad por la
-- suma del desglose, así que cambiar los m² del muro rehace todo sin tocar el
-- análisis. Para algo que se cotiza cerrado (el cerco entero) se pone la tarea
-- en cantidad 1 y el desglose en montos totales: da lo mismo.
--
-- Cuando una tarea tiene desglose, sus precios unitarios (materiales, mano de
-- obra, integrado) dejan de escribirse a mano: son la suma de los renglones de
-- cada tipo, y se recalculan al guardar el desglose.
-- ============================================================================

create table computo_item_desglose (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references computo_items(id) on delete cascade,
  tipo            text not null
                  check (tipo in ('Materiales', 'Mano de obra', 'Integrado')),
  descripcion     text not null,
  unidad          text not null default 'u',
  -- Por unidad de la tarea: cuántos de esto lleva un m² de muro.
  cantidad        numeric(14, 4) not null default 0 check (cantidad >= 0),
  precio_unitario numeric(14, 2) not null default 0 check (precio_unitario >= 0),
  orden           integer not null default 0,
  creado_en       timestamptz not null default now()
);

create index on computo_item_desglose (item_id);

comment on table computo_item_desglose is
  'Análisis de una tarea del cómputo: qué materiales y mano de obra lleva por unidad de la tarea.';
comment on column computo_item_desglose.cantidad is
  'Por unidad de la tarea (por m² de muro, por metro de cerco), no el total de la obra.';

-- Con desglose, una tarea puede llevar a la vez algo integrado (la gráfica
-- ploteada y colocada) y materiales sueltos: el integrado ya no excluye.
alter table computo_items drop constraint computo_items_integrado_solo;

alter table computo_item_desglose enable row level security;

create policy computo_item_desglose_select on computo_item_desglose
  for select to authenticated
  using (exists (
    select 1 from computo_items i
    where i.id = computo_item_desglose.item_id and puede_ver_obra(i.obra_id)
  ));

create policy computo_item_desglose_admin on computo_item_desglose
  for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
