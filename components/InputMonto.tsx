"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Un campo de plata que se lee mientras se escribe: 1.235.879,35.
 *
 * Un `<input type="number">` muestra 1235879.35, y en un monto grande no se
 * sabe si son cientos de miles o millones hasta contar dígitos: así se cargan
 * ceros de más. Acá se escribe con coma decimal y los puntos de miles aparecen
 * solos, como en cualquier factura argentina.
 *
 * Lo que viaja al servidor es el número limpio ("1235879.35"), por un input
 * oculto con el `name` que le den: los server actions siguen haciendo
 * `Number(formData.get(...))` como siempre. Hacia arriba (`onChange`) también
 * va limpio, así el formulario calcula sin parsear.
 *
 * Sirve controlado (`value` + `onChange`) o suelto (`defaultValue`).
 */

/**
 * "1234567.5" → "1.234.567,5". Recibe el valor **limpio** (punto decimal, como
 * viene de la base o como lo devuelve `limpiarMonto`); el punto es el decimal
 * acá y se pasa a coma antes de limpiar, o se lo comería como si fuera de miles.
 */
export function formatearMonto(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const limpio = limpiarMonto(String(valor).replace(".", ","));
  if (limpio === "") return "";

  const [entero, decimales] = limpio.split(".");
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  // La coma sola al final se conserva: se está por escribir los centavos.
  return decimales === undefined ? conPuntos : `${conPuntos},${decimales}`;
}

/**
 * "1.234.567,50" → "1234567.50". Tira todo lo que no sea dígito o la primera
 * coma, y deja como mucho dos decimales. Un punto tipeado a mano cuenta como
 * separador de miles, no como decimal: acá el decimal es la coma.
 */
export function limpiarMonto(texto: string): string {
  const soloValido = texto.replace(/[^\d,]/g, "");
  const primeraComa = soloValido.indexOf(",");
  if (primeraComa < 0) return soloValido.replace(/^0+(?=\d)/, "");

  const entero = soloValido.slice(0, primeraComa).replace(/^0+(?=\d)/, "") || "0";
  const decimales = soloValido.slice(primeraComa + 1).replace(/,/g, "").slice(0, 2);
  return `${entero}.${decimales}`;
}

/** Cuántos caracteres "de número" (dígitos o coma) hay antes de una posición. */
function cuentaHasta(texto: string, posicion: number) {
  return texto.slice(0, posicion).replace(/[^\d,]/g, "").length;
}

/** La posición en el texto formateado que deja `cantidad` caracteres de número atrás. */
function posicionTras(texto: string, cantidad: number) {
  if (cantidad <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/[\d,]/.test(texto[i])) vistos++;
    if (vistos === cantidad) return i + 1;
  }
  return texto.length;
}

export default function InputMonto({
  name,
  value,
  defaultValue,
  onChange,
  required,
  placeholder = "0",
  style,
  readOnly,
  disabled,
  autoFocus,
}: {
  /** Nombre del campo oculto que viaja al servidor. Sin nombre no viaja. */
  name?: string;
  /** Valor limpio ("1234.5"), para usarlo controlado. */
  value?: string;
  defaultValue?: string | number | null;
  /** Recibe el valor limpio, no el formateado. */
  onChange?: (limpio: string) => void;
  required?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  readOnly?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState(() => formatearMonto(value ?? defaultValue));
  const campo = useRef<HTMLInputElement>(null);
  const caretPendiente = useRef<number | null>(null);

  // Controlado: si el de arriba cambia el valor por su cuenta (un botón que
  // pone el total del detalle, un presupuesto que lo trae), la pantalla lo
  // sigue. Ajuste durante el render, no en un efecto.
  const [valorPrevio, setValorPrevio] = useState(value);
  if (value !== undefined && value !== valorPrevio) {
    setValorPrevio(value);
    if (limpiarMonto(texto) !== value) setTexto(formatearMonto(value));
  }

  // El cursor se recoloca después de formatear: si se escribió en el medio y
  // apareció un punto nuevo, tiene que quedar detrás del mismo dígito.
  useLayoutEffect(() => {
    if (caretPendiente.current === null || !campo.current) return;
    campo.current.setSelectionRange(caretPendiente.current, caretPendiente.current);
    caretPendiente.current = null;
  });

  const alEscribir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tipeado = e.target.value;
    const caret = e.target.selectionStart ?? tipeado.length;
    const numerosAntes = cuentaHasta(tipeado, caret);

    const limpio = limpiarMonto(tipeado);
    const formateado = formatearMonto(limpio);

    caretPendiente.current = posicionTras(formateado, numerosAntes);
    setTexto(formateado);
    setValorPrevio(limpio);
    onChange?.(limpio);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={limpiarMonto(texto)} />}
      <input
        ref={campo}
        type="text"
        inputMode="decimal"
        value={texto}
        onChange={alEscribir}
        required={required}
        placeholder={placeholder}
        style={style}
        readOnly={readOnly}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </>
  );
}
