-- ============================================================================
-- Lo administrativo también se cotiza.
--
-- "Administrativo" es el tipo de gasto de lo que la obra paga pero no compra
-- ni contrata: ABL, tasas municipales, honorarios. Se definió como **no
-- cotizable** —"un impuesto se paga, no se contrata ni se presupuesta"—, y
-- para un impuesto es cierto. Para un honorario profesional no: una gestoría
-- municipal pasa su presupuesto antes de empezar, igual que un contratista.
-- Hasta ahora esa cotización había que forzarla como "Mano de obra y
-- materiales", que es lo que estaba cargado en Gastos Administrativos.
--
-- Pasa a comportarse como los otros tres tipos: se cotiza, se aprueba y se
-- compara contra lo gastado del mismo rubro y del mismo tipo.
--
-- Lo que **no** cambia: `gastos.tipo_gasto` ya aceptaba 'Administrativo' desde
-- `20260724130000_gastos_administrativos`, y un gasto administrativo se sigue
-- pudiendo cargar en cualquier rubro sin mirar las casillas. La casilla nueva
-- es sólo para que aparezca el bloque de cotización.
-- ============================================================================

-- Apagada por defecto, igual que `usa_mano_obra_y_materiales` cuando se
-- agregó: hasta que alguien la prenda en un rubro, no se mueve un número de
-- lugar. Lo que ya está cargado no entra en ninguna cuenta nueva, porque
-- "resta pagar" y "sin cotizar" miran estas casillas y las cotizaciones
-- aprobadas, y acá todavía no hay ninguna.
alter table rubros
  add column usa_administrativo boolean not null default false;

comment on column rubros.usa_administrativo is
  'Si en este rubro se cotizan honorarios o trámites: lo que se paga sin comprar ni contratar.';

alter table rubros drop constraint rubros_algun_tipo;
alter table rubros add constraint rubros_algun_tipo check (
  usa_materiales or usa_mano_obra or usa_mano_obra_y_materiales
  or usa_administrativo
);

alter table presupuestos drop constraint presupuestos_tipo_check;
alter table presupuestos add constraint presupuestos_tipo_check check (
  tipo in (
    'Materiales', 'Mano de obra', 'Mano de obra y materiales', 'Administrativo'
  )
);

-- `chequear_presupuesto_coherente` no se toca a propósito. Sólo exige
-- contratista para la mano de obra y proveedor para los materiales; un tipo
-- que no nombra pasa derecho, que es lo que corresponde acá: un honorario lo
-- puede facturar una gestoría cargada como contratista, un agrimensor cargado
-- como "Varios" o un estudio cargado como proveedor. La cotización que motivó
-- todo esto está a nombre de un contratista.

-- La vista suma un tipo más. Las columnas quedan iguales —sólo cambia el
-- `values` de adentro—, así que `create or replace` alcanza.
create or replace view obra_presupuesto
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
  values ('Materiales'), ('Mano de obra'), ('Mano de obra y materiales'),
         ('Administrativo')
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
