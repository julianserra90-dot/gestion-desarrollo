-- La medición dice si vino del plano
--
-- Hasta ahora todo renglón de la medición de una tarea lo cargaba alguien: a
-- mano, o pegándolo desde Excel. Con las plantas dibujadas aparece otra fuente:
-- el dibujo ya sabe cuántos m² de revoque lleva cada piso, y esos números
-- tienen que llegar al cómputo sin que nadie los copie.
--
-- Llegan como renglones de la misma medición —un renglón por tarea y por
-- piso—, y no como una tabla aparte: la cantidad de la tarea ya es la suma de
-- sus renglones, el cuadro "Por nivel" ya los agrupa por piso, y así lo que
-- mide el plano y lo que se midió a mano se ven en el mismo lugar.
--
-- Lo que hace falta es poder distinguirlos, por dos razones:
--
--   Para volver a pasar. Cuando el dibujo cambia se vuelve a pasar el plano
--   al cómputo, y eso reemplaza **sólo** lo que había venido del plano. Las
--   ciento treinta y dos vigas pegadas desde Excel no se tocan.
--
--   Para que se vea. Un número que vino del dibujo se corrige en el dibujo,
--   no en la planilla: el cómputo lo marca, y en la medición esos renglones
--   no se editan.
--
-- `origen` y no un booleano: mañana puede haber una tercera fuente, y "no es
-- del plano" no dice de dónde es.
--
-- Todo lo que ya está cargado es 'mano', que es lo que era.

alter table computo_item_medicion
  add column origen text not null default 'mano'
  check (origen in ('mano', 'plano'));

comment on column computo_item_medicion.origen is
  'De donde salio el renglon: mano (cargado o pegado) o plano (lo midio el dibujo de las plantas).';
