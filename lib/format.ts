export function formatMoney(value: number | null | undefined) {
  // Dos decimales siempre: los gastos se cargan al centavo (el total de una
  // factura no es redondo) y redondear a pesos enteros escondía esos centavos.
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatUSD(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(valor);
}

/**
 * Pasa una fecha de Postgres ("2026-06-01") a formato local ("01/06/2026").
 *
 * Se parsea a mano a propósito: `new Date("2026-06-01")` lo interpreta como
 * medianoche UTC, y en Argentina (UTC-3) eso muestra el día anterior.
 */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";

  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
