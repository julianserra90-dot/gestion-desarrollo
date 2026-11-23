/**
 * Una planta levantada: lo que se dibujó, como sólidos en metros.
 *
 * El dibujo de una planta es plano y está en píxeles; el 3D necesita cajas.
 * Acá cada cosa se vuelve un **prisma**: una huella en planta —un polígono,
 * en metros— y entre qué alturas está, medidas desde el piso terminado de la
 * planta, que es su 0,00. Con eso alcanza para todo lo que se dibuja: un muro
 * es un rectángulo levantado, una losa un polígono con espesor.
 *
 * Además de los prismas salen dos cosas que el visor no sabría sacar solo:
 *
 *   las **aristas**   Un muro con una puerta son varias cajas —los paños, el
 *                     dintel—, y dos muros que se encuentran se pisan en la
 *                     esquina. Dibujando el borde de cada caja queda una
 *                     línea en cada junta. Las aristas de acá son las del
 *                     **conjunto**: lo que es del mismo material se lee como
 *                     una sola pieza (`aristasDe`).
 *
 *   las **fichas**    Qué es cada cosa y sus datos, para mostrarlos al
 *                     tocarla.
 *
 * Es un modelo **general**, para ver el edificio armado y encontrar lo que no
 * cierra —un piso que pisa al de arriba, una columna que no llega—. No es un
 * modelo de detalle.
 *
 * Sin React, sin three y sin base: son cuentas. Las hace el servidor y le
 * pasa el resultado al visor, que sólo sabe dibujar.
 */

import { formatM2, formatM3, formatMetros, formatNivel } from "@/lib/format";
import {
  type Capa,
  type Dibujo,
  type Escala,
  type Punto,
  areaDe,
  distancia,
  metrosPorPixel,
  nombreDeApertura,
} from "@/lib/planta-dibujo";
import {
  huellaDeColumna,
  huellaDeViga,
  medirEstructura,
  prismasDeHormigon,
  recortar,
} from "@/lib/planta-estructura";
import {
  type Pano,
  cuerpoDeMuro,
  franjasEnPlanta,
  mamposteriaDeMuro,
  panosDeMuro,
  sombraEnMuro,
  vanosDeMuro,
} from "@/lib/planta-trazo";

/** Qué es cada sólido: decide de qué color va y con qué se prende o apaga. */
export type ClaseDeSolido =
  | "muro"
  | "vidrio"
  | "puerta"
  | "piso"
  | "cielorraso"
  | "losa"
  | "viga"
  | "columna"
  | "metal";

export type Solido = {
  clase: ClaseDeSolido;
  /** De qué cosa del dibujo es: la clave de su ficha en `Modelo.objetos`. Un
   *  muro con una puerta son varios sólidos del mismo objeto. */
  objeto: string;
  /** La huella, en metros: x0, y0, x1, y1… La y crece hacia abajo, como en
   *  el plano. */
  puntos: number[];
  /** Entre qué alturas está, en metros sobre el piso terminado de la planta. */
  desde: number;
  hasta: number;
};

/** Lo que se muestra de una cosa al tocarla. */
export type Ficha = {
  /** Qué es: "Muro", "Puerta", "Columna". */
  titulo: string;
  /** Su nombre, si tiene: "P1", "C03", "Baño". */
  nombre: string;
  /** Sus datos, de a pares: qué es y cuánto. */
  renglones: [string, string][];
  /** Lo que se le puede cambiar desde acá: sus alturas y sus medidas. */
  campos: Campo[];
};

/**
 * Una medida de una cosa que se puede corregir mirando el 3D, en metros.
 * `clave` es cómo se llama en el dibujo: es lo que viaja al guardar
 * (`lib/planta-edicion.ts`).
 */
export type Campo = {
  clave: string;
  nombre: string;
  valor: number | null;
  /** Lo que se lee con el campo vacío, que es lo que le toca sola. Sin esto,
   *  el campo no se puede vaciar. */
  vacio?: string;
  /** Si puede ser negativo: un nivel. */
  conSigno?: boolean;
  /** Si puede ser cero: un antepecho. */
  desdeCero?: boolean;
};

export type Modelo = {
  solidos: Solido[];
  /** Las aristas a dibujar de cada clase: x, y, z de cada punta, de a dos. */
  aristas: { clase: ClaseDeSolido; lineas: number[] }[];
  objetos: Record<string, Ficha>;
  /** Cuánto ocupa en planta, en metros: su huella arranca en 0,0. */
  ancho: number;
  fondo: number;
};

/** El espesor con que se dibuja lo que no tiene uno cargado: un piso sin
 *  capas, un cielorraso, un vidrio. Lo justo para que se vea. */
const FINO = 0.02;
/** El de la hoja de una puerta. */
const HOJA = 0.04;
/** Menos que esto no es un tramo de muro: un milímetro. */
const MINIMO = 0.001;

/** Un sólido mientras se arma, con a qué conjunto de aristas pertenece. */
type EnObra = Solido & { grupo: string };

/**
 * El modelo de una planta, o null si no tiene escala: sin ella no hay metros.
 *
 * `pisoAPiso` es lo que hay de su piso terminado al del piso de arriba, si la
 * planta es de algún piso de la obra: de ahí se cuelga la estructura
 * (`medirEstructura`). `nombres` son los de las tareas del catálogo, por su
 * id, para decir de qué es cada cosa.
 *
 * La huella se corre para que arranque en 0,0. Cada planta se calcó sobre su
 * propio plano, con su propio origen, y **no hay todavía un punto en común
 * que las alinee**: apiladas por su esquina coinciden si todos los pisos
 * ocupan lo mismo, que es lo de casi todo edificio entre medianeras.
 */
export function modeloDePlanta(
  planta: { dibujo: Dibujo; escala: Escala | null; altura: number },
  pisoAPiso: number | null,
  nombres: Map<string, string> = new Map()
): Modelo | null {
  const mpp = metrosPorPixel(planta.escala);
  if (mpp === null) return null;

  const { dibujo } = planta;
  const techo = planta.altura > 0 ? planta.altura : 0;
  const enObra: EnObra[] = [];
  const objetos: Record<string, Ficha> = {};
  const sumar = (
    clase: ClaseDeSolido,
    objeto: string,
    grupo: string,
    huella: Punto[],
    desde: number,
    hasta: number
  ) => {
    if (huella.length < 3 || !(hasta - desde > MINIMO)) return;
    enObra.push({
      clase,
      objeto,
      grupo,
      puntos: huella.flatMap((p) => [p.x * mpp, p.y * mpp]),
      desde,
      hasta,
    });
  };
  const tarea = (id: string | null) =>
    id === null ? "Sin definir" : nombres.get(id) ?? "Tarea que ya no está en el catálogo";
  /** Las capas en una línea, de la primera a la última, con su espesor. */
  const capas = (lista: Capa[]) =>
    lista.length === 0
      ? "Sin definir"
      : lista
          .map((c) => `${tarea(c.tarea)}${c.espesor !== null ? ` (${cm(c.espesor)})` : ""}`)
          .join(" + ");

  // El hormigón, con las mismas alturas con que se lo computa: es lo que le
  // saca lugar a los muros.
  const hormigon = prismasDeHormigon(dibujo.estructura, mpp, planta.altura, pisoAPiso);

  // ---- Los muros, con sus vanos y sin el hormigón ------------------------
  for (const muro of dibujo.muros) {
    const cuerpo = cuerpoDeMuro(muro, dibujo.muros, mpp, 0);
    const largo = distancia(cuerpo.a, cuerpo.b);
    if (!(largo > 0)) continue;

    const dx = (cuerpo.b.x - cuerpo.a.x) / largo;
    const dy = (cuerpo.b.y - cuerpo.a.y) / largo;
    const medio = cuerpo.grosor / 2;
    const alto = muro.altura ?? techo;
    /** El rectángulo de un tramo del muro, entre dos distancias de su punta. */
    const tramo = (s0: number, s1: number, grosor = medio): Punto[] => [
      { x: cuerpo.a.x + dx * s0 - dy * grosor, y: cuerpo.a.y + dy * s0 + dx * grosor },
      { x: cuerpo.a.x + dx * s1 - dy * grosor, y: cuerpo.a.y + dy * s1 + dx * grosor },
      { x: cuerpo.a.x + dx * s1 + dy * grosor, y: cuerpo.a.y + dy * s1 - dx * grosor },
      { x: cuerpo.a.x + dx * s0 + dy * grosor, y: cuerpo.a.y + dy * s0 - dx * grosor },
    ];

    /** Un tramo entre dos distancias de la punta y dos de la normal. */
    const tramoEntre = (s0: number, s1: number, n0: number, n1: number): Punto[] => [
      { x: cuerpo.a.x + dx * s0 - dy * n1, y: cuerpo.a.y + dy * s0 + dx * n1 },
      { x: cuerpo.a.x + dx * s1 - dy * n1, y: cuerpo.a.y + dy * s1 + dx * n1 },
      { x: cuerpo.a.x + dx * s1 - dy * n0, y: cuerpo.a.y + dy * s1 + dx * n0 },
      { x: cuerpo.a.x + dx * s0 - dy * n0, y: cuerpo.a.y + dy * s0 + dx * n0 },
    ];
    // Dónde va el núcleo —el ladrillo— dentro del cuerpo, sobre la normal: en
    // un muro con capas no está al medio.
    const corrido =
      (cuerpo.nucleo.ejeA.x - cuerpo.ejeA.x) * -dy + (cuerpo.nucleo.ejeA.y - cuerpo.ejeA.y) * dx;

    // Las aberturas van sobre el eje sin estirar; el cuerpo arranca antes.
    const arranque = distancia(cuerpo.a, cuerpo.ejeA);
    const largoDelEje = distancia(cuerpo.ejeA, cuerpo.ejeB);
    const vanos = vanosDeMuro(dibujo.aberturas, muro.id, largoDelEje, arranque, mpp);
    // Y el hormigón le saca lugar al ladrillo: donde hay una columna o una
    // viga no hay ladrillo. Se lo busca en el núcleo, no en el revoque.
    const eje = {
      a: { x: cuerpo.a.x - dy * corrido, y: cuerpo.a.y + dx * corrido },
      b: { x: cuerpo.b.x - dy * corrido, y: cuerpo.b.y + dx * corrido },
    };
    const sombras = hormigon
      .map((prisma) => sombraEnMuro(eje, cuerpo.nucleo.grosor, prisma))
      .filter((s): s is Pano => s !== null);

    const objeto = `muro:${muro.id}`;
    // Los muros de lo mismo son una sola pieza: sin junta entre sus tramos ni
    // en las esquinas. Entre dos materiales distintos, la línea queda.
    const grupo = `muro|${muro.tarea ?? ""}`;
    const mamposteria = mamposteriaDeMuro(muro, dibujo.aberturas, hormigon, mpp, alto);
    objetos[objeto] = {
      titulo: "Muro",
      nombre: "",
      renglones: [
        ["Tipo", tarea(muro.tarea)],
        ["Espesor", cm(muro.espesor)],
        ["Largo", formatMetros(distancia(muro.a, muro.b) * mpp)],
        ["Altura", formatMetros(alto)],
        ["Mampostería, sin vanos ni hormigón", formatM2(mamposteria.superficie)],
        ...((mamposteria.hormigon > 0.005
          ? [["Descontado por hormigón", formatM2(mamposteria.hormigon)]]
          : []) as [string, string][]),
        ...((vanos.length > 0
          ? [["Aberturas", vanos.map((v) => v.abertura.nombre || "sin nombre").join(", ")]]
          : []) as [string, string][]),
      ],
      campos: [
        {
          clave: "altura",
          nombre: "Altura (m)",
          valor: muro.altura,
          vacio: `${dosDecimales(techo)} — la de la planta`,
        },
        { clave: "espesor", nombre: "Espesor (m)", valor: muro.espesor },
      ],
    };

    // Cada franja del muro —capa exterior, núcleo, capa interior— con su
    // planta ya cortada en las uniones, como en la planta (`franjasEnPlanta`):
    // en una esquina cada capa forma su L con la del otro muro. Se la levanta
    // en paños: el ladrillo sin los vanos ni el hormigón; las capas, una piel
    // que sólo se corta en los vanos y pasa por delante del hormigón —el
    // revoque tapa la columna igual que al ladrillo—. Todas del mismo grupo
    // que el muro: se leen como una sola pieza.
    for (const franja of franjasEnPlanta(muro, dibujo.muros, mpp)) {
      // A lo largo del muro, desde la punta del cuerpo: una franja cortada en
      // una esquina puede empezar antes o terminar después.
      const aLoLargo = franja.puntos.map(
        (p) => (p.x - cuerpo.a.x) * dx + (p.y - cuerpo.a.y) * dy
      );
      const inicio = Math.min(...aLoLargo);
      const fin = Math.max(...aLoLargo);
      if (!(fin - inicio > 1e-6)) continue;
      const corrida = (h: Pano): Pano => ({ ...h, desde: h.desde - inicio, hasta: h.hasta - inicio });
      const huecos =
        franja.clase === "nucleo" ? [...vanos, ...sombras].map(corrida) : vanos.map(corrida);
      for (const pano of panosDeMuro(fin - inicio, alto, huecos)) {
        // El paño es un tramo a lo largo: se recorta la franja a ese tramo, así
        // conserva el bisel de su punta.
        const tramoDelPano = tramoEntre(inicio + pano.desde, inicio + pano.hasta, -1e4, 1e4);
        const huella = recortar(franja.puntos, tramoDelPano);
        if (huella.length < 3) continue;
        sumar("muro", objeto, grupo, huella, pano.abajo, pano.arriba);
      }
    }

    // Lo que llena cada vano: el vidrio de una ventana, la hoja de una puerta.
    for (const vano of vanos) {
      const ab = vano.abertura;
      const desde = Math.max(0, vano.desde);
      const hasta = Math.min(largo, vano.hasta);
      const abajo = Math.min(vano.abajo, alto);
      const arriba = Math.min(vano.arriba, alto);
      const abertura = `abertura:${ab.id}`;
      const esVentana = ab.tipo === "ventana";
      sumar(
        esVentana ? "vidrio" : "puerta",
        abertura,
        abertura,
        tramo(desde, hasta, (esVentana ? FINO : HOJA) / mpp / 2),
        abajo,
        arriba
      );
      objetos[abertura] = {
        titulo: esVentana ? "Ventana" : "Puerta",
        nombre: ab.nombre,
        renglones: [
          ["Medidas", `${dosDecimales(ab.ancho)} × ${dosDecimales(ab.alto)} m`],
          ...((esVentana
            ? [
                ["Antepecho", ab.antepecho === null ? "Sin cargar" : formatMetros(ab.antepecho)],
                [
                  "Apertura",
                  ab.apertura === null
                    ? "Sin cargar"
                    : `${nombreDeApertura(ab.apertura)}${ab.hojas ? `, ${ab.hojas} ${ab.hojas === 1 ? "hoja" : "hojas"}` : ""}`,
                ],
              ]
            : [["Mano", ab.mano === "izquierda" ? "Izquierda" : "Derecha"]]) as [string, string][]),
          ["En un muro de", cm(muro.espesor)],
        ],
        // El ancho y el alto son del tipo: cambian en todas las del mismo
        // nombre, como en el editor.
        campos: [
          { clave: "ancho", nombre: "Ancho (m)", valor: ab.ancho },
          { clave: "alto", nombre: "Alto (m)", valor: ab.alto },
          ...(esVentana
            ? [
                {
                  clave: "antepecho",
                  nombre: "Antepecho (m)",
                  valor: ab.antepecho,
                  vacio: "sin cargar",
                  desdeCero: true,
                },
              ]
            : []),
        ],
      };
    }
  }

  // ---- Los ambientes: su piso y su cielorraso ----------------------------
  for (const ambiente of dibujo.ambientes) {
    const objeto = `ambiente:${ambiente.id}`;
    // El piso termina en el 0,00 y baja lo que suman sus capas: es el
    // paquete que va sobre la losa.
    const paquete = ambiente.piso.reduce((t, capa) => t + (capa.espesor ?? 0), 0);
    sumar("piso", objeto, `piso|${ambiente.id}`, ambiente.puntos, -(paquete > 0 ? paquete : FINO), 0);

    if (ambiente.alturaCielorraso !== null) {
      const espesor = ambiente.cielorraso.reduce((t, capa) => t + (capa.espesor ?? 0), 0);
      sumar(
        "cielorraso",
        objeto,
        `cielorraso|${ambiente.id}`,
        ambiente.puntos,
        ambiente.alturaCielorraso,
        ambiente.alturaCielorraso + (espesor > 0 ? espesor : FINO)
      );
    }

    objetos[objeto] = {
      titulo: "Ambiente",
      nombre: ambiente.nombre,
      renglones: [
        ["Superficie", formatM2(areaDe(ambiente.puntos) * mpp * mpp)],
        ["Piso", capas(ambiente.piso)],
        ...((paquete > 0 ? [["Paquete de piso", cm(paquete)]] : []) as [string, string][]),
        [
          "Cielorraso",
          ambiente.alturaCielorraso === null
            ? `Aplicado · ${capas(ambiente.cielorraso)}`
            : `Suspendido a ${formatMetros(ambiente.alturaCielorraso)} · ${capas(ambiente.cielorraso)}`,
        ],
        ["Paredes", capas(ambiente.capas)],
      ],
      campos: [
        {
          clave: "alturaCielorraso",
          nombre: "Altura del cielorraso (m)",
          valor: ambiente.alturaCielorraso,
          vacio: "aplicado, contra la losa",
        },
      ],
    };
  }

  // ---- La estructura -----------------------------------------------------
  // Las alturas son las mismas con que se computa el hormigón.
  const medida = medirEstructura(dibujo.estructura, mpp, planta.altura, pisoAPiso);
  if (medida) {
    const niveles = (desde: number, hasta: number): [string, string] => [
      "Nivel",
      `${formatNivel(desde)} a ${formatNivel(hasta)}`,
    ];

    for (const losa of dibujo.estructura.losas) {
      const m = medida.losas.find((l) => l.id === losa.id);
      if (!m) continue;
      const objeto = `losa:${losa.id}`;
      sumar("losa", objeto, "losa", losa.puntos, m.desde, m.hasta);
      objetos[objeto] = {
        titulo: "Losa",
        nombre: losa.nombre,
        renglones: [
          ["Material", "Hormigón armado"],
          ["Espesor", cm(losa.espesor)],
          ["Superficie", formatM2(m.superficie)],
          niveles(m.desde, m.hasta),
          ["Hormigón", formatM3(m.neto)],
        ],
        campos: [
          { clave: "espesor", nombre: "Espesor (m)", valor: losa.espesor },
          // Como nivel, con su signo: -0,05 es cinco centímetros bajo el piso
          // terminado que sostiene. Guardado va en positivo.
          {
            clave: "bajoNpt",
            nombre: "Nivel, desde el piso terminado que sostiene (m)",
            valor: losa.bajoNpt === null ? null : losa.bajoNpt === 0 ? 0 : -losa.bajoNpt,
            vacio:
              dibujo.estructura.bajoNpt !== null
                ? `${formatNivel(-dibujo.estructura.bajoNpt)} — el de la planta`
                : "sin definir",
            conSigno: true,
          },
        ],
      };
    }

    for (const viga of dibujo.estructura.vigas) {
      const m = medida.vigas.find((v) => v.id === viga.id);
      if (!m) continue;
      const metalica = viga.material === "metalica";
      const objeto = `viga:${viga.id}`;
      sumar(
        metalica ? "metal" : "viga",
        objeto,
        metalica ? objeto : "viga",
        huellaDeViga(viga, mpp),
        m.desde,
        m.hasta
      );
      objetos[objeto] = {
        titulo: "Viga",
        nombre: viga.nombre,
        renglones: [
          ["Material", metalica ? `Metálica${viga.perfil ? ` · ${viga.perfil}` : ""}` : "Hormigón armado"],
          ["Sección", `${cm(viga.ancho)} × ${cm(viga.alto)}`],
          ["Largo", formatMetros(m.largo)],
          niveles(m.desde, m.hasta),
          metalica ? ["Perfil", formatMetros(m.largo)] : ["Hormigón", formatM3(m.neto)],
        ],
        campos: [
          { clave: "ancho", nombre: "Ancho (m)", valor: viga.ancho },
          { clave: "alto", nombre: "Alto (m)", valor: viga.alto },
          {
            clave: "nivel",
            nombre: "Cara de arriba (m)",
            valor: viga.nivel,
            vacio: `${formatNivel(m.hasta)} — con su losa`,
            conSigno: true,
          },
        ],
      };
    }

    for (const columna of dibujo.estructura.columnas) {
      const m = medida.columnas.find((c) => c.id === columna.id);
      if (!m) continue;
      const metalica = columna.material === "metalica";
      const objeto = `columna:${columna.id}`;
      sumar(
        metalica ? "metal" : "columna",
        objeto,
        metalica ? objeto : "columna",
        huellaDeColumna(columna, mpp),
        m.desde,
        m.hasta
      );
      objetos[objeto] = {
        titulo: "Columna",
        nombre: columna.nombre,
        renglones: [
          [
            "Material",
            metalica ? `Metálica${columna.perfil ? ` · ${columna.perfil}` : ""}` : "Hormigón armado",
          ],
          ["Sección", `${cm(columna.ancho)} × ${cm(columna.profundidad)}`],
          ["Altura", formatMetros(m.alto)],
          niveles(m.desde, m.hasta),
          metalica ? ["Perfil", formatMetros(m.alto)] : ["Hormigón", formatM3(m.neto)],
        ],
        // Como en su ficha del editor: cuánto se separa del piso de arriba y
        // del de la planta; la altura es lo que resulta.
        campos: [
          {
            clave: "arriba",
            nombre: "Del piso de arriba (m)",
            valor: columna.arriba,
            vacio: pisoAPiso !== null ? formatNivel(m.hasta - pisoAPiso) : "faltan los pisos",
            conSigno: true,
          },
          {
            clave: "desde",
            nombre: "Del piso de la planta (m)",
            valor: columna.desde,
            vacio: formatNivel(m.desde),
            conSigno: true,
          },
          { clave: "ancho", nombre: "Ancho (m)", valor: columna.ancho },
          { clave: "profundidad", nombre: "Profundidad (m)", valor: columna.profundidad },
        ],
      };
    }
  }

  if (enObra.length === 0) return { solidos: [], aristas: [], objetos, ancho: 0, fondo: 0 };

  // ---- A su esquina ------------------------------------------------------
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const solido of enObra) {
    for (let i = 0; i < solido.puntos.length; i += 2) {
      minX = Math.min(minX, solido.puntos[i]);
      maxX = Math.max(maxX, solido.puntos[i]);
      minY = Math.min(minY, solido.puntos[i + 1]);
      maxY = Math.max(maxY, solido.puntos[i + 1]);
    }
  }
  // Al milímetro: el modelo viaja al navegador, y no hace falta más.
  const corridos = enObra.map((s) => ({
    ...s,
    puntos: s.puntos.map((v, i) => alMm(v - (i % 2 === 0 ? minX : minY))),
    desde: alMm(s.desde),
    hasta: alMm(s.hasta),
  }));

  // ---- Las aristas, de cada conjunto -------------------------------------
  const porGrupo = new Map<string, EnObra[]>();
  for (const solido of corridos) {
    const lista = porGrupo.get(solido.grupo) ?? [];
    lista.push(solido);
    porGrupo.set(solido.grupo, lista);
  }
  const porClase = new Map<ClaseDeSolido, number[]>();
  for (const grupo of porGrupo.values()) {
    const lineas = porClase.get(grupo[0].clase) ?? [];
    lineas.push(...aristasDe(grupo));
    porClase.set(grupo[0].clase, lineas);
  }

  return {
    solidos: corridos.map(({ clase, objeto, puntos, desde, hasta }) => ({
      clase,
      objeto,
      puntos,
      desde,
      hasta,
    })),
    aristas: Array.from(porClase, ([clase, lineas]) => ({ clase, lineas })),
    objetos,
    ancho: alMm(maxX - minX),
    fondo: alMm(maxY - minY),
  };
}

// ---- Las aristas de un conjunto de prismas ---------------------------------

type Prisma = {
  /** La huella, de a puntos. */
  huella: Punto[];
  desde: number;
  hasta: number;
  /** Lo que ocupa en planta, para descartar rápido. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type P3 = { x: number; y: number; z: number };

/** A cuánto de una arista se mira si hay sólido: 3 mm. Menos que el espesor
 *  de lo más fino que se dibuja, y bastante más que el redondeo. */
const CERCA = 0.003;
/** En cuántas direcciones se mira alrededor de una arista. */
const VUELTAS = 24;

function puntoEnHuella(x: number, y: number, huella: Punto[]): boolean {
  let adentro = false;
  for (let i = 0, j = huella.length - 1; i < huella.length; j = i++) {
    const a = huella[i];
    const b = huella[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      adentro = !adentro;
    }
  }
  return adentro;
}

/**
 * Las aristas que se ven de un conjunto de prismas tomado como **una sola
 * pieza**, como x, y, z de cada punta.
 *
 * El borde de cada prisma es una candidata, pero no todas son una arista del
 * conjunto: donde dos prismas se tocan de cara —el paño de un muro y el
 * dintel que le sigue— el borde queda en medio de una pared lisa, y donde se
 * pisan —dos muros en una esquina— queda adentro del sólido. Dibujarlas es
 * la línea en cada junta que no dice nada.
 *
 * Para saber cuál es cuál se mira **alrededor** de cada tramo de arista, en
 * un círculo chico: dónde hay sólido y dónde no.
 *
 *   todo lleno o todo vacío   está adentro, o no toca nada: no se dibuja.
 *   justo la mitad, de corrido   es una cara lisa que sigue de largo: una
 *                             junta. No se dibuja.
 *   cualquier otra cosa       es un quiebre de verdad —una esquina, un
 *                             rincón, el filo de un vano—: se dibuja.
 *
 * Una misma arista puede ser junta en un tramo y quiebre en otro —la jamba
 * de una puerta es un filo hasta el dintel y una junta de ahí para arriba—,
 * así que antes cada una se parte donde otro prisma del conjunto la cruza.
 */
export function aristasDe(solidos: Pick<Solido, "puntos" | "desde" | "hasta">[]): number[] {
  const prismas: Prisma[] = solidos.map((s) => {
    const huella: Punto[] = [];
    for (let i = 0; i < s.puntos.length; i += 2) huella.push({ x: s.puntos[i], y: s.puntos[i + 1] });
    return {
      huella,
      desde: s.desde,
      hasta: s.hasta,
      minX: Math.min(...huella.map((p) => p.x)),
      maxX: Math.max(...huella.map((p) => p.x)),
      minY: Math.min(...huella.map((p) => p.y)),
      maxY: Math.max(...huella.map((p) => p.y)),
    };
  });

  const hay = (p: P3): boolean => {
    for (const s of prismas) {
      if (p.z <= s.desde || p.z >= s.hasta) continue;
      if (p.x < s.minX || p.x > s.maxX || p.y < s.minY || p.y > s.maxY) continue;
      if (puntoEnHuella(p.x, p.y, s.huella)) return true;
    }
    return false;
  };

  /** Si en el medio de un tramo hay un quiebre del conjunto. */
  const seVe = (a: P3, b: P3): boolean => {
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    const vertical = Math.abs(b.z - a.z) > MINIMO;
    // Las dos direcciones de costado a la arista.
    let u: P3;
    let v: P3;
    if (vertical) {
      u = { x: 1, y: 0, z: 0 };
      v = { x: 0, y: 1, z: 0 };
    } else {
      const largo = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      u = { x: -(b.y - a.y) / largo, y: (b.x - a.x) / largo, z: 0 };
      v = { x: 0, y: 0, z: 1 };
    }

    const lleno: boolean[] = [];
    for (let i = 0; i < VUELTAS; i++) {
      // Corrido media vuelta de paso: así ninguna dirección cae justo sobre
      // una cara a escuadra, que no estaría ni adentro ni afuera.
      const angulo = ((i + 0.5) / VUELTAS) * Math.PI * 2;
      const c = Math.cos(angulo) * CERCA;
      const s = Math.sin(angulo) * CERCA;
      lleno.push(hay({ x: m.x + u.x * c + v.x * s, y: m.y + u.y * c + v.y * s, z: m.z + u.z * c + v.z * s }));
    }
    const cuantos = lleno.filter(Boolean).length;
    if (cuantos === 0 || cuantos === VUELTAS) return false;
    let cambios = 0;
    for (let i = 0; i < VUELTAS; i++) if (lleno[i] !== lleno[(i + 1) % VUELTAS]) cambios++;
    return !(cuantos === VUELTAS / 2 && cambios === 2);
  };

  const todasLasAlturas = Array.from(new Set(prismas.flatMap((s) => [s.desde, s.hasta])));
  const vistas = new Set<string>();
  const lineas: number[] = [];
  const dibujar = (a: P3, b: P3) => {
    // La misma arista la traen los dos prismas que la comparten.
    const ka = `${alMm(a.x)},${alMm(a.y)},${alMm(a.z)}`;
    const kb = `${alMm(b.x)},${alMm(b.y)},${alMm(b.z)}`;
    const clave = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (vistas.has(clave)) return;
    vistas.add(clave);
    lineas.push(alMm(a.x), alMm(a.y), alMm(a.z), alMm(b.x), alMm(b.y), alMm(b.z));
  };
  /** Dibuja de una arista los tramos que se ven, partida en `cortes` (de 0 a
   *  1 a lo largo). */
  const recorrer = (a: P3, b: P3, cortes: number[]) => {
    const orden = Array.from(new Set([0, 1, ...cortes])).sort((p, q) => p - q);
    const en = (t: number): P3 => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    });
    const largo = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    // Los tramos seguidos que se ven se juntan en una sola línea.
    let desde: number | null = null;
    for (let i = 0; i + 1 < orden.length; i++) {
      const t0 = orden[i];
      const t1 = orden[i + 1];
      const visible = (t1 - t0) * largo > MINIMO && seVe(en(t0), en(t1));
      if (visible && desde === null) desde = t0;
      if (!visible && desde !== null) {
        dibujar(en(desde), en(t0));
        desde = null;
      }
    }
    if (desde !== null) dibujar(en(desde), b);
  };

  for (const prisma of prismas) {
    const { huella, desde, hasta } = prisma;
    const alto = hasta - desde;

    for (let i = 0; i < huella.length; i++) {
      const p = huella[i];
      const q = huella[(i + 1) % huella.length];

      // La arista parada en cada esquina de la huella: se parte en cada
      // altura donde algún prisma empieza o termina.
      recorrer(
        { x: p.x, y: p.y, z: desde },
        { x: p.x, y: p.y, z: hasta },
        todasLasAlturas.filter((z) => z > desde && z < hasta).map((z) => (z - desde) / alto)
      );

      // Y las dos acostadas de cada lado, abajo y arriba: se parten donde el
      // lado cruza el borde de otro prisma o pasa por una de sus esquinas.
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const largo2 = dx * dx + dy * dy;
      if (!(largo2 > MINIMO * MINIMO)) continue;
      const cortes: number[] = [];
      for (const otro of prismas) {
        if (otro === prisma) continue;
        if (
          otro.maxX < Math.min(p.x, q.x) - CERCA ||
          otro.minX > Math.max(p.x, q.x) + CERCA ||
          otro.maxY < Math.min(p.y, q.y) - CERCA ||
          otro.minY > Math.max(p.y, q.y) + CERCA
        ) {
          continue;
        }
        for (let k = 0; k < otro.huella.length; k++) {
          const c = otro.huella[k];
          const d = otro.huella[(k + 1) % otro.huella.length];
          // Una esquina del otro que cae sobre este lado.
          const t = ((c.x - p.x) * dx + (c.y - p.y) * dy) / largo2;
          const lejos = Math.abs((c.x - p.x) * dy - (c.y - p.y) * dx) / Math.sqrt(largo2);
          if (lejos < MINIMO && t > 0 && t < 1) cortes.push(t);
          // Un lado del otro que lo cruza.
          const ex = d.x - c.x;
          const ey = d.y - c.y;
          const det = dx * ey - dy * ex;
          if (Math.abs(det) < 1e-12) continue;
          const cruce = ((c.x - p.x) * ey - (c.y - p.y) * ex) / det;
          const enElOtro = ((c.x - p.x) * dy - (c.y - p.y) * dx) / det;
          if (cruce > 0 && cruce < 1 && enElOtro >= 0 && enElOtro <= 1) cortes.push(cruce);
        }
      }
      for (const z of [desde, hasta]) {
        recorrer({ x: p.x, y: p.y, z }, { x: q.x, y: q.y, z }, cortes);
      }
    }
  }

  // Los rincones: donde el lado de un prisma cruza al de otro hay un quiebre
  // que no es esquina de ninguno de los dos —el de adentro de una L, donde la
  // cara de un muro se encuentra con la del otro—. Ahí va una arista parada,
  // en la altura que comparten.
  for (let i = 0; i < prismas.length; i++) {
    const uno = prismas[i];
    for (let j = i + 1; j < prismas.length; j++) {
      const otro = prismas[j];
      if (
        otro.maxX < uno.minX ||
        otro.minX > uno.maxX ||
        otro.maxY < uno.minY ||
        otro.minY > uno.maxY
      ) {
        continue;
      }
      const abajo = Math.max(uno.desde, otro.desde);
      const arriba = Math.min(uno.hasta, otro.hasta);
      if (!(arriba - abajo > MINIMO)) continue;

      for (let a = 0; a < uno.huella.length; a++) {
        const p = uno.huella[a];
        const q = uno.huella[(a + 1) % uno.huella.length];
        for (let b = 0; b < otro.huella.length; b++) {
          const c = otro.huella[b];
          const d = otro.huella[(b + 1) % otro.huella.length];
          const det = (q.x - p.x) * (d.y - c.y) - (q.y - p.y) * (d.x - c.x);
          if (Math.abs(det) < 1e-12) continue;
          const t = ((c.x - p.x) * (d.y - c.y) - (c.y - p.y) * (d.x - c.x)) / det;
          const s = ((c.x - p.x) * (q.y - p.y) - (c.y - p.y) * (q.x - p.x)) / det;
          // Sólo los cruces de verdad: las esquinas ya están como candidatas.
          if (!(t > 1e-9 && t < 1 - 1e-9 && s > 1e-9 && s < 1 - 1e-9)) continue;
          const x = p.x + (q.x - p.x) * t;
          const y = p.y + (q.y - p.y) * t;
          recorrer(
            { x, y, z: abajo },
            { x, y, z: arriba },
            todasLasAlturas
              .filter((z) => z > abajo && z < arriba)
              .map((z) => (z - abajo) / (arriba - abajo))
          );
        }
      }
    }
  }

  return lineas;
}

// ---- Formatos --------------------------------------------------------------

const alMm = (n: number) => Math.round(n * 1000) / 1000;

/** Un espesor o una sección, en centímetros: "15 cm". */
function cm(metros: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(metros * 100)} cm`;
}

function dosDecimales(n: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
