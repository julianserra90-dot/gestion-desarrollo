/**
 * Los íconos de las herramientas del editor de plantas.
 *
 * Del mismo juego que `IconoObra` —SVG a mano, viewBox 24×24, trazo 1.7,
 * currentColor—, pero aparte: son de una sola pantalla y cada uno dibuja lo
 * que la herramienta deja en el plano, que es como se la reconoce sin leer.
 */

export type NombreHerramienta =
  | "seleccionar"
  | "mover"
  | "escala"
  | "muro"
  | "ambiente"
  | "capa"
  | "cajon"
  | "abertura"
  | "medir"
  | "copiar"
  | "cortar"
  | "esquina"
  | "columna"
  | "viga"
  | "tabique"
  | "losa"
  | "deshacer"
  | "encuadrar";

export default function IconoHerramienta({
  nombre,
  size = 20,
}: {
  nombre: NombreHerramienta;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

const TRAZOS: Record<NombreHerramienta, React.ReactNode> = {
  // La flecha del puntero.
  seleccionar: <path d="M6 3.5l12 8.5-5.2 1.1 3 5.6-2.2 1.2-3-5.6L6 18z" />,
  // La cruz de cuatro flechas: correr el plano.
  mover: (
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="M9.5 5.5L12 3l2.5 2.5M9.5 18.5L12 21l2.5-2.5M5.5 9.5L3 12l2.5 2.5M18.5 9.5L21 12l-2.5 2.5" />
    </>
  ),
  // Una regla con sus marcas.
  escala: (
    <>
      <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
      <path d="M6.5 8v3M10.2 8v4M13.8 8v3M17.5 8v4" />
    </>
  ),
  // Un paño de ladrillos.
  muro: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M3 12h18M9 6v6M15 6v6M12 12v6" />
    </>
  ),
  // Un contorno cerrado, en L: un ambiente no es siempre un rectángulo.
  ambiente: <path d="M4 4h16v9h-7v7H4z" />,
  // Un muro en esquina y, pegada a su cara, la capa que da la vuelta.
  capa: (
    <>
      <path d="M3 21V3h18" />
      <path d="M8 21V8h13" strokeWidth={3} />
    </>
  ),
  // Un cajón de cielorraso en corte: el techo, y el cajón que baja con su frente.
  cajon: (
    <>
      <path d="M3 5h18" />
      <path d="M3 5v8h11V5" />
      <path d="M14 13h7" strokeDasharray="2 2" />
    </>
  ),
  // Una puerta en planta: el muro cortado, la hoja y su barrido.
  abertura: (
    <>
      <path d="M3 20h3M18 20h3M6 20V8" />
      <path d="M6 8a12 12 0 0 1 12 12" />
    </>
  ),
  // Una cota: dos topes y la línea entre ellos.
  medir: (
    <>
      <path d="M4 7v10M20 7v10M4 12h16" />
      <path d="M7.5 9.5L5 12l2.5 2.5M16.5 9.5L19 12l-2.5 2.5" />
    </>
  ),
  // El rodillo: pasarle a una cosa la terminación de otra.
  copiar: (
    <>
      <rect x="4" y="3.5" width="13" height="6" rx="1.5" />
      <path d="M17 6.5h3v5h-8v3" />
      <rect x="10.2" y="14.5" width="3.6" height="6" rx="1" />
    </>
  ),
  // Dos muros que se encuentran en escuadra.
  esquina: (
    <>
      <path d="M5 20V5h15" />
      <path d="M9 20V9h11" />
    </>
  ),
  // Una tijera: parte un muro en tramos.
  cortar: (
    <>
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
      <path d="M8.3 15.7L18 4M15.7 15.7L6 4" />
    </>
  ),
  // La sección llena, como se rellena una columna en un plano.
  columna: <rect x="7" y="7" width="10" height="10" rx="0.5" fill="currentColor" />,
  // El perfil en doble T, que es como se dibuja "viga" en cualquier lado.
  viga: <path d="M6 5h12M6 19h12M12 5v14" />,
  // Un tabique en planta: una franja larga y rayada, como se lo corta.
  tabique: <path d="M4 9h16v6H4zM8 15l4-6M12 15l4-6" />,
  // Una placa vista en perspectiva, con su canto.
  losa: (
    <>
      <path d="M3 13l6-5h12l-6 5z" />
      <path d="M3 13v3h12v-3M15 16l6-5V8" />
    </>
  ),
  deshacer: (
    <>
      <path d="M8.5 6.5L4 11l4.5 4.5" />
      <path d="M4 11h10.5a5 5 0 0 1 0 10H12" />
    </>
  ),
  // Las cuatro esquinas de un encuadre.
  encuadrar: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
};
