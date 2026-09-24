-- ===========================================================================
-- Prefactibilidades: estudios de terrenos en CABA, aparte de las obras
-- ===========================================================================
--
-- Antes de comprar un lote se estudia qué deja construir el Código
-- Urbanístico y si el negocio cierra. Eso pasa antes de que exista una obra,
-- y la mayoría de los lotes estudiados no llegan a serlo: por eso los
-- estudios viven en su propia tabla, sin enganche con `obras` ni con las
-- empresas socias. Si un lote se compra, la obra se crea aparte, como
-- siempre.
--
-- Primera tanda: todo se carga a mano. La normativa por parcela (unidad de
-- edificabilidad, alturas, LFI/LIB, afectaciones) se escribe mirando el
-- Código y Ciudad 3D. Más adelante se va a completar sola desde los datos
-- abiertos de la Ciudad, y estos mismos campos quedan como la corrección
-- manual que siempre tiene que existir: la mensura manda sobre el mapa.

create table prefactibilidades (
  id                        uuid primary key default gen_random_uuid(),

  -- El terreno, como lo dice la mensura o el vendedor.
  direccion                 text not null,
  barrio                    text,
  smp                       text,
  ancho_m                   numeric(8, 2)  check (ancho_m > 0),
  profundidad_m             numeric(8, 2)  check (profundidad_m > 0),
  superficie_m2             numeric(10, 2) check (superficie_m2 > 0),
  valor_terreno             numeric(14, 2) check (valor_terreno >= 0),
  moneda_valor              text not null default 'USD'
                            check (moneda_valor in ('ARS', 'USD')),
  construcciones_existentes text,
  tipo_desarrollo           text,
  estado                    text not null default 'En estudio'
                            check (estado in ('En estudio', 'Interesa', 'Descartado')),

  -- La normativa que aplica a la parcela.
  unidad_edificabilidad     text,
  altura_maxima_m           numeric(6, 2)  check (altura_maxima_m > 0),
  plano_limite_m            numeric(6, 2)  check (plano_limite_m > 0),
  plantas_sobre_pb          integer        check (plantas_sobre_pb >= 0),
  lfi_m                     numeric(8, 2)  check (lfi_m > 0),
  lib_m                     numeric(8, 2)  check (lib_m > 0),
  retiro_frente_m           numeric(6, 2)  check (retiro_frente_m >= 0),
  patios                    text,
  mixtura_usos              text,
  usos_permitidos           text,
  aph                       boolean not null default false,
  aph_detalle               text,
  catalogado                boolean not null default false,
  afectaciones              text,
  plusvalia                 text,

  observaciones             text,
  creado_en                 timestamptz not null default now(),
  actualizado_en            timestamptz not null default now()
);

comment on column prefactibilidades.smp is
  'Nomenclatura catastral sección-manzana-parcela, como la usa la Ciudad.';
comment on column prefactibilidades.lfi_m is
  'Profundidad edificable desde la Línea Oficial hasta la Línea de Frente Interno.';
comment on column prefactibilidades.lib_m is
  'Profundidad del basamento, desde la Línea Oficial hasta la Línea Interna de Basamento.';
comment on column prefactibilidades.plantas_sobre_pb is
  'Plantas que entran en la altura máxima, sin contar la planta baja. A mano hasta que la tabla de parámetros del Código lo calcule.';
comment on column prefactibilidades.plusvalia is
  'Si aplica el derecho de participación en la plusvalía urbana, y por cuánto se estima. Texto: todavía no se calcula.';

create index on prefactibilidades (estado, creado_en desc);

alter table prefactibilidades enable row level security;

-- Herramienta interna del desarrollador. Los usuarios de empresa ven las
-- obras en las que participan, y un lote que todavía se está evaluando no es
-- de ninguna obra ni de ninguna empresa: sólo el administrador.
create policy prefactibilidades_admin on prefactibilidades for all to authenticated
  using (auth_es_admin()) with check (auth_es_admin());
