"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import DefinicionDePisos from "@/components/DefinicionDePisos";
import * as ui from "@/components/ui";
import type { Piso } from "@/lib/pisos";

/**
 * El botón que abre la definición de pisos desde una página que no es el
 * editor —el listado de plantas—. La definición es de la obra entera, no de
 * una planta: tiene que poder abrirse sin entrar a ninguna.
 */
export default function BotonDefinirPisos({
  pisos,
  plantas,
  guardar,
}: {
  pisos: Piso[];
  plantas: { id: string; nombre: string }[];
  guardar: (pisos: Piso[]) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} style={ui.secondaryButton}>
        Definir pisos
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
