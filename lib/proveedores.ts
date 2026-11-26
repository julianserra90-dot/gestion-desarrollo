/**
 * Los proveedores que ofrece cada obra.
 *
 * SÓLO SERVIDOR.
 *
 * El catálogo (`proveedores`) es uno solo —el mismo corralón le puede vender a
 * dos obras, y su teléfono no cambia—, pero cada obra marca los suyos en
 * `obra_proveedores`, igual que hace con los rubros. Los desplegables de
 * gastos y cotizaciones ofrecen sólo los marcados: en Andonaegui no tienen que
 * aparecer los contratistas de 3 de Febrero.
 *
 * Editar algo ya cargado es la excepción: su proveedor viaja aunque la obra no
 * lo tenga marcado, porque si no desaparecería del desplegable y se perdería
 * al guardar.
 */

import { createClient } from "@/lib/supabase/server";

export type ProveedorOpcion = { id: string; nombre: string; tipo: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Los marcados en la obra, más los de `incluir` aunque no lo estén (el del
 * gasto o la cotización que se está editando, el del gasto que se repite).
 */
export async function getProveedoresDeObra(
  obraId: string,
  incluir: (string | null | undefined)[] = []
): Promise<ProveedorOpcion[]> {
  const supabase = await createClient();

  const { data: marcados } = await supabase
    .from("obra_proveedores")
    .select("proveedores(id, nombre, tipo)")
    .eq("obra_id", obraId);

  const lista: ProveedorOpcion[] = (marcados ?? [])
    .map((m) => m.proveedores)
    .filter((p): p is ProveedorOpcion => p !== null);

  const yaEstan = new Set(lista.map((p) => p.id));
  const faltan = [
    ...new Set(incluir.filter((id): id is string => !!id && !yaEstan.has(id))),
  ];

  if (faltan.length > 0) {
    const { data: extra } = await supabase
      .from("proveedores")
      .select("id, nombre, tipo")
      .in("id", faltan);
    lista.push(...(extra ?? []));
  }

  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** En cuántos gastos y cotizaciones figura, acá y en el resto de las obras. */
export type UsoDeProveedor = {
  gastosAca: number;
  gastosOtras: number;
  cotizAca: number;
  cotizOtras: number;
};

export type ProveedorDeCatalogo = {
  id: string;
  nombre: string;
  tipo: string;
  telefono: string | null;
  rubro_id: string | null;
};

/**
 * Todo lo que hace falta para mostrar y editar el catálogo desde una obra: la
 * lista entera, cuáles marca la obra, los rubros para el desplegable, el uso
 * de cada uno y si quien mira es administrador.
 *
 * Los gastos y cotizaciones se traen enteros —no sólo los de esta obra—
 * porque el borrado lo frena la base si el proveedor quedó enganchado en
 * cualquier lado, y conviene decirlo antes de ofrecer el botón.
 *
 * Los rubros son los del catálogo (`obra_id` null): el listado de proveedores
 * también es común a todas las obras, así que el rubro tiene que serlo.
 */
export async function getCatalogoDesdeObra(obraId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: catalogo },
    { data: rubros },
    { data: gastos },
    { data: cotizaciones },
    { data: perfil },
    { data: marcas },
  ] = await Promise.all([
    supabase
      .from("proveedores")
      .select("id, nombre, tipo, telefono, rubro_id")
      .order("nombre"),
    supabase
      .from("rubros")
      .select("id, nombre")
      .is("obra_id", null)
      .order("nombre"),
    supabase.from("gastos").select("proveedor_id, obra_id"),
    supabase.from("presupuestos").select("proveedor_id, obra_id"),
    supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user?.id ?? "")
      .maybeSingle(),
    supabase
      .from("obra_proveedores")
      .select("proveedor_id")
      .eq("obra_id", obraId),
  ]);

  const uso = new Map<string, UsoDeProveedor>();
  const sumar = (
    filas: { proveedor_id: string | null; obra_id: string }[] | null,
    aca: "gastosAca" | "cotizAca",
    otras: "gastosOtras" | "cotizOtras"
  ) => {
    for (const f of filas ?? []) {
      if (!f.proveedor_id) continue;
      const u = uso.get(f.proveedor_id) ?? {
        gastosAca: 0,
        gastosOtras: 0,
        cotizAca: 0,
        cotizOtras: 0,
      };
      if (f.obra_id === obraId) u[aca]++;
      else u[otras]++;
      uso.set(f.proveedor_id, u);
    }
  };
  sumar(gastos, "gastosAca", "gastosOtras");
  sumar(cotizaciones, "cotizAca", "cotizOtras");

  return {
    catalogo: (catalogo ?? []) as ProveedorDeCatalogo[],
    rubros: rubros ?? [],
    // Los que esta obra tiene marcados: son los que ofrecen sus desplegables.
    deLaObra: new Set((marcas ?? []).map((m) => m.proveedor_id)),
    uso,
    // Editar y borrar el catálogo es de admin (política `proveedores_admin`).
    esAdmin: perfil?.rol === "admin",
  };
}

/**
 * Deja al proveedor marcado en la obra. Se llama cada vez que se lo elige o se
 * lo crea desde una obra, así el que se sumó al cargar un gasto queda en el
 * desplegable para el próximo.
 *
 * Si falla no frena nada: el gasto o la cotización ya se guardaron con su
 * proveedor, y la marca es sólo para que el desplegable lo ofrezca.
 */
export async function marcarProveedorEnObra(
  supabase: Supabase,
  obraId: string,
  proveedorId: string | null
) {
  if (!obraId || !proveedorId) return;

  await supabase
    .from("obra_proveedores")
    .upsert(
      { obra_id: obraId, proveedor_id: proveedorId },
      { onConflict: "obra_id,proveedor_id", ignoreDuplicates: true }
    );
}
