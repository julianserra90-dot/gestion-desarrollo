import Link from "next/link";
import AppShell from "@/components/AppShell";
import BotonDefinirPisos from "@/components/BotonDefinirPisos";
import Edificio3D, { type PisoEn3D, type TareaDeAvance } from "@/components/Edificio3D";
import ObraSidebar from "@/components/ObraSidebar";
import * as ui from "@/components/ui";
import { getObraPorSlug } from "@/lib/obras";
import { type Modelo, modeloDePlanta } from "@/lib/planta-3d";
import {
  getCapasDisponibles,
  getPisos,
  getPlantas,
  getTiposDeMuro,
  getTiposDeMuroDeObra,
} from "@/lib/plantas";
import { createClient } from "@/lib/supabase/server";
import { conSusTipos } from "@/lib/tipos-de-muro";
import { editarEnPlanta, guardarPisos, marcarEnElPlano } from "../actions";

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
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  /** `desde`: la planta de la que se vino, para poder volver a ella. */
  searchParams: Promise<{ desde?: string }>;
}) {
  const { obraId } = await params;
  const { desde } = await searchParams;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  const [plantas, pisosDeObra, capas, tiposDeMuro, tiposDeLaObra] = await Promise.all([
    getPlantas(obra.id),
    getPisos(obra.id),
    getCapasDisponibles(),
    getTiposDeMuro(),
    getTiposDeMuroDeObra(obra.id),
  ]);
  const mapaDeTipos = new Map(tiposDeLaObra.map((t) => [t.id, t]));
  const plantaDeOrigen = desde ? plantas.find((p) => p.id === desde) ?? null : null;
  // Cómo se llama cada tarea del catálogo: es lo que dice de qué está hecho
  // un muro o qué capas lleva un piso al tocarlo.
  const nombres = new Map([...capas, ...tiposDeMuro].map((t) => [t.id, t.nombre]));

  // El modelo de cada planta que algún piso usa, una sola vez.
  const modelos: Record<string, Modelo> = {};
  for (const planta of plantas) {
    const suPiso = pisosDeObra.find((p) => p.plantaId === planta.id);
    if (!suPiso) continue;
    // Los muros con lo de su tipo al día: su revestimiento es la piel que se
    // dibuja delante del hormigón.
    const conTipos = {
      ...planta,
      dibujo: { ...planta.dibujo, muros: conSusTipos(planta.dibujo.muros, mapaDeTipos) },
    };
    const modelo = modeloDePlanta(conTipos, suPiso.altura, nombres, mapaDeTipos);
    if (modelo && modelo.solidos.length > 0) modelos[planta.id] = modelo;
  }

  // El avance: las tareas que el dibujo lleva, con su rubro y lo que el
  // cómputo tiene de cada una, y lo ya marcado como hecho, piso por piso.
  const supabase = await createClient();
  const [{ data: items }, { data: marcadas, error: alLeerMarcas }] = await Promise.all([
    supabase
      .from("computo_items")
      .select("tarea_id, unidad, cantidad")
      .eq("obra_id", obra.id)
      .not("tarea_id", "is", null),
    supabase
      .from("avances_del_plano")
      .select("planta_id, piso, objeto, tarea_id, cantidad, fecha")
      .eq("obra_id", obra.id),
  ]);
  // Sin la tabla todavía —la migración sin aplicar—, no hay nada marcado.
  if (alLeerMarcas) console.error("avances_del_plano:", alLeerMarcas.message);
  const catalogo = new Map([...capas, ...tiposDeMuro].map((t) => [t.id, t]));
  const unidadDelCatalogo = new Map(tiposDeMuro.map((t) => [t.id, t.unidad]));
  const enComputo = new Map<string, { unidad: string; cantidad: number }>();
  for (const i of items ?? []) {
    if (!i.tarea_id) continue;
    const ya = enComputo.get(i.tarea_id);
    enComputo.set(i.tarea_id, { unidad: ya?.unidad ?? i.unidad, cantidad: (ya?.cantidad ?? 0) + Number(i.cantidad) });
  }
  const usadas = new Set(
    Object.values(modelos).flatMap((m) => Object.values(m.objetos).flatMap((f) => (f.tareas ?? []).map((t) => t.tarea)))
  );
  const tareasDeAvance: TareaDeAvance[] = Array.from(usadas, (id) => {
    const delCatalogo = catalogo.get(id);
    const computada = enComputo.get(id);
    return {
      id,
      nombre: delCatalogo?.nombre ?? nombres.get(id) ?? "Tarea que ya no está en el catálogo",
      rubro: delCatalogo?.rubro ?? "Sin rubro",
      unidad: computada?.unidad ?? unidadDelCatalogo.get(id) ?? "m²",
      enComputo: computada !== undefined,
    };
  }).sort((a, b) => a.rubro.localeCompare(b.rubro, "es") || a.nombre.localeCompare(b.nombre, "es"));
  const marcas = (marcadas ?? []).map((m) => ({
    planta: m.planta_id,
    piso: m.piso,
    objeto: m.objeto,
    tarea: m.tarea_id,
    cantidad: Number(m.cantidad),
    fecha: m.fecha,
  }));

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
          <div style={lado}>
            {/* Si se vino de una planta, se vuelve a ella y no a la lista. */}
            {plantaDeOrigen && (
              <Link href={`/obras/${obra.slug}/plantas/${plantaDeOrigen.id}`} style={ui.secondaryButton}>
                ← {plantaDeOrigen.nombre || "Volver a la planta"}
              </Link>
            )}
            <BotonDefinirPisos
              pisos={pisosDeObra}
              plantas={plantas.map((p) => ({ id: p.id, nombre: p.nombre }))}
              guardar={guardarPisos.bind(null, obra.slug, obra.id)}
            />
          </div>
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
            tareasDeAvance={tareasDeAvance}
            marcas={marcas}
            marcar={marcarEnElPlano.bind(null, obra.id)}
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
