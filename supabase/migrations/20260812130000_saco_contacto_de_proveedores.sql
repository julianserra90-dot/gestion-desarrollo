-- Se saca `contacto` del catálogo: repetía el mismo dato.
--
-- Se agregó en la migración de recién (20260812120000) pensando en el corralón,
-- donde la razón social y la persona con la que se habla son distintas. Pero la
-- pantalla se hizo para los contratistas, y ahí el `nombre` ya es el nombre y
-- apellido de la persona: el campo aparte obligaba a escribir dos veces lo
-- mismo. Se va antes de que nadie lo haya cargado.
--
-- Queda como quedó: `nombre` (así figura en los desplegables) y `telefono`.

alter table proveedores drop column contacto;
