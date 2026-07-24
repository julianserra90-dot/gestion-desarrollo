-- ============================================================================
-- Qué se cotiza en cada rubro.
--
-- Hasta ahora todo rubro se cotizaba de las dos formas, y eso no es cierto:
--
--   * El terreno se compra y listo. No hay mano de obra.
--   * Los artefactos y griferías se compran. La instalación es otro rubro.
--   * Los revestimientos se compran; la mano de obra es "colocación de
--     revestimientos", que a su vez sí puede tener material (el pegamento).
--   * Una demolición o una excavación son mano de obra, no se compra nada.
--
-- Suponer las dos siempre llenaba la solapa de bloques vacíos e invitaba a
-- cargar cotizaciones donde no corresponde. Ahora cada rubro dice qué admite,
-- y se marca desde la misma solapa Presupuestos, al lado del rubro: es ahí,
-- mirando las cotizaciones, donde uno se da cuenta de que un rubro no lleva
-- mano de obra.
--
-- Se guarda por obra y no en el catálogo porque no siempre es igual: en una
-- obra el pintor pone el material y en otra lo pone la obra.
-- ============================================================================

alter table rubros
  add column usa_materiales boolean not null default true,
  add column usa_mano_obra  boolean not null default true;

-- Un rubro que no admite ninguna de las dos cosas no sirve para nada.
alter table rubros add constraint rubros_algun_tipo
  check (usa_materiales or usa_mano_obra);

comment on column rubros.usa_materiales is
  'Si en este rubro se compran materiales. Falso en los que son puro trabajo, como una demolición.';
comment on column rubros.usa_mano_obra is
  'Si en este rubro se contrata mano de obra. Falso en los que son pura compra, como el terreno.';

-- ======================= Los que son pura compra ============================
-- Se cotiza qué se compra; quien lo instala es otro rubro.

update rubros set usa_mano_obra = false
where lower(nombre) in (
  'revestimientos',
  'artefactos y griferías',
  'artefactos de iluminación',
  'mobiliario',
  'terreno'
);

-- ====================== Los que son puro trabajo ============================

update rubros set usa_materiales = false
where lower(nombre) in (
  'demoliciones',
  'demolición',
  'excavaciones',
  'limpieza final de obra'
);

-- ====================== Coherencia de las cotizaciones ======================
-- No se puede cotizar mano de obra de un rubro que sólo se compra.
--
-- Los gastos NO se controlan a propósito. Siempre puede aparecer una compra de
-- urgencia que rompa la clasificación prolija, y frenarla sería peor que
-- tenerla mal clasificada: el formulario ofrece lo que corresponde, pero la
-- base no se pone en el medio.

create or replace function chequear_presupuesto_coherente()
returns trigger
language plpgsql
as $$
declare
  v_tipo_proveedor text;
  v_rubro          record;
begin
  select nombre, usa_materiales, usa_mano_obra into v_rubro
  from rubros
  where id = new.rubro_id and obra_id = new.obra_id;

  if not found then
    raise exception 'El rubro no pertenece a esta obra.';
  end if;

  if new.tipo = 'Materiales' and not v_rubro.usa_materiales then
    raise exception 'En "%" no se cotizan materiales. Marcalo al lado del rubro si hace falta.',
      v_rubro.nombre;
  end if;

  if new.tipo = 'Mano de obra' and not v_rubro.usa_mano_obra then
    raise exception 'En "%" no se cotiza mano de obra. Marcalo al lado del rubro si hace falta.',
      v_rubro.nombre;
  end if;

  select tipo into v_tipo_proveedor from proveedores where id = new.proveedor_id;

  if new.tipo = 'Mano de obra' and v_tipo_proveedor <> 'Contratista' then
    raise exception 'La mano de obra la cotiza un contratista, no un proveedor.';
  end if;

  if new.tipo = 'Materiales' and v_tipo_proveedor <> 'Proveedor' then
    raise exception 'Los materiales los cotiza un proveedor, no un contratista.';
  end if;

  return new;
end;
$$;
