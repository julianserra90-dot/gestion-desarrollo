-- ===========================================================================
-- El número de la factura, para encontrarla y para saber de cuál salió cada
-- material
-- ===========================================================================
--
-- Un gasto facturado sabía el tipo (A, B, C) y tenía el archivo, pero no el
-- número. Sin él no se puede buscar una factura por lo que dice el papel, ni
-- decir, mirando el consumo de materiales, "estos ladrillos vinieron en la
-- 0001-00001234". Es texto y no número: el formato tiene punto de venta y
-- guion, y a veces letras.

alter table gastos add column numero_factura text;

comment on column gastos.numero_factura is
  'El número impreso en la factura (ej. 0001-00001234). Sólo en gastos facturados; opcional.';
