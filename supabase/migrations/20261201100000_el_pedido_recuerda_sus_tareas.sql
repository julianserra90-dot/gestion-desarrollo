-- ===========================================================================
-- El pedido de cotización recuerda de qué tareas del cómputo salió
-- ===========================================================================
--
-- Desde el 25/11 se tildan tareas en la tabla de cómputo y sale **una** sola
-- cotización con el desglose de todas sumado. Pero el pedido nombraba sus
-- tareas nada más que en el texto del `detalle` ("Cómputo: Ladrillos
-- cerámicos huecos, Revoque grueso"), y un texto no se consulta: la tabla no
-- tenía forma de saber cuáles ya se mandaron a cotizar, así que la casilla
-- volvía vacía y nada impedía pedir dos veces lo mismo.
--
-- Acá queda el vínculo de verdad. Es muchos a muchos —un pedido junta varias
-- tareas, y una tarea puede volver a pedirse cuando el pedido anterior ya se
-- cotizó— así que va en su propia tabla y no en una columna.
--
-- **No reemplaza a `computo_item_desglose.presupuesto_id`**, que es otra
-- cosa: ese enlaza UN renglón del desglose con UNA cotización y sirve para
-- que el cómputo use el precio cotizado en vez del estimado
-- (`porUnidadDe` reparte el monto del presupuesto en la cantidad de la
-- tarea). Colgar varias tareas de ese enlace le daría a cada una el monto
-- entero del pedido. Esto de acá sólo dice de dónde salió el pedido.

create table presupuesto_computo_items (
  presupuesto_id uuid not null references presupuestos(id) on delete cascade,
  item_id        uuid not null references computo_items(id) on delete cascade,
  creado_en      timestamptz not null default now(),
  primary key (presupuesto_id, item_id)
);

-- La consulta que importa es al revés de la clave primaria: "¿esta tarea ya
-- está en algún pedido?", una vez por fila de la planilla.
create index on presupuesto_computo_items (item_id);

comment on table presupuesto_computo_items is
  'De qué tareas del cómputo salió un pedido de cotización. El detalle del presupuesto las nombra en texto; esto es lo que se puede consultar.';

alter table presupuesto_computo_items enable row level security;

-- Mismas reglas que los items del presupuesto: se ve si se puede ver la obra
-- del presupuesto que lo contiene, y escribir es de admin.
create policy presupuesto_computo_items_select on presupuesto_computo_items
  for select to authenticated
  using (exists (
    select 1 from presupuestos p
    where p.id = presupuesto_computo_items.presupuesto_id and puede_ver_obra(p.obra_id)
  ));

create policy presupuesto_computo_items_admin on presupuesto_computo_items
  for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
