-- ============================================================================
-- El comprobante de un pago del lote.
--
-- Gastos y presupuestos ya llevan su propio comprobante; los pagos del lote
-- se quedaron afuera cuando se armó la tabla y no había cómo adjuntar la
-- factura de una comisión inmobiliaria o el recibo de una cuota.
--
-- Mismas cuatro columnas y mismo criterio: el archivo vive en Drive, acá sólo
-- el id que devuelve más la metadata para poder listar sin pedirle nada a
-- Google.
-- ============================================================================

alter table lote_pagos
  add column comprobante_drive_id text,
  add column comprobante_nombre   text,
  add column comprobante_mime     text,
  add column comprobante_tamano   bigint;
