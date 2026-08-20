-- ===========================================================================
-- Qué se compró, no sólo cuánto salió
-- ===========================================================================
--
-- Un gasto de materiales dice hoy "Corralón Chivilcoy, $ 5.218.446". Sirve para
-- la plata, pero no para la obra: no queda registro de que fueron 2.500
-- ladrillos y 40 bolsas de cemento, ni a cuánto estaba cada uno. Eso es lo que
-- después permite comparar precios entre compras y saber cuánto material se
-- lleva puesto.
--
-- Dos tablas: el catálogo de materiales y el detalle de cada gasto.
--
-- El catálogo es **uno solo para todas las obras**, igual que el de
-- proveedores: el ladrillo común es el mismo ladrillo en todos lados. Y el
-- rubro es opcional —sirve para ofrecer primero los de albañilería cuando se
-- carga un gasto de albañilería—, apuntando al rubro del catálogo (`obra_id`
-- null) por la misma razón que `proveedores.rubro_id`.
--
-- La unidad va como texto libre y sin `check`: la elige un desplegable en
-- pantalla, así que no entra cualquier cosa, pero sumar "rollo" o "chapa" el
-- día que aparezcan no tiene por qué costar una migración.

create table materiales (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  unidad    text not null,
  rubro_id  uuid references rubros(id) on delete set null,
  creado_en timestamptz not null default now(),
  -- El mismo material no se carga dos veces; la unidad es del material, no de
  -- la compra (el ladrillo se cuenta por unidad, siempre).
  unique (nombre)
);

create index on materiales (rubro_id);

comment on table materiales is
  'Catálogo de materiales, común a todas las obras. La unidad es la del material, no la de cada compra.';

-- El detalle de un gasto: qué se compró y a cuánto.
--
-- El monto del gasto **sigue siendo el de la factura** y no se calcula desde
-- acá: la factura puede traer el IVA adentro, un flete o un descuento que no
-- son items. Por eso el precio unitario es opcional y la suma del detalle se
-- muestra al lado del total sin exigir que coincidan.
--
-- Se borra con el gasto (`cascade`): sin él no significa nada. Pero un material
-- usado en algún detalle no se puede borrar del catálogo (`restrict`), igual
-- que un proveedor con gastos cargados.
create table gasto_materiales (
  id              uuid primary key default gen_random_uuid(),
  gasto_id        uuid not null references gastos(id) on delete cascade,
  material_id     uuid not null references materiales(id) on delete restrict,
  cantidad        numeric(14, 3) not null check (cantidad > 0),
  precio_unitario numeric(14, 2)
    check (precio_unitario is null or precio_unitario >= 0),
  -- El orden en que se cargaron, para mostrarlos como se escribieron.
  orden           integer not null default 0,
  creado_en       timestamptz not null default now()
);

create index on gasto_materiales (gasto_id);
create index on gasto_materiales (material_id);

comment on table gasto_materiales is
  'Los items de un gasto de materiales. El total del gasto es el de la factura, no la suma de esto.';

alter table materiales        enable row level security;
alter table gasto_materiales  enable row level security;

-- Catálogo: todos leen, y **agregar lo puede hacer cualquiera** —hace falta
-- para cargar un material nuevo en medio de un gasto, igual que con los
-- proveedores—. Modificar y borrar es de admin, porque toca gastos ya cargados.
create policy materiales_select on materiales for select to authenticated
  using (true);

create policy materiales_insert on materiales for insert to authenticated
  with check (true);

create policy materiales_admin on materiales for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

-- El detalle se ve si se puede ver la obra del gasto que lo contiene, igual
-- que las fotos con su registro.
create policy gasto_materiales_select on gasto_materiales for select to authenticated
  using (exists (
    select 1 from gastos g
    where g.id = gasto_materiales.gasto_id and puede_ver_obra(g.obra_id)
  ));

create policy gasto_materiales_admin on gasto_materiales for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
