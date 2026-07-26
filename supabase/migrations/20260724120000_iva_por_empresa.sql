-- ============================================================================
-- El crédito fiscal es de la empresa que figura en la factura.
--
-- El IVA de una factura A lo computa sólo la empresa cuyo CUIT está en el
-- comprobante. Casi siempre es la que pagó, pero no tiene por qué: un gasto se
-- puede pagar entero con el dinero en cuenta —sin empresa pagadora— y la
-- factura igual está a nombre de alguna socia.
--
-- Por eso el titular de la factura es un dato propio, separado de quién puso la
-- plata. En el formulario arranca en la pagadora, que es el caso normal.
-- ============================================================================

alter table gastos
  add column empresa_factura_id uuid references empresas(id) on delete restrict;

create index on gastos (empresa_factura_id);

comment on column gastos.empresa_factura_id is
  'La empresa cuyo CUIT está en la factura A: la que computa el crédito fiscal. Sólo en facturas A.';

-- El titular sólo tiene sentido en la factura A. En el resto no hay crédito que
-- atribuir.
alter table gastos add constraint gastos_factura_titular_coherente check (
  empresa_factura_id is null or tipo_factura = 'A'
);

-- Igual que la pagadora y la receptora, el titular tiene que ser socia de la
-- obra: un CUIT ajeno no puede figurar como socio del desarrollo.
create or replace function chequear_empresa_socia()
returns trigger
language plpgsql
as $$
begin
  if new.empresa_pagadora_id is not null and not exists (
    select 1 from obra_socios
    where obra_id = new.obra_id and empresa_id = new.empresa_pagadora_id
  ) then
    raise exception 'La empresa % no es socia de la obra %', new.empresa_pagadora_id, new.obra_id;
  end if;

  if new.empresa_receptora_id is not null and not exists (
    select 1 from obra_socios
    where obra_id = new.obra_id and empresa_id = new.empresa_receptora_id
  ) then
    raise exception 'La empresa receptora % no es socia de la obra %', new.empresa_receptora_id, new.obra_id;
  end if;

  if new.empresa_factura_id is not null and not exists (
    select 1 from obra_socios
    where obra_id = new.obra_id and empresa_id = new.empresa_factura_id
  ) then
    raise exception 'La empresa de la factura % no es socia de la obra %', new.empresa_factura_id, new.obra_id;
  end if;

  return new;
end;
$$;

drop trigger if exists gastos_empresa_socia on gastos;
create trigger gastos_empresa_socia
  before insert or update of obra_id, empresa_pagadora_id, empresa_receptora_id, empresa_factura_id on gastos
  for each row execute function chequear_empresa_socia();
