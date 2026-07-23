-- ============================================================================
-- Campos para archivos alojados en el Drive de la aplicación.
--
-- Los archivos (fotos, planos, comprobantes) viven en Google Drive, no en
-- Supabase Storage. En la base sólo guardamos el id que devuelve Drive más
-- algo de metadata para poder listar sin pedirle nada a Google.
--
-- El id de Drive nunca se expone al browser: la descarga pasa siempre por una
-- ruta del servidor que primero verifica el permiso sobre la obra.
-- ============================================================================

-- -------- fotos: cada fila es una imagen subida a Drive --------------------
alter table fotos
  add column drive_file_id text,
  add column nombre        text,
  add column mime_type     text,
  add column tamano        bigint;

-- storage_path era obligatorio cuando el plan era Supabase Storage. Ahora los
-- archivos van a Drive, así que deja de ser obligatorio.
alter table fotos alter column storage_path drop not null;

-- -------- documentos: el archivo del documento -----------------------------
alter table documentos
  add column drive_file_id text,
  add column mime_type     text,
  add column tamano        bigint;

-- -------- gastos: el comprobante / factura ---------------------------------
alter table gastos
  add column comprobante_drive_id text,
  add column comprobante_nombre   text,
  add column comprobante_mime     text,
  add column comprobante_tamano   bigint;
