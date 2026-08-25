-- ===========================================================================
-- La agenda de inversores: por cuánto firmaron y cuánto les falta poner
-- ===========================================================================
--
-- Un inversor era hasta acá un nombre escrito a mano en cada ingreso
-- (`ingresos.aportante`). Alcanzaba para saber de dónde vino la plata, pero no
-- para la pregunta que se hace todo el tiempo: **por cuánto se comprometió y
-- cuánto le falta**. Con el nombre suelto no hay a qué colgarle el compromiso,
-- y dos aportes de la misma persona sólo se juntan si el nombre se escribió
-- igual las dos veces.
--
-- La agenda es **por obra**: se invierte en un edificio, no en el estudio.
--
-- Y entran también los **compradores de unidades**, que tienen exactamente la
-- misma forma —firman por un monto y lo pagan en cuotas—. Por eso un `tipo` con
-- los mismos valores que `ingresos.origen`, y no dos tablas gemelas.

create table inversores (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid not null references obras(id) on delete cascade,
  tipo             text not null check (tipo in ('Inversor', 'Comprador')),
  nombre           text not null,
  -- Opcional: "Familia García" no tiene apellido, y una sociedad tampoco.
  apellido         text,
  -- **Los dos lados no se mezclan**, como en la cuenta de la obra: quien firmó
  -- por US$ 100.000 los debe en dólares, y aportar pesos no le baja esa deuda.
  -- Nada se valúa de un lado al otro. El día que se quiera netear, el dato está
  -- en cada ingreso (`cotizacion`), pero es una decisión que nadie tomó.
  comprometido_ars numeric(14, 2) not null default 0 check (comprometido_ars >= 0),
  comprometido_usd numeric(14, 2) not null default 0 check (comprometido_usd >= 0),
  observaciones    text,
  creado_en        timestamptz not null default now()
);

-- Los dos compromisos arrancan en cero y **no se exige que alguno sea mayor**:
-- los inversores que se traen de los ingresos ya cargados tienen aportes pero
-- nadie sabe por cuánto firmaron. Cero es "no se sabe", y la pantalla lo dice
-- así en vez de inventar un saldo.

-- El mismo nombre no se carga dos veces en una obra: la agenda existe para que
-- los aportes de una persona caigan todos en la misma ficha. Sin distinguir
-- mayúsculas, que es como se cuelan los duplicados de verdad ("Juan Perez" y
-- "juan perez"). Va como índice y no como `unique (...)` porque el apellido es
-- opcional y dos nulls no chocan entre sí.
create unique index inversores_sin_repetir
  on inversores (obra_id, tipo, lower(nombre), lower(coalesce(apellido, '')));

create index on inversores (obra_id);

comment on table inversores is
  'Agenda por obra de inversores y compradores: por cuánto firmaron, en pesos y en dólares por separado.';

-- Cada aporte cuelga de su ficha. `restrict` y no `cascade`: borrar a alguien
-- con aportes cargados borraría plata que entró de verdad, así que primero hay
-- que resolver qué pasa con esos ingresos.
alter table ingresos
  add column inversor_id uuid references inversores(id) on delete restrict;

create index on ingresos (inversor_id);

comment on column ingresos.aportante is
  'Legado: el nombre suelto de antes de la agenda. No se escribe más, queda como respaldo de los ingresos viejos.';

-- Los que ya estaban cargados a mano pasan a la agenda, para que la solapa
-- arranque con la historia real y no en blanco. Un nombre por obra y tipo.
insert into inversores (obra_id, tipo, nombre)
select distinct i.obra_id, i.origen, btrim(i.aportante)
from ingresos i
where i.origen in ('Inversor', 'Comprador')
  and i.aportante is not null
  and btrim(i.aportante) <> '';

update ingresos i
set inversor_id = v.id
from inversores v
where v.obra_id = i.obra_id
  and v.tipo = i.origen
  and v.nombre = btrim(i.aportante)
  and v.apellido is null
  and i.inversor_id is null;

alter table inversores enable row level security;

-- Se ve si se puede ver la obra, y lo toca el administrador: mismo criterio que
-- los ingresos que la agenda ordena.
create policy inversores_select on inversores for select to authenticated
  using (puede_ver_obra(obra_id));

create policy inversores_admin on inversores for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
