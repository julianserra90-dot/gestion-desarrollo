-- ============================================================================
-- Reparte entre los dos lados lo que ya estaba pagado con la cuenta.
--
-- El problema: la migración anterior dio por sentado que todo lo que había
-- salido de la cuenta eran pesos, porque hasta ese momento la cuenta era un
-- único saldo en pesos. Pero un aporte en dólares gastado bajo el modelo viejo
-- queda mal repartido: el aporte se va al lado en dólares y lo gastado al lado
-- en pesos, así que la cuenta muestra los pesos en rojo y los dólares intactos,
-- cuando en realidad los dólares son los que se usaron.
--
-- Ejemplo real que lo destapó: un aporte de USD 5.000 (valuado en $7.426.725)
-- y un gasto que se pagó con esos $7.426.725 dejaban la cuenta en -$7.426.725
-- y US$ 5.000 a la vez.
--
-- La corrección: cada gasto toma primero de los pesos que había disponibles, y
-- lo que exceda salió en realidad de dólares, convertidos al cambio de ese
-- mismo gasto.
--
-- Sólo toca gastos que quedaron con caja_ars y sin caja_usd, que son los que
-- vienen del modelo viejo: los cargados con el formulario nuevo ya traen los
-- dos lados elegidos a mano.
-- ============================================================================

-- ------------------- Tolerancia de la conversión a dólares ------------------
--
-- Un monto en pesos no siempre se puede expresar exacto como dólares por
-- cotización: los dólares se guardan con dos decimales, así que el escalón
-- mínimo es un centavo de dólar, que hoy son unos quince pesos.
--
-- Convertir $6.000.000 al cambio 1485,345 da 4039,4655 dólares. Redondeando a
-- 4039,47 y multiplicando de vuelta salen $6.000.006,57: seis pesos más de lo
-- que costó el gasto. Por eso la conversión redondea siempre para abajo —la
-- cuenta nunca dice haber puesto de más— y el chequeo de "la cuenta lo cubrió
-- entero" admite ese centavo de dólar de diferencia.
--
-- Los gastos que se cargan por el formulario no pasan por acá: ahí el monto se
-- calcula sumando lo que sale de cada lado, así que da exacto por construcción.

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
  -- No se puede sacar de la cuenta más de lo que cuesta el gasto.
  and caja_ars + caja_usd * coalesce(cotizacion, 0) <= monto + 0.01
  -- O hay empresa pagadora, o la cuenta se hizo cargo de todo salvo el
  -- redondeo del centavo de dólar.
  and (empresa_pagadora_id is not null
       or caja_ars + caja_usd * coalesce(cotizacion, 0)
          >= monto - 0.01 - coalesce(cotizacion, 0) / 100)
);

-- ---------------------------- Reparto de lo viejo ---------------------------

do $$
declare
  v_obra    record;
  v_gasto   record;
  v_ars     numeric;  -- pesos que quedan disponibles al recorrer
  v_usd     numeric;  -- dólares que quedan disponibles al recorrer
  v_dePesos numeric;
  v_exceso  numeric;
  v_enUsd   numeric;
  v_cubre   numeric;
begin
  for v_obra in select id, nombre from obras loop
    select
      coalesce(sum(monto)     filter (where moneda <> 'USD'), 0),
      coalesce(sum(monto_usd) filter (where moneda =  'USD'), 0)
    into v_ars, v_usd
    from ingresos where obra_id = v_obra.id;

    -- En orden cronológico: el primer gasto se sirvió de lo que había primero.
    for v_gasto in
      select id, concepto, caja_ars, cotizacion, empresa_pagadora_id
      from gastos
      where obra_id = v_obra.id
        and estado <> 'Anulado'
        and caja_ars > 0
        and caja_usd = 0
      order by fecha, creado_en
    loop
      v_dePesos := least(v_gasto.caja_ars, greatest(v_ars, 0));
      v_exceso  := v_gasto.caja_ars - v_dePesos;

      if v_exceso > 0 then
        if coalesce(v_gasto.cotizacion, 0) <= 0 then
          raise exception
            'El gasto "%" de la obra "%" se pagó con la cuenta pero no tiene cotización, así que no se puede saber cuántos dólares salieron.',
            v_gasto.concepto, v_obra.nombre;
        end if;

        -- Para abajo: la cuenta nunca dice haber puesto más de lo que costó.
        v_enUsd := least(
          floor(v_exceso / v_gasto.cotizacion * 100) / 100,
          greatest(v_usd, 0)
        );

        v_cubre := v_dePesos + v_enUsd * v_gasto.cotizacion;

        -- Si ni juntando los dos lados alcanza, el dato viejo dice que se gastó
        -- plata que la obra no tenía. Frenar es mejor que inventar de dónde
        -- salió.
        if v_gasto.empresa_pagadora_id is null
           and v_cubre < v_gasto.caja_ars - v_gasto.cotizacion / 100 - 0.01 then
          raise exception
            'El gasto "%" de la obra "%" figura pagado con $% de la cuenta, pero entre pesos y dólares sólo hay $%. Revisá los ingresos de fondos de esa obra.',
            v_gasto.concepto, v_obra.nombre,
            trim(to_char(v_gasto.caja_ars, 'FM999G999G999G990D00')),
            trim(to_char(v_cubre, 'FM999G999G999G990D00'));
        end if;

        update gastos
           set caja_ars = v_dePesos,
               caja_usd = v_enUsd
         where id = v_gasto.id;

        v_usd := v_usd - v_enUsd;
      end if;

      v_ars := v_ars - v_dePesos;
    end loop;
  end loop;
end;
$$;
