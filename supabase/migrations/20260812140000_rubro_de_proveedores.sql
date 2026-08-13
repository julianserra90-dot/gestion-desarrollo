-- Qué hace cada contratista, para poder reconocerlo.
--
-- Con cuatro cargados alcanza el nombre; con treinta, "Hugo" no dice nada. El
-- rubro es lo que lo identifica: "Hugo — Instalación sanitaria" ya se entiende.
--
-- Apunta al rubro del **catálogo** (los que tienen `obra_id` en null), no al de
-- una obra: el catálogo de proveedores también es uno solo para todas, así que
-- enganchado a la copia de una obra el dato no serviría en las demás. Lo
-- garantiza el desplegable, que ofrece sólo esos; no hay trigger porque este es
-- el único formulario que lo escribe.
--
-- Es opcional: no siempre se sabe de entrada, y no vale la pena frenar el alta
-- por eso. Y va en toda la tabla, no sólo en contratistas — un corralón también
-- tiene lo suyo, y el ABL cae en Impuestos.

alter table proveedores
  add column rubro_id uuid references rubros(id) on delete set null;

create index on proveedores (rubro_id);

comment on column proveedores.rubro_id is
  'Rubro del catálogo (obra_id null) en el que trabaja. Sirve para reconocerlo en la lista.';
