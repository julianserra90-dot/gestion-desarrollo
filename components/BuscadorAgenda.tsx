"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as ui from "@/components/ui";

/**
 * El buscador de la agenda de Gremios: filtra mientras se escribe, por nombre,
 * teléfono o rubro, sin ir al servidor.
 *
 * Los renglones los arma el servidor —son forms con server actions— así que
 * acá no se re-renderizan: se esconden. Cada acordeón de rubro es un
 * `<details data-rubro="...">` y cada renglón un `[data-busca="..."]` con el
 * texto donde buscar. Con algo escrito, los rubros con coincidencias se abren
 * solos y los que no tienen ninguna se esconden; al borrar la búsqueda vuelven
 * a como estaban.
 */
export default function BuscadorAgenda({ children }: { children: ReactNode }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState("");
  const [sinResultados, setSinResultados] = useState(false);

  useEffect(() => {
    const raiz = contenedor.current;
    if (!raiz) return;

    const buscado = normalizar(texto.trim());
    let alguno = false;

    for (const rubro of raiz.querySelectorAll<HTMLDetailsElement>("details[data-rubro]")) {
      // El acordeón recuerda si estaba abierto antes de buscar, para dejarlo
      // igual cuando se borre la búsqueda.
      if (buscado && rubro.dataset.abiertoAntes === undefined) {
        rubro.dataset.abiertoAntes = rubro.open ? "1" : "0";
      }

      const coincideRubro = buscado !== "" && normalizar(rubro.dataset.rubro ?? "").includes(buscado);
      let visibles = 0;

      for (const fila of rubro.querySelectorAll<HTMLElement>("[data-busca]")) {
        const ve =
          !buscado || coincideRubro || normalizar(fila.dataset.busca ?? "").includes(buscado);
        // `style.display` y no `hidden`: un estilo con `display` le gana al
        // atributo. Por eso `data-busca` y `data-rubro` van en elementos sin
        // `display` propio, y vaciarlo los devuelve a como estaban.
        fila.style.display = ve ? "" : "none";
        if (ve) visibles++;
      }

      rubro.style.display = visibles === 0 ? "none" : "";
      if (visibles > 0) alguno = true;

      if (buscado) {
        rubro.open = visibles > 0;
      } else if (rubro.dataset.abiertoAntes !== undefined) {
        rubro.open = rubro.dataset.abiertoAntes === "1";
        delete rubro.dataset.abiertoAntes;
      }
    }

    setSinResultados(buscado !== "" && !alguno);
  }, [texto]);

  return (
    <div ref={contenedor}>
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por nombre, teléfono o rubro"
        aria-label="Buscar en la agenda"
        style={{ ...ui.input, width: "100%", marginBottom: "16px" }}
      />

      {sinResultados && (
        <p style={{ ...ui.note, marginBottom: "16px" }}>
          Nadie coincide con &ldquo;{texto.trim()}&rdquo;.
        </p>
      )}

      {children}
    </div>
  );
}

/** Sin mayúsculas ni tildes: "albañileria" encuentra "Albañilería". */
function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
