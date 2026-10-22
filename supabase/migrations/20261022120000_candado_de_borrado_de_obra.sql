-- ===========================================================================
-- El candado del borrado cuenta todo lo que se perdería, no sólo cuatro tablas
-- ===========================================================================
--
-- `impedir_borrar_obra_con_datos` contaba gastos, avances, registros de fotos y
-- documentos. No contaba ingresos, cotizaciones, el cómputo ni los pagos del
-- lote, que cuelgan de la obra con `on delete cascade`: una obra recién
-- arrancada —el cómputo armado, las cotizaciones pedidas, algún aporte ya
-- ingresado, todavía sin gastar— pasaba el candado, y el botón "Eliminar
-- definitivamente" se la llevaba con todo eso adentro, sin pedir el nombre de
-- la obra y sin borrar los comprobantes de Drive.
--
-- Ahora cuenta las ocho. Con cualquiera cargada el borrado rápido se bloquea y
-- hay que pasar por archivar + escribir el nombre, que es el camino que sí
-- limpia Drive.
--
-- El mensaje nombra sólo lo que tiene algo: "3 ingresos, 41 tareas del cómputo"
-- se lee de un vistazo; una lista con seis ceros adentro, no.

create or replace function impedir_borrar_obra_con_datos()
returns trigger
language plpgsql
as $$
declare
  v_partes text[] := '{}';
  v_fila   record;
begin
  for v_fila in
    select * from (values
      ((select count(*) from gastos         where obra_id = old.id),
       'gasto', 'gastos'),
      ((select count(*) from avances        where obra_id = old.id),
       'avance', 'avances'),
      ((select count(*) from foto_registros where obra_id = old.id),
       'registro de fotos', 'registros de fotos'),
      ((select count(*) from documentos     where obra_id = old.id),
       'documento', 'documentos'),
      ((select count(*) from ingresos       where obra_id = old.id),
       'ingreso', 'ingresos'),
      ((select count(*) from presupuestos   where obra_id = old.id),
       'cotización', 'cotizaciones'),
      ((select count(*) from computo_items  where obra_id = old.id),
       'tarea del cómputo', 'tareas del cómputo'),
      ((select count(*) from lote_pagos     where obra_id = old.id),
       'pago del lote', 'pagos del lote')
    ) as t(cantidad, singular, plural)
    where cantidad > 0
  loop
    v_partes := v_partes || format(
      '%s %s',
      v_fila.cantidad,
      case when v_fila.cantidad = 1 then v_fila.singular else v_fila.plural end
    );
  end loop;

  if array_length(v_partes, 1) > 0 then
    raise exception
      'La obra tiene datos cargados (%). Archivala en vez de borrarla.',
      array_to_string(v_partes, ', ')
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

comment on function impedir_borrar_obra_con_datos() is
  'Guardia a nivel base: una obra con gastos, avances, fotos, documentos, ingresos, cotizaciones, cómputo o pagos del lote no se puede borrar de un tiro. Hay que archivarla y pasar por el borrado con confirmación, que es el que limpia Drive.';
