-- ============================================================================
-- Qué se cotiza, por tarea y no por rubro.
--
-- Dentro de un mismo rubro conviven formas distintas de cotizar: el cartel de
-- obra viene con todo incluido en un precio, y el cerco se compra por un lado
-- y lo arma otro. Marcarlo para el rubro entero obligaba a elegir mal alguna.
--
-- Cada tarea del cómputo dice si lleva materiales, mano de obra (las dos
-- pueden ir juntas, cotizadas por separado) o un precio integrado, que excluye
-- a las otras dos. Las casillas del rubro siguen existiendo para Cotizaciones;
-- al guardar el cómputo se prenden las que usen sus tareas.
-- ============================================================================

alter table computo_items
  add column usa_materiales boolean not null default true,
  add column usa_mano_obra  boolean not null default true,
  add column usa_integrado  boolean not null default false;

-- Lo que ya estaba cargado toma lo que decía su rubro, que era la regla hasta
-- ahora. El integrado manda: si el rubro lo tenía, la tarea queda integrada.
update computo_items i
set usa_integrado  = r.usa_mano_obra_y_materiales,
    usa_materiales = r.usa_materiales and not r.usa_mano_obra_y_materiales,
    usa_mano_obra  = r.usa_mano_obra  and not r.usa_mano_obra_y_materiales
from rubros r
where r.id = i.rubro_id;

-- Si el rubro no marcaba nada de lo anterior (no debería pasar), mano de obra.
update computo_items
set usa_mano_obra = true
where not usa_materiales and not usa_mano_obra and not usa_integrado;

alter table computo_items add constraint computo_items_algun_tipo
  check (usa_materiales or usa_mano_obra or usa_integrado);

alter table computo_items add constraint computo_items_integrado_solo
  check (not usa_integrado or (not usa_materiales and not usa_mano_obra));

comment on column computo_items.usa_integrado is
  'Materiales y mano de obra en un solo precio (precio_integrado). Excluye a los otros dos.';
