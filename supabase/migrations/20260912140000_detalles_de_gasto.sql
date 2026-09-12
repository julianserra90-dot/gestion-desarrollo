-- ===========================================================================
-- Catálogo de detalles de gasto, para cargar siempre con las mismas palabras
-- ===========================================================================
--
-- El detalle de un gasto es texto libre y así se vuelve inservible para
-- agrupar: "Jornales", "jornales semana 3" y "Pago jornales" son lo mismo
-- escrito distinto. El catálogo da la opción de elegir de una lista en vez de
-- escribir, y de sumar uno nuevo desde el mismo formulario cuando falta.
--
-- Es **compartido entre obras**, como el de proveedores y el de rubros: lo que
-- se quiere es la misma lógica de carga en todas, no una lista por obra. Y no
-- reemplaza al texto libre —el gasto sigue guardando `concepto` como texto—:
-- es una ayuda para escribirlo igual.

create table detalles_gasto (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  creado_en timestamptz not null default now()
);

-- Sin distinguir mayúsculas, que es como se cuelan los duplicados de verdad.
create unique index detalles_gasto_sin_repetir on detalles_gasto (lower(btrim(nombre)));

alter table detalles_gasto enable row level security;

-- Lo ve y lo alimenta cualquiera que cargue gastos: los usuarios de empresa
-- cargan gastos sin ser administradores, y el catálogo crece desde ese
-- formulario. Borrar y renombrar queda para el administrador.
create policy detalles_gasto_select on detalles_gasto for select to authenticated
  using (true);

create policy detalles_gasto_insert on detalles_gasto for insert to authenticated
  with check (true);

create policy detalles_gasto_admin on detalles_gasto for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

-- Los primeros, para que la lista no arranque vacía.
insert into detalles_gasto (nombre) values
  ('Gastos de obra'),
  ('Acopio de materiales'),
  ('Jornales');
