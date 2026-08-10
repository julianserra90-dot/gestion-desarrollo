-- ===========================================================================
-- Superficies desglosadas: cubierta, semicubierta, descubierta
-- ===========================================================================
--
-- Antes había un solo `superficie_m2` (lo construido). No alcanza: una obra tiene
-- superficie cubierta, semicubierta (galerías, balcones techados) y descubierta
-- (patios, terrazas), y cada una pesa distinto. La semicubierta se suele contar
-- al 50% para lo vendible; la descubierta, a un coeficiente menor o a nada.
--
-- Con el desglose salen dos superficies, que se calculan, no se guardan:
--   - de construcción = cubierta + semicubierta + descubierta (todo lo que se
--     levanta, al 100%): manda para el costo de construir.
--   - de venta = cubierta + semicubierta×coef + descubierta×coef (ponderada):
--     manda para el negocio (valor del m² vendible, incidencia del lote).
--
-- El coeficiente es elegible por obra: la semicubierta al 50% o al 100%, la
-- descubierta 0 / 25 / 50%. Por eso van como columnas y no como constante.

alter table obras
  add column sup_cubierta_m2     numeric(10, 2)
    check (sup_cubierta_m2 is null or sup_cubierta_m2 >= 0),
  add column sup_semicubierta_m2 numeric(10, 2)
    check (sup_semicubierta_m2 is null or sup_semicubierta_m2 >= 0),
  add column sup_descubierta_m2  numeric(10, 2)
    check (sup_descubierta_m2 is null or sup_descubierta_m2 >= 0),
  add column coef_semicubierta   numeric(4, 2) not null default 0.5
    check (coef_semicubierta >= 0 and coef_semicubierta <= 1),
  add column coef_descubierta    numeric(4, 2) not null default 0
    check (coef_descubierta >= 0 and coef_descubierta <= 1);

-- Lo que había en superficie_m2 era lo construido: pasa a cubierta, que es la
-- parte que siempre cuenta al 100%. Así las obras cargadas no cambian sus
-- números (construcción y venta siguen dando lo mismo hasta que se desglosen).
update obras
   set sup_cubierta_m2 = superficie_m2
 where superficie_m2 is not null;

alter table obras drop column superficie_m2;

comment on column obras.sup_cubierta_m2 is
  'Superficie cubierta (cerrada y techada). Cuenta al 100% en ambas superficies.';
comment on column obras.coef_semicubierta is
  'Cuánto pondera la semicubierta en la superficie de venta: 0.5 o 1.';
comment on column obras.coef_descubierta is
  'Cuánto pondera la descubierta en la superficie de venta: 0, 0.25 o 0.5.';
