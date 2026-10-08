/**
 * El logo de la empresa, que en esta app hace de título: entrar, el listado de
 * obras y la ficha de una obra no necesitan que les pongan un nombre encima.
 *
 * El archivo es el PNG recortado y con fondo transparente, así que sirve sobre
 * cualquier fondo. El `aspectRatio` le reserva el alto desde el principio, así
 * la pantalla no salta cuando la imagen termina de cargar.
 */

/** Las del archivo: 640 × 335. */
const PROPORCION = "640 / 335";

export default function Logo({
  ancho = "120px",
  /** Cuando el logo comparte renglón con un título —el nombre de la obra, los
   *  botones de la portada—: en pantalla angosta se esconde en vez de
   *  apretarlo. La regla está en `globals.css`, que es donde pueden vivir las
   *  media queries. */
  acompana = false,
}: {
  ancho?: string;
  acompana?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={acompana ? "logo-acompana" : undefined}
      src="/lat-desarrollos.png"
      alt="LAT Desarrollos"
      style={{ width: ancho, aspectRatio: PROPORCION, flexShrink: 0 }}
    />
  );
}
