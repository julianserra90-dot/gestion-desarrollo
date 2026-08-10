"use client";

import { useState } from "react";
import {
  COEF_DESCUBIERTA,
  COEF_SEMICUBIERTA,
  construccionDe,
} from "@/lib/superficies";

/**
 * El bloque de superficies del formulario de obra.
 *
 * El desglose (cubierta/semi/descubierta + coeficientes) arma la superficie de
 * construcción, que se muestra en vivo mientras se carga. La de venta es un
 * campo aparte, a mano: es la neta vendible y no se deriva del desglose.
 */
export default function SuperficiesObra({
  cubierta,
  semicubierta,
  descubierta,
  coefSemi,
  coefDesc,
  venta,
  estilos,
}: {
  cubierta: number | null;
  semicubierta: number | null;
  descubierta: number | null;
  coefSemi: number | null;
  coefDesc: number | null;
  venta: number | null;
  estilos: {
    field: React.CSSProperties;
    label: React.CSSProperties;
    input: React.CSSProperties;
    ayuda: React.CSSProperties;
  };
}) {
  const [cub, setCub] = useState(cubierta?.toString() ?? "");
  const [semi, setSemi] = useState(semicubierta?.toString() ?? "");
  const [desc, setDesc] = useState(descubierta?.toString() ?? "");
  const [cSemi, setCSemi] = useState(String(coefSemi ?? 0.5));
  const [cDesc, setCDesc] = useState(String(coefDesc ?? 0));

  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const construccion = construccionDe(
    num(cub),
    num(semi),
    num(desc),
    num(cSemi),
    num(cDesc)
  );

  return (
    <>
      <label style={estilos.field}>
        <span style={estilos.label}>Superficie cubierta (m²)</span>
        <input
          type="number"
          name="sup_cubierta_m2"
          min="0"
          step="0.01"
          value={cub}
          onChange={(e) => setCub(e.target.value)}
          placeholder="0"
          style={estilos.input}
        />
        <span style={estilos.ayuda}>Cerrada y techada. Cuenta al 100%.</span>
      </label>

      <label style={estilos.field}>
        <span style={estilos.label}>Semicubierta (m²)</span>
        <input
          type="number"
          name="sup_semicubierta_m2"
          min="0"
          step="0.01"
          value={semi}
          onChange={(e) => setSemi(e.target.value)}
          placeholder="0"
          style={estilos.input}
        />
      </label>

      <label style={estilos.field}>
        <span style={estilos.label}>Semicubierta cuenta al</span>
        <select
          name="coef_semicubierta"
          value={cSemi}
          onChange={(e) => setCSemi(e.target.value)}
          style={estilos.input}
        >
          {COEF_SEMICUBIERTA.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <span style={estilos.ayuda}>De la superficie de construcción.</span>
      </label>

      <label style={estilos.field}>
        <span style={estilos.label}>Descubierta (m²)</span>
        <input
          type="number"
          name="sup_descubierta_m2"
          min="0"
          step="0.01"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="0"
          style={estilos.input}
        />
        <span style={estilos.ayuda}>Patios, terrazas sin techo.</span>
      </label>

      <label style={estilos.field}>
        <span style={estilos.label}>Descubierta cuenta al</span>
        <select
          name="coef_descubierta"
          value={cDesc}
          onChange={(e) => setCDesc(e.target.value)}
          style={estilos.input}
        >
          {COEF_DESCUBIERTA.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <span style={estilos.ayuda}>De la superficie de construcción.</span>
      </label>

      <div style={estilos.field}>
        <span style={estilos.label}>Superficie de construcción</span>
        <strong style={{ fontSize: "20px" }}>
          {construccion > 0 ? `${+construccion.toFixed(2)} m²` : "—"}
        </strong>
        <span style={estilos.ayuda}>
          Se calcula del desglose de arriba.
        </span>
      </div>

      <label style={estilos.field}>
        <span style={estilos.label}>Superficie de venta (m²)</span>
        <input
          type="number"
          name="sup_venta_m2"
          min="0"
          step="0.01"
          defaultValue={venta ?? ""}
          placeholder="0"
          style={estilos.input}
        />
        <span style={estilos.ayuda}>
          La neta vendible. Se carga a mano: no sale de la construcción.
        </span>
      </label>
    </>
  );
}
