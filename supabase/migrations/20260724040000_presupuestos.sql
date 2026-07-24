-- ============================================================================
-- Presupuestos: las cotizaciones que se piden antes de contratar.
--
-- Cada rubro se cotiza por separado para mano de obra y para materiales: la
-- albañilería puede tener dos gremios cotizando la mano de obra y tres
-- corralones el material, y son decisiones distintas.
--
-- De cada combinación rubro + tipo se aprueba una sola cotización: la elegida.
-- Eso deja escrito con quién se va a trabajar y por cuánto, y a partir de ahí
-- los gastos de ese rubro se pueden comparar contra lo cotizado.
--
-- Aprobar no obliga a nada. Si aparece una compra de urgencia que nadie
-- cotizó, el gasto se carga igual eligiendo el proveedor a mano, como siempre.
-- El presupuesto es una referencia para ordenar la obra, no un candado.
--
-- Ojo con no confundirlo con `obras.presupuesto`: ese es el presupuesto
-- estimado, el que se calculó antes de arrancar. Las cotizaciones aprobadas
-- arman el presupuesto real, que se va completando a medida que la obra
-- avanza. Conviven a propósito.
-- ============================================================================

create table presupuestos (
  id           uuid primary key default gen_random_uuid(),
  obra_id      uuid not null references obras(id) on delete cascade,
  rubro_id     uuid not null references rubros(id) on delete restrict,

  -- Los mismos dos que en gastos, para que la comparación sea directa. Un
  -- ajuste de saldo no se cotiza, así que acá no existe.
  tipo         text not null check (tipo in ('Materiales', 'Mano de obra')),

  -- Quién cotiza. Materiales los cotiza un proveedor; la mano de obra, un
  -- contratista. La coherencia entre tipo y tipo de proveedor la controla el
  -- trigger de más abajo.
  proveedor_id uuid not null references proveedores(id) on delete restrict,

  fecha        date not null default current_date,
  -- Hasta cuándo el gremio sostiene el precio. Opcional: muchos no lo aclaran.
  validez_hasta date,

  -- Mismo criterio que gastos e ingresos: el monto se guarda siempre en pesos
  -- y aparte el equivalente en dólares al oficial de la fecha.
  monto        numeric(14, 2) not null check (monto > 0),
  moneda       text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  monto_usd    numeric(14, 2),
  cotizacion   numeric(14, 4) check (cotizacion is null or cotizacion > 0),

  estado       text not null default 'Pendiente'
               check (estado in ('Pendiente', 'Aprobado', 'Descartado')),

  detalle       text,
  observaciones text,

  comprobante_drive_id text,
  comprobante_nombre   text,
  comprobante_mime     text,
  comprobante_tamano   bigint,

  cargado_por uuid references perfiles(id) on delete set null,
  creado_en   timestamptz not null default now()
);

create index on presupuestos (obra_id, rubro_id);
create index on presupuestos (proveedor_id);

-- Una sola cotización aprobada por rubro y tipo: es la que se eligió. Las
-- demás quedan como pendientes o descartadas, para que se vea contra qué se
-- comparó.
create unique index presupuestos_una_aprobada
  on presupuestos (obra_id, rubro_id, tipo)
  where estado = 'Aprobado';

comment on table presupuestos is
  'Cotizaciones pedidas por rubro. La aprobada define con quién se trabaja y por cuánto.';
comment on column presupuestos.monto is
  'Siempre en pesos, sin importar en qué moneda se cotizó.';

-- El rubro tiene que ser de la misma obra, y quien cotiza tiene que ser del
-- tipo que corresponde: un corralón no cotiza mano de obra.
create or replace function chequear_presupuesto_coherente()
returns trigger
language plpgsql
as $$
declare
  v_tipo_proveedor text;
begin
  if not exists (
    select 1 from rubros where id = new.rubro_id and obra_id = new.obra_id
  ) then
    raise exception 'El rubro no pertenece a esta obra.';
  end if;

  select tipo into v_tipo_proveedor from proveedores where id = new.proveedor_id;

  if new.tipo = 'Mano de obra' and v_tipo_proveedor <> 'Contratista' then
    raise exception 'La mano de obra la cotiza un contratista, no un proveedor.';
  end if;

  if new.tipo = 'Materiales' and v_tipo_proveedor <> 'Proveedor' then
    raise exception 'Los materiales los cotiza un proveedor, no un contratista.';
  end if;

  return new;
end;
$$;

create trigger presupuestos_coherentes
  before insert or update of obra_id, rubro_id, tipo, proveedor_id on presupuestos
  for each row execute function chequear_presupuesto_coherente();

-- ================================ Vistas ====================================

-- Lo cotizado contra lo gastado, por rubro y tipo. Es la lectura que ordena la
-- obra: se ve dónde se está yendo de precio antes de que sea tarde.
--
-- Salen las dos filas (materiales y mano de obra) de cada rubro aunque no haya
-- nada cargado, así la solapa muestra la grilla completa sin armarla a mano.
create view obra_presupuesto
with (security_invoker = on) as
select
  r.obra_id,
  r.id                                     as rubro_id,
  r.nombre                                 as rubro,
  r.orden,
  r.activo,
  t.tipo,
  p.id                                     as presupuesto_id,
  p.proveedor_id,
  coalesce(p.monto, 0)                     as cotizado,
  coalesce(g.gastado, 0)                   as gastado,
  coalesce(g.gastado, 0) - coalesce(p.monto, 0) as diferencia
from rubros r
cross join (values ('Materiales'), ('Mano de obra')) as t(tipo)
left join lateral (
  select id, monto, proveedor_id
  from presupuestos
  where obra_id = r.obra_id
    and rubro_id = r.id
    and tipo = t.tipo
    and estado = 'Aprobado'
) p on true
left join lateral (
  select sum(monto) as gastado
  from gastos
  where obra_id = r.obra_id
    and rubro_id = r.id
    and tipo_gasto = t.tipo
    and estado <> 'Anulado'
) g on true
where r.obra_id is not null;

-- El presupuesto real de la obra —lo que suman las cotizaciones elegidas— al
-- lado del estimado que se cargó antes de arrancar.
--
-- La columna nueva va al final y no donde quedaría más linda: `create or
-- replace view` sólo deja agregar columnas después de las que ya están. Meterla
-- en el medio Postgres lo lee como un renombre y lo rechaza.
create or replace view obra_resumen
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
  coalesce(d.cant_documentos, 0)      as cant_documentos,
  coalesce(g.total_facturado, 0)      as total_facturado,
  coalesce(g.total_efectivo, 0)       as total_efectivo,
  coalesce(pr.aprobado, 0)            as presupuesto_aprobado
from obras o
left join lateral (
  select
    sum(monto)                                        as total_gastado,
    sum(monto) filter (where tipo_pago = 'Facturado') as total_facturado,
    sum(monto) filter (where tipo_pago = 'Efectivo')  as total_efectivo
  from gastos
  where obra_id = o.id
    and estado <> 'Anulado'
    and tipo_gasto <> 'Ajuste de saldo'
) g on true
left join lateral (
  select sum(monto) as aprobado
  from presupuestos
  where obra_id = o.id and estado = 'Aprobado'
) pr on true
left join lateral (
  -- avg() sobre cero filas devuelve null, no NaN: la obra sin avances da 0.
  select round(avg(av.porcentaje)) as avance_fisico
  from avances av
  join rubros r on r.id = av.rubro_id
  where av.obra_id = o.id and r.activo
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

-- ================================= RLS ======================================
-- Mismo criterio que el resto: la socia lee lo de sus obras, el admin escribe.

alter table presupuestos enable row level security;

create policy presupuestos_select on presupuestos for select to authenticated
  using (puede_ver_obra(obra_id));

create policy presupuestos_admin on presupuestos for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
