-- ============================================================================
-- Reemplaza de una sola vez los socios de una obra.
--
-- Por qué hace falta: cambiar los socios es borrar los viejos e insertar los
-- nuevos. Desde la app eso serían dos requests separados, o sea dos
-- transacciones, y entre una y otra la obra queda sin ninguna empresa socia.
-- Si el segundo request falla, queda rota.
--
-- Adentro de esta función las dos operaciones van en la misma transacción, y
-- el trigger que exige que los porcentajes sumen 100 se evalúa recién al
-- final. O cambia todo, o no cambia nada.
-- ============================================================================

create or replace function set_obra_socios(p_obra uuid, p_socios jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not auth_es_admin() then
    raise exception 'Sólo un admin puede modificar los socios de una obra.';
  end if;

  delete from obra_socios where obra_id = p_obra;

  insert into obra_socios (obra_id, empresa_id, porcentaje)
  select
    p_obra,
    (item ->> 'empresa_id')::uuid,
    (item ->> 'porcentaje')::numeric
  from jsonb_array_elements(p_socios) as item;
end;
$$;
