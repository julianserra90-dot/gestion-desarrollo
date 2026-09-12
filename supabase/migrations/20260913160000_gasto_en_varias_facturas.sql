-- ===========================================================================
-- Un gasto entre las socias facturado en más de una factura
-- ===========================================================================
--
-- Una compra grande que pagan entre todas se factura partida: una factura a
-- nombre de cada socia, con montos iguales o los que el proveedor haya
-- puesto, para que cada una compute su crédito fiscal. Es un solo gasto —un
-- solo monto, un solo reparto, un solo detalle de materiales que cierra contra
-- el total—; lo que se parte es el papel.
--
-- Cada fila es una de esas facturas: a nombre de quién, por cuánto, con qué
-- número y su archivo. Con filas acá, el gasto no lleva titular, número ni
-- archivo propios (`empresa_factura_id`, `numero_factura`, `comprobante_*`
-- quedan en null): cada dato vive en su factura. La alícuota y el tipo (A, B,
-- C) siguen en el gasto, son los mismos para todas. El IVA de cada factura es
-- la parte proporcional del IVA del gasto, y su crédito fiscal es del titular
-- de esa factura.
--
-- Un gasto de una sola factura sigue exactamente como estaba: sin filas acá.

create table gasto_facturas (
  id                   uuid primary key default gen_random_uuid(),
  gasto_id             uuid not null references gastos(id) on delete cascade,
  empresa_id           uuid not null references empresas(id),
  monto                numeric(14, 2) not null check (monto > 0),
  numero               text,
  comprobante_drive_id text,
  comprobante_nombre   text,
  comprobante_mime     text,
  comprobante_tamano   bigint,
  orden                integer not null default 0,
  creado_en            timestamptz not null default now(),
  -- Una factura por socia dentro del gasto: dos a nombre de la misma serían
  -- una sola con la suma.
  unique (gasto_id, empresa_id)
);

create index on gasto_facturas (gasto_id);

comment on table gasto_facturas is
  'Las facturas de un gasto facturado en más de una: titular, monto, número y archivo de cada una. Sin filas, el gasto tiene una sola factura y los datos viven en gastos.';

alter table gasto_facturas enable row level security;

-- Se ve si se puede ver la obra del gasto; lo toca el administrador, que es
-- quien carga los gastos entre las socias.
create policy gasto_facturas_select on gasto_facturas for select to authenticated
  using (exists (
    select 1 from gastos g
    where g.id = gasto_facturas.gasto_id and puede_ver_obra(g.obra_id)
  ));

create policy gasto_facturas_admin on gasto_facturas for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
