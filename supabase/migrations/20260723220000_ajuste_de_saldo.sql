-- ============================================================================
-- Ajuste de saldo: una socia le transfiere plata a otra para nivelar.
--
-- OJO con la contabilidad: esto NO es un gasto de la obra. No se compró nada;
-- la plata pasó de una empresa a otra. Por eso:
--
--   * NO suma al total gastado de la obra (si sumara, inflaría el costo).
--   * SÍ mueve el saldo: cuenta como aporte de quien paga y se descuenta del
--     aporte de quien recibe.
--
-- Ejemplo: obra de $12.350.000, Estudio TAG debe $4.675.000. Le transfiere
-- $2.000.000 a Baffic. El total de obra sigue en $12.350.000 y la deuda baja
-- a $2.675.000.
-- ============================================================================

alter table gastos
  add column empresa_receptora_id uuid references empresas(id) on delete restrict;

create index on gastos (empresa_receptora_id);

alter table gastos drop constraint gastos_tipo_gasto_check;
alter table gastos add constraint gastos_tipo_gasto_check
  check (tipo_gasto in ('Materiales', 'Mano de obra', 'Ajuste de saldo'));

-- Un ajuste necesita a quién se le paga, y no puede ser a uno mismo ni tener
-- proveedor. Un gasto común no lleva empresa receptora.
alter table gastos add constraint gastos_ajuste_coherente check (
  (
    tipo_gasto = 'Ajuste de saldo'
    and empresa_receptora_id is not null
    and empresa_receptora_id <> empresa_pagadora_id
    and proveedor_id is null
  )
  or (tipo_gasto <> 'Ajuste de saldo' and empresa_receptora_id is null)
);

comment on column gastos.empresa_receptora_id is
  'Sólo en ajustes de saldo: la empresa que recibe la transferencia.';

-- La empresa que recibe también tiene que ser socia de la obra.
create or replace function chequear_empresa_socia()
returns trigger
language plpgsql
as $$
begin
  if not exists (
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

drop trigger if exists gastos_empresa_socia on gastos;
create trigger gastos_empresa_socia
  before insert or update of obra_id, empresa_pagadora_id, empresa_receptora_id on gastos
  for each row execute function chequear_empresa_socia();

-- ============================ Vistas =======================================
-- Los ajustes salen de los totales de obra y entran en el aporte de cada una.

create or replace view obra_balance
with (security_invoker = on) as
select
  s.obra_id,
  s.empresa_id,
  e.nombre                                                   as empresa,
  s.porcentaje,
  coalesce(t.total, 0)                                       as total_obra,
  round(coalesce(t.total, 0) * s.porcentaje / 100, 2)        as le_corresponde,
  coalesce(p.pagado, 0) + coalesce(aj.neto, 0)               as pagado,
  coalesce(p.pagado, 0) + coalesce(aj.neto, 0)
    - round(coalesce(t.total, 0) * s.porcentaje / 100, 2)    as saldo,
  coalesce(p.pagado_facturado, 0)                            as pagado_facturado,
  coalesce(p.pagado_efectivo, 0)                             as pagado_efectivo,
  coalesce(aj.neto, 0)                                       as ajustes
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
  select
    sum(monto)                                              as pagado,
    sum(monto) filter (where tipo_pago = 'Facturado')       as pagado_facturado,
    sum(monto) filter (where tipo_pago = 'Efectivo')        as pagado_efectivo
  from gastos g
  where g.obra_id = s.obra_id
    and g.empresa_pagadora_id = s.empresa_id
    and g.estado <> 'Anulado'
    and g.tipo_gasto <> 'Ajuste de saldo'
) p on true
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

create or replace view obra_resumen
with (security_invoker = on) as
select
  o.id                                as obra_id,
  o.slug,
  o.nombre,
  o.presupuesto,
  coalesce(g.total_gastado, 0)        as total_gastado,
  coalesce(a.avance_fisico, 0)        as avance_fisico,
  case when o.presupuesto > 0
       then round(coalesce(g.total_gastado, 0) * 100 / o.presupuesto)
       else 0 end                     as avance_financiero,
  coalesce(s.cant_socios, 0)          as cant_socios,
  coalesce(f.cant_fotos, 0)           as cant_fotos,
  coalesce(d.cant_documentos, 0)      as cant_documentos,
  coalesce(g.total_facturado, 0)      as total_facturado,
  coalesce(g.total_efectivo, 0)       as total_efectivo
from obras o
left join lateral (
  select
    sum(monto)                                        as total_gastado,
    sum(monto) filter (where tipo_pago = 'Facturado') as total_facturado,
    sum(monto) filter (where tipo_pago = 'Efectivo')  as total_efectivo
  from gastos
  where obra_id = o.id
    and estado <> 'Anulado'
    and tipo_gasto <> 'Ajuste de saldo'
) g on true
left join lateral (
  select round(avg(porcentaje)) as avance_fisico
  from avances where obra_id = o.id
) a on true
left join lateral (
  select count(*) as cant_socios from obra_socios where obra_id = o.id
) s on true
left join lateral (
  select count(*) as cant_fotos
  from fotos f join foto_registros r on r.id = f.registro_id
  where r.obra_id = o.id
) f on true
left join lateral (
  select count(*) as cant_documentos from documentos where obra_id = o.id
) d on true;
