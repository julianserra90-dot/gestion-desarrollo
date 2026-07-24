-- ============================================================================
-- Ingreso de fondos y dinero en cuenta.
--
-- Hasta acá la app sólo miraba plata que sale (gastos). Falta la que entra:
--
--   * Empresa socia -> una socia pone plata para cubrir los gastos de un
--     tiempo. Ej: Estudio TAG mete USD 5.000.
--   * Inversor      -> plata de un tercero que financia la obra.
--   * Comprador     -> lo que paga quien compra una unidad del desarrollo.
--
-- Todo eso entra a una caja: el "dinero en cuenta" de la obra.
--
--     dinero en cuenta = ingresos - lo que se pagó con la caja
--
-- Reglas de contabilidad que salieron de la discusión con el desarrollador:
--
-- 1. El aporte de una SOCIA cuenta como aporte suyo en el balance, igual que
--    si hubiera pagado gastos por ese monto. Por eso los gastos que se pagan
--    con la caja NO se le atribuyen a ninguna socia: si contaran las dos
--    puntas, la plata se contaría dos veces.
--
-- 2. La plata de INVERSORES y COMPRADORES se descuenta del total a repartir:
--    las socias sólo se reparten el gasto que esos fondos no alcanzan a
--    cubrir.
--
-- 3. Un gasto puede pagarse en parte con la caja y en parte de bolsillo. Si al
--    cargarlo se marca "pagar con dinero en cuenta" y el saldo no alcanza, la
--    caja pone lo que tiene y una empresa cubre la diferencia. Eso es
--    `monto_caja` (lo que salió de la caja) contra `monto - monto_caja` (lo
--    que puso la empresa pagadora).
--
-- Invariante que reemplaza al viejo "la suma de saldos siempre da 0": ahora la
-- suma de los saldos es la plata de las socias que todavía está en la caja.
-- Cuando la caja queda vacía, vuelve a dar 0.
-- ============================================================================

create table ingresos (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references obras(id) on delete cascade,
  fecha      date not null,
  origen     text not null
             check (origen in ('Empresa socia', 'Inversor', 'Comprador')),
  -- Si el origen es una socia, se apunta a la empresa (tiene que ser socia de
  -- la obra). Un inversor o un comprador no están en el catálogo de empresas:
  -- de esos se guarda el nombre suelto.
  empresa_id uuid references empresas(id) on delete restrict,
  aportante  text,
  concepto   text not null,

  -- Mismo criterio que en gastos: el monto se guarda SIEMPRE en pesos, y
  -- aparte el equivalente en dólares al oficial de la fecha del ingreso.
  monto      numeric(14, 2) not null check (monto > 0),
  moneda     text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  monto_usd  numeric(14, 2),
  cotizacion numeric(14, 4) check (cotizacion is null or cotizacion > 0),

  comprobante_drive_id text,
  comprobante_nombre   text,
  comprobante_mime     text,
  comprobante_tamano   bigint,

  observaciones text,
  cargado_por   uuid references perfiles(id) on delete set null,
  creado_en     timestamptz not null default now(),

  constraint ingresos_origen_coherente check (
    (origen =  'Empresa socia' and empresa_id is not null and aportante is null)
    or
    (origen <> 'Empresa socia' and empresa_id is null and aportante is not null)
  )
);

create index on ingresos (obra_id, fecha desc);
create index on ingresos (empresa_id);

comment on column ingresos.monto is
  'Siempre en pesos, sin importar en qué moneda se cargó.';
comment on column ingresos.aportante is
  'Nombre del inversor o comprador. Null cuando el aporte es de una socia.';

-- La empresa que aporta tiene que ser socia de la obra.
create or replace function chequear_aportante_socia()
returns trigger
language plpgsql
as $$
begin
  if new.empresa_id is not null and not exists (
    select 1 from obra_socios
    where obra_id = new.obra_id and empresa_id = new.empresa_id
  ) then
    raise exception 'La empresa % no es socia de la obra %', new.empresa_id, new.obra_id;
  end if;

  return new;
end;
$$;

create trigger ingresos_empresa_socia
  before insert or update of obra_id, empresa_id on ingresos
  for each row execute function chequear_aportante_socia();

-- ====================== Gastos pagados con la caja ==========================

alter table gastos
  add column monto_caja numeric(14, 2) not null default 0;

comment on column gastos.monto_caja is
  'Cuánto de este gasto salió del dinero en cuenta. El resto (monto - monto_caja) lo puso la empresa pagadora.';

-- Si la caja cubre el gasto entero no hay empresa que lo haya pagado.
alter table gastos alter column empresa_pagadora_id drop not null;

alter table gastos add constraint gastos_caja_coherente check (
  monto_caja >= 0
  and monto_caja <= monto
  -- Un ajuste de saldo mueve plata entre socias, no compra nada: no sale de
  -- la caja y siempre tiene una empresa que transfiere.
  and (tipo_gasto <> 'Ajuste de saldo'
       or (monto_caja = 0 and empresa_pagadora_id is not null))
  -- O hay empresa pagadora, o la caja se hizo cargo de todo.
  and (empresa_pagadora_id is not null or monto_caja >= monto)
);

-- La versión anterior daba por sentado que siempre había empresa pagadora.
create or replace function chequear_empresa_socia()
returns trigger
language plpgsql
as $$
begin
  if new.empresa_pagadora_id is not null and not exists (
    select 1 from obra_socios
    where obra_id = new.obra_id and empresa_id = new.empresa_pagadora_id
  ) then
    raise exception 'La empresa % no es socia de la obra %', new.empresa_pagadora_id, new.obra_id;
  end if;

  if new.empresa_receptora_id is not null and not exists (
    select 1 from obra_socios
    where obra_id = new.obra_id and empresa_id = new.empresa_receptora_id
  ) then
    raise exception 'La empresa receptora % no es socia de la obra %', new.empresa_receptora_id, new.obra_id;
  end if;

  return new;
end;
$$;

-- La caja no puede quedar en rojo. La app ya limita cuánto se toma de ella al
-- cargar el gasto; esto es la red por si dos personas cargan a la vez o por si
-- alguien edita un ingreso que ya estaba gastado.
create or replace function chequear_caja_no_negativa()
returns trigger
language plpgsql
as $$
declare
  v_obra  uuid := coalesce(new.obra_id, old.obra_id);
  v_saldo numeric;
begin
  select
    coalesce((select sum(monto) from ingresos where obra_id = v_obra), 0)
    - coalesce((select sum(monto_caja) from gastos
                where obra_id = v_obra and estado <> 'Anulado'), 0)
  into v_saldo;

  -- Tolerancia de un centavo, igual que en la liquidación: los redondeos no
  -- tienen que hacer fallar una carga válida.
  if v_saldo < -0.01 then
    raise exception 'No hay tanto dinero en cuenta: el saldo de la obra quedaría en %.', v_saldo;
  end if;

  return null;
end;
$$;

create constraint trigger gastos_caja_no_negativa
  after insert or update of monto_caja, estado, obra_id on gastos
  deferrable initially deferred
  for each row execute function chequear_caja_no_negativa();

create constraint trigger ingresos_caja_no_negativa
  after update or delete on ingresos
  deferrable initially deferred
  for each row execute function chequear_caja_no_negativa();

-- ================================ Vistas ====================================

-- El estado de la caja de cada obra.
create view obra_caja
with (security_invoker = on) as
select
  o.id                                                as obra_id,
  coalesce(i.total, 0)                                as ingresos,
  coalesce(i.socias, 0)                               as ingresos_socias,
  coalesce(i.terceros, 0)                             as ingresos_terceros,
  coalesce(i.total_usd, 0)                            as ingresos_usd,
  coalesce(g.usado, 0)                                as usado,
  coalesce(g.usado_usd, 0)                            as usado_usd,
  coalesce(i.total, 0)     - coalesce(g.usado, 0)     as saldo,
  coalesce(i.total_usd, 0) - coalesce(g.usado_usd, 0) as saldo_usd
from obras o
left join lateral (
  select
    sum(monto)                                          as total,
    sum(monto) filter (where origen =  'Empresa socia') as socias,
    sum(monto) filter (where origen <> 'Empresa socia') as terceros,
    sum(monto_usd)                                      as total_usd
  from ingresos where obra_id = o.id
) i on true
left join lateral (
  select
    sum(monto_caja) as usado,
    -- La parte en dólares del gasto, proporcional a lo que salió de la caja.
    sum(round(coalesce(monto_usd, 0) * monto_caja / nullif(monto, 0), 2)) as usado_usd
  from gastos
  where obra_id = o.id and estado <> 'Anulado' and monto_caja > 0
) g on true;

-- Se recrean en vez de reemplazarse porque cambian columnas del medio.
drop view obra_balance;

create view obra_balance
with (security_invoker = on) as
select
  s.obra_id,
  s.empresa_id,
  e.nombre                                                    as empresa,
  s.porcentaje,
  coalesce(t.total, 0)                                        as total_obra,
  -- Lo que pusieron inversores y compradores no lo reparten las socias.
  coalesce(f.terceros, 0)                                     as fondos_terceros,
  greatest(coalesce(t.total, 0) - coalesce(f.terceros, 0), 0) as total_a_repartir,
  round(greatest(coalesce(t.total, 0) - coalesce(f.terceros, 0), 0)
        * s.porcentaje / 100, 2)                              as le_corresponde,
  coalesce(p.pagado, 0) + coalesce(ap.aportes, 0) + coalesce(aj.neto, 0) as pagado,
  coalesce(p.pagado, 0) + coalesce(ap.aportes, 0) + coalesce(aj.neto, 0)
    - round(greatest(coalesce(t.total, 0) - coalesce(f.terceros, 0), 0)
            * s.porcentaje / 100, 2)                          as saldo,
  coalesce(p.pagado_facturado, 0)                             as pagado_facturado,
  coalesce(p.pagado_efectivo, 0)                              as pagado_efectivo,
  coalesce(aj.neto, 0)                                        as ajustes,
  coalesce(ap.aportes, 0)                                     as aportes
from obra_socios s
join empresas e on e.id = s.empresa_id
left join lateral (
  select sum(monto) as total
  from gastos g
  where g.obra_id = s.obra_id
    and g.estado <> 'Anulado'
    and g.tipo_gasto <> 'Ajuste de saldo'
) t on true
left join lateral (
  -- Lo que puso de su bolsillo: el gasto menos la parte que salió de la caja.
  select
    sum(monto - monto_caja)                                        as pagado,
    sum(monto - monto_caja) filter (where tipo_pago = 'Facturado')  as pagado_facturado,
    sum(monto - monto_caja) filter (where tipo_pago = 'Efectivo')   as pagado_efectivo
  from gastos g
  where g.obra_id = s.obra_id
    and g.empresa_pagadora_id = s.empresa_id
    and g.estado <> 'Anulado'
    and g.tipo_gasto <> 'Ajuste de saldo'
) p on true
left join lateral (
  -- Lo que metió en la caja cuenta como aporte suyo.
  select sum(monto) as aportes
  from ingresos i
  where i.obra_id = s.obra_id
    and i.origen = 'Empresa socia'
    and i.empresa_id = s.empresa_id
) ap on true
left join lateral (
  select sum(monto) as terceros
  from ingresos i
  where i.obra_id = s.obra_id
    and i.origen <> 'Empresa socia'
) f on true
left join lateral (
  -- Lo que transfirió menos lo que recibió.
  select
    coalesce(sum(monto) filter (where empresa_pagadora_id = s.empresa_id), 0)
    - coalesce(sum(monto) filter (where empresa_receptora_id = s.empresa_id), 0) as neto
  from gastos g
  where g.obra_id = s.obra_id
    and g.estado <> 'Anulado'
    and g.tipo_gasto = 'Ajuste de saldo'
) aj on true;

-- ================================= RLS ======================================
-- Mismo criterio que el resto: la socia lee lo de sus obras, el admin escribe.

alter table ingresos enable row level security;

create policy ingresos_select on ingresos for select to authenticated
  using (puede_ver_obra(obra_id));

create policy ingresos_admin on ingresos for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
