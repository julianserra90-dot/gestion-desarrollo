/**
 * Los íconos de la app: los de la barra lateral y los de algún botón (sumar un
 * renglón, tirarlo). La app no usa ninguna librería de íconos —
 * son SVG a mano, todos con el mismo trazo (viewBox 24×24, stroke 1.7,
 * currentColor) para que se sientan de un mismo juego aunque cada uno se
 * dibujó por separado.
 */

export type NombreIcono =
  | "grid"
  | "engranaje"
  | "billetera"
  | "edificio"
  | "balance"
  | "gastos"
  | "ingresos"
  | "inversores"
  | "flujo"
  | "lote"
  | "prefactibilidad"
  | "dolares"
  | "beneficio"
  | "estado"
  | "presupuestos"
  | "avances"
  | "fotos"
  | "documentos"
  | "rubros"
  | "materiales"
  | "usuarios"
  | "perfil"
  | "salir"
  | "mas"
  | "tacho";

export default function IconoObra({
  nombre,
  size = 20,
}: {
  nombre: NombreIcono;
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
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

const TRAZOS: Record<NombreIcono, React.ReactNode> = {
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </>
  ),
  engranaje: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  billetera: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.2" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  edificio: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 7h1.2M13.8 7H15M9 11h1.2M13.8 11H15M9 15h1.2M13.8 15H15" />
    </>
  ),
  balance: <path d="M4 20V11M12 20V4M20 20v-6" />,
  gastos: <path d="M12 4v13M6.5 12.5 12 18l5.5-5.5" />,
  ingresos: <path d="M12 20V7M6.5 11.5 12 6l5.5 5.5" />,
  inversores: (
    <>
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5 20c0-4 3-6.3 7-6.3s7 2.3 7 6.3" />
    </>
  ),
  flujo: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9.5h16M8 3v4M16 3v4" />
    </>
  ),
  lote: (
    <>
      <path d="M12 21s7-6.7 7-11.8A7 7 0 0 0 5 9.2C5 14.3 12 21 12 21Z" />
      <circle cx="12" cy="9.3" r="2.2" />
    </>
  ),
  // Un lote con el frente acotado: la parcela y, arriba, la cota de medida.
  prefactibilidad: (
    <>
      <rect x="4" y="8.5" width="16" height="11.5" rx="1.2" />
      <path d="M4 4.5h16M4 3v3M20 3v3" />
    </>
  ),
  dolares: (
    <>
      <circle cx="12" cy="12" r="9" />
      <text
        x="12"
        y="16.3"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        stroke="none"
        fill="currentColor"
      >
        $
      </text>
    </>
  ),
  beneficio: (
    <>
      <path d="M4 16.5 9.5 11l4 3 6-6.5" />
      <path d="M15.5 7h4v4" />
    </>
  ),
  estado: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M8.7 12.3 10.7 14.3 15.3 9.5" />
    </>
  ),
  presupuestos: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  avances: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 8 8" strokeWidth="3" />
    </>
  ),
  fotos: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M4 17l4.5-4.5 3 3 4-4.3 4.5 4.3" />
    </>
  ),
  documentos: (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  ),
  rubros: (
    <>
      <path d="M20 12.5 12.7 19.8a1.5 1.5 0 0 1-2.1 0L3 12.2V5a2 2 0 0 1 2-2h7.3a1.5 1.5 0 0 1 1.1.44L20 10.1a1.5 1.5 0 0 1 0 2.4Z" />
      <circle cx="8.2" cy="8.2" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  materiales: (
    <>
      <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z" />
      <path d="M12 12v9M4 7.5l8 4.5 8-4.5" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="8" r="2.6" />
      <circle cx="16.2" cy="9.2" r="2.1" />
      <path d="M3.3 19c0-3.2 2.5-5.2 5.7-5.2s5.7 2 5.7 5.2" />
      <path d="M14.7 14.1c2.3.3 3.8 2 3.8 4.9" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10.2" r="2.6" />
      <path d="M6.3 18.3c1-2.5 3-3.9 5.7-3.9s4.7 1.4 5.7 3.9" />
    </>
  ),
  salir: (
    <>
      <path d="M9.5 4H6.2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3.3" />
      <path d="M13 8l4 4-4 4" />
      <path d="M17 12H8.5" />
    </>
  ),
  mas: (
    <>
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </>
  ),
  tacho: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" />
      <path d="M6.5 7l.8 11.6A1.6 1.6 0 0 0 8.9 20h6.2a1.6 1.6 0 0 0 1.6-1.4L17.5 7" />
      <path d="M10.2 11v5.5" />
      <path d="M13.8 11v5.5" />
    </>
  ),
};
