-- ============================================================================
-- Cada obra marca qué proveedores usa.
--
-- El catálogo de proveedores era uno solo para todas las obras, y los
-- desplegables de gastos y cotizaciones ofrecían la lista entera: en
-- Andonaegui aparecían los contratistas de 3 de Febrero.
--
-- El catálogo sigue siendo uno —el nombre, el teléfono y el rubro de un
-- corralón no cambian de obra en obra, y el mismo puede venderle a dos— pero
-- cada obra marca los suyos, igual que hace con los rubros. Los desplegables
-- ofrecen sólo los marcados.
-- ============================================================================

create table obra_proveedores (
  obra_id      uuid not null references obras(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  creado_en    timestamptz not null default now(),
  primary key (obra_id, proveedor_id)
);

create index on obra_proveedores (proveedor_id);

comment on table obra_proveedores is
  'Qué proveedores del catálogo usa cada obra. Los desplegables ofrecen sólo éstos.';

-- ---------------- Los que ya se usaron quedan marcados donde -----------------
-- Una obra se queda con todo proveedor que figure en sus gastos o en sus
-- cotizaciones. Los que no se usaron en ningún lado no quedan en ninguna: se
-- suman desde la pantalla de contratistas y proveedores de la obra.

insert into obra_proveedores (obra_id, proveedor_id)
select distinct obra_id, proveedor_id
from gastos
where proveedor_id is not null
union
select distinct obra_id, proveedor_id
from presupuestos
where proveedor_id is not null
on conflict do nothing;

-- ================================= RLS ======================================
-- Lo ve y lo marca quien ve la obra: sumar o sacar un proveedor de una obra no
-- toca el catálogo ni los gastos de nadie más.
alter table obra_proveedores enable row level security;

create policy obra_proveedores_select on obra_proveedores for select to authenticated
  using (puede_ver_obra(obra_id));

create policy obra_proveedores_insert on obra_proveedores for insert to authenticated
  with check (puede_ver_obra(obra_id));

create policy obra_proveedores_delete on obra_proveedores for delete to authenticated
  using (puede_ver_obra(obra_id));
