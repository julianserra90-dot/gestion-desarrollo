-- ============================================================================
-- Tipo de gasto (Materiales / Mano de obra) y catálogo de quién lo provee.
--
-- Antes el proveedor era texto libre en cada gasto: se repetía escrito distinto
-- ("Corralón Central" / "corralon central") y no se podía listar ni totalizar
-- por proveedor. Ahora hay un catálogo compartido entre obras.
--
-- Proveedores y contratistas viven en la misma tabla con un `tipo`, porque son
-- lo mismo desde el punto de vista del gasto: a quién se le pagó. Lo que cambia
-- es cuál se ofrece según el tipo de gasto.
-- ============================================================================

create table proveedores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  tipo      text not null check (tipo in ('Proveedor', 'Contratista')),
  creado_en timestamptz not null default now(),
  unique (nombre, tipo)
);

create index on proveedores (tipo);

alter table gastos
  add column tipo_gasto text not null default 'Materiales'
    check (tipo_gasto in ('Materiales', 'Mano de obra')),
  add column proveedor_id uuid references proveedores(id) on delete restrict;

create index on gastos (proveedor_id);

comment on column gastos.tipo_gasto is
  'Materiales usa proveedores; Mano de obra usa contratistas.';

-- --------- Migración de los proveedores que estaban como texto libre --------

insert into proveedores (nombre, tipo)
select distinct trim(proveedor), 'Proveedor'
from gastos
where proveedor is not null and trim(proveedor) <> ''
on conflict (nombre, tipo) do nothing;

update gastos g
set proveedor_id = p.id
from proveedores p
where p.tipo = 'Proveedor'
  and p.nombre = trim(g.proveedor)
  and g.proveedor is not null
  and trim(g.proveedor) <> '';

-- Antes de borrar la columna vieja, confirmar que no se perdió ningún dato.
do $$
declare
  v_huerfanos int;
begin
  select count(*) into v_huerfanos
  from gastos
  where proveedor is not null
    and trim(proveedor) <> ''
    and proveedor_id is null;

  if v_huerfanos > 0 then
    raise exception 'Quedaron % gastos con proveedor de texto sin vincular. No se borra la columna.', v_huerfanos;
  end if;
end;
$$;

alter table gastos drop column proveedor;

-- ================================= RLS ======================================
alter table proveedores enable row level security;

-- Todos los usuarios logueados leen el catálogo (lo necesitan para el
-- desplegable) y pueden agregar uno nuevo al cargar un gasto. Modificar o
-- borrar queda para el admin, porque afecta gastos ya cargados.
create policy proveedores_select on proveedores for select to authenticated
  using (true);

create policy proveedores_insert on proveedores for insert to authenticated
  with check (true);

create policy proveedores_admin on proveedores for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
