-- ============================================================================
-- Usuarios pendientes de asignación.
--
-- Antes sólo se creaba perfil para el primer usuario (el admin). Cualquier otro
-- usuario creado desde el dashboard quedaba sin perfil, y sin perfil el RLS no
-- lo deja ver nada — sin forma de arreglarlo desde la app.
--
-- Ahora todo usuario nuevo recibe un perfil en estado "pendiente" (rol empresa,
-- sin empresa asignada). Un pendiente no ve ninguna obra: recién cuando el
-- admin le asigna la empresa empieza a ver las obras donde esa empresa es socia.
-- ============================================================================

-- empresa_id pasa a poder ser null: es el estado "pendiente de asignación".
alter table perfiles drop constraint perfil_coherente;
alter table perfiles add constraint perfil_coherente check (
  (rol = 'admin' and empresa_id is null) or rol = 'empresa'
);

comment on column perfiles.empresa_id is
  'Null en un rol empresa = usuario pendiente de asignación, no ve ninguna obra.';

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- El primero que se registra es el admin. El resto entra como empresa
  -- pendiente, para que el admin le asigne la suya desde la app.
  if not exists (select 1 from public.perfiles where rol = 'admin') then
    insert into public.perfiles (id, nombre, rol, empresa_id)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), new.email),
      'admin',
      null
    );
  else
    insert into public.perfiles (id, nombre, rol, empresa_id)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), new.email),
      'empresa',
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- auth_empresa_id() ya devuelve null para un pendiente, y puede_ver_obra()
-- compara contra null, así que un pendiente no matchea ninguna obra. No hace
-- falta tocar las policies de lectura.

-- Cada empresa puede cargar sus propios gastos en las obras donde es socia,
-- siempre a nombre de su propia empresa. El admin sigue pudiendo cargar
-- cualquiera (su policy es aparte).
create policy gastos_insert_empresa on gastos for insert to authenticated
  with check (
    empresa_pagadora_id = auth_empresa_id()
    and puede_ver_obra(obra_id)
  );
