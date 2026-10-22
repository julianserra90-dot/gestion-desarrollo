/**
 * Qué hacer cuando una escritura no tocó ninguna fila.
 *
 * Con RLS, un `update` o un `delete` que ninguna policy habilita **no falla**:
 * Postgres no encuentra filas que tocar y la respuesta vuelve sin error y sin
 * datos. Si la action sigue derecho, redirige a la pantalla de éxito y muestra
 * "listo" sobre algo que no pasó. Eso es peor que un error: el dato viejo sigue
 * ahí, la pantalla dice que se guardó y nadie se entera hasta que las cuentas no
 * cierran.
 *
 * Por eso toda escritura que sea **el punto de una action** pide `.select("id")`
 * y pasa lo que vuelve por acá. Las escrituras intermedias —el detalle de
 * materiales de un gasto, las facturas de un gasto— no: su falla ya se reporta
 * aparte, y el gasto ya está guardado cuando corren.
 *
 * `.select("id")` y no `{ count: "exact" }`: la opción se puede olvidar y
 * entonces el conteo llega en `null`, que hay que leer como "no sé" para no
 * frenar una escritura buena —y así el agujero queda abierto igual—. Sin el
 * `select` no hay `data`, y el chequeo de al lado salta a la vista.
 *
 * Ojo con una suposición que esto se come: `.select()` después de escribir
 * devuelve las filas **que además se pueden leer**. Acá vale porque las policies
 * de lectura son más anchas que las de escritura —quien puede ver la obra ve sus
 * filas— así que todo lo que se puede escribir se puede leer. Si alguna vez hay
 * una tabla que se escribe a ciegas, ésta no es la forma de chequearla.
 *
 * Lo que se puede o no escribir lo decide la base. Acá sólo se traduce "no tocó
 * nada" a algo que se pueda leer en pantalla.
 */

/** La escritura volvió sin filas: o no existía, o el RLS no la habilitó. */
export function noTocoNada(data: unknown[] | null | undefined): boolean {
  return !data?.length;
}

/**
 * El mensaje para la pantalla.
 *
 * `que` nombra lo que se intentaba, en infinitivo y en los términos de la
 * pantalla —"borrar este gasto", "modificar el catálogo"—: un "no tenés
 * permiso" suelto no dice qué fue lo que no se pudo, y estas actions se
 * disparan desde botones que no siempre aclaran qué van a tocar.
 *
 * No dice "es cosa del administrador" porque no siempre es cierto: un
 * desarrollador corrige los gastos de su empresa y no los de otra, así que el
 * límite no es el rol sino de quién es la fila.
 */
export function sinPermisoPara(que: string): string {
  return `No se pudo: no tenés permiso para ${que}.`;
}
