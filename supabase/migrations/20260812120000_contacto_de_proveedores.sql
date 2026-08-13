-- Datos de contacto en el catálogo de proveedores y contratistas.
--
-- Hasta ahora un proveedor era sólo un nombre, y encima no había pantalla para
-- tocarlo: se creaba al vuelo cargando un gasto o una cotización y quedaba así
-- para siempre, con el error de tipeo incluido. Ahora se edita desde
-- Presupuestos, y de paso se guarda a quién llamar y a qué número —que es lo
-- que uno busca cuando el plomero tiene que volver a la obra—.
--
-- `nombre` sigue siendo cómo se lo nombra en los desplegables, y puede ser una
-- razón social ("Corralón Central"); `contacto` es la persona con la que se
-- habla, que no siempre coincide con ella.

alter table proveedores
  add column contacto text,
  add column telefono text;

comment on column proveedores.contacto is
  'Nombre y apellido de la persona con la que se habla. El nombre puede ser una razón social.';

comment on column proveedores.telefono is
  'Texto libre a propósito: puede venir con prefijo, espacios, o ser más de un número.';
