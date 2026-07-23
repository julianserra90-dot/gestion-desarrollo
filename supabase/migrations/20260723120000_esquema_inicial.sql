-- ============================================================================
-- Gestión de desarrollo — esquema inicial
--
-- Modelo: una obra tiene N empresas socias (2, 3, 4...) con un porcentaje de
-- participación cada una. Los gastos se cargan por el 100% indicando quién
-- pagó, y el reparto sale de obra_socios.porcentaje (no está cableado al 50%).
--
-- Usuarios: sólo admin (desarrollador) y empresas. No hay jefes de obra ni
-- coordinadores con login; lo que ellos aportan lo carga el admin.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================== Catálogos ===================================

create table empresas (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  creado_en timestamptz not null default now()
);

create table rubros (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden  int  not null default 0
);

-- =============================== Usuarios ===================================
-- Una fila por usuario de Supabase Auth.
-- rol = 'admin'   -> ve y edita todo, empresa_id null
-- rol = 'empresa' -> ve sólo las obras donde su empresa es socia

create table perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null default 'empresa' check (rol in ('admin', 'empresa')),
  empresa_id uuid references empresas(id) on delete restrict,
  creado_en  timestamptz not null default now(),
  constraint perfil_coherente check (
    (rol = 'admin' and empresa_id is null) or
    (rol = 'empresa' and empresa_id is not null)
  )
);

create index on perfiles (empresa_id);

-- ================================ Obras =====================================

create table obras (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  nombre             text not null,
  ubicacion          text,
  estado             text not null default 'Proyecto'
                     check (estado in ('Proyecto', 'En ejecución', 'Pausada', 'Finalizada')),
  fecha_inicio       date,
  fecha_fin_estimada date,
  -- Presupuesto declarado. El "total gastado" NO se guarda: se deriva de gastos.
  presupuesto        numeric(14, 2),
  creado_en          timestamptz not null default now()
);

create table obra_socios (
  obra_id    uuid not null references obras(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete restrict,
  porcentaje numeric(5, 2) not null check (porcentaje > 0 and porcentaje <= 100),
  primary key (obra_id, empresa_id)
);

create index on obra_socios (empresa_id);

-- Los porcentajes de cada obra tienen que sumar 100.
-- Es un constraint trigger diferido para poder insertar los socios de a uno
-- dentro de una misma transacción.
create or replace function chequear_porcentajes_obra()
returns trigger
language plpgsql
as $$
declare
  v_obra  uuid := coalesce(new.obra_id, old.obra_id);
  v_total numeric;
begin
  select coalesce(sum(porcentaje), 0) into v_total
  from obra_socios where obra_id = v_obra;

  if v_total <> 0 and v_total <> 100 then
    raise exception 'Los porcentajes de la obra % suman %, deben sumar 100', v_obra, v_total;
  end if;

  return null;
end;
$$;

create constraint trigger obra_socios_suman_100
  after insert or update or delete on obra_socios
  deferrable initially deferred
  for each row execute function chequear_porcentajes_obra();

-- La empresa que paga un gasto tiene que ser socia de esa obra.
create or replace function chequear_empresa_socia()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from obra_socios
    where obra_id = new.obra_id and empresa_id = new.empresa_pagadora_id
  ) then
    raise exception 'La empresa % no es socia de la obra %', new.empresa_pagadora_id, new.obra_id;
  end if;

  return new;
end;
$$;

-- ================================ Gastos ====================================

create table gastos (
  id                  uuid primary key default gen_random_uuid(),
  obra_id             uuid not null references obras(id) on delete cascade,
  fecha               date not null,
  rubro_id            uuid references rubros(id) on delete set null,
  concepto            text not null,
  proveedor           text,
  empresa_pagadora_id uuid not null references empresas(id) on delete restrict,
  monto               numeric(14, 2) not null check (monto >= 0),
  moneda              text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  estado              text not null default 'Pagado'
                      check (estado in ('Pagado', 'Pendiente', 'Observado', 'Anulado')),
  comprobante_path    text,
  observaciones       text,
  cargado_por         uuid references perfiles(id) on delete set null,
  creado_en           timestamptz not null default now()
);

create index on gastos (obra_id, fecha desc);
create index on gastos (obra_id, empresa_pagadora_id);

create trigger gastos_empresa_socia
  before insert or update of obra_id, empresa_pagadora_id on gastos
  for each row execute function chequear_empresa_socia();

-- =============================== Avances ====================================
-- Una fila por rubro por obra (es el estado actual, no el histórico).

create table avances (
  id                 uuid primary key default gen_random_uuid(),
  obra_id            uuid not null references obras(id) on delete cascade,
  rubro_id           uuid not null references rubros(id) on delete restrict,
  porcentaje         int  not null default 0 check (porcentaje between 0 and 100),
  estado             text not null default 'Sin iniciar'
                     check (estado in ('Sin iniciar', 'Replanteo', 'Inicial', 'En ejecución', 'Finalizado')),
  comentario         text,
  fecha              date not null default current_date,
  -- Quién lo reportó. El uuid apunta al usuario que lo cargó; el texto guarda
  -- el origen real cuando no es un usuario del sistema (ej: "Jefe de obra").
  actualizado_por    uuid references perfiles(id) on delete set null,
  actualizado_por_nombre text,
  actualizado_en     timestamptz not null default now(),
  unique (obra_id, rubro_id)
);

-- ================================ Fotos =====================================
-- foto_registros = el lote que se sube junto (fecha + rubro + descripción).
-- fotos          = cada archivo. La "cantidad" que muestra la UI es un count().

create table foto_registros (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid not null references obras(id) on delete cascade,
  rubro_id          uuid references rubros(id) on delete set null,
  fecha             date not null,
  descripcion       text,
  estado            text not null default 'Registrado'
                    check (estado in ('Registrado', 'Pendiente de revisión')),
  subido_por        uuid references perfiles(id) on delete set null,
  subido_por_nombre text,
  creado_en         timestamptz not null default now()
);

create index on foto_registros (obra_id, fecha desc);

create table fotos (
  id           uuid primary key default gen_random_uuid(),
  registro_id  uuid not null references foto_registros(id) on delete cascade,
  storage_path text not null,
  orden        int  not null default 0,
  creado_en    timestamptz not null default now()
);

create index on fotos (registro_id);

-- ============================== Documentos ==================================

create table documentos (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid not null references obras(id) on delete cascade,
  nombre            text not null,
  tipo              text,
  categoria         text,
  version           text default 'V01',
  estado            text not null default 'Vigente'
                    check (estado in ('Vigente', 'En revisión', 'Obsoleto')),
  fecha             date not null default current_date,
  -- Nullable a propósito: permite migrar la ficha del documento antes de
  -- tener el archivo cargado en Storage.
  storage_path      text,
  subido_por        uuid references perfiles(id) on delete set null,
  subido_por_nombre text,
  creado_en         timestamptz not null default now()
);

create index on documentos (obra_id, fecha desc);

-- =========================== Vistas derivadas ===============================
-- security_invoker = on es obligatorio: sin eso la vista corre con los
-- permisos del owner y saltea el RLS de las tablas de abajo.

-- Saldo por empresa. La suma de saldos de una obra siempre da 0.
-- saldo > 0 -> puso de más y le deben.  saldo < 0 -> debe compensar.
create view obra_balance
with (security_invoker = on) as
select
  s.obra_id,
  s.empresa_id,
  e.nombre                                                   as empresa,
  s.porcentaje,
  coalesce(t.total, 0)                                       as total_obra,
  round(coalesce(t.total, 0) * s.porcentaje / 100, 2)        as le_corresponde,
  coalesce(p.pagado, 0)                                      as pagado,
  coalesce(p.pagado, 0)
    - round(coalesce(t.total, 0) * s.porcentaje / 100, 2)    as saldo
from obra_socios s
join empresas e on e.id = s.empresa_id
left join lateral (
  select sum(monto) as total
  from gastos g
  where g.obra_id = s.obra_id and g.estado <> 'Anulado'
) t on true
left join lateral (
  select sum(monto) as pagado
  from gastos g
  where g.obra_id = s.obra_id
    and g.empresa_pagadora_id = s.empresa_id
    and g.estado <> 'Anulado'
) p on true;

-- KPIs de cabecera de cada obra.
create view obra_resumen
with (security_invoker = on) as
select
  o.id                                as obra_id,
  o.slug,
  o.nombre,
  o.presupuesto,
  coalesce(g.total_gastado, 0)        as total_gastado,
  coalesce(a.avance_fisico, 0)        as avance_fisico,
  case when o.presupuesto > 0
       then round(coalesce(g.total_gastado, 0) * 100 / o.presupuesto)
       else 0 end                     as avance_financiero,
  coalesce(s.cant_socios, 0)          as cant_socios,
  coalesce(f.cant_fotos, 0)           as cant_fotos,
  coalesce(d.cant_documentos, 0)      as cant_documentos
from obras o
left join lateral (
  select sum(monto) as total_gastado
  from gastos where obra_id = o.id and estado <> 'Anulado'
) g on true
left join lateral (
  -- avg() sobre cero filas devuelve null, no NaN: la obra sin avances da 0.
  select round(avg(porcentaje)) as avance_fisico
  from avances where obra_id = o.id
) a on true
left join lateral (
  select count(*) as cant_socios from obra_socios where obra_id = o.id
) s on true
left join lateral (
  select count(*) as cant_fotos
  from fotos f join foto_registros r on r.id = f.registro_id
  where r.obra_id = o.id
) f on true
left join lateral (
  select count(*) as cant_documentos from documentos where obra_id = o.id
) d on true;

-- ============================ Helpers de RLS ================================
-- security definer para que no haya recursión al consultar perfiles desde
-- una policy sobre perfiles.

create or replace function auth_es_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function auth_empresa_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select empresa_id from perfiles where id = auth.uid();
$$;

create or replace function puede_ver_obra(p_obra uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select auth_es_admin() or exists (
    select 1 from obra_socios
    where obra_id = p_obra and empresa_id = auth_empresa_id()
  );
$$;

-- ================================= RLS ======================================
-- Regla general: el admin hace todo; la empresa LEE sólo las obras donde es
-- socia y no escribe nada.
--
-- Si más adelante querés que cada empresa cargue sus propios gastos, se
-- agrega una policy de insert sobre gastos y listo; el resto no cambia.

alter table empresas       enable row level security;
alter table rubros         enable row level security;
alter table perfiles       enable row level security;
alter table obras          enable row level security;
alter table obra_socios    enable row level security;
alter table gastos         enable row level security;
alter table avances        enable row level security;
alter table foto_registros enable row level security;
alter table fotos          enable row level security;
alter table documentos     enable row level security;

-- Catálogos: lectura para cualquier usuario logueado, escritura sólo admin.
create policy empresas_select on empresas for select to authenticated using (true);
create policy empresas_admin  on empresas for all    to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy rubros_select on rubros for select to authenticated using (true);
create policy rubros_admin  on rubros for all    to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

-- Perfiles: cada uno ve el suyo, el admin ve todos.
create policy perfiles_select on perfiles for select to authenticated
  using (id = auth.uid() or auth_es_admin());
create policy perfiles_admin  on perfiles for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

-- Obras y todo lo que cuelga de una obra.
create policy obras_select on obras for select to authenticated using (puede_ver_obra(id));
create policy obras_admin  on obras for all    to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy obra_socios_select on obra_socios for select to authenticated
  using (puede_ver_obra(obra_id));
create policy obra_socios_admin  on obra_socios for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy gastos_select on gastos for select to authenticated using (puede_ver_obra(obra_id));
create policy gastos_admin  on gastos for all    to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy avances_select on avances for select to authenticated using (puede_ver_obra(obra_id));
create policy avances_admin  on avances for all    to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy foto_registros_select on foto_registros for select to authenticated
  using (puede_ver_obra(obra_id));
create policy foto_registros_admin  on foto_registros for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy fotos_select on fotos for select to authenticated
  using (exists (
    select 1 from foto_registros r
    where r.id = fotos.registro_id and puede_ver_obra(r.obra_id)
  ));
create policy fotos_admin on fotos for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

create policy documentos_select on documentos for select to authenticated
  using (puede_ver_obra(obra_id));
create policy documentos_admin  on documentos for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());

-- =============================== Storage ====================================
-- Buckets privados. Se accede siempre por signed URL desde el server.
-- Convención de path: obras/<obra_id>/<lo que sea>

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false),
       ('fotos',      'fotos',      false)
on conflict (id) do nothing;

create policy storage_select on storage.objects for select to authenticated
  using (
    bucket_id in ('documentos', 'fotos')
    and (storage.foldername(name))[1] = 'obras'
    and puede_ver_obra(((storage.foldername(name))[2])::uuid)
  );

create policy storage_admin on storage.objects for all to authenticated
  using (bucket_id in ('documentos', 'fotos') and auth_es_admin())
  with check (bucket_id in ('documentos', 'fotos') and auth_es_admin());
