-- ===========================================================================
-- Edificios de referencia: la base gráfica de resoluciones reales
-- ===========================================================================
--
-- El motor de tipologías deduce plantas por reglas, y las reglas se equivocan
-- donde la arquitectura decide de otra manera: cómo se entra a las unidades,
-- dónde va el núcleo, cuántas unidades saca un lote de 8,66. Esta tabla es
-- la base para corregirlo: edificios construidos en CABA, con el lote, las
-- unidades y el enlace a las plantas publicadas. Vino de la planilla del
-- usuario (58 edificios, 24/09/2026) y se va cargando: los campos de
-- resolución nacen vacíos y se completan mirando las plantas de cada uno.
--
-- La ficha de un estudio muestra los comparables: los edificios de frente
-- parecido y fondo parecido, con cuántas unidades sacaron, para contrastar
-- lo que dicen las reglas con lo que se construyó.

create table edificios_referencia (
  id                    uuid primary key default gen_random_uuid(),
  estudio               text not null,
  barrio                text,
  direccion             text not null,
  frente_m              numeric(6, 2) check (frente_m > 0),
  fondo_m               numeric(6, 2) check (fondo_m > 0),
  esquina               boolean not null default false,
  frente_a_parque       boolean not null default false,
  superficie_lote_m2    numeric(10, 2),
  unidades_funcionales  integer check (unidades_funcionales >= 0),
  link                  text,
  -- La etiqueta de la planilla: VER (construido, con plantas publicadas) o
  -- NUEVO (en obra o sin publicar).
  etiqueta              text,

  -- La resolución, a completar mirando las plantas.
  plantas_sobre_pb      integer,
  unidades_por_planta   integer,
  nucleo                text,
  ascensor              boolean,
  ingreso               text,
  patios                text,
  tipologias            text,
  cocheras              integer,
  local_pb              boolean,
  notas                 text,
  analizado_en          timestamptz,

  creado_en             timestamptz not null default now()
);

comment on column edificios_referencia.nucleo is
  'Dónde está y cómo es: "contra medianera, al medio del lote, escalera + ascensor", por ejemplo.';
comment on column edificios_referencia.ingreso is
  'Cómo se entra: "pasillo lateral de 1,20 m hasta el núcleo", "hall al frente", etc.';
comment on column edificios_referencia.patios is
  'Cuántos y dónde: "uno junto al núcleo y otro entre la unidad del medio y la del fondo".';
comment on column edificios_referencia.tipologias is
  'Qué unidades tiene: "monoambientes al frente, 2 dormitorios pasante al fondo".';

create index on edificios_referencia (frente_m, fondo_m);

alter table edificios_referencia enable row level security;

-- Misma regla que los estudios: herramienta interna del administrador.
create policy edificios_referencia_admin on edificios_referencia for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

insert into edificios_referencia
  (estudio, barrio, direccion, frente_m, fondo_m, esquina, frente_a_parque, superficie_lote_m2, unidades_funcionales, link, etiqueta)
values
  ('A3 Luppi Ugalde Winter', 'Coghlan', 'Pedraza, Manuela 3352', 8.87, 44, false, false, 381.5, 8, 'https://www.archdaily.cl/cl/917110/departamento-pedraza-a3-luppi-ugalde-winter', 'VER'),
  ('Adamo Faiden', 'Palermo', 'Bonpland 2169', 7.88, 22.21, false, false, 172, 13, 'https://www.archdaily.cl/cl/909428/edificio-bonpland-adamo-faiden', 'VER'),
  ('Adamo Faiden', 'Colegiales', 'Martinez, Enrique, Gral. 205', 16, 34, true, false, 639.6, 11, 'https://www.archdaily.cl/cl/918518/la-vecindad-plaza-mafalda-adamo-faiden', 'VER'),
  ('Adamo Faiden', 'Nuñez', 'Arribeños 3182', 8.60, 26, false, false, 225.8, 8, 'https://www.dezeen.com/2008/04/14/arribenos-3182-by-adamo-faiden/', 'VER'),
  ('Adamo Faiden', 'Saavedra', 'Conesa 4560', 8.40, 43.60, false, false, 432.2, 12, 'https://www.archdaily.cl/cl/626329/edificio-conesa-4560-adamo-faiden', 'VER'),
  ('Adamo Faiden', 'Floresta', 'Moron 3939', 8.50, 49, false, false, 361.3, 2, 'https://adamo-faiden.com/index.php/projects/data/af-casas-lago', 'VER'),
  ('Adamo Faiden', 'Nuñez', '11 De Septiembre De 1888 3260', 8.66, 41, false, false, 359.7, 6, 'https://adamo-faiden.com/index.php/projects/data/af-edificio-11-de-septiembre-3260', 'VER'),
  ('Adamo Faiden', 'Almagro', 'Treinta Y Tres Orientales 138', 8.40, 17.90, false, false, 148.2, 8, 'https://divisare.com/projects/328087-adamo-faiden-cristobal-palma-estudio-palma-33-orientales-138', 'VER'),
  ('Alonso Crippa', 'Saavedra', 'Superi 3226', 8.68, 19.54, false, false, 179.1, 6, 'https://www.archdaily.cl/cl/964184/viviendas-superi-3226-alonso-and-crippa', 'VER'),
  ('AMEDIDA estudio', 'Saavedra', 'Ramallo 3212', 8.59, 26.15, false, false, 226.7, 7, 'https://arqa.com/arquitectura/ramallo-3212.html', 'VER'),
  ('Ana Smud', 'Belgrano', 'Sucre 812', 17.25, 21.93, false, false, 456.2, null, 'https://www.archdaily.cl/cl/958172/edificio-de-viviendas-sucre-812-ana-smud-plus-alberto-smud', 'VER'),
  ('Ana Smud', 'Palermo', 'Russel 5058', 9, 25, false, false, 195.8, 7, 'https://www.archdaily.cl/cl/02-288094/edificio-de-viviendas-agrupadas-ana-smud-estudio-rietti-smud', 'VER'),
  ('Ana Smud', 'Colegiales', 'Martinez, Enrique, Gral. 747', 8.66, 38, false, false, 393.8, null, null, 'NUEVO'),
  ('Ana Smud', 'Colegiales', 'Conde 1113', 8.10, 52, false, false, 318.3, 6, 'https://www.archdaily.cl/cl/981262/edificio-conde-1113-rietti-schraier-zelcer', 'VER'),
  ('Arqtipo', 'Villa Urquiza', 'Monroe 5609', 9.62, 13.49, true, false, 115.7, 11, 'https://www.archdaily.cl/cl/995909/edificio-de-vivienda-m-5605-arqtipo', 'VER'),
  ('Arqtipo', 'Parque Chas', 'Andonaegui 1251', 8.10, 41, false, false, 330.8, null, 'https://arqtipo.com.ar/project/a-1251/', 'VER'),
  ('Arqtipo', 'Saavedra', 'Melian Av. 3646', 8.63, 27.20, false, false, 238.7, null, 'https://arqtipo.com.ar/project/m-3646/', 'VER'),
  ('ATV', 'Palermo', 'Nicaragua 5949', 31.26, 26.13, false, false, 1191.10, 30, 'https://www.archdaily.cl/cl/952222/sens-nicaragua-atv-arquitectos', 'VER'),
  ('ATV', 'Palermo', 'Ravignani, Emilio, Dr. 2170', 10, 36, false, false, 359.1, 19, 'https://www.archdaily.cl/cl/772990/ravignani-2170-atv-arquitectos', 'VER'),
  ('ATV', 'Palermo', 'Paraguay 5565', 21, 20, false, false, 477.2, 27, 'https://www.atvarquitectos.com/sens/paraguay', 'VER'),
  ('Baag', 'Villa Crespo', 'Araoz 967', 8.59, 38, false, false, 325.1, 17, 'https://www.archdaily.cl/cl/917103/araoz-967-baag', 'VER'),
  ('Baag', 'Nuñez', 'Juana Azurduy 1635', 8.69, 43, false, false, 369.6, 11, 'https://www.archdaily.cl/cl/893882/edificio-juana-azurduy-1635-baag', 'VER'),
  ('Baag', 'Villa Urquiza', 'Rivera, Pedro I., Dr. 5740', 8.20, 40, false, false, 474.1, null, 'https://baag.com.ar/producciones/es/47/rivera-5740', 'VER'),
  ('Baag', 'Villa Crespo', 'Malabia 1117', 8.59, 22.50, false, false, 195.2, null, 'https://baag.com.ar/producciones/es/46/malabia-1117', 'VER'),
  ('BAS + Oszurkiewicz', 'Chacarita', 'Garcia, Teodoro 3726', 9.02, 31.75, false, false, 299.9, 13, 'https://www.archdaily.cl/cl/1022639/edificio-teodoro-garcia-bas-plus-oszurkiewicz', 'VER'),
  ('Cottet Iachetti Arquitectos', 'Chacarita', 'Fraga 297', 7, 12, true, false, 140.4, 4, 'https://www.archdaily.cl/cl/989077/edificio-fraga-297-cottet-iachetti-arquitectos', 'VER'),
  ('Cottet Iachetti Arquitectos', 'Colegiales', 'Zapiola 301', 10.29, 38, false, true, 311, 10, 'https://www.archdaily.cl/cl/989128/edificio-zapiola-301-cottet-iachetti-arquitectos-plus-cabrera-pieretti-arquitectos', 'VER'),
  ('Cottet Iachetti Arquitectos', 'Chacarita', 'Santos Dumont 3756', 17.35, 48, false, false, 813.5, null, null, 'VER'),
  ('Cubero Rubio', 'Belgrano', 'Mendoza 3268', 12.53, 50, false, false, 634.6, 22, 'https://www.archdaily.cl/cl/871632/edificio-mz3268-cubero-rubio', 'VER'),
  ('Diego Cherbenco + Gustavo Robinsohn', 'Villa Urquiza', 'Quesada 3153', 8.70, 33.92, false, false, 294.8, 16, 'https://www.archdaily.cl/cl/979722/edificio-quesada-3155-diego-cherbenco-plus-gustavo-robinsohn', 'VER'),
  ('Dieguez Fridman', 'Palermo', 'Dorrego 1711', 9.50, 40, false, false, 373, 29, 'https://www.archdaily.cl/cl/880978/edificio-dorrego-1711-dieguez-fridman', 'VER'),
  ('Esteban Tannenbaum', 'Villa Urquiza', 'Sucre, Antonio Jose De, Mcal. 4444', 17.47, 42, false, false, 723.6, 16, 'https://afasiaarchzine.com/2014/08/18-esteban-tannenbau/', 'VER'),
  ('Estudio BaBO', 'Colegiales', 'Zabala 3259', 8.50, 30, false, false, 261.1, 8, 'https://www.archdaily.cl/cl/801818/edificio-zla-estudio-babo', 'VER'),
  ('Estudio Carlos Cottet', 'Palermo', 'Fitz Roy 2350', 8.43, 26, false, false, 226.4, 10, 'https://www.archdaily.cl/cl/02-359025/edificio-fitz-roy-estudio-carlos-cottet', 'VER'),
  ('Estudio NDG + Lautaro Malnatti', 'Villa Urquiza', 'Donado 2325', 8.50, 27.12, false, false, 274.6, 8, 'https://www.archdaily.cl/cl/922096/edificio-donado-2325-estudio-ndg-plus-lautaro-malnatti', 'VER'),
  ('Grupo Uno en Uno', 'Villa Urquiza', 'Holmberg 2770', 39, 55, true, false, 2401.7, 166, 'https://www.archdaily.cl/cl/929514/edificio-casa-ho-grupo-uno-en-uno', 'VER'),
  ('Hermanos Goldenberg', 'Villa Crespo', 'Darwin 1111', 19.52, 20.25, true, false, 388.6, null, 'https://www.archdaily.cl/cl/993429/edificio-darwin-1111-hermanos-goldenberg', 'VER'),
  ('IR arquitectura', 'Saavedra', 'Quintana 4598', 8.98, 20, false, false, 181.8, 12, 'https://www.archdaily.cl/cl/757265/quintana-4598-intile-and-rogers-arquitectura', 'VER'),
  ('IR arquitectura', 'Saavedra', 'Zapiola 3625', 11.87, 8.65, false, false, 101.7, 4, 'https://arqa.com/arquitectura/zapiola.html', 'VER'),
  ('Israel & Teper Arquitectos', 'Nuñez', 'Nuñez 1633', 17.33, 43.42, false, false, 751.2, null, 'https://www.archdaily.cl/cl/1010661/edificio-arrive-nunez-israel-and-teper-arquitectos', 'VER'),
  ('Joaquín Moscato, Ramiro Schere', 'Nuñez', 'Madriguera 4512', 8.90, 17.30, false, false, 152.9, 4, 'https://www.archdaily.cl/cl/02-187221/vuelta-de-obligado-ms-todo-terreno', 'VER'),
  ('Jonathan Tyszberowicz', 'Villa Crespo', 'Acevedo 661', 8.65, 39.06, false, false, 336.5, 11, 'https://www.archdaily.cl/cl/892651/edificio-acevedo-663-jonathan-tyszberowicz', 'VER'),
  ('Jonathan Tyszberowicz + Diego Cherbenco', 'Palermo', 'Cnel. Niceto Vega 5924', 8.65, 29, false, false, 247.6, 16, 'https://www.archdaily.cl/cl/627594/niceto-vega-5924-jonathan-tyszberowicz-diego-cherbenco', 'VER'),
  ('Junta Arquitectas', 'Parque Chas', 'Andonaegui 1247', 8.07, 41, false, false, 330.5, null, 'https://www.juntaarquitectas.com/andonaegui', 'VER'),
  ('KLM Arquitectos', 'Nuñez', 'Ibera 1937', 17.14, 38, false, false, 662, 10, 'https://www.archdaily.cl/cl/911091/ibera-1937-klm-arquitectos', 'VER'),
  ('La Base Studio', 'Caballito', 'Franklin 684', 8.81, 10.03, false, false, 70.4, 7, 'http://archdaily.cl/cl/967712/edificio-franklin-684-tovo-sarmiento-arquitectos', 'VER'),
  ('Moarqs', 'Saavedra', 'Donado 4432', 8.67, 33.05, false, false, 290, 11, 'https://www.archdaily.cl/cl/954898/edificio-donado-4432-moarqs', 'VER'),
  ('MoGS', 'Colegiales', 'Jorge Newbery 3136', 8.59, 33, false, false, 299, 6, 'https://www.archdaily.cl/cl/1000347/edificio-jorge-newbery-3136-mogs', 'VER'),
  ('MoGS', 'Coghlan', 'Pedraza 3871', 8.66, 26, false, false, 222.3, 8, 'https://www.archdaily.cl/cl/802641/manuela-pedraza-3871-mogs', 'VER'),
  ('MoGS', 'Palermo', 'Bonpland 1548', 8.60, 42.6, false, false, 367.8, 9, 'https://afasiaarchzine.com/2021/04/mogs/', 'VER'),
  ('MONOBLOCK', 'Villa Urquiza', 'Acha, Mariano, Gral. 1973', 8.68, 27, false, false, 240.7, 7, 'https://www.archdaily.cl/cl/781411/edificio-de-viviendas-acha-monoblock', 'VER'),
  ('MONOBLOCK', 'Villa Crespo', 'Jufré 478', 7.73, 35, false, false, 272, 6, 'https://www.archdaily.cl/cl/781212/edificio-de-viviendas-jufre-monoblock', 'VER'),
  ('Palca Estudio', 'Balvanera', 'Moreno 2681', 7.59, 47.85, false, false, 352.1, null, 'https://afasiaarchzine.com/2023/12/palca-estudio-moreno-2681-buenos-aires/', 'VER'),
  ('Palca Estudio', 'Villa Crespo', 'Virasoro, Valentin 1925', 8.66, 21, false, false, 183.5, null, null, 'NUEVO'),
  ('Panorama Estudio, Ariel Glot, Pedro Sardin', 'Nuñez', 'Besares 1731', 8.66, 19, false, false, 170.6, 8, 'https://arqa.com/arquitectura/besares-1731.html', 'VER'),
  ('Planta', 'Nuñez', 'Rivadavia Martin, Comodoro 1752', 8.23, 42, false, false, 373.2, 8, 'https://www.archdaily.cl/cl/933543/edificio-commodore-planta', 'VER'),
  ('Sposito Campanini', 'Belgrano', 'Virrey Aviles 3462', 8.67, 17.37, false, false, 160.1, 6, 'https://www.archdaily.cl/cl/1019411/edificio-en-la-calle-virrey-aviles-juan-campanini-josefina-sposito', 'VER'),
  ('Alonso Crippa', 'Villa Urquiza', 'Donado 2469', 8.83, 19.50, false, false, 172, 7, null, null);

-- Las tres primeras resoluciones, leídas de las plantas publicadas el
-- 24/09/2026. Son las que corrigieron el motor: pasillo lateral de ingreso,
-- núcleo contra la medianera pegado a un patio central, dos monoambientes
-- al frente desde 8,5 m.

update edificios_referencia set
  plantas_sobre_pb = 4,
  unidades_por_planta = 3,
  nucleo = 'Contra la medianera, en la banda del medio (a unos 14 m del frente): escalera de dos tramos y ascensor, con el palier abriendo a tres puertas.',
  ascensor = true,
  ingreso = 'Pasillo lateral pegado a la medianera desde la calle hasta el núcleo; en PB la unidad del frente cede ese ancho.',
  patios = 'Patio central de unos 4 × 4 m pegado al núcleo, que ilumina el fondo de los monoambientes y la cocina de la unidad de atrás; jardín en el fondo de la PB.',
  tipologias = 'Dos monoambientes al frente, lado a lado (unos 4,1 m de ancho cada uno, con balcón), y un dos ambientes grande al contrafrente con terraza al pulmón.',
  cocheras = 0,
  local_pb = false,
  notas = 'Tres por planta en 8,67 m: el frente partido en dos monoambientes y el contrafrente entero. Tanques y sala de máquinas junto al núcleo en PB.',
  analizado_en = now()
where direccion = 'Donado 4432';

update edificios_referencia set
  plantas_sobre_pb = 4,
  unidades_por_planta = 2,
  nucleo = 'Contra la medianera, en el tercio del frente (a unos 6 m de la calle): escalera de dos tramos y ascensor, pegados al patio central.',
  ascensor = true,
  ingreso = 'Hall al frente, corto, porque el núcleo está cerca de la calle; la PB es cocheras.',
  patios = 'Patio central de casi todo el ancho y unos 5 m de fondo entre la unidad del frente y la del contrafrente; las dos ventilan a él.',
  tipologias = 'Un dormitorio al frente con balcón y dos dormitorios al contrafrente con terraza; dormitorios en las puntas, baños y cocina contra el patio.',
  cocheras = 6,
  local_pb = false,
  notas = 'Seis cocheras en PB en dos filas de tres con pasillo central, en 8,5 m de frente: 2,5 + 3,5 + 2,5. Ocho unidades: dos por planta por cuatro plantas.',
  analizado_en = now()
where direccion = 'Zabala 3259';

update edificios_referencia set
  plantas_sobre_pb = 3,
  unidades_por_planta = 2,
  nucleo = 'Contra la medianera izquierda, en la banda del medio: escalera y ascensor, con el patio central al lado.',
  ascensor = true,
  ingreso = 'Pasillo lateral pegado a la medianera derecha desde la calle hasta el núcleo.',
  patios = 'Patio central de unos 4,5 × 4 m entre las dos unidades, plantado; jardín en el fondo de la PB.',
  tipologias = 'Dos dormitorios al frente y dos dormitorios al contrafrente: dormitorios de unos 4 m de ancho lado a lado en las puntas, baños y cocina hacia el patio.',
  cocheras = 0,
  local_pb = false,
  notas = 'Unidades grandes: seis en total, dos por planta por tres plantas. Terraza con parrillas.',
  analizado_en = now()
where direccion = 'Jorge Newbery 3136';
