import Link from "next/link";
import AppShell from "@/components/AppShell";
import * as ui from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { crearEmpresa, eliminarEmpresa, renombrarEmpresa } from "./actions";

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: empresas }, { data: socios }, { data: gastos }, { data: ingresos }] =
    await Promise.all([
      supabase.from("empresas").select("id, nombre").order("nombre"),
      supabase.from("obra_socios").select("empresa_id, obras(nombre)"),
      supabase.from("gastos").select("empresa_pagadora_id"),
      supabase.from("ingresos").select("empresa_id"),
    ]);

  const obrasPorEmpresa = new Map<string, string[]>();
  for (const socio of socios ?? []) {
    const lista = obrasPorEmpresa.get(socio.empresa_id) ?? [];
    if (socio.obras?.nombre) lista.push(socio.obras.nombre);
    obrasPorEmpresa.set(socio.empresa_id, lista);
  }

  // Los gastos pagados con dinero en cuenta no tienen empresa pagadora.
  const gastosPorEmpresa = new Map<string, number>();
  for (const gasto of gastos ?? []) {
    if (!gasto.empresa_pagadora_id) continue;
    gastosPorEmpresa.set(
      gasto.empresa_pagadora_id,
      (gastosPorEmpresa.get(gasto.empresa_pagadora_id) ?? 0) + 1
    );
  }

  const aportesPorEmpresa = new Map<string, number>();
  for (const ingreso of ingresos ?? []) {
    if (!ingreso.empresa_id) continue;
    aportesPorEmpresa.set(
      ingreso.empresa_id,
      (aportesPorEmpresa.get(ingreso.empresa_id) ?? 0) + 1
    );
  }

  return (
    <AppShell>
      <header style={header}>
        <div>
          <p style={ui.eyebrow}>Gestión de desarrollo</p>
          <h2 style={ui.pageTitle}>Empresas</h2>
          <p style={ui.subtitle}>
            Las empresas que pueden participar como socias de una obra.
          </p>
        </div>

        <Link href="/" style={backLink}>
          Volver a obras
        </Link>
      </header>

      {error && <p style={errorBox}>{error}</p>}

      <section style={ui.panel}>
        <h3 style={ui.sectionTitle}>Agregar empresa</h3>

        <form action={crearEmpresa} style={formInline}>
          <input type="hidden" name="volver_a" value="/empresas" />
          <input
            type="text"
            name="nombre"
            placeholder="Nombre de la empresa"
            required
            style={ui.input}
          />
          <button type="submit" style={ui.button}>
            Agregar
          </button>
        </form>
      </section>

      <section style={ui.panelConMargen}>
        <h3 style={ui.sectionTitle}>Listado</h3>

        {(empresas ?? []).length === 0 ? (
          <p style={ui.vacio}>Todavía no hay empresas cargadas.</p>
        ) : (
          <div style={lista}>
            {(empresas ?? []).map((empresa) => {
              const obras = obrasPorEmpresa.get(empresa.id) ?? [];
              const cantGastos = gastosPorEmpresa.get(empresa.id) ?? 0;
              const cantAportes = aportesPorEmpresa.get(empresa.id) ?? 0;
              const enUso = obras.length > 0 || cantGastos > 0 || cantAportes > 0;

              return (
                <div key={empresa.id} style={fila}>
                  <form action={renombrarEmpresa} style={formFila}>
                    <input
                      type="hidden"
                      name="empresa_id"
                      value={empresa.id}
                    />
                    <input
                      type="text"
                      name="nombre"
                      defaultValue={empresa.nombre}
                      required
                      style={ui.input}
                    />
                    <button type="submit" style={ui.secondaryButton}>
                      Guardar nombre
                    </button>
                  </form>

                  <div style={infoUso}>
                    {enUso ? (
                      <>
                        <span>
                          {obras.length > 0
                            ? `Socia en: ${obras.join(", ")}`
                            : "No participa en ninguna obra"}
                        </span>
                        {cantGastos > 0 && (
                          <span>
                            {cantGastos} {cantGastos === 1 ? "gasto" : "gastos"}{" "}
                            a su nombre
                          </span>
                        )}
                        {cantAportes > 0 && (
                          <span>
                            {cantAportes}{" "}
                            {cantAportes === 1 ? "aporte" : "aportes"} de fondos
                          </span>
                        )}
                      </>
                    ) : (
                      <span>Sin uso todavía</span>
                    )}
                  </div>

                  <div style={accionFila}>
                    {enUso ? (
                      <span style={ui.note}>
                        No se puede eliminar mientras esté en uso.
                      </span>
                    ) : (
                      <form action={eliminarEmpresa}>
                        <input
                          type="hidden"
                          name="empresa_id"
                          value={empresa.id}
                        />
                        <button type="submit" style={ui.secondaryButton}>
                          Eliminar
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #e5e5e5",
  paddingBottom: "24px",
  marginBottom: "32px",
};

const backLink = {
  color: "#111111",
  textDecoration: "none",
  borderBottom: "1px solid #111111",
  paddingBottom: "4px",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "20px",
  fontSize: "14px",
};

const formInline = {
  display: "flex",
  gap: "12px",
  maxWidth: "560px",
  marginTop: "16px",
};

const lista = {
  display: "grid",
  gap: "16px",
  marginTop: "20px",
};

const fila = {
  display: "grid",
  gap: "10px",
  borderTop: "1px solid #eeeeee",
  paddingTop: "16px",
};

const formFila = {
  display: "flex",
  gap: "12px",
  maxWidth: "560px",
};

const infoUso = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "16px",
  color: "#777777",
  fontSize: "14px",
};

const accionFila = {
  display: "flex",
  alignItems: "center",
};
