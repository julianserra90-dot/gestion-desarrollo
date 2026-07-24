-- ===========================================================================
-- Avances: historial por período en vez de un número que se pisa
-- ===========================================================================
--
-- Hasta acá `avances` tenía una fila por rubro —unique (obra_id, rubro_id)— que
-- se sobrescribía en cada edición. Poner Demolición en 35% borraba el 20% de la
-- semana anterior: no quedaba registro de cuándo se hizo qué, que es
-- justamente lo que sirve para seguir una obra.
--
-- Ahora cada fila es una carga con su rango de días y su detalle, y el avance
-- del rubro es la suma de sus cargas:
--
--   Demolición  22/07 - 24/07  +20%   acumulado 20%   "paredes de planta alta"
--               29/07 - 31/07  +15%   acumulado 35%   "contrapisos"
--
-- El porcentaje de cada carga es lo que avanzó EN ESOS DÍAS, no el total a esa
-- fecha. El acumulado lo arma la suma.

-- -------- 1. El rubro ya no necesita una fila reservada ---------------------
--
-- El trigger creaba una fila en 0% al marcar un rubro, para que apareciera en
-- la solapa. Con historial eso sobra: un rubro se muestra por estar marcado, y
-- una fila vacía sería una carga que nadie hizo. Además su `on conflict`
-- depende del unique que este mismo archivo borra más abajo.

drop trigger if exists rubros_crear_avance on rubros;
drop function if exists crear_avance_de_rubro();

-- Las filas que dejó el trigger y nadie tocó: 0%, sin iniciar y sin comentario.
-- No dicen nada que el rubro no diga ya, y en un historial son ruido.
delete from avances
 where porcentaje = 0
   and estado = 'Sin iniciar'
   and comentario is null;

alter table avances drop constraint if exists avances_obra_id_rubro_id_key;

-- -------- 2. Cada carga cubre un rango de días ------------------------------

alter table avances rename column fecha to fecha_desde;

alter table avances add column fecha_hasta date;

-- Lo ya cargado no tenía rango: se lo toma como un día suelto.
update avances set fecha_hasta = fecha_desde where fecha_hasta is null;

alter table avances
  alter column fecha_hasta set not null,
  alter column fecha_hasta set default current_date,
  add constraint avances_rango_check check (fecha_hasta >= fecha_desde);

create index on avances (obra_id, rubro_id, fecha_desde desc);

-- -------- 3. El estado se deduce del avance ---------------------------------
--
-- "Si ya tiene avance, está en ejecución": el estado no es un dato aparte que
-- alguien tenga que mantener al día, es una lectura del porcentaje acumulado.
-- Guardarlo permitía que dijera "Sin iniciar" con 40% cargado. Se calcula en la
-- app —0% sin iniciar, 100% finalizado, en el medio en ejecución— y deja de
-- ocupar una columna que puede contradecir al número.
--
-- Se cae con él la distinción entre Replanteo e Inicial, que el porcentaje ya
-- cuenta mejor.

alter table avances drop column estado;

-- -------- 4. El avance general pesa cada rubro por lo que cuesta ------------
--
-- El promedio simple trataba igual a Demolición y a Albañilería, así que
-- terminar un rubro chico movía la aguja lo mismo que avanzar en uno grande.
-- Ahora cada rubro pesa su cotización aprobada.
--
-- Sin presupuestos aprobados no hay con qué ponderar, y ahí cae al promedio
-- simple: una obra recién arrancada tiene que mostrar algo igual.
--
-- La columna sigue en el mismo lugar y con el mismo nombre; sólo cambia cómo se
-- calcula. `create or replace view` lo acepta porque la lista de columnas no se
-- toca.

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
           coalesce(cot.aprobado, 0)                   as peso
    from rubros r
    left join avances av
      on av.rubro_id = r.id and av.obra_id = o.id
    left join lateral (
      select sum(p.monto) as aprobado
      from presupuestos p
      where p.rubro_id = r.id and p.obra_id = o.id and p.estado = 'Aprobado'
    ) cot on true
    where r.obra_id = o.id and r.activo
    group by r.id, cot.aprobado
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
