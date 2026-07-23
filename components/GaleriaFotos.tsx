"use client";

import { useCallback, useEffect, useState } from "react";
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
 * Muestra las fotos agrupadas por registro (cada tarjeta con su detalle), pero
 * el visor ampliado recorre TODAS las fotos de la vista actual con las flechas.
 *
 * Así, si estás filtrando por un rubro, al abrir una foto podés pasar por todas
 * las de ese rubro sin cerrar. El pie muestra el detalle cargado al registro
 * (ej: "Muros planta alta"), no el nombre del archivo.
 */
export default function GaleriaFotos({
  registros,
}: {
  registros: RegistroGaleria[];
}) {
  // Lista plana en el mismo orden en que se ven, para navegar de corrido.
  const planas: FotoPlana[] = registros.flatMap((registro) =>
    registro.fotos.map((foto) => ({
      id: foto.id,
      driveFileId: foto.driveFileId,
      descripcion: registro.descripcion,
      fecha: registro.fecha,
    }))
  );

  const [abierta, setAbierta] = useState<number | null>(null);

  const cerrar = useCallback(() => setAbierta(null), []);
  const anterior = useCallback(
    () => setAbierta((i) => (i === null ? i : (i - 1 + planas.length) % planas.length)),
    [planas.length]
  );
  const siguiente = useCallback(
    () => setAbierta((i) => (i === null ? i : (i + 1) % planas.length)),
    [planas.length]
  );

  useEffect(() => {
    if (abierta === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") siguiente();
    }

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [abierta, cerrar, anterior, siguiente]);

  const foto = abierta === null ? null : planas[abierta];

  // Índice global donde arranca cada registro dentro de la lista plana, para
  // mapear el click de una miniatura a su posición en el visor.
  const bases: number[] = [];
  registros.reduce((acum, registro) => {
    bases.push(acum);
    return acum + registro.fotos.length;
  }, 0);

  return (
    <div style={lista}>
      {registros.map((registro, indiceRegistro) => {
        const base = bases[indiceRegistro];

        return (
          <article key={registro.id} style={tarjeta}>
            <div style={cabecera}>
              <div>
                <p style={eyebrow}>{registro.rubroNombre}</p>
                <h3 style={titulo}>{registro.descripcion ?? "Sin descripción"}</h3>
              </div>

              <strong style={cantidad}>
                {registro.fotos.length}{" "}
                <span style={cantidadLabel}>
                  {registro.fotos.length === 1 ? "foto" : "fotos"}
                </span>
              </strong>
            </div>

            {registro.fotos.length === 0 ? (
              <p style={sinArchivos}>Este registro todavía no tiene archivos subidos.</p>
            ) : (
              <div style={grilla}>
                {registro.fotos.map((f, i) => (
                  // El botón de ampliar y el de descargar van como hermanos: un
                  // link dentro de un button sería HTML inválido.
                  <div key={f.id} style={celda}>
                    <button
                      type="button"
                      onClick={() => setAbierta(base + i)}
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

const tarjeta = {
  border: "1px solid #e5e5e5",
  padding: "24px",
};

const cabecera = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "16px",
};

const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "#777777",
  margin: 0,
};

const titulo = {
  fontSize: "20px",
  fontWeight: 400,
  margin: "8px 0 0",
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
