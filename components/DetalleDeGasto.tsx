/**
 * La columna "Detalle" de un gasto: con qué semana de obra se identifica, y la
 * aclaración libre si la tiene.
 *
 * La semana **sale de la fecha**, no se carga: así todos los gastos quedan
 * identificados igual, sin depender de que alguien se acuerde de marcarla, y el
 * flujo puede agrupar por semana con todo adentro. Antes se escribía a mano acá
 * ("Semana 22"), donde era texto suelto.
 *
 * Lo anterior al arranque no cae en ninguna semana —acopios, anticipos,
 * impuestos del terreno— y lo dice con todas las letras, en vez de dejar la
 * columna muda.
 *
 * Es puro (sólo `lib/semanas`), así que lo usan igual el listado de gastos, que
 * corre en el cliente, y las tablas de servidor —rubro, proveedor, dólares—.
 */

import * as ui from "@/components/ui";
import { semanaDeObra } from "@/lib/semanas";

export default function DetalleDeGasto({
  fecha,
  inicioObra,
  concepto,
}: {
  fecha: string;
  /** Arranque de la obra: sin eso no hay semana que calcular. */
  inicioObra: string | null;
  /** La aclaración libre, opcional. */
  concepto: string | null;
}) {
  const semana = semanaDeObra(fecha, inicioObra);

  return (
    <>
      {semana !== null ? (
        <span style={tagSemana}>Semana {semana}</span>
      ) : (
        inicioObra && <span style={ui.tagPrevio}>Previo al arranque</span>
      )}

      {/* El margen va en el texto y no en la etiqueta: sin detalle no queda un
          espacio colgando. */}
      {concepto && <span style={texto}>{concepto}</span>}
    </>
  );
}

const tagSemana = {
  display: "inline-block",
  background: "#f2f2f2",
  color: "#555555",
  padding: "2px 6px",
  fontSize: "11px",
  whiteSpace: "nowrap" as const,
};

const texto = {
  marginLeft: "8px",
};
