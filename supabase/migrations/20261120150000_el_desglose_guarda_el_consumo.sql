-- El desglose guarda el consumo, no sólo el cociente
--
-- El renglón de un desglose dice cuánto entra **por unidad de la tarea**: 0,6
-- bolsas de premezcla por m² de revoque. Ese 0,6 es el resultado de una
-- cuenta —18 kg por m², bolsa de 30 kg— y la cuenta no estaba escrita en
-- ninguna parte.
--
-- Ahora el material declara su envase (migración anterior), así que se puede
-- guardar lo que de verdad se sabe: **el consumo tal como se enuncia**. El
-- 18 y los "kg" se guardan, y la cantidad en bolsas se deriva al leer. Tres
-- cosas que antes no se podían hacer:
--
--   - Verificar el renglón contra la ficha del producto, que habla en kg.
--   - Cargar un consumo sin dividir de cabeza.
--   - Cambiar el envase a 25 kg y que las tareas que usan ese material se
--     rehagan solas, en vez de quedar mintiendo con el cociente viejo.
--
-- `cantidad` se queda y sigue siendo la que manda en los precios: es la que
-- miran la planilla, el listado de materiales y las cotizaciones, y la que se
-- guarda cuando el consumo no se declaró. El consumo no la reemplaza, la
-- explica; al guardar se escriben las dos y al leer, si el consumo está y su
-- unidad es la del envase, la cantidad se recalcula.
--
-- Es opcional en los dos lados. Un renglón de mano de obra —media jornada de
-- oficial por m²— no tiene envase ni consumo que convertir, y los doscientos
-- y pico de renglones que ya están cargados siguen andando sin tocarlos.
--
-- Va en las dos tablas porque son la misma cosa en dos momentos:
-- `tarea_desglose` es el modelo del catálogo y `computo_item_desglose` su
-- copia en la obra. Si el consumo viviera sólo en una, tildar la tarea lo
-- perdería.

alter table tarea_desglose
  add column consumo        numeric(14, 4),
  add column consumo_unidad text;

alter table computo_item_desglose
  add column consumo        numeric(14, 4),
  add column consumo_unidad text;

-- O están las dos o no está ninguna, igual que el envase del material: un
-- "18" sin unidad no se puede convertir, y "kg" sin número tampoco.
alter table tarea_desglose
  add constraint tarea_desglose_consumo_completo
  check (
    (consumo is null and consumo_unidad is null)
    or (consumo is not null and consumo_unidad is not null and consumo > 0)
  );

alter table computo_item_desglose
  add constraint computo_item_desglose_consumo_completo
  check (
    (consumo is null and consumo_unidad is null)
    or (consumo is not null and consumo_unidad is not null and consumo > 0)
  );

comment on column tarea_desglose.consumo is
  'El consumo por unidad de la tarea tal como se enuncia (18, de 18 kg por m2). Null si se cargo la cantidad directo.';

comment on column tarea_desglose.consumo_unidad is
  'La unidad en la que se enuncia el consumo (kg). Siempre junto con consumo.';

comment on column computo_item_desglose.consumo is
  'El consumo por unidad de la tarea tal como se enuncia (18, de 18 kg por m2). Null si se cargo la cantidad directo.';

comment on column computo_item_desglose.consumo_unidad is
  'La unidad en la que se enuncia el consumo (kg). Siempre junto con consumo.';
