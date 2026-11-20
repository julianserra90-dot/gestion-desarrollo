-- El avance físico pesa el cómputo donde todavía no hay cotización
--
-- El peso de un rubro en el avance general era **sólo** su cotización
-- aprobada, y sin ninguna cotización el cálculo caía al promedio simple de
-- los rubros activos. Esas dos reglas juntas tenían un efecto que nadie pidió:
-- armar el cómputo marca como activos todos los rubros de las tareas que se
-- tildan (a propósito: lo que se computa se va a cotizar y a gastar, y el
-- rubro tiene que aparecer en los desplegables), así que una obra con dos
-- rubros, uno terminado, pasaba de 50% a 3% por tildar treinta tareas, sin
-- que se construyera nada.
--
-- El arreglo no toca qué rubros entran, sino con qué se los pesa: el peso de
-- un rubro pasa a ser **su mejor costo conocido** —la cotización aprobada si
-- ya la hay, y si no el estimado del cómputo—, rubro por rubro. Un rubro
-- tildado sin cantidades pesa cero y no mueve el promedio ponderado; en
-- cuanto se le cargan las cantidades, pesa lo que cuesta. El promedio simple
-- queda sólo para la obra que no tiene ni cotizaciones ni cómputo, que es el
-- caso para el que se había elegido.
--
-- El estimado se suma como en la pantalla de incidencia: cantidad × precio,
-- los tres tipos juntos (materiales, mano de obra e integrado), que es lo que
-- está en cero cuando la tarea no lleva ese tipo. Sin ajuste por CAC a
-- propósito: el cómputo entero está en los precios de un mes, así que el
-- factor sería el mismo para todos los rubros y no cambia cuánto pesa cada
-- uno.
--
-- La misma fórmula vive en `lib/avances.ts` (`getAvancePorRubro` y
-- `avanceGeneral`), que es la que alimenta las pantallas de Avances y Estado;
-- esta vista alimenta el listado de obras. Las dos tienen que decir lo mismo.
--
-- La lista de columnas no se toca, así que `create or replace view` lo acepta.

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
  coalesce(g.total_efectivo, 0)       as total_efectivo,
  coalesce(pr.aprobado, 0)            as presupuesto_aprobado
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
  select sum(monto) as aprobado
  from presupuestos
  where obra_id = o.id and estado = 'Aprobado'
) pr on true
left join lateral (
  select round(
           case when sum(x.peso) > 0
                then sum(x.acumulado * x.peso) / sum(x.peso)
                else avg(x.acumulado) end
         ) as avance_fisico
  from (
    select r.id,
           -- Un rubro pasado de 100 no infla el general: se corta ahí.
           least(coalesce(sum(av.porcentaje), 0), 100) as acumulado,
           -- La cotización aprobada si hay; si no, el cómputo estimado.
           case when coalesce(cot.aprobado, 0) > 0
                then cot.aprobado
                else coalesce(est.estimado, 0) end     as peso
    from rubros r
    left join avances av
      on av.rubro_id = r.id and av.obra_id = o.id
    left join lateral (
      select sum(p.monto) as aprobado
      from presupuestos p
      where p.rubro_id = r.id and p.obra_id = o.id and p.estado = 'Aprobado'
    ) cot on true
    left join lateral (
      select sum(
               ci.cantidad * (
                 ci.precio_materiales + ci.precio_mano_obra + ci.precio_integrado
               )
             ) as estimado
      from computo_items ci
      where ci.rubro_id = r.id and ci.obra_id = o.id
    ) est on true
    where r.obra_id = o.id and r.activo
    group by r.id, cot.aprobado, est.estimado
  ) x
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
