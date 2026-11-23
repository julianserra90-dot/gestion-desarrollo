-- Los muros se arman por capas
--
-- Un muro se dibujaba con un espesor y una tarea —ladrillo hueco del 12—, y
-- sus revoques y terminaciones salían del ambiente al que daba cada cara. Así
-- el espesor dibujado (17 cm, con los revoques) se usaba entero como ladrillo,
-- y un porcelanato hasta 2,10 y un látex hasta el techo se superponían.
--
-- Ahora un muro es de un **tipo**, como en un programa de arquitectura: "Muro
-- exterior 30" es una pila de capas reales —revoque exterior 2 cm, ladrillo
-- 18, revoque interior 1,5, látex—, cada una con su tarea del cómputo, su
-- espesor y entre qué alturas va. El espesor del muro es la suma; el ladrillo
-- se computa con el suyo.
--
-- Los tipos son **de la obra** y no de cada planta: el muro exterior de planta
-- baja es el mismo que el de la planta tipo, y cambiarlo una vez tiene que
-- cambiarlo en todas. Cada muro del dibujo guarda el id de su tipo.
--
-- La composición va en jsonb: se edita y se guarda entera, y quien la lee es
-- la app (`lib/tipos-de-muro.ts`), que la valida al abrir y al guardar.

create table tipos_de_muro (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references obras(id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  -- {nucleo: {tarea, espesor}, exterior: [capa], interior: [capa]}; cada capa
  -- {tarea, espesor, desde, hasta}. Las capas van del núcleo hacia afuera.
  composicion jsonb not null default '{}',
  creado_en   timestamptz not null default now(),
  unique (obra_id, nombre)
);

comment on table tipos_de_muro is
  'Los tipos de muro de una obra: cada uno una pila de capas (revoques, ladrillo, aislacion, terminaciones) con su tarea, espesor y altura.';

alter table tipos_de_muro enable row level security;

create policy tipos_de_muro_select on tipos_de_muro
  for select to authenticated
  using (puede_ver_obra(obra_id));

create policy tipos_de_muro_admin on tipos_de_muro
  for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
