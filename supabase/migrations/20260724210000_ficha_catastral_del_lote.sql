-- ===========================================================================
-- La ficha catastral del lote
-- ===========================================================================
--
-- El lote tenía sólo lo económico —valor, superficie, vendedor— más una nota
-- libre donde terminaba entrando todo lo demás. Pero un terreno es además un
-- inmueble identificado: tiene un titular registral, una partida con la que se
-- pagan sus impuestos, y una nomenclatura catastral. Eso se buscaba en la
-- escritura cada vez.
--
-- La nomenclatura va desglosada (circunscripción / sección / manzana / parcela)
-- en vez de un solo texto: así figura en la escritura y así la pide el
-- municipio, y desglosada se puede leer campo por campo.
--
-- Todo texto, incluso lo que parece número: una parcela puede ser "12a", una
-- sección "B" y una circunscripción "II".

alter table obras
  add column lote_propietario     text,
  add column lote_partida         text,
  add column lote_circunscripcion text,
  add column lote_seccion         text,
  add column lote_manzana         text,
  add column lote_parcela         text;

comment on column obras.lote_propietario is
  'Titular registral del terreno, que puede no ser quien lo vendió.';
comment on column obras.lote_partida is
  'Partida inmobiliaria: con ese número se pagan los impuestos del terreno.';
comment on column obras.lote_circunscripcion is
  'Nomenclatura catastral, desglosada junto a sección, manzana y parcela.';
