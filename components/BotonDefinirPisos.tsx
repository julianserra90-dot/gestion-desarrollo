"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import DefinicionDePisos from "@/components/DefinicionDePisos";
import * as ui from "@/components/ui";
import type { Piso } from "@/lib/pisos";

/**
 * El botón que abre la definición de pisos desde una página que no es el
 * editor —el listado de plantas, el 3D—. La definición es de la obra entera,
 * no de una planta: tiene que poder abrirse sin entrar a ninguna.
 *
 * Con `faltan`, cuántos pisos no aparecen en el 3D: va como un número rojo en
 * la esquina del botón —el lugar donde se arregla—, y el porqué en su `title`,
 * en vez de un renglón de aviso encima del dibujo.
 */
export default function BotonDefinirPisos({
  pisos,
  plantas,
  guardar,
  faltan,
  enBarra = false,
}: {
  pisos: Piso[];
  plantas: { id: string; nombre: string }[];
  guardar: (pisos: Piso[]) => Promise<{ error?: string }>;
  faltan?: { cuantos: number; porque: string };
  /** En una barra de 38 px, a la altura del volver y de las pastillas. */
  enBarra?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const conFaltas = faltan !== undefined && faltan.cuantos > 0;
  const estilo = {
    ...ui.secondaryButton,
    ...(enBarra ? barra : {}),
    ...(conFaltas ? { position: "relative" as const } : {}),
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={conFaltas ? faltan.porque : undefined}
        style={estilo}
      >
        Definir pisos
        {conFaltas && <span style={marca}>{faltan.cuantos}</span>}
      </button>

      {abierto && (
        <DefinicionDePisos
          pisos={pisos}
          plantas={plantas}
          guardar={async (nuevos) => {
            const resultado = await guardar(nuevos);
            if (!resultado.error) router.refresh();
            return resultado;
          }}
          alCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}

const barra = {
  display: "inline-flex",
  alignItems: "center",
  height: "38px",
  boxSizing: "border-box" as const,
  padding: "0 16px",
  fontFamily: "inherit",
};

const marca = {
  position: "absolute" as const,
  top: "-7px",
  right: "-7px",
  minWidth: "20px",
  height: "20px",
  boxSizing: "border-box" as const,
  padding: "0 6px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  background: ui.ROJO,
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: 1,
};
