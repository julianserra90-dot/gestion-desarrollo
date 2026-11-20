-- La tarea muestra de dónde sale su cantidad
--
-- Hoy la cantidad de una tarea del cómputo —22,28 m³ de vigas— se escribe a
-- mano en la planilla y no queda escrito de dónde salió. Ese número es el
-- resultado de medir ciento treinta y dos vigas una por una, y esa medición
-- vive en un Excel aparte: no se puede revisar desde acá, no se sabe cuánto de
-- él es firme y cuánto estimado, y cada vez que cambia hay que acordarse de
-- volver a escribir el total en la planilla.
--
-- Es el mismo agujero que tenía el desglose antes de guardar el consumo, un
-- piso más arriba: se guardaba el resultado y se perdía la cuenta. Acá va la
-- cuenta.
--
-- Cada fila es **un elemento medido**: la viga V-201 de 0,12 x 0,45 x 4,49. La
-- cantidad de la tarea pasa a ser la suma de sus elementos.
--
-- Tres cosas que un cómputo de verdad necesita y la planilla sola no tiene:
--
--   `nivel`     Los elementos se piensan por piso —sobre planta baja, sobre
--               el 1.º— y así se revisan contra el plano. Es texto libre, como
--               las unidades: cada obra nombra sus niveles como quiere, y una
--               casa de dos plantas no tiene por qué elegir de una lista
--               pensada para una torre.
--
--   `estado`    Si la medida es firme, estimada, una hipótesis previa o está
--               pendiente. Un total de 103 m³ sin esta marca parece cerrado y
--               no lo está; con ella se ve qué falta verificar antes de salir
--               a cotizar.
--
--   `fuente`    De dónde salió: "dimensiones del replanteo, largo estimado del
--               cómputo anterior". A los seis meses es la diferencia entre
--               poder verificar un número y tener que medirlo de nuevo.
--
-- `forma` dice qué se multiplica, porque no todos los elementos se miden
-- igual y meterlos en la misma fórmula es lo que vuelve ilegible una planilla:
--
--   prisma      a x b x c x unidades.  Una viga: ancho, alto y largo.
--   superficie  b x c x unidades.      Una losa: espesor por el area del paño.
--   directo     c x unidades.          Una escalera: el volumen ya calculado
--                                      aparte, que no es una dimension.
--
-- `cantidad` se guarda calculada y no se recalcula al leer, al revés que el
-- consumo del desglose: el consumo depende del envase del material, que vive
-- en un catalogo compartido y puede cambiar por su cuenta, mientras que estas
-- medidas no dependen de nada de afuera. Se calcula al guardar, en el
-- servidor, y de ahi sale la cantidad de la tarea.
--
-- Una medida que falta deja el elemento en cero y no suma, en vez de contarlo
-- como nada medido: asi un pendiente se nota en el total en lugar de
-- disimularse.

create table computo_item_medicion (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references computo_items(id) on delete cascade,
  -- El piso al que pertenece el elemento. Null: la tarea no se mide por nivel.
  nivel       text,
  -- Como se llama en el plano: V-201, L3, C5A.
  etiqueta    text,
  forma       text not null default 'prisma'
              check (forma in ('prisma', 'superficie', 'directo')),
  -- Ancho o base, alto o espesor, largo o area. Cuales se usan lo dice `forma`.
  a           numeric(14, 6),
  b           numeric(14, 6),
  c           numeric(14, 6),
  unidades    numeric(14, 4) not null default 1 check (unidades > 0),
  -- El resultado de la forma. Cero cuando falta alguna medida.
  cantidad    numeric(14, 6) not null default 0 check (cantidad >= 0),
  estado      text not null default 'firme'
              check (estado in ('firme', 'estimado', 'hipotesis', 'pendiente')),
  fuente      text,
  orden       integer not null default 0,
  creado_en   timestamptz not null default now()
);

create index on computo_item_medicion (item_id);

comment on table computo_item_medicion is
  'Los elementos medidos de una tarea del computo: de donde sale su cantidad.';
comment on column computo_item_medicion.nivel is
  'El piso del elemento, texto libre (Sobre planta baja). Null si la tarea no se mide por nivel.';
comment on column computo_item_medicion.forma is
  'Que se multiplica: prisma (a*b*c), superficie (b*c) o directo (c), siempre por unidades.';
comment on column computo_item_medicion.cantidad is
  'El resultado de la forma, calculado al guardar. Cero cuando falta una medida.';
comment on column computo_item_medicion.estado is
  'Que tan firme es la medida: firme, estimado, hipotesis o pendiente.';

alter table computo_item_medicion enable row level security;

-- Las mismas que el desglose: ve quien ve la obra, escribe el administrador.
create policy computo_item_medicion_select on computo_item_medicion
  for select to authenticated
  using (exists (
    select 1 from computo_items i
    where i.id = computo_item_medicion.item_id and puede_ver_obra(i.obra_id)
  ));

create policy computo_item_medicion_admin on computo_item_medicion
  for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
