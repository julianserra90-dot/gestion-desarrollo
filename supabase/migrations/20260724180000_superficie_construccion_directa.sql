-- ===========================================================================
-- Superficie de construcción también a mano: se saca el desglose
-- ===========================================================================
--
-- El desglose (cubierta / semicubierta / descubierta + coeficientes) era más
-- vueltas de las necesarias. En la práctica alcanza con cargar dos números a
-- mano: la superficie de construcción y la de venta. Con eso —más la superficie
-- del lote, que ya vive en el lote— salen la incidencia, el valor del m² de obra
-- y el de venta.
--
-- `sup_venta_m2` ya existía. Se agrega `sup_construccion_m2` y se migra lo que
-- había en el desglose (la construcción que se venía calculando), para no perder
-- lo cargado. Después se borran las columnas del desglose.

alter table obras
  add column sup_construccion_m2 numeric(10, 2)
    check (sup_construccion_m2 is null or sup_construccion_m2 >= 0);

-- Lo que la construcción venía dando del desglose pasa al campo directo.
update obras
   set sup_construccion_m2 = nullif(
     coalesce(sup_cubierta_m2, 0)
     + coalesce(sup_semicubierta_m2, 0) * coalesce(coef_semicubierta, 0.5)
     + coalesce(sup_descubierta_m2, 0) * coalesce(coef_descubierta, 0),
     0
   );

alter table obras
  drop column sup_cubierta_m2,
  drop column sup_semicubierta_m2,
  drop column sup_descubierta_m2,
  drop column coef_semicubierta,
  drop column coef_descubierta;

comment on column obras.sup_construccion_m2 is
  'Superficie de construcción, a mano. Con la de venta salen los valores por m².';
