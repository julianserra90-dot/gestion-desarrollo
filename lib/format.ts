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

  // Dos decimales, igual que los pesos. Un gasto convertido rara vez da un
  // número redondo: $ 1.200.000 al cambio de 1.433,90 son US$ 836,88, y mostrar
  // US$ 837 inventa doce centavos que nadie pagó. La conversión se guarda al
  // centavo desde siempre; lo que redondeaba era esto.
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
