-- ===========================================================================
-- La superficie de venta es un dato propio, no se deriva de la construcción
-- ===========================================================================
--
-- La superficie de venta (la neta, vendible de las unidades) no sale de ponderar
-- la construcción: son cosas distintas. Un depto puede venderse como 35 m² y
-- tener 36 de construcción, porque la construcción cuenta los espesores de los
-- muros y la venta es la superficie neta. No hay coeficiente que las relacione:
-- la de venta se carga a mano, del cómputo.
--
-- Así que la venta pasa a ser una columna directa. El desglose
-- (cubierta/semicubierta/descubierta + coeficientes) queda para la superficie
-- de CONSTRUCCIÓN: ahí el coeficiente sí sirve, para elegir cómo contemplar la
-- semicubierta y la descubierta en lo construido.

alter table obras
  add column sup_venta_m2 numeric(10, 2)
    check (sup_venta_m2 is null or sup_venta_m2 >= 0);

comment on column obras.sup_venta_m2 is
  'Superficie de venta (neta, vendible). Se carga a mano; no se deriva de la construcción.';

-- Los coeficientes ahora ponderan la construcción, no la venta.
comment on column obras.coef_semicubierta is
  'Cuánto pondera la semicubierta en la superficie de construcción: 0.5 o 1.';
comment on column obras.coef_descubierta is
  'Cuánto pondera la descubierta en la superficie de construcción: 0, 0.25 o 0.5.';
