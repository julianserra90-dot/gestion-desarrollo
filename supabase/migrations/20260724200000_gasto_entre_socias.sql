-- ===========================================================================
-- Un gasto de obra puede ser de todas las socias, en partes iguales
-- ===========================================================================
--
-- Hasta acá un gasto lo adelantaba una socia, o lo cubría el dinero en cuenta.
-- Pero hay gastos que las socias ponen juntas en el momento —una compra grande
-- que pagan mitad y mitad— y cargarlos como dos gastos parte en dos el mismo
-- comprobante y duplica el detalle.
--
-- Es la misma idea que el pago compartido del lote: `compartido` = true
-- reemplaza a `empresa_pagadora_id` (que queda null), y el balance le acredita
-- a cada socia la misma parte de lo que salió de los bolsillos.
--
-- Qué NO cambia: el gasto se sigue repartiendo por el porcentaje de
-- participación. Con socias 50/50, ponerlo en partes iguales deja los saldos
-- quietos; con 60/40 la del 40 queda poniendo de más y aparece en la
-- liquidación. Eso es lo correcto: puso más de lo que le tocaba.

alter table gastos
  add column compartido boolean not null default false;

comment on column gastos.compartido is
  'true = lo pusieron todas las socias en partes iguales (empresa_pagadora_id va null).';

-- ========================= Quién se hace cargo =============================
-- El constraint daba por sentado que, si la cuenta no cubría todo, había una
-- empresa pagadora. Ahora también puede ser que lo pongan todas.

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
  -- Lo que la cuenta no cubre lo pone alguien: una socia, o todas.
  and (empresa_pagadora_id is not null
       or compartido
       or caja_ars + caja_usd * coalesce(cotizacion, 0) >= monto - 0.01)
  -- "Entre las socias" no tiene una pagadora: es de todas. Un ajuste de saldo
  -- exige pagadora más arriba, así que por esto mismo nunca puede ser
  -- compartido.
  and (not compartido or empresa_pagadora_id is null)
);

-- ================================ Balance ==================================
-- La vista mantiene exactamente las mismas columnas, así que se reemplaza en
-- vez de borrarse y recrearse. Lo único distinto es `pagado`: además de lo que
-- adelantó cada socia por su cuenta, ahora suma su parte de los gastos que
-- pusieron todas.

create or replace view obra_balance
with (security_invoker = on) as
select
  s.obra_id,
  s.empresa_id,
  e.nombre                                                    as empresa,
  s.porcentaje,
  coalesce(t.total, 0)                                        as total_obra,
  -- Lo que pusieron inversores y compradores no lo reparten las socias.
  coalesce(f.terceros, 0)                                     as fondos_terceros,
  greatest(coalesce(t.total, 0) - coalesce(f.terceros, 0), 0) as total_a_repartir,
  round(greatest(coalesce(t.total, 0) - coalesce(f.terceros, 0), 0)
        * s.porcentaje / 100, 2)                              as le_corresponde,
  coalesce(p.pagado, 0) + coalesce(c.pagado, 0)
    + coalesce(ap.aportes, 0) + coalesce(aj.neto, 0)          as pagado,
  coalesce(p.pagado, 0) + coalesce(c.pagado, 0)
    + coalesce(ap.aportes, 0) + coalesce(aj.neto, 0)
    - round(greatest(coalesce(t.total, 0) - coalesce(f.terceros, 0), 0)
            * s.porcentaje / 100, 2)                          as saldo,
  coalesce(p.pagado_facturado, 0) + coalesce(c.pagado_facturado, 0) as pagado_facturado,
  coalesce(p.pagado_efectivo, 0) + coalesce(c.pagado_efectivo, 0)   as pagado_efectivo,
  coalesce(aj.neto, 0)                                        as ajustes,
  coalesce(ap.aportes, 0)                                     as aportes
from obra_socios s
join empresas e on e.id = s.empresa_id
left join lateral (
  select sum(monto) as total
  from gastos g
  where g.obra_id = s.obra_id
    and g.estado <> 'Anulado'
    and g.tipo_gasto <> 'Ajuste de saldo'
) t on true
left join lateral (
  -- Lo que puso de su bolsillo: el gasto menos la parte que salió de la cuenta.
  select
    sum(monto - monto_caja)                                        as pagado,
    sum(monto - monto_caja) filter (where tipo_pago = 'Facturado')  as pagado_facturado,
    sum(monto - monto_caja) filter (where tipo_pago = 'Efectivo')   as pagado_efectivo
  from gastos g
  where g.obra_id = s.obra_id
    and g.empresa_pagadora_id = s.empresa_id
    and g.estado <> 'Anulado'
    and g.tipo_gasto <> 'Ajuste de saldo'
) p on true
left join lateral (
  -- Entre cuántas se divide un gasto compartido. Nunca da cero: la fila de la
  -- que estamos calculando ya es una socia de esta obra.
  select count(*) as socias
  from obra_socios os
  where os.obra_id = s.obra_id
) n on true
left join lateral (
  -- Los gastos que pusieron todas: a cada socia le toca la misma parte, sin
  -- mirar su porcentaje. Se divide lo que salió de los bolsillos, igual que en
  -- un gasto de una sola socia.
  select
    round(sum(monto - monto_caja) / n.socias, 2)              as pagado,
    round(sum(monto - monto_caja)
          filter (where tipo_pago = 'Facturado') / n.socias, 2) as pagado_facturado,
    round(sum(monto - monto_caja)
          filter (where tipo_pago = 'Efectivo') / n.socias, 2)  as pagado_efectivo
  from gastos g
  where g.obra_id = s.obra_id
    and g.compartido
    and g.estado <> 'Anulado'
    and g.tipo_gasto <> 'Ajuste de saldo'
) c on true
left join lateral (
  -- Lo que metió en la cuenta cuenta como aporte suyo, por el valor en pesos
  -- que tenía el día que entró.
  select sum(monto) as aportes
  from ingresos i
  where i.obra_id = s.obra_id
    and i.origen = 'Empresa socia'
    and i.empresa_id = s.empresa_id
) ap on true
left join lateral (
  select sum(monto) as terceros
  from ingresos i
  where i.obra_id = s.obra_id
    and i.origen <> 'Empresa socia'
) f on true
left join lateral (
  -- Lo que transfirió menos lo que recibió.
  select
    coalesce(sum(monto) filter (where empresa_pagadora_id = s.empresa_id), 0)
    - coalesce(sum(monto) filter (where empresa_receptora_id = s.empresa_id), 0) as neto
  from gastos g
  where g.obra_id = s.obra_id
    and g.estado <> 'Anulado'
    and g.tipo_gasto = 'Ajuste de saldo'
) aj on true;
