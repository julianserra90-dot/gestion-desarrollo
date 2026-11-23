-- Las tareas tienen subtareas
--
-- Una tarea del catálogo puede ir de la mano de otra: el pastinado de juntas
-- va con el porcelanato. La subtarea es un renglón propio del cómputo, con su
-- precio, pero no se dibuja: donde el plano lleva la madre, lleva también la
-- subtarea, con la misma medida, y en el 3D se tilda aparte, debajo de ella.
--
-- Un solo nivel: la subtarea apunta a su madre. Si se borra la madre, la
-- subtarea queda suelta, como cualquier tarea.

alter table tareas
  add column madre_id uuid references tareas(id) on delete set null,
  add constraint tareas_madre_no_es_ella check (madre_id is null or madre_id <> id);

create index on tareas (madre_id);

comment on column tareas.madre_id is
  'La tarea de la que es subtarea: el pastinado de juntas, del porcelanato. Lleva la misma medida del plano que ella.';
