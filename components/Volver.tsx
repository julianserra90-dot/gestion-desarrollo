"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import * as ui from "@/components/ui";

/**
 * El "← Volver" de toda la app: un solo aspecto (`ui.volver`) en todas las
 * pantallas, para que salir de cualquiera se haga siempre igual.
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
 * pantallas que tienen un origen claro.
 *
 * Suelto va encima de la cabecera, con aire debajo; dentro de una barra,
 * `enBarra` le saca ese aire para que quede alineado con lo demás.
 */
export default function Volver({
  href,
  children,
  enBarra = false,
}: {
  href?: string;
  children?: ReactNode;
  enBarra?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const estilo: CSSProperties = enBarra ? ui.volver : { ...ui.volver, marginBottom: "16px" };

  if (href) {
    return (
      <Link href={href} style={estilo}>
        <Flecha />
        {children ?? "Volver"}
      </Link>
    );
  }

  const partes = pathname.split("/").filter(Boolean);
  if (partes[0] !== "obras" || partes.length <= 3) return null;

  const solapa = "/" + partes.slice(0, 3).join("/");

  const volver = () => {
    const anterior = document.referrer;
    const esDeLaApp = anterior.startsWith(window.location.origin);
    const esFormulario = /\/(nuev[oa]|editar)(\?|$)/.test(anterior);
    if (esDeLaApp && !esFormulario && window.history.length > 1) {
      router.back();
    } else {
      router.push(solapa);
    }
  };

  return (
    <button type="button" onClick={volver} style={estilo}>
      <Flecha />
      {children ?? "Volver"}
    </button>
  );
}

function Flecha() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <path
        d="M13 8H3.5M7.5 3.5 3 8l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
