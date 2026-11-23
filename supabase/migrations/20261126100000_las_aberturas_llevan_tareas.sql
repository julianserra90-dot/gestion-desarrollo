-- Las aberturas llevan tareas
--
-- Una ventana no es una sola tarea: antes de estar terminada se amura su
-- premarco (Albañilería) y después se coloca (Carpinterías). Cada tipo de
-- abertura —la V01, la P02— dice qué tareas del cómputo lleva, y todas las de
-- ese tipo las llevan: el plano las cuenta para el cómputo y en el 3D se marca
-- cada una por separado, abertura por abertura.
--
-- Los ids son de `tareas`, el catálogo. Sin clave foránea, como las tareas de
-- los muros y de las capas dentro del dibujo: una que se borre del catálogo
-- deja de contarse sola.

alter table tipos_de_abertura
  add column tareas uuid[] not null default '{}';

comment on column tipos_de_abertura.tareas is
  'Las tareas del cómputo que lleva cada abertura de este tipo, por id: amure de premarco, colocación.';
