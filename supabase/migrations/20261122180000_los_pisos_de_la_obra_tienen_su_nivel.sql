-- Los pisos de la obra tienen su nivel
--
-- Una planta dice cómo es un piso: sus muros, sus ambientes, su estructura.
-- No dice **dónde está** en el edificio. Hasta acá alcanzaba con saber cuántos
-- pisos la repiten (`plantas.repeticiones`), porque todo lo que se medía eran
-- cantidades: cuatro pisos iguales son cuatro veces los mismos m². Para
-- levantar el edificio en 3D hace falta lo que falta: a qué altura va cada
-- piso.
--
-- Un piso es un renglón de la definición de pisos de la obra, como la de
-- cualquier programa de arquitectura: su número, su nombre, su **cota de
-- nivel** —el nivel de piso terminado, sobre el ±0,00 de la obra— y su
-- **altura**, que es de piso a piso: de su piso terminado al del que tiene
-- encima. Y cuál de las plantas dibujadas es la suya.
--
--   `numero`    0 es la planta baja; para arriba 1, 2, 3; para abajo -1, -2:
--               los subsuelos. Es el orden, y no hay dos iguales en una obra.
--
--   `cota`      El nivel de piso terminado. Se guarda aunque salga de sumar
--               las alturas desde la planta baja: es lo que se lee en un corte
--               y lo que va a pedir quien arme el 3D, y la suma la hace la
--               pantalla al editar (`lib/pisos.ts`), que es donde se encadenan.
--
--   `altura`    De piso a piso. **No es** la de `plantas.altura`, que es de
--               piso a techo —la que convierte un metro de muro en m² de
--               pared—: entre las dos está el espesor de la losa y del piso.
--
--   `planta_id` La planta dibujada que le toca. Varios pisos pueden tener la
--               misma: eso es una planta tipo, y de ahí sale ahora cuántos
--               pisos la repiten. Null: el piso existe pero todavía no tiene
--               dibujo. Si se borra la planta, el piso queda, sin dibujo.

create table pisos (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references obras(id) on delete cascade,
  numero      integer not null,
  -- Vacío: se lo nombra por su número ("Planta baja", "2.º piso").
  nombre      text not null default '',
  cota        numeric(7, 3) not null,
  altura      numeric(6, 3) not null check (altura > 0),
  planta_id   uuid references plantas(id) on delete set null,
  creado_en   timestamptz not null default now(),
  unique (obra_id, numero)
);

create index on pisos (planta_id);

comment on table pisos is
  'La definicion de pisos de la obra: cada piso con su nivel de piso terminado, su altura de piso a piso y la planta dibujada que le toca.';
comment on column pisos.numero is
  '0 es la planta baja; positivos hacia arriba, negativos los subsuelos.';
comment on column pisos.cota is
  'Nivel de piso terminado, en metros sobre el 0,00 de la obra.';
comment on column pisos.altura is
  'De piso a piso, en metros: de su piso terminado al del piso de arriba. No es plantas.altura, que es de piso a techo.';
comment on column pisos.planta_id is
  'La planta dibujada de este piso. Varios pisos con la misma son una planta tipo. Null sin dibujo.';

alter table pisos enable row level security;

-- Las mismas que las plantas: ve quien ve la obra, escribe el administrador.
create policy pisos_select on pisos
  for select to authenticated
  using (puede_ver_obra(obra_id));

create policy pisos_admin on pisos
  for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
