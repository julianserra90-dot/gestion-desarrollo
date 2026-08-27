-- ============================================================================
-- Tercer tipo de cotización: "Mano de obra y materiales".
--
-- Hasta ahora un rubro se cotizaba por separado para materiales y para mano de
-- obra, porque normalmente los cotiza gente distinta. Pero hay rubros —
-- herrería es el caso típico— donde un mismo contratista cotiza las dos cosas
-- juntas en un solo papel y un solo monto. Antes había que forzarlo como uno
-- de los dos tipos, y la comparación cotizado/gastado del rubro quedaba mal
-- armada.
--
-- Se comporta como los otros dos tipos: mismo circuito de cotizar, aprobar y
-- comparar contra lo gastado. Lo cotiza un Contratista, igual que la mano de
-- obra sola, y va como monto único, sin detalle de materiales línea por línea.
-- ============================================================================

-- Igual que usa_materiales/usa_mano_obra: cada obra marca si el rubro admite
-- este tipo de cotización combinada. Por defecto apagado: sólo aplica a
-- rubros puntuales, no a todos los que ya usan materiales y mano de obra por
-- separado.
alter table rubros
  add column usa_mano_obra_y_materiales boolean not null default false;

alter table presupuestos drop constraint presupuestos_tipo_check;
alter table presupuestos add constraint presupuestos_tipo_check
  check (tipo in ('Materiales', 'Mano de obra', 'Mano de obra y materiales'));

alter table gastos drop constraint gastos_tipo_gasto_check;
alter table gastos add constraint gastos_tipo_gasto_check
  check (tipo_gasto in (
    'Materiales', 'Mano de obra', 'Mano de obra y materiales',
    'Administrativo', 'Ajuste de saldo'
  ));

-- El combinado lo cotiza un contratista, igual que la mano de obra sola: es
-- el mismo gremio, sólo que ahora incluye el material en su precio.
create or replace function chequear_presupuesto_coherente()
returns trigger
language plpgsql
as $$
declare
  v_tipo_proveedor text;
begin
  if not exists (
    select 1 from rubros where id = new.rubro_id and obra_id = new.obra_id
  ) then
    raise exception 'El rubro no pertenece a esta obra.';
  end if;

  select tipo into v_tipo_proveedor from proveedores where id = new.proveedor_id;

  if new.tipo in ('Mano de obra', 'Mano de obra y materiales')
     and v_tipo_proveedor <> 'Contratista' then
    raise exception 'La mano de obra la cotiza un contratista, no un proveedor.';
  end if;

  if new.tipo = 'Materiales' and v_tipo_proveedor <> 'Proveedor' then
    raise exception 'Los materiales los cotiza un proveedor, no un contratista.';
  end if;

  return new;
end;
$$;

-- La columna nueva va al final, mismo motivo de siempre: `create or replace
-- view` sólo deja agregar columnas después de las que ya están.
create or replace view obra_presupuesto
with (security_invoker = on) as
select
  r.obra_id,
  r.id                                     as rubro_id,
  r.nombre                                 as rubro,
  r.orden,
  r.activo,
  t.tipo,
  p.id                                     as presupuesto_id,
  p.proveedor_id,
  coalesce(p.monto, 0)                     as cotizado,
  coalesce(g.gastado, 0)                   as gastado,
  coalesce(g.gastado, 0) - coalesce(p.monto, 0) as diferencia
from rubros r
cross join (
  values ('Materiales'), ('Mano de obra'), ('Mano de obra y materiales')
) as t(tipo)
left join lateral (
  select id, monto, proveedor_id
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
