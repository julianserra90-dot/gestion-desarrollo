-- ============================================================================
-- Varias cotizaciones aprobadas por rubro y tipo.
--
-- Hasta ahora sólo podía haber una aprobada por rubro y tipo: aprobar una
-- descartaba la que estuviera antes. Pero un mismo contratista a veces
-- cotiza el trabajo en dos papeles distintos —uno por cada parte del
-- alcance, ej. "todo menos barandas" y "sólo barandas"— y las dos deberían
-- poder quedar aprobadas a la vez, sumando entre sí lo cotizado del rubro.
-- ============================================================================

-- El índice que impedía que hubiera dos aprobadas al mismo tiempo.
drop index if exists presupuestos_una_aprobada;

-- La vista pasa de traer "la" cotización aprobada (una fila cualquiera) a
-- sumar todas las aprobadas del rubro y tipo. El proveedor sigue siendo una
-- sola columna: si todas las aprobadas son del mismo proveedor —el caso
-- típico, un contratista partiendo su propio presupuesto en dos papeles— se
-- muestra ese; si hay más de uno, queda en null antes que mostrar uno
-- cualquiera como si fuera el único. Eso sólo afecta el texto "Cotizó
-- Fulano" y el filtro por proveedor en la ficha de cuenta corriente: "lo
-- cotizado" del rubro sigue sumando bien en cualquier caso.
--
-- `presupuesto_id` sale del select: con varias aprobadas ya no hay un único
-- presupuesto que identifique la fila, y nada en la app lo usaba. Como esto
-- saca una columna, hace falta `drop` + `create` en vez de `create or
-- replace` (que sólo deja agregar columnas al final).
drop view obra_presupuesto;

create view obra_presupuesto
with (security_invoker = on) as
select
  r.obra_id,
  r.id                                     as rubro_id,
  r.nombre                                 as rubro,
  r.orden,
  r.activo,
  t.tipo,
  p.proveedor_id,
  coalesce(p.cotizado, 0)                  as cotizado,
  coalesce(g.gastado, 0)                   as gastado,
  coalesce(g.gastado, 0) - coalesce(p.cotizado, 0) as diferencia
from rubros r
cross join (
  values ('Materiales'), ('Mano de obra'), ('Mano de obra y materiales')
) as t(tipo)
left join lateral (
  select
    sum(monto) as cotizado,
    -- min() no existe para uuid; se pasa por texto y se vuelve a castear.
    case when count(distinct proveedor_id) = 1
      then min(proveedor_id::text)::uuid
    end as proveedor_id
  from presupuestos
  where obra_id = r.obra_id
    and rubro_id = r.id
    and tipo = t.tipo
    and estado = 'Aprobado'
) p on true
left join lateral (
  select sum(monto) as gastado
  from gastos
  where obra_id = r.obra_id
    and rubro_id = r.id
    and tipo_gasto = t.tipo
    and estado <> 'Anulado'
) g on true
where r.obra_id is not null;
