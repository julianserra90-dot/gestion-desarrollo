-- Los materiales se venden en presentaciones
--
-- Un material declaraba un solo envase: el cemento viene en bolsa de 25 kg.
-- Pero muchos se venden de varias formas —el látex en lata de 1, 4 y 10
-- litros y en balde de 20—, y el listado de materiales del cómputo sólo podía
-- decir "27 litros", que no es algo que se le pueda pedir al corralón.
--
-- Cada fila es **una forma de comprar el material**: una lata de 4 litros. El
-- listado elige con qué combinación se cubre lo que hace falta sobrando lo
-- menos posible —27 litros son un balde de 20, una lata de 4 y tres de 1—, y
-- si se necesitan 5 kg de cemento dice que hay que comprar una bolsa.
--
-- `unidad` es en lo que se mide lo que trae, y tiene que ser una de las del
-- material: su unidad, o la de lo que trae su envase. Si no, no hay cómo
-- compararla con lo que se necesita. Eso lo controla la app al guardar.
--
-- Sin presentaciones cargadas vale el envase del material, como hasta ahora:
-- nada de lo que ya funcionaba cambia.

create table material_presentaciones (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references materiales(id) on delete cascade,
  -- Lata, balde, bolsa, rollo.
  nombre      text not null check (length(trim(nombre)) > 0),
  -- Cuánto trae: 4, de una lata de 4 litros.
  contenido   numeric(14, 4) not null check (contenido > 0),
  unidad      text not null,
  creado_en   timestamptz not null default now(),
  unique (material_id, nombre, contenido, unidad)
);

create index on material_presentaciones (material_id);

comment on table material_presentaciones is
  'Las formas de comprar un material: lata de 4 litros, balde de 20. Comun a todas las obras, como el catalogo.';

alter table material_presentaciones enable row level security;

-- Las mismas que el catálogo de materiales: todos leen, agregar lo puede
-- cualquiera, modificar y borrar es del administrador.
create policy material_presentaciones_select on material_presentaciones
  for select to authenticated using (true);

create policy material_presentaciones_insert on material_presentaciones
  for insert to authenticated with check (true);

create policy material_presentaciones_admin on material_presentaciones
  for all to authenticated using (auth_es_admin()) with check (auth_es_admin());
