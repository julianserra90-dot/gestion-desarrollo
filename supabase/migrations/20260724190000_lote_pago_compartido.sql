-- ===========================================================================
-- Un pago del lote puede ser de las dos socias, en partes iguales
-- ===========================================================================
--
-- Las cuotas del terreno muchas veces las ponen las dos socias juntas: una
-- cuota de 2000 son 1000 de cada una. En vez de cargar dos pagos de 1000, se
-- carga uno de 2000 marcado como "entre las socias" y el reparto lo divide en
-- partes iguales.
--
-- `compartido` = true reemplaza a `empresa_id` (que queda null): el pago no es
-- de una socia puntual, se reparte entre todas por igual.

alter table lote_pagos
  add column compartido boolean not null default false;

comment on column lote_pagos.compartido is
  'true = pago entre todas las socias, en partes iguales (empresa_id va null).';
