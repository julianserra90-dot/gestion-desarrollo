"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import BotonConfirmar from "@/components/BotonConfirmar";
import DefinicionDePisos from "@/components/DefinicionDePisos";
import IconoHerramienta from "@/components/IconoHerramienta";
import * as ui from "@/components/ui";
import { formatM2, formatM3, formatMetros, formatNivel, formatNiveles } from "@/lib/format";
import { type Piso, nombreDePiso } from "@/lib/pisos";
import {
  type Abertura,
  type Ambiente,
  type Ancla,
  type Apertura,
  type Capa,
  type Columna,
  type Dibujo,
  type Escala,
  type Estructura,
  type Mano,
  type Material,
  type Muro,
  type Punto,
  type Referencia,
  type TipoAbertura,
  type Viga,
  ABERTURA_INICIAL,
  ANCLAS,
  APERTURAS,
  COLUMNA_INICIAL,
  HOJAS_MAXIMO,
  LOSA_INICIAL,
  MATERIALES,
  REFERENCIAS,
  ESPESORES,
  ESPESOR_INICIAL,
  VIGA_INICIAL,
  areaDe,
  centroDe,
  distancia,
  medir,
  metrosPorPixel,
  nombreDeApertura,
  perimetroDe,
} from "@/lib/planta-dibujo";
import {
  type Guia,
  aberturasEnSuLugar,
  ajustar,
  carasDeCuerpo,
  crucesDeCaras,
  cuerpoDeMuro,
  escuadrar,
  esquinasDeCuerpo,
  type CaraMedida,
  type ParteDeCara,
  medirCaras,
  mismoPunto,
  moverLado,
  proyectar,
  solapesDeMuros,
} from "@/lib/planta-trazo";
import {
  huellaDeColumna,
  huellaDeViga,
  medirEstructura,
  nivelesDeLosa,
  nombreQueSigue,
  normalizarGiro,
  puntoDeAncla,
} from "@/lib/planta-estructura";

type Herramienta =
  | "seleccionar"
  | "mover"
  | "escala"
  | "muro"
  | "ambiente"
  | "abertura"
  | "medir"
  | "copiar"
  | "columna"
  | "viga"
  | "losa";

/**
 * Qué se está dibujando: la arquitectura —muros, ambientes, aberturas— o la
 * estructura de hormigón. Van sobre el mismo plano y con la misma escala; lo
 * que cambia es qué herramientas hay y qué se deja tocar. Lo del otro modo se
 * ve atenuado: la estructura se dibuja mirando los muros.
 */
type Modo = "arquitectura" | "estructura";

/**
 * Qué se mira en el panel de la derecha. Va en solapas para que cada cosa
 * entre sin apilarse con las otras: los datos de lo elegido, las medidas que
 * salen del dibujo, y lo de la planta entera.
 */
type Solapa = "propiedades" | "medidas" | "planta";

const SOLAPAS: { valor: Solapa; nombre: string }[] = [
  { valor: "propiedades", nombre: "Propiedades" },
  { valor: "medidas", nombre: "Medidas" },
  { valor: "planta", nombre: "Planta" },
];

/** Qué parte del plano se ve: la esquina de arriba a la izquierda, en píxeles
 *  de la imagen, y cuántos píxeles de pantalla ocupa cada uno de ellos. */
type Vista = { x: number; y: number; k: number };

/** Una línea por dos puntos. */
type Eje = { a: Punto; b: Punto };

/** Las listas de piezas de la estructura, sin lo que es de toda ella. */
type ClaseDePieza = "columnas" | "vigas" | "losas";

type Seleccion = {
  tipo: "muro" | "ambiente" | "abertura" | "columna" | "viga" | "losa";
  id: string;
} | null;

/**
 * Lo que se está arrastrando. De un muro, un extremo, por dónde está: los
 * extremos que coinciden se mueven juntos y la esquina no se desarma. Una
 * abertura se desliza sobre su muro.
 */
type Agarre =
  // Una punta de un muro. `desde` es dónde está ahora: con las puntas unidas
  // se mueven todas las que coinciden ahí, y sin unir, sólo la de este muro.
  // `eje` es la línea del muro al agarrarlo, desde su otra punta: mientras el
  // puntero la siga, la punta va por ella (`estirar`).
  | { tipo: "muro"; id: string; punta: "a" | "b"; desde: Punto; eje: Eje | null }
  | { tipo: "ambiente"; id: string; indice: number }
  // Un lado entero de un ambiente o de una losa: se corre en paralelo, como
  // una pared. Lleva el polígono de antes y dónde se agarró, para medir cuánto
  // se corrió.
  | {
      tipo: "lado";
      de: "ambiente" | "losa";
      id: string;
      indice: number;
      inicio: Punto;
      puntos: Punto[];
    }
  | { tipo: "losa"; id: string; indice: number }
  | { tipo: "viga"; id: string; punta: "a" | "b"; eje: Eje | null }
  // Una columna entera. `corrida` es cuánto hay de su punto marcado a donde se
  // la agarró: lo que se pega a las esquinas es ese punto, no el puntero.
  | { tipo: "columna"; id: string; corrida: Punto }
  | { tipo: "abertura"; id: string }
  // Una esquina de una abertura: la abertura se desliza igual, pero la que se
  // pega a lo que haya cerca es esa esquina y no su centro. `alLargo` dice de
  // qué jamba es: la del lado del primer punto del muro (-1) o la otra (1).
  | { tipo: "esquina"; id: string; alLargo: 1 | -1 };

/**
 * La terminación que se tomó con Copiar, para ponérsela a otros. De una cara
 * son sus capas; de un ambiente, todo lo suyo: paredes, piso y cielorraso.
 */
type Copiado =
  | { de: "muro"; tarea: string | null }
  | { de: "cara"; capas: Capa[] }
  | {
      de: "ambiente";
      nombre: string;
      capas: Capa[];
      piso: Capa[];
      cielorraso: Capa[];
      alturaCielorraso: number | null;
    };

/** Las medidas con las que sale la próxima abertura, como se están escribiendo. */
type Molde = {
  nombre: string;
  ancho: string;
  alto: string;
  antepecho: string;
  mano: Mano;
  apertura: Apertura;
  hojas: number;
};

/** Lo que se deshace junto: el dibujo y la escala. */
type Trazo = { dibujo: Dibujo; escala: Escala | null };

type PlantaEnEdicion = {
  id: string;
  nombre: string;
  altura: number;
  repeticiones: number;
  /** Dónde se pide la imagen del plano, y su tamaño en píxeles. */
  imagen: { url: string; ancho: number; alto: number };
  escala: Escala | null;
  dibujo: Dibujo;
};

const HERRAMIENTAS: Record<Modo, { valor: Herramienta; nombre: string }[]> = {
  arquitectura: [
    { valor: "seleccionar", nombre: "Seleccionar" },
    { valor: "mover", nombre: "Mover" },
    { valor: "escala", nombre: "Escala" },
    { valor: "muro", nombre: "Muro" },
    { valor: "ambiente", nombre: "Ambiente" },
    { valor: "abertura", nombre: "Abertura" },
    { valor: "medir", nombre: "Medir" },
    { valor: "copiar", nombre: "Copiar" },
  ],
  // Cada una se dibuja como su par de arquitectura: la columna se pone con un
  // toque, como una abertura; la viga se traza como un muro y la losa se
  // contornea como un ambiente.
  estructura: [
    { valor: "seleccionar", nombre: "Seleccionar" },
    { valor: "mover", nombre: "Mover" },
    { valor: "columna", nombre: "Columna" },
    { valor: "viga", nombre: "Viga" },
    { valor: "losa", nombre: "Losa" },
    { valor: "medir", nombre: "Medir" },
  ],
};

/** Una capa de terminación que se puede elegir: una tarea del catálogo del
 *  cómputo que se mide en m². */
export type CapaDisponible = { id: string; nombre: string; rubro: string };

/** Un tipo de muro que se puede elegir: una tarea del catálogo que se mide en
 *  m² o en m³. La unidad dice cuál de las dos cantidades es la suya. */
export type TipoDeMuro = { id: string; nombre: string; rubro: string; unidad: string };

/** A cuántos píxeles de pantalla un punto se pega a otro. */
const IMAN = 10;

/**
 * Cuánto hay que mover el puntero, en píxeles de pantalla, para que agarrar
 * algo sea arrastrarlo. Menos que eso es un clic con pulso: sin el umbral,
 * seleccionar un lado lo corría un píxel, y un doble clic nunca era doble.
 */
const UMBRAL_DE_ARRASTRE = 3;
/** Dentro de cuántos milisegundos dos toques en lo mismo son un doble clic. */
const DOBLE_TOQUE = 400;
/**
 * Hasta cuántos píxeles de pantalla de la línea de un muro su punta sigue
 * yendo por ella al arrastrarla. Más que el imán: el pulso se va de la línea
 * bastante más que eso en un arrastre largo, y soltarse a los diez píxeles
 * era volver a torcerlo.
 */
const ESTIRAR = 24;
/** Hasta dónde se alarga una línea "sin fin", en píxeles del plano. */
const LEJOS = 1_000_000;

/**
 * El editor de una planta: el plano de fondo y, encima, lo que se calca.
 *
 * Todo lo dibujado está en píxeles de la imagen. Los metros salen de la escala
 * y se muestran, pero no se guardan: así corregir la escala rehace todas las
 * medidas sin mover nada de lugar (`lib/planta-dibujo.ts`).
 *
 * El orden de trabajo es el de las herramientas: primero la escala —sin ella
 * se puede dibujar, pero nada mide—, después los muros y los ambientes.
 */
export default function EditorPlanta({
  planta,
  slug,
  guardar,
  eliminar,
  capasDisponibles,
  tiposDeMuro,
  pisosDeObra,
  plantasDeObra,
  guardarPisos,
}: {
  planta: PlantaEnEdicion;
  slug: string;
  guardar: (
    slug: string,
    plantaId: string,
    datos: {
      nombre: string;
      altura: number;
      repeticiones: number;
      escala: unknown;
      dibujo: unknown;
    }
  ) => Promise<{ error?: string }>;
  eliminar: (formData: FormData) => void;
  /** Las tareas del catálogo del cómputo que sirven de capa: las de m². */
  capasDisponibles: CapaDisponible[];
  /** Las tareas que sirven de tipo de muro: las de m² y las de m³. */
  tiposDeMuro: TipoDeMuro[];
  /** La definición de pisos de la obra: de ahí sale a qué nivel está esta
   *  planta y cuántos pisos la repiten. */
  pisosDeObra: Piso[];
  /** Las plantas de la obra, para asignarlas a los pisos. */
  plantasDeObra: { id: string; nombre: string }[];
  guardarPisos: (pisos: Piso[]) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const { imagen } = planta;

  const [trazo, setTrazo] = useState<Trazo>({
    dibujo: planta.dibujo,
    escala: planta.escala,
  });
  const [pasado, setPasado] = useState<Trazo[]>([]);

  const [nombre, setNombre] = useState(planta.nombre);
  const [altura, setAltura] = useState(String(planta.altura));
  const [repeticiones, setRepeticiones] = useState(String(planta.repeticiones));

  // Una planta nueva arranca en la escala: es lo primero que hay que hacer y
  // lo único que no se puede saltear.
  const [herramienta, setHerramienta] = useState<Herramienta>(
    planta.escala ? "seleccionar" : "escala"
  );
  /** Si se dibuja la arquitectura o la estructura. */
  const [modo, setModo] = useState<Modo>("arquitectura");
  const [solapa, setSolapa] = useState<Solapa>("propiedades");
  /** Si está abierta la definición de pisos de la obra. */
  const [definiendoPisos, setDefiniendoPisos] = useState(false);
  // Con qué sale la próxima pieza de la estructura. El nombre vacío es "el
  // que sigue" (`nombreQueSigue`): se escribe sólo para empezar otra serie o
  // ponerle uno propio, vale para la pieza que se pone y después se vacía.
  const [moldeDeColumna, setMoldeDeColumna] = useState<{
    nombre: string;
    ancho: number;
    profundidad: number;
    ancla: Ancla;
    giro: number;
    material: Material;
    perfil: string;
  }>({
    ...COLUMNA_INICIAL,
    nombre: "",
    ancla: "centro",
    giro: 0,
    material: "hormigon",
    perfil: "",
  });
  const [moldeDeViga, setMoldeDeViga] = useState<{
    nombre: string;
    ancho: number;
    alto: number;
    referencia: Referencia;
    material: Material;
    perfil: string;
  }>({ ...VIGA_INICIAL, nombre: "", referencia: "centro", material: "hormigon", perfil: "" });
  const [moldeDeLosa, setMoldeDeLosa] = useState({
    nombre: "",
    espesor: LOSA_INICIAL.espesor,
  });
  const [vista, setVista] = useState<Vista | null>(null);
  const [tamano, setTamano] = useState<{ w: number; h: number } | null>(null);

  /** Los puntos de lo que se está dibujando y todavía no es nada. */
  const [enCurso, setEnCurso] = useState<Punto[]>([]);
  const [cursor, setCursor] = useState<{ punto: Punto; iman: boolean } | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);

  const [espesor, setEspesor] = useState(ESPESOR_INICIAL);
  const [referencia, setReferencia] = useState<Referencia>("centro");
  /** De qué son los muros que se trazan: se elige una vez y vale para todos
   *  los que siguen, como el espesor. */
  const [tipoDeMuro, setTipoDeMuro] = useState<string | null>(null);
  const [ortogonal, setOrtogonal] = useState(true);
  /** Si los puntos se alinean con las esquinas que ya están. */
  const [conGuias, setConGuias] = useState(true);
  /**
   * Si mover la punta de un muro se lleva a los que llegan a ella. Apagado de
   * entrada: prendido, dos muros que se tocaron una vez ya no se podían
   * separar, y acortar uno torcía al otro. Se prende para correr una esquina
   * entera.
   */
  const [puntasJuntas, setPuntasJuntas] = useState(false);
  /** Contra qué quedó alineado el punto que se está marcando o moviendo. */
  const [guias, setGuias] = useState<Guia[]>([]);
  /** La terminación tomada con Copiar, mientras se la va poniendo. */
  const [copiado, setCopiado] = useState<Copiado | null>(null);
  /** La cara del muro elegido que se está terminando, por su clave. */
  const [caraElegida, setCaraElegida] = useState<string | null>(null);

  // La abertura que se va a colocar. Un molde por tipo: pasar de puerta a
  // ventana no puede dejar una ventana de 2,05 de alto.
  const [tipoAbertura, setTipoAbertura] = useState<TipoAbertura>("puerta");
  const [moldes, setMoldes] = useState<Record<TipoAbertura, Molde>>({
    puerta: aMolde(ABERTURA_INICIAL.puerta),
    ventana: aMolde(ABERTURA_INICIAL.ventana),
  });
  /** Dónde caería la abertura si se hiciera clic ahora. */
  const [fantasma, setFantasma] = useState<{
    muroId: string;
    t: number;
    lado: 1 | -1;
  } | null>(null);

  /** Los dos puntos de la regla ya marcados, esperando sus metros. */
  const [reglaMarcada, setReglaMarcada] = useState<{ a: Punto; b: Punto } | null>(null);
  const [metrosDeRegla, setMetrosDeRegla] = useState("");

  /**
   * La distancia que se acaba de tomar con Medir. Vive sólo acá: no entra al
   * dibujo, no se guarda y no cuenta como cambio. Es la cinta métrica, para
   * sacarse una duda sin dejar nada en el plano.
   */
  const [medicion, setMedicion] = useState<{ a: Punto; b: Punto } | null>(null);

  const [sucio, setSucio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  const lienzo = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const paneo = useRef<{ x0: number; y0: number; vista: Vista } | null>(null);
  const arrastre = useRef<Agarre | null>(null);
  /** El dibujo de antes del arrastre, hasta que algo se mueve de verdad: un
   *  clic que sólo selecciona no tiene que dejar un "deshacer" que no hace nada. */
  const antesDeArrastrar = useRef<Trazo | null>(null);
  /** El dibujo de cuando se agarró, durante todo el arrastre —el de arriba se
   *  vacía apenas algo se mueve—: contra él se ubican las aberturas del muro
   *  que se estira. */
  const alAgarrar = useRef<Trazo | null>(null);
  /** Dónde estaba el puntero al agarrar, para saber si ya es un arrastre. */
  const dondeSeAgarro = useRef<{ x: number; y: number } | null>(null);
  /** El último toque sobre un lado o un punto: dos seguidos son un doble clic. */
  const ultimoToque = useRef<{ clave: string; cuando: number } | null>(null);

  const v = vista ?? (tamano ? encuadrar(tamano, imagen) : { x: 0, y: 0, k: 1 });
  /** Un píxel de pantalla, en unidades del plano: para que los trazos y las
   *  letras no engorden al acercar. */
  const u = 1 / v.k;

  const { dibujo, escala } = trazo;
  const mpp = metrosPorPixel(escala);
  const medidas = medir(dibujo, escala, Number(altura) || 0);
  // Los pisos de la obra que son esta planta, de abajo hacia arriba. Si tiene
  // alguno, **ellos dicen cuántos pisos la repiten**; si todavía no se le
  // asignó ninguno, vale lo que se cargó a mano en "Pisos iguales".
  const pisosDeLaPlanta = pisosDeObra.filter((p) => p.plantaId === planta.id);
  /** Cuánto hay de piso terminado a piso terminado en cada uno de ellos. */
  const alturasDePiso = pisosDeLaPlanta.map((p) => p.altura);
  /** A cuánto está el piso terminado que la estructura de esta planta
   *  sostiene —el del piso de arriba—, o null si la planta no es de ninguno. */
  const pisoAPiso = pisosDeObra.find((p) => p.plantaId === planta.id)?.altura ?? null;
  const pisos =
    pisosDeLaPlanta.length > 0
      ? pisosDeLaPlanta.length
      : Math.max(1, Math.round(Number(repeticiones)) || 1);

  // Lo que sale del dibujo y no cambia mientras sólo se mueve el puntero. Se
  // rehace cuando cambian los muros, las aberturas, la escala o el zoom, y no
  // en cada movimiento: con una planta entera son miles de cuentas.
  const { cuerpos, murosPorSuCuerpo, bordes, rincones, solapes } = useMemo(() => {
    // Por dónde va el cuerpo de cada muro. No es su línea marcada: con una
    // cara de referencia el cuerpo queda corrido, y en las esquinas se estira.
    const cuerpos = new Map(
      dibujo.muros.map((m) => [m.id, cuerpoDeMuro(m, dibujo.muros, mpp, u)])
    );

    // Los muros por el eje de su cuerpo: es ahí donde se colocan, se deslizan
    // y se dibujan las aberturas, no sobre la línea que se marcó.
    const murosPorSuCuerpo = dibujo.muros.map((m) => {
      const cuerpo = cuerpos.get(m.id);
      return cuerpo ? { ...m, a: cuerpo.ejeA, b: cuerpo.ejeB } : m;
    });

    // Los bordes de cada muro: las esquinas y las caras de su cuerpo, los
    // rincones donde se encuentra con otro y las esquinas de sus aberturas. Es
    // contra lo que se alinea todo lo que se dibuja después: el contorno de un
    // ambiente va por la cara del muro, no por la línea con la que se lo
    // marcó. Sin escala no hay bordes: el espesor del trazo es de pantalla, no
    // del plano.
    const bordes = new Map<string, { esquinas: Punto[]; caras: { a: Punto; b: Punto }[] }>();
    const rincones: { de: [string, string]; punto: Punto }[] = [];
    if (mpp !== null) {
      for (const m of dibujo.muros) {
        const cuerpo = cuerpos.get(m.id);
        if (!cuerpo) continue;
        bordes.set(m.id, { esquinas: esquinasDeCuerpo(cuerpo), caras: carasDeCuerpo(cuerpo) });
      }

      // Los rincones son de los dos muros que los forman, y van aparte para
      // saber de cuáles: si uno de los dos se está moviendo, su rincón no
      // puede atraer. Guardados entre las esquinas del vecino atraían igual, y
      // la punta que se arrastraba se alineaba con el rincón de su propia
      // otra punta: el muro quedaba torcido por medio espesor.
      for (let i = 0; i < dibujo.muros.length; i++) {
        const uno = bordes.get(dibujo.muros[i].id);
        if (!uno) continue;
        for (let j = i + 1; j < dibujo.muros.length; j++) {
          const otro = bordes.get(dibujo.muros[j].id);
          if (!otro) continue;
          for (const punto of crucesDeCaras(uno.caras, otro.caras)) {
            rincones.push({ de: [dibujo.muros[i].id, dibujo.muros[j].id], punto });
          }
        }
      }

      for (const ab of dibujo.aberturas) {
        const muro = murosPorSuCuerpo.find((m) => m.id === ab.muroId);
        const cuerpo = cuerpos.get(ab.muroId);
        const borde = bordes.get(ab.muroId);
        if (!muro || !cuerpo || !borde) continue;
        // Las cuatro esquinas del vano, sobre las dos caras del muro.
        const forma = formaDeAbertura(muro, ab.t, ab.ancho, mpp, u);
        const medio = cuerpo.grosor / 2;
        borde.esquinas.push(
          forma.en(-forma.medio, -medio),
          forma.en(forma.medio, -medio),
          forma.en(forma.medio, medio),
          forma.en(-forma.medio, medio)
        );
      }
    }

    return {
      cuerpos,
      murosPorSuCuerpo,
      bordes,
      rincones,
      // Los muros que están uno encima de otro: ese largo se cuenta dos veces.
      solapes: solapesDeMuros(dibujo.muros, mpp),
    };
  }, [dibujo.muros, dibujo.aberturas, mpp, u]);

  const encimados = new Set(solapes.flatMap((s) => s.ids));

  // Las caras de los muros con sus m² y sus capas: lo que se termina.
  const alturaDePlanta = Number(altura) || 0;
  const terminaciones = useMemo(
    () => medirCaras(dibujo, mpp, alturaDePlanta),
    [dibujo, mpp, alturaDePlanta]
  );
  const nombreDeCapa = useMemo(
    () => new Map(capasDisponibles.map((c) => [c.id, c.nombre])),
    [capasDisponibles]
  );
  const tipoPorId = useMemo(() => new Map(tiposDeMuro.map((t) => [t.id, t])), [tiposDeMuro]);
  const largoEncimado = solapes.reduce((t, s) => t + s.largo, 0) * (mpp ?? 0);

  // La estructura: cuánto hormigón lleva, y la huella de cada columna y cada
  // viga, que es lo que se dibuja y a lo que se pega lo demás. Sin escala no
  // hay huellas: una sección en metros no tiene tamaño en el plano.
  const { estructura } = dibujo;
  const hormigon = useMemo(
    () => medirEstructura(estructura, mpp, alturaDePlanta, pisoAPiso),
    [estructura, mpp, alturaDePlanta, pisoAPiso]
  );
  const huellas = useMemo(
    () =>
      new Map<string, Punto[]>(
        mpp === null
          ? []
          : [
              ...estructura.columnas.map((c): [string, Punto[]] => [c.id, huellaDeColumna(c, mpp)]),
              ...estructura.vigas.map((v): [string, Punto[]] => [v.id, huellaDeViga(v, mpp)]),
            ]
      ),
    [estructura.columnas, estructura.vigas, mpp]
  );
  const hayEstructura =
    estructura.columnas.length + estructura.vigas.length + estructura.losas.length > 0;

  // ---- El lienzo mide lo que le deja la ventana ---------------------------

  useEffect(() => {
    const el = lienzo.current;
    if (!el) return;

    const observador = new ResizeObserver(([entrada]) => {
      setTamano({
        w: entrada.contentRect.width,
        h: entrada.contentRect.height,
      });
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // La rueda acerca y aleja sin mover lo que está debajo del cursor. Va con
  // `addEventListener` y no con `onWheel` porque React lo registra pasivo, y
  // así no se puede frenar que además se desplace la página.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;

    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      const caja = el.getBoundingClientRect();
      const px = e.clientX - caja.left;
      const py = e.clientY - caja.top;

      setVista((previa) => {
        const base = encuadrar({ w: caja.width, h: caja.height }, imagen);
        const actual = previa ?? base;
        const k = Math.min(
          40,
          Math.max(base.k * 0.4, actual.k * Math.exp(-e.deltaY * 0.0015))
        );
        return {
          k,
          x: actual.x + px / actual.k - px / k,
          y: actual.y + py / actual.k - py / k,
        };
      });
    };

    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, [imagen]);

  // Cerrar la pestaña con el dibujo a medio guardar pierde el calco entero.
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  // ---- Cambios --------------------------------------------------------------

  const cambiar = (nuevo: Trazo) => {
    setPasado((p) => [...p.slice(-99), trazo]);
    setTrazo(nuevo);
    setSucio(true);
  };

  const deshacer = () => {
    // Primero lo que se está dibujando: sacar el último punto de un ambiente a
    // medio cerrar es lo que se espera, no perder el muro anterior.
    if (enCurso.length > 0) {
      setEnCurso(enCurso.slice(0, -1));
      return;
    }
    const anterior = pasado[pasado.length - 1];
    if (!anterior) return;
    setPasado(pasado.slice(0, -1));
    setTrazo(anterior);
    setSeleccion(null);
    setSucio(true);
  };

  /** Elige algo del plano y abre su ficha: es para verla que se lo tocó. */
  const elegir = (cual: NonNullable<Seleccion>) => {
    setSeleccion(cual);
    setSolapa("propiedades");
  };

  const elegirHerramienta = (h: Herramienta) => {
    setHerramienta(h);
    // Las que traen opciones —el espesor del muro, la sección de la viga— las
    // muestran en Propiedades.
    if (h !== "seleccionar" && h !== "mover" && h !== "ambiente") setSolapa("propiedades");
    setEnCurso([]);
    setCursor(null);
    setFantasma(null);
    setGuias([]);
    setMedicion(null);
    if (h !== "copiar") setCopiado(null);
    if (h !== "escala") setReglaMarcada(null);
  };

  /** Pasa de la arquitectura a la estructura, o al revés. Lo elegido se
   *  suelta: del otro lado no se puede tocar. */
  const elegirModo = (nuevo: Modo) => {
    if (nuevo === modo) return;
    setModo(nuevo);
    setSeleccion(null);
    setCaraElegida(null);
    elegirHerramienta("seleccionar");
  };

  // ---- La estructura --------------------------------------------------------

  /** El trazo con una pieza de la estructura cambiada. */
  const conPieza = <K extends ClaseDePieza>(
    clase: K,
    id: string,
    cambios: Partial<Estructura[K][number]>
  ): Trazo => ({
    escala,
    dibujo: {
      ...dibujo,
      estructura: {
        ...estructura,
        [clase]: (estructura[clase] as { id: string }[]).map((pieza) =>
          pieza.id === id ? { ...pieza, ...cambios } : pieza
        ),
      },
    },
  });

  /**
   * Cambia algo de una pieza. El nombre, mientras se tipea, no entra al
   * historial: si no, deshacer iría sacando las letras de a una.
   */
  const cambiarPieza = <K extends ClaseDePieza>(
    clase: K,
    id: string,
    cambios: Partial<Estructura[K][number]>,
    alHistorial = true
  ) => {
    if (alHistorial) {
      cambiar(conPieza(clase, id, cambios));
    } else {
      setTrazo(conPieza(clase, id, cambios));
      setSucio(true);
    }
  };

  const agregarAEstructura = (cambios: Partial<Estructura>) =>
    cambiar({ escala, dibujo: { ...dibujo, estructura: { ...estructura, ...cambios } } });

  // Los nombres que saldrían solos. Las columnas llevan dos series, una por
  // material —C01 y CM01—: en la planilla van aparte.
  const proximaColumna = nombreQueSigue(
    moldeDeColumna.material === "metalica" ? "CM" : "C",
    estructura.columnas.filter((c) => c.material === moldeDeColumna.material)
  );
  const proximaViga = nombreQueSigue(
    moldeDeViga.material === "metalica" ? "VM" : "V",
    estructura.vigas.filter((v) => v.material === moldeDeViga.material)
  );
  const proximaLosa = nombreQueSigue("L", estructura.losas);

  const colocarColumna = (p: Punto) => {
    const { ancho, profundidad, ancla, giro, material, perfil } = moldeDeColumna;
    if (!(ancho > 0) || !(profundidad > 0)) return;
    agregarAEstructura({
      columnas: [
        ...estructura.columnas,
        {
          id: crypto.randomUUID(),
          nombre: moldeDeColumna.nombre.trim() || proximaColumna,
          p,
          ancla,
          giro,
          material,
          perfil: material === "metalica" ? perfil.trim() : "",
          ancho,
          profundidad,
          // De la losa de abajo al fondo de la de arriba: lo de casi todas.
          desde: null,
          arriba: null,
        },
      ],
    });
    // El nombre escrito era de ésta: la que sigue continúa su serie.
    setMoldeDeColumna({ ...moldeDeColumna, nombre: "" });
  };

  const cerrarLosa = (puntos: Punto[]) => {
    if (puntos.length < 3) return;
    const id = crypto.randomUUID();
    agregarAEstructura({
      losas: [
        ...estructura.losas,
        {
          id,
          nombre: moldeDeLosa.nombre.trim() || proximaLosa,
          puntos,
          espesor: moldeDeLosa.espesor,
          bajoNpt: null,
        },
      ],
    });
    setMoldeDeLosa({ ...moldeDeLosa, nombre: "" });
    setEnCurso([]);
    elegir({ tipo: "losa", id });
  };

  /** El trazo con el contorno de un ambiente o de una losa cambiado. */
  const conPuntos = (de: "ambiente" | "losa", id: string, puntos: Punto[]): Trazo =>
    de === "losa"
      ? conPieza("losas", id, { puntos })
      : {
          escala,
          dibujo: {
            ...dibujo,
            ambientes: dibujo.ambientes.map((a) => (a.id === id ? { ...a, puntos } : a)),
          },
        };

  const borrarSeleccion = () => {
    if (!seleccion) return;
    const { tipo, id } = seleccion;
    if (tipo === "columna" || tipo === "viga" || tipo === "losa") {
      agregarAEstructura({
        columnas: estructura.columnas.filter((c) => c.id !== id),
        vigas: estructura.vigas.filter((v) => v.id !== id),
        losas: estructura.losas.filter((l) => l.id !== id),
      });
      setSeleccion(null);
      return;
    }
    cambiar({
      escala,
      dibujo:
        tipo === "muro"
          ? {
              ...dibujo,
              muros: dibujo.muros.filter((m) => m.id !== id),
              // Las aberturas del muro se van con él: sin muro no están en
              // ningún lado.
              aberturas: dibujo.aberturas.filter((a) => a.muroId !== id),
              // Y las capas de sus caras: la clave empieza por el muro.
              caras: sinLasCaras((clave) => clave.startsWith(`${id}|`)),
            }
          : tipo === "ambiente"
            ? {
                ...dibujo,
                ambientes: dibujo.ambientes.filter((a) => a.id !== id),
                // Las caras que daban a él pasan a no dar a ninguno: otra clave.
                caras: sinLasCaras((clave) => clave.endsWith(`|${id}`)),
              }
            : { ...dibujo, aberturas: dibujo.aberturas.filter((a) => a.id !== id) },
    });
    setSeleccion(null);
  };

  /** Las capas propias de las caras, menos las de las claves que se piden. */
  const sinLasCaras = (sobra: (clave: string) => boolean) =>
    Object.fromEntries(Object.entries(dibujo.caras).filter(([clave]) => !sobra(clave)));

  /**
   * Le pone sus capas a una cara, o se las saca (`null`) para que vuelva a
   * llevar las de su ambiente. Una lista vacía no es lo mismo: es "esta cara
   * no lleva nada", y así se guarda.
   */
  const ponerCapasDeCara = (clave: string, capas: Capa[] | null) => {
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        caras:
          capas === null
            ? sinLasCaras((otra) => otra === clave)
            : // Sólo lo que es de la capa: las que vienen de una cara medida
              // traen además cuánto miden, que no se guarda.
              { ...dibujo.caras, [clave]: capas.map(soloLaCapa) },
      },
    });
  };

  /**
   * Copiar, sobre una cara: el primer clic toma su terminación y los
   * siguientes se la ponen a la cara que se toque. Es el pincel de formato:
   * terminar un baño cara por cara son los mismos tres desplegables veinte
   * veces, y casi todas las caras de una planta llevan una de dos o tres
   * terminaciones.
   */
  const tocarCaraParaCopiar = (cara: CaraMedida) => {
    if (!copiado) {
      setCopiado({
        de: "cara",
        capas: cara.capas.map(soloLaCapa),
      });
      return;
    }
    // Un tipo de muro no es una terminación: sobre una cara no hace nada.
    if (copiado.de === "muro") return;
    // De un ambiente, a una cara le tocan sus paredes.
    ponerCapasDeCara(cara.clave, copiado.capas);
  };

  /** Copiar, sobre un muro: toma de qué está hecho y se lo pone a los que se
   *  toquen. Lo de las caras y los ambientes no le toca a un muro. */
  const tocarMuroParaCopiar = (muro: Muro) => {
    if (!copiado) {
      setCopiado({ de: "muro", tarea: muro.tarea });
      return;
    }
    if (copiado.de !== "muro") return;
    cambiarMuros(new Set([muro.id]), { tarea: copiado.tarea });
  };

  /** Cambia algo de varios muros a la vez: su tipo, casi siempre. */
  const cambiarMuros = (ids: Set<string>, cambios: Partial<Muro>) => {
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        muros: dibujo.muros.map((m) => (ids.has(m.id) ? { ...m, ...cambios } : m)),
      },
    });
  };

  /** Copiar, sobre un ambiente: lo mismo, con todo lo del ambiente. */
  const tocarAmbienteParaCopiar = (ambiente: Ambiente) => {
    if (!copiado) {
      setCopiado({
        de: "ambiente",
        nombre: ambiente.nombre,
        capas: ambiente.capas,
        piso: ambiente.piso,
        cielorraso: ambiente.cielorraso,
        alturaCielorraso: ambiente.alturaCielorraso,
      });
      return;
    }
    if (copiado.de === "muro") return;
    cambiarAmbiente(
      ambiente.id,
      copiado.de === "ambiente"
        ? {
            capas: copiado.capas,
            piso: copiado.piso,
            cielorraso: copiado.cielorraso,
            alturaCielorraso: copiado.alturaCielorraso,
          }
        : // De una cara sólo se sabe de paredes: el piso y el cielorraso del
          // ambiente quedan como estaban.
          { capas: copiado.capas }
    );
  };

  /** La altura propia de un muro, o `null` para que vuelva a la de la planta. */
  const ponerAlturaDeMuro = (id: string, altura: number | null) => {
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        muros: dibujo.muros.map((m) => (m.id === id ? { ...m, altura } : m)),
      },
    });
  };

  /** Cambia algo de la terminación de un ambiente: sus paredes, su piso, su
   *  cielorraso. */
  const cambiarAmbiente = (id: string, cambios: Partial<Ambiente>) => {
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        ambientes: dibujo.ambientes.map((a) => (a.id === id ? { ...a, ...cambios } : a)),
      },
    });
  };

  const cerrarAmbiente = (puntos: Punto[]) => {
    if (puntos.length < 3) return;
    const id = crypto.randomUUID();
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        ambientes: [
          ...dibujo.ambientes,
          {
            id,
            nombre: `Ambiente ${dibujo.ambientes.length + 1}`,
            puntos,
            capas: [],
            alturaCielorraso: null,
            cielorraso: [],
            piso: [],
          },
        ],
      },
    });
    setEnCurso([]);
    // Queda seleccionado para ponerle el nombre ahí mismo, a la derecha.
    elegir({ tipo: "ambiente", id });
  };

  const cambiarMolde = (
    campo: "nombre" | "ancho" | "alto" | "antepecho",
    valor: string
  ) => {
    let molde = { ...moldes[tipoAbertura], [campo]: valor };
    if (campo === "nombre") {
      // Un nombre que ya está en la planta es ese tipo de carpintería: trae
      // sus medidas, para que la tercera P1 no haya que medirla de nuevo.
      const igual = dibujo.aberturas.find(
        (a) => a.tipo === tipoAbertura && a.nombre === valor.trim()
      );
      if (igual) {
        molde = {
          ...molde,
          ancho: String(igual.ancho),
          alto: String(igual.alto),
          // El antepecho no es del tipo, pero el de la anterior es la mejor
          // primera respuesta: se corrige si esta va a otra altura.
          antepecho: igual.antepecho === null ? molde.antepecho : String(igual.antepecho),
          apertura: igual.apertura ?? molde.apertura,
          hojas: igual.hojas ?? molde.hojas,
        };
      }
    }
    setMoldes({ ...moldes, [tipoAbertura]: molde });
  };

  const colocarAbertura = (p: Punto) => {
    const molde = moldes[tipoAbertura];
    const ancho = Number(molde.ancho);
    const alto = Number(molde.alto);
    if (!(ancho > 0) || !(alto > 0)) return;

    const muro = muroCercano(p, murosPorSuCuerpo, ALCANCE_ABERTURA * u);
    if (!muro) return;

    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        aberturas: [
          ...dibujo.aberturas,
          {
            id: crypto.randomUUID(),
            muroId: muro.id,
            t: posicionEnMuro(p, muro, ancho, mpp),
            tipo: tipoAbertura,
            nombre: molde.nombre.trim(),
            ancho,
            alto,
            mano: tipoAbertura === "puerta" ? molde.mano : null,
            antepecho:
              tipoAbertura === "ventana" && molde.antepecho !== "" && Number(molde.antepecho) >= 0
                ? Number(molde.antepecho)
                : null,
            apertura: tipoAbertura === "ventana" ? molde.apertura : null,
            hojas: tipoAbertura === "ventana" ? molde.hojas : null,
            // Abre hacia el lado del muro donde se hizo clic.
            lado: ladoDe(p, muro),
          },
        ],
      },
    });
  };

  /** Cambia algo de una sola abertura: su mano, hacia dónde abre. */
  const cambiarAbertura = (id: string, cambios: Partial<Abertura>) => {
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        aberturas: dibujo.aberturas.map((a) => (a.id === id ? { ...a, ...cambios } : a)),
      },
    });
  };

  /** Cambia algo que es del tipo —cómo abre, cuántas hojas— en todas las suyas. */
  const cambiarTipo = (de: Abertura, cambios: Partial<Abertura>) => {
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        aberturas: dibujo.aberturas.map((a) =>
          a.tipo === de.tipo && a.nombre === de.nombre ? { ...a, ...cambios } : a
        ),
      },
    });
  };

  /** Cambia una medida de la abertura elegida y de todas las de su tipo. */
  const medirTipo = (de: Abertura, campo: "ancho" | "alto", valor: number) => {
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        aberturas: dibujo.aberturas.map((a) =>
          a.tipo === de.tipo && a.nombre === de.nombre ? { ...a, [campo]: valor } : a
        ),
      },
    });
  };

  const renombrarAbertura = (de: Abertura, nombre: string) => {
    // Si el nombre nuevo ya existe, pasa a ser de ese tipo y toma sus medidas.
    const igual = dibujo.aberturas.find(
      (a) => a.id !== de.id && a.tipo === de.tipo && a.nombre === nombre.trim()
    );
    setTrazo({
      escala,
      dibujo: {
        ...dibujo,
        aberturas: dibujo.aberturas.map((a) =>
          a.id === de.id
            ? {
                ...a,
                nombre,
                ...(igual
                  ? {
                      ancho: igual.ancho,
                      alto: igual.alto,
                      apertura: igual.apertura,
                      hojas: igual.hojas,
                    }
                  : {}),
              }
            : a
        ),
      },
    });
    setSucio(true);
  };

  /** Deja un muro horizontal o vertical, lo que tenga más cerca, girándolo
   *  sobre su primer punto. Los muros que llegan a la punta que se mueve van
   *  con ella. */
  const escuadrarMuro = (m: Muro) => {
    const horizontal = Math.abs(m.b.x - m.a.x) >= Math.abs(m.b.y - m.a.y);
    const destino = horizontal ? { x: m.b.x, y: m.a.y } : { x: m.a.x, y: m.b.y };
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        muros: dibujo.muros.map((otro) => ({
          ...otro,
          a: otro.id !== m.id && mismoPunto(otro.a, m.b) ? destino : otro.a,
          b: mismoPunto(otro.b, m.b) ? destino : otro.b,
        })),
      },
    });
  };

  const aplicarEscala = () => {
    const metros = Number(metrosDeRegla.replace(",", "."));
    if (!reglaMarcada || !(metros > 0)) return;
    cambiar({ dibujo, escala: { ...reglaMarcada, metros } });
    setReglaMarcada(null);
    setMetrosDeRegla("");
    // Con la escala puesta, lo que sigue es dibujar.
    elegirHerramienta("muro");
  };

  // ---- El puntero -----------------------------------------------------------

  const aPlano = (e: { clientX: number; clientY: number }): Punto => {
    const caja = svg.current?.getBoundingClientRect();
    if (!caja) return { x: 0, y: 0 };
    return {
      x: v.x + (e.clientX - caja.left) / v.k,
      y: v.y + (e.clientY - caja.top) / v.k,
    };
  };

  /**
   * Todo punto ya puesto, que es a lo que se pega uno nuevo: las puntas de los
   * muros, las esquinas de sus cuerpos y de sus aberturas, y los puntos de los
   * ambientes.
   *
   * `sinBordesDe` son los muros que se están moviendo: sus bordes van con
   * ellos, y si atrajeran a la punta que se arrastra el muro se perseguiría a
   * sí mismo.
   */
  const verticesMenos = (excluido?: Punto, sinBordesDe?: Set<string>): Punto[] => {
    const todos = [
      ...dibujo.muros.flatMap((m) => [
        m.a,
        m.b,
        ...(sinBordesDe?.has(m.id) ? [] : bordes.get(m.id)?.esquinas ?? []),
      ]),
      ...rincones
        .filter((r) => !sinBordesDe?.has(r.de[0]) && !sinBordesDe?.has(r.de[1]))
        .map((r) => r.punto),
      ...dibujo.ambientes.flatMap((a) => a.puntos),
      ...puntosDeEstructura(sinBordesDe),
    ];
    return excluido ? todos.filter((p) => !mismoPunto(p, excluido)) : todos;
  };

  /**
   * Los puntos de la estructura: las esquinas de las columnas y de las vigas,
   * las puntas de las vigas y los puntos de las losas. Atraen también al
   * dibujar la arquitectura: un muro va de columna a columna.
   */
  const puntosDeEstructura = (sinLasDe?: Set<string>): Punto[] => [
    ...estructura.columnas.flatMap((c) => (sinLasDe?.has(c.id) ? [] : huellas.get(c.id) ?? [])),
    ...estructura.vigas.flatMap((v) =>
      sinLasDe?.has(v.id) ? [] : [v.a, v.b, ...(huellas.get(v.id) ?? [])]
    ),
    ...estructura.losas.flatMap((l) => (sinLasDe?.has(l.id) ? [] : l.puntos)),
  ];

  /** Las líneas sobre las que se apoya un punto: cada muro por su línea
   *  marcada y por sus dos caras, y los lados de las columnas y las vigas. */
  const lineasDeApoyo = (sinLasDe?: Set<string>): { a: Punto; b: Punto }[] => [
    ...dibujo.muros.flatMap((m) =>
      sinLasDe?.has(m.id) ? [] : [m, ...(bordes.get(m.id)?.caras ?? [])]
    ),
    ...[...estructura.columnas, ...estructura.vigas].flatMap((pieza) =>
      sinLasDe?.has(pieza.id) ? [] : ladosDe(huellas.get(pieza.id) ?? [])
    ),
  ];

  /**
   * Estirar: mientras el puntero sigue la línea del tramo que se agarró, su
   * punta va **por esa línea**, y se alarga o se acorta sin torcerse. Es lo
   * que se quiere casi siempre al tocar una punta; arrastrada a pulso, quedaba
   * unos centímetros al costado y el muro entero cambiaba de dirección.
   *
   * La línea es la que tenía al agarrarlo, no la de ahora: si fuera la de
   * ahora, una vez torcido seguiría torcido. Lejos de ella (`ESTIRAR`) la
   * punta queda libre, que es como se lo gira a propósito.
   *
   * Devuelve además dónde esa línea cruza a los muros y a sus caras, para que
   * la punta se frene justo ahí —el encuentro en T, sin puntería—, y la línea
   * misma como apoyo.
   */
  const estirar = (
    crudo: Punto,
    eje: { a: Punto; b: Punto } | null,
    sinLasDe?: Set<string>
  ): { punto: Punto; cruces: Punto[]; lineas: { a: Punto; b: Punto }[] } => {
    const enEje = eje ? proyectar(crudo, eje.a, eje.b) : null;
    if (!eje || !enEje || distancia(crudo, enEje) > ESTIRAR * u) {
      return { punto: crudo, cruces: [], lineas: [] };
    }
    return {
      punto: enEje,
      cruces: crucesDeCaras([eje], lineasDeApoyo(sinLasDe)),
      lineas: [eje],
    };
  };

  const ajustarAlDibujar = (crudo: Punto) =>
    ajustar(crudo, {
      previo: enCurso[enCurso.length - 1] ?? null,
      ortogonal,
      tolerancia: IMAN * u,
      // El primer punto de un ambiente a medio dibujar también atrae: es
      // adonde hay que volver para cerrarlo.
      vertices: [...verticesMenos(), ...enCurso],
      muros: lineasDeApoyo(),
      guias: conGuias,
    });

  const ponerPunto = (p: Punto) => {
    const ultimo = enCurso[enCurso.length - 1];

    if (herramienta === "escala") {
      if (!ultimo) {
        setReglaMarcada(null);
        setEnCurso([p]);
      } else if (!mismoPunto(ultimo, p)) {
        setReglaMarcada({ a: ultimo, b: p });
        setEnCurso([]);
        // Ahí está el campo donde se escriben los metros.
        setSolapa("propiedades");
      }
      return;
    }

    if (herramienta === "medir") {
      if (!ultimo) {
        // Un clic con una medida ya tomada empieza otra.
        setMedicion(null);
        setEnCurso([p]);
      } else if (!mismoPunto(ultimo, p)) {
        setMedicion({ a: ultimo, b: p });
        setEnCurso([]);
      }
      return;
    }

    if (herramienta === "muro") {
      // Un muro termina donde empieza el siguiente: así se recorre una pared
      // quebrada sin volver a hacer clic en cada esquina.
      if (ultimo && !mismoPunto(ultimo, p)) {
        cambiar({
          escala,
          dibujo: {
            ...dibujo,
            muros: [
              ...dibujo.muros,
              {
                id: crypto.randomUUID(),
                a: ultimo,
                b: p,
                espesor,
                referencia,
                altura: null,
                tarea: tipoDeMuro,
              },
            ],
          },
        });
      }
      setEnCurso([p]);
      return;
    }

    if (herramienta === "viga") {
      // Como los muros: la que sigue arranca donde terminó esta.
      if (ultimo && !mismoPunto(ultimo, p)) {
        agregarAEstructura({
          vigas: [
            ...estructura.vigas,
            {
              id: crypto.randomUUID(),
              nombre: moldeDeViga.nombre.trim() || proximaViga,
              a: ultimo,
              b: p,
              referencia: moldeDeViga.referencia,
              material: moldeDeViga.material,
              perfil: moldeDeViga.material === "metalica" ? moldeDeViga.perfil.trim() : "",
              ancho: moldeDeViga.ancho,
              alto: moldeDeViga.alto,
              nivel: null,
            },
          ],
        });
        setMoldeDeViga({ ...moldeDeViga, nombre: "" });
      }
      setEnCurso([p]);
      return;
    }

    if (herramienta === "ambiente" || herramienta === "losa") {
      if (enCurso.length >= 3 && mismoPunto(enCurso[0], p)) {
        if (herramienta === "losa") cerrarLosa(enCurso);
        else cerrarAmbiente(enCurso);
      } else if (!ultimo || !mismoPunto(ultimo, p)) {
        setEnCurso([...enCurso, p]);
      }
    }
  };

  const alBajar = (e: React.PointerEvent<SVGSVGElement>) => {
    // El foco va al lienzo para sacarlo del campo donde se estaba escribiendo.
    // Sin `preventScroll` el navegador corre la página para mostrar el lienzo
    // entero, y el plano salta debajo del puntero justo al hacer clic.
    lienzo.current?.focus({ preventScroll: true });

    if (e.button === 1 || (e.button === 0 && herramienta === "mover")) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      paneo.current = { x0: e.clientX, y0: e.clientY, vista: v };
      return;
    }

    if (e.button !== 0) return;

    if (herramienta === "seleccionar") {
      // Llegó hasta acá: no se tocó ninguna figura.
      setSeleccion(null);
      return;
    }

    if (herramienta === "abertura") {
      colocarAbertura(aPlano(e));
      return;
    }

    if (herramienta === "columna") {
      colocarColumna(ajustarAlDibujar(aPlano(e)).punto);
      return;
    }

    // Con Copiar sólo cuentan las caras y los ambientes, que se tocan solos.
    if (herramienta === "copiar") return;

    ponerPunto(ajustarAlDibujar(aPlano(e)).punto);
  };

  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    if (paneo.current) {
      const { x0, y0, vista: inicial } = paneo.current;
      setVista({
        k: inicial.k,
        x: inicial.x - (e.clientX - x0) / inicial.k,
        y: inicial.y - (e.clientY - y0) / inicial.k,
      });
      return;
    }

    const agarrado = arrastre.current;
    if (agarrado) {
      // Recién acá, con el primer movimiento de verdad, el arrastre empieza y
      // entra al historial.
      const inicio = antesDeArrastrar.current;
      if (inicio) {
        const desde = dondeSeAgarro.current;
        if (
          desde &&
          Math.hypot(e.clientX - desde.x, e.clientY - desde.y) < UMBRAL_DE_ARRASTRE
        ) {
          return;
        }
        // Lo que se arrastró no es la primera mitad de un doble clic.
        ultimoToque.current = null;
        setPasado((p) => [...p.slice(-99), inicio]);
        antesDeArrastrar.current = null;
      }

      if (agarrado.tipo === "esquina") {
        const abertura = dibujo.aberturas.find((a) => a.id === agarrado.id);
        const muro = murosPorSuCuerpo.find((m) => m.id === abertura?.muroId);
        const cuerpo = abertura ? cuerpos.get(abertura.muroId) : undefined;
        if (!abertura || !muro || !cuerpo) return;
        const largo = distancia(muro.a, muro.b);
        if (!(largo > 0)) return;

        // Sus propias esquinas van con ella: si atrajeran, se perseguiría.
        const forma = formaDeAbertura(muro, abertura.t, abertura.ancho, mpp, u);
        const propias = ESQUINAS_DE_ABERTURA.map(([l, a]) =>
          forma.en(l * forma.medio, (a * cuerpo.grosor) / 2)
        );
        const ajuste = ajustar(aPlano(e), {
          previo: null,
          ortogonal: false,
          tolerancia: IMAN * u,
          vertices: verticesMenos().filter((p) => !propias.some((q) => mismoPunto(p, q))),
          muros: lineasDeApoyo(),
          guias: conGuias,
        });

        // Dónde cae la esquina a lo largo del muro, y de ahí dónde va el
        // centro: medio ancho más acá o más allá, según qué jamba se agarró.
        const dx = (muro.b.x - muro.a.x) / largo;
        const dy = (muro.b.y - muro.a.y) / largo;
        const dondeLaEsquina =
          (ajuste.punto.x - muro.a.x) * dx + (ajuste.punto.y - muro.a.y) * dy;
        const centro = dondeLaEsquina - agarrado.alLargo * forma.medio;
        // Sin asomar por las puntas del muro, como al deslizarla.
        const medio = forma.medio / largo;
        const t = medio >= 0.5 ? 0.5 : Math.min(1 - medio, Math.max(medio, centro / largo));

        setTrazo({
          escala,
          dibujo: {
            ...dibujo,
            aberturas: dibujo.aberturas.map((a) => (a.id === abertura.id ? { ...a, t } : a)),
          },
        });
        setGuias(ajuste.guias);
        setSucio(true);
        return;
      }

      if (agarrado.tipo === "abertura") {
        const abertura = dibujo.aberturas.find((a) => a.id === agarrado.id);
        const muro = murosPorSuCuerpo.find((m) => m.id === abertura?.muroId);
        if (!abertura || !muro) return;
        const t = posicionEnMuro(aPlano(e), muro, abertura.ancho, mpp);
        setTrazo({
          escala,
          dibujo: {
            ...dibujo,
            aberturas: dibujo.aberturas.map((a) => (a.id === abertura.id ? { ...a, t } : a)),
          },
        });
        setSucio(true);
        return;
      }

      if (agarrado.tipo === "lado") {
        const { puntos, indice, inicio } = agarrado;
        const a = puntos[indice];
        const b = puntos[(indice + 1) % puntos.length];
        const largo = distancia(a, b);
        if (!(largo > 0)) return;

        // Cuánto se corrió el puntero, medido de costado al lado.
        const nx = -(b.y - a.y) / largo;
        const ny = (b.x - a.x) / largo;
        const p = aPlano(e);
        let cuanto = (p.x - inicio.x) * nx + (p.y - inicio.y) * ny;

        // El lado se frena a la altura de cualquier otra esquina: así una
        // pared del ambiente queda en línea con la cara de un muro.
        let alineadoCon: Punto | null = null;
        if (conGuias) {
          let menor = IMAN * u * 0.6;
          const otros = [
            ...dibujo.muros.flatMap((m) => [m.a, m.b, ...(bordes.get(m.id)?.esquinas ?? [])]),
            ...rincones.map((r) => r.punto),
            ...dibujo.ambientes.flatMap((amb) => (amb.id === agarrado.id ? [] : amb.puntos)),
            ...puntosDeEstructura(new Set([agarrado.id])),
            ...puntos.filter((_, k) => k !== indice && k !== (indice + 1) % puntos.length),
          ];
          for (const otro of otros) {
            const aSuAltura = (otro.x - a.x) * nx + (otro.y - a.y) * ny;
            if (Math.abs(aSuAltura - cuanto) <= menor) {
              menor = Math.abs(aSuAltura - cuanto);
              alineadoCon = otro;
            }
          }
          if (alineadoCon) cuanto = (alineadoCon.x - a.x) * nx + (alineadoCon.y - a.y) * ny;
        }

        const corrido = moverLado(puntos, indice, cuanto);
        setTrazo(conPuntos(agarrado.de, agarrado.id, corrido.puntos));
        setGuias(alineadoCon ? [{ desde: alineadoCon, hasta: corrido.a }] : []);
        setSucio(true);
        return;
      }

      if (agarrado.tipo === "columna") {
        // La columna va entera; lo que se pega a una esquina o se alinea es
        // su punto marcado —el centro o la esquina de la que se agarra—.
        const propia = new Set([agarrado.id]);
        const p = aPlano(e);
        const ajuste = ajustar(
          { x: p.x - agarrado.corrida.x, y: p.y - agarrado.corrida.y },
          {
            previo: null,
            ortogonal: false,
            tolerancia: IMAN * u,
            vertices: verticesMenos(undefined, propia),
            muros: lineasDeApoyo(propia),
            guias: conGuias,
          }
        );
        setTrazo(conPieza("columnas", agarrado.id, { p: ajuste.punto }));
        setGuias(ajuste.guias);
        setSucio(true);
        return;
      }

      if (agarrado.tipo === "viga") {
        const viga = estructura.vigas.find((v) => v.id === agarrado.id);
        if (!viga) return;
        const propia = new Set([viga.id]);
        const estirada = estirar(aPlano(e), agarrado.eje, propia);
        const ajuste = ajustar(estirada.punto, {
          previo: null,
          ortogonal: false,
          tolerancia: IMAN * u,
          // Su otra punta sí atrae: es contra la que se la deja a escuadra.
          vertices: [
            ...verticesMenos(undefined, propia),
            agarrado.punta === "a" ? viga.b : viga.a,
            ...estirada.cruces,
          ],
          muros: [...lineasDeApoyo(propia), ...estirada.lineas],
          guias: conGuias,
        });
        setTrazo(conPieza("vigas", viga.id, { [agarrado.punta]: ajuste.punto }));
        setGuias(ajuste.guias);
        setSucio(true);
        return;
      }

      const losaAgarrada =
        agarrado.tipo === "losa" ? estructura.losas.find((l) => l.id === agarrado.id) : undefined;
      const origen =
        agarrado.tipo === "muro"
          ? agarrado.desde
          : agarrado.tipo === "losa"
            ? losaAgarrada?.puntos[agarrado.indice]
            : dibujo.ambientes.find((a) => a.id === agarrado.id)?.puntos[agarrado.indice];

      // Los muros que se mueven con esta punta: el elegido, y con las puntas
      // unidas todos los que llegan a ella.
      const enMovimiento =
        agarrado.tipo === "muro"
          ? new Set(
              puntasJuntas
                ? dibujo.muros
                    .filter(
                      (m) => mismoPunto(m.a, agarrado.desde) || mismoPunto(m.b, agarrado.desde)
                    )
                    .map((m) => m.id)
                : [agarrado.id]
            )
          : undefined;

      // Un muro solo se estira; una esquina de varios no tiene una línea que
      // seguir, y un punto de un contorno tampoco.
      const estirada = estirar(
        aPlano(e),
        agarrado.tipo === "muro" && enMovimiento?.size === 1 ? agarrado.eje : null,
        enMovimiento
      );
      const ajuste = ajustar(estirada.punto, {
        previo: null,
        ortogonal: false,
        tolerancia: IMAN * u,
        vertices: [...verticesMenos(origen, enMovimiento), ...estirada.cruces],
        muros: [...lineasDeApoyo(enMovimiento), ...estirada.lineas],
        guias: conGuias,
      });
      const destino = ajuste.punto;
      setGuias(ajuste.guias);

      if (agarrado.tipo === "muro") {
        const desde = agarrado.desde;
        /** Si esa punta de ese muro es de las que se mueven. */
        const seMueve = (m: Muro, punta: "a" | "b") =>
          puntasJuntas
            ? mismoPunto(m[punta], desde)
            : m.id === agarrado.id && punta === agarrado.punta;
        const muros = dibujo.muros.map((m) => ({
          ...m,
          a: seMueve(m, "a") ? destino : m.a,
          b: seMueve(m, "b") ? destino : m.b,
        }));
        // Las puertas y las ventanas se quedan donde están en el plano: no se
        // corren porque el muro siga más allá. Contra el dibujo de cuando
        // empezó el arrastre, para que la que la punta empujó al acortar
        // vuelva a su lugar si el muro se alarga de nuevo.
        const alEmpezar = alAgarrar.current?.dibujo ?? dibujo;
        setTrazo({
          escala,
          dibujo: {
            ...dibujo,
            muros,
            aberturas: aberturasEnSuLugar(alEmpezar.aberturas, alEmpezar.muros, muros, mpp, u),
          },
        });
        agarrado.desde = destino;
      } else {
        const contorno =
          agarrado.tipo === "losa"
            ? losaAgarrada?.puntos
            : dibujo.ambientes.find((a) => a.id === agarrado.id)?.puntos;
        if (!contorno) return;
        setTrazo(
          conPuntos(
            agarrado.tipo,
            agarrado.id,
            contorno.map((p, i) => (i === agarrado.indice ? destino : p))
          )
        );
      }
      setSucio(true);
      return;
    }

    if (
      herramienta === "escala" ||
      herramienta === "muro" ||
      herramienta === "ambiente" ||
      herramienta === "medir" ||
      herramienta === "columna" ||
      herramienta === "viga" ||
      herramienta === "losa"
    ) {
      const ajuste = ajustarAlDibujar(aPlano(e));
      setCursor(ajuste);
      setGuias(ajuste.guias);
    } else if (herramienta === "abertura") {
      const p = aPlano(e);
      const muro = muroCercano(p, murosPorSuCuerpo, ALCANCE_ABERTURA * u);
      const ancho = Number(moldes[tipoAbertura].ancho);
      setFantasma(
        muro && ancho > 0
          ? { muroId: muro.id, t: posicionEnMuro(p, muro, ancho, mpp), lado: ladoDe(p, muro) }
          : null
      );
    }
  };

  const alSoltar = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    paneo.current = null;
    arrastre.current = null;
    antesDeArrastrar.current = null;
    alAgarrar.current = null;
    setGuias([]);
  };

  /** Agarra un vértice de lo seleccionado, o una abertura, para moverlo. */
  const agarrar = (e: React.PointerEvent, cual: Agarre) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    svg.current?.setPointerCapture(e.pointerId);
    // Una sola entrada en el historial por arrastre, no una por píxel movido,
    // y recién cuando se mueve (`alMover`).
    antesDeArrastrar.current = trazo;
    alAgarrar.current = trazo;
    dondeSeAgarro.current = { x: e.clientX, y: e.clientY };
    arrastre.current = cual;
  };

  /**
   * Si este toque es el segundo de un doble clic sobre lo mismo. La hora es la
   * del evento, no la del reloj: es la del toque, y no cambia si se vuelve a
   * preguntar.
   */
  const esDobleToque = (clave: string, ahora: number) => {
    const anterior = ultimoToque.current;
    if (anterior && anterior.clave === clave && ahora - anterior.cuando < DOBLE_TOQUE) {
      ultimoToque.current = null;
      return true;
    }
    ultimoToque.current = { clave, cuando: ahora };
    return false;
  };

  /**
   * Parte un muro en dos, en el punto donde se hizo doble clic.
   *
   * Es el "agregar un punto" de un muro: de ahí en más cada mitad se mueve, se
   * acorta o cambia de espesor por su cuenta. Las dos heredan todo del
   * original, y cada abertura se queda en la mitad donde estaba, en el mismo
   * lugar: partir no mueve nada.
   */
  const partirMuro = (m: Muro, crudo: Punto) => {
    const acomodado = ajustar(crudo, {
      previo: null,
      ortogonal: false,
      tolerancia: IMAN * u,
      vertices: verticesMenos(),
      muros: [],
      guias: conGuias,
    }).punto;
    const corte = proyectar(acomodado, m.a, m.b);
    // En una punta no hay nada que partir.
    if (mismoPunto(corte, m.a) || mismoPunto(corte, m.b)) return;

    const dondeCorta = distancia(m.a, corte) / distancia(m.a, m.b);
    const segundo: Muro = { ...m, id: crypto.randomUUID(), a: corte };

    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        muros: dibujo.muros.flatMap((otro) =>
          otro.id === m.id ? [{ ...m, b: corte }, segundo] : [otro]
        ),
        // Las capas de las caras del original valen para las dos mitades.
        caras: {
          ...dibujo.caras,
          ...Object.fromEntries(
            Object.entries(dibujo.caras)
              .filter(([clave]) => clave.startsWith(`${m.id}|`))
              .map(([clave, capas]) => [segundo.id + clave.slice(m.id.length), capas])
          ),
        },
        aberturas: dibujo.aberturas.map((ab) => {
          if (ab.muroId !== m.id) return ab;
          // La fracción se rehace sobre la mitad que le tocó.
          return ab.t <= dondeCorta
            ? { ...ab, t: ab.t / dondeCorta }
            : { ...ab, muroId: segundo.id, t: (ab.t - dondeCorta) / (1 - dondeCorta) };
        }),
      },
    });
  };

  /**
   * Suma un punto a un ambiente, sobre uno de sus lados.
   *
   * El punto cae **sobre el lado**, no donde se hizo clic: agregarlo no puede
   * cambiar la forma, eso viene después, al moverlo. A lo largo del lado sí
   * se acomoda —se pega a un vértice cercano o se alinea con otra esquina—,
   * porque casi siempre se lo quiere a la altura de algo: donde arranca un
   * placard, donde termina un muro.
   */
  const agregarPunto = (
    amb: { id: string; puntos: Punto[] },
    indice: number,
    crudo: Punto,
    de: "ambiente" | "losa" = "ambiente"
  ) => {
    const a = amb.puntos[indice];
    const b = amb.puntos[(indice + 1) % amb.puntos.length];
    const acomodado = ajustar(crudo, {
      previo: null,
      ortogonal: false,
      tolerancia: IMAN * u,
      vertices: verticesMenos(),
      muros: [],
      guias: conGuias,
    }).punto;
    const nuevo = proyectar(acomodado, a, b);
    // Sobre una esquina no hay nada que agregar.
    if (mismoPunto(nuevo, a) || mismoPunto(nuevo, b)) return;

    cambiar(
      conPuntos(de, amb.id, [
        ...amb.puntos.slice(0, indice + 1),
        nuevo,
        ...amb.puntos.slice(indice + 1),
      ])
    );
  };

  /** Saca un punto de un ambiente o de una losa. Con tres ya no: dos puntos no
   *  encierran nada. */
  const quitarPunto = (
    amb: { id: string; puntos: Punto[] },
    indice: number,
    de: "ambiente" | "losa" = "ambiente"
  ) => {
    if (amb.puntos.length <= 3) return;
    cambiar(
      conPuntos(
        de,
        amb.id,
        amb.puntos.filter((_, k) => k !== indice)
      )
    );
  };

  /**
   * Los atajos del editor. Se escuchan en la ventana y no en el lienzo: con el
   * foco en el lienzo dejaban de andar apenas se tocaba un botón del panel
   * —Escuadrar, por ejemplo—, y el Ctrl+Z de después no deshacía nada.
   */
  const alTeclear = useEffectEvent((e: KeyboardEvent) => {
    // Con la definición de pisos abierta las teclas son de ella: Supr no
    // puede borrar un muro que está detrás.
    if (definiendoPisos) return;
    const donde = e.target instanceof HTMLElement ? e.target : null;
    // Escribiendo en un campo, las teclas son del campo: Supr borra una letra
    // y Ctrl+Z deshace lo tipeado, no un muro.
    if (donde && (donde.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(donde.tagName))) {
      return;
    }
    // Enter sobre un botón es apretarlo, no cerrar lo que se está dibujando.
    if (e.key === "Enter" && donde?.tagName === "BUTTON") return;

    if (e.key === "Escape") {
      if (enCurso.length > 0) setEnCurso([]);
      else if (reglaMarcada) setReglaMarcada(null);
      else if (medicion) setMedicion(null);
      else if (copiado) setCopiado(null);
      else setSeleccion(null);
    } else if (e.key === "Enter") {
      if (herramienta === "ambiente") cerrarAmbiente(enCurso);
      else if (herramienta === "losa") cerrarLosa(enCurso);
      else setEnCurso([]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      borrarSeleccion();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      deshacer();
    }
  });

  useEffect(() => {
    const escuchar = (e: KeyboardEvent) => alTeclear(e);
    window.addEventListener("keydown", escuchar);
    return () => window.removeEventListener("keydown", escuchar);
  }, []);

  const guardarTodo = () => {
    iniciarGuardado(async () => {
      const resultado = await guardar(slug, planta.id, {
        nombre,
        altura: Number(altura),
        // Con pisos asignados, son ellos los que cuentan.
        repeticiones: pisosDeLaPlanta.length > 0 ? pisosDeLaPlanta.length : Number(repeticiones),
        escala,
        dibujo,
      });

      if (resultado.error) {
        setError(resultado.error);
      } else {
        setError(null);
        setSucio(false);
      }
    });
  };

  // ---- Lo seleccionado ------------------------------------------------------

  const muroElegido =
    seleccion?.tipo === "muro"
      ? dibujo.muros.find((m) => m.id === seleccion.id) ?? null
      : null;
  const ambienteElegido =
    seleccion?.tipo === "ambiente"
      ? dibujo.ambientes.find((a) => a.id === seleccion.id) ?? null
      : null;

  const aberturaElegida =
    seleccion?.tipo === "abertura"
      ? dibujo.aberturas.find((a) => a.id === seleccion.id) ?? null
      : null;
  // Las cuatro esquinas de la abertura elegida, sobre las dos caras de su
  // muro: de ahí se la agarra para alinearla.
  const muroDeLaElegida = aberturaElegida
    ? murosPorSuCuerpo.find((m) => m.id === aberturaElegida.muroId) ?? null
    : null;
  const formaDeLaElegida =
    aberturaElegida && muroDeLaElegida
      ? formaDeAbertura(muroDeLaElegida, aberturaElegida.t, aberturaElegida.ancho, mpp, u)
      : null;
  const grosorDeLaElegida = aberturaElegida
    ? cuerpos.get(aberturaElegida.muroId)?.grosor ?? 0
    : 0;

  /** De piso a techo en el muro de la abertura elegida: la suya o la de la planta. */
  const alturaDeSuMuro = aberturaElegida
    ? dibujo.muros.find((m) => m.id === aberturaElegida.muroId)?.altura ?? alturaDePlanta
    : 0;
  /** Cuántas hay de su tipo, ella incluida: cambian de medida juntas. */
  const delMismoTipo = aberturaElegida
    ? dibujo.aberturas.filter(
        (a) => a.tipo === aberturaElegida.tipo && a.nombre === aberturaElegida.nombre
      ).length
    : 0;
  const molde = moldes[tipoAbertura];
  const muroDelFantasma = fantasma
    ? murosPorSuCuerpo.find((m) => m.id === fantasma.muroId) ?? null
    : null;
  const formaDelFantasma =
    herramienta === "abertura" && fantasma && muroDelFantasma
      ? formaDeAbertura(muroDelFantasma, fantasma.t, Number(molde.ancho) || 0, mpp, u)
      : null;

  // Medir entra acá aunque no deje nada: marca puntos igual que las otras, con
  // el mismo imán y la misma escuadra, que es lo que la hace exacta.
  const dibujando =
    herramienta === "escala" ||
    herramienta === "muro" ||
    herramienta === "ambiente" ||
    herramienta === "medir" ||
    herramienta === "viga" ||
    herramienta === "losa";
  // La columna no traza nada, pero su punto se marca con el mismo imán.
  const marcando = dibujando || herramienta === "columna";
  // Las figuras sólo se dejan tocar con Seleccionar: dibujando, un clic sobre
  // un muro es un punto nuevo que se le pega, no una selección. Y sólo las del
  // modo en que se está: las del otro se ven, pero no se tocan.
  const tocable = herramienta === "seleccionar" && modo === "arquitectura" ? "auto" : "none";
  const tocableDeEstructura =
    herramienta === "seleccionar" && modo === "estructura" ? "auto" : "none";

  const columnaElegida =
    seleccion?.tipo === "columna"
      ? estructura.columnas.find((c) => c.id === seleccion.id) ?? null
      : null;
  const vigaElegida =
    seleccion?.tipo === "viga" ? estructura.vigas.find((v) => v.id === seleccion.id) ?? null : null;
  const losaElegida =
    seleccion?.tipo === "losa" ? estructura.losas.find((l) => l.id === seleccion.id) ?? null : null;
  // A qué alturas va la losa de la planta, desde su piso terminado, para
  // mostrarlo: con el espesor de la primera que haya, o el que se va a usar.
  const espesorDeReferencia = estructura.losas[0]?.espesor ?? moldeDeLosa.espesor;
  const nivelesDeLaLosa = nivelesDeLosa(
    espesorDeReferencia,
    estructura.bajoNpt,
    alturaDePlanta,
    pisoAPiso
  );
  const medidaDeLaColumna = columnaElegida
    ? hormigon?.columnas.find((c) => c.id === columnaElegida.id) ?? null
    : null;
  // El contorno que se está editando: el de un ambiente o el de una losa. Se
  // corrigen igual —se arrastra un punto, se corre un lado, doble clic suma o
  // saca un punto—, así que comparten los mismos agarres.
  /** Si Propiedades no tiene nada que mostrar: ni algo elegido ni una
   *  herramienta con opciones. */
  const sinPropiedades =
    seleccion === null &&
    (herramienta === "seleccionar" || herramienta === "mover" || herramienta === "ambiente");
  const contorno = ambienteElegido
    ? { de: "ambiente" as const, id: ambienteElegido.id, puntos: ambienteElegido.puntos }
    : losaElegida
      ? { de: "losa" as const, id: losaElegida.id, puntos: losaElegida.puntos }
      : null;

  // Lo que saldría si se hiciera clic ahora: la columna en el punto marcado, o
  // la viga con su ancho hacia el lado que le toca.
  const columnaFantasma =
    herramienta === "columna" && cursor && mpp !== null
      ? huellaDeColumna(
          { ...moldeDeColumna, id: "", nombre: "", p: cursor.punto, desde: null, arriba: null },
          mpp
        )
      : null;
  // Las de hormigón y las metálicas se miden distinto —m³ unas, metros las
  // otras— y van en apartados separados de Medidas.
  const columnasDeHormigon = hormigon?.columnas.filter((c) => c.material === "hormigon") ?? [];
  const columnasMetalicas = hormigon?.columnas.filter((c) => c.material === "metalica") ?? [];
  const vigasDeHormigon = hormigon?.vigas.filter((v) => v.material === "hormigon") ?? [];
  const vigasMetalicas = hormigon?.vigas.filter((v) => v.material === "metalica") ?? [];

  // La regla se ve sólo con su herramienta: el resto del tiempo es una línea
  // más encima del plano, y tapa la cota del muro que tenga debajo.
  const regla =
    herramienta !== "escala" ? null : reglaMarcada ?? (enCurso.length > 0 ? null : escala);
  const previo = enCurso[enCurso.length - 1];

  // El cuerpo del muro que saldría si se hiciera clic ahora: con una cara de
  // referencia hay que ver para qué lado crece antes de soltar el punto.
  const cuerpoEnCurso =
    herramienta === "muro" && previo && cursor && !mismoPunto(previo, cursor.punto)
      ? cuerpoDeMuro(
          { id: "", a: previo, b: cursor.punto, espesor, referencia, altura: null, tarea: null },
          [],
          mpp,
          u
        )
      : null;
  const vigaEnCurso =
    herramienta === "viga" && previo && cursor && mpp !== null && !mismoPunto(previo, cursor.punto)
      ? huellaDeViga(
          { ...moldeDeViga, id: "", nombre: "", a: previo, b: cursor.punto, nivel: null },
          mpp
        )
      : null;

  // Las caras del muro elegido, una por clave: dos tramos que dan al mismo
  // lado sin ambiente comparten terminación y van en un solo renglón.
  const carasDelMuro =
    muroElegido && terminaciones
      ? juntarCaras(terminaciones.caras.filter((c) => c.muroId === muroElegido.id))
      : [];
  const caraAbierta = carasDelMuro.find((c) => c.clave === caraElegida) ?? null;
  const nombreDeAmbiente = (id: string | null) =>
    id === null
      ? "Sin ambiente"
      : dibujo.ambientes.find((a) => a.id === id)?.nombre || "Ambiente sin nombre";

  // Las caras de muro que dan al ambiente elegido, y cuáles llevan capas
  // propias —puestas desde el muro— en vez de las del ambiente. Se muestran
  // en su ficha: si no, "Paredes" aparece vacío con el baño entero revestido
  // y parece que no se cargó nada.
  const carasDelAmbiente =
    ambienteElegido && terminaciones
      ? juntarCaras(terminaciones.caras.filter((c) => c.ambienteId === ambienteElegido.id))
      : [];
  const carasConLasSuyas = carasDelAmbiente.filter((c) => c.propias);
  /** Si todas las que tienen las suyas tienen las mismas: se pueden pasar al
   *  ambiente sin perder nada. */
  const todasLasMismas =
    carasConLasSuyas.length > 0 &&
    carasConLasSuyas.every(
      (c) => firmaDeCapas(c.capas) === firmaDeCapas(carasConLasSuyas[0].capas)
    );

  /**
   * Pasa al ambiente las capas que sus caras llevan como propias, o se las
   * saca para que lleven las del ambiente. En los dos casos las caras dejan de
   * tener las suyas y la terminación queda en un solo lugar, la ficha del
   * ambiente, que es donde se le ajusta la altura a cada capa una sola vez.
   */
  const unificarParedes = (pasarAlAmbiente: boolean) => {
    if (!ambienteElegido || carasConLasSuyas.length === 0) return;
    const claves = new Set(carasConLasSuyas.map((c) => c.clave));
    const capas = carasConLasSuyas[0].capas.map(soloLaCapa);
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        ambientes: pasarAlAmbiente
          ? dibujo.ambientes.map((a) => (a.id === ambienteElegido.id ? { ...a, capas } : a))
          : dibujo.ambientes,
        caras: sinLasCaras((clave) => claves.has(clave)),
      },
    });
  };

  /** Los otros muros de su espesor que todavía no tienen tipo. */
  const sinTipoDelMismoEspesor = muroElegido
    ? dibujo.muros.filter(
        (m) => m.id !== muroElegido.id && m.tarea === null && m.espesor === muroElegido.espesor
      )
    : [];

  /** Si alguna punta del muro elegido es también la punta de otro. */
  const muroUnido =
    muroElegido !== null &&
    dibujo.muros.some(
      (otro) =>
        otro.id !== muroElegido.id &&
        [otro.a, otro.b].some(
          (p) => mismoPunto(p, muroElegido.a) || mismoPunto(p, muroElegido.b)
        )
    );

  const ambienteEscuadrado = ambienteElegido ? escuadrar(ambienteElegido.puntos) : null;
  /** Si escuadrarlo cambiaría algo: si no, el botón no tiene qué hacer. */
  const ambienteTorcido =
    ambienteElegido !== null &&
    ambienteEscuadrado !== null &&
    ambienteEscuadrado.some((p, i) => !mismoPunto(p, ambienteElegido.puntos[i]));

  return (
    <div style={marco}>
      {/* Arriba, lo que es de la planta entera: adónde se vuelve, qué se
          dibuja —arquitectura o estructura— y guardar. */}
      <div style={barra}>
        <div style={ladoDeBarra}>
          <Link href={`/obras/${slug}/plantas`} style={volverEnBarra}>
            ← Plantas
          </Link>
          {/* Sin escala no hay estructura: una sección en metros no tiene
              tamaño en el plano. */}
          <div style={selectorDeModo}>
            {MODOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => elegirModo(m.valor)}
                disabled={m.valor === "estructura" && mpp === null}
                title={
                  m.valor === "estructura" && mpp === null ? "Marcá la escala primero" : undefined
                }
                style={modo === m.valor ? botonDeModoActivo : botonDeModo}
              >
                {m.nombre}
              </button>
            ))}
          </div>
          {/* A qué nivel del edificio está la planta. Va acá, al lado del
              modo, porque es lo que ubica todo lo que se dibuja, y abre la
              definición de pisos de la obra. Sin definir se ve en el color de
              lo que falta: sin niveles no se puede armar el 3D. */}
          <button
            type="button"
            onClick={() => setDefiniendoPisos(true)}
            title="Definición de pisos: el nivel de cada piso de la obra"
            style={pisosDeLaPlanta.length === 0 ? botonDeNivelesPendiente : botonDeNiveles}
          >
            {pisosDeLaPlanta.length === 0
              ? "NPT sin definir"
              : `NPT ${formatNiveles(pisosDeLaPlanta.map((p) => p.cota))}${
                  pisosDeLaPlanta.length > 1 ? ` · ${pisosDeLaPlanta.length} pisos` : ""
                }`}
          </button>
          <span style={nombreEnBarra}>{nombre || "Planta sin nombre"}</span>
        </div>

        <div style={ladoDeBarra}>
          <button
            type="button"
            onClick={deshacer}
            disabled={pasado.length === 0 && enCurso.length === 0}
            title="Deshacer (Ctrl+Z)"
            aria-label="Deshacer"
            style={
              pasado.length === 0 && enCurso.length === 0 ? botonDeBarraQuieto : botonDeBarra
            }
          >
            <IconoHerramienta nombre="deshacer" size={18} />
          </button>
          <button
            type="button"
            onClick={() => setVista(null)}
            title="Encuadrar el plano"
            aria-label="Encuadrar el plano"
            style={botonDeBarra}
          >
            <IconoHerramienta nombre="encuadrar" size={18} />
          </button>
          <button
            type="button"
            onClick={guardarTodo}
            disabled={guardando || !sucio}
            style={guardando || !sucio ? botonGuardarQuieto : botonGuardar}
          >
            {guardando ? "Guardando..." : sucio ? "Guardar" : "Guardado"}
          </button>
        </div>
      </div>

      {error && <p style={errorBox}>{error}</p>}

      <div style={cuerpo}>
        {/* A la izquierda, las herramientas del modo en que se está. Sólo el
            ícono: el nombre sale al apoyar el puntero, y qué hace cada una lo
            dice la pista de abajo del plano. */}
        <div style={herramientas} role="toolbar" aria-label="Herramientas">
          {HERRAMIENTAS[modo].map((h) => (
            <button
              key={h.valor}
              type="button"
              title={h.nombre}
              aria-label={h.nombre}
              aria-pressed={herramienta === h.valor}
              onClick={() => elegirHerramienta(h.valor)}
              style={herramienta === h.valor ? botonDeIconoActivo : botonDeIcono}
            >
              <IconoHerramienta nombre={h.valor} />
            </button>
          ))}
        </div>

        <div
          ref={lienzo}
          tabIndex={0}
          style={{
            ...cajaLienzo,
            cursor:
              herramienta === "mover"
                ? "grab"
                : marcando || herramienta === "abertura"
                  ? "crosshair"
                  : "default",
          }}
        >
          <svg
            ref={svg}
            width="100%"
            height="100%"
            viewBox={
              tamano
                ? `${v.x} ${v.y} ${tamano.w / v.k} ${tamano.h / v.k}`
                : `0 0 ${imagen.ancho} ${imagen.alto}`
            }
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerLeave={() => {
              setCursor(null);
              setFantasma(null);
              setGuias([]);
            }}
            onDoubleClick={() => {
              if (herramienta === "ambiente") cerrarAmbiente(enCurso);
              else if (herramienta === "losa") cerrarLosa(enCurso);
              else if (herramienta === "muro" || herramienta === "viga") setEnCurso([]);
            }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ display: "block", touchAction: "none", userSelect: "none" }}
          >
            <image
              href={imagen.url}
              width={imagen.ancho}
              height={imagen.alto}
              preserveAspectRatio="none"
              style={{ pointerEvents: "none" }}
            />

            {/* La arquitectura. En el modo de estructura queda de fondo: se ve,
                porque la estructura se dibuja mirándola, pero no se toca. */}
            <g opacity={modo === "estructura" ? 0.4 : 1}>
              {dibujo.ambientes.map((a, i) => {
                const elegido = ambienteElegido?.id === a.id;
                const color = COLORES[i % COLORES.length];
                const centro = centroDe(a.puntos);
                return (
                  <g key={a.id}>
                    <polygon
                      points={a.puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill={color}
                      fillOpacity={elegido ? 0.38 : 0.2}
                      stroke={color}
                      strokeWidth={(elegido ? 2.5 : 1.2) * u}
                      style={{ pointerEvents: herramienta === "copiar" ? "auto" : tocable }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        lienzo.current?.focus({ preventScroll: true });
                        if (herramienta === "copiar") tocarAmbienteParaCopiar(a);
                        else elegir({ tipo: "ambiente", id: a.id });
                      }}
                    />
                    <text
                      x={centro.x}
                      y={centro.y}
                      textAnchor="middle"
                      fontSize={12 * u}
                      fontWeight={600}
                      fill="#111111"
                      stroke="#ffffff"
                      strokeWidth={3 * u}
                      paintOrder="stroke"
                      style={{ pointerEvents: "none" }}
                    >
                      {a.nombre || "Sin nombre"}
                      {mpp !== null && (
                        <tspan x={centro.x} dy={14 * u} fontWeight={400}>
                          {formatM2(areaDe(a.puntos) * mpp * mpp)}
                        </tspan>
                      )}
                    </text>
                  </g>
                );
              })}

              {dibujo.muros.map((m) => {
                const cuerpo = cuerpos.get(m.id);
                if (!cuerpo) return null;
                const elegido = muroElegido?.id === m.id;
                const grosor = cuerpo.grosor;
                const largoEnPantalla = distancia(m.a, m.b) * v.k;
                return (
                  <g key={m.id}>
                    {/* Sin remate en las puntas: el cuerpo ya viene estirado lo
                        justo en cada esquina (`cuerpoDeMuro`). */}
                    <line
                      x1={cuerpo.a.x}
                      y1={cuerpo.a.y}
                      x2={cuerpo.b.x}
                      y2={cuerpo.b.y}
                      stroke={elegido ? ACENTO : encimados.has(m.id) ? ui.ROJO : "#111111"}
                      strokeOpacity={elegido ? 0.9 : 0.7}
                      strokeWidth={grosor}
                      strokeLinecap="butt"
                      style={{ pointerEvents: "none" }}
                    />
                    {/* La línea que se marcó, cuando no es el eje: es la que
                        mide y la que tiene los puntos para mover. */}
                    {elegido && m.referencia !== "centro" && (
                      <line
                        x1={m.a.x}
                        y1={m.a.y}
                        x2={m.b.x}
                        y2={m.b.y}
                        stroke="#ffffff"
                        strokeWidth={1.5 * u}
                        strokeDasharray={`${5 * u} ${3 * u}`}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                    {/* Lo que se toca: más ancho que el trazo, para que un muro
                        fino no pida puntería. */}
                    <line
                      x1={cuerpo.a.x}
                      y1={cuerpo.a.y}
                      x2={cuerpo.b.x}
                      y2={cuerpo.b.y}
                      stroke="transparent"
                      strokeWidth={Math.max(grosor, 14 * u)}
                      style={{
                        pointerEvents:
                          tocable === "auto" || herramienta === "copiar" ? "stroke" : "none",
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        lienzo.current?.focus({ preventScroll: true });
                        if (herramienta === "copiar") {
                          tocarMuroParaCopiar(m);
                          return;
                        }
                        elegir({ tipo: "muro", id: m.id });
                        // Doble clic: el muro se parte ahí.
                        if (esDobleToque(`muro-${m.id}`, e.timeStamp)) partirMuro(m, aPlano(e));
                      }}
                    />
                    {mpp !== null && (elegido || largoEnPantalla > 70) && (
                      <Cota a={cuerpo.ejeA} b={cuerpo.ejeB} u={u} separacion={grosor / 2 + 9 * u}>
                        {formatMetros(distancia(m.a, m.b) * mpp)}
                      </Cota>
                    )}
                  </g>
                );
              })}

              {dibujo.aberturas.map((ab) => {
                const muro = murosPorSuCuerpo.find((m) => m.id === ab.muroId);
                if (!muro) return null;
                const forma = formaDeAbertura(muro, ab.t, ab.ancho, mpp, u);
                const elegida = aberturaElegida?.id === ab.id;
                const color = COLOR_ABERTURA[ab.tipo];
                return (
                  <g key={ab.id}>
                    {/* Blanca encima del muro: un vano es un hueco en la pared. */}
                    <polygon
                      points={forma.puntos}
                      fill="#ffffff"
                      stroke={elegida ? ACENTO : color}
                      strokeWidth={(elegida ? 2.5 : 1.5) * u}
                      style={{
                        pointerEvents: tocable,
                        cursor: herramienta === "seleccionar" ? "move" : undefined,
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        lienzo.current?.focus({ preventScroll: true });
                        elegir({ tipo: "abertura", id: ab.id });
                        agarrar(e, { tipo: "abertura", id: ab.id });
                      }}
                    />
                    {ab.tipo === "puerta" && (
                      <path
                        d={barridoDePuerta(forma, ab.mano ?? "derecha", ab.lado)}
                        fill="none"
                        stroke={elegida ? ACENTO : color}
                        strokeWidth={1.2 * u}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                    {/* Del lado contrario a la cota del muro, para no pisarla. */}
                    <Cota
                      a={forma.a}
                      b={forma.b}
                      u={u}
                      separacion={forma.medioGrosor + 5 * u}
                      color={color}
                      lado={-1}
                    >
                      {ab.nombre || NOMBRE_TIPO[ab.tipo]}
                    </Cota>
                  </g>
                );
              })}
            </g>

            {/* La estructura. En el modo de arquitectura se ve atenuada, sin
                nombres, y no se toca. Las losas van abajo, las vigas encima y
                las columnas arriba de todo: es el orden en que se tapan. */}
            {mpp !== null && hayEstructura && (
              <g opacity={modo === "estructura" ? 1 : 0.4}>
                {estructura.losas.map((l) => {
                  const elegida = losaElegida?.id === l.id;
                  const centro = centroDe(l.puntos);
                  return (
                    <g key={l.id}>
                      <polygon
                        points={enPuntos(l.puntos)}
                        fill={HORMIGON}
                        fillOpacity={elegida ? 0.28 : 0.12}
                        stroke={elegida ? ACENTO : HORMIGON}
                        strokeWidth={(elegida ? 2.5 : 1.5) * u}
                        strokeDasharray={`${8 * u} ${4 * u}`}
                        style={{ pointerEvents: tocableDeEstructura }}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          lienzo.current?.focus({ preventScroll: true });
                          elegir({ tipo: "losa", id: l.id });
                        }}
                      />
                      {modo === "estructura" && (
                        // Más abajo que el centro: ahí va el nombre del
                        // ambiente que casi siempre tiene debajo.
                        <text
                          x={centro.x}
                          y={centro.y + 34 * u}
                          textAnchor="middle"
                          fontSize={12 * u}
                          fontWeight={600}
                          fill={HORMIGON}
                          stroke="#ffffff"
                          strokeWidth={3 * u}
                          paintOrder="stroke"
                          style={{ pointerEvents: "none" }}
                        >
                          {l.nombre || "Losa"}
                          <tspan x={centro.x} dy={14 * u} fontWeight={400}>
                            e {formatEspesor(l.espesor)} · {formatM2(areaDe(l.puntos) * mpp * mpp)}
                          </tspan>
                        </text>
                      )}
                    </g>
                  );
                })}

                {estructura.vigas.map((v) => {
                  const huella = huellas.get(v.id);
                  if (!huella || huella.length < 4) return null;
                  const elegida = vigaElegida?.id === v.id;
                  // El eje del cuerpo, que no es la línea marcada cuando la
                  // referencia es una cara.
                  const ejeA = medio(huella[0], huella[3]);
                  const ejeB = medio(huella[1], huella[2]);
                  const ancho = v.ancho / mpp;
                  // Como las columnas: la de hormigón llena; la metálica,
                  // hueca y con su eje, que es el alma del perfil.
                  const metalica = v.material === "metalica";
                  const color = elegida ? ACENTO : metalica ? ACERO : HORMIGON;
                  return (
                    <g key={v.id}>
                      <polygon
                        points={enPuntos(huella)}
                        fill={metalica ? "#ffffff" : color}
                        fillOpacity={metalica ? 0.9 : 0.55}
                        stroke={color}
                        strokeWidth={(metalica ? 1.6 : 1.2) * u}
                        style={{ pointerEvents: "none" }}
                      />
                      {metalica && (
                        <line
                          x1={ejeA.x}
                          y1={ejeA.y}
                          x2={ejeB.x}
                          y2={ejeB.y}
                          stroke={color}
                          strokeWidth={u}
                          strokeDasharray={`${6 * u} ${3 * u}`}
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                      {/* Lo que se toca: más ancho que la viga, que en el
                          plano son unos pocos píxeles. */}
                      <line
                        x1={ejeA.x}
                        y1={ejeA.y}
                        x2={ejeB.x}
                        y2={ejeB.y}
                        stroke="transparent"
                        strokeWidth={Math.max(ancho, 14 * u)}
                        style={{
                          pointerEvents: tocableDeEstructura === "auto" ? "stroke" : "none",
                        }}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          lienzo.current?.focus({ preventScroll: true });
                          elegir({ tipo: "viga", id: v.id });
                        }}
                      />
                      {modo === "estructura" && (
                        <Cota
                          a={ejeA}
                          b={ejeB}
                          u={u}
                          separacion={ancho / 2 + 5 * u}
                          color={metalica ? ACERO : HORMIGON}
                          lado={-1}
                        >
                          {v.nombre} {nombreDeSeccion(v)}
                        </Cota>
                      )}
                    </g>
                  );
                })}

                {estructura.columnas.map((c) => {
                  const huella = huellas.get(c.id);
                  if (!huella || huella.length < 4) return null;
                  const elegida = columnaElegida?.id === c.id;
                  // La de hormigón va llena; la metálica, hueca y con sus
                  // dos diagonales, que es como se marca un perfil en planta.
                  const metalica = c.material === "metalica";
                  const color = elegida ? ACENTO : metalica ? ACERO : HORMIGON;
                  return (
                    <g key={c.id}>
                      <polygon
                        points={enPuntos(huella)}
                        fill={metalica ? "#ffffff" : color}
                        fillOpacity={0.9}
                        stroke={metalica ? color : "#ffffff"}
                        strokeWidth={(metalica ? 2 : 1) * u}
                        style={{
                          pointerEvents: tocableDeEstructura,
                          cursor: tocableDeEstructura === "auto" ? "move" : undefined,
                        }}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          lienzo.current?.focus({ preventScroll: true });
                          elegir({ tipo: "columna", id: c.id });
                          const p = aPlano(e);
                          agarrar(e, {
                            tipo: "columna",
                            id: c.id,
                            corrida: { x: p.x - c.p.x, y: p.y - c.p.y },
                          });
                        }}
                      />
                      {metalica && (
                        <path
                          d={`M${huella[0].x} ${huella[0].y}L${huella[2].x} ${huella[2].y}M${huella[1].x} ${huella[1].y}L${huella[3].x} ${huella[3].y}`}
                          stroke={color}
                          strokeWidth={1.2 * u}
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                      {modo === "estructura" && (
                        // Arriba de todo lo que ocupa, que girada no es su
                        // primer lado.
                        <text
                          x={(huella[0].x + huella[2].x) / 2}
                          y={Math.min(...huella.map((p) => p.y)) - 5 * u}
                          textAnchor="middle"
                          fontSize={11 * u}
                          fontWeight={600}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={3 * u}
                          paintOrder="stroke"
                          style={{ pointerEvents: "none" }}
                        >
                          {c.nombre}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {columnaFantasma && (
              <polygon
                points={enPuntos(columnaFantasma)}
                fill={moldeDeColumna.material === "metalica" ? "#ffffff" : HORMIGON}
                fillOpacity={moldeDeColumna.material === "metalica" ? 0.7 : 0.3}
                stroke={moldeDeColumna.material === "metalica" ? ACERO : HORMIGON}
                strokeWidth={1.5 * u}
                strokeDasharray={`${4 * u} ${3 * u}`}
                style={{ pointerEvents: "none" }}
              />
            )}

            {fantasma && formaDelFantasma && (
              <g style={{ pointerEvents: "none" }}>
                <polygon
                  points={formaDelFantasma.puntos}
                  fill="#ffffff"
                  fillOpacity={0.7}
                  stroke={COLOR_ABERTURA[tipoAbertura]}
                  strokeWidth={1.5 * u}
                  strokeDasharray={`${4 * u} ${3 * u}`}
                />
                {tipoAbertura === "puerta" && (
                  <path
                    d={barridoDePuerta(formaDelFantasma, molde.mano, fantasma.lado)}
                    fill="none"
                    stroke={COLOR_ABERTURA.puerta}
                    strokeWidth={1.2 * u}
                    strokeDasharray={`${4 * u} ${3 * u}`}
                  />
                )}
              </g>
            )}

            {medicion && (
              <g style={{ pointerEvents: "none" }}>
                <line
                  x1={medicion.a.x}
                  y1={medicion.a.y}
                  x2={medicion.b.x}
                  y2={medicion.b.y}
                  stroke={VIOLETA}
                  strokeWidth={2 * u}
                />
                <circle cx={medicion.a.x} cy={medicion.a.y} r={3.5 * u} fill={VIOLETA} />
                <circle cx={medicion.b.x} cy={medicion.b.y} r={3.5 * u} fill={VIOLETA} />
                {mpp !== null && (
                  <Cota a={medicion.a} b={medicion.b} u={u} separacion={12 * u} color={VIOLETA}>
                    {formatMetros(distancia(medicion.a, medicion.b) * mpp)}
                  </Cota>
                )}
              </g>
            )}

            {regla && (
              <g style={{ pointerEvents: "none" }}>
                <line
                  x1={regla.a.x}
                  y1={regla.a.y}
                  x2={regla.b.x}
                  y2={regla.b.y}
                  stroke={AZUL}
                  strokeWidth={2 * u}
                />
                <circle cx={regla.a.x} cy={regla.a.y} r={4 * u} fill={AZUL} />
                <circle cx={regla.b.x} cy={regla.b.y} r={4 * u} fill={AZUL} />
                <Cota a={regla.a} b={regla.b} u={u} separacion={12 * u} color={AZUL}>
                  {reglaMarcada || !escala
                    ? "¿Cuánto mide?"
                    : `Escala: ${formatMetros(escala.metros)}`}
                </Cota>
              </g>
            )}

            {/* Lo que se está dibujando: los tramos ya puestos y el que sigue
                al cursor. */}
            {dibujando && enCurso.length > 0 && (
              <g style={{ pointerEvents: "none" }}>
                {enCurso.length > 1 && (
                  <polyline
                    points={enCurso.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={ACENTO}
                    strokeWidth={2 * u}
                  />
                )}
                {vigaEnCurso && (
                  <polygon
                    points={enPuntos(vigaEnCurso)}
                    fill={HORMIGON}
                    fillOpacity={0.3}
                  />
                )}
                {cuerpoEnCurso && (
                  <line
                    x1={cuerpoEnCurso.a.x}
                    y1={cuerpoEnCurso.a.y}
                    x2={cuerpoEnCurso.b.x}
                    y2={cuerpoEnCurso.b.y}
                    stroke="#111111"
                    strokeOpacity={0.28}
                    strokeWidth={cuerpoEnCurso.grosor}
                    strokeLinecap="butt"
                  />
                )}
                {previo && cursor && (
                  <>
                    <line
                      x1={previo.x}
                      y1={previo.y}
                      x2={cursor.punto.x}
                      y2={cursor.punto.y}
                      stroke={
                        herramienta === "escala"
                          ? AZUL
                          : herramienta === "medir"
                            ? VIOLETA
                            : ACENTO
                      }
                      strokeWidth={2 * u}
                      strokeDasharray={`${6 * u} ${4 * u}`}
                    />
                    {mpp !== null && herramienta !== "escala" && (
                      <Cota a={previo} b={cursor.punto} u={u} separacion={12 * u} color={ACENTO}>
                        {formatMetros(distancia(previo, cursor.punto) * mpp)}
                      </Cota>
                    )}
                  </>
                )}
                {enCurso.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3.5 * u} fill={ACENTO} />
                ))}
              </g>
            )}

            {/* Las caras con terminación, cada una del color de su última
                capa —la que queda a la vista—, y todas las del muro elegido,
                que además se dejan tocar para elegir cuál se termina. */}
            {terminaciones?.caras.map((cara, i) => {
              const delMuroElegido = muroElegido?.id === cara.muroId;
              // Con Copiar se ven todas: las que no tienen nada son justo
              // las que hay que poder tocar.
              if (cara.capas.length === 0 && !delMuroElegido && herramienta !== "copiar") {
                return null;
              }

              const largo = cara.largo || 1;
              // Hacia afuera del muro, para que la línea no pise el cuerpo.
              const nx = (-(cara.b.y - cara.a.y) / largo) * cara.lado;
              const ny = ((cara.b.x - cara.a.x) / largo) * cara.lado;
              const elegida = delMuroElegido && cara.clave === caraElegida;
              const color =
                cara.capas.length > 0
                  ? colorDeCapa(cara.capas[cara.capas.length - 1].tarea)
                  : "#9ca3af";
              const corrida = (desde: Punto, hasta: Punto, cuanto: number) => ({
                x1: desde.x + nx * cuanto,
                y1: desde.y + ny * cuanto,
                x2: hasta.x + nx * cuanto,
                y2: hasta.y + ny * cuanto,
              });

              return (
                <g key={i}>
                  {/* La línea va donde hay pared a la altura del piso: entera
                      en los paños, más fina bajo una ventana —ahí está el
                      antepecho— y cortada en una puerta. */}
                  {cara.partes
                    .filter((parte) => parte.tipo !== "dintel")
                    .map((parte, k) => (
                      <line
                        key={k}
                        {...corrida(parte.a, parte.b, 3 * u)}
                        stroke={color}
                        strokeWidth={(elegida ? 6 : 3) * (parte.tipo === "pano" ? 1 : 0.5) * u}
                        strokeDasharray={
                          cara.capas.length === 0 ? `${4 * u} ${3 * u}` : undefined
                        }
                        style={{ pointerEvents: "none" }}
                      />
                    ))}
                  {delMuroElegido && herramienta === "seleccionar" && (
                    <line
                      {...corrida(cara.a, cara.b, 7 * u)}
                      stroke="transparent"
                      strokeWidth={12 * u}
                      style={{ cursor: "pointer", pointerEvents: "stroke" }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        setCaraElegida(cara.clave);
                      }}
                    />
                  )}
                  {herramienta === "copiar" && (
                    <line
                      {...corrida(cara.a, cara.b, 7 * u)}
                      stroke="transparent"
                      strokeWidth={14 * u}
                      style={{ cursor: "copy", pointerEvents: "stroke" }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        tocarCaraParaCopiar(cara);
                      }}
                    />
                  )}
                </g>
              );
            })}

            {/* Los vértices de lo seleccionado, para arrastrarlos. */}
            {herramienta === "seleccionar" && muroElegido && (
              <>
                {[muroElegido.a, muroElegido.b].map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={6 * u}
                    fill="#ffffff"
                    stroke={ACENTO}
                    strokeWidth={2 * u}
                    style={{ cursor: "move" }}
                    onPointerDown={(e) =>
                      agarrar(e, {
                        tipo: "muro",
                        id: muroElegido.id,
                        punta: i === 0 ? "a" : "b",
                        desde: p,
                        eje: ejeDesde(i === 0 ? muroElegido.b : muroElegido.a, p),
                      })
                    }
                  />
                ))}
              </>
            )}
            {/* Las esquinas de la abertura elegida. Agarrada del medio se
                desliza libre; agarrada de una esquina, esa esquina se pega a
                lo que tenga cerca: la cara de otro muro, un rincón, la jamba
                de otra abertura. */}
            {herramienta === "seleccionar" &&
              aberturaElegida &&
              formaDeLaElegida &&
              ESQUINAS_DE_ABERTURA.map(([alLargo, alAncho]) => {
                const p = formaDeLaElegida.en(
                  alLargo * formaDeLaElegida.medio,
                  (alAncho * grosorDeLaElegida) / 2
                );
                return (
                  <circle
                    key={`${alLargo}${alAncho}`}
                    cx={p.x}
                    cy={p.y}
                    r={5 * u}
                    fill="#ffffff"
                    stroke={ACENTO}
                    strokeWidth={2 * u}
                    style={{ cursor: "move" }}
                    onPointerDown={(e) =>
                      agarrar(e, { tipo: "esquina", id: aberturaElegida.id, alLargo })
                    }
                  />
                );
              })}

            {/* Los lados del ambiente elegido: se corren enteros, en
                paralelo. Van debajo de los puntos, que en las esquinas mandan. */}
            {herramienta === "seleccionar" &&
              contorno?.puntos.map((p, i) => {
                const q = contorno.puntos[(i + 1) % contorno.puntos.length];
                return (
                  <line
                    key={`lado-${i}`}
                    x1={p.x}
                    y1={p.y}
                    x2={q.x}
                    y2={q.y}
                    stroke="transparent"
                    strokeWidth={12 * u}
                    style={{ cursor: "move", pointerEvents: "stroke" }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      // Doble clic: un punto nuevo ahí. Un clic solo agarra
                      // el lado para correrlo.
                      if (esDobleToque(`lado-${contorno.id}-${i}`, e.timeStamp)) {
                        e.stopPropagation();
                        agregarPunto(contorno, i, aPlano(e), contorno.de);
                        return;
                      }
                      agarrar(e, {
                        tipo: "lado",
                        de: contorno.de,
                        id: contorno.id,
                        indice: i,
                        inicio: aPlano(e),
                        puntos: contorno.puntos,
                      });
                    }}
                  />
                );
              })}
            {herramienta === "seleccionar" &&
              contorno?.puntos.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={6 * u}
                  fill="#ffffff"
                  stroke={ACENTO}
                  strokeWidth={2 * u}
                  style={{ cursor: "move" }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    // Doble clic sobre un punto lo saca.
                    if (esDobleToque(`punto-${contorno.id}-${i}`, e.timeStamp)) {
                      e.stopPropagation();
                      quitarPunto(contorno, i, contorno.de);
                      return;
                    }
                    agarrar(e, { tipo: contorno.de, id: contorno.id, indice: i });
                  }}
                />
              ))}

            {/* Las dos puntas de la viga elegida, y de dónde se agarra la
                columna elegida: es el punto que se pega al moverla. */}
            {herramienta === "seleccionar" && vigaElegida && (
              <>
                {[vigaElegida.a, vigaElegida.b].map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={6 * u}
                    fill="#ffffff"
                    stroke={ACENTO}
                    strokeWidth={2 * u}
                    style={{ cursor: "move" }}
                    onPointerDown={(e) =>
                      agarrar(e, {
                        tipo: "viga",
                        id: vigaElegida.id,
                        punta: i === 0 ? "a" : "b",
                        eje: ejeDesde(i === 0 ? vigaElegida.b : vigaElegida.a, p),
                      })
                    }
                  />
                ))}
              </>
            )}
            {herramienta === "seleccionar" && columnaElegida && (
              <circle
                cx={columnaElegida.p.x}
                cy={columnaElegida.p.y}
                r={3.5 * u}
                fill="#ffffff"
                stroke={ACENTO}
                strokeWidth={1.5 * u}
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* Las guías: contra qué esquina quedó alineado lo que se
                marca o se mueve. */}
            {guias.map((g, i) => (
              <g key={i} style={{ pointerEvents: "none" }}>
                <line
                  x1={g.desde.x}
                  y1={g.desde.y}
                  x2={g.hasta.x}
                  y2={g.hasta.y}
                  stroke={CELESTE}
                  strokeWidth={1.2 * u}
                  strokeDasharray={`${6 * u} ${4 * u}`}
                />
                <circle cx={g.desde.x} cy={g.desde.y} r={3 * u} fill={CELESTE} />
              </g>
            ))}

            {/* Dónde va a caer el próximo punto. Lleno cuando se pegó a algo:
                es la diferencia entre una esquina cerrada y una que casi. */}
            {marcando && cursor && (
              <circle
                cx={cursor.punto.x}
                cy={cursor.punto.y}
                r={5 * u}
                fill={cursor.iman ? ACENTO : "none"}
                stroke={ACENTO}
                strokeWidth={1.5 * u}
                style={{ pointerEvents: "none" }}
              />
            )}
          </svg>

          {/* Las ayudas para marcar, encima del plano: son del trazo, no de
              lo que se selecciona. */}
          {(marcando || herramienta === "seleccionar") && (
            <div style={ayudas}>
              {dibujando && (
                <label style={ayuda}>
                  <input
                    type="checkbox"
                    checked={ortogonal}
                    onChange={(e) => setOrtogonal(e.target.checked)}
                  />
                  A escuadra
                </label>
              )}
              <label style={ayuda} title="Alinear con otras esquinas">
                <input
                  type="checkbox"
                  checked={conGuias}
                  onChange={(e) => setConGuias(e.target.checked)}
                />
                Guías
              </label>
            </div>
          )}

          <p style={pista}>
            {pistaDe(herramienta, modo, enCurso.length, reglaMarcada !== null, copiado !== null)}
          </p>
        </div>

        <aside style={panel}>
          <div style={solapas} role="tablist">
            {SOLAPAS.map((s) => (
              <button
                key={s.valor}
                type="button"
                role="tab"
                aria-selected={solapa === s.valor}
                onClick={() => setSolapa(s.valor)}
                style={solapa === s.valor ? solapaActiva : solapaQuieta}
              >
                {s.nombre}
              </button>
            ))}
          </div>

          {/* Lo que se elige o se está por dibujar: es lo que más se mira, y
              por eso es la solapa que se abre sola al tocar algo. */}
          <div style={solapa === "propiedades" ? contenidoDeSolapa : oculto}>
            {sinPropiedades && (
              <p style={nota}>
                Nada seleccionado. Tocá algo del plano para ver sus datos, o elegí una herramienta
                para dibujar.
              </p>
            )}

            {herramienta === "escala" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Escala</h3>
                {reglaMarcada ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      aplicarEscala();
                    }}
                    style={campo}
                  >
                    <span style={rotulo}>Metros entre los dos puntos</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      autoFocus
                      value={metrosDeRegla}
                      onChange={(e) => setMetrosDeRegla(e.target.value)}
                      style={ui.input}
                    />
                    <button
                      type="submit"
                      disabled={!(Number(metrosDeRegla.replace(",", ".")) > 0)}
                      style={ui.button}
                    >
                      Aplicar escala
                    </button>
                  </form>
                ) : (
                  <p style={nota}>
                    {escala
                      ? `Marcada sobre ${formatMetros(escala.metros)}. Marcar dos puntos de nuevo la reemplaza y rehace todas las medidas.`
                      : "Sin escala todavía: se puede dibujar, pero nada mide."}
                  </p>
                )}
              </section>
            )}

            {herramienta === "copiar" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Copiar</h3>
                {copiado?.de === "muro" ? (
                  <>
                    <p style={nota}>Tomado de un muro. Tocá los muros que son de lo mismo.</p>
                    <Renglon nombre="Tipo de muro">
                      {copiado.tarea === null
                        ? "sin tipo"
                        : tipoPorId.get(copiado.tarea)?.nombre ?? "Tarea eliminada"}
                    </Renglon>
                    <button type="button" onClick={() => setCopiado(null)} style={botonChico}>
                      Tomar otro
                    </button>
                  </>
                ) : copiado ? (
                  <>
                    <p style={nota}>
                      {copiado.de === "cara"
                        ? "Tomada de una cara. Tocá las caras que la llevan; en un ambiente se la pone a sus paredes."
                        : `Tomada de ${copiado.nombre || "un ambiente"}. Tocá los ambientes que son iguales; en una cara le pone sus paredes.`}
                    </p>
                    <Renglon nombre="Paredes">{resumenDeCapas(copiado.capas, nombreDeCapa)}</Renglon>
                    {copiado.de === "ambiente" && (
                      <>
                        <Renglon nombre="Piso">
                          {resumenDeCapas(copiado.piso, nombreDeCapa)}
                        </Renglon>
                        <Renglon nombre="Cielorraso">
                          {resumenDeCapas(copiado.cielorraso, nombreDeCapa)}
                          {copiado.alturaCielorraso !== null &&
                            ` · a ${formatMedida(copiado.alturaCielorraso)}`}
                        </Renglon>
                      </>
                    )}
                    <button type="button" onClick={() => setCopiado(null)} style={botonChico}>
                      Tomar otra
                    </button>
                  </>
                ) : (
                  <p style={nota}>
                    Tocá el cuerpo de un muro para tomar su tipo; una cara, o adentro de un ambiente,
                    para tomar su terminación.
                  </p>
                )}
              </section>
            )}

            {herramienta === "medir" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Medir</h3>
                {mpp === null ? (
                  <p style={nota}>Sin escala no hay qué medir: marcala primero.</p>
                ) : medicion ? (
                  <>
                    <Renglon nombre="Distancia" fuerte>
                      {formatMetros(distancia(medicion.a, medicion.b) * mpp)}
                    </Renglon>
                    {/* Los dos catetos: de una diagonal, lo que se suele querer
                        saber es cuánto corre para cada lado. */}
                    {Math.abs(medicion.b.x - medicion.a.x) > 1e-6 &&
                      Math.abs(medicion.b.y - medicion.a.y) > 1e-6 && (
                        <>
                          <Renglon nombre="En horizontal">
                            {formatMetros(Math.abs(medicion.b.x - medicion.a.x) * mpp)}
                          </Renglon>
                          <Renglon nombre="En vertical">
                            {formatMetros(Math.abs(medicion.b.y - medicion.a.y) * mpp)}
                          </Renglon>
                        </>
                      )}
                  </>
                ) : (
                  <p style={nota}>Es sólo para consultar: no se guarda ni cambia el dibujo.</p>
                )}
              </section>
            )}

            {herramienta === "abertura" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Abertura a colocar</h3>
                <label style={campo}>
                  <span style={rotulo}>Tipo</span>
                  <select
                    value={tipoAbertura}
                    onChange={(e) => setTipoAbertura(e.target.value as TipoAbertura)}
                    style={ui.input}
                  >
                    <option value="puerta">Puerta</option>
                    <option value="ventana">Ventana</option>
                  </select>
                </label>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    list="aberturas-de-la-planta"
                    value={molde.nombre}
                    onChange={(e) => cambiarMolde("nombre", e.target.value)}
                    style={ui.input}
                  />
                  <datalist id="aberturas-de-la-planta">
                    {Array.from(
                      new Set(
                        dibujo.aberturas.filter((a) => a.tipo === tipoAbertura).map((a) => a.nombre)
                      )
                    ).map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </label>
                <div style={dosCampos}>
                  <label style={campo}>
                    <span style={rotulo}>Ancho (m)</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={molde.ancho}
                      onChange={(e) => cambiarMolde("ancho", e.target.value)}
                      style={ui.input}
                    />
                  </label>
                  <label style={campo}>
                    <span style={rotulo}>Alto (m)</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={molde.alto}
                      onChange={(e) => cambiarMolde("alto", e.target.value)}
                      style={ui.input}
                    />
                  </label>
                </div>
                {tipoAbertura === "ventana" && (
                  <CamposDeApertura
                    apertura={molde.apertura}
                    hojas={molde.hojas}
                    alCambiar={(cambios) =>
                      setMoldes({ ...moldes, ventana: { ...moldes.ventana, ...cambios } })
                    }
                  />
                )}
                {tipoAbertura === "ventana" && (
                  <label style={campo}>
                    <span style={rotulo}>Antepecho (m)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={molde.antepecho}
                      onChange={(e) => cambiarMolde("antepecho", e.target.value)}
                      style={ui.input}
                    />
                  </label>
                )}
                {tipoAbertura === "puerta" && (
                  <CampoMano
                    valor={molde.mano}
                    alCambiar={(mano) =>
                      setMoldes({ ...moldes, puerta: { ...moldes.puerta, mano } })
                    }
                  />
                )}
                {dibujo.muros.length === 0 && (
                  <p style={nota}>Una abertura va sobre un muro: primero hay que trazar alguno.</p>
                )}
              </section>
            )}

            {aberturaElegida && (
              <section style={bloque}>
                <h3 style={tituloBloque}>{NOMBRE_TIPO[aberturaElegida.tipo]} seleccionada</h3>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    value={aberturaElegida.nombre}
                    onChange={(e) => renombrarAbertura(aberturaElegida, e.target.value)}
                    style={ui.input}
                  />
                </label>
                <div style={dosCampos}>
                  <label style={campo}>
                    <span style={rotulo}>Ancho (m)</span>
                    <CampoMetros
                      key={aberturaElegida.id}
                      valor={aberturaElegida.ancho}
                      alCambiar={(n) => medirTipo(aberturaElegida, "ancho", n)}
                    />
                  </label>
                  <label style={campo}>
                    <span style={rotulo}>Alto (m)</span>
                    <CampoMetros
                      key={aberturaElegida.id}
                      valor={aberturaElegida.alto}
                      alCambiar={(n) => medirTipo(aberturaElegida, "alto", n)}
                    />
                  </label>
                </div>
                {aberturaElegida.tipo === "ventana" && (
                  <CamposDeApertura
                    apertura={aberturaElegida.apertura}
                    hojas={aberturaElegida.hojas}
                    alCambiar={(cambios) => cambiarTipo(aberturaElegida, cambios)}
                  />
                )}
                {delMismoTipo > 1 && (
                  <p style={nota}>
                    Las {delMismoTipo} «{aberturaElegida.nombre}» son el mismo tipo: cambian juntas.
                  </p>
                )}
                {aberturaElegida.tipo === "ventana" && (
                  <label style={campo}>
                    <span style={rotulo}>Antepecho (m)</span>
                    <CampoMetros
                      key={aberturaElegida.id}
                      valor={aberturaElegida.antepecho}
                      desdeCero
                      alCambiar={(antepecho) => cambiarAbertura(aberturaElegida.id, { antepecho })}
                    />
                    {aberturaElegida.antepecho === null && (
                      <span style={nota}>Sin cargar: del piso a donde arranca la ventana.</span>
                    )}
                  </label>
                )}
                {alturaDeSuMuro > 0 &&
                  (aberturaElegida.antepecho ?? 0) + aberturaElegida.alto > alturaDeSuMuro + 1e-9 && (
                    <p style={alerta}>
                      Llega a {formatMetros((aberturaElegida.antepecho ?? 0) + aberturaElegida.alto)} y
                      su muro mide {formatMetros(alturaDeSuMuro)} de piso a techo.
                    </p>
                  )}
                {aberturaElegida.tipo === "puerta" && (
                  <>
                    <CampoMano
                      valor={aberturaElegida.mano ?? "derecha"}
                      alCambiar={(mano) => cambiarAbertura(aberturaElegida.id, { mano })}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        cambiarAbertura(aberturaElegida.id, {
                          lado: aberturaElegida.lado === 1 ? -1 : 1,
                        })
                      }
                      style={botonChico}
                    >
                      Abrir hacia el otro lado
                    </button>
                  </>
                )}
                <Renglon nombre="Vano">
                  {formatM2(aberturaElegida.ancho * aberturaElegida.alto)}
                </Renglon>
                <button type="button" onClick={borrarSeleccion} style={botonBorrar}>
                  Borrar {NOMBRE_TIPO[aberturaElegida.tipo].toLowerCase()}
                </button>
              </section>
            )}

            {herramienta === "muro" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Muro</h3>
                <label style={campo}>
                  <span style={rotulo}>Tipo de muro</span>
                  <SelectorDeTipoDeMuro
                    valor={tipoDeMuro}
                    tipos={tiposDeMuro}
                    alCambiar={setTipoDeMuro}
                  />
                </label>
                <label style={campo}>
                  <span style={rotulo}>Espesor</span>
                  <SelectorEspesor valor={espesor} alCambiar={setEspesor} />
                </label>
                <label style={campo}>
                  <span style={rotulo}>Línea de referencia</span>
                  <SelectorReferencia valor={referencia} alCambiar={setReferencia} />
                  <span style={nota}>
                    {referencia === "centro"
                      ? "Lo que marcás es el eje del muro."
                      : "Lo que marcás es esa cara: el muro crece hacia el otro lado."}
                  </span>
                </label>
              </section>
            )}

            {herramienta === "columna" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Columna a colocar</h3>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    value={moldeDeColumna.nombre}
                    placeholder={proximaColumna}
                    onChange={(e) =>
                      setMoldeDeColumna({ ...moldeDeColumna, nombre: e.target.value })
                    }
                    style={ui.input}
                  />
                </label>
                <CamposDeMaterial
                  material={moldeDeColumna.material}
                  perfil={moldeDeColumna.perfil}
                  alCambiar={(cambios) => setMoldeDeColumna({ ...moldeDeColumna, ...cambios })}
                />
                <div style={dosCampos}>
                  <label style={campo}>
                    <span style={rotulo}>Ancho (m)</span>
                    <CampoMetros
                      valor={moldeDeColumna.ancho}
                      alCambiar={(ancho) => setMoldeDeColumna({ ...moldeDeColumna, ancho })}
                    />
                  </label>
                  <label style={campo}>
                    <span style={rotulo}>Profundidad (m)</span>
                    <CampoMetros
                      valor={moldeDeColumna.profundidad}
                      alCambiar={(profundidad) =>
                        setMoldeDeColumna({ ...moldeDeColumna, profundidad })
                      }
                    />
                  </label>
                </div>
                <div style={dosCampos}>
                  <div style={campo}>
                    <span style={rotulo}>Se agarra de</span>
                    <SelectorAncla
                      valor={moldeDeColumna.ancla}
                      alCambiar={(ancla) => setMoldeDeColumna({ ...moldeDeColumna, ancla })}
                    />
                  </div>
                  <label style={campo}>
                    <span style={rotulo}>Giro (°)</span>
                    <CampoGiro
                      valor={moldeDeColumna.giro}
                      alCambiar={(giro) => setMoldeDeColumna({ ...moldeDeColumna, giro })}
                    />
                  </label>
                </div>
              </section>
            )}

            {herramienta === "viga" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Viga</h3>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    value={moldeDeViga.nombre}
                    placeholder={proximaViga}
                    onChange={(e) => setMoldeDeViga({ ...moldeDeViga, nombre: e.target.value })}
                    style={ui.input}
                  />
                </label>
                <CamposDeMaterial
                  material={moldeDeViga.material}
                  perfil={moldeDeViga.perfil}
                  alCambiar={(cambios) => setMoldeDeViga({ ...moldeDeViga, ...cambios })}
                />
                <div style={dosCampos}>
                  <label style={campo}>
                    <span style={rotulo}>Ancho (m)</span>
                    <CampoMetros
                      valor={moldeDeViga.ancho}
                      alCambiar={(ancho) => setMoldeDeViga({ ...moldeDeViga, ancho })}
                    />
                  </label>
                  <label style={campo}>
                    <span style={rotulo}>Alto (m)</span>
                    <CampoMetros
                      valor={moldeDeViga.alto}
                      alCambiar={(alto) => setMoldeDeViga({ ...moldeDeViga, alto })}
                    />
                  </label>
                </div>
                <label style={campo}>
                  <span style={rotulo}>Línea de referencia</span>
                  <SelectorReferencia
                    valor={moldeDeViga.referencia}
                    alCambiar={(referencia) => setMoldeDeViga({ ...moldeDeViga, referencia })}
                  />
                </label>
                <p style={nota}>
                  {moldeDeViga.material === "metalica"
                    ? "Va debajo de la losa."
                    : "El alto incluye la losa."}
                </p>
              </section>
            )}

            {herramienta === "losa" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Losa</h3>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    value={moldeDeLosa.nombre}
                    placeholder={proximaLosa}
                    onChange={(e) => setMoldeDeLosa({ ...moldeDeLosa, nombre: e.target.value })}
                    style={ui.input}
                  />
                </label>
                <label style={campo}>
                  <span style={rotulo}>Espesor (m)</span>
                  <CampoMetros
                    valor={moldeDeLosa.espesor}
                    alCambiar={(espesor) => setMoldeDeLosa({ ...moldeDeLosa, espesor })}
                  />
                </label>
              </section>
            )}

            {muroElegido && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Muro seleccionado</h3>
                {mpp !== null && (
                  <Renglon nombre="Largo">
                    {formatMetros(distancia(muroElegido.a, muroElegido.b) * mpp)}
                  </Renglon>
                )}
                <label style={campo}>
                  <span style={rotulo}>Tipo de muro</span>
                  <SelectorDeTipoDeMuro
                    valor={muroElegido.tarea}
                    tipos={tiposDeMuro}
                    alCambiar={(tarea) => cambiarMuros(new Set([muroElegido.id]), { tarea })}
                  />
                </label>
                {/* El atajo de todos los días: los muros de un mismo espesor
                    suelen ser de lo mismo. Sólo toca los que no tienen tipo, así
                    no pisa uno que se eligió a mano. */}
                {muroElegido.tarea !== null && sinTipoDelMismoEspesor.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      cambiarMuros(new Set(sinTipoDelMismoEspesor.map((m) => m.id)), {
                        tarea: muroElegido.tarea,
                      })
                    }
                    style={botonChico}
                  >
                    {sinTipoDelMismoEspesor.length === 1
                      ? `Ponérselo al otro muro de ${formatEspesor(muroElegido.espesor)} sin tipo`
                      : `Ponérselo a los ${sinTipoDelMismoEspesor.length} muros de ${formatEspesor(muroElegido.espesor)} sin tipo`}
                  </button>
                )}
                <label style={campo}>
                  <span style={rotulo}>Espesor</span>
                  <SelectorEspesor
                    valor={muroElegido.espesor}
                    alCambiar={(nuevo) =>
                      cambiar({
                        escala,
                        dibujo: {
                          ...dibujo,
                          muros: dibujo.muros.map((m) =>
                            m.id === muroElegido.id ? { ...m, espesor: nuevo } : m
                          ),
                        },
                      })
                    }
                  />
                </label>
                <label style={campo}>
                  <span style={rotulo}>Altura (m)</span>
                  <CampoMetros
                    key={muroElegido.id}
                    valor={muroElegido.altura}
                    vacio={`${formatMedida(alturaDePlanta)} — la de la planta`}
                    alCambiar={(nueva) => ponerAlturaDeMuro(muroElegido.id, nueva)}
                    alVaciar={() => ponerAlturaDeMuro(muroElegido.id, null)}
                  />
                </label>
                <label style={campo}>
                  <span style={rotulo}>Línea de referencia</span>
                  <SelectorReferencia
                    valor={muroElegido.referencia}
                    alCambiar={(nueva) =>
                      cambiar({
                        escala,
                        dibujo: {
                          ...dibujo,
                          muros: dibujo.muros.map((m) =>
                            m.id === muroElegido.id ? { ...m, referencia: nueva } : m
                          ),
                        },
                      })
                    }
                  />
                </label>
                {muroUnido && (
                  <label style={casilla}>
                    <input
                      type="checkbox"
                      checked={puntasJuntas}
                      onChange={(e) => setPuntasJuntas(e.target.checked)}
                    />
                    Mover también los muros unidos a la punta
                  </label>
                )}
                {encimados.has(muroElegido.id) && (
                  <p style={alerta}>Está encimado con otro muro: ese tramo se cuenta dos veces.</p>
                )}
                {Math.abs(muroElegido.a.x - muroElegido.b.x) > 1e-6 &&
                  Math.abs(muroElegido.a.y - muroElegido.b.y) > 1e-6 && (
                    <button
                      type="button"
                      onClick={() => escuadrarMuro(muroElegido)}
                      style={botonChico}
                    >
                      Escuadrar
                    </button>
                  )}
                {carasDelMuro.length > 0 && mpp !== null && (
                  <>
                    <p style={subtitulo}>Caras</p>
                    {carasDelMuro.map((cara) => (
                      <button
                        key={cara.clave}
                        type="button"
                        onClick={() => setCaraElegida(cara.clave)}
                        style={cara.clave === caraElegida ? botonDeCaraElegida : botonDeCara}
                      >
                        <span style={tituloDeCara}>
                          {cara.punta !== null && "Canto · "}
                          {nombreDeAmbiente(cara.ambienteId)} · {formatMetros(cara.largo * mpp)} ·{" "}
                          {formatM2(cara.superficie)}
                        </span>
                        {cara.partes.some((parte) => parte.tipo !== "pano") && (
                          <span style={detalleRenglon}>{desgloseDePartes(cara.partes)}</span>
                        )}
                        <span style={detalleRenglon}>
                          {cara.capas.length === 0
                            ? "sin terminación"
                            : cara.capas
                                .map(
                                  (capa) =>
                                    (nombreDeCapa.get(capa.tarea) ?? "?") +
                                    // Sólo si no llega arriba: es lo que no se deduce.
                                    (capa.alto < cara.alto - 1e-9
                                      ? ` hasta ${formatMedida(capa.alto)}`
                                      : "")
                                )
                                .join(" + ") + (cara.propias ? "" : " (del ambiente)")}
                        </span>
                      </button>
                    ))}
                    {caraAbierta ? (
                      <>
                        <EditorDeCapas
                          capas={caraAbierta.capas}
                          disponibles={capasDisponibles}
                          primero={RUBROS_DE_PARED}
                          conAltura
                          alturaCielorraso={
                            dibujo.ambientes.find((a) => a.id === caraAbierta.ambienteId)
                              ?.alturaCielorraso ?? null
                          }
                          alCambiar={(nuevas) => ponerCapasDeCara(caraAbierta.clave, nuevas)}
                        />
                        {caraAbierta.propias && caraAbierta.ambienteId !== null && (
                          <button
                            type="button"
                            onClick={() => ponerCapasDeCara(caraAbierta.clave, null)}
                            style={botonChico}
                          >
                            Usar las del ambiente
                          </button>
                        )}
                      </>
                    ) : (
                      <p style={nota}>Elegí una cara, acá o en el plano, para ponerle sus capas.</p>
                    )}
                  </>
                )}
                <button type="button" onClick={borrarSeleccion} style={botonBorrar}>
                  Borrar muro
                </button>
              </section>
            )}

            {ambienteElegido && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Ambiente seleccionado</h3>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    value={ambienteElegido.nombre}
                    onChange={(e) => {
                      // Sin pasar por el historial: deshacer letra por letra no es
                      // lo que uno espera de Ctrl+Z en un dibujo.
                      setTrazo({
                        escala,
                        dibujo: {
                          ...dibujo,
                          ambientes: dibujo.ambientes.map((a) =>
                            a.id === ambienteElegido.id ? { ...a, nombre: e.target.value } : a
                          ),
                        },
                      });
                      setSucio(true);
                    }}
                    onFocus={(e) => e.target.select()}
                    style={ui.input}
                  />
                </label>
                {mpp !== null && (
                  <>
                    <Renglon nombre="Superficie">
                      {formatM2(areaDe(ambienteElegido.puntos) * mpp * mpp)}
                    </Renglon>
                    <Renglon nombre="Perímetro">
                      {formatMetros(perimetroDe(ambienteElegido.puntos) * mpp)}
                    </Renglon>
                  </>
                )}
                <p style={subtitulo}>Cielorraso</p>
                <label style={campo}>
                  <span style={rotulo}>Altura (m)</span>
                  <CampoMetros
                    key={ambienteElegido.id}
                    valor={ambienteElegido.alturaCielorraso}
                    vacio={`${formatMedida(alturaDePlanta)} — sin cielorraso, la losa`}
                    alCambiar={(alturaCielorraso) =>
                      cambiarAmbiente(ambienteElegido.id, { alturaCielorraso })
                    }
                    alVaciar={() => cambiarAmbiente(ambienteElegido.id, { alturaCielorraso: null })}
                  />
                </label>
                <EditorDeCapas
                  capas={ambienteElegido.cielorraso}
                  disponibles={capasDisponibles}
                  primero={RUBROS_DE_CIELORRASO}
                  alCambiar={(nuevas) =>
                    cambiarAmbiente(ambienteElegido.id, { cielorraso: nuevas })
                  }
                />

                <p style={subtitulo}>Piso</p>
                <EditorDeCapas
                  capas={ambienteElegido.piso}
                  disponibles={capasDisponibles}
                  primero={RUBROS_DE_PISO}
                  alCambiar={(nuevas) =>
                    cambiarAmbiente(ambienteElegido.id, { piso: nuevas })
                  }
                />

                <p style={subtitulo}>Paredes</p>
                <EditorDeCapas
                  capas={ambienteElegido.capas}
                  disponibles={capasDisponibles}
                  primero={RUBROS_DE_PARED}
                  conAltura
                  alturaCielorraso={ambienteElegido.alturaCielorraso}
                  alCambiar={(capas) => cambiarAmbiente(ambienteElegido.id, { capas })}
                />
                <p style={nota}>
                  Las llevan todas las caras de muro que dan a este ambiente, salvo la que tenga las
                  suyas. La altura de cada capa se elige debajo de su nombre.
                </p>
                {carasConLasSuyas.length > 0 && mpp !== null && (
                  <>
                    <p style={nota}>
                      {carasConLasSuyas.length === carasDelAmbiente.length
                        ? "Todas sus caras llevan"
                        : `${carasConLasSuyas.length} de sus ${carasDelAmbiente.length} caras llevan`}{" "}
                      capas propias, puestas desde el muro:
                    </p>
                    {carasConLasSuyas.map((cara) => (
                      <button
                        key={cara.clave}
                        type="button"
                        // Lleva a su muro, con esa cara ya abierta para editarla.
                        onClick={() => {
                          elegir({ tipo: "muro", id: cara.muroId });
                          setCaraElegida(cara.clave);
                        }}
                        style={botonDeCara}
                      >
                        <span style={tituloDeCara}>
                          {cara.punta !== null ? "Canto" : "Cara"} de {formatMetros(cara.largo * mpp)} ·{" "}
                          {formatM2(cara.superficie)}
                        </span>
                        <span style={detalleRenglon}>{detalleDeCapas(cara, nombreDeCapa)}</span>
                      </button>
                    ))}
                    {/* Pasarlas sólo si son todas iguales y el ambiente no tiene
                        las suyas: de otro modo habría que elegir cuál pisa a cuál. */}
                    {todasLasMismas && ambienteElegido.capas.length === 0 && (
                      <button type="button" onClick={() => unificarParedes(true)} style={botonChico}>
                        Pasarlas al ambiente
                      </button>
                    )}
                    {ambienteElegido.capas.length > 0 && (
                      <button type="button" onClick={() => unificarParedes(false)} style={botonChico}>
                        Que lleven las del ambiente
                      </button>
                    )}
                  </>
                )}
                {ambienteTorcido && ambienteEscuadrado && (
                  <button
                    type="button"
                    onClick={() =>
                      cambiar({
                        escala,
                        dibujo: {
                          ...dibujo,
                          ambientes: dibujo.ambientes.map((a) =>
                            a.id === ambienteElegido.id ? { ...a, puntos: ambienteEscuadrado } : a
                          ),
                        },
                      })
                    }
                    style={botonChico}
                  >
                    Escuadrar
                  </button>
                )}
                <button type="button" onClick={borrarSeleccion} style={botonBorrar}>
                  Borrar ambiente
                </button>
              </section>
            )}

            {columnaElegida && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Columna seleccionada</h3>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    value={columnaElegida.nombre}
                    onChange={(e) =>
                      cambiarPieza("columnas", columnaElegida.id, { nombre: e.target.value }, false)
                    }
                    style={ui.input}
                  />
                </label>
                <CamposDeMaterial
                  material={columnaElegida.material}
                  perfil={columnaElegida.perfil}
                  alCambiar={(cambios) =>
                    // El perfil, mientras se tipea, no entra al historial.
                    cambiarPieza(
                      "columnas",
                      columnaElegida.id,
                      cambios,
                      cambios.material !== undefined
                    )
                  }
                />
                <div style={dosCampos}>
                  <label style={campo}>
                    <span style={rotulo}>Ancho (m)</span>
                    <CampoMetros
                      key={columnaElegida.id}
                      valor={columnaElegida.ancho}
                      alCambiar={(ancho) => cambiarPieza("columnas", columnaElegida.id, { ancho })}
                    />
                  </label>
                  <label style={campo}>
                    <span style={rotulo}>Profundidad (m)</span>
                    <CampoMetros
                      key={columnaElegida.id}
                      valor={columnaElegida.profundidad}
                      alCambiar={(profundidad) =>
                        cambiarPieza("columnas", columnaElegida.id, { profundidad })
                      }
                    />
                  </label>
                </div>
                <div style={dosCampos}>
                  <div style={campo}>
                    <span style={rotulo}>Se agarra de</span>
                    <SelectorAncla
                      valor={columnaElegida.ancla}
                      alCambiar={(ancla) => {
                        if (mpp === null) return;
                        // La columna no se mueve: cambia desde dónde crece y
                        // alrededor de qué punto gira.
                        cambiarPieza("columnas", columnaElegida.id, {
                          ancla,
                          p: puntoDeAncla(columnaElegida, mpp, ancla),
                        });
                      }}
                    />
                  </div>
                  <label style={campo}>
                    <span style={rotulo}>Giro (°)</span>
                    <CampoGiro
                      key={columnaElegida.id}
                      valor={columnaElegida.giro}
                      alCambiar={(giro) => cambiarPieza("columnas", columnaElegida.id, { giro })}
                    />
                  </label>
                </div>
                <AlturaDeColumna
                  key={columnaElegida.id}
                  arriba={columnaElegida.arriba}
                  desde={columnaElegida.desde}
                  medida={medidaDeLaColumna}
                  pisoAPiso={pisoAPiso}
                  alCambiar={(cambios) => cambiarPieza("columnas", columnaElegida.id, cambios)}
                />
                {(() => {
                  const medida = hormigon?.columnas.find((c) => c.id === columnaElegida.id);
                  return medida ? (
                    <>
                      <Renglon nombre="Nivel">
                        {formatNivel(medida.desde)} a {formatNivel(medida.hasta)}
                      </Renglon>
                      {/* Una metálica no lleva hormigón: lo suyo es el largo
                          del perfil. */}
                      {medida.material === "metalica" ? (
                        <Renglon nombre="Largo del perfil" fuerte>
                          {formatMetros(medida.alto)}
                        </Renglon>
                      ) : (
                        <Renglon nombre="Hormigón" fuerte>
                          {formatM3(medida.neto)}
                        </Renglon>
                      )}
                    </>
                  ) : null;
                })()}
                <button type="button" onClick={borrarSeleccion} style={botonBorrar}>
                  Borrar columna
                </button>
              </section>
            )}

            {vigaElegida && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Viga seleccionada</h3>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    value={vigaElegida.nombre}
                    onChange={(e) =>
                      cambiarPieza("vigas", vigaElegida.id, { nombre: e.target.value }, false)
                    }
                    style={ui.input}
                  />
                </label>
                <CamposDeMaterial
                  material={vigaElegida.material}
                  perfil={vigaElegida.perfil}
                  alCambiar={(cambios) =>
                    cambiarPieza("vigas", vigaElegida.id, cambios, cambios.material !== undefined)
                  }
                />
                <div style={dosCampos}>
                  <label style={campo}>
                    <span style={rotulo}>Ancho (m)</span>
                    <CampoMetros
                      key={vigaElegida.id}
                      valor={vigaElegida.ancho}
                      alCambiar={(ancho) => cambiarPieza("vigas", vigaElegida.id, { ancho })}
                    />
                  </label>
                  <label style={campo}>
                    <span style={rotulo}>Alto (m)</span>
                    <CampoMetros
                      key={vigaElegida.id}
                      valor={vigaElegida.alto}
                      alCambiar={(alto) => cambiarPieza("vigas", vigaElegida.id, { alto })}
                    />
                  </label>
                </div>
                <label style={campo}>
                  <span style={rotulo}>Línea de referencia</span>
                  <SelectorReferencia
                    valor={vigaElegida.referencia}
                    alCambiar={(referencia) => cambiarPieza("vigas", vigaElegida.id, { referencia })}
                  />
                </label>
                {(() => {
                  const medida = hormigon?.vigas.find((v) => v.id === vigaElegida.id);
                  return (
                    <>
                      <label style={campo}>
                        <span style={rotulo}>Cara de arriba (m)</span>
                        <CampoMetros
                          key={vigaElegida.id}
                          desdeCero
                          valor={vigaElegida.nivel}
                          vacio={medida ? formatMedida(medida.hasta) : undefined}
                          alCambiar={(nivel) => cambiarPieza("vigas", vigaElegida.id, { nivel })}
                          alVaciar={() => cambiarPieza("vigas", vigaElegida.id, { nivel: null })}
                        />
                        <span style={nota}>
                          {vigaElegida.material === "metalica"
                            ? "Vacío: contra el fondo de su losa."
                            : "Vacío: al ras de arriba de su losa. El alto incluye la losa."}
                        </span>
                      </label>
                      {medida && (
                        <>
                          <Renglon nombre="Largo">{formatMetros(medida.largo)}</Renglon>
                          <Renglon nombre="Fondo de viga">{formatNivel(medida.desde)}</Renglon>
                          {medida.bajoLosa !== null && (
                            <Renglon nombre="Bajo fondo de losa">
                              {formatMetros(medida.bajoLosa)}
                            </Renglon>
                          )}
                          {medida.material === "metalica" ? (
                            <Renglon nombre="Largo del perfil" fuerte>
                              {formatMetros(medida.largo)}
                            </Renglon>
                          ) : (
                            <Renglon nombre="Hormigón" fuerte>
                              {formatM3(medida.neto)}
                            </Renglon>
                          )}
                          {medida.bruto - medida.neto > 0.0005 && (
                            <p style={detalleRenglon}>
                              Entera son {formatM3(medida.bruto)}: el resto ya está contado en las
                              columnas, la losa u otra viga.
                            </p>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
                <button type="button" onClick={borrarSeleccion} style={botonBorrar}>
                  Borrar viga
                </button>
              </section>
            )}

            {losaElegida && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Losa seleccionada</h3>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    value={losaElegida.nombre}
                    onChange={(e) =>
                      cambiarPieza("losas", losaElegida.id, { nombre: e.target.value }, false)
                    }
                    style={ui.input}
                  />
                </label>
                <div style={dosCampos}>
                  <label style={campo}>
                    <span style={rotulo}>Espesor (m)</span>
                    <CampoMetros
                      key={losaElegida.id}
                      valor={losaElegida.espesor}
                      alCambiar={(espesor) => cambiarPieza("losas", losaElegida.id, { espesor })}
                    />
                  </label>
                  <label style={campo}>
                    <span style={rotulo}>Bajo el NPT (m)</span>
                    <CampoMetros
                      key={losaElegida.id}
                      desdeCero
                      valor={losaElegida.bajoNpt}
                      vacio={
                        estructura.bajoNpt !== null
                          ? `${formatMedida(estructura.bajoNpt)} — el de la planta`
                          : "sin definir"
                      }
                      alCambiar={(bajoNpt) => cambiarPieza("losas", losaElegida.id, { bajoNpt })}
                      alVaciar={() => cambiarPieza("losas", losaElegida.id, { bajoNpt: null })}
                    />
                  </label>
                </div>
                {/* Sólo si no es lo de toda la planta: una losa rebajada. */}
                <p style={nota}>
                  Cuánto más abajo que el piso terminado que sostiene queda su cara de arriba, si
                  no es lo de toda la planta.
                  {pisoAPiso === null && " Hace falta que la planta sea de algún piso de la obra."}
                </p>
                {(() => {
                  const medida = hormigon?.losas.find((l) => l.id === losaElegida.id);
                  return medida ? (
                    <>
                      <Renglon nombre="Superficie">{formatM2(medida.superficie)}</Renglon>
                      <Renglon nombre="Nivel">
                        {formatNivel(medida.desde)} a {formatNivel(medida.hasta)}
                      </Renglon>
                      <Renglon nombre="Hormigón" fuerte>
                        {formatM3(medida.neto)}
                      </Renglon>
                    </>
                  ) : null;
                })()}
                <button type="button" onClick={borrarSeleccion} style={botonBorrar}>
                  Borrar losa
                </button>
              </section>
            )}
          </div>

          <div style={solapa === "medidas" ? contenidoDeSolapa : oculto}>
            {modo === "estructura" && hormigon && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Estructura</h3>
                {!hayEstructura && <p style={nota}>Nada todavía.</p>}

                {columnasDeHormigon.length > 0 && (
                  <Grupo titulo="Columnas" total={formatM3(hormigon.totalColumnas)}>
                    {gruposDeColumnas(estructura.columnas, columnasDeHormigon).map((g) => (
                      <Renglon
                        key={g.clave}
                        nombre={`${g.nombre} · h ${formatMedida(g.alto)} · ${g.cantidad} u`}
                      >
                        {formatM3(g.neto)}
                      </Renglon>
                    ))}
                    <Renglon nombre={`Total · ${columnasDeHormigon.length} u`} fuerte>
                      {formatM3(hormigon.totalColumnas)}
                    </Renglon>
                  </Grupo>
                )}

                {/* Las metálicas, por perfil y en metros: es como se piden. */}
                {columnasMetalicas.length > 0 && (
                  <Grupo
                    titulo="Columnas metálicas"
                    total={formatMetros(columnasMetalicas.reduce((t, c) => t + c.alto, 0))}
                  >
                    {gruposDeColumnas(estructura.columnas, columnasMetalicas).map((g) => (
                      <Renglon
                        key={g.clave}
                        nombre={`${g.nombre} · h ${formatMedida(g.alto)} · ${g.cantidad} u`}
                      >
                        {formatMetros(g.largo)}
                      </Renglon>
                    ))}
                    <Renglon nombre={`Total · ${columnasMetalicas.length} u`} fuerte>
                      {formatMetros(columnasMetalicas.reduce((t, c) => t + c.alto, 0))}
                    </Renglon>
                  </Grupo>
                )}

                {vigasDeHormigon.length > 0 && (
                  <Grupo titulo="Vigas" total={formatM3(hormigon.totalVigas)}>
                    {vigasDeHormigon.map((medida) => {
                      const viga = estructura.vigas.find((v) => v.id === medida.id);
                      return (
                        <Renglon
                          key={medida.id}
                          nombre={`${medida.nombre || "Viga"} · ${viga ? formatSeccion(viga.ancho, viga.alto) : ""} · ${formatMetros(medida.largo)}`}
                        >
                          {formatM3(medida.neto)}
                        </Renglon>
                      );
                    })}
                    <Renglon
                      nombre={`Total · ${formatMetros(vigasDeHormigon.reduce((t, v) => t + v.largo, 0))}`}
                      fuerte
                    >
                      {formatM3(hormigon.totalVigas)}
                    </Renglon>
                  </Grupo>
                )}

                {/* Las metálicas, juntas por perfil: al herrero se le piden
                    tantos metros de cada uno, no viga por viga. */}
                {vigasMetalicas.length > 0 && (
                  <Grupo
                    titulo="Vigas metálicas"
                    total={formatMetros(vigasMetalicas.reduce((t, v) => t + v.largo, 0))}
                  >
                    {perfilesDeVigas(estructura.vigas, vigasMetalicas).map((g) => (
                      <Renglon key={g.nombre} nombre={`${g.nombre} · ${g.cantidad} u`}>
                        {formatMetros(g.largo)}
                      </Renglon>
                    ))}
                    <Renglon nombre={`Total · ${vigasMetalicas.length} u`} fuerte>
                      {formatMetros(vigasMetalicas.reduce((t, v) => t + v.largo, 0))}
                    </Renglon>
                  </Grupo>
                )}

                {hormigon.losas.length > 0 && (
                  <Grupo titulo="Losas" total={formatM3(hormigon.totalLosas)}>
                    {hormigon.losas.map((medida) => {
                      const losa = estructura.losas.find((l) => l.id === medida.id);
                      return (
                        <Renglon
                          key={medida.id}
                          nombre={`${medida.nombre || "Losa"} · e ${losa ? formatEspesor(losa.espesor) : ""} · ${formatM2(medida.superficie)}`}
                        >
                          {formatM3(medida.neto)}
                        </Renglon>
                      );
                    })}
                    <Renglon nombre="Total" fuerte>
                      {formatM3(hormigon.totalLosas)}
                    </Renglon>
                  </Grupo>
                )}

                {hayEstructura && (
                  <>
                    <p style={subtitulo}>Toda la estructura</p>
                    <Renglon nombre="Hormigón" fuerte>
                      {formatM3(hormigon.total)}
                    </Renglon>
                    {pisos > 1 && (
                      <Renglon nombre={`En los ${pisos} pisos`}>
                        {formatM3(hormigon.total * pisos)}
                      </Renglon>
                    )}
                    {/* Para que el número no parezca corto contra una cuenta a
                        mano, pieza por pieza. */}
                    {hormigon.descontado > 0.0005 && (
                      <p style={nota}>
                        Los cruces se cuentan una vez: {formatM3(hormigon.descontado)} descontados. El
                        nudo es de la columna, después de la losa y después de la viga.
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            <section style={bloque}>
              {/* El título sólo hace falta cuando arriba está el hormigón. */}
              {modo === "estructura" && <h3 style={tituloBloque}>Arquitectura</h3>}

              {medidas === null ? (
                <p style={nota}>Marcá la escala para ver las medidas.</p>
              ) : (
                <>
                  <Grupo titulo="Muros" total={formatMetros(medidas.largoDeMuros)}>
                    {medidas.murosPorEspesor.length === 0 && <p style={nota}>Ninguno todavía.</p>}
                    {medidas.murosPorEspesor.map((g) => (
                      <Renglon
                        key={g.espesor}
                        nombre={`${formatEspesor(g.espesor)} · ${g.cantidad} ${g.cantidad === 1 ? "tramo" : "tramos"}`}
                      >
                        {formatMetros(g.largo)}
                      </Renglon>
                    ))}
                    {medidas.murosPorEspesor.length > 0 && (
                      <>
                        <Renglon nombre="Total" fuerte>
                          {formatMetros(medidas.largoDeMuros)}
                        </Renglon>
                        <Renglon nombre="Pared, una cara">{formatM2(medidas.paredUnaCara)}</Renglon>
                        {medidas.vanos > 0 && (
                          <>
                            <Renglon nombre="Vanos">− {formatM2(medidas.vanos)}</Renglon>
                            <Renglon nombre="Pared sin vanos" fuerte>
                              {formatM2(medidas.paredSinVanos)}
                            </Renglon>
                          </>
                        )}
                      </>
                    )}
                  </Grupo>

                  {terminaciones && terminaciones.muros.length > 0 && (
                    <Grupo titulo="Mampostería">
                      {terminaciones.muros.map((fila) => (
                        <Renglon
                          key={fila.capa}
                          nombre={tipoPorId.get(fila.capa)?.nombre ?? "Tarea que ya no está en el catálogo"}
                        >
                          {cantidadDeMuro(fila, tipoPorId.get(fila.capa)?.unidad)}
                        </Renglon>
                      ))}
                      {terminaciones.murosSinTipo > 0.005 && (
                        <Renglon nombre="Muros sin tipo">
                          {formatM2(terminaciones.murosSinTipo)}
                        </Renglon>
                      )}
                    </Grupo>
                  )}

                  {solapes.length > 0 && (
                    <p style={alerta}>
                      {solapes.length === 1
                        ? "Hay dos muros encimados"
                        : `Hay ${solapes.length} pares de muros encimados`}
                      : {formatMetros(largoEncimado)} están contados dos veces. Van en rojo en el
                      plano.
                    </p>
                  )}

                  <Grupo titulo="Ambientes" total={formatM2(medidas.areaDeAmbientes)}>
                    {medidas.ambientes.length === 0 && <p style={nota}>Ninguno todavía.</p>}
                    {medidas.ambientes.map((a) => (
                      <Renglon key={a.id} nombre={a.nombre || "Sin nombre"}>
                        {formatM2(a.area)}
                      </Renglon>
                    ))}
                    {medidas.ambientes.length > 0 && (
                      <Renglon nombre="Total" fuerte>
                        {formatM2(medidas.areaDeAmbientes)}
                      </Renglon>
                    )}
                  </Grupo>

                  {terminaciones && terminaciones.porCapa.length > 0 && (
                    <Grupo titulo="Terminaciones de pared">
                      <FilasDeCapas filas={terminaciones.porCapa} nombres={nombreDeCapa} />
                      {/* Lo que falta: sin esto, un baño terminado y el resto sin
                          tocar se leería como la planta entera. */}
                      {terminaciones.sinTerminacion > 0.005 && (
                        <Renglon nombre="Caras sin terminación">
                          {formatM2(terminaciones.sinTerminacion)}
                        </Renglon>
                      )}
                    </Grupo>
                  )}

                  {terminaciones && terminaciones.pisos.length > 0 && (
                    <Grupo titulo="Pisos">
                      <FilasDeCapas filas={terminaciones.pisos} nombres={nombreDeCapa} />
                      {terminaciones.sinPiso > 0.005 && (
                        <Renglon nombre="Ambientes sin piso">
                          {formatM2(terminaciones.sinPiso)}
                        </Renglon>
                      )}
                    </Grupo>
                  )}

                  {terminaciones && terminaciones.cielorrasos.length > 0 && (
                    <Grupo titulo="Cielorrasos">
                      <FilasDeCapas filas={terminaciones.cielorrasos} nombres={nombreDeCapa} />
                      {terminaciones.sinCielorraso > 0.005 && (
                        <Renglon nombre="Ambientes sin cielorraso">
                          {formatM2(terminaciones.sinCielorraso)}
                        </Renglon>
                      )}
                    </Grupo>
                  )}

                  {medidas.aberturas.length > 0 && (
                    <Grupo titulo="Aberturas" total={`${medidas.cantidadDeAberturas} u`}>
                      {medidas.aberturas.map((g) => (
                        <div
                          key={`${g.tipo}|${g.nombre}|${g.ancho}|${g.alto}|${g.mano}|${g.antepecho}|${g.apertura}|${g.hojas}`}
                        >
                          <Renglon
                            nombre={`${g.nombre || NOMBRE_TIPO[g.tipo]}${g.mano ? ` ${MANO_CORTA[g.mano]}` : ""} · ${formatMedida(g.ancho)} × ${formatMedida(g.alto)} · ${g.cantidad} u`}
                          >
                            {formatM2(g.superficie)}
                          </Renglon>
                          {/* En su propia línea: sumado al renglón de arriba lo
                              alargaba hasta cortarle la cantidad. */}
                          {g.tipo === "ventana" && (
                            <p style={detalleRenglon}>
                              {detalleDeVentana(g)}
                            </p>
                          )}
                        </div>
                      ))}
                      <Renglon nombre={`Total · ${medidas.cantidadDeAberturas} u`} fuerte>
                        {formatM2(medidas.vanos)}
                      </Renglon>
                    </Grupo>
                  )}

                  {/* En el modo de estructura el detalle está arriba, pieza por
                      pieza. */}
                  {modo === "arquitectura" && hormigon && hayEstructura && (
                    <Grupo titulo="Hormigón" total={formatM3(hormigon.total)}>
                      {columnasDeHormigon.length > 0 && (
                        <Renglon nombre={`Columnas · ${columnasDeHormigon.length} u`}>
                          {formatM3(hormigon.totalColumnas)}
                        </Renglon>
                      )}
                      {vigasDeHormigon.length > 0 && (
                        <Renglon nombre={`Vigas · ${vigasDeHormigon.length} u`}>
                          {formatM3(hormigon.totalVigas)}
                        </Renglon>
                      )}
                      {hormigon.losas.length > 0 && (
                        <Renglon nombre={`Losas · ${hormigon.losas.length} u`}>
                          {formatM3(hormigon.totalLosas)}
                        </Renglon>
                      )}
                      <Renglon nombre="Total" fuerte>
                        {formatM3(hormigon.total)}
                      </Renglon>
                      {columnasMetalicas.length > 0 && (
                        <Renglon nombre={`Columnas metálicas · ${columnasMetalicas.length} u`}>
                          {formatMetros(columnasMetalicas.reduce((t, c) => t + c.alto, 0))}
                        </Renglon>
                      )}
                      {vigasMetalicas.length > 0 && (
                        <Renglon nombre={`Vigas metálicas · ${vigasMetalicas.length} u`}>
                          {formatMetros(vigasMetalicas.reduce((t, v) => t + v.largo, 0))}
                        </Renglon>
                      )}
                    </Grupo>
                  )}

                  {pisos > 1 && (
                    <Grupo titulo={`En los ${pisos} pisos`}>
                      <Renglon nombre="Muros">{formatMetros(medidas.largoDeMuros * pisos)}</Renglon>
                      <Renglon nombre={medidas.vanos > 0 ? "Pared sin vanos" : "Pared, una cara"}>
                        {formatM2(medidas.paredSinVanos * pisos)}
                      </Renglon>
                      <Renglon nombre="Ambientes">
                        {formatM2(medidas.areaDeAmbientes * pisos)}
                      </Renglon>
                      {medidas.cantidadDeAberturas > 0 && (
                        <Renglon nombre="Aberturas">{medidas.cantidadDeAberturas * pisos} u</Renglon>
                      )}
                      {hormigon && hayEstructura && (
                        <Renglon nombre="Hormigón">{formatM3(hormigon.total * pisos)}</Renglon>
                      )}
                      {terminaciones?.muros.map((fila) => (
                        <Renglon
                          key={fila.capa}
                          nombre={tipoPorId.get(fila.capa)?.nombre ?? "Tarea eliminada"}
                        >
                          {cantidadDeMuro(
                            {
                              superficie: fila.superficie * pisos,
                              volumen: fila.volumen * pisos,
                            },
                            tipoPorId.get(fila.capa)?.unidad
                          )}
                        </Renglon>
                      ))}
                      {/* Pared, piso y cielorraso juntos: en el edificio entero lo
                          que importa es cuánto hay de cada tarea. */}
                      {terminaciones &&
                        porTarea([
                          ...terminaciones.porCapa,
                          ...terminaciones.pisos,
                          ...terminaciones.cielorrasos,
                        ]).map(({ capa, superficie, volumen }) => (
                          <Renglon key={capa} nombre={nombreDeCapa.get(capa) ?? "Tarea eliminada"}>
                            {formatM2(superficie * pisos)}
                            {volumen > 0 && ` · ${formatM3(volumen * pisos)}`}
                          </Renglon>
                        ))}
                    </Grupo>
                  )}
                </>
              )}
            </section>
          </div>

          <div style={solapa === "planta" ? contenidoDeSolapa : oculto}>
            <section style={bloque}>
              <label style={campo}>
                <span style={rotulo}>Nombre</span>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    setSucio(true);
                  }}
                  style={ui.input}
                />
              </label>

              <div style={dosCampos}>
                <label style={campo}>
                  <span style={rotulo}>Altura (m)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={altura}
                    onChange={(e) => {
                      setAltura(e.target.value);
                      setSucio(true);
                    }}
                    style={ui.input}
                  />
                </label>
                <label style={campo}>
                  <span style={rotulo}>Pisos iguales</span>
                  {/* Con pisos asignados no se escribe: son los que hay. */}
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={pisosDeLaPlanta.length > 0 ? pisosDeLaPlanta.length : repeticiones}
                    disabled={pisosDeLaPlanta.length > 0}
                    onChange={(e) => {
                      setRepeticiones(e.target.value);
                      setSucio(true);
                    }}
                    style={pisosDeLaPlanta.length > 0 ? campoQuieto : ui.input}
                  />
                </label>
              </div>
            </section>

            <section style={bloque}>
              <h3 style={tituloBloque}>Pisos</h3>
              {pisosDeLaPlanta.length === 0 ? (
                <p style={nota}>
                  Esta planta todavía no es de ningún piso de la obra: falta decir a qué nivel
                  está.
                </p>
              ) : (
                <>
                  {/* De arriba hacia abajo, como en la definición. */}
                  {[...pisosDeLaPlanta].reverse().map((p) => (
                    <Renglon key={p.numero} nombre={nombreDePiso(p)}>
                      {formatNivel(p.cota)}
                    </Renglon>
                  ))}
                  {/* La altura de un piso es de piso terminado a piso
                      terminado; la de la planta, de piso a techo. Lo que hay
                      entre las dos es donde entran la losa y el piso de
                      arriba, y si no alcanza, una de las dos está mal. */}
                  <Renglon nombre="De NPT a NPT">{rangoDeMetros(alturasDePiso)}</Renglon>
                  <Renglon nombre="De piso a techo">{formatMetros(alturaDePlanta)}</Renglon>
                  <Renglon nombre="Queda para losa y piso" fuerte>
                    {rangoDeMetros(alturasDePiso.map((h) => h - alturaDePlanta))}
                  </Renglon>
                  {alturasDePiso.some((h) => h - alturaDePlanta <= 0) && (
                    <p style={alerta}>
                      La altura de piso a techo no entra entre un piso terminado y el de arriba:
                      revisá la altura de la planta o la del piso.
                    </p>
                  )}
                </>
              )}
              <button type="button" onClick={() => setDefiniendoPisos(true)} style={botonChico}>
                Definir pisos
              </button>
            </section>

            {modo === "estructura" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Niveles de la estructura</h3>
                {/* La estructura no está al nivel del piso terminado: la losa
                    que sostiene el piso de arriba termina unos centímetros
                    antes. Eso es lo que se carga acá, y de ahí sale todo. */}
                <label style={campo}>
                  <span style={rotulo}>La losa, bajo el NPT que sostiene (m)</span>
                  <CampoMetros
                    desdeCero
                    valor={estructura.bajoNpt}
                    vacio={
                      nivelesDeLaLosa.bajoNpt !== null
                        ? `${formatMedida(nivelesDeLaLosa.bajoNpt)} — lo que deja la altura`
                        : "sin definir"
                    }
                    alCambiar={(bajoNpt) => agregarAEstructura({ bajoNpt })}
                    alVaciar={() => agregarAEstructura({ bajoNpt: null })}
                  />
                </label>
                {pisoAPiso === null ? (
                  <p style={nota}>
                    Esta planta todavía no es de ningún piso de la obra, así que no se sabe a qué
                    nivel está el piso que sostiene: la losa va con su fondo a la altura de piso a
                    techo.
                  </p>
                ) : (
                  <Renglon nombre="NPT que sostiene">{formatNivel(pisoAPiso)}</Renglon>
                )}
                <Renglon nombre="Cara de arriba de la losa">
                  {formatNivel(nivelesDeLaLosa.arriba)}
                </Renglon>
                <Renglon nombre="Fondo de losa">{formatNivel(nivelesDeLaLosa.fondo)}</Renglon>
                <Renglon nombre="Arranque de columnas">
                  {formatNivel(estructura.bajoNpt !== null ? -estructura.bajoNpt : 0)}
                </Renglon>
                <p style={nota}>
                  Medidos desde el piso terminado de esta planta (±0,00), para una losa de{" "}
                  {formatEspesor(espesorDeReferencia)}. Es la estructura de arriba: sostiene el
                  piso siguiente.
                </p>
                {/* El fondo de losa es el techo de la planta: si no coinciden,
                    las paredes se están midiendo hasta otra altura. */}
                {Math.abs(nivelesDeLaLosa.fondo - alturaDePlanta) > 0.005 && (
                  <p style={alerta}>
                    El fondo de losa queda en {formatNivel(nivelesDeLaLosa.fondo)} y la planta
                    mide {formatMedida(alturaDePlanta)} de piso a techo: revisá cuál de los dos
                    es.
                  </p>
                )}
                {alturasDePiso.some((h) => Math.abs(h - alturasDePiso[0]) > 0.0005) && (
                  <p style={nota}>
                    Los pisos de esta planta no miden lo mismo de NPT a NPT: la estructura se
                    calcula con el de más abajo.
                  </p>
                )}
              </section>
            )}

            <form action={eliminar} style={{ marginTop: "auto" }}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="planta_id" value={planta.id} />
              <BotonConfirmar
                mensaje={`¿Eliminar la planta "${planta.nombre}" con su plano y todo lo dibujado? No se puede deshacer.`}
                style={botonEliminar}
              >
                Eliminar planta
              </BotonConfirmar>
            </form>
          </div>
        </aside>
      </div>

      {definiendoPisos && (
        <DefinicionDePisos
          pisos={pisosDeObra}
          plantas={plantasDeObra}
          guardar={async (nuevos) => {
            const resultado = await guardarPisos(nuevos);
            // Los pisos vienen del servidor: se vuelven a pedir. El dibujo
            // que se está editando no se toca, sigue en esta pantalla.
            if (!resultado.error) router.refresh();
            return resultado;
          }}
          alCerrar={() => setDefiniendoPisos(false)}
        />
      )}
    </div>
  );
}

// ---- Piezas -----------------------------------------------------------------

/** Un texto apoyado al costado de un tramo, a mitad de camino. */
function Cota({
  a,
  b,
  u,
  separacion,
  color = "#111111",
  lado = 1,
  children,
}: {
  a: Punto;
  b: Punto;
  u: number;
  separacion: number;
  color?: string;
  /** 1: arriba o a la izquierda del tramo. -1: del otro lado. */
  lado?: 1 | -1;
  children: React.ReactNode;
}) {
  const largo = distancia(a, b) || 1;
  // La normal que apunta hacia arriba o hacia la izquierda, así el texto no
  // salta de lado según en qué sentido se dibujó el tramo.
  let nx = (b.y - a.y) / largo;
  let ny = -(b.x - a.x) / largo;
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  nx *= lado;
  ny *= lado;

  const vertical = Math.abs(nx) > Math.abs(ny);
  // Debajo de un tramo horizontal el texto cuelga de su renglón: hay que
  // bajarlo su propia altura para que quede a la misma distancia que arriba.
  const caida = vertical ? 4 * u : lado === -1 ? 8 * u : 0;

  return (
    <text
      x={(a.x + b.x) / 2 + nx * separacion}
      y={(a.y + b.y) / 2 + ny * separacion + caida}
      textAnchor={vertical ? (lado === 1 ? "end" : "start") : "middle"}
      fontSize={11 * u}
      fill={color}
      stroke="#ffffff"
      strokeWidth={3 * u}
      paintOrder="stroke"
      style={{ pointerEvents: "none" }}
    >
      {children}
    </text>
  );
}

/**
 * Las capas de una terminación, en orden, y el desplegable para sumar otra.
 *
 * Una capa es una tarea del cómputo —azotado, revoque grueso, porcelanato—, y
 * por eso el desplegable es el catálogo de tareas: lo que se elige acá es lo
 * que después se cotiza. Primero van los rubros que tocan —los de pared para
 * una pared, los de piso para un piso— y después el resto.
 *
 * En una pared cada capa dice además hasta dónde sube (`conAltura`): no todas
 * llegan al techo. En un piso o un cielorraso no hay altura que decir.
 */
function EditorDeCapas({
  capas,
  disponibles,
  alCambiar,
  primero,
  conAltura = false,
  alturaCielorraso = null,
}: {
  capas: Capa[];
  disponibles: CapaDisponible[];
  alCambiar: (nuevas: Capa[]) => void;
  /** Los rubros que van arriba en el desplegable. */
  primero: string[];
  conAltura?: boolean;
  /** La del cielorraso del ambiente, para decirla en la opción. */
  alturaCielorraso?: number | null;
}) {
  const nombres = new Map(disponibles.map((c) => [c.id, c.nombre]));
  const orden = (rubro: string) => {
    const i = primero.findIndex((r) => r.toLowerCase() === rubro.toLowerCase());
    return i === -1 ? primero.length : i;
  };
  const rubros = Array.from(new Set(disponibles.map((c) => c.rubro))).sort(
    (a, b) => orden(a) - orden(b) || a.localeCompare(b, "es")
  );
  const cambiarCapa = (cual: number, hasta: Capa["hasta"]) =>
    alCambiar(capas.map((capa, k) => (k === cual ? { ...capa, hasta } : capa)));
  const ponerEspesor = (cual: number, espesor: number | null) =>
    alCambiar(capas.map((capa, k) => (k === cual ? { ...capa, espesor } : capa)));

  return (
    <div style={campo}>
      {capas.map((capa, i) => (
        <div key={`${capa.tarea}-${i}`} style={campo}>
          <div style={renglon}>
            <span style={nombreConMuestra}>
              <span style={{ ...muestra, background: colorDeCapa(capa.tarea) }} />
              <span style={nombreRenglon}>
                {i + 1}. {nombres.get(capa.tarea) ?? "Tarea que ya no está en el catálogo"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => alCambiar(capas.filter((_, k) => k !== i))}
              title="Sacar esta capa"
              style={botonQuitar}
            >
              ×
            </button>
          </div>
          {conAltura && (
            <div style={alturaDeCapa}>
              <span style={rotulo}>hasta</span>
              <select
                value={typeof capa.hasta === "number" ? "otra" : capa.hasta}
                onChange={(e) =>
                  cambiarCapa(
                    i,
                    e.target.value === "otra"
                      ? // Arranca en el cielorraso si hay, que es contra lo que
                        // se suele medir "un poco más" o "un poco menos".
                        alturaCielorraso ?? 2
                      : (e.target.value as "techo" | "cielorraso")
                  )
                }
                style={selectChico}
              >
                {/* "Losa" y no "techo": en un ambiente con cielorraso el techo
                    que se ve es el cielorraso, y la palabra decía lo contrario
                    de lo que hacía. */}
                <option value="techo">Losa</option>
                <option value="cielorraso">
                  Cielorraso{alturaCielorraso ? ` (${formatMedida(alturaCielorraso)})` : ""}
                </option>
                <option value="otra">Altura personalizada</option>
              </select>
              {typeof capa.hasta === "number" && (
                <CampoMetros
                  key={i}
                  valor={capa.hasta}
                  alCambiar={(altura) => cambiarCapa(i, altura)}
                />
              )}
            </div>
          )}
          {/* El espesor, en centímetros, que es como se dice el de un
              revoque o el de una carpeta. De él sale el volumen de material. */}
          <label style={espesorDeCapa}>
            <span style={rotulo}>espesor</span>
            <CampoCm
              key={`${capa.tarea}-${i}`}
              valor={capa.espesor}
              alCambiar={(espesor) => ponerEspesor(i, espesor)}
            />
            <span style={rotulo}>cm</span>
          </label>
        </div>
      ))}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) alCambiar([...capas, { tarea: e.target.value, hasta: "techo", espesor: null }]);
        }}
        style={ui.input}
      >
        <option value="">{capas.length === 0 ? "Agregar una capa…" : "Agregar otra capa…"}</option>
        {rubros.map((rubro) => (
          <optgroup key={rubro} label={rubro}>
            {disponibles
              .filter((c) => c.rubro === rubro && !capas.some((capa) => capa.tarea === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/**
 * Un espesor de capa, escrito en centímetros y guardado en metros.
 *
 * Vacío es "sin cargar", y así se avisa: una capa sin espesor mide sus m²
 * igual. Guarda el texto aparte del número, como `CampoMetros`: mientras se
 * escribe "1," todavía no hay un espesor.
 */
function CampoCm({
  valor,
  alCambiar,
}: {
  /** En metros, o null si no se cargó. */
  valor: number | null;
  alCambiar: (metros: number | null) => void;
}) {
  // Redondeado: 0,015 m por cien da 1,4999999999999998.
  const enCm = (metros: number | null) =>
    metros === null ? "" : String(Math.round(metros * 100000) / 1000);
  const [texto, setTexto] = useState(enCm(valor));
  const [visto, setVisto] = useState(valor);

  if (visto !== valor) {
    setVisto(valor);
    if (valor === null) setTexto("");
    else if (texto === "" || Math.abs(Number(texto) / 100 - valor) > 1e-9) setTexto(enCm(valor));
  }

  return (
    <input
      type="number"
      min="0"
      step="0.5"
      value={texto}
      placeholder="—"
      onChange={(e) => {
        setTexto(e.target.value);
        if (e.target.value === "") {
          alCambiar(null);
          return;
        }
        const cm = Number(e.target.value);
        if (cm > 0) alCambiar(Math.round(cm * 1000) / 100000);
      }}
      style={selectChico}
    />
  );
}

/**
 * Lo que hay de cada capa, con su color: un bloque de las medidas. Los m²
 * siempre; debajo, cuando la capa tiene espesor, los m³ que salen de él —el
 * material—, y si en algún lado le falta, cuánto quedó sin contar.
 */
function FilasDeCapas({
  filas,
  nombres,
}: {
  filas: { capa: string; superficie: number; volumen: number; espesor: number | null }[];
  nombres: Map<string, string>;
}) {
  return (
    <>
      {filas.map(({ capa, superficie, volumen, espesor }) => (
        <div key={capa}>
          <div style={renglon}>
            <span style={nombreConMuestra}>
              <span style={{ ...muestra, background: colorDeCapa(capa) }} />
              <span style={nombreRenglon}>
                {nombres.get(capa) ?? "Tarea que ya no está en el catálogo"}
              </span>
            </span>
            <span style={valorRenglon}>{formatM2(superficie)}</span>
          </div>
          {volumen > 0 && (
            <p style={detalleDeCapa}>
              {espesor !== null ? formatCm(espesor) : "espesores distintos o sin cargar"} ·{" "}
              {formatM3(volumen)}
            </p>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * De qué está hecho un muro. Las mamposterías y las estructuras van primero,
 * que es donde está casi todo lo que puede ser un muro; cada opción dice su
 * unidad, porque de ella depende qué se le cuenta.
 */
function SelectorDeTipoDeMuro({
  valor,
  tipos,
  alCambiar,
}: {
  valor: string | null;
  tipos: TipoDeMuro[];
  alCambiar: (nuevo: string | null) => void;
}) {
  const orden = (rubro: string) => {
    const i = RUBROS_DE_MURO.findIndex((r) => r.toLowerCase() === rubro.toLowerCase());
    return i === -1 ? RUBROS_DE_MURO.length : i;
  };
  const rubros = Array.from(new Set(tipos.map((t) => t.rubro))).sort(
    (a, b) => orden(a) - orden(b) || a.localeCompare(b, "es")
  );

  return (
    <select
      value={valor ?? ""}
      onChange={(e) => alCambiar(e.target.value === "" ? null : e.target.value)}
      style={ui.input}
    >
      <option value="">Sin tipo</option>
      {/* Un tipo que ya no está en el catálogo igual se muestra: si no, el
          desplegable diría "Sin tipo" con el muro teniendo uno. */}
      {valor !== null && !tipos.some((t) => t.id === valor) && (
        <option value={valor}>Tarea que ya no está en el catálogo</option>
      )}
      {rubros.map((rubro) => (
        <optgroup key={rubro} label={rubro}>
          {tipos
            .filter((t) => t.rubro === rubro)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} ({t.unidad})
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

function SelectorReferencia({
  valor,
  alCambiar,
}: {
  valor: Referencia;
  alCambiar: (nueva: Referencia) => void;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => alCambiar(e.target.value as Referencia)}
      style={ui.input}
    >
      {REFERENCIAS.map((r) => (
        <option key={r.valor} value={r.valor}>
          {r.nombre}
        </option>
      ))}
    </select>
  );
}

function SelectorEspesor({
  valor,
  alCambiar,
}: {
  valor: number;
  alCambiar: (nuevo: number) => void;
}) {
  // Un espesor que no está en la lista (vino de otro lado) igual se muestra.
  const opciones = ESPESORES.includes(valor) ? ESPESORES : [...ESPESORES, valor].sort((a, b) => a - b);

  return (
    <select
      value={valor}
      onChange={(e) => alCambiar(Number(e.target.value))}
      style={ui.input}
    >
      {opciones.map((e) => (
        <option key={e} value={e}>
          {formatEspesor(e)}
        </option>
      ))}
    </select>
  );
}

/**
 * Un campo de metros que se escribe de a poco.
 *
 * Guarda el texto aparte del número: mientras se tipea "0," todavía no hay
 * una medida, y si el campo mostrara el número guardado borraría lo escrito.
 * Avisa sólo cuando lo escrito ya es una medida. Y si el número cambia por
 * afuera —deshacer, o la abertura tomó las medidas de otro tipo— lo sigue.
 */
function CampoMetros({
  valor,
  alCambiar,
  desdeCero = false,
  vacio,
  alVaciar,
}: {
  /** Null: todavía no se cargó, y el campo arranca vacío. */
  valor: number | null;
  alCambiar: (nuevo: number) => void;
  /** Un antepecho puede ser cero; un ancho no. */
  desdeCero?: boolean;
  /** Lo que se lee en el campo cuando no tiene valor. */
  vacio?: string;
  /** Si borrar el campo significa algo: la altura de un muro vuelve a ser la
   *  de la planta. Sin esto, vaciarlo deja el valor que tenía. */
  alVaciar?: () => void;
}) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor));
  const [visto, setVisto] = useState(valor);

  if (visto !== valor) {
    setVisto(valor);
    if (valor === null) setTexto("");
    else if (texto === "" || Number(texto) !== valor) setTexto(String(valor));
  }

  return (
    <input
      type="number"
      min={desdeCero ? "0" : "0.01"}
      step="0.01"
      value={texto}
      placeholder={vacio}
      onChange={(e) => {
        setTexto(e.target.value);
        // Vacío no es cero: borrar el campo no puede dejar un antepecho en 0.
        if (e.target.value === "") {
          alVaciar?.();
          return;
        }
        const n = Number(e.target.value);
        if (desdeCero ? n >= 0 : n > 0) alCambiar(n);
      }}
      style={ui.input}
    />
  );
}

/**
 * La mano de una puerta, con su regla al lado.
 *
 * La ayuda va siempre: "derecha" sola no dice nada, porque hay dos
 * costumbres para nombrarla —empujando o tirando— y dan lo contrario.
 */
function CampoMano({
  valor,
  alCambiar,
}: {
  valor: Mano;
  alCambiar: (nueva: Mano) => void;
}) {
  return (
    <label style={campo}>
      <span style={rotulo}>Mano</span>
      <select
        value={valor}
        onChange={(e) => alCambiar(e.target.value as Mano)}
        style={ui.input}
      >
        <option value="derecha">Derecha</option>
        <option value="izquierda">Izquierda</option>
      </select>
      <span style={nota}>De frente y empujando: el lado de las bisagras.</span>
    </label>
  );
}

/**
 * Cómo abre una ventana y en cuántas hojas.
 *
 * Las dos pueden venir en null —una ventana guardada antes de que existieran—
 * y entonces el desplegable arranca en "Sin cargar", que no se puede volver a
 * elegir: una vez dicho cómo abre, no hay por qué desdecirlo.
 */
function CamposDeApertura({
  apertura,
  hojas,
  alCambiar,
}: {
  apertura: Apertura | null;
  hojas: number | null;
  alCambiar: (cambios: { apertura: Apertura } | { hojas: number }) => void;
}) {
  return (
    <div style={dosCampos}>
      <label style={campo}>
        <span style={rotulo}>Apertura</span>
        <select
          value={apertura ?? ""}
          onChange={(e) => alCambiar({ apertura: e.target.value as Apertura })}
          style={ui.input}
        >
          {apertura === null && (
            <option value="" disabled>
              Sin cargar
            </option>
          )}
          {APERTURAS.map((a) => (
            <option key={a.valor} value={a.valor}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>
      <label style={campo}>
        <span style={rotulo}>Hojas</span>
        <select
          value={hojas ?? ""}
          onChange={(e) => alCambiar({ hojas: Number(e.target.value) })}
          style={ui.input}
        >
          {hojas === null && (
            <option value="" disabled>
              Sin cargar
            </option>
          )}
          {Array.from({ length: Math.max(HOJAS_MAXIMO, hojas ?? 0) }, (_, i) => i + 1).map(
            (n) => (
              <option key={n} value={n}>
                {n}
              </option>
            )
          )}
        </select>
      </label>
    </div>
  );
}

/**
 * Un nivel que puede no estar cargado y puede ser negativo: de dónde arranca
 * una columna. Vacío es "lo que le toca", que se lee en el campo.
 *
 * Como `CampoMetros`, guarda el texto aparte del número: mientras se escribe
 * "-" todavía no hay un nivel.
 */
function CampoNivel({
  valor,
  vacio,
  alCambiar,
  etiqueta,
  quieto = false,
}: {
  valor: number | null;
  /** Lo que se lee en el campo cuando no tiene valor. */
  vacio?: string;
  alCambiar: (nuevo: number | null) => void;
  /** Cómo se llama, para quien no ve el dibujo de al lado. */
  etiqueta?: string;
  /** Si no se puede escribir: falta de dónde medirlo. */
  quieto?: boolean;
}) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor));
  const [visto, setVisto] = useState(valor);

  if (visto !== valor) {
    setVisto(valor);
    if (valor === null) setTexto("");
    else if (texto === "" || Number(texto) !== valor) setTexto(String(valor));
  }

  return (
    <input
      type="number"
      step="0.01"
      aria-label={etiqueta}
      disabled={quieto}
      value={texto}
      placeholder={vacio}
      onChange={(e) => {
        setTexto(e.target.value);
        if (e.target.value === "") {
          alCambiar(null);
          return;
        }
        const n = Number(e.target.value);
        if (Number.isFinite(n)) alCambiar(n);
      }}
      style={quieto ? campoQuieto : ui.input}
    />
  );
}

/**
 * De dónde a dónde va una columna, como en un programa de arquitectura: la
 * columna dibujada entre los dos pisos y, al lado, cuánto se separa del piso
 * terminado de arriba, cuánto del de la planta, y en el medio la altura que
 * resulta —que no se escribe: sale de las otras dos—.
 *
 * Vacíos, los dos campos dicen lo que le toca sola: arranca en la losa de
 * abajo y llega al fondo de la de arriba. Sin pisos definidos no hay piso de
 * arriba desde el cual medir, y ese campo queda bloqueado.
 */
function AlturaDeColumna({
  arriba,
  desde,
  medida,
  pisoAPiso,
  alCambiar,
}: {
  arriba: number | null;
  desde: number | null;
  /** Lo que resulta, en metros sobre el piso terminado de la planta. */
  medida: { desde: number; hasta: number; alto: number } | null;
  /** A cuánto está el piso terminado de arriba, o null si no se sabe. */
  pisoAPiso: number | null;
  alCambiar: (cambios: { arriba?: number | null; desde?: number | null }) => void;
}) {
  return (
    <div style={alturaDeColumna}>
      <svg
        width="64"
        height="132"
        viewBox="0 0 64 132"
        fill="none"
        stroke="#9ca3af"
        strokeWidth="1.2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* El piso de arriba y el de la planta, en perspectiva. */}
        <path d="M4 22l14-10h34l-14 10z" fill="#f3f4f6" />
        <path d="M4 118l14-10h34l-14 10z" fill="#f3f4f6" />
        {/* La columna, que no llega al de arriba. */}
        <path d="M20 112V36l8-6h8v76l-8 6z" fill="#ffffff" stroke="#374151" />
        <path d="M20 36h8l8-6M28 36v76" stroke="#374151" />
        {/* Las tres cotas: arriba, la altura, abajo. */}
        <path d="M46 17h14M46 33h14M46 113h14" />
        <path d="M56 17v16M56 33v80" stroke="#374151" />
      </svg>

      <div style={camposDeAltura}>
        <label style={campo}>
          <span style={rotulo}>Del piso de arriba</span>
          <CampoNivel
            etiqueta="Separación del piso terminado de arriba"
            valor={arriba}
            quieto={pisoAPiso === null}
            vacio={
              pisoAPiso === null
                ? "faltan los pisos"
                : medida
                  ? formatNivel(medida.hasta - pisoAPiso)
                  : undefined
            }
            alCambiar={(nuevo) => alCambiar({ arriba: nuevo })}
          />
        </label>
        <label style={campo}>
          <span style={rotulo}>Altura</span>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            aria-label="Altura de la columna"
            value={medida ? formatMedida(medida.alto) : ""}
            style={campoQuieto}
          />
        </label>
        <label style={campo}>
          <span style={rotulo}>Del piso de la planta</span>
          <CampoNivel
            etiqueta="Separación del piso terminado de la planta"
            valor={desde}
            vacio={medida ? formatNivel(medida.desde) : undefined}
            alCambiar={(nuevo) => alCambiar({ desde: nuevo })}
          />
        </label>
      </div>
    </div>
  );
}

/**
 * De qué es una columna, y si es metálica, qué perfil. El perfil es texto
 * libre: no hay un catálogo de perfiles, y lo que importa es que en Medidas
 * salgan juntas las que son del mismo.
 */
function CamposDeMaterial({
  material,
  perfil,
  alCambiar,
}: {
  material: Material;
  perfil: string;
  alCambiar: (cambios: { material?: Material; perfil?: string }) => void;
}) {
  return (
    <>
      <label style={campo}>
        <span style={rotulo}>Material</span>
        <select
          value={material}
          onChange={(e) => alCambiar({ material: e.target.value as Material })}
          style={ui.input}
        >
          {MATERIALES.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.nombre}
            </option>
          ))}
        </select>
      </label>
      {material === "metalica" && (
        <label style={campo}>
          <span style={rotulo}>Perfil</span>
          <input
            type="text"
            value={perfil}
            placeholder="IPN 200, tubo 100×100×4…"
            onChange={(e) => alCambiar({ perfil: e.target.value })}
            style={ui.input}
          />
        </label>
      )}
    </>
  );
}

/**
 * El giro de una columna, en grados, con el atajo de todos los días: un
 * cuarto de vuelta. Positivo es en el sentido de las agujas del reloj.
 *
 * Como `CampoMetros`, guarda el texto aparte del número: mientras se escribe
 * "-" todavía no hay un ángulo.
 */
function CampoGiro({
  valor,
  alCambiar,
}: {
  valor: number;
  alCambiar: (nuevo: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  const [visto, setVisto] = useState(valor);

  if (visto !== valor) {
    setVisto(valor);
    if (Number(texto) !== valor) setTexto(String(valor));
  }

  return (
    <span style={giroConBoton}>
      <input
        type="number"
        step="1"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) alCambiar(normalizarGiro(n));
        }}
        style={ui.input}
      />
      <button
        type="button"
        title="Girar un cuarto de vuelta"
        onClick={() => alCambiar(normalizarGiro(valor + 90))}
        style={botonDeGiro}
      >
        +90°
      </button>
    </span>
  );
}

/**
 * De dónde se agarra una columna: el centro o una de sus cuatro esquinas,
 * elegidos sobre el dibujo de la columna. Es el punto que se marca al ponerla
 * y el que queda quieto si después se le cambia la sección.
 */
function SelectorAncla({
  valor,
  alCambiar,
}: {
  valor: Ancla;
  alCambiar: (nueva: Ancla) => void;
}) {
  return (
    <div style={cajaDeAnclas}>
      {ANCLAS.map((a) => (
        <button
          key={a.valor}
          type="button"
          title={a.nombre}
          aria-label={a.nombre}
          aria-pressed={valor === a.valor}
          onClick={() => alCambiar(a.valor)}
          style={{
            ...puntoDeAnclaje,
            ...LUGAR_DE_ANCLA[a.valor],
            ...(valor === a.valor ? puntoDeAnclajeElegido : null),
          }}
        />
      ))}
    </div>
  );
}

/**
 * Un apartado de Medidas, plegado: su nombre y, si tiene uno que diga algo, su
 * total. Así la solapa entera es una lista corta —muros, ambientes,
 * aberturas, hormigón, cada uno con su número— y el detalle se abre sólo
 * donde hace falta, en vez de una tira que no entra en la ventana.
 */
function Grupo({
  titulo,
  total,
  children,
}: {
  titulo: string;
  total?: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div style={grupo}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        style={cabezaDeGrupo}
      >
        <span style={tituloDeGrupo}>
          <span aria-hidden="true" style={flechaDeGrupo}>
            {abierto ? "▾" : "▸"}
          </span>
          {titulo}
        </span>
        {total && <span style={valorRenglon}>{total}</span>}
      </button>
      {abierto && <div style={cuerpoDeGrupo}>{children}</div>}
    </div>
  );
}

function Renglon({
  nombre,
  fuerte = false,
  children,
}: {
  nombre: string;
  fuerte?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={fuerte ? renglonFuerte : renglon}>
      <span style={nombreRenglon}>{nombre}</span>
      <span style={valorRenglon}>{children}</span>
    </div>
  );
}

// ---- Cuentas ----------------------------------------------------------------

/** Los rubros donde está casi todo lo que puede ser un muro. */
const RUBROS_DE_MURO = ["Mamposterías y Tabiquerías", "Estructuras"];

/**
 * Cuánto hay de un tipo de muro, en la unidad en que se cotiza: m³ si su
 * tarea va por volumen, m² si no.
 */
function cantidadDeMuro(
  fila: { superficie: number; volumen: number },
  unidad: string | undefined
) {
  return unidad === "m³"
    ? `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(fila.volumen)} m³`
    : formatM2(fila.superficie);
}

/**
 * Las columnas iguales, juntas: misma sección y misma altura. En una planta
 * hay veinte de 20×20 y tres de 20×40, y en el cómputo importa eso y no
 * cuánto lleva cada una.
 *
 * Una metálica con el perfil cargado se junta y se nombra por su perfil —"IPN
 * 200"—, que es lo que se pide; sin perfil, por su sección, como las de
 * hormigón. De cada grupo salen los m³ y los metros: quien lo muestra elige.
 */
function gruposDeColumnas(
  columnas: Columna[],
  medidas: { id: string; desde: number; hasta: number; neto: number }[]
) {
  const grupos = new Map<
    string,
    { clave: string; nombre: string; alto: number; cantidad: number; neto: number; largo: number }
  >();
  for (const medida of medidas) {
    const columna = columnas.find((c) => c.id === medida.id);
    if (!columna) continue;
    const alto = medida.hasta - medida.desde;
    const nombre =
      columna.material === "metalica" && columna.perfil.trim() !== ""
        ? columna.perfil.trim()
        : formatSeccion(columna.ancho, columna.profundidad);
    const clave = `${nombre}|${alto.toFixed(3)}`;
    const g = grupos.get(clave) ?? { clave, nombre, alto, cantidad: 0, neto: 0, largo: 0 };
    g.cantidad += 1;
    g.neto += medida.neto;
    g.largo += alto;
    grupos.set(clave, g);
  }
  return Array.from(grupos.values());
}

/**
 * Las vigas metálicas, juntas por perfil, con cuántas son y cuántos metros
 * suman. Sin perfil cargado, por su sección.
 */
function perfilesDeVigas(vigas: Viga[], medidas: { id: string; largo: number }[]) {
  const grupos = new Map<string, { nombre: string; cantidad: number; largo: number }>();
  for (const medida of medidas) {
    const viga = vigas.find((v) => v.id === medida.id);
    if (!viga) continue;
    const nombre = nombreDeSeccion(viga);
    const g = grupos.get(nombre) ?? { nombre, cantidad: 0, largo: 0 };
    g.cantidad += 1;
    g.largo += medida.largo;
    grupos.set(nombre, g);
  }
  return Array.from(grupos.values());
}

/** Cómo se nombra la sección de una viga: su perfil si es metálica y lo tiene
 *  cargado, y si no sus medidas. */
function nombreDeSeccion(viga: Viga) {
  return viga.material === "metalica" && viga.perfil.trim() !== ""
    ? viga.perfil.trim()
    : formatSeccion(viga.ancho, viga.alto);
}

/** Varias medidas en una: la única que hay, o de la menor a la mayor. */
function rangoDeMetros(valores: number[]) {
  if (valores.length === 0) return "—";
  const menor = Math.min(...valores);
  const mayor = Math.max(...valores);
  return mayor - menor < 0.0005
    ? formatMetros(menor)
    : `${formatMetros(menor)} a ${formatMetros(mayor)}`;
}

/** Una sección de hormigón, en centímetros como se la nombra: "12×45". */
function formatSeccion(ancho: number, alto: number) {
  const cm = (metros: number) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(metros * 100);
  return `${cm(ancho)}×${cm(alto)}`;
}

/** Un polígono como lo pide el atributo `points` de SVG. */
function enPuntos(puntos: Punto[]) {
  return puntos.map((p) => `${p.x},${p.y}`).join(" ");
}

function medio(a: Punto, b: Punto): Punto {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * La línea de un tramo vista desde su punta fija: arranca ahí y sigue en
 * dirección a la otra hasta mucho más allá del plano. No pasa para atrás de la
 * punta fija: un tramo que se estira no se da vuelta.
 */
function ejeDesde(fija: Punto, movil: Punto): Eje | null {
  const largo = distancia(fija, movil);
  if (!(largo > 0)) return null;
  const cuanto = LEJOS / largo;
  return {
    a: fija,
    b: { x: fija.x + (movil.x - fija.x) * cuanto, y: fija.y + (movil.y - fija.y) * cuanto },
  };
}

/** Los lados de un polígono cerrado, de a uno. */
function ladosDe(puntos: Punto[]): { a: Punto; b: Punto }[] {
  return puntos.map((p, i) => ({ a: p, b: puntos[(i + 1) % puntos.length] }));
}

// Los rubros que van primero en el desplegable de capas, según qué se
// termina: los que tocan arriba y el resto del catálogo después.
const RUBROS_DE_PARED = ["Revoques", "Revestimientos", "Pintura", "Aislaciones"];
const RUBROS_DE_PISO = ["Contrapisos", "Pisos", "Aislaciones"];
const RUBROS_DE_CIELORRASO = ["Cielorrasos", "Pintura"];

/** Las capas de una cara en una línea, cada una con su altura si no llega al
 *  techo: es lo que no se deduce mirando el nombre. */
function detalleDeCapas(cara: CaraMedida, nombres: Map<string, string>) {
  if (cara.capas.length === 0) return "sin terminación";
  return cara.capas
    .map(
      (capa) =>
        (nombres.get(capa.tarea) ?? "?") +
        (capa.alto < cara.alto - 1e-9 ? ` hasta ${formatMedida(capa.alto)}` : "")
    )
    .join(" + ");
}

/** Dos listas de capas son la misma si tienen las mismas tareas, en el mismo
 *  orden, hasta la misma altura y del mismo espesor. */
function firmaDeCapas(capas: Capa[]) {
  return capas.map((capa) => `${capa.tarea}@${capa.hasta}@${capa.espesor}`).join("|");
}

/** Las capas en una línea: "Revoque + Porcelanato", o que no hay ninguna. */
function resumenDeCapas(capas: Capa[], nombres: Map<string, string>) {
  return capas.length === 0
    ? "ninguna"
    : capas.map((capa) => nombres.get(capa.tarea) ?? "?").join(" + ");
}

/** Sólo lo que es de la capa: las que vienen de una cara medida traen además
 *  cuánto miden ahí, que no se guarda. */
function soloLaCapa({ tarea, hasta, espesor }: Capa): Capa {
  return { tarea, hasta, espesor };
}

/** Junta por tarea: la misma en la pared y en el piso es una sola cantidad. */
function porTarea(filas: { capa: string; superficie: number; volumen: number }[]) {
  const sumas = new Map<string, { superficie: number; volumen: number }>();
  for (const { capa, superficie, volumen } of filas) {
    const ya = sumas.get(capa) ?? { superficie: 0, volumen: 0 };
    sumas.set(capa, { superficie: ya.superficie + superficie, volumen: ya.volumen + volumen });
  }
  return Array.from(sumas, ([capa, suma]) => ({ capa, ...suma }));
}

/** Un espesor de capa, en centímetros: "1,5 cm". */
function formatCm(metros: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(metros * 100)} cm`;
}

/**
 * El color de una capa: siempre el mismo para la misma tarea, así el
 * porcelanato es rojo en el plano, en la ficha y en las medidas.
 */
function colorDeCapa(id: string) {
  let suma = 0;
  for (const letra of id) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return PALETA_DE_CAPAS[suma % PALETA_DE_CAPAS.length];
}

/** Junta los tramos que son la misma cara: la misma clave. */
function juntarCaras<
  T extends { clave: string; largo: number; superficie: number; partes: ParteDeCara[] },
>(caras: T[]): T[] {
  const juntas = new Map<string, T>();
  for (const cara of caras) {
    const ya = juntas.get(cara.clave);
    juntas.set(
      cara.clave,
      ya
        ? {
            ...ya,
            largo: ya.largo + cara.largo,
            superficie: ya.superficie + cara.superficie,
            partes: [...ya.partes, ...cara.partes],
          }
        : cara
    );
  }
  return Array.from(juntas.values());
}

/**
 * De qué está hecha una cara que tiene aberturas: cuánto de paño de piso a
 * techo, y cada dintel y cada antepecho con sus medidas. Es la cuenta de su
 * superficie, escrita para poder revisarla.
 */
function desgloseDePartes(partes: ParteDeCara[]): string {
  const renglones: string[] = [];

  const panos = partes.filter((p) => p.tipo === "pano");
  if (panos.length > 0) {
    const ancho = panos.reduce((t, p) => t + p.ancho, 0);
    renglones.push(`${formatMedida(ancho)} m de paño × ${formatMedida(panos[0].alto)}`);
  }
  for (const p of partes) {
    if (p.tipo === "pano") continue;
    renglones.push(
      `${p.tipo} de ${p.abertura || "la abertura"} ${formatMedida(p.ancho)} × ${formatMedida(p.alto)}`
    );
  }

  return renglones.join(" · ");
}

/** Un espesor se dice en centímetros: "15 cm", no "0,15 m". */
function formatEspesor(metros: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(metros * 100)} cm`;
}

/** Una medida de carpintería: "0,80", siempre con dos decimales. */
function formatMedida(metros: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(metros);
}

function aMolde(inicial: {
  nombre: string;
  ancho: number;
  alto: number;
  antepecho: number | null;
  apertura: Apertura | null;
  hojas: number | null;
}): Molde {
  return {
    nombre: inicial.nombre,
    ancho: String(inicial.ancho),
    alto: String(inicial.alto),
    antepecho: inicial.antepecho === null ? "" : String(inicial.antepecho),
    mano: "derecha",
    // Sólo cuentan en la ventana; en la puerta van para completar el molde.
    apertura: inicial.apertura ?? "corrediza",
    hojas: inicial.hojas ?? 2,
  };
}

/** El muro más cercano a un punto, si hay alguno a mano. */
function muroCercano(p: Punto, muros: Muro[], alcance: number): Muro | null {
  let mejor: Muro | null = null;
  let menor = alcance;
  for (const muro of muros) {
    const d = distancia(p, proyectar(p, muro.a, muro.b));
    if (d <= menor) {
      menor = d;
      mejor = muro;
    }
  }
  return mejor;
}

/**
 * A qué altura del muro queda una abertura que se quiere poner en `p`.
 *
 * Devuelve la fracción del largo donde va su centro, corrida lo necesario
 * para que la abertura entre entera: una puerta no puede asomar por la punta
 * del muro. Si es más ancha que el muro, va al medio.
 */
function posicionEnMuro(p: Punto, muro: Muro, ancho: number, mpp: number | null): number {
  const dx = muro.b.x - muro.a.x;
  const dy = muro.b.y - muro.a.y;
  const largo2 = dx * dx + dy * dy;
  if (largo2 === 0) return 0.5;

  const t = ((p.x - muro.a.x) * dx + (p.y - muro.a.y) * dy) / largo2;
  // Sin escala no se sabe cuánto ocupa: sólo se la deja adentro del muro.
  const medio = mpp !== null ? ancho / mpp / 2 / Math.sqrt(largo2) : 0;
  if (medio >= 0.5) return 0.5;
  return Math.min(1 - medio, Math.max(medio, t));
}

/**
 * El rectángulo de una abertura sobre su muro: de su ancho a lo largo y un
 * poco más que el espesor a lo ancho, para que tape el trazo del muro.
 */
function formaDeAbertura(
  muro: Muro,
  t: number,
  ancho: number,
  mpp: number | null,
  u: number
) {
  const largo = distancia(muro.a, muro.b) || 1;
  const dx = (muro.b.x - muro.a.x) / largo;
  const dy = (muro.b.y - muro.a.y) / largo;
  // Sin escala no se puede dibujar a medida: un tamaño fijo en pantalla.
  const medio = mpp !== null ? ancho / mpp / 2 : 14 * u;
  const medioGrosor = (mpp !== null ? Math.max(muro.espesor / mpp, 3 * u) : 5 * u) / 2 + 2 * u;
  const centro = {
    x: muro.a.x + (muro.b.x - muro.a.x) * t,
    y: muro.a.y + (muro.b.y - muro.a.y) * t,
  };
  const en = (alLargo: number, alAncho: number): Punto => ({
    x: centro.x + dx * alLargo - dy * alAncho,
    y: centro.y + dy * alLargo + dx * alAncho,
  });

  return {
    a: en(-medio, 0),
    b: en(medio, 0),
    medio,
    en,
    medioGrosor,
    puntos: [
      en(-medio, -medioGrosor),
      en(medio, -medioGrosor),
      en(medio, medioGrosor),
      en(-medio, medioGrosor),
    ]
      .map((p) => `${p.x},${p.y}`)
      .join(" "),
  };
}

/**
 * De qué lado del muro quedó un punto: 1 o -1 sobre su normal. Es hacia donde
 * abre la puerta que se coloca con ese clic.
 */
function ladoDe(p: Punto, muro: Muro): 1 | -1 {
  const dx = muro.b.x - muro.a.x;
  const dy = muro.b.y - muro.a.y;
  // El mismo sentido que usa `formaDeAbertura` para "a lo ancho".
  return (p.x - muro.a.x) * -dy + (p.y - muro.a.y) * dx < 0 ? -1 : 1;
}

/**
 * La hoja de una puerta abierta a 90° y el arco que barre, como se dibuja en
 * un plano.
 *
 * La mano se mira **de frente y empujando**: quien empuja está del lado
 * contrario a donde abre, y las bisagras le quedan a la derecha o a la
 * izquierda. De ahí sale en qué jamba va la bisagra; la hoja sale de ella,
 * perpendicular al muro, hacia el lado donde abre.
 */
function barridoDePuerta(
  forma: ReturnType<typeof formaDeAbertura>,
  mano: Mano,
  lado: 1 | -1
): string {
  const { medio, en } = forma;
  // Mirando hacia donde abre, la derecha de quien empuja es el sentido
  // contrario al del muro si abre hacia su normal, y el mismo si no.
  // Un lado que no sea -1 se toma como 1: un dato viejo no puede romper el trazo.
  const haciaDonde = lado === -1 ? -1 : 1;
  const sentido = (mano === "derecha" ? 1 : -1) * -haciaDonde;
  const bisagra = en(sentido * medio, 0);
  const hoja = en(sentido * medio, haciaDonde * 2 * medio);
  const jamba = en(-sentido * medio, 0);
  // Para que el arco vaya por el cuarto de vuelta corto, de la hoja a la jamba.
  const giro =
    (hoja.x - bisagra.x) * (jamba.y - bisagra.y) - (hoja.y - bisagra.y) * (jamba.x - bisagra.x);

  return (
    `M ${bisagra.x} ${bisagra.y} L ${hoja.x} ${hoja.y} ` +
    `A ${2 * medio} ${2 * medio} 0 0 ${giro > 0 ? 1 : 0} ${jamba.x} ${jamba.y}`
  );
}

/**
 * Lo que aclara a una ventana debajo de su renglón: cómo abre, en cuántas
 * hojas y a qué altura. Lo que no se cargó se dice, no se saltea: una planilla
 * que calla el dato parece completa.
 */
function detalleDeVentana(g: {
  apertura: Apertura | null;
  hojas: number | null;
  antepecho: number | null;
}): string {
  const partes: string[] = [];

  partes.push(g.apertura === null ? "apertura sin cargar" : nombreDeApertura(g.apertura));
  if (g.hojas !== null) {
    // Un paño fijo no tiene hojas: tiene paños.
    const unidad = g.apertura === "fijo" ? "paño" : "hoja";
    partes.push(`${g.hojas} ${unidad}${g.hojas === 1 ? "" : "s"}`);
  }
  partes.push(
    g.antepecho === null
      ? "antepecho sin cargar"
      : g.antepecho === 0
        ? "al piso"
        : `antepecho ${formatMetros(g.antepecho)}`
  );

  return partes.join(" · ");
}

/** La vista que muestra el plano entero, centrado y con un poco de aire. */
function encuadrar(
  tamano: { w: number; h: number },
  imagen: { ancho: number; alto: number }
): Vista {
  const k = Math.min(tamano.w / imagen.ancho, tamano.h / imagen.alto) * 0.96 || 1;
  return {
    k,
    x: (imagen.ancho - tamano.w / k) / 2,
    y: (imagen.alto - tamano.h / k) / 2,
  };
}

function pistaDe(
  herramienta: Herramienta,
  modo: Modo,
  puntos: number,
  reglaMarcada: boolean,
  copiado: boolean
) {
  switch (herramienta) {
    case "copiar":
      return copiado
        ? "Clic en cada muro, cara o ambiente que lleva lo mismo. Esc para tomar otra cosa."
        : "Clic en un muro para tomar su tipo, o en una cara o adentro de un ambiente para tomar su terminación.";
    case "seleccionar":
      return modo === "estructura"
        ? "Clic en una columna, una viga o una losa para verla y moverla. La punta de una viga se estira derecha; lejos de su línea, gira. Doble clic en un lado de una losa le suma un punto. Supr borra."
        : "Clic en algo para verlo y moverlo. La punta de un muro se estira derecha; lejos de su línea, gira. Doble clic parte un muro o suma un punto a un ambiente. Supr borra.";
    case "columna":
      return "Clic donde va la columna: se pega a las esquinas y las caras de los muros por el punto del que se agarra.";
    case "viga":
      return puntos === 0
        ? "Clic donde empieza la viga."
        : "Clic donde termina: la siguiente arranca ahí. Doble clic o Esc para cortar.";
    case "losa":
      return puntos < 3
        ? "Clic en cada esquina de la losa."
        : "Para cerrarla, clic en la primera esquina o Enter.";
    case "mover":
      return "Arrastrá para mover el plano. La rueda acerca y aleja en cualquier herramienta.";
    case "escala":
      if (reglaMarcada) return "Escribí a la derecha cuántos metros hay entre los dos puntos.";
      return puntos === 0
        ? "Clic en un extremo de la regla o de una cota conocida del plano."
        : "Clic en el otro extremo.";
    case "muro":
      return puntos === 0
        ? "Clic donde empieza el muro, por su eje."
        : "Clic donde termina: el siguiente arranca ahí. Doble clic o Esc para cortar.";
    case "ambiente":
      return puntos < 3
        ? "Clic en cada esquina del ambiente."
        : "Para cerrarlo, clic en la primera esquina o Enter.";
    case "medir":
      return puntos === 0
        ? "Clic en dos puntos para ver cuánto hay entre ellos. No se guarda."
        : "Clic en el otro punto. Sin la escuadra se puede medir en diagonal.";
    case "abertura":
      return "Clic sobre un muro, del lado hacia donde abre. Con Seleccionar se desliza a lo largo del muro.";
  }
}

// ---- Estilos ----------------------------------------------------------------

const ACENTO = "#e8590c";
const AZUL = "#1d4ed8";
/** El color de lo que se mide y no queda: distinto de todo lo que se guarda. */
const VIOLETA = "#7c3aed";
/** El de las guías: finito y frío, para que no se confunda con el trazo. */
const CELESTE = "#0891b2";
/** El del hormigón: toda la estructura va de un color que no usa nada más. */
const HORMIGON = "#3730a3";
/** El de lo metálico: un gris acero, para no confundirlo con el hormigón. */
const ACERO = "#475569";
const MODOS: { valor: Modo; nombre: string }[] = [
  { valor: "arquitectura", nombre: "Arquitectura" },
  { valor: "estructura", nombre: "Estructura" },
];
const COLOR_ABERTURA: Record<TipoAbertura, string> = {
  puerta: "#b45309",
  ventana: "#0e7490",
};
const NOMBRE_TIPO: Record<TipoAbertura, string> = { puerta: "Puerta", ventana: "Ventana" };
const MANO_CORTA: Record<Mano, string> = { derecha: "der.", izquierda: "izq." };
/**
 * Las cuatro esquinas de una abertura: de qué jamba (a lo largo del muro) y
 * de qué cara (a lo ancho).
 */
const ESQUINAS_DE_ABERTURA: [1 | -1, 1 | -1][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
/** A cuántos píxeles de pantalla de un muro se puede soltar una abertura. */
const ALCANCE_ABERTURA = 24;
const PALETA_DE_CAPAS = [
  "#dc2626",
  "#16a34a",
  "#2563eb",
  "#d97706",
  "#9333ea",
  "#0891b2",
  "#be185d",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
];
const COLORES = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2"];

/**
 * La mesa de trabajo: la barra arriba y, debajo, las herramientas, el plano y
 * el panel. **Mide el alto de la ventana** (menos el margen de `AppShell` en
 * pantalla completa): todo se ve a la vez y la página no se corre. Lo único
 * que puede tener barra propia es el contenido del panel, cuando una ficha es
 * más larga que la ventana.
 */
const marco = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "12px",
  height: "calc(100vh - 32px)",
  minHeight: "520px",
  minWidth: 0,
};

const barra = {
  flex: "0 0 auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  minWidth: 0,
};

const ladoDeBarra = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: 0,
};

const volverEnBarra = {
  flex: "0 0 auto",
  color: "#555555",
  fontSize: "14px",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
};

/** Los niveles de la planta: una pastilla, al lado del modo. */
const botonDeNiveles = {
  flex: "0 0 auto",
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  borderRadius: "999px",
  padding: "8px 12px",
  fontSize: "13px",
  fontVariantNumeric: "tabular-nums" as const,
  whiteSpace: "nowrap" as const,
  cursor: "pointer",
};

/** Sin definir: en el color de lo que falta hacer. */
const botonDeNivelesPendiente = {
  ...botonDeNiveles,
  color: ACENTO,
  border: `1px solid ${ACENTO}`,
};

/** Un campo que muestra un dato que sale de otro lado y no se escribe. */
const campoQuieto = {
  ...ui.input,
  background: "#f5f5f5",
  color: "#777777",
};

/** El nombre de la planta, al lado del modo: dice en qué plano se está sin
 *  ocupar un renglón. Si no entra, se corta él y no los botones. */
const nombreEnBarra = {
  minWidth: 0,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
  whiteSpace: "nowrap" as const,
  fontSize: "15px",
  fontWeight: 600,
  color: "#111111",
};

const cuerpo = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "grid",
  // El panel tiene ancho fijo y el plano se queda con lo que sobra: en una
  // ventana angosta se achica el plano, no se corta el panel.
  gridTemplateColumns: "auto minmax(0, 1fr) 320px",
  gap: "12px",
};

/** La tira de herramientas, a la izquierda del plano. */
const herramientas = {
  alignSelf: "start",
  display: "flex",
  flexDirection: "column" as const,
  gap: "4px",
  padding: "6px",
  background: "#ffffff",
  border: ui.BORDE,
  borderRadius: "14px",
  boxShadow: ui.SOMBRA,
};

const botonDeIcono = {
  display: "grid",
  placeItems: "center",
  width: "36px",
  height: "36px",
  padding: 0,
  background: "none",
  color: "#444444",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
};

const botonDeIconoActivo = {
  ...botonDeIcono,
  background: "#111111",
  color: "#ffffff",
};

/** Deshacer y Encuadrar: íconos sueltos, del alto de Guardar. */
const botonDeBarra = {
  ...botonDeIcono,
  border: "1px solid #dcdcdc",
  borderRadius: "999px",
  background: "#ffffff",
};

const botonDeBarraQuieto = {
  ...botonDeBarra,
  color: "#c4c4c4",
  cursor: "default",
};

const botonHerramienta = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  borderRadius: "999px",
  padding: "8px 14px",
  fontSize: "13px",
  cursor: "pointer",
};

const botonHerramientaActivo = {
  ...botonHerramienta,
  background: "#111111",
  color: "#ffffff",
  border: "1px solid #111111",
};

const botonGuardar = {
  ...botonHerramientaActivo,
  fontWeight: 600,
};

/** Arquitectura o Estructura: dos mitades de un mismo botón, antes de las
 *  herramientas, porque es lo que decide cuáles hay. */
const selectorDeModo = {
  flex: "0 0 auto",
  display: "flex",
  border: `1px solid ${HORMIGON}`,
  borderRadius: "999px",
  overflow: "hidden" as const,
};

const botonDeModo = {
  background: "#ffffff",
  color: HORMIGON,
  border: "none",
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

const botonDeModoActivo = {
  ...botonDeModo,
  background: HORMIGON,
  color: "#ffffff",
};

/** El dibujo de la columna a la izquierda y sus tres medidas a la derecha. */
const alturaDeColumna = {
  display: "grid",
  gridTemplateColumns: "64px minmax(0, 1fr)",
  alignItems: "center",
  gap: "12px",
};

const camposDeAltura = {
  display: "grid",
  gap: "8px",
};

const giroConBoton = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "6px",
};

const botonDeGiro = {
  background: "#ffffff",
  color: "#111111",
  border: "1px solid #dcdcdc",
  borderRadius: "10px",
  padding: "0 8px",
  fontSize: "12px",
  cursor: "pointer",
};

/** La columna en chico, con sus cinco puntos de agarre encima. */
const cajaDeAnclas = {
  position: "relative" as const,
  width: "56px",
  height: "56px",
  margin: "8px",
  background: "#e0e7ff",
  border: `2px solid ${HORMIGON}`,
};

const puntoDeAnclaje = {
  position: "absolute" as const,
  width: "16px",
  height: "16px",
  padding: 0,
  borderRadius: "999px",
  background: "#ffffff",
  border: `2px solid ${HORMIGON}`,
  cursor: "pointer",
  transform: "translate(-50%, -50%)",
};

const puntoDeAnclajeElegido = {
  background: ACENTO,
  border: `2px solid ${ACENTO}`,
};

const LUGAR_DE_ANCLA: Record<Ancla, { left: string; top: string }> = {
  si: { left: "0%", top: "0%" },
  sd: { left: "100%", top: "0%" },
  centro: { left: "50%", top: "50%" },
  ii: { left: "0%", top: "100%" },
  id: { left: "100%", top: "100%" },
};

const botonGuardarQuieto = {
  ...botonHerramienta,
  color: "#999999",
  cursor: "default",
};

const cajaLienzo = {
  position: "relative" as const,
  minWidth: 0,
  minHeight: 0,
  border: ui.BORDE,
  borderRadius: "14px",
  background: "#f4f4f4",
  overflow: "hidden" as const,
  outline: "none",
};

/** Lo que flota sobre el plano: una pastilla blanca, que se lee encima de
 *  cualquier dibujo. */
const flotante = {
  position: "absolute" as const,
  background: "rgba(255, 255, 255, 0.94)",
  border: ui.BORDE,
  borderRadius: "10px",
  boxShadow: ui.SOMBRA,
};

/** Qué hace la herramienta elegida. No recibe el puntero: debajo hay plano. */
const pista = {
  ...flotante,
  left: "10px",
  bottom: "10px",
  maxWidth: "calc(100% - 20px)",
  margin: 0,
  padding: "6px 10px",
  fontSize: "12px",
  lineHeight: 1.4,
  color: "#555555",
  pointerEvents: "none" as const,
};

const ayudas = {
  ...flotante,
  top: "10px",
  right: "10px",
  display: "flex",
  gap: "12px",
  padding: "6px 10px",
};

const ayuda = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "12px",
  color: "#333333",
  cursor: "pointer",
};

const panel = {
  display: "flex",
  flexDirection: "column" as const,
  minWidth: 0,
  minHeight: 0,
  background: "#ffffff",
  border: ui.BORDE,
  borderRadius: "14px",
  boxShadow: ui.SOMBRA,
  overflow: "hidden" as const,
};

const solapas = {
  flex: "0 0 auto",
  display: "flex",
  gap: "4px",
  padding: "8px",
  borderBottom: "1px solid #eeeeee",
};

const solapaQuieta = {
  flex: "1 1 0",
  background: "none",
  color: "#666666",
  border: "none",
  borderRadius: "999px",
  padding: "7px 6px",
  fontSize: "13px",
  cursor: "pointer",
};

const solapaActiva = {
  ...solapaQuieta,
  background: "#111111",
  color: "#ffffff",
  fontWeight: 600,
};

/** Lo de una solapa. Es lo único del editor que puede correrse: una ficha con
 *  muchas capas no entra en una ventana baja. */
const contenidoDeSolapa = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto" as const,
  display: "flex",
  flexDirection: "column" as const,
  gap: "20px",
  padding: "16px",
};

/** La solapa que no se está mirando: sigue montada, para no perder lo que se
 *  estaba escribiendo en sus campos, pero no se ve. */
const oculto = { display: "none" };

const bloque = {
  display: "grid",
  // Con `minmax(0, …)` y no la columna automática: un renglón con un nombre
  // largo estiraba la columna más allá del panel y empujaba la página entera.
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "10px",
};

const tituloBloque = {
  fontSize: "14px",
  fontWeight: 600,
  margin: 0,
};

const grupo = {
  borderTop: "1px solid #eeeeee",
};

const cabezaDeGrupo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  padding: "10px 0 0",
  background: "none",
  border: "none",
  fontFamily: "inherit",
  fontSize: "14px",
  color: "#111111",
  textAlign: "left" as const,
  cursor: "pointer",
};

const tituloDeGrupo = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0,
  fontWeight: 600,
};

const flechaDeGrupo = {
  flex: "0 0 auto",
  width: "12px",
  fontSize: "11px",
  color: "#888888",
};

const cuerpoDeGrupo = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "8px",
  padding: "10px 0 4px 18px",
};

const subtitulo = {
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#111111",
  fontWeight: 600,
  margin: "8px 0 0",
};

const campo = {
  display: "grid",
  gap: "6px",
  alignContent: "start" as const,
};

const dosCampos = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
};

const rotulo = {
  fontSize: "13px",
  color: "#555555",
};

const casilla = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  color: "#333333",
};

const nota = {
  fontSize: "13px",
  color: "#777777",
  lineHeight: 1.5,
  margin: 0,
};

/** La segunda línea de un renglón: un dato que lo aclara, sin número propio. */
const detalleRenglon = {
  fontSize: "12px",
  color: "#8a8a8a",
  margin: "2px 0 0",
};

/** Algo que no cierra y hay que mirar: en rojo, que es el color de lo que falta. */
const alerta = {
  fontSize: "13px",
  color: ui.ROJO,
  lineHeight: 1.5,
  margin: 0,
};

const renglon = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  fontSize: "14px",
  color: "#333333",
};

const renglonFuerte = {
  ...renglon,
  fontWeight: 600,
  color: "#111111",
  borderTop: "1px solid #eeeeee",
  paddingTop: "6px",
};

/** El nombre de un renglón. Si es largo baja a otra línea: cortado con puntos
 *  suspensivos, dos ladrillos distintos se leían igual. */
const nombreRenglon = {
  minWidth: 0,
  overflowWrap: "anywhere" as const,
};

const valorRenglon = {
  whiteSpace: "nowrap" as const,
  fontVariantNumeric: "tabular-nums" as const,
};

/** El cuadradito de color que acompaña el nombre de una capa. */
const muestra = {
  flex: "0 0 auto",
  width: "10px",
  height: "10px",
  borderRadius: "3px",
};

const nombreConMuestra = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
};

const botonQuitar = {
  flex: "0 0 auto",
  background: "none",
  border: "none",
  padding: "0 4px",
  color: "#999999",
  fontSize: "16px",
  lineHeight: 1,
  cursor: "pointer",
};

/** La altura de una capa, en un renglón chico debajo de su nombre. */
const alturaDeCapa = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) 84px",
  alignItems: "center",
  gap: "8px",
  paddingLeft: "18px",
};

/** El espesor de una capa: un campo chico con su unidad al lado. */
const espesorDeCapa = {
  display: "grid",
  gridTemplateColumns: "auto 72px auto",
  justifyContent: "start",
  alignItems: "center",
  gap: "8px",
  paddingLeft: "18px",
};

/** El volumen de una capa, debajo de sus m² y alineado con su nombre. */
const detalleDeCapa = {
  fontSize: "12px",
  color: "#8a8a8a",
  margin: "2px 0 0 18px",
  textAlign: "right" as const,
};

const selectChico = {
  ...ui.input,
  padding: "6px 8px",
  fontSize: "13px",
};

const botonDeCara = {
  display: "grid",
  gap: "2px",
  textAlign: "left" as const,
  background: "#ffffff",
  border: "1px solid #e5e5e5",
  borderRadius: "10px",
  padding: "8px 10px",
  cursor: "pointer",
};

const botonDeCaraElegida = {
  ...botonDeCara,
  border: "1px solid #111111",
  background: "#f5f5f5",
};

const tituloDeCara = {
  fontSize: "13px",
  color: "#111111",
};

const botonChico = {
  ...botonHerramienta,
  justifySelf: "start" as const,
};

const botonBorrar = {
  ...botonHerramienta,
  justifySelf: "start" as const,
  color: ui.ROJO,
};

const botonEliminar = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#999999",
  fontSize: "13px",
  textDecoration: "underline",
  cursor: "pointer",
};

const errorBox = {
  border: "1px solid #111111",
  padding: "14px",
  marginBottom: "12px",
  fontSize: "14px",
};
