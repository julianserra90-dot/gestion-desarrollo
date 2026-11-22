import AppShell from "@/components/AppShell";
import EditorPlanta from "@/components/EditorPlanta";
import ObraHeader from "@/components/ObraHeader";
import ObraSidebar from "@/components/ObraSidebar";
import { getObraPorSlug } from "@/lib/obras";
import { getPlanta } from "@/lib/plantas";
import { eliminarPlanta, guardarPlanta } from "../actions";

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
  const planta = await getPlanta(plantaId);

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

  return (
    <AppShell
      sidebar={<ObraSidebar obraSlug={obra.slug} activeSection="plantas" />}
    >
      <ObraHeader obra={obra} activeSection="plantas" ocultarNav />

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
      />
    </AppShell>
  );
}
