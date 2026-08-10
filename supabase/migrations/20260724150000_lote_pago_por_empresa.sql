-- ===========================================================================
-- Cada pago del lote lo hace una empresa socia
-- ===========================================================================
--
-- Las cuotas del terreno las ponen las socias, y no siempre la misma: una paga
-- la seña, otra una cuota. Con quién pagó cada pago se puede repartir el lote
-- igual que la obra —cada socia debería poner su porcentaje— y sugerir la
-- compensación, pero en una liquidación aparte de la construcción.
--
-- La columna va NULLABLE, no NOT NULL: ya hay pagos cargados sin empresa y no se
-- puede adivinar quién los hizo. El formulario sí la pide de acá en más; los
-- pagos viejos se asignan editándolos, y hasta entonces quedan "sin asignar",
-- fuera del reparto.
--
-- `on delete restrict`: una empresa que puso plata en un lote no se puede borrar
-- sin antes resolver esos pagos, igual que no se borra si tiene gastos.

alter table lote_pagos
  add column empresa_id uuid references empresas(id) on delete restrict;

create index on lote_pagos (empresa_id);

comment on column lote_pagos.empresa_id is
  'La socia que hizo el pago. Null = sin asignar, no entra en el reparto del lote.';
