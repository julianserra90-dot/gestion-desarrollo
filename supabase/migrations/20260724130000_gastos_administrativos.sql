-- Gastos administrativos de la obra: impuestos del terreno (ABL), honorarios de
-- agrimensor, gastos municipales. No se compran ni se contratan como los otros,
-- así que son un cuarto tipo de gasto y se le pagan a una categoría propia de
-- proveedor —"Varios"— para no mezclarlos con proveedores ni contratistas.

alter table gastos drop constraint gastos_tipo_gasto_check;
alter table gastos add constraint gastos_tipo_gasto_check
  check (tipo_gasto in ('Materiales', 'Mano de obra', 'Administrativo', 'Ajuste de saldo'));

alter table proveedores drop constraint proveedores_tipo_check;
alter table proveedores add constraint proveedores_tipo_check
  check (tipo in ('Proveedor', 'Contratista', 'Varios'));

-- El rubro donde caen los gastos administrativos: ABL, honorarios de agrimensor,
-- tasas municipales. Entra al catálogo como uno más y llega a cada obra inactivo
-- —se marca sólo donde haga falta—. No lleva mano de obra ni se cotiza: un
-- impuesto se paga, no se contrata ni se presupuesta. Se le deja usa_materiales
-- en true sólo porque el rubro necesita al menos un tipo (rubros_algun_tipo);
-- lo que de verdad se le carga son gastos Administrativos, que no miran ese flag.

insert into rubros (nombre, orden, obra_id, activo, usa_materiales, usa_mano_obra)
values ('Impuestos', 35, null, true, true, false);

insert into rubros (nombre, orden, obra_id, activo, usa_materiales, usa_mano_obra)
select 'Impuestos', 35, o.id, false, true, false
from obras o
where not exists (
  select 1 from rubros r
  where r.obra_id = o.id and lower(r.nombre) = 'impuestos'
);
