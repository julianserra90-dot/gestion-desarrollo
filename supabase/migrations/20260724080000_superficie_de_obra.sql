-- ===========================================================================
-- La superficie de la obra, para poder mirar el valor del metro cuadrado
-- ===========================================================================
--
-- El presupuesto solo no deja comparar una obra con otra: dos millones pueden
-- ser caros o baratos según cuántos metros se levanten. Con la superficie
-- cargada, el valor del m² se calcula solo y sirve para tres cosas distintas:
--
--   estimado    presupuesto / m²            lo que se planeó pagar
--   gastado     gastado / m²                lo que se pagó hasta hoy
--   proyectado  (gastado / avance) / m²     lo que va a salir a este ritmo
--
-- El proyectado es el único comparable contra el estimado desde el día uno: el
-- gastado por m² siempre da bajo hasta que la obra termina.
--
-- Es un solo número a propósito. Abrirlo en cubierta y semicubierta es más
-- fiel, pero es otro campo que llenar y para el valor del m² alcanza con el
-- total. Si más adelante hace falta, se agrega.

alter table obras
  add column superficie_m2 numeric(10, 2)
    check (superficie_m2 is null or superficie_m2 > 0);
