-- ===========================================================================
-- Agenda de ingresos: las cuotas que las socias van a poner, con fecha
-- ===========================================================================
--
-- Los aportes de las socias no siempre son plata que se decide poner un día:
-- a veces vienen de afuera en cuotas —otro emprendimiento que se está
-- cobrando y cuyas cuotas entran acá como aporte de las empresas—. Con sólo
-- los ingresos reales no hay forma de saber cuánto falta por entrar ni cuándo.
--
-- La agenda es una capa de planificación encima de los ingresos: cada fila es
-- una cuota prevista (quién la pone, cuándo, cuánto) y el ingreso real que la
-- cumple queda enganchado a ella. Nada de esto toca el balance ni la caja: la
-- plata cuenta recién cuando entra, como siempre.
--
-- Sólo socias, por ahora: los inversores y compradores tienen su compromiso
-- total en la agenda de inversores y no hacía falta más.

create table ingresos_previstos (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references obras(id) on delete cascade,
  empresa_id     uuid not null references empresas(id),
  -- Las cuotas se cargan en serie ("11 de 4.000 y una de 6.000"); la serie
  -- es lo que le da sentido al número de cuota.
  serie_id       uuid not null default gen_random_uuid(),
  numero_cuota   integer not null check (numero_cuota > 0),
  fecha_prevista date not null,
  monto          numeric(14, 2) not null check (monto > 0),
  moneda         text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  detalle        text not null,
  observaciones  text,
  creado_en      timestamptz not null default now()
);

create index on ingresos_previstos (obra_id, fecha_prevista);
create index on ingresos_previstos (empresa_id);

comment on column ingresos_previstos.monto is
  'En la moneda de la cuota, sin convertir: es lo que se espera que entre.';

-- El ingreso real que cumple la cuota. `set null` y no `restrict`: borrar una
-- cuota prevista no puede borrar plata que entró de verdad, y borrar el
-- ingreso real deja la cuota otra vez pendiente, que es lo que corresponde.
alter table ingresos
  add column previsto_id uuid references ingresos_previstos(id) on delete set null;

-- Una cuota se cumple con un solo ingreso: dos ingresos apuntando a la misma
-- cuota la contarían dos veces como ingresada.
create unique index ingresos_un_ingreso_por_previsto
  on ingresos (previsto_id) where previsto_id is not null;

alter table ingresos_previstos enable row level security;

-- Se ve si se puede ver la obra, y lo toca el administrador: mismo criterio que
-- los ingresos que planifica.
create policy ingresos_previstos_select on ingresos_previstos for select to authenticated
  using (puede_ver_obra(obra_id));

create policy ingresos_previstos_admin on ingresos_previstos for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
