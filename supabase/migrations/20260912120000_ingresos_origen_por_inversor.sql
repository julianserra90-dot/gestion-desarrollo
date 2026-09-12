-- ===========================================================================
-- El constraint de origen de los ingresos no conocía a la agenda de inversores
-- ===========================================================================
--
-- Desde la agenda, un ingreso de inversor o comprador cuelga de su ficha
-- (`inversor_id`) y el nombre suelto (`aportante`) no se escribe más. Pero el
-- check `ingresos_origen_coherente` seguía pidiendo `aportante` para todo
-- origen distinto de socia, así que cargar cualquier aporte de inversor o
-- comprador fallaba con "violates check constraint".
--
-- La regla nueva dice lo mismo que antes, con la ficha en el lugar del nombre:
-- socia → empresa y sin ficha; inversor o comprador → ficha y sin empresa. Los
-- ingresos viejos que quedaron sólo con el nombre (sin ficha) siguen valiendo,
-- por eso se acepta cualquiera de los dos para los de atrás.

alter table ingresos drop constraint ingresos_origen_coherente;

alter table ingresos add constraint ingresos_origen_coherente check (
  (origen = 'Empresa socia'
     and empresa_id is not null
     and inversor_id is null
     and aportante is null)
  or
  (origen <> 'Empresa socia'
     and empresa_id is null
     and (inversor_id is not null or aportante is not null))
);
