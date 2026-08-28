-- ============================================================================
-- Imagen de portada de la obra.
--
-- Se muestra en el listado de obras, todas con la misma proporción (16:9):
-- así se reconoce cada obra de un vistazo y las tarjetas quedan parejas entre
-- sí, tenga o no imagen cada una.
--
-- El recorte se hace en el navegador al cargarla (el usuario elige qué parte
-- se ve) y lo que se sube a Drive ya es la imagen recortada al tamaño final
-- (960x540): no hace falta guardar coordenadas de recorte ni recalcular nada
-- en cada lectura.
--
-- Mismas cuatro columnas que gastos/presupuestos/lote_pagos para su
-- comprobante: el archivo vive en Drive, acá sólo el id que devuelve más la
-- metadata para poder mostrarlo sin pedirle nada a Google.
-- ============================================================================

alter table obras
  add column imagen_drive_id text,
  add column imagen_nombre   text,
  add column imagen_mime     text,
  add column imagen_tamano   bigint;
