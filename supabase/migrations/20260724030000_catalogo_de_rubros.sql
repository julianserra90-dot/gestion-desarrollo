-- ============================================================================
-- Catálogo de rubros y elección por obra.
--
-- Antes cada obra recibía una copia de los catorce rubros de la plantilla,
-- los usara o no, y la única forma de sacarse uno de encima era borrarlo —
-- imposible si ya tenía gastos cargados.
--
-- Ahora la obra tiene el catálogo entero disponible y marca cuáles usa. Los
-- desplegables de gastos, avances y fotos ofrecen sólo los marcados; los
-- demás quedan ahí, sin molestar, listos para cuando hagan falta.
--
-- Desmarcar no borra nada: un rubro con gastos cargados se puede desmarcar y
-- sus gastos siguen mostrando el rubro. Simplemente deja de ofrecerse para
-- cargar cosas nuevas.
-- ============================================================================

alter table rubros add column activo boolean not null default true;

comment on column rubros.activo is
  'Si la obra usa este rubro. Los desplegables ofrecen sólo los activos; los inactivos quedan disponibles para marcar más adelante.';

-- ============================== El catálogo =================================
-- Las filas con obra_id null son la plantilla que reciben las obras nuevas.
-- Se reemplaza entera por el listado acordado.

delete from rubros where obra_id is null;

insert into rubros (nombre, orden, obra_id, activo) values
  ('Tareas Preliminares',            1,  null, true),
  ('Demoliciones',                   2,  null, true),
  ('Excavaciones',                   3,  null, true),
  ('Fundaciones',                    4,  null, true),
  ('Estructura de Hormigón Armado',  5,  null, true),
  ('Albañilería',                    6,  null, true),
  ('Construcción en Seco',           7,  null, true),
  ('Yesería',                        8,  null, true),
  ('Cubiertas y Techos',             9,  null, true),
  ('Zinguería',                     10,  null, true),
  ('Impermeabilizaciones',          11,  null, true),
  ('Instalación Sanitaria',         12,  null, true),
  ('Instalación Eléctrica',         13,  null, true),
  ('Instalación de Gas',            14,  null, true),
  ('Instalación Contra Incendio',   15,  null, true),
  ('Climatización',                 16,  null, true),
  ('Carpinterías',                  17,  null, true),
  ('Aberturas Ventanas',            18,  null, true),
  ('Aberturas Puertas',             19,  null, true),
  ('Herrería',                      20,  null, true),
  ('Escaleras y Barandas',          21,  null, true),
  ('Vidrios y espejos',             22,  null, true),
  ('Cielorrasos',                   23,  null, true),
  ('Pisos',                         24,  null, true),
  ('Revestimientos',                25,  null, true),
  ('Zócalos',                       26,  null, true),
  ('Mesadas',                       27,  null, true),
  ('Pintura',                       28,  null, true),
  ('Artefactos y Griferías',        29,  null, true),
  ('Iluminación',                   30,  null, true),
  ('Artefactos de iluminación',     31,  null, true),
  ('Mobiliario',                    32,  null, true),
  ('Cerco y Cerramientos',          33,  null, true),
  ('Limpieza Final de obra',        34,  null, true);

-- ====================== Las obras que ya existían ===========================

-- 1. Los rubros viejos que nunca se usaron se van: no tienen historia que
--    cuidar y ensucian la lista. Los que sí tienen gastos, avances o fotos se
--    quedan, porque borrarlos dejaría esos registros sin rubro.
delete from rubros r
where r.obra_id is not null
  and not exists (select 1 from gastos         where rubro_id = r.id)
  and not exists (select 1 from avances        where rubro_id = r.id)
  and not exists (select 1 from foto_registros where rubro_id = r.id);

-- 2. Los que quedaron son los que la obra está usando de verdad: van marcados.
update rubros set activo = true where obra_id is not null;

-- 3. Cada obra recibe el catálogo. Se saltean los que ya tiene con ese nombre
--    —comparando sin distinguir mayúsculas, para no terminar con "Instalación
--    sanitaria" y "Instalación Sanitaria" al mismo tiempo— y entran sin marcar.
insert into rubros (nombre, orden, obra_id, activo)
select c.nombre, c.orden, o.id, false
from rubros c
cross join obras o
where c.obra_id is null
  and not exists (
    select 1 from rubros r
    where r.obra_id = o.id and lower(r.nombre) = lower(c.nombre)
  );

-- ========================== Las obras nuevas ================================
-- Arrancan con el catálogo cargado pero sin nada marcado: elegir los rubros es
-- el primer paso de configurar la obra.

create or replace function sembrar_rubros_de_obra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into rubros (nombre, orden, obra_id, activo)
  select nombre, orden, new.id, false
  from rubros
  where obra_id is null;

  return new;
end;
$$;

-- ============================ Avances ======================================
-- Los avances llevan una fila por rubro. Marcar un rubro tiene que hacerlo
-- aparecer en la solapa Avances sin que nadie lo cargue a mano; desmarcarlo lo
-- saca de la vista pero deja la fila, así el porcentaje sigue ahí si se vuelve
-- a marcar.

create or replace function crear_avance_de_rubro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.activo and new.obra_id is not null then
    insert into avances (obra_id, rubro_id)
    values (new.obra_id, new.id)
    on conflict (obra_id, rubro_id) do nothing;
  end if;

  return null;
end;
$$;

create trigger rubros_crear_avance
  after insert or update of activo on rubros
  for each row execute function crear_avance_de_rubro();

-- Los rubros que quedaron marcados en las obras que ya existían.
insert into avances (obra_id, rubro_id)
select obra_id, id from rubros where obra_id is not null and activo
on conflict (obra_id, rubro_id) do nothing;

-- El avance físico de la obra promedia sólo los rubros que se están usando:
-- uno desmarcado no debería arrastrar el promedio para abajo.
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
  -- avg() sobre cero filas devuelve null, no NaN: la obra sin avances da 0.
  select round(avg(av.porcentaje)) as avance_fisico
  from avances av
  join rubros r on r.id = av.rubro_id
  where av.obra_id = o.id and r.activo
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
