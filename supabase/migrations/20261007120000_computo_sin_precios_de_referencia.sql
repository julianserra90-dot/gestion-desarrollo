-- ============================================================================
-- Las tareas se agregan sin precio: el valor se carga a mano.
--
-- Al tildar una tarea venía con un renglón de materiales y otro de mano de
-- obra con los precios de Cifras #367. Esos números confundían más de lo que
-- ayudaban: el volquete aparecía como "mano de obra" porque Cifras lo publica
-- en esa columna, cuando es un alquiler. El precio de cada tarea lo pone quien
-- arma el cómputo, en su desglose, con lo que realmente le cotizaron.
--
-- Se borran los modelos de arranque de Cifras (los que se guardaron a mano
-- desde una obra se quedan) y los renglones de referencia que ya se habían
-- copiado a las obras. Los renglones cargados a mano no se tocan.
-- ============================================================================

delete from tarea_desglose
where descripcion in (
  'Materiales (referencia Cifras)',
  'Mano de obra y equipos (referencia Cifras)'
);

delete from computo_item_desglose
where descripcion in (
  'Materiales (referencia Cifras)',
  'Mano de obra y equipos (referencia Cifras)'
);

-- Los precios de cada tarea vuelven a ser la suma de lo que queda en su
-- desglose; una tarea que se quedó sin renglones queda en cero.
update computo_items i
set precio_materiales = coalesce(d.mat, 0),
    precio_mano_obra  = coalesce(d.mo, 0),
    precio_integrado  = coalesce(d.int, 0)
from computo_items x
left join (
  select item_id,
         round(sum(cantidad * precio_unitario) filter (where tipo = 'Materiales'), 2)   as mat,
         round(sum(cantidad * precio_unitario) filter (where tipo = 'Mano de obra'), 2) as mo,
         round(sum(cantidad * precio_unitario) filter (where tipo = 'Integrado'), 2)    as int
  from computo_item_desglose
  group by item_id
) d on d.item_id = x.id
where i.id = x.id;
