-- ===========================================================================
-- Los materiales apuntan al rubro de la plantilla, no al de una obra
-- ===========================================================================
--
-- El catálogo de materiales es común a todas las obras y su `rubro_id` va a
-- los rubros de la plantilla (`obra_id` nulo). El alta desde el gasto le
-- estaba pegando el rubro **de la obra** —otra fila, con otro id—, y esos
-- materiales caían en "Sin rubro" en el catálogo y no aparecían bajo su rubro
-- al cargar. Se enderezan por nombre, que es lo que las dos filas comparten.

update materiales m
set rubro_id = p.id
from rubros o
join rubros p on p.obra_id is null and p.nombre = o.nombre
where m.rubro_id = o.id
  and o.obra_id is not null;
