import { redirect } from "next/navigation";

/**
 * El desglose ya no tiene pantalla propia: se despliega dentro de su fila de
 * la planilla. Esta dirección queda para no romper un enlace guardado, y abre
 * la planilla con esa fila desplegada.
 */
export default async function DesgloseDeTareaPage({
  params,
}: {
  params: Promise<{ obraId: string; itemId: string }>;
}) {
  const { obraId, itemId } = await params;
  redirect(`/obras/${obraId}/presupuestos/computo?abrir=${itemId}`);
}
