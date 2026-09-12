"use client";

import Link from "next/link";
import { useState } from "react";
import IconoObra, { type NombreIcono } from "@/components/IconoObra";
import { SECCIONES } from "@/components/ObraHeader";
import { ANCHO_SIDEBAR_CERRADO } from "@/lib/layout";

/** El ícono de cada sección hija. Vive acá y no en `ObraHeader` porque es lo
 *  único de este mapeo que le importa a la barra lateral. */
const ICONOS: Record<string, NombreIcono> = {
  economia: "balance",
  gastos: "gastos",
  ingresos: "ingresos",
  inversores: "inversores",
  flujo: "flujo",
  lote: "lote",
  dolares: "dolares",
  beneficio: "beneficio",
  estado: "estado",
  presupuestos: "presupuestos",
  avances: "avances",
  fotos: "fotos",
  documentos: "documentos",
  rubros: "rubros",
  materiales: "materiales",
};

const ICONO_GRUPO: Record<string, NombreIcono> = {
  economia: "billetera",
  obra: "edificio",
};

/**
 * Reemplazo (por ahora sólo en Balance, a modo de muestra) de las dos filas
 * de pestañas de `ObraHeader` por una franja de íconos fija a la izquierda,
 * que se expande al pasar el mouse — como el panel de Supabase.
 *
 * Sólo se listan las secciones del grupo activo (Economía u Obra); para
 * pasar al otro grupo está el selector de arriba, que también sirve para ver
 * en qué grupo se está aunque la franja esté cerrada.
 *
 * Al no empujar el contenido (es `position: fixed`), expandirse no reacomoda
 * nada: se superpone un momento y listo, sin saltos de layout.
 */
export default function ObraSidebar({
  obraSlug,
  activeSection,
}: {
  obraSlug: string;
  activeSection: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const href = (path: string) => `/obras/${obraSlug}${path}`;

  const grupo =
    SECCIONES.find(
      (s) => s.key === activeSection || s.hijas?.some((h) => h.key === activeSection)
    ) ?? SECCIONES[0];

  return (
    <aside
      style={abierta ? { ...rail, width: ANCHO_ABIERTO } : rail}
      onMouseEnter={() => setAbierta(true)}
      onMouseLeave={() => setAbierta(false)}
    >
      {/* Lo que no es navegar por la obra: salir de ella y editarla. Juntos
          arriba, donde se ven; abajo del todo el engranaje pasaba
          desapercibido y la cabecera lo repetía. */}
      <Link href="/" style={filaChrome} title="Volver a obras">
        <IconoObra nombre="grid" />
        {abierta && <span>Volver a obras</span>}
      </Link>

      <Link href={href("/editar")} style={filaChrome} title="Editar obra">
        <IconoObra nombre="engranaje" />
        {abierta && <span>Editar obra</span>}
      </Link>

      <div style={separador} />

      <div style={grupoSwitch}>
        {SECCIONES.map((s) => (
          <Link
            key={s.key}
            href={href(s.path)}
            style={grupo.key === s.key ? filaGrupoActiva : filaGrupo}
            title={s.label}
          >
            <IconoObra nombre={ICONO_GRUPO[s.key]} />
            {abierta && <span>{s.label}</span>}
          </Link>
        ))}
      </div>

      <div style={separador} />

      <nav style={itemsNav}>
        {grupo.hijas?.map((h) => (
          <Link
            key={h.key}
            href={href(h.path)}
            style={activeSection === h.key ? filaActiva : fila}
            title={h.label}
          >
            <IconoObra nombre={ICONOS[h.key]} />
            {abierta && <span>{h.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

const ANCHO_ABIERTO = 248;

const rail = {
  position: "fixed" as const,
  top: 0,
  left: 0,
  bottom: 0,
  width: ANCHO_SIDEBAR_CERRADO,
  background: "#ffffff",
  borderRight: "1px solid #eeeeee",
  boxShadow: "4px 0 24px rgba(17, 17, 17, 0.04)",
  display: "flex",
  flexDirection: "column" as const,
  padding: "16px 0",
  gap: "4px",
  overflow: "hidden" as const,
  zIndex: 40,
  transition: "width 0.15s ease",
};

const filaBase = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "10px 20px",
  color: "#555555",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
  fontSize: "14px",
};

const filaChrome = {
  ...filaBase,
  color: "#999999",
};

const separador = {
  height: "1px",
  background: "#eeeeee",
  margin: "8px 20px",
};

const grupoSwitch = {
  display: "flex",
  flexDirection: "column" as const,
};

const filaGrupo = {
  ...filaBase,
};

const filaGrupoActiva = {
  ...filaBase,
  color: "#111111",
  fontWeight: 600,
};

const itemsNav = {
  display: "flex",
  flexDirection: "column" as const,
  flex: 1,
  overflowY: "auto" as const,
};

const fila = {
  ...filaBase,
};

// Pastilla negra a la izquierda del ícono, no todo el fondo: así queda claro
// que es una lista de igual jerarquía y no un botón.
const filaActiva = {
  ...filaBase,
  color: "#111111",
  fontWeight: 600,
  background: "#f5f5f5",
};
