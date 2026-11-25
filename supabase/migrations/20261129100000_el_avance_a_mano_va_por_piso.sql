-- El avance a mano va por piso
--
-- La carga a mano de una tarea decía cuánto se hizo, sin decir dónde. Ahora,
-- como el cómputo, va **piso por piso**: en la pantalla del rubro cada tarea
-- se despliega con sus pisos —cada uno con lo que tiene el cómputo— y se pone
-- el porcentaje que avanzó cada uno. En el 3D, lo de ese piso que todavía no se
-- marcó cosa por cosa se pinta en verde claro, para saber dónde hay avance.
--
-- El número es el del piso en la definición de pisos (0 la planta baja), como
-- en `avances_del_plano`. Null: sin piso —una tarea que el plano no reparte, o
-- lo cargado antes de esto—.

alter table avances_de_tarea
  add column piso integer;

comment on column avances_de_tarea.piso is
  'En qué piso, por su número en la definición de pisos. Null: sin piso.';
