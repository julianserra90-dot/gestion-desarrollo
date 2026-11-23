-- El avance se marca en el 3D
--
-- Hasta acá el avance de obra se cargaba a mano, rubro por rubro: "+15 % en
-- Albañilería del 22 al 24". Ahora también se puede marcar **en el edificio**:
-- en el 3D se elige una tarea —"Muro ladrillo portante 12x18x33"—, se ven sólo
-- las cosas dibujadas que la llevan, y se toca cada una para decir que está
-- hecha, piso por piso.
--
-- Lo marcado vive en `avances_del_plano`: qué cosa del dibujo (el muro, la
-- columna, la capa de revoque), en qué piso, de qué tarea, cuánto mide en la
-- unidad del cómputo y qué día se hizo. De ahí sale el avance del rubro: cada
-- cosa pesa lo que mide sobre lo que el cómputo tiene de su tarea, y cada tarea
-- lo que cuesta dentro de su rubro.
--
-- Ese avance llega a la solapa de Avances como **cargas comunes**, una por día
-- y por rubro, marcadas `desde_el_plano`. Así el historial, el estado y el
-- avance general las leen como siempre. Cuando se marca o se desmarca algo, las
-- cargas del plano de ese rubro se rehacen enteras; las cargadas a mano no se
-- tocan.

create table avances_del_plano (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references obras(id) on delete cascade,
  planta_id  uuid not null references plantas(id) on delete cascade,
  -- El número del piso en la definición de pisos: 0 la planta baja. Una planta
  -- tipo son varios pisos, y cada uno avanza por su lado.
  piso       integer not null,
  -- La cosa como la nombra el 3D: "muro:<id>", "columna:<id>", "capa:<id>".
  objeto     text not null check (length(objeto) > 0),
  tarea_id   uuid not null references tareas(id) on delete cascade,
  -- Cuánto mide, en la unidad con que el cómputo cotiza la tarea.
  cantidad   numeric not null check (cantidad >= 0),
  fecha      date not null default current_date,
  creado_por uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en  timestamptz not null default now(),
  unique (obra_id, planta_id, piso, objeto, tarea_id)
);

comment on table avances_del_plano is
  'Lo que se marcó como hecho en el 3D: una cosa del dibujo, en un piso, de una tarea, con su cantidad y su fecha.';

create index on avances_del_plano (obra_id, tarea_id);

alter table avances_del_plano enable row level security;

create policy avances_del_plano_select on avances_del_plano
  for select to authenticated
  using (puede_ver_obra(obra_id));

create policy avances_del_plano_admin on avances_del_plano
  for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

-- Las cargas que salen de lo marcado en el 3D: se rehacen solas.
alter table avances
  add column desde_el_plano boolean not null default false;
