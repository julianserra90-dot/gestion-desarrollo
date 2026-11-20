-- El desglose del cómputo apunta al catálogo de materiales
--
-- Un renglón de desglose dice "Bolsa cemento 25kg, 0,25 por m²" con la
-- descripción escrita a mano, mientras que el gasto, el presupuesto y el
-- retiro de un acopio nombran el mismo material por `material_id`. Son dos
-- mundos para la misma cosa, y se nota en dos lugares:
--
--   - El material que se carga en el catálogo no se puede elegir al armar un
--     desglose: hay que volver a escribirlo.
--   - El "Listado de materiales" del cómputo agrupa por el texto en
--     minúsculas, así que "Bolsa cemento 25kg" y "Bolsa Cemento 25 kg" son dos
--     materiales distintos y cada uno suma por su lado.
--
-- La columna es **opcional**, y tiene que serlo: un desglose lleva también
-- mano de obra, y un renglón de materiales puede ser algo que no está en el
-- catálogo y no vale la pena dar de alta. La descripción se queda igual: es lo
-- que se muestra, y es lo único que queda cuando no hay material.
--
-- `on delete set null` y no `cascade`: si se borra un material del catálogo, el
-- desglose no puede perder el renglón —son cantidades computadas—, sólo el
-- enlace.
--
-- Va en las dos tablas, la de la obra y la de modelo, porque el modelo se copia
-- a la obra tal cual al tildar la tarea: si una tuviera la columna y la otra
-- no, el enlace se perdería justo al usarlo.

alter table computo_item_desglose
  add column material_id uuid references materiales(id) on delete set null;

alter table tarea_desglose
  add column material_id uuid references materiales(id) on delete set null;

create index on computo_item_desglose (material_id);
create index on tarea_desglose (material_id);

comment on column computo_item_desglose.material_id is
  'El material del catálogo, si el renglón es uno. Null en mano de obra y en lo que no está en el catálogo.';

comment on column tarea_desglose.material_id is
  'El material del catálogo, si el renglón es uno. Se copia a la obra al tildar la tarea.';

-- -------- Lo ya escrito a mano se engancha donde el nombre coincide ---------
--
-- Se comparan sin mayúsculas y sin espacios, que es como difieren en la
-- práctica ("Bolsa cemento 25kg" contra "Bolsa Cemento 25 kg"). Sólo se
-- engancha lo que cae en **un** material: si dos del catálogo se normalizan
-- igual, ninguno de los dos gana, porque elegir mal acá es peor que no
-- enganchar —el renglón quedaría contando como otro material—. Lo que no
-- enganche se sigue viendo igual, por su descripción, y se puede atar a mano
-- desde la pantalla de desglose.

-- Cada material cuya clave no comparte con ningún otro. Se escribe como un
-- "no existe otro igual" y no agrupando: no hay agregado de uuid en Postgres
-- (`min(uuid)` no existe), y además así se lee lo que la regla quiere decir.
create temporary table materiales_por_clave on commit drop as
select lower(replace(m.nombre, ' ', '')) as clave, m.id as material_id
from materiales m
where not exists (
  select 1 from materiales otro
  where otro.id <> m.id
    and lower(replace(otro.nombre, ' ', '')) = lower(replace(m.nombre, ' ', ''))
);

update computo_item_desglose d
set material_id = m.material_id
from materiales_por_clave m
where d.tipo = 'Materiales'
  and d.material_id is null
  and lower(replace(d.descripcion, ' ', '')) = m.clave;

update tarea_desglose d
set material_id = m.material_id
from materiales_por_clave m
where d.tipo = 'Materiales'
  and d.material_id is null
  and lower(replace(d.descripcion, ' ', '')) = m.clave;
