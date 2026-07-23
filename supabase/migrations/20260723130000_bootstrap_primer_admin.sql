-- ============================================================================
-- Bootstrap del primer admin.
--
-- Problema: la policy de `perfiles` sólo deja insertar a un admin, y en una
-- base recién creada no hay ninguno. Sin esto, nadie puede entrar nunca.
--
-- Solución: el primer usuario que se registre queda como admin automáticamente.
-- Del segundo en adelante NO se crea perfil solo — se lo asigna el admin,
-- indicando a qué empresa pertenece. Un usuario sin perfil no ve nada, que es
-- el default seguro.
-- ============================================================================

create or replace function public.crear_perfil_primer_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.perfiles where rol = 'admin') then
    insert into public.perfiles (id, nombre, rol, empresa_id)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), new.email),
      'admin',
      null
    );
  end if;

  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_primer_admin();
