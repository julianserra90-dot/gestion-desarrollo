-- Las plantas se dibujan sobre el plano
--
-- Hasta acá toda cantidad del cómputo se escribe: alguien mide el plano con una
-- regla o en el CAD, hace la cuenta afuera y carga el resultado. La medición de
-- la tarea (20/11) guardó la cuenta en vez del total, pero la medida sigue
-- viniendo de otro lado.
--
-- Una planta es el plano de un piso, subido como imagen, con lo que se calcó
-- encima: los muros y los ambientes. De ahí salen los metros de muro y los m²
-- de cada ambiente sin medir nada a mano.
--
-- Es la misma idea que el consumo y la medición, un piso más abajo: **guardar
-- lo que se sabe y derivar lo que se necesita**. Lo que se sabe es dónde está
-- cada muro en el plano y cuánto mide la regla; los metros salen de ahí.
--
--   `escala`    Los dos puntos que se marcaron sobre la regla del plano y
--               cuántos metros hay entre ellos. No se guarda "metros por
--               píxel": es el resultado, y guardándolo solo no se podría
--               volver a mostrar la regla ni corregirla. Null hasta que se
--               marca; sin escala el dibujo existe pero no mide.
--
--   `dibujo`    Muros y ambientes **en píxeles de la imagen**, no en metros.
--               Así corregir la escala no mueve nada de lugar —el calco sigue
--               encima del plano— y todas las medidas se rehacen solas. Va en
--               un jsonb y no en una tabla por muro porque el dibujo se edita y
--               se guarda entero, y ninguna consulta pregunta por un muro
--               suelto: las cantidades las calcula la app (`lib/planta-dibujo.ts`).
--
--   `altura`    De piso a techo. Es lo que convierte un metro de muro en m² de
--               pared, que es como se cotizan el revoque y la pintura.
--
--   `repeticiones`  Cuántos pisos son esta misma planta. Un edificio de PB y
--               cuatro pisos iguales son dos plantas: la baja, una vez, y la
--               tipo, cuatro. Dibujarla cuatro veces sería medir cuatro veces
--               lo mismo y equivocarse en alguna.
--
-- La imagen va a Drive como todo archivo de la app; acá queda el id. Un PDF se
-- convierte a imagen en el navegador antes de subir, así que lo guardado es
-- siempre una imagen: el ancho y el alto en píxeles son los de ella, y son el
-- sistema de coordenadas del dibujo.

create table plantas (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid not null references obras(id) on delete cascade,
  -- Como se la nombra: Planta baja, Planta tipo (1.º a 4.º).
  nombre           text not null,
  altura           numeric(6, 3) not null default 2.6 check (altura > 0),
  repeticiones     integer not null default 1 check (repeticiones >= 1),
  imagen_drive_id  text not null,
  imagen_nombre    text,
  imagen_mime      text,
  imagen_ancho     integer not null check (imagen_ancho > 0),
  imagen_alto      integer not null check (imagen_alto > 0),
  escala           jsonb,
  dibujo           jsonb not null default '{"muros": [], "ambientes": []}'::jsonb,
  orden            integer not null default 0,
  creado_en        timestamptz not null default now()
);

create index on plantas (obra_id);

comment on table plantas is
  'El plano de un piso con lo que se calco encima: muros y ambientes, de donde salen las medidas.';
comment on column plantas.escala is
  'Los dos puntos marcados sobre la regla del plano y los metros entre ellos: {a, b, metros}. Null sin calibrar.';
comment on column plantas.dibujo is
  'Muros y ambientes en pixeles de la imagen. Los metros se derivan con la escala.';
comment on column plantas.altura is
  'De piso a techo, en metros: convierte metros de muro en m2 de pared.';
comment on column plantas.repeticiones is
  'Cuantos pisos son esta misma planta (la planta tipo de 1.o a 4.o son 4).';

alter table plantas enable row level security;

-- Las mismas que el cómputo, al que esto alimenta: ve quien ve la obra,
-- escribe el administrador.
create policy plantas_select on plantas
  for select to authenticated
  using (puede_ver_obra(obra_id));

create policy plantas_admin on plantas
  for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
