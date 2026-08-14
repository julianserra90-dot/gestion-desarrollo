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

/**
 * Un monto abreviado para las marcas del eje de un gráfico: "$ 4 M", "$ 500 k".
 *
 * Es el único lugar donde se redondea, y se puede porque no es un dato sino una
 * referencia: sirve para leer la altura de una barra de reojo. El monto exacto
 * de cada barra aparece al pasar el mouse. No usar esto en una tabla ni en una
 * tarjeta.
 */
export function formatMoneyEje(valor: number) {
  if (valor === 0) return "$ 0";

  const abs = Math.abs(valor);
  if (abs >= 1_000_000) return `$ ${conDecimal(valor / 1_000_000)} M`;
  if (abs >= 1_000) return `$ ${conDecimal(valor / 1_000)} k`;

  return `$ ${Math.round(valor)}`;
}

/** Un decimal sólo si hace falta: "12,5 M", pero "12 M". */
function conDecimal(valor: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(
    valor
  );
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
