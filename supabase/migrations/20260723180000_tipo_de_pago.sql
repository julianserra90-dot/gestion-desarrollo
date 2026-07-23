-- ============================================================================
-- Un gasto tiene UN tipo de pago: facturado o efectivo.
--
-- La versión anterior partía el monto en dos dentro del mismo gasto. Es más
-- claro que cada gasto sea de un tipo: si una compra se cubre parte con factura
-- y parte en efectivo, se cargan dos gastos, y cada uno lleva su propio
-- comprobante y su propio estado de pago.
--
-- El desglose facturado/efectivo se calcula sumando por tipo, tanto para la
-- obra como para cada empresa.
-- ============================================================================

alter table gastos
  add column tipo_pago text not null default 'Facturado'
  check (tipo_pago in ('Facturado', 'Efectivo'));

-- Los que se habían cargado como efectivo puro conservan ese tipo.
update gastos
set tipo_pago = 'Efectivo'
where monto_efectivo > 0 and monto_facturado = 0;

alter table gastos drop constraint gastos_montos_cierran;
alter table gastos drop constraint gastos_montos_no_negativos;
alter table gastos drop column monto_facturado;
alter table gastos drop column monto_efectivo;

comment on column gastos.tipo_pago is
  'Facturado (con factura) o Efectivo (sin factura).';

-- ============================ Vistas =======================================
-- Se agregan columnas al final para poder usar CREATE OR REPLACE.

create or replace view obra_balance
with (security_invoker = on) as
select
  s.obra_id,
  s.empresa_id,
  e.nombre                                                   as empresa,
  s.porcentaje,
  coalesce(t.total, 0)                                       as total_obra,
  round(coalesce(t.total, 0) * s.porcentaje / 100, 2)        as le_corresponde,
  coalesce(p.pagado, 0)                                      as pagado,
  coalesce(p.pagado, 0)
    - round(coalesce(t.total, 0) * s.porcentaje / 100, 2)    as saldo,
  coalesce(p.pagado_facturado, 0)                            as pagado_facturado,
  coalesce(p.pagado_efectivo, 0)                             as pagado_efectivo
from obra_socios s
join empresas e on e.id = s.empresa_id
left join lateral (
  select sum(monto) as total
  from gastos g
  where g.obra_id = s.obra_id and g.estado <> 'Anulado'
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
) p on true;

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
  from gastos where obra_id = o.id and estado <> 'Anulado'
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
