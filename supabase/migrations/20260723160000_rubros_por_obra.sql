-- ============================================================================
-- Rubros propios de cada obra.
--
-- Antes había una única lista global compartida por todas las obras: renombrar
-- un rubro afectaba a todas, y no se podía tener un rubro que existiera sólo
-- en una obra puntual.
--
-- Ahora:
--   * rubros con obra_id NULL  -> plantilla, sólo sirve para sembrar obras nuevas
--   * rubros con obra_id = X   -> los rubros reales de la obra X
--
-- Las filas ya cargadas (gastos, avances, fotos) se remapean a la copia de su
-- propia obra, así no se pierde ninguna referencia.
-- ============================================================================

alter table rubros add column obra_id uuid references obras(id) on delete cascade;

-- El nombre era único global. Ahora tiene que ser único dentro de cada obra.
-- NULLS NOT DISTINCT hace que la plantilla también respete nombres únicos.
alter table rubros drop constraint rubros_nombre_key;
alter table rubros
  add constraint rubros_obra_nombre unique nulls not distinct (obra_id, nombre);

create index on rubros (obra_id);

-- 1. Cada obra existente recibe su propia copia de la plantilla.
insert into rubros (nombre, orden, obra_id)
select r.nombre, r.orden, o.id
from rubros r
cross join obras o
where r.obra_id is null;

-- 2. Las referencias existentes apuntan ahora a la copia de su obra.
update gastos g
set rubro_id = nuevo.id
from rubros viejo, rubros nuevo
where g.rubro_id = viejo.id
  and viejo.obra_id is null
  and nuevo.obra_id = g.obra_id
  and nuevo.nombre = viejo.nombre;

update avances a
set rubro_id = nuevo.id
from rubros viejo, rubros nuevo
where a.rubro_id = viejo.id
  and viejo.obra_id is null
  and nuevo.obra_id = a.obra_id
  and nuevo.nombre = viejo.nombre;

update foto_registros f
set rubro_id = nuevo.id
from rubros viejo, rubros nuevo
where f.rubro_id = viejo.id
  and viejo.obra_id is null
  and nuevo.obra_id = f.obra_id
  and nuevo.nombre = viejo.nombre;

-- 3. Toda obra nueva arranca con la plantilla ya cargada.
create or replace function sembrar_rubros_de_obra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into rubros (nombre, orden, obra_id)
  select nombre, orden, new.id
  from rubros
  where obra_id is null;

  return new;
end;
$$;

create trigger obras_sembrar_rubros
  after insert on obras
  for each row execute function sembrar_rubros_de_obra();

-- 4. RLS: cada uno ve la plantilla y los rubros de las obras que puede ver.
drop policy rubros_select on rubros;

create policy rubros_select on rubros for select to authenticated
  using (obra_id is null or puede_ver_obra(obra_id));
