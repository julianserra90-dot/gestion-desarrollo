import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonDefinirPisos from "@/components/BotonDefinirPisos";
import Edificio3D, { type PisoEn3D } from "@/components/Edificio3D";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { type Modelo, modeloDePlanta } from "@/lib/planta-3d";
import { getCapasDisponibles, getPisos, getPlantas, getTiposDeMuro } from "@/lib/plantas";
import { editarEnPlanta, guardarPisos } from "../actions";

/**
 * El edificio en 3D: cada piso de la obra con la planta que le toca, a su
 * nivel.
 *
 * Los sólidos se arman acá, en el servidor (`modeloDePlanta`), y al visor le
 * llegan hechos: así el navegador no baja los dibujos enteros ni rehace las
 * cuentas, y lo que se ve es lo mismo que se computa.
 *
 * Muestra lo **guardado**: un dibujo abierto en el editor con cambios sin
 * guardar no está acá todavía.
 */
export default async function Edificio3DPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const [plantas, pisosDeObra, capas, tiposDeMuro] = await Promise.all([
    getPlantas(obra.id),
    getPisos(obra.id),
    getCapasDisponibles(),
    getTiposDeMuro(),
  ]);
  // Cómo se llama cada tarea del catálogo: es lo que dice de qué está hecho
  // un muro o qué capas lleva un piso al tocarlo.
  const nombres = new Map([...capas, ...tiposDeMuro].map((t) => [t.id, t.nombre]));

  // El modelo de cada planta que algún piso usa, una sola vez.
  const modelos: Record<string, Modelo> = {};
  for (const planta of plantas) {
    const suPiso = pisosDeObra.find((p) => p.plantaId === planta.id);
    if (!suPiso) continue;
    const modelo = modeloDePlanta(planta, suPiso.altura, nombres);
    if (modelo && modelo.solidos.length > 0) modelos[planta.id] = modelo;
  }

  const pisos: PisoEn3D[] = pisosDeObra.map((p) => ({
    numero: p.numero,
    nombre: p.nombre,
    cota: p.cota,
    planta: p.plantaId,
  }));

  // Lo que falta para que el edificio esté entero, dicho antes del dibujo:
  // un piso que no aparece no puede parecer que no existe.
  const sinPlanta = pisosDeObra.filter((p) => p.plantaId === null).length;
  const sinDibujo = pisosDeObra.filter(
    (p) => p.plantaId !== null && modelos[p.plantaId] === undefined
  ).length;
  const hayAlgo = pisos.some((p) => p.planta !== null && modelos[p.planta] !== undefined);

  return (
    <AppShell
      pantallaCompleta
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="plantas" />}
    >
      <div style={marco}>
        <div style={barra}>
          <div style={lado}>
            <Link href={`/obras/${obra.slug}/plantas`} style={volver}>
              ← Plantas
            </Link>
            <h2 style={titulo}>{obra.nombre} en 3D</h2>
          </div>
          <BotonDefinirPisos
            pisos={pisosDeObra}
            plantas={plantas.map((p) => ({ id: p.id, nombre: p.nombre }))}
            guardar={guardarPisos.bind(null, obra.slug, obra.id)}
          />
        </div>

        {(sinPlanta > 0 || sinDibujo > 0) && hayAlgo && (
          <p style={aviso}>
            {[
              sinPlanta > 0 &&
                `${sinPlanta} ${sinPlanta === 1 ? "piso no tiene" : "pisos no tienen"} planta asignada`,
              sinDibujo > 0 &&
                `${sinDibujo} ${sinDibujo === 1 ? "piso tiene" : "pisos tienen"} una planta sin escala o sin dibujar`,
            ]
              .filter(Boolean)
              .join(", y ")}
            : no {sinPlanta + sinDibujo === 1 ? "aparece" : "aparecen"}.
          </p>
        )}

        {hayAlgo ? (
          <Edificio3D
            modelos={modelos}
            pisos={pisos}
            rutaDePlantas={`/obras/${obra.slug}/plantas`}
            editar={editarEnPlanta.bind(null, obra.slug)}
          />
        ) : (
          <p style={ui.vacio}>
            {pisosDeObra.length === 0
              ? "Todavía no hay pisos definidos en esta obra: definilos para decir a qué nivel va cada planta."
              : "Ningún piso tiene todavía una planta dibujada y con escala."}
          </p>
        )}
      </div>
    </AppShell>
  );
}

/** Como el editor: ocupa la ventana, y lo que se corre es el modelo. */
const marco = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "12px",
  height: "calc(100vh - 32px)",
  minHeight: "480px",
};

const barra = {
  flex: "0 0 auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const lado = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  minWidth: 0,
};

const volver = {
  flex: "0 0 auto",
  color: "#555555",
  fontSize: "14px",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
};

const titulo = {
  minWidth: 0,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
  whiteSpace: "nowrap" as const,
  fontSize: "18px",
  fontWeight: 600,
  margin: 0,
};

const aviso = {
  flex: "0 0 auto",
  fontSize: "13px",
  color: ui.ROJO,
  margin: 0,
};
