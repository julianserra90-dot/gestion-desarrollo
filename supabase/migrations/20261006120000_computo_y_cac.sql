-- ============================================================================
-- Cómputo y presupuesto estimado, con el índice CAC para comparar.
--
-- Hasta ahora la obra tenía dos números: lo **cotizado** (presupuestos
-- aprobados) y lo **gastado**. Faltaba el primero de todos: lo **estimado**,
-- que sale de computar la obra —cuántos m² de cada cosa— por un precio de
-- referencia. Es el número contra el que se mide si una cotización viene cara.
--
-- Tres piezas:
--
--   * `tareas`: el catálogo de tareas por rubro, común a todas las obras, con
--     su unidad y un precio de referencia separado en materiales y mano de
--     obra. Se carga con la tabla de costos unitarios de Revista Cifras #367.
--   * `computos` y `computo_items`: lo que cada obra lleva de ese catálogo y
--     en qué cantidad. El precio se **copia** al tildar la tarea: actualizar el
--     catálogo con la revista del mes siguiente no tiene que mover un cómputo
--     que ya se usó para decidir.
--   * `indices_cac`: el índice del costo de la construcción, mes a mes. Sin
--     él, un estimado de marzo comparado con una cotización de septiembre
--     siempre parece barato: lo que se compara es la inflación, no el precio.
--
-- La comparación con lo cotizado va **por rubro**, igual que los presupuestos.
-- ============================================================================

-- ======================= Los rubros de la revista ===========================
-- Las secciones de Cifras pasan a ser rubros del catálogo. Las que ya existían
-- con otro nombre para lo mismo (Pintura/Pinturas, Vidrios y espejos/
-- Vidriería, Cubiertas y Techos/Cubierta, Tareas Preliminares/Preliminares de
-- obra, Instalación Sanitaria/Sanitaria e incendio) no se duplican: las tareas
-- van al rubro que ya está, que es el que usan los gastos cargados.

insert into rubros (nombre, orden, obra_id, activo)
select v.nombre, v.orden, null, true
from (values
  ('Movimiento de Tierra',        35),
  ('Estructuras',                 36),
  ('Mamposterías y Tabiquerías',  37),
  ('Aislaciones',                 38),
  ('Revoques',                    39),
  ('Contrapisos',                 40),
  ('Equipamiento',                41),
  ('Varios',                      42)
) as v(nombre, orden)
where not exists (
  select 1 from rubros r where r.obra_id is null and lower(r.nombre) = lower(v.nombre)
);

-- El movimiento de suelo es pura mano de obra y máquina: no se compra nada.
update rubros set usa_materiales = false
where lower(nombre) = 'movimiento de tierra';

-- Las obras que ya existen reciben los nuevos sin marcar, igual que cuando se
-- armó el catálogo: aparecen para elegir, no se meten solos en los
-- desplegables. Tildar una tarea del cómputo marca su rubro.
insert into rubros (nombre, orden, obra_id, activo, usa_materiales)
select c.nombre, c.orden, o.id, false, c.usa_materiales
from rubros c
cross join obras o
where c.obra_id is null
  and not exists (
    select 1 from rubros r
    where r.obra_id = o.id and lower(r.nombre) = lower(c.nombre)
  );

-- ========================== El catálogo de tareas ===========================

create table tareas (
  id                uuid primary key default gen_random_uuid(),
  -- El rubro por nombre y no por id: el id de la plantilla no es el de la
  -- obra, y cada obra tiene su copia. Se busca sin mirar mayúsculas, como en
  -- todo el resto del catálogo.
  rubro             text not null,
  -- La subdivisión de la revista dentro del rubro ("Demoliciones y retiros",
  -- "Cloacas, pluviales y ventilaciones"). Ordena la lista, nada más.
  subrubro          text,
  nombre            text not null,
  unidad            text not null,
  precio_materiales numeric(14, 2) not null default 0 check (precio_materiales >= 0),
  precio_mano_obra  numeric(14, 2) not null default 0 check (precio_mano_obra >= 0),
  -- De dónde sale el precio, para saber cuándo está viejo.
  fuente            text,
  orden             integer not null default 0,
  creado_en         timestamptz not null default now(),
  unique (rubro, nombre)
);

comment on table tareas is
  'Catálogo de tareas por rubro con precio de referencia (materiales y mano de obra por separado). Común a todas las obras.';
comment on column tareas.precio_mano_obra is
  'Lo que Cifras llama "costo de ejecución": mano de obra más equipos.';

insert into tareas (rubro, subrubro, nombre, unidad, precio_materiales, precio_mano_obra, orden)
values
  ('Tareas Preliminares', 'Trabajos, tareas y provisiones', 'Cartel de obra', 'm²', 60551.67, 64465.81, 1),
  ('Tareas Preliminares', 'Trabajos, tareas y provisiones', 'Cerco de obra', 'm', 31537.71, 23692.59, 2),
  ('Tareas Preliminares', 'Trabajos, tareas y provisiones', 'Limpieza inicial de terreno y retiros generales', 'm²', 511.90, 4789.83, 3),
  ('Tareas Preliminares', 'Trabajos, tareas y provisiones', 'Nivelación y replanteo de obra', 'm²', 153.57, 8639.71, 4),
  ('Tareas Preliminares', 'Trabajos, tareas y provisiones', 'Obrador y construcciones provisorias', 'm²', 47094.89, 168102.75, 5),
  ('Tareas Preliminares', 'Demoliciones y retiros', 'Contenedor/volquete 5m3 (alquiler)', 'día', 0.00, 112269.77, 6),
  ('Tareas Preliminares', 'Demoliciones y retiros', 'Demolición de contrapisos y otros solados', 'm²', 0.00, 18612.58, 7),
  ('Tareas Preliminares', 'Demoliciones y retiros', 'Demolición de estructuras de hormigón armado', 'm³', 0.00, 314054.44, 8),
  ('Tareas Preliminares', 'Demoliciones y retiros', 'Demolición de mamposterías ladrillos comunes', 'm³', 0.00, 132540.64, 9),
  ('Tareas Preliminares', 'Demoliciones y retiros', 'Demolición de mamposterías ladrillos huecos', 'm²', 0.00, 22848.08, 10),
  ('Tareas Preliminares', 'Demoliciones y retiros', 'Picado de revoques', 'm²', 0.00, 16252.30, 11),
  ('Tareas Preliminares', 'Demoliciones y retiros', 'Retiro de pisos/revestimientos', 'm²', 0.00, 17432.44, 12),
  ('Movimiento de Tierra', null, 'Desmonte; terraplenamientos y rellenos a máquina', 'm³', 0.00, 43125.68, 1),
  ('Movimiento de Tierra', null, 'Desmonte; terraplenamientos y rellenos manual', 'm³', 0.00, 37559.06, 2),
  ('Movimiento de Tierra', null, 'Excavación a máquina para subsuelo', 'm³', 0.00, 53263.18, 3),
  ('Movimiento de Tierra', null, 'Excavación manual para bases de columnas', 'm³', 0.00, 56609.79, 4),
  ('Movimiento de Tierra', null, 'Excavación manual para zapata de muros', 'm³', 0.00, 42101.30, 5),
  ('Estructuras', 'Hormigón armado', 'Bases H°A° - H21/50kg', 'm³', 371317.21, 235192.24, 1),
  ('Estructuras', 'Hormigón armado', 'Columnas H°A° - H21/90kg', 'm³', 528612.26, 475987.39, 2),
  ('Estructuras', 'Hormigón armado', 'Encadenado H°A° - H21/65kg', 'm³', 428318.25, 472766.54, 3),
  ('Estructuras', 'Hormigón armado', 'Escalera H°A° - H21/65kg', 'm³', 454395.42, 510438.22, 4),
  ('Estructuras', 'Hormigón armado', 'Losa H°A° con viguetas y ladrillón cerámico 12cm', 'm²', 49702.28, 73834.28, 5),
  ('Estructuras', 'Hormigón armado', 'Losa H°A° con viguetas y ladrillón poliestireno exp. 12cm', 'm²', 60965.60, 70228.15, 6),
  ('Estructuras', 'Hormigón armado', 'Losa H°A° maciza H21/60kg', 'm³', 443308.75, 468595.81, 7),
  ('Estructuras', 'Hormigón armado', 'Tabiques H°A° - H21/70kg', 'm³', 444589.20, 681378.31, 8),
  ('Estructuras', 'Hormigón armado', 'Tanques H°A° - H21/120kg', 'm³', 476029.05, 745152.33, 9),
  ('Estructuras', 'Hormigón armado', 'Vigas H°A° - H21/120kg', 'm³', 641573.40, 642753.24, 10),
  ('Estructuras', 'Hormigón armado', 'Zapata corrida muros H° cascotes', 'm³', 226800.81, 67711.90, 11),
  ('Estructuras', 'Hormigón armado', 'Zapata corrida muros H°A°', 'm³', 322288.83, 141734.37, 12),
  ('Estructuras', 'Metálica', 'Hierros redondos', 'kg', 3775.37, 6664.63, 13),
  ('Estructuras', 'Metálica', 'Perfiles ángulo', 'kg', 10948.58, 9797.00, 14),
  ('Estructuras', 'Metálica', 'Perfiles normales', 'kg', 9438.43, 8397.43, 15),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Bloques HCCA 10x25x50cm', 'm²', 33357.16, 24718.52, 1),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Bloques HCCA 15x25x50cm', 'm²', 51250.05, 29004.38, 2),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Bloques HCCA 20x25x50cm', 'm²', 68545.93, 33290.23, 3),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Bloques de hormigón 10x20x40cm', 'm²', 23947.63, 32131.32, 4),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Bloques de hormigón 20x20x40cm', 'm²', 29927.05, 37576.09, 5),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Ladrillos cerámicos decorativos 12x18x25cm', 'm²', 32121.79, 35139.00, 6),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Ladrillos cerámicos huecos 08x18x33cm', 'm²', 13794.47, 32668.77, 7),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Ladrillos cerámicos huecos 12x18x33cm', 'm²', 20597.65, 35178.14, 8),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Ladrillos cerámicos huecos 18x18x33cm', 'm²', 28382.57, 37687.51, 9),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Ladrillos comunes a la vista en elevación', 'm³', 280222.98, 210023.43, 10),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Ladrillos comunes en cimientos', 'm³', 171629.80, 132090.14, 11),
  ('Mamposterías y Tabiquerías', 'Mamposterías', 'Ladrillos comunes en elevación', 'm³', 174476.72, 176108.07, 12),
  ('Mamposterías y Tabiquerías', 'Tabiquerías', 'Placa cementicia doble esp. 12,5cm exterior, con aislación', 'm²', 22509.38, 18336.14, 13),
  ('Mamposterías y Tabiquerías', 'Tabiquerías', 'Placa de yeso doble esp. 12,5cm, con aislación', 'm²', 18714.84, 15081.33, 14),
  ('Mamposterías y Tabiquerías', 'Tabiquerías', 'Placa de yeso resistente a la humedad esp. 9,5cm', 'm²', 21316.21, 15382.81, 15),
  ('Mamposterías y Tabiquerías', 'Tabiquerías', 'Placa de yeso simple esp. 8,5cm medio tabique interior', 'm²', 8418.13, 7247.93, 16),
  ('Mamposterías y Tabiquerías', 'Tabiquerías', 'Placa de yeso simple esp. 9,5cm interior, con aislación', 'm²', 13251.44, 8099.66, 17),
  ('Mamposterías y Tabiquerías', 'Tabiquerías', 'Placa de yeso simple esp. 9,5cm interior, sin aislación', 'm²', 10748.25, 7775.92, 18),
  ('Aislaciones', null, 'Aislante acústico lana en rollo tipo Acustiver', 'm²', 4889.84, 5133.61, 1),
  ('Aislaciones', null, 'Aislante acústico panel fonoabsorbente tipo Fonac', 'm²', 40748.71, 5900.70, 2),
  ('Aislaciones', null, 'Cementicia doble horizontal en muros', 'm²', 9922.24, 7080.85, 3),
  ('Aislaciones', null, 'Cementicia doble vertical en muros', 'm²', 7015.12, 5900.70, 4),
  ('Aislaciones', null, 'Cementicia vertical con tabique panderete para subsuelo', 'm²', 25523.04, 29980.22, 5),
  ('Aislaciones', null, 'Lana de vidrio con cara aluminio 50mm', 'm²', 7937.27, 2398.42, 6),
  ('Aislaciones', null, 'Membrana espuma de polietileno 10mm bajo techo', 'm²', 9139.98, 3214.98, 7),
  ('Aislaciones', null, 'Pintura asfáltica sobre paramentos', 'm²', 2410.44, 2998.02, 8),
  ('Aislaciones', null, 'Pintura impermeabilizante sobre paramentos', 'm²', 5171.26, 3214.98, 9),
  ('Cubiertas y Techos', null, 'Chapas H°G° N°25 color sobre estructura madera', 'm²', 61344.88, 27494.96, 1),
  ('Cubiertas y Techos', null, 'Chapas H°G° N°25 color sobre estructura metálica', 'm²', 72994.35, 31130.72, 2),
  ('Cubiertas y Techos', null, 'Chapas H°G° N°25 color sobre estructura mixta', 'm²', 66135.83, 30844.70, 3),
  ('Cubiertas y Techos', null, 'Chapas H°G° N°25 sobre estructura madera', 'm²', 37867.76, 26314.82, 4),
  ('Cubiertas y Techos', null, 'Chapas H°G° N°25 sobre estructura metálica', 'm²', 60224.49, 30492.98, 5),
  ('Cubiertas y Techos', null, 'Chapas H°G° N°25 sobre estructura mixta', 'm²', 51959.90, 29026.82, 6),
  ('Cubiertas y Techos', null, 'Plana completa terminación azotea verde', 'm²', 92027.24, 55884.04, 7),
  ('Cubiertas y Techos', null, 'Plana completa terminación baldosa cerámica', 'm²', 49409.64, 40190.49, 8),
  ('Cubiertas y Techos', null, 'Plana completa terminación doblado ladrillos comunes', 'm²', 50544.46, 36694.13, 9),
  ('Cubiertas y Techos', null, 'Plana completa terminación membrana asfáltica c/aluminio', 'm²', 36245.55, 31291.77, 10),
  ('Cubiertas y Techos', null, 'Plana completa terminación membrana geotextil', 'm²', 41633.82, 35469.93, 11),
  ('Cubiertas y Techos', null, 'Tejas francesas esmaltadas (color) sobre losa c/ aisl.', 'm²', 66717.68, 27494.96, 12),
  ('Cubiertas y Techos', null, 'Tejas francesas esmaltadas (color), est. madera sin cepillar c/ aisl.', 'm²', 101127.46, 42646.11, 13),
  ('Cubiertas y Techos', null, 'Tejas francesas esmaltadas (color), est. madera vista c/ aisl.', 'm²', 124237.07, 46728.94, 14),
  ('Cubiertas y Techos', null, 'Tejas francesas esmaltadas sobre losa c/ aisl.', 'm²', 52403.70, 26314.82, 15),
  ('Cubiertas y Techos', null, 'Tejas francesas esmaltadas, est. madera sin cepillar c/ aisl.', 'm²', 87117.40, 42008.37, 16),
  ('Cubiertas y Techos', null, 'Tejas francesas esmaltadas, est. madera vista c/ aisl.', 'm²', 110227.02, 46091.20, 17),
  ('Cubiertas y Techos', null, 'Tejas francesas natural sobre losa c/ aisl.', 'm²', 44118.35, 25772.42, 18),
  ('Cubiertas y Techos', null, 'Tejas francesas natural, est. madera sin cepillar c/ aisl.', 'm²', 79034.68, 40828.23, 19),
  ('Cubiertas y Techos', null, 'Tejas francesas natural, est. madera vista c/ aisl.', 'm²', 102144.30, 44911.06, 20),
  ('Revoques', null, 'Azotado impermeable', 'm²', 1455.68, 10710.38, 1),
  ('Revoques', null, 'Azotado impermeable en muro doble', 'm²', 1409.18, 12534.49, 2),
  ('Revoques', null, 'Exterior a la cal común completo', 'm²', 4937.55, 28323.38, 3),
  ('Revoques', null, 'Exterior completo, terminación material de frente', 'm²', 6245.57, 30815.84, 4),
  ('Revoques', null, 'Fino a la cal', 'm²', 1712.29, 12503.08, 5),
  ('Revoques', null, 'Fino/Estucado yeso', 'm²', 1575.44, 17799.02, 6),
  ('Revoques', null, 'Grueso común', 'm²', 1788.54, 11558.17, 7),
  ('Revoques', null, 'Impermeable de cemento', 'm²', 12272.81, 32370.14, 8),
  ('Revoques', null, 'Interior a la cal común completo', 'm²', 3244.22, 19263.61, 9),
  ('Revoques', null, 'Interior azotado y grueso b/ revestimientos', 'm²', 3570.58, 14543.05, 10),
  ('Revoques', null, 'Premezcla fino exterior (manual)', 'm²', 2644.15, 15915.15, 11),
  ('Revoques', null, 'Premezcla fino interior (manual)', 'm²', 2392.71, 13714.63, 12),
  ('Revoques', null, 'Premezclado grueso y fino interior (manual)', 'm²', 25179.65, 15532.51, 13),
  ('Revoques', null, 'Premezcla grueso y fino interior (proyectable)', 'm²', 25686.19, 13172.23, 14),
  ('Revoques', null, 'Premezcla impermeable, grueso y fino exterior (manual)', 'm²', 28715.95, 17988.13, 15),
  ('Revoques', null, 'Premezcla impermeable, grueso y fino exterior (proyectable)', 'm²', 29019.88, 14390.51, 16),
  ('Revoques', null, 'Toma de juntas de ladrillos vistos', 'm²', 979.17, 25963.10, 17),
  ('Contrapisos', null, 'Hormigón alivianado c/ poliestireno expandido e=06cm', 'm²', 14264.72, 14608.75, 1),
  ('Contrapisos', null, 'Hormigón alivianado c/ poliestireno expandido e=08cm', 'm²', 16832.36, 16215.71, 2),
  ('Contrapisos', null, 'Hormigón alivianado c/ poliestireno expandido e=20cm', 'm²', 39758.62, 20661.16, 3),
  ('Contrapisos', null, 'Hormigón alivianado elaborado H8 e=6cm', 'm²', 12478.58, 12248.47, 4),
  ('Contrapisos', null, 'Hormigón alivianado elaborado H8 e=8cm, para banquinas', 'm²', 14580.47, 12790.87, 5),
  ('Contrapisos', null, 'Hormigón armado e=12cm terminación a la llana', 'm²', 42688.61, 25473.94, 6),
  ('Contrapisos', null, 'Hormigón de cascotes e=08cm', 'm²', 6440.22, 13780.33, 7),
  ('Contrapisos', null, 'Hormigón de cascotes e=10cm', 'm²', 10222.73, 17225.41, 8),
  ('Contrapisos', null, 'Hormigón de cascotes e=12cm', 'm²', 12062.82, 19120.21, 9),
  ('Contrapisos', null, 'Mortero elaborado RDC (CUC=150kg/m3) e=6cm', 'm²', 12307.63, 10621.27, 10),
  ('Cielorrasos', null, 'Hormigón visto (terminaciones)', 'm²', 229.67, 9847.20, 1),
  ('Cielorrasos', null, 'Madera machimbrada suspendido; con estructura madera', 'm²', 30349.00, 17330.20, 2),
  ('Cielorrasos', null, 'Mortero a la cal aplicado bajo losa', 'm²', 4432.34, 27140.93, 3),
  ('Cielorrasos', null, 'Placa de yeso común junta tomada, con aislación', 'm²', 13700.45, 12465.68, 4),
  ('Cielorrasos', null, 'Placa de yeso común junta tomada, sin aislación', 'm²', 12216.18, 12186.85, 5),
  ('Cielorrasos', null, 'Placa de yeso común para cajones, taparrollos', 'm²', 12785.46, 14414.60, 6),
  ('Cielorrasos', null, 'Placa de yeso resistente a la humedad junta tomada', 'm²', 15169.04, 12932.28, 7),
  ('Cielorrasos', null, 'Placa vinílica texturada desmontable, sin aislación', 'm²', 13007.11, 13764.66, 8),
  ('Cielorrasos', null, 'Yeso aplicado bajo losa', 'm²', 2288.06, 27140.93, 9),
  ('Cielorrasos', null, 'Yeso armado, con estructura madera', 'm²', 16829.12, 46595.82, 10),
  ('Revestimientos', null, 'Cemento alisado', 'm²', 8944.08, 41277.91, 1),
  ('Revestimientos', null, 'Cerámicos esmaltados', 'm²', 31005.57, 24087.95, 2),
  ('Revestimientos', null, 'Granito reconstituido en escalones e:2,5cm (h/ch/z)', 'm²', 284692.87, 73753.03, 3),
  ('Revestimientos', null, 'Mesada de granito natural e=2,5cm, comp. (gris mara)', 'm²', 179209.48, 43780.08, 4),
  ('Revestimientos', null, 'Mesada de piedra natural e=2,5cm, comp. (travertino)', 'm²', 314264.77, 53678.38, 5),
  ('Revestimientos', null, 'Plástico texturado', 'm²', 13063.10, 30522.62, 6),
  ('Revestimientos', null, 'Porcelanato canto rectificado', 'm²', 81512.56, 25715.16, 7),
  ('Revestimientos', null, 'Porcelanato sin rectificar', 'm²', 49111.32, 20973.28, 8),
  ('Revestimientos', null, 'Tejuelas refractarias', 'm²', 29808.17, 32215.52, 9),
  ('Pisos', null, 'Alfombra alto tránsito 8mm', 'm²', 38098.11, 12094.64, 1),
  ('Pisos', null, 'Carpeta de cemento bajo pisos', 'm²', 6388.01, 9727.15, 2),
  ('Pisos', null, 'Cemento alisado', 'm²', 6900.33, 10907.29, 3),
  ('Pisos', null, 'Cemento term. a la llana mecánica, incl. H° e=4cm', 'm²', 13972.13, 12816.59, 4),
  ('Pisos', null, 'Cemento term. texturado/raspinado, incl. H° e=4cm', 'm²', 13124.84, 13358.99, 5),
  ('Pisos', null, 'Cerámicas esmaltadas', 'm²', 32657.59, 23478.85, 6),
  ('Pisos', null, 'Cerámicas rojas', 'm²', 23335.48, 22298.70, 7),
  ('Pisos', null, 'Losetas de H° 40x60cm', 'm²', 31874.95, 19806.01, 8),
  ('Pisos', null, 'Losetas graníticas 40x40cm', 'm²', 30281.10, 23602.82, 9),
  ('Pisos', null, 'Madera flotante símil algarrobo e=8mm', 'm²', 29211.95, 27780.98, 10),
  ('Pisos', null, 'Madera parquet algarrobo e=19mm', 'm²', 28022.43, 27143.24, 11),
  ('Pisos', null, 'Madera semidura tipo deck', 'm²', 26075.50, 21242.54, 12),
  ('Pisos', null, 'Mosaicos graníticos 30x30cm', 'm²', 29316.41, 26791.52, 13),
  ('Pisos', null, 'Pavimento con adoquín intertrabado e=8cm', 'm²', 29760.24, 22422.68, 14),
  ('Pisos', null, 'Porcelanato pulido', 'm²', 75402.54, 27019.27, 15),
  ('Pisos', null, 'Porcelanato sin pulir', 'm²', 45430.03, 22036.91, 16),
  ('Zócalos', null, 'Cemento alisado h=10cm', 'm', 331.89, 5996.04, 1),
  ('Zócalos', null, 'Cerámico esmaltado', 'm', 6065.35, 4178.16, 2),
  ('Zócalos', null, 'Cerámico gres', 'm', 4523.70, 4178.16, 3),
  ('Zócalos', null, 'Madera', 'm', 4051.27, 4050.61, 4),
  ('Zócalos', null, 'Mosaico granítico 10x30cm', 'm', 5212.37, 5358.30, 5),
  ('Zócalos', null, 'Perfil metálico', 'm', 3688.43, 3923.07, 6),
  ('Zócalos', null, 'Porcelanato pulido', 'm', 13766.12, 4433.26, 7),
  ('Carpinterías', null, 'Puerta ingreso madera maciza', 'm²', 444335.99, 70808.45, 1),
  ('Carpinterías', null, 'Puerta interior madera placa ench. madera', 'm²', 174733.52, 59007.04, 2),
  ('Carpinterías', null, 'Puerta interior madera placa ench. MDF', 'm²', 137113.27, 56646.76, 3),
  ('Carpinterías', null, 'Rejas de hierro', 'm²', 151443.27, 46824.28, 4),
  ('Carpinterías', null, 'Ventana / Puerta ventana aluminio', 'm²', 303839.05, 48385.77, 5),
  ('Carpinterías', null, 'Ventana / Puerta ventana aluminio con postigos', 'm²', 1041140.07, 62783.49, 6),
  ('Carpinterías', null, 'Ventana / Puerta ventana chapa doblada con celosía', 'm²', 139584.12, 55466.62, 7),
  ('Carpinterías', null, 'Ventana / Puerta ventana madera', 'm²', 1025887.65, 49565.92, 8),
  ('Carpinterías', null, 'Ventana / Puerta ventana madera con postigos', 'm²', 1665000.50, 66087.89, 9),
  ('Carpinterías', null, 'Ventana / Ventiluz chapa doblada', 'm²', 79756.82, 47205.63, 10),
  ('Vidrios y espejos', null, 'Cristal templado 10mm', 'm²', 370570.81, 47968.35, 1),
  ('Vidrios y espejos', null, 'Espejo cristal 6mm', 'm²', 106113.20, 9441.13, 2),
  ('Vidrios y espejos', null, 'Vidrio doble hermético DVH 24mm', 'm²', 339263.62, 28475.92, 3),
  ('Vidrios y espejos', null, 'Vidrio laminado seguridad 3+3mm color', 'm²', 224798.97, 17356.37, 4),
  ('Vidrios y espejos', null, 'Vidrio laminado seguridad 3+3mm incoloro', 'm²', 181915.00, 15739.28, 5),
  ('Vidrios y espejos', null, 'Vidrio laminado seguridad 4+4mm color', 'm²', 259512.51, 15389.71, 6),
  ('Vidrios y espejos', null, 'Vidrio laminado seguridad 4+4mm incoloro', 'm²', 247750.09, 15041.39, 7),
  ('Vidrios y espejos', null, 'Vidrio tipo inglés 3mm color', 'm²', 92915.13, 12604.83, 8),
  ('Vidrios y espejos', null, 'Vidrio tipo inglés 3mm incoloro', 'm²', 73352.36, 11896.75, 9),
  ('Vidrios y espejos', null, 'Vidrio transparente 3mm', 'm²', 33850.17, 7846.13, 10),
  ('Vidrios y espejos', null, 'Vidrio transparente 4mm', 'm²', 42428.87, 10027.59, 11),
  ('Pintura', null, 'Acrílica transparente en muros exteriores', 'm²', 9654.21, 11896.75, 1),
  ('Pintura', null, 'Barniz para carpintería de madera', 'm²', 17696.79, 17827.09, 2),
  ('Pintura', null, 'Esmalte sintético para carpintería metálica', 'm²', 21297.14, 22005.25, 3),
  ('Pintura', null, 'Látex en muros exteriores', 'm²', 8025.39, 12534.49, 4),
  ('Pintura', null, 'Látex en muros interiores', 'm²', 8484.23, 10716.61, 5),
  ('Pintura', null, 'Látex para cielorraso', 'm²', 6320.88, 11992.09, 6),
  ('Instalación Eléctrica', 'Elementos de la instalación', 'Artefacto de iluminación', 'u', 83575.02, 26430.40, 1),
  ('Instalación Eléctrica', 'Elementos de la instalación', 'Boca de electricidad', 'u', 98738.86, 46075.00, 2),
  ('Instalación Eléctrica', 'Elementos de la instalación', 'Boca de telefonía', 'u', 89358.67, 41467.50, 3),
  ('Instalación Eléctrica', 'Elementos de la instalación', 'Boca de televisión', 'u', 83928.03, 40546.00, 4),
  ('Instalación Eléctrica', 'Elementos de la instalación', 'Tablero de electricidad', 'u', 187621.79, 61433.33, 5),
  ('Instalación Eléctrica', 'Elementos de la instalación', 'Toma de electricidad', 'u', 87877.58, 41006.75, 6),
  ('Instalación Sanitaria', 'Artefactos, grifería y accesorios', 'Accesorios de baño loza blanca (9 piezas)', 'jgo', 350853.34, 77152.70, 1),
  ('Instalación Sanitaria', 'Artefactos, grifería y accesorios', 'Bañera metálica enlozada blanca c/ grifería', 'u', 634228.27, 114648.17, 2),
  ('Instalación Sanitaria', 'Artefactos, grifería y accesorios', 'Bidet loza blanca c/ grifería', 'u', 424877.27, 122847.97, 3),
  ('Instalación Sanitaria', 'Artefactos, grifería y accesorios', 'Inodoro pedestal loza blanca incl. D.I. y asiento', 'u', 503182.78, 121744.72, 4),
  ('Instalación Sanitaria', 'Artefactos, grifería y accesorios', 'Lavatorio loza blanca c/ grifería', 'u', 384110.14, 85725.22, 5),
  ('Instalación Sanitaria', 'Artefactos, grifería y accesorios', 'Pileta cocina bacha acero inoxidable c/ grifería', 'u', 456821.52, 85740.13, 6),
  ('Instalación Sanitaria', 'Artefactos, grifería y accesorios', 'Pileta lavar loza blanca c/ grifería', 'u', 386001.86, 78121.77, 7),
  ('Instalación Sanitaria', 'Agua e incendio', 'Boca de incendio', 'u', 1001209.55, 241404.16, 8),
  ('Instalación Sanitaria', 'Agua e incendio', 'Bomba centrífuga 1/2 HP', 'u', 342649.04, 53991.98, 9),
  ('Instalación Sanitaria', 'Agua e incendio', 'Canilla de servicio Ø 13mm c/ pico manguera', 'u', 33724.58, 11748.08, 10),
  ('Instalación Sanitaria', 'Agua e incendio', 'Canilla de servicio Ø 13mm c/ pico manguera en nicho ac. inox.', 'u', 82962.46, 15087.64, 11),
  ('Instalación Sanitaria', 'Agua e incendio', 'Cañería PP TF Ø 13mm', 'm', 12108.99, 8572.52, 12),
  ('Instalación Sanitaria', 'Agua e incendio', 'Cañería PP TF Ø 19mm', 'm', 15102.22, 8915.42, 13),
  ('Instalación Sanitaria', 'Agua e incendio', 'Cañería PP TF Ø 25mm', 'm', 18095.45, 9347.78, 14),
  ('Instalación Sanitaria', 'Agua e incendio', 'Cañería PP TF Ø 38mm', 'm', 19864.18, 9437.23, 15),
  ('Instalación Sanitaria', 'Agua e incendio', 'Cañería PP TF Ø 50mm', 'm', 23537.70, 9616.13, 16),
  ('Instalación Sanitaria', 'Agua e incendio', 'Llave de paso Ø 13mm', 'u', 19972.35, 8572.52, 17),
  ('Instalación Sanitaria', 'Agua e incendio', 'Llave de paso Ø 19mm', 'u', 24965.44, 9929.22, 18),
  ('Instalación Sanitaria', 'Agua e incendio', 'Llave de paso Ø 25mm', 'u', 49930.87, 14237.84, 19),
  ('Instalación Sanitaria', 'Agua e incendio', 'Llave de paso Ø 38mm', 'u', 62413.59, 15430.54, 20),
  ('Instalación Sanitaria', 'Agua e incendio', 'Llave de paso Ø 50mm', 'u', 73648.04, 16199.83, 21),
  ('Instalación Sanitaria', 'Agua e incendio', 'Tanque de agua polietileno tricapa 1100 l', 'u', 362537.47, 57100.45, 22),
  ('Instalación Sanitaria', 'Agua e incendio', 'Tanque de agua polietileno tricapa 2750 l', 'u', 468509.96, 74245.50, 23),
  ('Instalación Sanitaria', 'Cloacas, pluviales y ventilaciones', 'Boca de acceso PVC', 'u', 98353.80, 21894.97, 24),
  ('Instalación Sanitaria', 'Cloacas, pluviales y ventilaciones', 'Boca de desagüe abierta PVC', 'u', 41739.31, 32918.49, 25),
  ('Instalación Sanitaria', 'Cloacas, pluviales y ventilaciones', 'Cámara de inspección H°A° 60x60cm', 'u', 186659.66, 68311.82, 26),
  ('Instalación Sanitaria', 'Cloacas, pluviales y ventilaciones', 'Cañería PVC 3,2 Ø 040mm', 'm', 7315.21, 7245.64, 27),
  ('Instalación Sanitaria', 'Cloacas, pluviales y ventilaciones', 'Cañería PVC 3,2 Ø 050mm', 'm', 11518.53, 7818.14, 28),
  ('Instalación Sanitaria', 'Cloacas, pluviales y ventilaciones', 'Cañería PVC 3,2 Ø 060mm', 'm', 11932.28, 8229.62, 29),
  ('Instalación Sanitaria', 'Cloacas, pluviales y ventilaciones', 'Cañería PVC 3,2 Ø 110mm', 'm', 19239.93, 9877.04, 30),
  ('Instalación Sanitaria', 'Cloacas, pluviales y ventilaciones', 'Embudo PVC', 'u', 30242.72, 32918.49, 31),
  ('Instalación Sanitaria', 'Cloacas, pluviales y ventilaciones', 'Pileta de patio abierta PVC', 'u', 48930.69, 25508.84, 32),
  ('Instalación de Gas', 'Artefactos', 'Calefactor GN 2000 cal', 'u', 292212.40, 90694.68, 1),
  ('Instalación de Gas', 'Artefactos', 'Calefactor GN 3000 cal', 'u', 324680.44, 95468.08, 2),
  ('Instalación de Gas', 'Artefactos', 'Calefón GN 12 l', 'u', 317900.80, 97652.21, 3),
  ('Instalación de Gas', 'Artefactos', 'Calefón GN 14 l', 'u', 354141.50, 98756.95, 4),
  ('Instalación de Gas', 'Artefactos', 'Cocina GN 4H, H y P', 'u', 353187.79, 101379.39, 5),
  ('Instalación de Gas', 'Artefactos', 'Termotanque GN 60 l', 'u', 430755.59, 100932.13, 6),
  ('Instalación de Gas', 'Artefactos', 'Termotanque GN 110 l', 'u', 758193.42, 102124.83, 7),
  ('Instalación de Gas', 'Cañerías y accesorios', 'Cañería epoxi Ø 13mm', 'm', 7885.25, 12076.07, 8),
  ('Instalación de Gas', 'Cañerías y accesorios', 'Cañería epoxi Ø 19mm', 'm', 9637.53, 13716.04, 9),
  ('Instalación de Gas', 'Cañerías y accesorios', 'Cañería epoxi Ø 25mm', 'm', 11389.80, 15370.91, 10),
  ('Instalación de Gas', 'Cañerías y accesorios', 'Cañería epoxi Ø 50mm', 'm', 13142.08, 17264.31, 11),
  ('Instalación de Gas', 'Cañerías y accesorios', 'Llave de paso Ø 13mm', 'u', 20395.76, 14737.28, 12),
  ('Instalación de Gas', 'Cañerías y accesorios', 'Llave de paso Ø 19mm', 'u', 26106.58, 17316.31, 13),
  ('Equipamiento', null, 'Amob. fijo: bajo mesada y alacena (incl. mesada granito)', 'm²', 1321138.78, 237760.02, 1),
  ('Equipamiento', null, 'Amob. fijo: bajo mesada y alacena (no incl. mesada)', 'm²', 557520.57, 191777.23, 2),
  ('Equipamiento', null, 'Amob. fijo: puertas de placares', 'm²', 187216.67, 69194.42, 3),
  ('Equipamiento', null, 'Amob. fijo: puertas e interiores de placares', 'm²', 281667.48, 83718.33, 4),
  ('Equipamiento', null, 'Matafuegos ABC 5kg', 'u', 220856.77, 23440.11, 5),
  ('Equipamiento', null, 'Matafuegos ABC 10kg', 'u', 421571.41, 25001.22, 6),
  ('Varios', null, 'Ayuda de gremio', 'm²', 0.00, 7801.74, 1),
  ('Varios', null, 'Conductos de ventilación, incl. sombrerete y reja', 'm', 34275.81, 140294.17, 2),
  ('Varios', null, 'Limpieza periódica y final de obra', 'm²', 3343.19, 15241.65, 3),
  ('Varios', null, 'Parquización (césped)', 'm²', 5907.44, 9000.89, 4)
;

update tareas set fuente = 'Revista Cifras #367';

-- ============================== El cómputo ==================================

-- Uno por obra. Lleva el mes de los precios: es el punto de partida del
-- ajuste por CAC.
create table computos (
  obra_id      uuid primary key references obras(id) on delete cascade,
  -- Siempre el día 1: el CAC es mensual.
  mes_precios  date not null default date_trunc('month', current_date)::date
               check (extract(day from mes_precios) = 1),
  observaciones text,
  creado_en    timestamptz not null default now()
);

comment on column computos.mes_precios is
  'El mes al que corresponden los precios unitarios del cómputo. Contra él se ajusta por CAC.';

create table computo_items (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid not null references computos(obra_id) on delete cascade,
  rubro_id          uuid not null references rubros(id) on delete restrict,
  -- Null en una tarea propia de la obra, que no está en el catálogo.
  tarea_id          uuid references tareas(id) on delete set null,
  -- Nombre, unidad y precios son copia: el cómputo no cambia si cambia el
  -- catálogo.
  subrubro          text,
  nombre            text not null,
  unidad            text not null,
  cantidad          numeric(14, 3) not null default 0 check (cantidad >= 0),
  precio_materiales numeric(14, 2) not null default 0 check (precio_materiales >= 0),
  precio_mano_obra  numeric(14, 2) not null default 0 check (precio_mano_obra >= 0),
  orden             integer not null default 0,
  creado_en         timestamptz not null default now()
);

create index on computo_items (obra_id, rubro_id);
-- Una tarea del catálogo entra una sola vez por obra.
create unique index computo_items_tarea_unica
  on computo_items (obra_id, tarea_id) where tarea_id is not null;

-- El rubro tiene que ser de la misma obra.
create or replace function chequear_computo_item_coherente()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from rubros where id = new.rubro_id and obra_id = new.obra_id
  ) then
    raise exception 'El rubro no pertenece a esta obra.';
  end if;

  return new;
end;
$$;

create trigger computo_items_coherentes
  before insert or update of obra_id, rubro_id on computo_items
  for each row execute function chequear_computo_item_coherente();

-- ================================ CAC ======================================
-- Un valor por mes, común a todas las obras. Se carga a mano cuando sale el
-- índice: es un número por mes y no vale la pena depender de que la página de
-- la Cámara no cambie.

create table indices_cac (
  mes       date primary key check (extract(day from mes) = 1),
  valor     numeric(14, 2) not null check (valor > 0),
  creado_en timestamptz not null default now()
);

comment on table indices_cac is
  'Índice del costo de la construcción (CAC), general, uno por mes. El mes va como su día 1.';

-- ================================= RLS ======================================
-- Mismo criterio que el resto: se lee lo de las obras que se ven, y escribe el
-- administrador. Los catálogos (tareas, CAC) los lee cualquiera con sesión.

alter table tareas enable row level security;
alter table computos enable row level security;
alter table computo_items enable row level security;
alter table indices_cac enable row level security;

create policy tareas_select on tareas for select to authenticated using (true);
create policy tareas_admin on tareas for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy computos_select on computos for select to authenticated
  using (puede_ver_obra(obra_id));
create policy computos_admin on computos for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy computo_items_select on computo_items for select to authenticated
  using (puede_ver_obra(obra_id));
create policy computo_items_admin on computo_items for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy indices_cac_select on indices_cac for select to authenticated using (true);
create policy indices_cac_admin on indices_cac for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

-- ====================== Obras nuevas: el rubro entero =======================
-- La plantilla ahora dice qué se cotiza en cada rubro (el movimiento de tierra
-- no lleva materiales). La obra nueva lo hereda, en vez de arrancar con todo
-- en verdadero.

create or replace function sembrar_rubros_de_obra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into rubros (
    nombre, orden, obra_id, activo,
    usa_materiales, usa_mano_obra, usa_mano_obra_y_materiales
  )
  select
    nombre, orden, new.id, false,
    usa_materiales, usa_mano_obra, usa_mano_obra_y_materiales
  from rubros
  where obra_id is null;

  return new;
end;
$$;
