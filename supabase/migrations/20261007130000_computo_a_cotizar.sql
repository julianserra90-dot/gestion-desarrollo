-- ============================================================================
-- Pedir cotización desde el desglose del cómputo.
--
-- Cada subtarea del desglose (el alquiler del volquete, la carga) se puede
-- tildar para cotizar. Eso deja en Cotizaciones un pedido "A cotizar": todavía
-- sin proveedor, con el monto del cómputo como referencia. Cuando llega el
-- presupuesto se le carga el proveedor y su precio, y pasa a Pendiente como
-- cualquier otra cotización.
--
-- La subtarea queda enlazada a ese pedido y, una vez que tiene precio real,
-- se elige renglón por renglón si el cómputo usa lo computado o lo cotizado.
-- ============================================================================

-- ======================= Cotizaciones sin proveedor =========================

alter table presupuestos alter column proveedor_id drop not null;

alter table presupuestos drop constraint presupuestos_estado_check;
alter table presupuestos add constraint presupuestos_estado_check
  check (estado in ('A cotizar', 'Pendiente', 'Aprobado', 'Descartado'));

-- Sólo un pedido puede no tener proveedor: una cotización de verdad siempre
-- dice quién la hizo.
alter table presupuestos add constraint presupuestos_proveedor_salvo_pedido
  check (proveedor_id is not null or estado = 'A cotizar');

-- El pedido puede salir en cero: la subtarea todavía no tenía precio.
alter table presupuestos drop constraint presupuestos_monto_check;
alter table presupuestos add constraint presupuestos_monto_check
  check (monto > 0 or (estado = 'A cotizar' and monto >= 0));

-- La coherencia de tipo de proveedor sólo aplica si hay proveedor.
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

  if new.proveedor_id is null then
    return new;
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

-- ===================== El enlace desde el desglose ==========================

-- El enlace vive en el renglón y no en la cotización: el desglose se guarda
-- reemplazando sus renglones, y así el enlace viaja con cada uno. Si se borra
-- la cotización, el renglón sigue y sólo pierde el enlace.
alter table computo_item_desglose
  add column presupuesto_id uuid references presupuestos(id) on delete set null,
  add column usar_cotizado  boolean not null default false;

create index on computo_item_desglose (presupuesto_id);

comment on column computo_item_desglose.presupuesto_id is
  'La cotización pedida para esta subtarea, si se tildó "Cotización".';
comment on column computo_item_desglose.usar_cotizado is
  'Si el cómputo usa el precio cotizado en vez del computado para esta subtarea.';
