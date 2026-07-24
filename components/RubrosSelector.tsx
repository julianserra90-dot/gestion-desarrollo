"use client";

import { useState } from "react";
import * as ui from "@/components/ui";

export type RubroDeObra = {
  id: string;
  nombre: string;
  activo: boolean;
  /** Cuántos gastos, avances o fotos lo usan. */
  usos: number;
};

export default function RubrosSelector({
  slug,
  obraId,
  rubros,
  guardar,
  eliminar,
  crear,
}: {
  slug: string;
  obraId: string;
  rubros: RubroDeObra[];
  guardar: (formData: FormData) => void;
  /** Lleva el id atado: React no deja usar `name` en un botón con formAction. */
  eliminar: (rubroId: string, formData: FormData) => void;
  crear: (formData: FormData) => void;
}) {
  // El estado vive acá para poder marcar de a varios y guardar una sola vez.
  const [marcados, setMarcados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rubros.map((r) => [r.id, r.activo]))
  );
  const [buscar, setBuscar] = useState("");

  const termino = buscar.trim().toLowerCase();
  const visibles = termino
    ? rubros.filter((r) => r.nombre.toLowerCase().includes(termino))
    : rubros;

  const cantidad = rubros.filter((r) => marcados[r.id]).length;

  function marcarTodos(valor: boolean) {
    // Sólo los que se están viendo: con un filtro activo, "marcar todos" sobre
    // la lista entera sería una sorpresa desagradable.
    setMarcados((antes) => ({
      ...antes,
      ...Object.fromEntries(visibles.map((r) => [r.id, valor])),
    }));
  }

  return (
    <>
      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Agregar un rubro que no está</h3>

        <form action={crear} style={formNuevo}>
          <input type="hidden" name="obra_id" value={obraId} />
          <input type="hidden" name="slug" value={slug} />

          <input
            type="text"
            name="nombre"
            placeholder="Ej: Colocación de revestimientos"
            required
            style={ui.input}
          />

          <button type="submit" style={ui.button}>
            Agregar
          </button>
        </form>

        <p style={{ ...ui.note, marginTop: "12px", marginBottom: 0 }}>
          Se agrega ya marcado y sólo a esta obra. Las demás no se enteran. Si
          lleva sólo material o sólo mano de obra, eso se marca en{" "}
          <strong>Presupuestos</strong>.
        </p>
      </section>

      <form action={guardar}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="obra_id" value={obraId} />

        <div style={ui.toolbar}>
          <h3 style={ui.sectionTitle}>
            Rubros de la obra{" "}
            <span style={contador}>
              ({cantidad} de {rubros.length} marcados)
            </span>
          </h3>

          <div style={acciones}>
            <input
              type="text"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar"
              style={{ ...ui.input, width: "180px" }}
            />
            <button
              type="button"
              onClick={() => marcarTodos(true)}
              style={ui.secondaryButton}
            >
              Marcar todos
            </button>
            <button
              type="button"
              onClick={() => marcarTodos(false)}
              style={ui.secondaryButton}
            >
              Desmarcar
            </button>
            <button type="submit" style={ui.button}>
              Guardar
            </button>
          </div>
        </div>

        <section style={ui.panel}>
          {visibles.length === 0 ? (
            <p style={ui.vacio}>Ningún rubro coincide con “{buscar}”.</p>
          ) : (
            <div style={grilla}>
              {visibles.map((rubro) => (
                <div
                  key={rubro.id}
                  style={marcados[rubro.id] ? filaMarcada : fila}
                >
                  {/* Va el id de cada fila visible para que el server sepa
                      cuáles revisar. Un checkbox desmarcado no se envía. */}
                  <input type="hidden" name="rubro_ids" value={rubro.id} />

                  <label style={celdaCheck}>
                    <input
                      type="checkbox"
                      name={`activo_${rubro.id}`}
                      checked={marcados[rubro.id] ?? false}
                      onChange={(e) =>
                        setMarcados((antes) => ({
                          ...antes,
                          [rubro.id]: e.target.checked,
                        }))
                      }
                    />
                  </label>

                  <input
                    type="text"
                    name={`nombre_${rubro.id}`}
                    defaultValue={rubro.nombre}
                    required
                    style={ui.input}
                  />

                  <div style={celdaUso}>
                    {rubro.usos > 0 ? (
                      <span style={enUso}>
                        {rubro.usos} {rubro.usos === 1 ? "registro" : "registros"}
                      </span>
                    ) : (
                      <button
                        type="submit"
                        formAction={eliminar.bind(null, rubro.id)}
                        style={ui.secondaryButton}
                        formNoValidate
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p style={{ ...ui.note, marginTop: "16px" }}>
          Desmarcar no borra nada: un rubro con gastos cargados sigue
          mostrándolos, sólo deja de ofrecerse para cargar cosas nuevas. Los que
          no tienen ningún registro sí se pueden eliminar.
        </p>

        <p style={{ ...ui.note, marginTop: "10px" }}>
          Si un rubro lleva sólo material o sólo mano de obra, eso se marca en
          la solapa <strong>Presupuestos</strong>, al lado del rubro.
        </p>
      </form>
    </>
  );
}

const formNuevo = {
  display: "flex",
  gap: "12px",
  marginTop: "16px",
  maxWidth: "520px",
};

const acciones = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const grilla = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "10px 24px",
};

const fila = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "12px",
  padding: "8px 10px",
  border: "1px solid #ffffff",
};

// Un fondo apenas gris alcanza para ver de un vistazo cuáles están elegidos.
const filaMarcada = {
  ...fila,
  background: "#fafafa",
  border: "1px solid #eeeeee",
};

const celdaCheck = {
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
};

const celdaUso = {
  fontSize: "13px",
  color: "#999999",
  whiteSpace: "nowrap" as const,
};

const enUso = {
  color: "#777777",
};

const contador = {
  color: "#999999",
  fontSize: "15px",
};
