import { VERDE } from "@/components/ui";

/**
 * El estado de un estudio, con color: verde lo que interesa, apagado lo
 * descartado, y lo que sigue en estudio en texto normal. Lo usan el listado
 * y la ficha, y vive aparte porque una página de Next no puede exportar
 * otra cosa que su componente.
 */
export default function EstadoPrefactibilidad({ valor }: { valor: string }) {
  const color =
    valor === "Interesa" ? VERDE : valor === "Descartado" ? "#999999" : "#111111";
  return <span style={{ color, fontWeight: 600 }}>{valor}</span>;
}
