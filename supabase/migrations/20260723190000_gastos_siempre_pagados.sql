-- ============================================================================
-- Un gasto se carga cuando ya se pagó.
--
-- Tener a la vez la columna "pagó <empresa>" y un estado "pendiente" era
-- contradictorio: si figura quién lo pagó, el gasto está pagado. El estado sale
-- del formulario y del listado.
--
-- La columna NO se elimina, por dos razones:
--   * "Anulado" sigue siendo útil: permite dar de baja un gasto sin borrarlo,
--     conservando el registro y sacándolo de los totales. En movimientos de
--     plata entre socios conviene anular antes que borrar.
--   * Si más adelante hiciera falta seguir gastos comprometidos pero no
--     pagados, alcanza con volver a mostrar el campo.
-- ============================================================================

update gastos set estado = 'Pagado' where estado in ('Pendiente', 'Observado');

comment on column gastos.estado is
  'Pagado por defecto: un gasto se carga cuando ya se pagó. Anulado lo excluye de los totales sin borrarlo.';
