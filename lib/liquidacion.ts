export type SaldoEmpresa = {
  empresa: string;
  saldo: number;
};

export type Transferencia = {
  de: string;
  a: string;
  monto: number;
};

/**
 * Resuelve quién le tiene que transferir a quién para dejar todos los saldos
 * en cero, usando la menor cantidad de transferencias posible.
 *
 * Con 2 empresas esto es una resta. Con 3 o más ya no: hay varias formas de
 * saldar las cuentas y conviene sugerir la más corta. Se emparejan los que
 * pusieron de más con los que deben, arrancando por los montos más grandes.
 */
export function calcularLiquidacion(saldos: SaldoEmpresa[]): Transferencia[] {
  // Tolerancia de un centavo, para que los redondeos no generen
  // transferencias fantasma de $0,003.
  const EPSILON = 0.01;

  const acreedores = saldos
    .filter((s) => s.saldo > EPSILON)
    .map((s) => ({ ...s }))
    .sort((a, b) => b.saldo - a.saldo);

  const deudores = saldos
    .filter((s) => s.saldo < -EPSILON)
    .map((s) => ({ ...s, saldo: -s.saldo }))
    .sort((a, b) => b.saldo - a.saldo);

  const transferencias: Transferencia[] = [];
  let i = 0;
  let j = 0;

  while (i < deudores.length && j < acreedores.length) {
    const monto = Math.min(deudores[i].saldo, acreedores[j].saldo);

    if (monto > EPSILON) {
      transferencias.push({
        de: deudores[i].empresa,
        a: acreedores[j].empresa,
        monto,
      });
    }

    deudores[i].saldo -= monto;
    acreedores[j].saldo -= monto;

    if (deudores[i].saldo <= EPSILON) i++;
    if (acreedores[j].saldo <= EPSILON) j++;
  }

  return transferencias;
}
