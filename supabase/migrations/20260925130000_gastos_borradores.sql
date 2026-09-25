-- ===========================================================================
-- Borradores de gasto: lo que se empezó a cargar y no se terminó
-- ===========================================================================
--
-- Un gasto se carga con la factura en la mano, y a veces falta un dato —el
-- cambio, a nombre de quién salió, un precio— y hay que dejarlo para después.
-- Antes eso era perder todo lo escrito.
--
-- El borrador **no es un gasto**: vive en su propia tabla y no en `gastos` con
-- otro estado. Un gasto a medio cargar no cumple las reglas de un gasto (quién
-- lo puso, que la cuenta alcance, que las facturas sumen), y en `gastos` cada
-- vista de saldos, el control de la cuenta y cada suma de la app tendrían que
-- acordarse de saltearlo: un olvido y un borrador descuadra el balance. Acá no
-- lo puede sumar nadie.
--
-- `campos` guarda el formulario tal cual —nombre del campo → valores, como lo
-- manda el navegador— y no columnas interpretadas: al retomarlo, cada campo
-- vuelve con lo que se había escrito, incluidos los modos de la pantalla (los
-- pesos que se pagan con dólares de la cuenta, por ejemplo), que no son
-- columnas de ningún lado. El comprobante sí va aparte: es un archivo en Drive.
-- Al terminarlo se crea el gasto con las validaciones de siempre y el
-- borrador se borra; el comprobante pasa al gasto.

create table gastos_borradores (
  id                 uuid primary key default gen_random_uuid(),
  obra_id            uuid not null references obras(id) on delete cascade,
  campos             jsonb not null default '{}'::jsonb,
  comprobante_drive_id text,
  comprobante_nombre text,
  comprobante_mime   text,
  comprobante_tamano bigint,
  cargado_por        uuid references perfiles(id) on delete set null,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

create index on gastos_borradores (obra_id, actualizado_en desc);

comment on column gastos_borradores.campos is
  'El formulario del gasto tal como quedó: nombre del campo → lista de valores. Sin archivos.';

alter table gastos_borradores enable row level security;

-- Lo ve y lo toca quien ve la obra. Aparece en el listado de todos, y
-- cualquiera que lo vea tiene que poder terminarlo o descartarlo: si sólo lo
-- pudiera borrar quien lo empezó, el que lo termina crearía el gasto y el
-- borrador quedaría en la lista, listo para cargarse dos veces. Un borrador no
-- mueve plata, así que no hace falta la regla de los gastos (su propia
-- empresa); el gasto que sale de él sí pasa por esa regla al crearse.
create policy gastos_borradores_obra on gastos_borradores for all to authenticated
  using (puede_ver_obra(obra_id)) with check (puede_ver_obra(obra_id));

create policy gastos_borradores_admin on gastos_borradores for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
