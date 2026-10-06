import { redirect } from "next/navigation";

/**
 * Elegir tareas ya no es otra pantalla: el catálogo vive al costado de la
 * planilla y tildar agrega en el momento. Esta dirección queda para no romper
 * un enlace guardado.
 */
export default async function TareasDelComputoPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  redirect(`/obras/${obraId}/presupuestos/computo`);
}
