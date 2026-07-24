-- ===========================================================================
-- Los datos del proyecto: dónde está, cuántas unidades y cuántos pisos
-- ===========================================================================
--
-- `ubicacion` guarda la localidad ("Chivilcoy, Buenos Aires"), que es lo que se
-- muestra en el listado de obras. El domicilio —calle y altura— es otra cosa:
-- hace falta para un aviso de obra o un plano municipal, y no tiene por qué
-- ensuciar el nombre corto que se lee de un vistazo.
--
-- Los pisos se guardan como número sobre planta baja: un "PB + 5" son 5. Podría
-- ser texto libre y aceptar cualquier forma de escribirlo, pero entonces no se
-- podrían comparar dos obras ni ordenar por tamaño. La planta baja se da por
-- descontada y se escribe al mostrarlo.
--
-- Las unidades funcionales abren la puerta a mirar la obra por unidad y no sólo
-- por metro: superficie sobre unidades da el tamaño promedio de cada una.

alter table obras
  add column domicilio            text,
  add column unidades_funcionales int
    check (unidades_funcionales is null or unidades_funcionales > 0),
  add column pisos                int
    check (pisos is null or pisos >= 0);

comment on column obras.domicilio is
  'Calle y altura. La localidad va en ubicacion.';

comment on column obras.pisos is
  'Pisos sobre planta baja: un "PB + 5" se guarda como 5.';
