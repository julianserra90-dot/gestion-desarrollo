-- ============================================================================
-- Los cuatro roles: administrador, desarrollador, inversor y comprador.
--
-- 'empresa' pasa a llamarse 'desarrollador'. Es el mismo usuario —el de una
-- socia, que ve las obras donde su empresa es socia— con el nombre con el que
-- se lo piensa: el que desarrolla la obra. Por eso es un rename y no un rol
-- nuevo, y ninguna policy se toca: todas se apoyan en empresa_id, no en el
-- nombre del rol.
--
-- Inversor y comprador son nuevos y todavía no ven nada. No pertenecen a
-- ninguna empresa, y sin empresa puede_ver_obra() no matchea ninguna obra: uno
-- de ellos entra a la app y no encuentra nada. Es la falta segura mientras sus
-- pantallas no existan —la otra sería mostrarle la obra entera.
-- ============================================================================

-- El orden importa: mientras el check viejo (admin, empresa) esté puesto, el
-- update no pasa; y si el check nuevo se agrega antes del update, no pasa la
-- validación contra las filas que todavía dicen 'empresa'.
alter table perfiles drop constraint perfil_coherente;
alter table perfiles drop constraint if exists perfiles_rol_check;

update perfiles set rol = 'desarrollador' where rol = 'empresa';

alter table perfiles add constraint perfiles_rol_check check (
  rol in ('admin', 'desarrollador', 'inversor', 'comprador')
);

alter table perfiles alter column rol set default 'desarrollador';

-- Sólo un desarrollador pertenece a una empresa: el administrador las ve todas,
-- y el inversor y el comprador no son de ninguna. Un desarrollador sin empresa
-- sigue siendo el pendiente de asignación de siempre.
alter table perfiles add constraint perfil_coherente check (
  rol = 'desarrollador' or empresa_id is null
);

comment on column perfiles.empresa_id is
  'Sólo la lleva un desarrollador. Null en un desarrollador = pendiente de asignación, no ve ninguna obra.';

-- El perfil que se arma solo al crear un usuario: el primero es el
-- administrador; el resto entra como desarrollador pendiente, para que el
-- administrador le asigne empresa —o le cambie el rol— desde la app.
create or replace function public.crear_perfil_usuario()
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
  else
    insert into public.perfiles (id, nombre, rol, empresa_id)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), new.email),
      'desarrollador',
      null
    );
  end if;

  return new;
end;
$$;
