"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as ui from "@/components/ui";

/**
 * Un buscador sobre una lista de acordeones: filtra mientras se escribe, sin
 * ir al servidor. Lo usan la agenda de Gremios y los documentos del Archivo.
 *
 * Lo de adentro lo arma el servidor —renglones con forms y enlaces—, así que
 * acá no se re-renderiza: se esconde. Cada acordeón es un
 * `<details data-grupo="...">` (el nombre del grupo también se busca) y cada
 * renglón un elemento con `data-busca="..."`, el texto donde buscar. Con algo
 * escrito, los grupos con coincidencias se abren solos y los que no tienen
 * ninguna se esconden; al borrar la búsqueda vuelven a como estaban.
 *
 * Se esconde con `style.display` y no con `hidden`, porque un estilo con
 * `display` le gana al atributo. Por eso `data-busca` y `data-grupo` van en
 * elementos sin `display` propio: vaciarlo los devuelve a como estaban.
 */
export default function BuscadorEnAcordeones({
  children,
  placeholder,
  etiqueta,
}: {
  children: ReactNode;
  placeholder: string;
  /** Para lectores de pantalla: qué se busca. */
  etiqueta: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState("");
  const [sinResultados, setSinResultados] = useState(false);

  useEffect(() => {
    const raiz = contenedor.current;
    if (!raiz) return;

    const buscado = normalizar(texto.trim());
    let alguno = false;

    for (const grupo of raiz.querySelectorAll<HTMLDetailsElement>("details[data-grupo]")) {
      // El acordeón recuerda si estaba abierto antes de buscar, para dejarlo
      // igual cuando se borre la búsqueda.
      if (buscado && grupo.dataset.abiertoAntes === undefined) {
        grupo.dataset.abiertoAntes = grupo.open ? "1" : "0";
      }

      const coincideGrupo =
        buscado !== "" && normalizar(grupo.dataset.grupo ?? "").includes(buscado);
      let visibles = 0;

      for (const fila of grupo.querySelectorAll<HTMLElement>("[data-busca]")) {
        const ve =
          !buscado || coincideGrupo || normalizar(fila.dataset.busca ?? "").includes(buscado);
        fila.style.display = ve ? "" : "none";
        if (ve) visibles++;
      }

      grupo.style.display = visibles === 0 ? "none" : "";
      if (visibles > 0) alguno = true;

      if (buscado) {
        grupo.open = visibles > 0;
      } else if (grupo.dataset.abiertoAntes !== undefined) {
        grupo.open = grupo.dataset.abiertoAntes === "1";
        delete grupo.dataset.abiertoAntes;
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
        placeholder={placeholder}
        aria-label={etiqueta}
        style={{ ...ui.input, width: "100%", marginBottom: "16px" }}
      />

      {sinResultados && (
        <p style={{ ...ui.note, marginBottom: "16px" }}>
          Nada coincide con &ldquo;{texto.trim()}&rdquo;.
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
