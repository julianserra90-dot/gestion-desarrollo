/**
 * De la planta tipo a un dibujo: ambientes con posición y medida, en metros,
 * sobre la huella del lote. Puro, sin base ni React; `PlantaTipo.tsx` lo
 * pinta.
 *
 * La lógica es la de un esquema de arquitecto, no la de un plano: el núcleo
 * en su banda con el patio al lado, y cada unidad partida en una fila que
 * mira a la ventana (estar y dormitorios) y una fila de servicios contra el
 * núcleo (cocina, baño, paso, y el dormitorio que ventila al patio). Cada
 * ambiente se chequea contra los mínimos del Código y, si no dan, la unidad
 * baja un dormitorio y lo dice en las notas.
 *
 * Los programas por cantidad de dormitorios son datos (`PROGRAMAS`), no
 * código: es el catálogo que puede crecer y pasar a una tabla.
 */

import { p } from "@/lib/parametros-edificacion";
import { bandas, type Nucleo, type Planta, type Terreno } from "@/lib/tipologias";

export type TipoAmbiente =
  | "estar"
  | "dormitorio"
  | "cocina"
  | "bano"
  | "paso"
  | "escalera"
  | "ascensor"
  | "palier"
  | "patio"
  | "libre";

export type Ventana = "abajo" | "arriba" | "izquierda" | "derecha";

export type Ambiente = {
  tipo: TipoAmbiente;
  nombre: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  ventana?: Ventana;
};

export type Recinto = { nombre: string; x: number; y: number; ancho: number; alto: number };
type Caja = Omit<Recinto, "nombre">;

export type Dibujo = {
  ancho: number;
  profundidad: number;
  ambientes: Ambiente[];
  unidades: Recinto[];
  notas: string[];
};

/**
 * El catálogo: qué ambientes lleva una unidad según sus dormitorios. La
 * fila "ventana" mira afuera; la fila "servicio" da contra el núcleo y el
 * patio. Los mínimos salen de los parámetros del Código.
 */
export const PROGRAMAS: Record<
  number,
  { nombre: string; ventana: TipoAmbiente[]; servicio: TipoAmbiente[] }
> = {
  0: { nombre: "monoambiente", ventana: ["estar"], servicio: ["cocina", "bano", "paso"] },
  1: { nombre: "un dormitorio", ventana: ["estar", "dormitorio"], servicio: ["cocina", "bano", "paso"] },
  2: {
    nombre: "dos dormitorios",
    ventana: ["estar", "dormitorio"],
    servicio: ["dormitorio", "cocina", "bano", "paso"],
  },
  3: {
    nombre: "tres dormitorios",
    ventana: ["estar", "dormitorio", "dormitorio"],
    servicio: ["dormitorio", "cocina", "bano", "paso"],
  },
};

export function dibujarPlantaTipo(t: Terreno, planta: Planta, nucleo: Nucleo): Dibujo {
  const b = bandas(t);
  const W = redondear(b.anchoUtil);
  const D = redondear(t.profundidad);
  const ambientes: Ambiente[] = [];
  const unidades: Recinto[] = [];
  const notas: string[] = [];

  const anchoNucleo = p("nucleoEscaleraAncho") + (nucleo.ascensor ? p("nucleoAscensorAncho") : 1.6);

  if (planta.clave === "pasante") {
    const u = { x: 0, y: 0, ancho: W, alto: D };
    unidades.push({ nombre: planta.unidades[0]?.nombre ?? "Unidad", ...u });
    // El núcleo contra una medianera, al fondo; la unidad pasa por al lado.
    const nucleoY = D - p("nucleoBanda");
    ambientes.push(...nucleoEn(0, nucleoY, anchoNucleo, nucleo, W, false));
    ambientes.push(
      ...distribuirPasante(
        { x: anchoNucleo, y: nucleoY, ancho: W - anchoNucleo, alto: p("nucleoBanda") },
        { x: 0, y: 0, ancho: W, alto: nucleoY },
        planta.unidades[0]?.dormitorios ?? 0,
        notas
      )
    );
    return { ancho: W, profundidad: D, ambientes, unidades, notas };
  }

  if (planta.clave === "dos-al-frente") {
    const alto = Math.min(p("profundidadUnidadMax"), D - p("nucleoBanda"));
    const anchoU = (W - 0.15) / 2;
    const nucleoY = D - p("nucleoBanda");
    ambientes.push(...nucleoEn(0, nucleoY, anchoNucleo, nucleo, W, true));
    [0, 1].forEach((i) => {
      const u: Recinto = {
        nombre: planta.unidades[i]?.nombre ?? "Unidad",
        x: i * (anchoU + 0.15),
        y: 0,
        ancho: anchoU,
        alto,
      };
      unidades.push(u);
      ambientes.push(...distribuirUnidad(u, "abajo", planta.unidades[i]?.dormitorios ?? 0, i === 1, notas));
    });
    return { ancho: W, profundidad: D, ambientes, unidades, notas };
  }

  // Frente y contrafrente, o cuatro por planta: tres bandas.
  const nucleoY = b.frente;
  ambientes.push(...nucleoEn(0, nucleoY, anchoNucleo, nucleo, W, true));
  const partes = planta.clave === "cuatro-por-planta" ? 2 : 1;
  const anchoU = partes === 2 ? (W - 0.15) / 2 : W;

  for (let i = 0; i < partes; i++) {
    const x = i * (anchoU + 0.15);
    const uf = planta.unidades[i];
    const uc = planta.unidades[partes + i];
    const frente: Recinto = { nombre: uf?.nombre ?? "Unidad al frente", x, y: 0, ancho: anchoU, alto: b.frente };
    const contra: Recinto = {
      nombre: uc?.nombre ?? "Unidad al contrafrente",
      x,
      y: nucleoY + b.medio,
      ancho: anchoU,
      alto: b.contrafrente,
    };
    unidades.push(frente);
    unidades.push(contra);
    // El patio está a la derecha del núcleo: la unidad de la derecha (o la
    // única) tiene con qué ventilar el dormitorio de la fila de servicio.
    const conPatio = partes === 1 || i === 1;
    ambientes.push(...distribuirUnidad(frente, "abajo", uf?.dormitorios ?? 0, conPatio, notas));
    ambientes.push(...distribuirUnidad(contra, "arriba", uc?.dormitorios ?? 0, conPatio, notas));
  }

  if (b.sobrante > 0.5) {
    notas.push(`Detrás del contrafrente quedan ${formatear(b.sobrante)} m hasta la LFI, libres hacia el pulmón de manzana.`);
  }

  return { ancho: W, profundidad: D, ambientes, unidades, notas };
}

// ------------------------------ Núcleo ------------------------------------

/** Escalera, ascensor y palier desde `x`, y el patio a la derecha si entra. */
function nucleoEn(
  x: number,
  y: number,
  anchoNucleo: number,
  nucleo: Nucleo,
  W: number,
  conPatio: boolean
): Ambiente[] {
  const alto = p("nucleoBanda");
  const escalera = p("nucleoEscaleraAncho");
  const salida: Ambiente[] = [
    { tipo: "escalera", nombre: "Escalera", x, y, ancho: escalera, alto },
  ];
  if (nucleo.ascensor) {
    const aa = p("nucleoAscensorAncho");
    const al = p("nucleoAscensorLargo");
    salida.push({ tipo: "ascensor", nombre: "Ascensor", x: x + escalera, y, ancho: aa, alto: al });
    salida.push({ tipo: "palier", nombre: "Palier", x: x + escalera, y: y + al, ancho: aa, alto: alto - al });
  } else {
    salida.push({ tipo: "palier", nombre: "Palier", x: x + escalera, y, ancho: 1.6, alto });
  }
  if (conPatio) {
    const anchoPatio = W - x - anchoNucleo;
    if (anchoPatio >= p("patioAuxiliarLadoMin") && anchoPatio * alto >= p("patioAuxiliarM2")) {
      salida.push({ tipo: "patio", nombre: "Patio auxiliar", x: x + anchoNucleo, y, ancho: anchoPatio, alto });
    } else if (anchoPatio > 0.3) {
      salida.push({ tipo: "libre", nombre: "Sin patio: no da el lado mínimo", x: x + anchoNucleo, y, ancho: anchoPatio, alto });
    }
  }
  return salida;
}

// ------------------------------ Unidades ----------------------------------

/**
 * Una unidad que ventila a un solo lado. Se dibuja con la ventana abajo y
 * después se da vuelta si mira arriba. `conPatio`: la fila de servicio da
 * al patio, así que su dormitorio tiene ventana.
 */
function distribuirUnidad(
  u: Recinto,
  ventana: "abajo" | "arriba",
  dormitorios: number,
  conPatio: boolean,
  notas: string[]
): Ambiente[] {
  const w = u.ancho;
  const d = u.alto;
  const locales: Ambiente[] = [];
  let dorms = dormitorios;

  // Sin profundidad para dos filas: un monoambiente con un tabique de servicios.
  if (d < 5.4) {
    const servicio = Math.min(2.2, w * 0.35);
    locales.push(local("estar", "Estar · dormitorio", 0, 0, w - servicio, d, "abajo"));
    locales.push(local("bano", "Baño", w - servicio, 0, servicio, Math.min(2.2, d / 2)));
    locales.push(local("cocina", "Cocina", w - servicio, Math.min(2.2, d / 2), servicio, d - Math.min(2.2, d / 2)));
    if (dormitorios > 0) notas.push(`${u.nombre}: con ${formatear(d)} m de profundidad no entran dos filas de ambientes; queda monoambiente.`);
    return colocar(locales, u, ventana);
  }

  const dB = Math.min(3.2, Math.max(2.4, d * 0.4));
  const dA = d - dB;
  const dormMin = p("dormitorioM2");
  const dormPrincipal = p("dormitorioPrincipalM2");
  const ladoMin = p("dormitorioLadoMin");

  // ---- Fila de la ventana: estar y dormitorios principales ----
  let filaA: { tipo: TipoAmbiente; nombre: string; ancho: number }[] = [];
  const armarFilaA = (n: number) => {
    const dormsA = Math.min(n, n >= 3 ? 2 : 1);
    const anchoDorm = Math.max(ladoMin, dormPrincipal / dA);
    const estar = w - dormsA * anchoDorm;
    if (dormsA > 0 && (estar < 3 || estar * dA < p("estarM2"))) return null;
    if (dormsA === 0 && w * dA < p("estarM2") + 3) {
      // Un monoambiente chico: se admite igual, es lo que hay.
    }
    const fila = [{ tipo: "estar" as TipoAmbiente, nombre: dormsA === 0 ? "Estar · dormitorio" : "Estar comedor", ancho: estar }];
    for (let i = 0; i < dormsA; i++) fila.push({ tipo: "dormitorio", nombre: i === 0 ? "Dormitorio" : "Dormitorio 2", ancho: anchoDorm });
    return fila;
  };

  // ---- Fila de servicio: dormitorio al patio, cocina, baño, paso ----
  const armarFilaB = (n: number) => {
    let cocina = Math.max(1.8, p("cocinaM2") / dB);
    const bano = Math.max(1.5, p("banoM2") / dB);
    const dormB = n >= 2 ? Math.max(ladoMin, dormMin / dB) : 0;
    let paso = w - cocina - bano - dormB;
    if (paso < 0.9) return null;
    if (n >= 2 && !conPatio) return "sin-patio" as const;
    // El paso no necesita más de 1,2 m: lo que sobra es cocina comedor, no
    // pasillo.
    if (paso > 1.2) {
      cocina += paso - 1.2;
      paso = 1.2;
    }
    const fila: { tipo: TipoAmbiente; nombre: string; ancho: number }[] = [
      { tipo: "paso", nombre: "Paso", ancho: paso },
      { tipo: "cocina", nombre: cocina >= 2.8 ? "Cocina comedor" : "Cocina", ancho: cocina },
      { tipo: "bano", nombre: "Baño", ancho: bano },
    ];
    if (dormB > 0) fila.push({ tipo: "dormitorio", nombre: n >= 3 ? "Dormitorio 3" : "Dormitorio 2", ancho: dormB });
    return fila;
  };

  let filaB: ReturnType<typeof armarFilaB> = null;
  for (; dorms >= 0; dorms--) {
    const a = armarFilaA(dorms);
    const bFila = armarFilaB(dorms);
    if (a && bFila && bFila !== "sin-patio") {
      filaA = a;
      filaB = bFila;
      break;
    }
    if (bFila === "sin-patio" && dorms === dormitorios) {
      notas.push(`${u.nombre}: el segundo dormitorio necesitaría ventilar al patio y esta unidad no da al patio; baja a ${PROGRAMAS[Math.max(0, dorms - 1)].nombre}.`);
    }
  }
  if (dorms < dormitorios && !notas.some((n) => n.startsWith(u.nombre))) {
    notas.push(`${u.nombre}: con ${formatear(w)} × ${formatear(d)} m no dan los mínimos para ${PROGRAMAS[dormitorios].nombre}; queda ${PROGRAMAS[Math.max(0, dorms)].nombre}.`);
  }
  if (!filaB) {
    // Ni un monoambiente con servicios en fila: todo en una.
    locales.push(local("estar", "Estar · dormitorio", 0, 0, w, dA, "abajo"));
    locales.push(local("bano", "Baño y cocina", 0, dA, w, dB));
    return colocar(locales, u, ventana);
  }

  let x = 0;
  for (const amb of filaA) {
    locales.push(local(amb.tipo, amb.nombre, x, 0, amb.ancho, dA, "abajo"));
    x += amb.ancho;
  }
  x = 0;
  for (const amb of filaB) {
    const ventanaPatio = amb.tipo === "dormitorio" && conPatio ? ("arriba" as Ventana) : undefined;
    locales.push(local(amb.tipo, amb.nombre, x, dA, amb.ancho, dB, ventanaPatio));
    x += amb.ancho;
  }
  return colocar(locales, u, ventana);
}

/**
 * Una unidad que ventila a los dos lados: estar al frente, dormitorios al
 * fondo, servicios en el medio, y el patio en la banda del núcleo.
 */
function distribuirPasante(
  bandaServicio: Caja,
  cuerpo: Caja,
  dormitorios: number,
  notas: string[]
): Ambiente[] {
  const w = cuerpo.ancho;
  const d = cuerpo.alto;
  const salida: Ambiente[] = [];
  const dFrente = Math.min(6.5, Math.max(3.2, d * 0.4));
  const dFondo = d - dFrente;
  const ladoMin = p("dormitorioLadoMin");

  salida.push(local("estar", "Estar comedor", cuerpo.x, cuerpo.y, w, dFrente, "abajo"));

  // Dormitorios al fondo, lado a lado, los que entren con su lado mínimo.
  let n = Math.min(dormitorios, Math.floor(w / ladoMin));
  if (n < dormitorios) notas.push(`Unidad pasante: al fondo entran ${n} dormitorios de ${ladoMin} m de lado, no ${dormitorios}.`);
  if (n === 0) {
    salida.push(local("dormitorio", "Dormitorio", cuerpo.x, cuerpo.y + dFrente, w, dFondo, "arriba"));
    n = 1;
  } else {
    const anchoDorm = w / n;
    for (let i = 0; i < n; i++) {
      salida.push(local("dormitorio", n === 1 ? "Dormitorio" : `Dormitorio ${i + 1}`, cuerpo.x + i * anchoDorm, cuerpo.y + dFrente, anchoDorm, dFondo, "arriba"));
    }
  }

  // La banda del núcleo, al lado de la escalera: cocina, baño y patio si da.
  const cocina = Math.max(1.8, p("cocinaM2") / bandaServicio.alto);
  const bano = Math.max(1.5, p("banoM2") / bandaServicio.alto);
  let x = bandaServicio.x;
  salida.push(local("cocina", "Cocina", x, bandaServicio.y, cocina, bandaServicio.alto));
  x += cocina;
  salida.push(local("bano", "Baño", x, bandaServicio.y, bano, bandaServicio.alto));
  x += bano;
  const resto = bandaServicio.x + bandaServicio.ancho - x;
  if (resto >= p("patioAuxiliarLadoMin")) {
    salida.push(local("patio", "Patio auxiliar", x, bandaServicio.y, resto, bandaServicio.alto));
  } else if (resto > 0.3) {
    salida.push(local("paso", "Paso", x, bandaServicio.y, resto, bandaServicio.alto));
  }
  return salida;
}

// ------------------------------ Utiles ------------------------------------

function local(
  tipo: TipoAmbiente,
  nombre: string,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  ventana?: Ventana
): Ambiente {
  return { tipo, nombre, x: redondear(x), y: redondear(y), ancho: redondear(ancho), alto: redondear(alto), ventana };
}

/** Lleva los ambientes dibujados con la ventana abajo a su lugar en la planta, dándolos vuelta si miran arriba. */
function colocar(locales: Ambiente[], u: Recinto, ventana: "abajo" | "arriba"): Ambiente[] {
  return locales.map((a) => {
    const y = ventana === "abajo" ? u.y + a.y : u.y + (u.alto - a.y - a.alto);
    const v = a.ventana === undefined ? undefined : ventana === "abajo" ? a.ventana : a.ventana === "abajo" ? "arriba" : "abajo";
    return { ...a, x: redondear(u.x + a.x), y: redondear(y), ventana: v };
  });
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

function formatear(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}
