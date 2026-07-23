-- ============================================================================
-- Seed: pasa a la base lo que hoy está hardcodeado en data/mockData.ts
--
-- Notas de la migración:
--  * "Empresa A" / "Empresa B" son los nombres placeholder del mock. Renombralos
--    con los nombres reales y agregá las que falten en cada obra.
--  * obras.gastoTotal del mock se guarda como `presupuesto`. El total gastado
--    pasa a derivarse de la tabla gastos (ver vista obra_resumen).
--  * No se cargan fotos: en el mock son un contador, no archivos. Se cargan
--    los registros y la cantidad arranca en 0 hasta subir los archivos reales.
-- ============================================================================

insert into empresas (nombre) values ('Empresa A'), ('Empresa B')
on conflict (nombre) do nothing;

insert into rubros (nombre, orden) values
  ('Terreno',                1),
  ('Proyecto',               2),
  ('Permisos / trámites',    3),
  ('Demolición',             4),
  ('Movimiento de suelo',    5),
  ('Hormigón armado',        6),
  ('Hierro',                 7),
  ('Albañilería',            8),
  ('Instalación sanitaria',  9),
  ('Instalación eléctrica', 10),
  ('Carpinterías',          11),
  ('Terminaciones',         12),
  ('Honorarios',            13),
  ('Imprevistos',           14)
on conflict (nombre) do nothing;

-- ================================ Obras =====================================

insert into obras (slug, nombre, ubicacion, estado, fecha_inicio, fecha_fin_estimada, presupuesto) values
  ('san-isidro', 'Edificio San Isidro', 'San Isidro, Buenos Aires', 'En ejecución', '2026-06-01', '2026-12-01', 84500000),
  ('tigre',      'Viviendas Tigre',     'Tigre, Buenos Aires',      'Proyecto',     '2026-07-15', '2027-03-15', 22100000),
  ('belgrano',   'Reforma Belgrano',    'CABA',                     'Finalizada',   '2026-02-10', '2026-05-30', 38150000)
on conflict (slug) do nothing;

-- Socios. Acá es donde sumás la 3ra y 4ta empresa según la obra;
-- lo único que tiene que cumplirse es que los porcentajes den 100.
insert into obra_socios (obra_id, empresa_id, porcentaje)
select o.id, e.id, 50
from obras o
cross join empresas e
where o.slug in ('san-isidro', 'tigre', 'belgrano')
  and e.nombre in ('Empresa A', 'Empresa B')
on conflict do nothing;

-- ================================ Gastos ====================================

insert into gastos (obra_id, fecha, rubro_id, concepto, proveedor, empresa_pagadora_id, monto, estado)
select o.id, d.fecha, r.id, d.concepto, d.proveedor, e.id, d.monto, d.estado
from (values
  ('2026-06-04'::date, 'Hormigón armado', 'Hormigón para platea',      'Hormigonera Norte',  'Empresa A', 12500000::numeric, 'Pagado'),
  ('2026-06-08'::date, 'Hierro',          'Compra de barras de acero', 'Aceros San Martín',  'Empresa B',  8200000::numeric, 'Pagado'),
  ('2026-06-12'::date, 'Albañilería',     'Materiales varios',         'Corralón Central',   'Empresa A',  3600000::numeric, 'Pendiente')
) as d(fecha, rubro, concepto, proveedor, empresa, monto, estado)
join obras    o on o.slug   = 'san-isidro'
join rubros   r on r.nombre = d.rubro
join empresas e on e.nombre = d.empresa;

-- =============================== Avances ====================================

insert into avances (obra_id, rubro_id, porcentaje, estado, comentario, fecha, actualizado_por_nombre)
select o.id, r.id, d.porcentaje, d.estado, d.comentario, d.fecha, d.actualizado_por
from (values
  ('Demolición',            100, 'Finalizado',   'Demolición terminada y sector liberado para movimiento de suelo.',   '2026-06-03'::date, 'Jefe de obra'),
  ('Movimiento de suelo',    80, 'En ejecución', 'Excavación avanzada. Falta completar nivelación del sector posterior.', '2026-06-06'::date, 'Jefe de obra'),
  ('Hormigón armado',        45, 'En ejecución', 'Platea ejecutada y armaduras de columnas en preparación.',            '2026-06-14'::date, 'Empresa A'),
  ('Albañilería',            10, 'Inicial',      'Inicio de mampostería en planta baja.',                               '2026-06-20'::date, 'Empresa B'),
  ('Instalación sanitaria',  15, 'Inicial',      'Primer tendido de cañerías en planta baja.',                          '2026-06-25'::date, 'Jefe de obra'),
  ('Instalación eléctrica',  12, 'Inicial',      'Canalizaciones y cajas embutidas en sectores comunes.',               '2026-06-28'::date, 'Empresa A'),
  ('Carpinterías',            5, 'Replanteo',    'Relevamiento de vanos y medidas preliminares.',                       '2026-07-03'::date, 'Empresa B'),
  ('Terminaciones',           0, 'Sin iniciar',  'Rubro pendiente. Se registraron pruebas de materialidad.',            '2026-07-08'::date, 'Jefe de obra')
) as d(rubro, porcentaje, estado, comentario, fecha, actualizado_por)
join obras  o on o.slug   = 'san-isidro'
join rubros r on r.nombre = d.rubro
on conflict (obra_id, rubro_id) do nothing;

-- =========================== Registros de fotos =============================

insert into foto_registros (obra_id, rubro_id, fecha, descripcion, estado, subido_por_nombre)
select o.id, r.id, d.fecha, d.descripcion, d.estado, d.subido_por
from (values
  ('Movimiento de suelo',   '2026-06-04'::date, 'Inicio de tareas preliminares y limpieza del terreno.',   'Registrado',            'Jefe de obra'),
  ('Hormigón armado',       '2026-06-10'::date, 'Armado de platea previo al hormigonado.',                 'Registrado',            'Empresa A'),
  ('Hormigón armado',       '2026-06-14'::date, 'Colado de hormigón en sector de fundaciones.',            'Registrado',            'Jefe de obra'),
  ('Albañilería',           '2026-06-20'::date, 'Inicio de mampostería en planta baja.',                   'Registrado',            'Empresa B'),
  ('Instalación sanitaria', '2026-06-25'::date, 'Tendido de cañerías sanitarias en planta baja.',          'Pendiente de revisión', 'Jefe de obra'),
  ('Instalación eléctrica', '2026-06-28'::date, 'Canalizaciones eléctricas y cajas embutidas.',            'Registrado',            'Empresa A'),
  ('Carpinterías',          '2026-07-03'::date, 'Replanteo y medición de vanos para carpinterías.',        'Registrado',            'Empresa B'),
  ('Terminaciones',         '2026-07-08'::date, 'Pruebas de revestimientos y encuentros interiores.',      'Pendiente de revisión', 'Jefe de obra')
) as d(rubro, fecha, descripcion, estado, subido_por)
join obras  o on o.slug   = 'san-isidro'
join rubros r on r.nombre = d.rubro;

-- ============================== Documentos ==================================

insert into documentos (obra_id, nombre, tipo, categoria, fecha, version, estado, subido_por_nombre)
select o.id, d.nombre, d.tipo, d.categoria, d.fecha, d.version, d.estado, d.subido_por
from (values
  ('Planta arquitectura PB',            'PDF', 'Arquitectura',  '2026-06-04'::date, 'V03', 'Vigente',     'Julian Serra'),
  ('Plano estructura',                  'DWG', 'Estructura',    '2026-06-06'::date, 'V02', 'Vigente',     'Empresa A'),
  ('Instalación sanitaria',             'PDF', 'Instalaciones', '2026-06-08'::date, 'V01', 'En revisión', 'Estudio técnico'),
  ('Presupuesto hormigón',              'XLS', 'Presupuestos',  '2026-06-10'::date, 'V01', 'Vigente',     'Empresa B'),
  ('Permiso municipal',                 'PDF', 'Permisos',      '2026-06-12'::date, 'V01', 'Vigente',     'Administración'),
  ('Contrato proveedor carpinterías',   'PDF', 'Contratos',     '2026-06-14'::date, 'V01', 'Vigente',     'Julian Serra')
) as d(nombre, tipo, categoria, fecha, version, estado, subido_por)
join obras o on o.slug = 'san-isidro';
