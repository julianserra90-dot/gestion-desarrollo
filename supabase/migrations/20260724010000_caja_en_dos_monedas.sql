-- ============================================================================
-- La cuenta de la obra tiene dos lados: pesos y dólares.
--
-- Antes todo se guardaba en pesos: un aporte en dólares se convertía al oficial
-- del día y entraba a la caja como pesos. Eso pierde información y plata. Si
-- una socia pone USD 5.000, esos dólares siguen siendo dólares hasta que se
-- vendan, y se venden al cambio que se consiga ese día, que rara vez es el
-- oficial de Ámbito.
--
-- Ahora:
--
--   * Un ingreso en ARS suma al lado en pesos; uno en USD, al lado en dólares.
--   * Al pagar un gasto se elige cuántos pesos y cuántos dólares se sacan de la
--     cuenta (`caja_ars` y `caja_usd`). Lo que falte lo pone una empresa.
--   * Los dólares que salen se valúan a `cotizacion`, que puede ser la oficial
--     del día o una cargada a mano (`cotizacion_manual`). Esa cotización manda
--     sobre todo el gasto: también define su equivalente en dólares.
--
-- Qué NO cambia: el balance entre socias. El aporte de una socia sigue contando
-- por el valor en pesos que tenía el día que entró. Si después esos dólares se
-- venden mejor, la diferencia le rinde a la obra —alcanza para más gasto— y eso
-- beneficia a todas según su porcentaje, no a la que los puso.
--
-- Por eso `monto_caja` sobrevive como columna calculada: sigue siendo "cuántos
-- pesos de este gasto salieron de la cuenta", que es lo único que el balance
-- necesita saber.
-- ============================================================================

-- Un aporte en dólares sin el monto en dólares dejaría la caja sin saber cuánto
-- entró de verdad.
alter table ingresos add constraint ingresos_usd_coherente check (
  moneda <> 'USD' or (monto_usd is not null and monto_usd > 0)
);

-- ========================== Los dos lados del gasto =========================

-- Todo lo que depende de monto_caja tiene que irse antes de tocar la columna:
-- Postgres no la deja borrar mientras algo la referencie. Se recrea todo más
-- abajo, ya con el modelo nuevo.
--
-- El trigger cuenta aunque parezca que no: al declararlo con `update of
-- monto_caja` queda atado a esa columna.
drop trigger if exists gastos_caja_no_negativa on gastos;
drop view if exists obra_caja;
drop view if exists obra_balance;

alter table gastos
  add column caja_ars numeric(14, 2) not null default 0,
  add column caja_usd numeric(14, 2) not null default 0,
  add column cotizacion_manual boolean not null default false;

comment on column gastos.caja_ars is
  'Pesos que salieron de la cuenta de la obra para pagar este gasto.';
comment on column gastos.caja_usd is
  'Dólares que salieron de la cuenta. Se valúan a `cotizacion`.';
comment on column gastos.cotizacion_manual is
  'true si la cotización la cargó una persona en vez de tomarse del oficial.';

-- Lo que ya estaba pagado con la caja era todo en pesos.
update gastos set caja_ars = monto_caja where monto_caja > 0;

alter table gastos drop constraint gastos_caja_coherente;
alter table gastos drop column monto_caja;

-- Se recrea calculada: cuántos pesos de este gasto salieron de la cuenta.
alter table gastos
  add column monto_caja numeric(14, 2)
  generated always as (caja_ars + caja_usd * coalesce(cotizacion, 0)) stored;

comment on column gastos.monto_caja is
  'Calculada: los pesos de la cuenta más los dólares de la cuenta valuados a la cotización del gasto.';

-- El constraint se escribe sobre las columnas base, no sobre la calculada.
-- La tolerancia de un centavo es por el redondeo de caja_usd * cotizacion.
alter table gastos add constraint gastos_caja_coherente check (
  caja_ars >= 0
  and caja_usd >= 0
  -- Sacar dólares sin saber a cuánto se vendieron no se puede valuar.
  and (caja_usd = 0 or cotizacion is not null)
  -- Un ajuste de saldo mueve plata entre socias, no compra nada: no toca la
  -- cuenta y siempre tiene una empresa que transfiere.
  and (tipo_gasto <> 'Ajuste de saldo'
       or (caja_ars = 0 and caja_usd = 0 and empresa_pagadora_id is not null))
  -- No se puede sacar de la cuenta más de lo que cuesta el gasto.
  and caja_ars + caja_usd * coalesce(cotizacion, 0) <= monto + 0.01
  -- O hay empresa pagadora, o la cuenta se hizo cargo de todo.
  and (empresa_pagadora_id is not null
       or caja_ars + caja_usd * coalesce(cotizacion, 0) >= monto - 0.01)
);

-- ======================= La cuenta no puede quedar en rojo ==================
-- Ahora se controla cada lado por separado: podés tener pesos de sobra y
-- estar sacando dólares que no hay.

create or replace function chequear_caja_no_negativa()
returns trigger
language plpgsql
as $$
declare
  v_obra uuid := coalesce(new.obra_id, old.obra_id);
  v_ars  numeric;
  v_usd  numeric;
begin
  select
    coalesce((select sum(monto) from ingresos
              where obra_id = v_obra and moneda <> 'USD'), 0)
    - coalesce((select sum(caja_ars) from gastos
                where obra_id = v_obra and estado <> 'Anulado'), 0),
    coalesce((select sum(monto_usd) from ingresos
              where obra_id = v_obra and moneda = 'USD'), 0)
    - coalesce((select sum(caja_usd) from gastos
                where obra_id = v_obra and estado <> 'Anulado'), 0)
  into v_ars, v_usd;

  -- Tolerancia de un centavo, para que los redondeos no frenen una carga
  -- válida.
  if v_ars < -0.01 then
    raise exception 'No hay tantos pesos en la cuenta de la obra: el saldo quedaría en $ %.',
      trim(to_char(v_ars, 'FM999G999G999G990D00'));
  end if;

  if v_usd < -0.01 then
    raise exception 'No hay tantos dólares en la cuenta de la obra: el saldo quedaría en US$ %.',
      trim(to_char(v_usd, 'FM999G999G999G990D00'));
  end if;

  return null;
end;
$$;

create constraint trigger gastos_caja_no_negativa
  after insert or update of caja_ars, caja_usd, cotizacion, estado, obra_id on gastos
  deferrable initially deferred
  for each row execute function chequear_caja_no_negativa();

-- ================================ Vistas ====================================

create view obra_caja
with (security_invoker = on) as
select
  o.id                                      as obra_id,

  -- Lado en pesos.
  coalesce(i.ars, 0)                        as ars_ingresado,
  coalesce(g.ars, 0)                        as ars_usado,
  coalesce(i.ars, 0) - coalesce(g.ars, 0)   as ars_saldo,

  -- Lado en dólares. Son dólares de verdad, no una valuación.
  coalesce(i.usd, 0)                        as usd_ingresado,
  coalesce(g.usd, 0)                        as usd_usado,
  coalesce(i.usd, 0) - coalesce(g.usd, 0)   as usd_saldo,

  -- Todo valuado en pesos al día de cada movimiento. Es lo que mira el balance
  -- entre socias, que se lleva en pesos.
  coalesce(i.pesos, 0)                      as ingresos,
  coalesce(i.socias, 0)                     as ingresos_socias,
  coalesce(i.terceros, 0)                   as ingresos_terceros,
  coalesce(g.pesos, 0)                      as usado
from obras o
left join lateral (
  select
    sum(monto)     filter (where moneda <> 'USD')       as ars,
    sum(monto_usd) filter (where moneda =  'USD')       as usd,
    sum(monto)                                          as pesos,
    sum(monto) filter (where origen =  'Empresa socia') as socias,
    sum(monto) filter (where origen <> 'Empresa socia') as terceros
  from ingresos where obra_id = o.id
) i on true
left join lateral (
  select
    sum(caja_ars)   as ars,
    sum(caja_usd)   as usd,
    sum(monto_caja) as pesos
  from gastos
  where obra_id = o.id and estado <> 'Anulado'
) g on true;

-- El balance entre socias no cambia: sigue mirando cuántos pesos de cada gasto
-- salieron de la cuenta (monto_caja) y cuántos puso de su bolsillo la pagadora.
-- Se recrea igual que estaba, sólo porque hubo que borrarla para tocar la
-- columna.
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
  -- Lo que puso de su bolsillo: el gasto menos la parte que salió de la cuenta.
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
  -- Lo que metió en la cuenta cuenta como aporte suyo, por el valor en pesos
  -- que tenía el día que entró.
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
