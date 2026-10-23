-- ============================================================================
-- Un desarrollador puede cargar la pantalla de gastos entera
-- ============================================================================
--
-- Tres agujeros del mismo tamaño, que dejaban al desarrollador a mitad de
-- camino: el formulario le ofrecía todo y la base le aceptaba la mitad.
--
-- 1. `gastos_insert_empresa` exigía `empresa_pagadora_id = auth_empresa_id()`.
--    Un gasto "Entre las socias" y uno pagado entero con la cuenta van los dos
--    con esa columna en null —no lo puso una empresa sola—, así que el insert
--    fallaba. Son dos movimientos normales de la operación diaria, no una
--    excepción del administrador.
--
-- 2. `gasto_materiales` y `gasto_facturas` sólo las escribía el administrador.
--    El gasto se guardaba y el detalle no: "El gasto se guardó, pero el detalle
--    de materiales no: new row violates row-level security policy". Y al
--    corregir un gasto que dejaba de ser de materiales, el borrado del detalle
--    viejo tampoco pasaba y quedaba colgado de un gasto que ya no lo lleva.
--
-- El criterio que queda: **el detalle sigue al gasto**. Quien puede escribir el
-- gasto puede escribir lo que cuelga de él, que es su desglose y su papel, no
-- datos con vida propia. Por eso va una función —`puede_escribir_gasto`— y las
-- dos tablas la usan: así no se pueden desfasar entre ellas ni con `gastos`.
--
-- Lo que esto NO abre: reasignarle un gasto a otra empresa. La condición sigue
-- siendo "mi empresa o nadie", nunca otra; alterar quién pagó es alterar el
-- balance entre socias. Un gasto compartido sí queda editable por cualquier
-- socia de la obra, que es la contracara de que cualquiera pueda cargarlo.
-- Borrar sigue siendo del administrador: para el desarrollador la salida es
-- anular, que deja el gasto tachado y a la vista.

-- ---------------------------------------------------------------------------
-- Quién paga el gasto
-- ---------------------------------------------------------------------------

drop policy if exists gastos_insert_empresa on gastos;
drop policy if exists gastos_update_empresa on gastos;

create policy gastos_insert_empresa on gastos for insert to authenticated
  with check (
    (empresa_pagadora_id is null or empresa_pagadora_id = auth_empresa_id())
    and puede_ver_obra(obra_id)
  );

-- El WITH CHECK repite la condición a propósito, como antes: sin él se podría
-- editar un gasto propio y pasárselo a otra empresa.
create policy gastos_update_empresa on gastos for update to authenticated
  using (
    (empresa_pagadora_id is null or empresa_pagadora_id = auth_empresa_id())
    and puede_ver_obra(obra_id)
  )
  with check (
    (empresa_pagadora_id is null or empresa_pagadora_id = auth_empresa_id())
    and puede_ver_obra(obra_id)
  );

-- ---------------------------------------------------------------------------
-- Lo que cuelga del gasto
-- ---------------------------------------------------------------------------

-- La misma condición que las dos policies de arriba, en un solo lugar. El
-- administrador entra por `auth_es_admin()`: su `auth_empresa_id()` es null y
-- no matchearía ninguna fila con empresa cargada.
create or replace function puede_escribir_gasto(p_gasto uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from gastos g
    where g.id = p_gasto
      and puede_ver_obra(g.obra_id)
      and (
        auth_es_admin()
        or g.empresa_pagadora_id is null
        or g.empresa_pagadora_id = auth_empresa_id()
      )
  );
$$;

comment on function puede_escribir_gasto(uuid) is
  'Si quien pide puede escribir ese gasto. La usan las tablas que cuelgan de él, para que el detalle siga al gasto y no tenga su propia regla.';

drop policy if exists gasto_materiales_admin on gasto_materiales;

create policy gasto_materiales_escribir on gasto_materiales for all to authenticated
  using (puede_escribir_gasto(gasto_id))
  with check (puede_escribir_gasto(gasto_id));

drop policy if exists gasto_facturas_admin on gasto_facturas;

create policy gasto_facturas_escribir on gasto_facturas for all to authenticated
  using (puede_escribir_gasto(gasto_id))
  with check (puede_escribir_gasto(gasto_id));

comment on table gasto_facturas is
  'Las facturas de un gasto facturado en más de una: titular, monto, número y archivo de cada una. Sin filas, el gasto tiene una sola factura y los datos viven en gastos. La escribe quien puede escribir el gasto.';
