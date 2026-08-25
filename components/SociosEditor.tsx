"use client";

import { useState } from "react";

export type Empresa = { id: string; nombre: string };
export type SocioInicial = { empresa_id: string; porcentaje: number };

export default function SociosEditor({
  empresas,
  iniciales,
}: {
  empresas: Empresa[];
  iniciales: SocioInicial[];
}) {
  const [socios, setSocios] = useState<SocioInicial[]>(
    iniciales.length > 0 ? iniciales : [{ empresa_id: "", porcentaje: 100 }]
  );

  const suma = socios.reduce((acc, s) => acc + (Number(s.porcentaje) || 0), 0);
  const cierra = Math.abs(suma - 100) <= 0.05;

  function actualizar(indice: number, cambio: Partial<SocioInicial>) {
    setSocios(socios.map((s, i) => (i === indice ? { ...s, ...cambio } : s)));
  }

  function agregar() {
    setSocios([...socios, { empresa_id: "", porcentaje: 0 }]);
  }

  function quitar(indice: number) {
    setSocios(socios.filter((_, i) => i !== indice));
  }

  /**
   * Reparte 100 entre todas. El sobrante de redondeo va a la primera, así
   * 3 socias dan 33,34 + 33,33 + 33,33 y suman exactamente 100.
   */
  function repartirIgual() {
    if (socios.length === 0) return;

    const base = Math.floor((100 / socios.length) * 100) / 100;
    const resto = Math.round((100 - base * socios.length) * 100) / 100;

    setSocios(
      socios.map((s, i) => ({ ...s, porcentaje: i === 0 ? base + resto : base }))
    );
  }

  const disponibles = (indice: number) =>
    empresas.filter(
      (e) =>
        e.id === socios[indice].empresa_id ||
        !socios.some((s) => s.empresa_id === e.id)
    );

  return (
    <div style={contenedor}>
      <div style={encabezado}>
        <div>
          <h3 style={titulo}>Empresas socias</h3>
        </div>

        <button type="button" onClick={repartirIgual} style={botonChico}>
          Repartir en partes iguales
        </button>
      </div>

      <div style={filas}>
        {socios.map((socio, i) => (
          <div key={i} style={fila}>
            <select
              name="socio_empresa_id"
              value={socio.empresa_id}
              onChange={(e) => actualizar(i, { empresa_id: e.target.value })}
              style={input}
            >
              <option value="">Seleccionar empresa</option>
              {disponibles(i).map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </select>

            <div style={campoPorcentaje}>
              <input
                type="number"
                name="socio_porcentaje"
                min="0"
                max="100"
                step="0.01"
                value={socio.porcentaje}
                onChange={(e) =>
                  actualizar(i, { porcentaje: Number(e.target.value) })
                }
                style={input}
              />
              <span style={sufijo}>%</span>
            </div>

            <button
              type="button"
              onClick={() => quitar(i)}
              disabled={socios.length === 1}
              style={socios.length === 1 ? botonQuitarInactivo : botonQuitar}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <div style={pie}>
        <button type="button" onClick={agregar} style={botonChico}>
          Agregar empresa
        </button>

        <span style={cierra ? totalOk : totalMal}>
          Suma: {suma.toFixed(2)}%
          {cierra ? "" : " — tiene que dar 100%"}
        </span>
      </div>
    </div>
  );
}

const contenedor = {
  border: "1px solid #e5e5e5",
  padding: "24px",
  marginTop: "24px",
};

const encabezado = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "20px",
};

const titulo = {
  fontSize: "18px",
  fontWeight: 400,
  margin: "0 0 6px",
};

const filas = {
  display: "grid",
  gap: "12px",
};

const fila = {
  display: "grid",
  gridTemplateColumns: "1fr 140px auto",
  gap: "12px",
  alignItems: "center",
};

const input = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #dcdcdc",
  background: "#ffffff",
  padding: "12px",
  fontSize: "14px",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111111",
};

const campoPorcentaje = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const sufijo = {
  color: "#777777",
  fontSize: "14px",
};

const botonChico = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "10px 14px",
  fontSize: "13px",
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const botonQuitar = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  padding: "12px 14px",
  fontSize: "13px",
  cursor: "pointer",
};

const botonQuitarInactivo = {
  ...botonQuitar,
  color: "#bbbbbb",
  cursor: "not-allowed",
};

const pie = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderTop: "1px solid #eeeeee",
  marginTop: "20px",
  paddingTop: "20px",
};

const totalOk = {
  fontSize: "14px",
  color: "#111111",
};

const totalMal = {
  fontSize: "14px",
  color: "#111111",
  borderBottom: "2px solid #111111",
  paddingBottom: "2px",
};
