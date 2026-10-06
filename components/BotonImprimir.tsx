"use client";

import * as ui from "@/components/ui";

/**
 * Imprime la pantalla, o la guarda como PDF desde el diálogo del navegador.
 *
 * Lo que no va en papel —barra lateral, catálogo, botones— se esconde con
 * `data-no-imprimir` (ver `globals.css`).
 */
export default function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={ui.secondaryButton}
      data-no-imprimir
    >
      Imprimir / PDF
    </button>
  );
}
