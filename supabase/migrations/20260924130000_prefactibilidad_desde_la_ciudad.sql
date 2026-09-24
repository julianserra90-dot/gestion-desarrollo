-- ===========================================================================
-- Prefactibilidades: lo que trae la Ciudad, y desde dónde
-- ===========================================================================
--
-- La primera versión se cargaba entera a mano. La idea es la contraria: se
-- escribe la dirección y el resto lo contesta el Gobierno de la Ciudad —USIG
-- ubica la parcela, la API de Ciudad 3D da la ficha catastral y la normativa
-- del Código Urbanístico—. Los campos que ya existían siguen siendo los que
-- se leen y se calculan; ahora nacen con lo que dijo la Ciudad y se corrigen
-- a mano si la mensura dice otra cosa.
--
-- `ciudad` guarda las respuestas crudas de la consulta. Sirve para dos cosas:
-- saber qué valor trajo la Ciudad cuando el campo se corrigió (la ficha lo
-- dice al lado), y no depender de volver a consultar para leer lo que no
-- tiene columna propia (links al croquis, parcelas linderas, plusvalía).

alter table prefactibilidades
  add column direccion_normalizada    text,
  add column cod_calle                integer,
  add column lng                      double precision,
  add column lat                      double precision,
  add column comuna                   text,
  -- La huella construible que calcula la Ciudad para la parcela (LFI y LIB ya
  -- resueltas). Cuando está, manda sobre frente × profundidad hasta la LFI.
  add column sup_edificable_planta_m2 numeric(10, 2) check (sup_edificable_planta_m2 >= 0),
  add column fot                      numeric(6, 2)  check (fot >= 0),
  add column ciudad                   jsonb,
  add column consultado_en            timestamptz;

comment on column prefactibilidades.direccion_normalizada is
  'Como la escribe USIG ("ANDONAEGUI 1229, CABA"). `direccion` queda como la escribió el usuario.';
comment on column prefactibilidades.lng is
  'Centroide de la parcela según USIG (WGS84). Es el punto con el que se consultó a Ciudad 3D.';
comment on column prefactibilidades.sup_edificable_planta_m2 is
  'Superficie edificable en planta según Ciudad 3D. Reemplaza a frente × LFI en el cálculo cuando está cargada.';
comment on column prefactibilidades.fot is
  'FOT entre medianeras del distrito del Código de Planeamiento anterior, tal como lo informa Ciudad 3D. Informativo.';
comment on column prefactibilidades.ciudad is
  'Respuestas crudas de USIG y Ciudad 3D en la última consulta, con la fecha y los avisos. Ver lib/ciudad.ts.';
