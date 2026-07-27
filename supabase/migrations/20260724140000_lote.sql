-- ===========================================================================
-- El lote: la compra del terreno, aparte del costo de construir
-- ===========================================================================
--
-- El terreno no es un gasto de obra más: es una compra de inmueble, casi siempre
-- en dólares, que puede pagarse en etapas (seña, boleto, escritura) o financiada.
-- Y su valor no entra en el m² de construcción —los 800 USD/m² son de obra, no
-- de tierra—, así que vive separado de los gastos.
--
-- Por eso el lote NO pasa por la tabla `gastos` ni por el balance entre socias:
-- es su propia sección, con su valor pactado y sus pagos. Si más adelante se
-- quiere que pese en la liquidación, se conecta; por ahora se lleva aparte.
--
-- Una obra tiene un solo lote, así que su ficha va en columnas de la obra. Los
-- pagos, que son varios, van en una tabla.

alter table obras
  add column lote_valor_usd     numeric(14, 2)
    check (lote_valor_usd is null or lote_valor_usd > 0),
  add column lote_superficie_m2 numeric(10, 2)
    check (lote_superficie_m2 is null or lote_superficie_m2 > 0),
  add column lote_vendedor       text,
  add column lote_detalle        text;

comment on column obras.lote_valor_usd is
  'Precio pactado de compra del terreno, en dólares.';
comment on column obras.lote_superficie_m2 is
  'Superficie del terreno. Distinta de superficie_m2, que es lo construido.';

-- -------- Los pagos del lote -----------------------------------------------
--
-- Cada fila es un desembolso. La categoría separa lo que abona el precio
-- pactado (Compra) de los costos que van aparte (escribanía, sellos, comisión):
-- así el "saldo pendiente" de la compra no se mezcla con los gastos de la
-- operación.

create table lote_pagos (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references obras(id) on delete cascade,
  fecha         date not null default current_date,
  categoria     text not null
                check (categoria in ('Compra', 'Escribanía', 'Sellos', 'Comisión', 'Otro')),
  -- Qué es: "Seña", "Escritura", "Cuota 3", "Honorarios escribano"...
  concepto      text not null,
  monto         numeric(14, 2) not null check (monto > 0),
  moneda        text not null default 'USD' check (moneda in ('ARS', 'USD')),
  observaciones text,
  creado_en     timestamptz not null default now()
);

create index on lote_pagos (obra_id, fecha desc);

-- Mismo criterio que el resto: la socia ve lo de sus obras, el admin escribe.
alter table lote_pagos enable row level security;

create policy lote_pagos_select on lote_pagos for select to authenticated
  using (puede_ver_obra(obra_id));

create policy lote_pagos_admin on lote_pagos for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
