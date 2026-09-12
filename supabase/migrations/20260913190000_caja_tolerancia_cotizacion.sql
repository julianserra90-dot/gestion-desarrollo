-- ===========================================================================
-- El check de la cuenta tolera el redondeo de la cotización a cuatro decimales
-- ===========================================================================
--
-- Un gasto en pesos pagado con los dólares de la cuenta guarda el cambio
-- implícito (pesos ÷ dólares) para que el gasto quede exactamente en los pesos
-- del papel. Pero `cotizacion` es numeric(14, 4): el cambio se redondea, y
-- `caja_usd × cotizacion` se aparta de `monto` hasta medio diezmilésimo por
-- dólar. Con US$ 3.000 son 15 centavos, más que el centavo que toleraba el
-- check, y el gasto no se podía guardar.
--
-- La tolerancia pasa a ser proporcional a los dólares que salen: un
-- diezmilésimo por dólar, que es el error máximo del redondeo, más el centavo
-- de siempre. Todo lo demás del check queda igual.

alter table gastos drop constraint gastos_caja_coherente;

alter table gastos add constraint gastos_caja_coherente check (
  caja_ars >= 0
  and caja_usd >= 0
  -- Sacar dólares sin saber a cuánto se vendieron no se puede valuar.
  and (caja_usd = 0 or cotizacion is not null)
  -- Un ajuste de saldo mueve plata entre socias, no compra nada: no toca la
  -- cuenta y siempre tiene una empresa que transfiere.
  and (tipo_gasto <> 'Ajuste de saldo'
       or (caja_ars = 0 and caja_usd = 0 and empresa_pagadora_id is not null))
  -- No se puede sacar de la cuenta más de lo que cuesta el gasto, salvo el
  -- redondeo de la cotización.
  and caja_ars + caja_usd * coalesce(cotizacion, 0)
      <= monto + 0.01 + caja_usd * 0.0001
  -- Lo que la cuenta no cubre lo pone alguien: una socia, o todas.
  and (empresa_pagadora_id is not null
       or compartido
       or caja_ars + caja_usd * coalesce(cotizacion, 0)
          >= monto - 0.01 - caja_usd * 0.0001)
  -- "Entre las socias" no tiene una pagadora: es de todas.
  and (not compartido or empresa_pagadora_id is null)
);
