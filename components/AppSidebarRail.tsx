"use client";

import Link from "next/link";
import { useState } from "react";
import { cerrarSesion } from "@/app/login/actions";
import IconoObra, { type NombreIcono } from "@/components/IconoObra";
import { ANCHO_SIDEBAR_CERRADO } from "@/lib/layout";

export type ItemSidebar = {
  clave: string;
  label: string;
  href: string;
  icono: NombreIcono;
};

/**
 * La franja en sí: lo único que necesita ser cliente es abrirse al pasar el
 * mouse. Qué destinos entran lo decide `AppSidebar`, que sí puede leer el rol.
 */
export default function AppSidebarRail({
  activo,
  items,
}: {
  activo: string;
  items: ItemSidebar[];
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <aside
      style={abierta ? { ...rail, width: ANCHO_ABIERTO } : rail}
      onMouseEnter={() => setAbierta(true)}
      onMouseLeave={() => setAbierta(false)}
    >
      <nav style={itemsNav}>
        {items.map((item) => (
          <Link
            key={item.clave}
            href={item.href}
            style={activo === item.clave ? filaActiva : fila}
            title={item.label}
          >
            <IconoObra nombre={item.icono} />
            {abierta && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <form action={cerrarSesion} style={{ marginTop: "auto" }}>
        <button type="submit" style={filaBoton} title="Salir">
          <IconoObra nombre="salir" />
          {abierta && <span>Salir</span>}
        </button>
      </form>
    </aside>
  );
}

const ANCHO_ABIERTO = 220;

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
  overflow: "hidden" as const,
  zIndex: 40,
  transition: "width 0.15s ease",
};

const itemsNav = {
  display: "flex",
  flexDirection: "column" as const,
  flex: 1,
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

const fila = { ...filaBase };

const filaActiva = {
  ...filaBase,
  color: "#111111",
  fontWeight: 600,
  background: "#f5f5f5",
};

const filaBoton = {
  ...filaBase,
  width: "100%",
  boxSizing: "border-box" as const,
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "Arial, Helvetica, sans-serif",
};
