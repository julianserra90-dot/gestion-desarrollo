-- ===========================================================================
-- El presupuesto también es una lista de materiales
-- ===========================================================================
--
-- Un presupuesto de corralón **ya es** qué se compra, cuánto y a cuánto: la
-- app lo guardaba como un número solo (`monto`), que es tirar casi todo el
-- papel. Cargar los items acá no agrega trabajo —es transcribir lo que el
-- presupuesto dice— y a cambio la compra grande deja de recargarse a mano:
-- el gasto los trae del presupuesto y se le sacan los que no vinieron.
--
-- Sigue habiendo dos caminos, a propósito: la compra grande se cotiza primero
-- y el gasto copia sus items; la compra chica se carga directo en el gasto,
-- como hasta ahora. Por eso `gasto_materiales` no se toca ni se vacía.
--
-- Y son **dos hechos distintos**: lo cotizado y lo comprado. El gasto se
-- queda con su propia copia en vez de apuntar a la lista del presupuesto,
-- así corregir un presupuesto viejo no reescribe qué se compró.

-- El número que le pone el proveedor a su presupuesto ("P-0012/26"). Va como
-- texto porque no es un entero: lleva letras, barras y el año adentro.
alter table presupuestos add column numero text;

comment on column presupuestos.numero is
  'El número con el que el proveedor identifica su presupuesto. Es su documento, no una numeración nuestra.';

-- Los items de un presupuesto. Espejo de `gasto_materiales`, con la misma
-- unidad de catálogo y el mismo orden de carga.
--
-- El precio unitario es opcional por lo mismo que en el gasto: un presupuesto
-- puede venir con el total cerrado y las cantidades detalladas sin precio por
-- renglón. Y el `monto` del presupuesto **no se calcula desde acá**, igual que
-- el del gasto no sale de su detalle.
--
-- No se exige que el presupuesto sea de tipo Materiales: un contratista que
-- cotiza con los materiales incluidos es un caso que ya está anotado como
-- pendiente, y un `check` acá lo dejaría afuera de entrada.
create table presupuesto_materiales (
  id              uuid primary key default gen_random_uuid(),
  presupuesto_id  uuid not null references presupuestos(id) on delete cascade,
  material_id     uuid not null references materiales(id) on delete restrict,
  cantidad        numeric(14, 3) not null check (cantidad > 0),
  precio_unitario numeric(14, 2)
    check (precio_unitario is null or precio_unitario >= 0),
  orden           integer not null default 0,
  creado_en       timestamptz not null default now()
);

create index on presupuesto_materiales (presupuesto_id);
create index on presupuesto_materiales (material_id);

comment on table presupuesto_materiales is
  'Los items de un presupuesto de materiales. El monto del presupuesto es el que cotizó el proveedor, no la suma de esto.';

-- De qué presupuesto salió esta compra.
--
-- Hasta ahora el enganche entre un gasto y su cotización era "mismo proveedor
-- y mismo rubro", que es frágil: un corralón puede tener varios presupuestos
-- abiertos en la misma obra y no hay forma de saber cuál se compró. Con esto
-- el vínculo es explícito.
--
-- `set null` y no `cascade`: si se borra el presupuesto, la compra ocurrió
-- igual. Queda el gasto con sus items, sin el papel del que vinieron.
alter table gastos add column presupuesto_id uuid references presupuestos(id) on delete set null;

create index on gastos (presupuesto_id);

comment on column gastos.presupuesto_id is
  'El presupuesto del que se trajeron los items, si la compra salió de uno. Los items del gasto son copia propia, no una referencia.';

alter table presupuesto_materiales enable row level security;

-- Mismas reglas que el detalle del gasto: se ve si se puede ver la obra del
-- presupuesto que lo contiene, y escribir es de admin.
create policy presupuesto_materiales_select on presupuesto_materiales for select to authenticated
  using (exists (
    select 1 from presupuestos p
    where p.id = presupuesto_materiales.presupuesto_id and puede_ver_obra(p.obra_id)
  ));

create policy presupuesto_materiales_admin on presupuesto_materiales for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
