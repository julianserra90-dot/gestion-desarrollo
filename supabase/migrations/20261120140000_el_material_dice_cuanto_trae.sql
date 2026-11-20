-- El material dice cuánto trae su envase
--
-- El catálogo sabe en qué unidad se compra un material —la premezcla, en
-- bolsa— pero no cuánto trae esa bolsa. Y el rendimiento de una tarea no se
-- piensa ni se publica en bolsas: un revoque proyectable consume **18 kg por
-- m²**, y la bolsa viene de 30 kg.
--
-- Sin el envase, lo único que se puede guardar en el desglose es el cociente:
-- 0,6 bolsas por m². La cuenta da bien y todo lo demás se rompe:
--
--   - No queda escrito de dónde salió el 0,6. A los seis meses es un número
--     mágico que nadie puede verificar contra la ficha del producto.
--   - Si la bolsa pasa a 25 kg hay que rehacer a mano **cada tarea** que use
--     ese material.
--   - Para cargar un consumo hay que dividir de cabeza, y son doscientas y
--     pico de tareas.
--
-- El envase es del material, no de la tarea: la misma bolsa de 30 kg sirve
-- para el revoque grueso y para el fino. Por eso va acá y no en el desglose.
--
-- Las dos columnas son opcionales y van juntas: el ladrillo se cuenta de a
-- uno y no tiene envase que declarar. `contenido_unidad` es texto libre como
-- `unidad`, y la lista que se ofrece en pantalla es la misma (`lib/unidades`).

alter table materiales
  add column contenido        numeric(14, 4),
  add column contenido_unidad text;

-- O están las dos o no está ninguna: un "30" sin unidad no se puede usar para
-- convertir nada, y una unidad sin número tampoco.
alter table materiales
  add constraint materiales_contenido_completo
  check (
    (contenido is null and contenido_unidad is null)
    or (contenido is not null and contenido_unidad is not null and contenido > 0)
  );

comment on column materiales.contenido is
  'Cuánto trae el envase en el que se compra (30, para una bolsa de 30 kg). Null si se cuenta de a uno.';

comment on column materiales.contenido_unidad is
  'La unidad de lo que trae el envase (kg). Siempre junto con contenido.';
