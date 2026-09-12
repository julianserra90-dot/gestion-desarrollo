"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * El "← Volver" de toda pantalla que está adentro de una solapa: fichas,
 * formularios, catálogos, detalles.
 *
 * Sin props sale solo, desde la cabecera de la obra: si la URL es más honda
 * que `/obras/<slug>/<solapa>`, hay adónde volver. Vuelve a la pantalla
 * anterior, que es lo que uno espera —una ficha abierta desde Materiales
 * vuelve a Materiales, abierta desde Gastos vuelve a Gastos—. Cuando la
 * anterior es un formulario que acaba de guardar (se llegó por su
 * redirección) o no hay historial, va a la solapa: volver al formulario recién
 * enviado no es volver.
 *
 * Con `href` es un enlace fijo que dice adónde va ("← Balance"): para las
 * pantallas de primer nivel que igual tienen un origen claro, como Gastos
 * cuando se entra por una tarjeta del Balance.
 */
export default function Volver({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (href) {
    return (
      <Link href={href} style={enlace}>
        ← {children ?? "Volver"}
      </Link>
    );
  }

  const partes = pathname.split("/").filter(Boolean);
  if (partes[0] !== "obras" || partes.length <= 3) return null;

  const solapa = "/" + partes.slice(0, 3).join("/");

  const volver = () => {
    const anterior = document.referrer;
    const esDeLaApp = anterior.startsWith(window.location.origin);
    const esFormulario = /\/(nuevo|editar)(\?|$)/.test(anterior);
    if (esDeLaApp && !esFormulario && window.history.length > 1) {
      router.back();
    } else {
      router.push(solapa);
    }
  };

  return (
    <button type="button" onClick={volver} style={boton}>
      ← Volver
    </button>
  );
}

const enlace = {
  display: "inline-block",
  color: "#555555",
  fontSize: "14px",
  textDecoration: "none",
  marginBottom: "12px",
};

const boton = {
  ...enlace,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "inherit",
};
