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

/** Una superficie: "303,10 m²". Hasta dos decimales, y ninguno si es redonda. */
export function formatM2(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";

  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(valor)} m²`;
}

/** Un volumen: "1,61 m³". Con dos decimales siempre: el hormigón se pide así. */
export function formatM3(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)} m³`;
}

/**
 * Un largo: "4,50 m". Siempre con dos decimales, al revés que la superficie:
 * los largos se leen en listas de medidas, una abajo de la otra, y "4,5 m"
 * arriba de "12,35 m" no deja comparar de un vistazo.
 */
export function formatMetros(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)} m`;
}

/**
 * Un nivel, con su signo como en un plano: "+2,90", "−2,80", "±0,00". Sin
 * unidad: un nivel siempre es en metros, y así se escribe en un corte.
 */
export function formatNivel(metros: number | null | undefined) {
  if (metros === null || metros === undefined || !Number.isFinite(metros)) return "—";
  if (Math.abs(metros) < 0.0005) return "±0,00";

  const valor = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(metros));
  return `${metros > 0 ? "+" : "−"}${valor}`;
}

/**
 * Los niveles de una planta en una línea: el único que tiene, o del primero
 * al último. Null si no hay ninguno cargado.
 */
export function formatNiveles(niveles: (number | null)[]) {
  const cargados = niveles.filter((n): n is number => n !== null);
  if (cargados.length === 0) return null;
  if (cargados.length === 1) return formatNivel(cargados[0]);
  return `${formatNivel(Math.min(...cargados))} a ${formatNivel(Math.max(...cargados))}`;
}

/** Un porcentaje: "42,01 %". Hasta dos decimales, y ninguno si es redondo. */
export function formatPorcentaje(valor: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(valor)} %`;
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
