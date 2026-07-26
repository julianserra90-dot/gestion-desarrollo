-- ============================================================================
-- IVA y crédito fiscal, según el tipo de factura.
--
-- El monto de un gasto es el TOTAL de la factura, con el IVA adentro. Lo que se
-- puede recuperar como crédito fiscal depende del tipo de comprobante:
--
--   * Factura A -> discrimina IVA. El comprador lo computa como crédito fiscal.
--   * Factura B -> el IVA está incluido pero no se discrimina; no da crédito.
--   * Factura C -> emitida por monotributista, no lleva IVA.
--   * Sin factura (efectivo) -> no hay IVA.
--
-- Como el monto es el total, el IVA se saca hacia atrás: si la alícuota es 21%,
-- el neto es total / 1,21 y el IVA es la diferencia. No es el 21% del total
-- —ese sería el 21% del neto—, sino lo que quedó adentro.
--
-- Sólo la factura A discrimina IVA, así que `iva` da 0 para todo lo demás y el
-- crédito fiscal de la obra es la suma de esta columna.
-- ============================================================================

alter table gastos
  add column tipo_factura text check (tipo_factura in ('A', 'B', 'C')),
  add column alicuota_iva numeric(5, 2)
    check (alicuota_iva is null or alicuota_iva > 0);

comment on column gastos.tipo_factura is
  'A, B o C. Null cuando el gasto no tiene factura (efectivo).';
comment on column gastos.alicuota_iva is
  'Alícuota de la factura A, en porcentaje (21 o 10,5). Null si no es A.';

-- Efectivo no lleva factura; la alícuota sólo tiene sentido en la A.
alter table gastos add constraint gastos_factura_coherente check (
  (tipo_pago <> 'Efectivo' or tipo_factura is null)
  and (alicuota_iva is null or tipo_factura = 'A')
);

-- El IVA computable como crédito fiscal. Columna generada: se recalcula sola al
-- cambiar el monto o la alícuota, y es lo único que hay que sumar para el
-- crédito de la obra.
alter table gastos add column iva numeric(14, 2)
  generated always as (
    case when tipo_factura = 'A'
      then round(monto - monto / (1 + coalesce(alicuota_iva, 21) / 100), 2)
      else 0
    end
  ) stored;

comment on column gastos.iva is
  'IVA discriminado, computable como crédito fiscal. Sólo la factura A lo tiene; el resto da 0.';
