-- ============================================================================
-- Archivado de obras + protección contra borrados con datos adentro.
--
-- Archivar es la acción normal: la obra sale del listado pero no se pierde
-- nada y se puede recuperar. El borrado real queda sólo para obras vacías,
-- o sea las que se crearon por error.
-- ============================================================================

alter table obras add column archivada_en timestamptz;

comment on column obras.archivada_en is
  'Null = obra activa. Con fecha = archivada, no aparece en el listado.';

create index on obras (archivada_en) where archivada_en is null;

-- Guardia a nivel base: aunque alguien llame al delete por fuera de la app,
-- una obra con gastos, avances, fotos o documentos no se puede borrar.
create or replace function impedir_borrar_obra_con_datos()
returns trigger
language plpgsql
as $$
declare
  v_gastos  int;
  v_avances int;
  v_fotos   int;
  v_docs    int;
begin
  select count(*) into v_gastos  from gastos         where obra_id = old.id;
  select count(*) into v_avances from avances        where obra_id = old.id;
  select count(*) into v_fotos   from foto_registros where obra_id = old.id;
  select count(*) into v_docs    from documentos     where obra_id = old.id;

  if v_gastos + v_avances + v_fotos + v_docs > 0 then
    raise exception
      'La obra tiene datos cargados (% gastos, % avances, % registros de fotos, % documentos). Archivala en vez de borrarla.',
      v_gastos, v_avances, v_fotos, v_docs
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

create trigger obras_no_borrar_con_datos
  before delete on obras
  for each row execute function impedir_borrar_obra_con_datos();
