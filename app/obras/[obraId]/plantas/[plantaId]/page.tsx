import AppShell from "@/components/AppShell";
import EditorPlanta from "@/components/EditorPlanta";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import { getObraPorSlug } from "@/lib/obras";
import {
  getCapasDisponibles,
  getPisos,
  getPlanta,
  getPlantas,
  getTareasPorMetro,
  getTareasDelCatalogo,
  getTiposDeAberturaDeObra,
  getTiposDeMuro,
  getTiposDeMuroDeObra,
} from "@/lib/plantas";
import {
  eliminarPlanta,
  eliminarTipoDeMuro,
  guardarPisos,
  guardarPlanta,
  guardarTipoDeAbertura,
  guardarTipoDeMuro,
  pasarCapasAlDibujo,
} from "../actions";

export default async function PlantaPage({
  params,
}: {
  params: Promise<{ obraId: string; plantaId: string }>;
}) {
  const { obraId, plantaId } = await params;
  const obra = await getObraPorSlug(obraId);

  if (!obra) {
    return <AppShell>Obra no encontrada</AppShell>;
  }

  // El id llega por la URL y no tiene por qué ser de esta obra.
  const [
    planta,
    capasDisponibles,
    tiposDeMuro,
    pisos,
    plantas,
    tiposDeLaObra,
    tareasPorMetro,
    tiposDeAbertura,
    tareasDelCatalogo,
  ] = await Promise.all([
    getPlanta(plantaId),
    getCapasDisponibles(),
    getTiposDeMuro(),
    getPisos(obra.id),
    getPlantas(obra.id),
    getTiposDeMuroDeObra(obra.id),
    getTareasPorMetro(),
    getTiposDeAberturaDeObra(obra.id),
    getTareasDelCatalogo(),
  ]);

  if (!planta || planta.obraId !== obra.id) {
    return (
      <AppShell
        sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="plantas" />}
      >
        <ObraHeader obra={obra} activeSection="plantas" ocultarNav />
        Planta no encontrada
      </AppShell>
    );
  }

  // Sin la cabecera de la obra: el editor es una mesa de trabajo y ocupa la
  // ventana entera. El "← Volver" y el nombre de la planta van en su barra.
  return (
    <AppShell
      pantallaCompleta
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="plantas" />}
    >
      <EditorPlanta
        planta={{
          id: planta.id,
          nombre: planta.nombre,
          altura: planta.altura,
          repeticiones: planta.repeticiones,
          // El editor no sabe de Drive: pide la imagen por la ruta que
          // verifica el permiso sobre la obra, como cualquier archivo.
          imagen: {
            url: `/archivos/${planta.imagen.driveId}`,
            ancho: planta.imagen.ancho,
            alto: planta.imagen.alto,
          },
          escala: planta.escala,
          dibujo: planta.dibujo,
        }}
        slug={obra.slug}
        guardar={guardarPlanta}
        eliminar={eliminarPlanta}
        capasDisponibles={capasDisponibles}
        tiposDeMuro={tiposDeMuro}
        pisosDeObra={pisos}
        plantasDeObra={plantas.map((p) => ({ id: p.id, nombre: p.nombre }))}
        guardarPisos={guardarPisos.bind(null, obra.slug, obra.id)}
        tiposDeLaObra={tiposDeLaObra}
        tareasPorMetro={tareasPorMetro}
        guardarTipo={guardarTipoDeMuro.bind(null, obra.id)}
        eliminarTipo={eliminarTipoDeMuro.bind(null, obra.id)}
        pasarCapas={pasarCapasAlDibujo.bind(null, obra.id)}
        tiposDeAberturaDeLaObra={tiposDeAbertura}
        guardarTipoDeAberturaEnLaObra={guardarTipoDeAbertura.bind(null, obra.id)}
        tareasDelCatalogo={tareasDelCatalogo}
      />
    </AppShell>
  );
}
