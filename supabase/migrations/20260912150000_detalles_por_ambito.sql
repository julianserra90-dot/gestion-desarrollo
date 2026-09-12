-- ===========================================================================
-- El catálogo de detalles sirve también a los ingresos: un ámbito por lista
-- ===========================================================================
--
-- Los ingresos tienen el mismo problema que los gastos —"Aporte de capital"
-- escrito de cinco formas— pero no la misma lista: "Jornales" no es un
-- ingreso. En vez de una tabla gemela, la misma con un `ambito` que separa
-- las dos listas. Lo ya cargado era todo de gastos.

alter table detalles_gasto rename to detalles;

alter table detalles
  add column ambito text not null default 'Gasto'
    check (ambito in ('Gasto', 'Ingreso'));

-- El mismo nombre puede estar en las dos listas; dentro de una, no.
drop index if exists detalles_gasto_sin_repetir;
create unique index detalles_sin_repetir on detalles (ambito, lower(btrim(nombre)));

create index on detalles (ambito);

-- Las políticas viajaron con el rename; sólo cambian de nombre para que se
-- entienda a qué tabla pertenecen.
alter policy detalles_gasto_select on detalles rename to detalles_select;
alter policy detalles_gasto_insert on detalles rename to detalles_insert;
alter policy detalles_gasto_admin  on detalles rename to detalles_admin;
