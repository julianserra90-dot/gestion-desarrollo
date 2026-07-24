-- ===========================================================================
-- Documentos: dos ejes de clasificación y varios archivos por documento
-- ===========================================================================
--
-- `categoria` era texto libre y mezclaba dos preguntas distintas. "Arquitectura,
-- Estructura, Instalaciones" dicen de QUÉ PARTE de la obra habla el papel —o
-- sea, un rubro—, mientras que "Contratos, Permisos, Presupuestos" dicen PARA
-- QUÉ SIRVE. Juntas en un mismo campo, ninguna de las dos se podía filtrar.
--
-- Acá se separan:
--
--   ámbito → Obra | Proyecto | Administrativa
--   rubro  → el catálogo de la obra; sólo en Obra y Proyecto
--   título → etiqueta libre; sólo en Administrativa
--
-- Lo administrativo no lleva rubro a propósito: un seguro, un aviso de obra o
-- un plano municipal no son de albañilería ni de estructura. En su lugar lleva
-- un título que el usuario escribe, y que después se le ofrece como sugerencia.
--
-- Además un documento pasa a tener varios archivos: el mismo plano en PDF y en
-- DWG es un documento con dos adjuntos, no dos documentos sueltos.

-- -------- 1. Los ejes nuevos -----------------------------------------------

alter table documentos
  add column ambito      text,
  add column rubro_id    uuid references rubros(id) on delete restrict,
  add column titulo      text,
  add column reemplaza_a uuid references documentos(id) on delete set null;

-- Lo ya cargado: si la categoría coincide con un rubro de esa misma obra, era
-- documentación de proyecto y se la engancha a ese rubro.
update documentos d
   set ambito   = 'Proyecto',
       rubro_id = r.id
  from rubros r
 where r.obra_id = d.obra_id
   and lower(trim(r.nombre)) = lower(trim(d.categoria));

-- El resto pasa a administrativa conservando el texto como título, así no se
-- pierde nada de lo que ya estaba clasificado a mano.
update documentos
   set ambito = 'Administrativa',
       titulo = coalesce(nullif(trim(categoria), ''), 'Sin clasificar')
 where ambito is null;

alter table documentos
  alter column ambito set not null,
  add constraint documentos_ambito_check
    check (ambito in ('Obra', 'Proyecto', 'Administrativa')),
  -- Los dos ejes son excluyentes: o va por rubro, o va por título.
  add constraint documentos_clasificacion_check check (
    (ambito in ('Obra', 'Proyecto') and rubro_id is not null and titulo is null)
    or
    (ambito = 'Administrativa' and rubro_id is null and titulo is not null)
  );

create index on documentos (obra_id, ambito);
create index on documentos (rubro_id);

alter table documentos drop column categoria;

-- -------- 2. Los archivos del documento ------------------------------------

create table documento_archivos (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references documentos(id) on delete cascade,
  drive_file_id text not null,
  -- Con extensión, tal como se subió: es el nombre con el que se descarga.
  nombre        text not null,
  -- El formato, sacado de la extensión: PDF, DWG, XLS.
  tipo          text,
  mime_type     text,
  tamano        bigint,
  creado_en     timestamptz not null default now()
);

create index on documento_archivos (documento_id);
create index on documento_archivos (drive_file_id);

-- El archivo único que hoy cuelga de cada documento pasa a ser el primero de
-- su lista. El nombre visible del documento no traía extensión, así que se le
-- agrega desde el tipo para que baje con el programa correcto.
insert into documento_archivos (documento_id, drive_file_id, nombre, tipo, mime_type, tamano)
select id,
       drive_file_id,
       case
         when tipo is not null and lower(nombre) not like '%.' || lower(tipo)
           then nombre || '.' || lower(tipo)
         else nombre
       end,
       tipo,
       mime_type,
       tamano
  from documentos
 where drive_file_id is not null;

alter table documentos
  drop column drive_file_id,
  drop column mime_type,
  drop column tamano,
  drop column tipo;

-- -------- 3. Versiones: la nueva desplaza a la anterior ---------------------
--
-- Al subir una versión se elige de qué documento es continuación, y la anterior
-- pasa a Obsoleto sola. Dos versiones "Vigentes" del mismo plano conviviendo es
-- justo lo que hace que alguien termine construyendo con el plano viejo.
--
-- Corre con los permisos de quien inserta, no elevados: hoy sólo el admin puede
-- cargar documentos, así que el update siempre pasa el RLS.

create or replace function marcar_version_anterior_obsoleta()
returns trigger language plpgsql as $$
begin
  if new.reemplaza_a is not null then
    update documentos
       set estado = 'Obsoleto'
     where id = new.reemplaza_a
       and estado <> 'Obsoleto';
  end if;

  return new;
end;
$$;

create trigger documentos_versionado
  after insert on documentos
  for each row execute function marcar_version_anterior_obsoleta();

-- -------- 4. Permisos ------------------------------------------------------

alter table documento_archivos enable row level security;

-- Se ven los archivos de los documentos de las obras que uno puede ver.
create policy documento_archivos_select on documento_archivos for select to authenticated
  using (exists (
    select 1
      from documentos d
     where d.id = documento_archivos.documento_id
       and puede_ver_obra(d.obra_id)
  ));

create policy documento_archivos_admin on documento_archivos for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
