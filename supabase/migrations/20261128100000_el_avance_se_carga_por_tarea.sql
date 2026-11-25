-- El avance se carga por tarea
--
-- A mano, el avance se cargaba como un porcentaje del rubro entero: "+15 % en
-- Albañilería del 22 al 24", estimado a ojo. En el 3D, en cambio, se marca
-- cosa por cosa y el porcentaje lo saca la cuenta (`lib/avance-del-plano.ts`):
-- cada cosa pesa lo que mide sobre lo que el cómputo tiene de su tarea, y cada
-- tarea lo que cuesta dentro de su rubro.
--
-- Ahora la carga a mano sigue la misma lógica: en la pantalla del rubro se
-- listan sus tareas del cómputo y se dice **cuánto se hizo de cada una** en el
-- período, en su unidad —"12 m² de carpeta"—. Sirve para lo que el plano no
-- dibuja (una tarea global, una instalación) y para cargar sin entrar al 3D.
--
-- Lo cargado vive acá: de qué tarea, cuánto y qué día. Entra a la misma cuenta
-- que lo marcado en el 3D: las cargas del rubro que salen de las dos se rehacen
-- juntas (`avances.desde_el_plano`), y el total de cada tarea es lo del 3D más
-- lo de acá, con tope en el 100 %. Las cargas de porcentaje a mano de antes no
-- se tocan.

create table avances_de_tarea (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references obras(id) on delete cascade,
  tarea_id   uuid not null references tareas(id) on delete cascade,
  -- Cuánto se hizo, en la unidad con que el cómputo cotiza la tarea.
  cantidad   numeric not null check (cantidad > 0),
  fecha      date not null default current_date,
  comentario text,
  creado_por uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en  timestamptz not null default now()
);

comment on table avances_de_tarea is
  'Lo que se cargó a mano como hecho de una tarea del cómputo: cuánto, en su unidad, y qué día.';

create index on avances_de_tarea (obra_id, tarea_id);

alter table avances_de_tarea enable row level security;

create policy avances_de_tarea_select on avances_de_tarea
  for select to authenticated
  using (puede_ver_obra(obra_id));

create policy avances_de_tarea_admin on avances_de_tarea
  for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
