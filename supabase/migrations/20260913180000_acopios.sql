-- ===========================================================================
-- Acopios: se paga hoy, el material entra a la obra después
-- ===========================================================================
--
-- Un acopio es un gasto como cualquiera —se paga, se factura, cuenta en el
-- balance y en lo gastado del rubro— con una diferencia: al pagarlo no se sabe
-- (o no del todo) qué materiales van a ir a la obra ni cuándo. Por eso el
-- detalle del acopio no tiene que cerrar con la factura, y lo que de verdad
-- entró a la obra se registra aparte, **retiro por retiro, con fecha**.
--
-- `gastos.es_acopio` marca el gasto. Sus `gasto_materiales`, si se cargan, son
-- lo que se dejó acopiado (lo que se sabe que hay en el corralón); no cuentan
-- como consumo. Los `acopio_retiros` son lo que entró a la obra: cada uno con
-- su fecha y sus materiales, y son éstos los que suman en Materiales.

alter table gastos add column es_acopio boolean not null default false;

comment on column gastos.es_acopio is
  'El gasto es un acopio: se pagó, pero el material entra a la obra después, en retiros con fecha.';

create table acopio_retiros (
  id            uuid primary key default gen_random_uuid(),
  gasto_id      uuid not null references gastos(id) on delete cascade,
  fecha         date not null,
  observaciones text,
  creado_en     timestamptz not null default now()
);

create index on acopio_retiros (gasto_id, fecha);

create table acopio_retiro_items (
  id              uuid primary key default gen_random_uuid(),
  retiro_id       uuid not null references acopio_retiros(id) on delete cascade,
  material_id     uuid not null references materiales(id) on delete restrict,
  cantidad        numeric(14, 3) not null check (cantidad > 0),
  -- Opcional: si el acopio tiene ese material con precio, se toma de ahí.
  precio_unitario numeric(14, 2)
    check (precio_unitario is null or precio_unitario >= 0),
  orden           integer not null default 0
);

create index on acopio_retiro_items (retiro_id);
create index on acopio_retiro_items (material_id);

alter table acopio_retiros enable row level security;
alter table acopio_retiro_items enable row level security;

-- Se ve si se puede ver la obra del acopio; lo carga el administrador.
create policy acopio_retiros_select on acopio_retiros for select to authenticated
  using (exists (
    select 1 from gastos g
    where g.id = acopio_retiros.gasto_id and puede_ver_obra(g.obra_id)
  ));

create policy acopio_retiros_admin on acopio_retiros for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy acopio_retiro_items_select on acopio_retiro_items for select to authenticated
  using (exists (
    select 1 from acopio_retiros r
    join gastos g on g.id = r.gasto_id
    where r.id = acopio_retiro_items.retiro_id and puede_ver_obra(g.obra_id)
  ));

create policy acopio_retiro_items_admin on acopio_retiro_items for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
