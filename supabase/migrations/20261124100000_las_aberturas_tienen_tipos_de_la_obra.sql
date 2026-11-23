-- Las aberturas tienen tipos de la obra
--
-- Una puerta o una ventana se dibuja con su nombre de planilla —P01, V02— y sus
-- medidas, y todas las del mismo nombre son el mismo tipo. Hasta ahora ese tipo
-- vivía en cada planta: la P01 de la planta baja y la de la planta tipo se
-- cargaban dos veces.
--
-- Ahora los tipos son **de la obra**, como los tipos de muro: se guarda la P01
-- una vez y se pone en cualquier planta; cambiarla la cambia en todas. Cada
-- abertura del dibujo sigue guardando sus medidas (son las que se dibujan y
-- se miden); el tipo es de donde salen y lo que las mantiene iguales.

create table tipos_de_abertura (
  id        uuid primary key default gen_random_uuid(),
  obra_id   uuid not null references obras(id) on delete cascade,
  tipo      text not null check (tipo in ('puerta', 'ventana')),
  nombre    text not null check (length(trim(nombre)) > 0),
  -- En metros.
  ancho     numeric not null check (ancho > 0),
  alto      numeric not null check (alto > 0),
  -- Sólo ventanas: a qué altura arranca, cómo abre y en cuántas hojas.
  antepecho numeric check (antepecho >= 0),
  apertura  text,
  hojas     integer check (hojas >= 1),
  -- Sólo puertas: el marco de cara a cara, en metros. Null: el del muro.
  marco     numeric check (marco > 0),
  creado_en timestamptz not null default now(),
  unique (obra_id, tipo, nombre)
);

comment on table tipos_de_abertura is
  'Los tipos de puerta y ventana de una obra (P01, V02): sus medidas, como abren y su marco, para ponerlos en cualquier planta.';

alter table tipos_de_abertura enable row level security;

create policy tipos_de_abertura_select on tipos_de_abertura
  for select to authenticated
  using (puede_ver_obra(obra_id));

create policy tipos_de_abertura_admin on tipos_de_abertura
  for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
