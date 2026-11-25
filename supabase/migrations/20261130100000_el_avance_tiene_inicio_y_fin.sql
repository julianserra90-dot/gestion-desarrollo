-- El avance tiene inicio y fin
--
-- Lo hecho de una tarea —marcado en el 3D o cargado a mano— llevaba un solo
-- día. Ahora puede llevar **desde cuándo**: "la placa del 2.º piso, del 10 al
-- 14". Así se sabe cuántos días llevó cada avance.
--
-- `fecha` sigue siendo el día en que se terminó —con él se arman las cargas
-- del rubro—, y `fecha_inicio` el día en que se empezó. Null: en el día.

alter table avances_del_plano
  add column fecha_inicio date;

alter table avances_de_tarea
  add column fecha_inicio date;

comment on column avances_del_plano.fecha_inicio is
  'El día en que se empezó. Null: se hizo en el día (fecha).';

comment on column avances_de_tarea.fecha_inicio is
  'El día en que se empezó. Null: se hizo en el día (fecha).';
