"use client";

import { useEffect, useState } from "react";
import BotonDescarga from "@/components/BotonDescarga";
import { formatDate } from "@/lib/format";

export type RegistroGaleria = {
  id: string;
  rubroNombre: string;
  descripcion: string | null;
  fecha: string | null;
  estado: string;
  subidoPor: string | null;
  fotos: { id: string; driveFileId: string }[];
};

type FotoPlana = {
  id: string;
  driveFileId: string;
  descripcion: string | null;
  fecha: string | null;
};

/**
 * Las fotos de la obra, **agrupadas por rubro en acordeones** que arrancan
 * cerrados. Adentro de cada uno, una tarjeta por registro (cada carga con su
 * detalle) con sus miniaturas.
 *
 * El acordeón es lo que hace usable la pantalla: con varias cargas por rubro la
 * lista de tarjetas se hacía interminable y había que bajar mucho para llegar a
 * un rubro puntual. Cerrado, cada rubro es una línea que dice cuántas fotos
 * tiene; se abre el que se viene a mirar.
 *
 * El visor ampliado recorre TODAS las fotos de la vista con las flechas, en el
 * mismo orden en que se ven —rubro por rubro—, así se puede pasar de largo sin
 * cerrar. El pie muestra el detalle cargado al registro (ej: "Muros planta
 * alta"), no el nombre del archivo.
 */
export default function GaleriaFotos({
  registros,
}: {
  registros: RegistroGaleria[];
}) {
  // Los rubros salen en el orden en que aparece su primer registro, que viene
  // ordenado por fecha: arriba queda el rubro que se tocó último. Se arma sin
  // mutar —un `Set` conserva el orden de aparición— porque el compilador de
  // React no puede razonar sobre un array que se va llenando a empujones, y
  // ahí abajo hay `useCallback` que dependen de esto.
  const grupos = [...new Set(registros.map((r) => r.rubroNombre))].map(
    (rubro) => ({
      rubro,
      registros: registros.filter((r) => r.rubroNombre === rubro),
    })
  );

  // Agrupar cambia el orden de lectura, así que la lista plana del visor se
  // arma sobre el orden ya agrupado: las flechas siguen lo que se ve.
  const ordenados = grupos.flatMap((g) => g.registros);

  const planas: FotoPlana[] = ordenados.flatMap((registro) =>
    registro.fotos.map((foto) => ({
      id: foto.id,
      driveFileId: foto.driveFileId,
      descripcion: registro.descripcion,
      fecha: registro.fecha,
    }))
  );

  const [abierta, setAbierta] = useState<number | null>(null);

  // Cuántas fotos hay para recorrer. Como número suelto y no como `planas`
  // entero: es lo único que necesita el teclado, y un primitivo mantiene las
  // dependencias del efecto quietas entre renders.
  const total = planas.length;

  // Sin `useCallback`: de la memoización se encarga el compilador de React, y
  // atarla a mano obligaba a saltear el componente entero —las listas de las
  // que dependen se arman en el render—. Estas tres son sólo para los botones;
  // el teclado usa el setter directo, para no arrastrarlas al efecto.
  const cerrar = () => setAbierta(null);
  const anterior = () =>
    setAbierta((i) => (i === null ? i : (i - 1 + total) % total));
  const siguiente = () => setAbierta((i) => (i === null ? i : (i + 1) % total));

  useEffect(() => {
    if (abierta === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierta(null);
      if (e.key === "ArrowLeft") {
        setAbierta((i) => (i === null ? i : (i - 1 + total) % total));
      }
      if (e.key === "ArrowRight") {
        setAbierta((i) => (i === null ? i : (i + 1) % total));
      }
    }

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [abierta, total]);

  const foto = abierta === null ? null : planas[abierta];

  // Índice global donde arranca cada registro dentro de la lista plana, para
  // mapear el click de una miniatura a su posición en el visor. Sin acumulador
  // mutable, por lo mismo que los grupos: son unas pocas cargas, así que
  // recontar desde el principio no cuesta nada.
  const base = new Map(
    ordenados.map((registro, i) => [
      registro.id,
      ordenados.slice(0, i).reduce((acc, r) => acc + r.fotos.length, 0),
    ])
  );

  return (
    <div style={lista}>
      {grupos.map((grupo) => {
        const fotos = grupo.registros.reduce(
          (acc, r) => acc + r.fotos.length,
          0
        );

        return (
          /* Con un solo rubro a la vista —filtrando por uno, o una obra que
             tiene uno— abrirlo solo: cerrado sería una pantalla con una línea
             y nada más. */
          <details
            key={grupo.rubro}
            style={panelGrupo}
            open={grupos.length === 1}
          >
            {/* El contenido va en un span aparte: darle display al summary
                borra el triangulito nativo, que es la señal de que abre. */}
            <summary style={resumen}>
              <span style={contenidoResumen}>
                <span style={tituloGrupo}>{grupo.rubro}</span>
                <span style={cuentaGrupo}>
                  {fotos} {fotos === 1 ? "foto" : "fotos"} ·{" "}
                  {grupo.registros.length}{" "}
                  {grupo.registros.length === 1 ? "carga" : "cargas"}
                </span>
              </span>
            </summary>

            {grupo.registros.map((registro, indice) => (
              <article
                key={registro.id}
                style={indice === 0 ? primeraCarga : carga}
              >
                <div style={cabecera}>
                  {/* Sin el rubro arriba: lo dice el acordeón que lo contiene. */}
                  <h3 style={titulo}>
                    {registro.descripcion ?? "Sin descripción"}
                  </h3>

                  <strong style={cantidad}>
                    {registro.fotos.length}{" "}
                    <span style={cantidadLabel}>
                      {registro.fotos.length === 1 ? "foto" : "fotos"}
                    </span>
                  </strong>
                </div>

                {registro.fotos.length === 0 ? (
                  <p style={sinArchivos}>
                    Este registro todavía no tiene archivos subidos.
                  </p>
                ) : (
                  <div style={grilla}>
                    {registro.fotos.map((f, i) => (
                      // El botón de ampliar y el de descargar van como
                      // hermanos: un link dentro de un button sería HTML
                      // inválido.
                      <div key={f.id} style={celda}>
                        <button
                          type="button"
                          onClick={() =>
                            setAbierta((base.get(registro.id) ?? 0) + i)
                          }
                          style={miniaturaBtn}
                          aria-label={`Ampliar ${registro.descripcion ?? "foto"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/archivos/${f.driveFileId}`}
                            alt={registro.descripcion ?? "Foto de obra"}
                            loading="lazy"
                            style={miniatura}
                          />
                        </button>

                        <span style={descargaEsquina}>
                          <BotonDescarga
                            fileId={f.driveFileId}
                            variante="icono"
                            etiqueta={`Descargar ${registro.descripcion ?? "foto"}`}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={pie}>
                  <span>
                    {formatDate(registro.fecha)} · {registro.subidoPor ?? "—"}
                  </span>
                  <span>{registro.estado}</span>
                </div>
              </article>
            ))}
          </details>
        );
      })}

      {foto && (
        <div style={overlay} onClick={cerrar} role="dialog" aria-modal="true">
          <div style={barraVisor} onClick={(e) => e.stopPropagation()}>
            <BotonDescarga
              fileId={foto.driveFileId}
              etiqueta="Descargar"
              titulo={`Descargar ${foto.descripcion ?? "foto"}`}
            />

            <button type="button" onClick={cerrar} style={btnCerrar} aria-label="Cerrar">
              ✕
            </button>
          </div>

          {planas.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                anterior();
              }}
              style={{ ...btnFlecha, left: "16px" }}
              aria-label="Anterior"
            >
              ‹
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/archivos/${foto.driveFileId}`}
            alt={foto.descripcion ?? "Foto de obra"}
            onClick={(e) => e.stopPropagation()}
            style={imagenGrande}
          />

          {planas.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                siguiente();
              }}
              style={{ ...btnFlecha, right: "16px" }}
              aria-label="Siguiente"
            >
              ›
            </button>
          )}

          <div style={pieVisor} onClick={(e) => e.stopPropagation()}>
            <span style={pieDescripcion}>{foto.descripcion ?? "Sin descripción"}</span>
            <span style={contadorVisor}>
              {foto.fecha ? `${formatDate(foto.fecha)} · ` : ""}
              {abierta! + 1} de {planas.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const lista = {
  display: "grid",
  gap: "16px",
};

const panelGrupo = {
  border: "1px solid #e5e5e5",
  padding: "24px",
};

const resumen = {
  cursor: "pointer",
};

const contenidoResumen = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: "14px",
  width: "calc(100% - 28px)",
  verticalAlign: "middle" as const,
};

const tituloGrupo = {
  fontSize: "20px",
};

const cuentaGrupo = {
  fontSize: "13px",
  color: "#999999",
};

// Las cargas de un mismo rubro se separan con una línea, no con otra caja:
// una caja adentro de otra caja se lee como si fueran cosas distintas.
const carga = {
  display: "block",
  borderTop: "1px solid #eeeeee",
  paddingTop: "20px",
  marginTop: "20px",
};

const primeraCarga = {
  ...carga,
  borderTop: "none",
};

const cabecera = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "16px",
};

const titulo = {
  fontSize: "17px",
  fontWeight: 400,
  margin: 0,
  maxWidth: "640px",
};

const cantidad = {
  fontSize: "26px",
  fontWeight: 400,
  whiteSpace: "nowrap" as const,
};

const cantidadLabel = {
  fontSize: "14px",
  color: "#777777",
};

const sinArchivos = {
  color: "#777777",
  fontSize: "14px",
  margin: "0 0 12px",
};

const grilla = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: "10px",
  marginBottom: "16px",
};

const celda = {
  position: "relative" as const,
};

const miniaturaBtn = {
  padding: 0,
  border: "1px solid #e5e5e5",
  background: "#f5f5f5",
  cursor: "pointer",
  aspectRatio: "4 / 3",
  overflow: "hidden" as const,
  display: "block",
  width: "100%",
};

const descargaEsquina = {
  position: "absolute" as const,
  top: "6px",
  right: "6px",
};

const miniatura = {
  width: "100%",
  height: "100%",
  objectFit: "cover" as const,
  display: "block",
};

const pie = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  paddingTop: "16px",
  borderTop: "1px solid #eeeeee",
  color: "#777777",
  fontSize: "14px",
};

const overlay = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0, 0, 0, 0.9)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
};

const imagenGrande = {
  maxWidth: "90vw",
  maxHeight: "85vh",
  objectFit: "contain" as const,
  display: "block",
};

const barraVisor = {
  position: "absolute" as const,
  top: "16px",
  right: "20px",
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const btnCerrar = {
  background: "transparent",
  color: "#ffffff",
  border: "none",
  fontSize: "28px",
  cursor: "pointer",
  lineHeight: 1,
};

const btnFlecha = {
  position: "absolute" as const,
  top: "50%",
  transform: "translateY(-50%)",
  background: "rgba(255, 255, 255, 0.12)",
  color: "#ffffff",
  border: "none",
  fontSize: "40px",
  width: "56px",
  height: "56px",
  cursor: "pointer",
  lineHeight: 1,
};

const pieVisor = {
  position: "absolute" as const,
  bottom: "20px",
  left: 0,
  right: 0,
  textAlign: "center" as const,
  color: "#ffffff",
  display: "flex",
  flexDirection: "column" as const,
  gap: "4px",
  padding: "0 24px",
};

const pieDescripcion = {
  fontSize: "16px",
};

const contadorVisor = {
  color: "#bbbbbb",
  fontSize: "13px",
};
