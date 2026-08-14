-- El detalle deja de ser obligatorio, y la semana vuelve a salir de la fecha.
--
-- Dos cambios que van juntos porque son la misma simplificación.
--
-- **El detalle era obligatorio** y casi siempre terminaba siendo la semana
-- escrita a mano ("Semana 22"), que es justo lo que ahora se muestra solo. Con
-- la fecha, el rubro, el destino y el monto un gasto ya está identificado; el
-- texto queda para lo que hace falta aclarar y nada más.
--
-- **`semana` se va**: se agregó ayer para poder marcar el gasto con una semana y
-- corregirla, pero ahora todos los gastos se identifican con la que sale de la
-- fecha, sin tildar nada. Una columna que ya no escribe ni lee nadie es la clase
-- de resto que después confunde —mismo caso que `contacto` en proveedores—.
-- Si vuelve a hacer falta corregirla a mano (un pago del lunes por el trabajo de
-- la semana anterior), es agregar la columna de nuevo.
--
-- No se pierde nada: el único gasto que la tenía cargada la tenía igual a la
-- calculada.

alter table gastos alter column concepto drop not null;

alter table gastos drop column semana;

comment on column gastos.concepto is
  'Aclaración libre, opcional. La semana sale de la fecha y no se escribe acá.';
