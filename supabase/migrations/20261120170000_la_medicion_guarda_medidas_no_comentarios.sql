-- La medición guarda medidas, no comentarios sobre ellas
--
-- La medición nació con dos columnas que parecían buenas y en la pantalla no
-- lo eran: `estado` —firme, estimada, hipótesis, pendiente— y `fuente`, la
-- aclaración de dónde salía la medida.
--
-- En la planilla de la que salió la idea las dos están llenas, y ahí se ve el
-- problema: dicen exactamente lo mismo en las ciento treinta y dos vigas
-- ("Dimensiones del replanteo; largo estimado del cómputo anterior"). No son
-- datos del elemento, son una nota sobre el bloque entero, repetida una vez
-- por fila. Como columnas se llevaban casi la mitad del ancho de la tabla para
-- no decir nada que no se supiera mirando el título de arriba.
--
-- Lo único de `estado` que hacía falta de verdad —que se note lo que todavía
-- no está medido— ya no depende de una marca a mano: un elemento al que le
-- falta una medida no suma, se muestra en gris y se cuenta aparte. Eso no se
-- puede olvidar de tildar.
--
-- Lo que se pierde es poder distinguir una medida firme de una estimada
-- cuando las dos están cargadas. Es una pérdida real y es a propósito: una
-- marca que hay que mantener a mano en cada uno de doscientos cincuenta
-- elementos, en la práctica, no se mantiene.
--
-- Ninguna obra tenía mediciones cargadas todavía, así que no se pierde nada
-- escrito.

alter table computo_item_medicion
  drop column estado,
  drop column fuente;
