/**
 * A quién se le facturó cada gasto, que **no** es lo mismo que quién puso la
 * plata.
 *
 * Una factura A sale a nombre de un CUIT aunque la compra la hayan pagado las
 * dos socias: en ese caso el gasto entero es de esa empresa, no la mitad para
 * cada una. Cuando no hay CUIT cargado —las B y C son consumidor final, y los
 * gastos viejos quedaron sin tipo de factura— el único dato que queda es quién
 * pagó.
 *
 * Se toma el **monto entero**, no lo que salió del bolsillo: la factura es por
 * el total aunque una parte la haya cubierto el dinero en cuenta. Es el mismo
 * criterio del crédito fiscal, que computa el IVA completo del comprobante.
 *
 * Es cálculo puro, sin base de datos, porque lo usan el Balance (servidor) y el
 * listado de gastos (navegador, donde tiene que rehacerse con cada filtro). Los
 * dos tienen que llegar al mismo número.
 */

export type GastoComprobante = {
  monto: number;
  /** IVA discriminado. Es 0 en todo lo que no sea factura A. */
  iva: number;
  /** "Facturado" (A, B o C) o "Efectivo" (sin factura). */
  tipoPago: string | null;
  /** El CUIT de la factura A. Null en las B y C, y en los gastos viejos. */
  empresaFacturaId: string | null;
  empresaPagadoraId: string | null;
  /** Lo pusieron todas las socias en partes iguales. */
  compartido: boolean;
};

export type ComprobantesEmpresa = {
  facturado: number;
  efectivo: number;
  creditoFiscal: number;
};

export type RepartoComprobantes = {
  porEmpresa: Map<string, ComprobantesEmpresa>;
  /** Lo que no se le puede atribuir a ninguna empresa, para decirlo aparte. */
  facturadoSinAsignar: number;
  efectivoSinAsignar: number;
};

function vacio(): ComprobantesEmpresa {
  return { facturado: 0, efectivo: 0, creditoFiscal: 0 };
}

/**
 * Reparte los gastos entre las socias según a quién se le facturó.
 *
 * El orden es: la empresa de la factura, si no la que pagó, si no —cuando lo
 * pusieron entre todas y no hay factura a nombre de ninguna— en partes iguales.
 * Lo que no cae en ninguno de los tres queda sin asignar: son los gastos
 * pagados enteros con el dinero en cuenta, que no son de ninguna socia.
 *
 * El **crédito fiscal** no tiene esa cadena: el IVA lo computa sólo el CUIT que
 * figura en la factura A, y sin CUIT cargado no hay a quién dárselo.
 *
 * Los anulados y los ajustes de saldo tienen que venir ya filtrados: no son
 * gasto de obra en ninguna otra pantalla.
 */
export function repartirComprobantes(
  gastos: GastoComprobante[],
  idsSocias: string[]
): RepartoComprobantes {
  const porEmpresa = new Map<string, ComprobantesEmpresa>();
  let facturadoSinAsignar = 0;
  let efectivoSinAsignar = 0;

  const de = (id: string) => {
    const actual = porEmpresa.get(id) ?? vacio();
    porEmpresa.set(id, actual);
    return actual;
  };

  for (const g of gastos) {
    const esFacturado = g.tipoPago === "Facturado";
    const empresa = g.empresaFacturaId ?? g.empresaPagadoraId;

    if (empresa) {
      const cuenta = de(empresa);
      if (esFacturado) cuenta.facturado += g.monto;
      else cuenta.efectivo += g.monto;
    } else if (g.compartido && idsSocias.length > 0) {
      // Sin factura a nombre de ninguna no hay a quién atribuírselo entero.
      const parte = g.monto / idsSocias.length;
      for (const id of idsSocias) {
        const cuenta = de(id);
        if (esFacturado) cuenta.facturado += parte;
        else cuenta.efectivo += parte;
      }
    } else if (esFacturado) {
      facturadoSinAsignar += g.monto;
    } else {
      efectivoSinAsignar += g.monto;
    }

    // El crédito fiscal es del CUIT de la factura y de nadie más: no hereda de
    // quien pagó ni se reparte entre las socias.
    if (g.empresaFacturaId && g.iva > 0) {
      de(g.empresaFacturaId).creditoFiscal += g.iva;
    }
  }

  return { porEmpresa, facturadoSinAsignar, efectivoSinAsignar };
}
