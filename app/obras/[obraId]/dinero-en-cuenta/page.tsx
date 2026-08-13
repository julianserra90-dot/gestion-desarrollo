import { redirect } from "next/navigation";

/**
 * La solapa Dinero en cuenta se fusionó con Ingresos: eran dos pantallas de lo
 * mismo (todo ingreso suma a la cuenta, y los movimientos repetían el listado
 * entero). La ruta queda para que los enlaces viejos no mueran.
 */
export default async function DineroEnCuentaPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  redirect(`/obras/${obraId}/ingresos`);
}
