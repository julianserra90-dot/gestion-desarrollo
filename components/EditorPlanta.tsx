"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import BotonConfirmar from "@/components/BotonConfirmar";
import { useConfirmacion } from "@/components/Confirmacion";
import DefinicionDePisos from "@/components/DefinicionDePisos";
import IconoHerramienta from "@/components/IconoHerramienta";
import TipoDeMuroEditor, { ListaDeCapas } from "@/components/TipoDeMuroEditor";
import { type CapaDeVista, useCapasDeVista } from "@/lib/capas-de-vista";
import {
  AlturaDeCapa,
  BotonIcono,
  CampoNumero,
  CorteDeMuro,
  Desplegable,
  Encabezado,
  Fila,
  Medidas,
  MiniPlanta,
  Pastilla,
  Pila,
  Seccion,
  Segmentado,
  SelectorDeTarea,
} from "@/components/PanelPropiedades";
import { tieneCapasDeAntes } from "@/lib/capas-al-dibujo";
import {
  type PiezaDeCapa,
  type PuntoEnCara,
  juntar,
  piezasDeCapas,
  proporcionAlLargo,
  trozosEnPlanta,
  puntoEnCara,
  tramosDeAmbiente,
  tramosDePolilinea,
} from "@/lib/planta-capas";
import {
  CAPA_NUEVA,
  conSusTipos,
  aMedioCentimetro,
  espesorTotal,
  ladoDeCara,
  type CapaDeMuro,
  medidasDelMuro,
  nombreLibre,
  SIN_REVESTIMIENTO,
  type Composicion,
  type TipoMuro,
} from "@/lib/tipos-de-muro";
import * as ui from "@/components/ui";
import {
  type VerticeDeBuna,
  anilloCorrido,
  anilloDeBuna,
  conLadoCambiado,
  contornoDeCielorraso,
  conPuntoMovido,
  ladosDeBuna,
  largoDeBuna,
} from "@/lib/planta-bunas";
import { formatM2, formatM3, formatMetros, formatNivel, formatNiveles } from "@/lib/format";
import { type Piso, nombreDePiso } from "@/lib/pisos";
import {
  type Abertura,
  type Ambiente,
  type Ancla,
  type Apertura,
  type Capa,
  type CapaDibujada,
  type Cajon,
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
  type TipoDeAbertura,
  type TramoDeCapa,
  type Viga,
  ABERTURA_INICIAL,
  ANCLAS,
  APERTURAS,
  COLUMNA_INICIAL,
  HOJAS_MAXIMO,
  LOSA_INICIAL,
  MATERIALES,
  REFERENCIAS,
  REFERENCIAS_DE_MURO,
  type ReferenciaDeMuro,
  ESPESORES,
  ESPESOR_INICIAL,
  TABIQUE_INICIAL,
  VIGA_INICIAL,
  areaDe,
  centroDe,
  conAcabado,
  distancia,
  medir,
  metrosPorPixel,
  nombreDeApertura,
  perimetroDe,
} from "@/lib/planta-dibujo";
import {
  type Guia,
  aberturasEnSuLugar,
  adentro,
  ajustar,
  carasDeCuerpo,
  crucesDeCaras,
  conOtraReferencia,
  cortesDeMuro,
  mamposteriaDeMuro,
  franjasEnPlanta,
  unirEnEsquina,
  cuerpoDeMuro,
  escuadrar,
  esquinasDeCuerpo,
  type Cara,
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
  huellaDeVigaUnida,
  enElCorte,
  medirEstructura,
  nivelesDeLosa,
  nombreQueSigue,
  prismasDeHormigon,
  normalizarGiro,
  puntoDeAncla,
} from "@/lib/planta-estructura";

type Herramienta =
  | "seleccionar"
  | "mover"
  | "escala"
  | "muro"
  | "ambiente"
  | "capa"
  | "cajon"
  | "abertura"
  | "medir"
  | "copiar"
  | "cortar"
  | "esquina"
  | "columna"
  | "viga"
  | "tabique"
  | "losa";

/**
 * Qué se está dibujando: la arquitectura —muros, ambientes, aberturas— o la
 * estructura de hormigón. Van sobre el mismo plano y con la misma escala; lo
 * que cambia es qué herramientas hay y qué se deja tocar. Lo del otro modo se
 * ve atenuado: la estructura se dibuja mirando los muros.
 */
type Modo = "arquitectura" | "estructura";

/**
 * Lo que se puede ocultar del plano mientras se dibuja: el PDF de fondo y cada
 * clase de cosa dibujada. Oculto no se toca.
 */
const CAPAS_DE_VISTA: { valor: CapaDeVista; nombre: string }[] = [
  { valor: "plano", nombre: "Plano de fondo" },
  { valor: "ambientes", nombre: "Ambientes" },
  { valor: "muros", nombre: "Muros" },
  { valor: "capas", nombre: "Capas" },
  { valor: "aberturas", nombre: "Aberturas" },
  { valor: "cajones", nombre: "Cajones" },
  { valor: "bunas", nombre: "Buñas" },
  { valor: "estructura", nombre: "Estructura" },
  { valor: "cotas", nombre: "Cotas" },
];

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
  // La buña se elige aparte del ambiente —su id es el del ambiente— porque su
  // anillo se edita encima del contorno: elegirla es decir cuál de los dos se
  // agarra.
  tipo: "muro" | "ambiente" | "abertura" | "columna" | "viga" | "losa" | "capa" | "cajon" | "buna";
  id: string;
  /** De una capa, el tramo que se tocó: es el que se puede quitar. */
  tramo?: number;
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
  // Un muro entero, por el punto del medio de su línea. `inicio` es dónde se
  // lo agarró: se corre lo que se movió el puntero desde ahí.
  | { tipo: "muroEntero"; id: string; inicio: Punto }
  | { tipo: "ambiente"; id: string; indice: number }
  // Un lado entero de un ambiente o de una losa: se corre en paralelo, como
  // una pared. Lleva el polígono de antes y dónde se agarró, para medir cuánto
  // se corrió.
  | {
      tipo: "lado";
      de: "ambiente" | "losa" | "cajon" | "cielorraso" | "buna";
      id: string;
      indice: number;
      inicio: Punto;
      puntos: Punto[];
      /** De una buña, lo que llevaba cada lado al agarrarla: el anillo se
       *  rehace desde el de entonces en cada movida. */
      lleva?: boolean[];
    }
  | { tipo: "losa"; id: string; indice: number }
  | { tipo: "cajon"; id: string; indice: number }
  // Una esquina del borde del cielorraso de un ambiente, o del anillo de su
  // buña. `id` es el del ambiente en los dos casos.
  | { tipo: "cielorraso"; id: string; indice: number }
  | { tipo: "buna"; id: string; indice: number }
  | { tipo: "viga"; id: string; punta: "a" | "b"; eje: Eje | null }
  // Una columna entera. `corrida` es cuánto hay de su punto marcado a donde se
  // la agarró: lo que se pega a las esquinas es ese punto, no el puntero.
  | { tipo: "columna"; id: string; corrida: Punto }
  | { tipo: "abertura"; id: string }
  // Una punta de un tramo de capa: se corre a lo largo de su cara.
  | { tipo: "puntaDeCapa"; capaId: string; tramo: number; fin: "desde" | "hasta"; cara: Cara }
  // Una esquina de una abertura: la abertura se desliza igual, pero la que se
  // pega a lo que haya cerca es esa esquina y no su centro. `alLargo` dice de
  // qué jamba es: la del lado del primer punto del muro (-1) o la otra (1).
  | { tipo: "esquina"; id: string; alLargo: 1 | -1 };

/**
 * La terminación que se tomó con Copiar, para ponérsela a otros. De una cara
 * son sus capas; de un ambiente, todo lo suyo: paredes, piso y cielorraso.
 */
type Copiado =
  | {
      de: "muro";
      tarea: string | null;
      tipo: string | null;
      espesor: number;
      revestimiento: Muro["revestimiento"];
      zocalo: Muro["zocalo"];
      altura: number | null;
      /** Las capas dibujadas del muro, por tramo: `entera` si cubre toda la cara. */
      capas: { capaId: string; cara: 1 | -1; desde: number; hasta: number; entera: boolean }[];
      /** El lado que da afuera —a ningún ambiente—, si hay uno solo. */
      afuera: 1 | -1 | null;
    }
  | {
      de: "abertura";
      tipo: TipoAbertura;
      nombre: string;
      ancho: number;
      alto: number;
      antepecho: number | null;
      apertura: Apertura | null;
      hojas: number | null;
      mano: Mano | null;
      marco: number | null;
    }
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
  /** El marco de una puerta, en metros; null: el del muro. */
  marco: number | null;
  /** Las tareas del cómputo que lleva el tipo. */
  tareas: string[];
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
    { valor: "capa", nombre: "Capa" },
    { valor: "cajon", nombre: "Cajón" },
    { valor: "abertura", nombre: "Abertura" },
    { valor: "medir", nombre: "Medir" },
    { valor: "copiar", nombre: "Copiar" },
    { valor: "cortar", nombre: "Cortar" },
    { valor: "esquina", nombre: "Esquina" },
  ],
  // Cada una se dibuja como su par de arquitectura: la columna se pone con un
  // toque, como una abertura; la viga se traza como un muro y la losa se
  // contornea como un ambiente.
  estructura: [
    { valor: "seleccionar", nombre: "Seleccionar" },
    { valor: "mover", nombre: "Mover" },
    { valor: "columna", nombre: "Columna" },
    { valor: "viga", nombre: "Viga" },
    { valor: "tabique", nombre: "Tabique" },
    { valor: "losa", nombre: "Losa" },
    { valor: "esquina", nombre: "Esquina" },
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
  tiposDeLaObra = [],
  tareasPorMetro = [],
  guardarTipo,
  eliminarTipo,
  pasarCapas,
  tiposDeAberturaDeLaObra = [],
  guardarTipoDeAberturaEnLaObra,
  tareasDelCatalogo = [],
}: {
  /** Todas las tareas del catálogo: las que puede llevar una abertura. */
  tareasDelCatalogo?: TareaDelCatalogo[];
  /** Los tipos de puerta y ventana de la obra, para todas sus plantas. */
  tiposDeAberturaDeLaObra?: TipoDeAbertura[];
  guardarTipoDeAberturaEnLaObra: (tipo: TipoDeAbertura) => Promise<{ error?: string }>;
  /** Pasa las capas de antes de toda la obra a capas dibujadas. */
  pasarCapas: () => Promise<{ error?: string }>;
  /** Los tipos de muro de la obra: cada uno una pila de capas. */
  tiposDeLaObra?: TipoMuro[];
  /** Las tareas que sirven de zócalo: las de metro lineal. */
  tareasPorMetro?: TipoDeMuro[];
  guardarTipo: (tipo: {
    id: string | null;
    nombre: string;
    composicion: Composicion;
  }) => Promise<{ error?: string; id?: string }>;
  eliminarTipo: (id: string) => Promise<{ error?: string }>;
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
  const { preguntar, dialogo: dialogoDeConfirmacion } = useConfirmacion();
  const { imagen } = planta;

  // Los muros, con lo de su tipo al día: el tipo pudo cambiar en otra planta.
  const [trazo, setTrazo] = useState<Trazo>(() => ({
    dibujo: {
      ...planta.dibujo,
      muros: conSusTipos(planta.dibujo.muros, new Map(tiposDeLaObra.map((t) => [t.id, t]))),
    },
    escala: planta.escala,
  }));
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
    tarea: string | null;
  }>(() => ({
    ...COLUMNA_INICIAL,
    nombre: "",
    ancla: "centro",
    giro: 0,
    material: "hormigon",
    perfil: "",
    tarea: tareaSugerida(tiposDeMuro, "columnas"),
  }));
  const [moldeDeViga, setMoldeDeViga] = useState<{
    nombre: string;
    ancho: number;
    alto: number;
    referencia: Referencia;
    material: Material;
    perfil: string;
    tarea: string | null;
  }>(() => ({
    ...VIGA_INICIAL,
    nombre: "",
    referencia: "centro",
    material: "hormigon",
    perfil: "",
    tarea: tareaSugerida(tiposDeMuro, "vigas"),
  }));
  /** El tabique se traza como una viga; va de losa a losa como una columna. */
  const [moldeDeTabique, setMoldeDeTabique] = useState<{
    nombre: string;
    ancho: number;
    referencia: Referencia;
    tarea: string | null;
  }>(() => ({
    nombre: "",
    ancho: TABIQUE_INICIAL.ancho,
    referencia: "centro",
    tarea: tareaSugerida(tiposDeMuro, "tabiques"),
  }));
  const [moldeDeLosa, setMoldeDeLosa] = useState(() => ({
    nombre: "",
    espesor: LOSA_INICIAL.espesor,
    tarea: tareaSugerida(tiposDeMuro, "losas"),
  }));
  const [vista, setVista] = useState<Vista | null>(null);
  const [tamano, setTamano] = useState<{ w: number; h: number } | null>(null);

  /** Los puntos de lo que se está dibujando y todavía no es nada. */
  const [enCurso, setEnCurso] = useState<Punto[]>([]);
  const [cursor, setCursor] = useState<{ punto: Punto; iman: boolean } | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);

  const [espesor, setEspesor] = useState(ESPESOR_INICIAL);
  const [referencia, setReferencia] = useState<ReferenciaDeMuro>("centro");
  /** De qué son los muros que se trazan: se elige una vez y vale para todos
   *  los que siguen, como el espesor. */
  const [tipoDeMuro, setTipoDeMuro] = useState<string | null>(null);
  /** Con la herramienta Esquina: el primer muro tocado, esperando el segundo. */
  const [primeroDeEsquina, setPrimeroDeEsquina] = useState<string | null>(null);
  const [avisoDeEsquina, setAvisoDeEsquina] = useState("");
  /** Con la herramienta Cortar: qué muro y dónde, y por dónde se lo puede cortar. */
  const [corte, setCorte] = useState<{
    muroId: string;
    t: number;
    posibles: number[];
    enganchado: boolean;
  } | null>(null);
  /** Los tipos de muro de la obra, como se están editando. */
  const [tipos, setTipos] = useState<TipoMuro[]>(tiposDeLaObra);
  /** Con qué tipo sale el próximo muro. */
  const [tipoMolde, setTipoMolde] = useState<string | null>(tiposDeLaObra[0]?.id ?? null);
  const [errorDeTipo, setErrorDeTipo] = useState("");
  /** El guardado de cada tipo, demorado: se guarda cuando se deja de tocar. */
  const guardadosPendientes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
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
  /** La punta de un muro que se tocó última: queda quieta al escribirle el largo. */
  const [puntaFija, setPuntaFija] = useState<{ id: string; punta: "a" | "b" } | null>(null);
  /** Contra qué quedó alineado el punto que se está marcando o moviendo. */
  const [guias, setGuias] = useState<Guia[]>([]);
  /** La terminación tomada con Copiar, mientras se la va poniendo. */
  const [copiado, setCopiado] = useState<Copiado | null>(null);
  /** La cara del muro elegido que se está terminando, por su clave. */
  const [caraElegida, setCaraElegida] = useState<string | null>(null);
  /** La cara del muro elegido que está bajo el puntero en la lista de Caras:
   *  se marca en la planta, para saber cuál es. */
  const [caraSenalada, setCaraSenalada] = useState<string | null>(null);
  /** Los tipos de abertura de la obra, como se están editando. */
  const [tiposDeObra, setTiposDeObra] = useState<TipoDeAbertura[]>(tiposDeAberturaDeLaObra);
  /** El guardado de cada tipo de abertura, demorado: cuando se deja de tocar. */
  const aberturasPendientes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Lo que está oculto del plano, y si está abierto el menú para elegirlo. */
  // Las mismas que en el 3D: lo que se oculta acá se oculta allá.
  const { ve, poner: ponerCapaDeVista, ocultasDe } = useCapasDeVista();
  const ocultas = ocultasDe(CAPAS_DE_VISTA.map((c) => c.valor));
  const [capasAbiertas, setCapasAbiertas] = useState(false);
  /** Con la herramienta Capa: si se marca a mano, tramo por tramo, o se
   *  elige un ambiente y va por todo su perímetro. */
  const [capaAMano, setCapaAMano] = useState(false);
  /** Con qué sale la próxima capa. */
  const [moldeDeCapa, setMoldeDeCapa] = useState<Omit<CapaDibujada, "id" | "tramos">>({
    tarea: null,
    espesor: 0.02,
    desde: 0,
    hasta: "techo",
  });
  /** Con qué sale el próximo cajón: su fondo —null: 20 cm bajo el techo— y sus capas. */
  const [moldeDeCajon, setMoldeDeCajon] = useState<{ fondo: number | null; capas: Capa[] }>({
    fondo: null,
    capas: [],
  });
  /** Los puntos de la capa que se marca a mano, cada uno sobre una cara. */
  const [puntosDeCapa, setPuntosDeCapa] = useState<PuntoEnCara[]>([]);
  /**
   * El modo cielorraso: todo lo demás del plano se transparenta y se deja de
   * poder tocar, así lo único que se mueve es el cielorraso del ambiente
   * elegido y su buña. Sin eso, el borde del cielorraso nace encima del
   * contorno del ambiente y no hay forma de saber cuál de los dos se agarra.
   */
  const [verCielorraso, setVerCielorraso] = useState(false);
  /** El muro desde cuyo corte se llegó a la capa elegida: para volver a él. */
  const [muroDeOrigen, setMuroDeOrigen] = useState<string | null>(null);
  /** Dónde está el puntero con la herramienta Capa: lo que saldría con un clic. */
  const [punteroDeCapa, setPunteroDeCapa] = useState<Punto | null>(null);

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
  const [pasandoCapas, iniciarPaseDeCapas] = useTransition();

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

  const { escala } = trazo;
  // Los muros con lo que suman sus capas dibujadas (`Muro.acabado`): sale de
  // las capas cada vez, y es lo que pone la cara terminada afuera de la última.
  const dibujo = useMemo(
    () => ({ ...trazo.dibujo, muros: conAcabado(trazo.dibujo.muros, trazo.dibujo.capas) }),
    [trazo.dibujo]
  );
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

  // Cada muro en corte: sus capas y su núcleo, recortados en las uniones.
  const franjas = useMemo(
    () => new Map(dibujo.muros.map((m) => [m.id, franjasEnPlanta(m, dibujo.muros, mpp)] as const)),
    [dibujo.muros, mpp]
  );

  // Las caras de los muros con sus m² y sus capas: lo que se termina.
  const alturaDePlanta = Number(altura) || 0;
  const mapaDeTipos = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);
  const terminaciones = useMemo(
    () => medirCaras(dibujo, mpp, alturaDePlanta, pisoAPiso, mapaDeTipos),
    [dibujo, mpp, alturaDePlanta, pisoAPiso, mapaDeTipos]
  );
  const nombreDeCapa = useMemo(
    () =>
      new Map(
        [...capasDisponibles, ...tiposDeMuro, ...tareasPorMetro].map((c) => [c.id, c.nombre])
      ),
    [capasDisponibles, tiposDeMuro, tareasPorMetro]
  );
  const tipoPorId = useMemo(() => new Map(tiposDeMuro.map((t) => [t.id, t])), [tiposDeMuro]);
  const tipoDelMolde = tipoMolde ? mapaDeTipos.get(tipoMolde) ?? null : null;
  /** Lo que puede ser una capa de un muro: lo de m² y lo de m³. */
  const tareasDeCapa = tiposDeMuro;
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
              ...estructura.vigas.map((v): [string, Punto[]] => [v.id, huellaDeVigaUnida(v, estructura.vigas, mpp)]),
            ]
      ),
    [estructura.columnas, estructura.vigas, mpp]
  );
  /** Entre qué alturas queda cada viga: dice cómo se la dibuja en planta. */
  const vigasMedidas = new Map((hormigon?.vigas ?? []).map((v) => [v.id, v]));
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
    if (puntosDeCapa.length > 0) {
      setPuntosDeCapa(puntosDeCapa.slice(0, -1));
      return;
    }
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
    // Las aberturas arrancan con las medidas de su tipo, si el nombre del
    // molde ya es uno de la planta.
    if (h === "abertura") {
      setMoldes((antes) => {
        const ahora = { ...antes };
        for (const tipo of ["puerta", "ventana"] as const) {
          const t = tiposDeAberturas.find((x) => x.tipo === tipo && x.nombre === antes[tipo].nombre.trim());
          if (!t) continue;
          ahora[tipo] = {
            ...antes[tipo],
            ancho: String(t.ancho),
            alto: String(t.alto),
            apertura: t.apertura ?? antes[tipo].apertura,
            hojas: t.hojas ?? antes[tipo].hojas,
            marco: t.marco,
          };
        }
        return ahora;
      });
    }
    // Una herramienta de dibujar muestra sus opciones, no lo que estaba elegido.
    if (h !== "seleccionar" && h !== "mover") setSeleccion(null);
    // Las que traen opciones —el espesor del muro, la sección de la viga— las
    // muestran en Propiedades.
    if (h !== "seleccionar" && h !== "mover" && h !== "ambiente") setSolapa("propiedades");
    setEnCurso([]);
    setPuntosDeCapa([]);
    setPunteroDeCapa(null);
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

  /** El mismo cambio en varias piezas de una clase, en un solo paso del historial. */
  const cambiarPiezas = <K extends ClaseDePieza>(
    clase: K,
    ids: string[],
    cambios: Partial<Estructura[K][number]>
  ) => {
    const cuales = new Set(ids);
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        estructura: {
          ...estructura,
          [clase]: (estructura[clase] as Estructura[K][number][]).map((p) =>
            cuales.has(p.id) ? { ...p, ...cambios } : p
          ),
        },
      },
    });
  };

  /**
   * Las piezas de hormigón sin tarea —dibujadas antes de que salieran con la
   * suya—, con la que les sugiere el catálogo por su clase: sin tarea no
   * pasan al cómputo ni se pueden marcar en el avance.
   */
  const sugeridas = {
    columnas: tareaSugerida(tiposDeMuro, "columnas"),
    vigas: tareaSugerida(tiposDeMuro, "vigas"),
    tabiques: tareaSugerida(tiposDeMuro, "tabiques"),
    losas: tareaSugerida(tiposDeMuro, "losas"),
  };
  const piezasSinTarea = {
    columnas: sugeridas.columnas
      ? estructura.columnas.filter((c) => c.material !== "metalica" && c.tarea === null)
      : [],
    vigas: estructura.vigas.filter(
      (v) => v.material !== "metalica" && v.tarea === null && (v.tabique ? sugeridas.tabiques : sugeridas.vigas)
    ),
    losas: sugeridas.losas ? estructura.losas.filter((l) => l.tarea === null) : [],
  };
  const cuantasSinTarea =
    piezasSinTarea.columnas.length + piezasSinTarea.vigas.length + piezasSinTarea.losas.length;
  const ponerTareasSugeridas = () => {
    const con = <T extends { id: string; tarea: string | null }>(
      lista: T[],
      sin: T[],
      tarea: (p: T) => string | null
    ) => {
      const ids = new Set(sin.map((p) => p.id));
      return lista.map((p) => (ids.has(p.id) ? { ...p, tarea: tarea(p) } : p));
    };
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        estructura: {
          ...estructura,
          columnas: con(estructura.columnas, piezasSinTarea.columnas, () => sugeridas.columnas),
          vigas: con(estructura.vigas, piezasSinTarea.vigas, (v) => (v.tabique ? sugeridas.tabiques : sugeridas.vigas)),
          losas: con(estructura.losas, piezasSinTarea.losas, () => sugeridas.losas),
        },
      },
    });
  };

  const agregarAEstructura = (cambios: Partial<Estructura>) =>
    cambiar({ escala, dibujo: { ...dibujo, estructura: { ...estructura, ...cambios } } });

  // Los nombres que saldrían solos. Las columnas llevan dos series, una por
  // material —C01 y CM01—: en la planilla van aparte.
  const proximaColumna = nombreQueSigue(
    moldeDeColumna.material === "metalica" ? "CM" : "C",
    estructura.columnas.filter((c) => c.material === moldeDeColumna.material)
  );
  const proximoTabique = nombreQueSigue(
    "M",
    estructura.vigas.filter((v) => v.tabique)
  );
  const proximaViga = nombreQueSigue(
    moldeDeViga.material === "metalica" ? "VM" : "V",
    estructura.vigas.filter((v) => v.material === moldeDeViga.material)
  );
  const proximaLosa = nombreQueSigue("L", estructura.losas);

  const colocarColumna = (p: Punto) => {
    const { ancho, profundidad, ancla, giro, material, perfil, tarea } = moldeDeColumna;
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
          tarea: material === "metalica" ? null : tarea,
          visto: false,
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

  /** Con qué sale el próximo cajón: la altura de su fondo y sus capas. */
  const cerrarCajon = (puntos: Punto[]) => {
    if (puntos.length < 3) return;
    const id = crypto.randomUUID();
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        cajones: [
          ...dibujo.cajones,
          {
            id,
            puntos,
            fondo: moldeDeCajon.fondo ?? Math.max(alturaDePlanta - 0.2, 0.1),
            capas: moldeDeCajon.capas,
          },
        ],
      },
    });
    setEnCurso([]);
    elegir({ tipo: "cajon", id });
  };

  const cambiarCajon = (id: string, cambios: Partial<Cajon>) =>
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        cajones: dibujo.cajones.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
      },
    });

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
          tarea: moldeDeLosa.tarea,
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
  const conPuntos = (
    de: "ambiente" | "losa" | "cajon" | "cielorraso",
    id: string,
    puntos: Punto[]
  ): Trazo =>
    de === "losa"
      ? conPieza("losas", id, { puntos })
      : de === "cielorraso"
        ? {
            escala,
            dibujo: {
              ...dibujo,
              ambientes: dibujo.ambientes.map((a) =>
                a.id === id ? { ...a, contornoCielorraso: puntos } : a
              ),
            },
          }
        : de === "cajon"
        ? {
            escala,
            dibujo: {
              ...dibujo,
              cajones: dibujo.cajones.map((c) => (c.id === id ? { ...c, puntos } : c)),
            },
          }
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
    if (tipo === "capa") {
      cambiar({ escala, dibujo: { ...dibujo, capas: dibujo.capas.filter((c) => c.id !== id) } });
      setSeleccion(null);
      return;
    }
    if (tipo === "cajon") {
      cambiar({ escala, dibujo: { ...dibujo, cajones: dibujo.cajones.filter((c) => c.id !== id) } });
      setSeleccion(null);
      return;
    }
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

  /** Suma una capa con lo del molde, sobre esos tramos. */
  const ponerCapa = (tramos: TramoDeCapa[]) => {
    if (tramos.length === 0) return;
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        capas: [...dibujo.capas, { id: crypto.randomUUID(), ...moldeDeCapa, tramos }],
      },
    });
  };

  /** Cierra la capa que se marcaba a mano. */
  const terminarCapaAMano = () => {
    ponerCapa(tramosDePolilinea(puntosDeCapa, dibujo.muros));
    setPuntosDeCapa([]);
  };

  const cambiarCapa = (id: string, cambios: Partial<CapaDibujada>) =>
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        capas: dibujo.capas.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
      },
    });

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
   * Copiar es copiar las propiedades de un elemento a otros del mismo tipo:
   * el primer clic toma, y cada clic que sigue se las pone a lo que se toque.
   *
   * Sobre un muro: de qué está hecho y lo que lleva encima. Lo de un ambiente
   * o una abertura no le toca a un muro.
   */
  const tocarMuroParaCopiar = (muro: Muro) => {
    if (!copiado) {
      const largo = distancia(muro.a, muro.b);
      // Un centímetro, en fracción del muro: menos que eso es "toda la cara".
      const tolerancia = mpp !== null && largo > 0 ? 0.01 / mpp / largo : 0.01;
      setCopiado({
        de: "muro",
        tarea: muro.tarea,
        tipo: muro.tipo,
        espesor: muro.espesor,
        revestimiento: muro.revestimiento,
        zocalo: muro.zocalo,
        altura: muro.altura,
        capas: dibujo.capas.flatMap((capa) =>
          capa.tramos
            .filter((tr) => tr.muroId === muro.id && (tr.cara === 1 || tr.cara === -1))
            .map((tr) => {
              const cara = tr.cara as 1 | -1;
              const rango = rangoDeLado(muro.id, cara);
              return {
                capaId: capa.id,
                cara,
                desde: tr.desde,
                hasta: tr.hasta,
                entera:
                  rango !== null && tr.desde <= rango[0] + tolerancia && tr.hasta >= rango[1] - tolerancia,
              };
            })
        ),
        afuera: ladoDeAfuera(muro.id),
      });
      return;
    }
    if (copiado.de !== "muro") return;
    // Todo lo que hace a qué es el muro: su tipo —o su mampostería y
    // espesor—, sus zócalos, su altura y sus capas dibujadas. No su línea ni
    // su referencia, que son de dónde está.
    //
    // Las capas van a la misma cara —la exterior a la exterior—, salvo que
    // los dos tengan un solo lado que da afuera y no coincidan: entonces lo de
    // afuera va afuera, aunque se hayan trazado en sentidos contrarios. Una
    // capa que cubría toda su cara cubre toda la de éste; una parcial, la
    // misma fracción. Lo que este muro tenía dibujado se reemplaza.
    const destinoAfuera = ladoDeAfuera(muro.id);
    const invertir =
      copiado.afuera !== null && destinoAfuera !== null && copiado.afuera !== destinoAfuera;
    const nuevos = new Map<string, TramoDeCapa[]>();
    for (const c of copiado.capas) {
      const cara = (invertir ? -c.cara : c.cara) as 1 | -1;
      const rango = rangoDeLado(muro.id, cara);
      if (!rango) continue;
      const [desde, hasta] = c.entera ? rango : [c.desde, c.hasta];
      nuevos.set(c.capaId, [...(nuevos.get(c.capaId) ?? []), { muroId: muro.id, cara, desde, hasta }]);
    }
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        muros: dibujo.muros.map((m) =>
          m.id === muro.id
            ? {
                ...m,
                tarea: copiado.tarea,
                tipo: copiado.tipo,
                espesor: copiado.espesor,
                revestimiento: copiado.revestimiento,
                zocalo: copiado.zocalo,
                altura: copiado.altura,
              }
            : m
        ),
        capas: dibujo.capas
          .map((capa) => ({
            ...capa,
            tramos: [
              ...capa.tramos.filter(
                (tr) => !(tr.muroId === muro.id && (tr.cara === 1 || tr.cara === -1))
              ),
              ...(nuevos.get(capa.id) ?? []),
            ],
          }))
          .filter((capa) => capa.tramos.length > 0),
      },
    });
  };

  /**
   * Desde dónde hasta dónde llega una cara de un muro —lo que queda a la
   * vista—, en fracciones de su línea: lo que cubre una capa de punta a punta.
   */
  const rangoDeLado = (muroId: string, lado: 1 | -1): [number, number] | null => {
    const muro = dibujo.muros.find((m) => m.id === muroId);
    const largo = muro ? distancia(muro.a, muro.b) : 0;
    const caras = (terminaciones?.caras ?? []).filter(
      (c) => c.muroId === muroId && c.punta === null && c.lado === lado
    );
    if (!(largo > 0) || caras.length === 0) return null;
    return [
      Math.min(...caras.map((c) => c.desde)) / largo,
      Math.max(...caras.map((c) => c.hasta)) / largo,
    ];
  };

  /** El lado del muro que da afuera —a ningún ambiente—, si es uno solo. */
  const ladoDeAfuera = (muroId: string): 1 | -1 | null => {
    const afuera = ([1, -1] as const).filter((lado) => {
      const caras = (terminaciones?.caras ?? []).filter(
        (c) => c.muroId === muroId && c.punta === null && c.lado === lado
      );
      return caras.length > 0 && caras.every((c) => c.ambienteId === null);
    });
    return afuera.length === 1 ? afuera[0] : null;
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
    if (copiado.de !== "ambiente") return;
    cambiarAmbiente(ambiente.id, {
      capas: copiado.capas,
      piso: copiado.piso,
      cielorraso: copiado.cielorraso,
      alturaCielorraso: copiado.alturaCielorraso,
    });
  };

  /**
   * Copiar, sobre una abertura: su tipo entero —nombre, medidas, antepecho,
   * cómo abre y su mano—. Se queda en su muro, en su lugar y hacia su lado.
   */
  const tocarAberturaParaCopiar = (ab: Abertura) => {
    if (!copiado) {
      setCopiado({
        de: "abertura",
        tipo: ab.tipo,
        nombre: ab.nombre,
        ancho: ab.ancho,
        alto: ab.alto,
        antepecho: ab.antepecho,
        apertura: ab.apertura,
        hojas: ab.hojas,
        mano: ab.mano,
        marco: ab.marco,
      });
      return;
    }
    if (copiado.de !== "abertura") return;
    const { tipo, nombre, ancho, alto, antepecho, apertura, hojas, mano, marco } = copiado;
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        aberturas: dibujo.aberturas.map((a) =>
          a.id === ab.id ? { ...a, tipo, nombre, ancho, alto, antepecho, apertura, hojas, mano, marco } : a
        ),
      },
    });
  };

  /**
   * Cambia la composición o el nombre de un tipo: al momento en los muros de
   * esta planta —su espesor es la suma de las capas—, y en la base un rato
   * después de dejar de tocarlo, que es cuando llega a las demás plantas.
   */
  const cambiarTipoDeMuro = (
    id: string,
    cambios: Partial<Pick<TipoMuro, "nombre">> & { composicion?: Composicion }
  ) => {
    const anterior = tipos.find((t) => t.id === id);
    if (!anterior) return;
    const nuevo: TipoMuro = { ...anterior, ...(cambios.composicion ?? {}), ...(cambios.nombre !== undefined ? { nombre: cambios.nombre } : {}) };
    setTipos((antes) => antes.map((t) => (t.id === id ? nuevo : t)));

    if (cambios.composicion) {
      const delTipo = medidasDelMuro(nuevo);
      setTrazo((antes) => ({
        ...antes,
        dibujo: {
          ...antes.dibujo,
          muros: antes.dibujo.muros.map((m) => (m.tipo === id ? { ...m, ...delTipo } : m)),
        },
      }));
      if (dibujo.muros.some((m) => m.tipo === id)) setSucio(true);
    }

    const pendiente = guardadosPendientes.current.get(id);
    if (pendiente) clearTimeout(pendiente);
    guardadosPendientes.current.set(
      id,
      setTimeout(async () => {
        guardadosPendientes.current.delete(id);
        if (!nuevo.nombre.trim()) return;
        const r = await guardarTipo({
          id,
          nombre: nuevo.nombre,
          composicion: { nucleo: nuevo.nucleo, exterior: nuevo.exterior, interior: nuevo.interior },
        });
        setErrorDeTipo(r.error ?? "");
      }, 700)
    );
  };

  /**
   * Un tipo nuevo: vacío, o armado desde un muro —su mampostería y su
   * espesor de núcleo—, que pasa a usarlo.
   */
  const crearTipo = async (desde: Muro | null) => {
    // Desde un muro con tipo, el nuevo arranca igual al suyo —con su núcleo y
    // sus capas—, para cambiar sólo lo distinto: es como se separa el tramo de
    // un muro partido. Desde uno sin tipo, con su ladrillo; su espesor es el
    // del muro sin lo que crece de cada lado.
    const base = desde?.tipo ? mapaDeTipos.get(desde.tipo) : undefined;
    const composicion: Composicion = base
      ? { nucleo: { ...base.nucleo }, exterior: [...base.exterior], interior: [...base.interior] }
      : {
          nucleo: {
            tarea: desde?.tarea ?? null,
            espesor: desde
              ? Math.max(desde.espesor - desde.revestimiento.exterior - desde.revestimiento.interior, 0.01)
              : 0.12,
          },
          exterior: [],
          interior: [],
        };
    const nombre = nombreLibre(
      base ? base.nombre : desde ? `Muro ${Math.round(composicion.nucleo.espesor * 100)}` : "Muro",
      tipos.map((t) => t.nombre)
    );
    const r = await guardarTipo({ id: null, nombre, composicion });
    if (r.error || !r.id) {
      setErrorDeTipo(r.error ?? "No se pudo crear el tipo.");
      return;
    }
    setErrorDeTipo("");
    const nuevo: TipoMuro = { id: r.id, nombre, ...composicion };
    setTipos((antes) => [...antes, nuevo]);
    if (desde) cambiarMuros(new Set([desde.id]), { tipo: r.id, ...medidasDelMuro(nuevo) });
    else setTipoMolde(r.id);
  };

  const borrarTipo = async (id: string) => {
    if (dibujo.muros.some((m) => m.tipo === id)) {
      setErrorDeTipo("Lo usan muros de esta planta.");
      return;
    }
    const r = await eliminarTipo(id);
    if (r.error) {
      setErrorDeTipo(r.error);
      return;
    }
    setErrorDeTipo("");
    setTipos((antes) => antes.filter((t) => t.id !== id));
    if (tipoMolde === id) setTipoMolde(null);
  };

  /** Le pone un tipo a un muro: su espesor y su mampostería salen del tipo. */
  const ponerTipo = (muro: Muro, id: string | null) => {
    const tipo = id ? mapaDeTipos.get(id) : undefined;
    cambiarMuros(
      new Set([muro.id]),
      tipo
        ? { tipo: tipo.id, ...medidasDelMuro(tipo) }
        : // Sin tipo, todo el espesor vuelve a ser núcleo.
          { tipo: null, revestimiento: SIN_REVESTIMIENTO }
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

  /** Hasta dónde llega el cielorraso de un ambiente: su contorno propio, o el
   *  del ambiente mientras no se le haya dibujado uno. */
  const contornoDelAmbiente = (id: string): Punto[] => {
    const ambiente = dibujo.ambientes.find((a) => a.id === id);
    return ambiente ? contornoDeCielorraso(ambiente) : [];
  };

  /** El anillo de la buña de un ambiente: el suyo, o el borde del cielorraso
   *  mientras no lo hayan tocado. */
  const anilloDelAmbiente = (id: string): VerticeDeBuna[] => {
    const ambiente = dibujo.ambientes.find((a) => a.id === id);
    return ambiente ? anilloDeBuna(ambiente) : [];
  };

  /**
   * El trazo con el anillo de una buña cambiado. Guardarlo es lo que la
   * despega del contorno del ambiente: desde acá en más es suyo.
   */
  const conBuna = (id: string, anillo: VerticeDeBuna[]): Trazo => ({
    escala,
    dibujo: {
      ...dibujo,
      ambientes: dibujo.ambientes.map((a) =>
        a.id === id && a.buna ? { ...a, buna: { ...a.buna, anillo } } : a
      ),
    },
  });

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
            contornoCielorraso: null,
            buna: null,
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
      const igual = tiposDeAberturas.find(
        (a) => a.tipo === tipoAbertura && a.nombre === valor.trim()
      );
      if (igual) {
        molde = {
          ...molde,
          marco: igual.marco,
          ancho: String(igual.ancho),
          alto: String(igual.alto),
          // El antepecho no es del tipo, pero el de la anterior es la mejor
          // primera respuesta: se corrige si esta va a otra altura.
          antepecho: igual.antepecho === null ? molde.antepecho : String(igual.antepecho),
          apertura: igual.apertura ?? molde.apertura,
          hojas: igual.hojas ?? molde.hojas,
          tareas: igual.tareas,
        };
      }
    }
    setMoldes({ ...moldes, [tipoAbertura]: molde });
  };

  const colocarAbertura = (p: Punto) => {
    // Un nombre que ya es un tipo de la planta se pone con las medidas del
    // tipo: dos P1 distintas son un error de carga.
    const delTipo = tiposDeAberturas.find(
      (x) => x.tipo === tipoAbertura && x.nombre === moldes[tipoAbertura].nombre.trim()
    );
    const molde = delTipo
      ? {
          ...moldes[tipoAbertura],
          ancho: String(delTipo.ancho),
          alto: String(delTipo.alto),
          apertura: delTipo.apertura ?? moldes[tipoAbertura].apertura,
          hojas: delTipo.hojas ?? moldes[tipoAbertura].hojas,
          marco: delTipo.marco,
          tareas: delTipo.tareas,
        }
      : moldes[tipoAbertura];
    const ancho = Number(molde.ancho);
    const alto = Number(molde.alto);
    if (!(ancho > 0) || !(alto > 0)) return;

    const muro = muroCercano(p, murosPorSuCuerpo, ALCANCE_ABERTURA * u);
    if (!muro) return;

    // Un tipo nuevo —o uno que era sólo de esta planta— queda en la obra al
    // ponerlo: no hay que acordarse de guardarlo.
    const nombre = molde.nombre.trim();
    if (nombre && !tiposDeObra.some((t) => t.tipo === tipoAbertura && t.nombre === nombre)) {
      guardarEnLaObra({
        tipo: tipoAbertura,
        nombre,
        ancho,
        alto,
        antepecho:
          tipoAbertura === "ventana" && molde.antepecho !== "" && Number(molde.antepecho) >= 0
            ? Number(molde.antepecho)
            : null,
        apertura: tipoAbertura === "ventana" ? molde.apertura : null,
        hojas: tipoAbertura === "ventana" ? molde.hojas : null,
        marco: tipoAbertura === "puerta" ? molde.marco : null,
        tareas: molde.tareas,
      });
    }

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
            marco: tipoAbertura === "puerta" ? molde.marco : null,
            tareas: molde.tareas,
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

  /**
   * Cambia algo que es del tipo —cómo abre, cuántas hojas, el marco— en todas
   * las suyas y en el tipo guardado.
   */
  const cambiarTipo = (de: { tipo: TipoAbertura; nombre: string }, cambios: Partial<TipoDeAbertura>) => {
    const delTipo = (a: { tipo: TipoAbertura; nombre: string }) =>
      a.tipo === de.tipo && a.nombre === de.nombre;
    // El tipo queda en la obra, aunque hasta ahora fuera sólo de esta planta.
    const actual = de.nombre.trim() ? tiposDeAberturas.find(delTipo) : undefined;
    if (actual) guardarEnLaObra({ ...actual, ...cambios });
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        aberturas: dibujo.aberturas.map((a) => (delTipo(a) ? { ...a, ...cambios } : a)),
        tiposDeAbertura: dibujo.tiposDeAbertura.map((t) => (delTipo(t) ? { ...t, ...cambios } : t)),
      },
    });
  };

  /** Cambia una medida de la abertura elegida y de todas las de su tipo. */
  const medirTipo = (de: Abertura, campo: "ancho" | "alto", valor: number) =>
    cambiarTipo(de, { [campo]: valor });

  /**
   * Los tipos de abertura de la planta: los guardados y los que ya están
   * colocados —éstos mandan: son los que se ven—, por nombre.
   */
  const tiposDeAberturas = (() => {
    const porNombre = new Map<string, TipoDeAbertura>();
    for (const t of dibujo.tiposDeAbertura) porNombre.set(`${t.tipo}|${t.nombre}`, t);
    for (const a of dibujo.aberturas) {
      if (!a.nombre.trim()) continue;
      const { tipo, nombre, ancho, alto, antepecho, apertura, hojas, marco, tareas } = a;
      porNombre.set(`${tipo}|${nombre}`, { tipo, nombre, ancho, alto, antepecho, apertura, hojas, marco, tareas });
    }
    // Los de la obra son la definición: valen en todas las plantas.
    for (const t of tiposDeObra) porNombre.set(`${t.tipo}|${t.nombre}`, t);
    return Array.from(porNombre.values()).sort((x, y) =>
      x.nombre.localeCompare(y.nombre, "es", { numeric: true })
    );
  })();

  /**
   * Guarda un tipo de abertura en la obra: al momento en la lista, y en la
   * base un rato después de dejar de tocarlo —ahí llega a las otras plantas—.
   */
  const guardarEnLaObra = (tipo: TipoDeAbertura) => {
    const clave = `${tipo.tipo}|${tipo.nombre}`;
    setTiposDeObra((antes) => [
      ...antes.filter((t) => `${t.tipo}|${t.nombre}` !== clave),
      tipo,
    ]);
    const pendientes = aberturasPendientes.current;
    clearTimeout(pendientes.get(clave));
    pendientes.set(
      clave,
      setTimeout(async () => {
        pendientes.delete(clave);
        const r = await guardarTipoDeAberturaEnLaObra(tipo);
        if (r.error) setError(r.error);
      }, 700)
    );
  };

  /** Pone en el molde un tipo de la lista, para colocarlo. */
  const usarTipoDeAbertura = (t: TipoDeAbertura) =>
    setMoldes({
      ...moldes,
      [t.tipo]: {
        ...moldes[t.tipo],
        nombre: t.nombre,
        ancho: String(t.ancho),
        alto: String(t.alto),
        antepecho: t.antepecho === null ? moldes[t.tipo].antepecho : String(t.antepecho),
        apertura: t.apertura ?? moldes[t.tipo].apertura,
        hojas: t.hojas ?? moldes[t.tipo].hojas,
        marco: t.marco,
        tareas: t.tareas,
      },
    });

  /** El tipo de la lista que está en el molde, si es uno guardado. */
  const aberturaDelMolde = tiposDeAberturas.find(
    (t) => t.tipo === tipoAbertura && t.nombre === moldes[tipoAbertura].nombre.trim()
  );

  /**
   * Un tipo nuevo en el molde, con el nombre que sigue —P03 después de P02—
   * y las medidas de siempre.
   */
  const nuevoTipoDeAbertura = () => {
    const letra = tipoAbertura === "puerta" ? "P" : "V";
    let mayor = 0;
    let cifras = 2;
    for (const t of tiposDeAberturas) {
      const m = t.tipo === tipoAbertura ? /^[A-Za-z]+0*(\d+)$/.exec(t.nombre.trim()) : null;
      if (!m || Number(m[1]) < mayor) continue;
      mayor = Number(m[1]);
      cifras = t.nombre.trim().length - t.nombre.trim().search(/\d/);
    }
    setMoldes({
      ...moldes,
      [tipoAbertura]: {
        ...aMolde(ABERTURA_INICIAL[tipoAbertura]),
        mano: moldes[tipoAbertura].mano,
        nombre: letra + String(mayor + 1).padStart(cifras, "0"),
      },
    });
  };

  /**
   * Una medida del molde. Si el molde es un tipo guardado, cambia el tipo: en
   * la obra y en todas las suyas.
   */
  const medirMolde = (campo: "ancho" | "alto", valor: string) => {
    setMoldes({ ...moldes, [tipoAbertura]: { ...moldes[tipoAbertura], [campo]: valor } });
    if (aberturaDelMolde && Number(valor) > 0) cambiarTipo(aberturaDelMolde, { [campo]: Number(valor) });
  };

  /** Algo del tipo —marco, cómo abre, hojas— en el molde y en el tipo. */
  const cambiarDelMolde = (cambios: Partial<Pick<TipoDeAbertura, "marco" | "apertura" | "hojas" | "tareas">>) => {
    setMoldes({ ...moldes, [tipoAbertura]: { ...moldes[tipoAbertura], ...cambios } });
    if (aberturaDelMolde) cambiarTipo(aberturaDelMolde, cambios);
  };

  const renombrarAbertura = (de: Abertura, nombre: string) => {
    // Si el nombre nuevo ya existe —colocado o guardado—, pasa a ser de ese
    // tipo y toma sus medidas.
    const igual =
      dibujo.aberturas.find((a) => a.id !== de.id && a.tipo === de.tipo && a.nombre === nombre.trim()) ??
      dibujo.tiposDeAbertura.find((t) => t.tipo === de.tipo && t.nombre === nombre.trim());
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
                      marco: igual.marco,
                      tareas: igual.tareas,
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
      // Las esquinas de afuera de las capas dibujadas: la cara terminada.
      ...(terminaciones?.piezas ?? [])
        .filter((p) => !sinBordesDe?.has(p.cara.muroId))
        .flatMap((p) => [p.puntos[2], p.puntos[3]]),
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
    // El borde de afuera de cada capa dibujada: la cara terminada.
    ...(terminaciones?.piezas ?? [])
      .filter((p) => !sinLasDe?.has(p.cara.muroId))
      .map((p) => ({ a: p.puntos[3], b: p.puntos[2] })),
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
                referencia,
                altura: null,
                ...(tipoDelMolde
                  ? medidasDelMuro(tipoDelMolde)
                  : { espesor, tarea: tipoDeMuro, revestimiento: SIN_REVESTIMIENTO }),
                tipo: tipoDelMolde?.id ?? null,
                zocalo: { exterior: null, interior: null },
              },
            ],
          },
        });
      }
      setEnCurso([p]);
      return;
    }

    if (herramienta === "tabique") {
      // Como una viga: el que sigue arranca donde terminó este.
      if (ultimo && !mismoPunto(ultimo, p)) {
        agregarAEstructura({
          vigas: [
            ...estructura.vigas,
            {
              id: crypto.randomUUID(),
              nombre: moldeDeTabique.nombre.trim() || proximoTabique,
              a: ultimo,
              b: p,
              referencia: moldeDeTabique.referencia,
              material: "hormigon",
              perfil: "",
              tarea: moldeDeTabique.tarea,
              ancho: moldeDeTabique.ancho,
              alto: VIGA_INICIAL.alto,
              nivel: null,
              tabique: true,
            },
          ],
        });
        setMoldeDeTabique({ ...moldeDeTabique, nombre: "" });
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
              tarea: moldeDeViga.material === "metalica" ? null : moldeDeViga.tarea,
              ancho: moldeDeViga.ancho,
              alto: moldeDeViga.alto,
              nivel: null,
              tabique: false,
            },
          ],
        });
        setMoldeDeViga({ ...moldeDeViga, nombre: "" });
      }
      setEnCurso([p]);
      return;
    }

    if (herramienta === "ambiente" || herramienta === "losa" || herramienta === "cajon") {
      if (enCurso.length >= 3 && mismoPunto(enCurso[0], p)) {
        if (herramienta === "losa") cerrarLosa(enCurso);
        else if (herramienta === "cajon") cerrarCajon(enCurso);
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
      // Llegó hasta acá: no se tocó ninguna figura. En el modo cielorraso lo
      // elegido se queda: soltarlo apagaría el modo de rebote.
      if (!enCielorraso) setSeleccion(null);
      return;
    }

    if (herramienta === "abertura") {
      colocarAbertura(aPlano(e));
      return;
    }

    if (herramienta === "esquina" && modo === "estructura") {
      // Lo mismo con las vigas y los tabiques: una, después la otra.
      const p = aPlano(e);
      let tocada: Viga | null = null;
      let mejor = Infinity;
      for (const v of estructura.vigas) {
        const d = distancia(p, proyectar(p, v.a, v.b));
        const alcance = (mpp !== null ? v.ancho / mpp / 2 : 0) + ALCANCE_ABERTURA * u;
        if (d <= alcance && d < mejor) {
          mejor = d;
          tocada = v;
        }
      }
      if (!tocada) return;
      if (!primeroDeEsquina || primeroDeEsquina === tocada.id) {
        setPrimeroDeEsquina(tocada.id);
        setAvisoDeEsquina("");
        return;
      }
      const vigas = unirEnEsquina(estructura.vigas, primeroDeEsquina, tocada.id);
      setPrimeroDeEsquina(null);
      if (!vigas) {
        setAvisoDeEsquina("Son paralelas: no tienen esquina.");
        return;
      }
      setAvisoDeEsquina("");
      agregarAEstructura({ vigas });
      return;
    }

    if (herramienta === "esquina") {
      // Un muro, después el otro: se unen en escuadra.
      const tocado = muroCercano(aPlano(e), murosPorSuCuerpo, ALCANCE_ABERTURA * u);
      if (!tocado) return;
      if (!primeroDeEsquina || primeroDeEsquina === tocado.id) {
        setPrimeroDeEsquina(tocado.id);
        setAvisoDeEsquina("");
        return;
      }
      const muros = unirEnEsquina(dibujo.muros, primeroDeEsquina, tocado.id);
      setPrimeroDeEsquina(null);
      if (!muros) {
        setAvisoDeEsquina("Son paralelos: no tienen esquina.");
        return;
      }
      setAvisoDeEsquina("");
      cambiar({
        escala,
        dibujo: {
          ...dibujo,
          muros,
          aberturas: aberturasEnSuLugar(dibujo.aberturas, dibujo.muros, muros, mpp, u),
        },
      });
      return;
    }

    if (herramienta === "cortar") {
      const muro = corte ? dibujo.muros.find((m) => m.id === corte.muroId) : undefined;
      if (muro && corte && corte.t > 0 && corte.t < 1) {
        partirEn(muro, {
          x: muro.a.x + (muro.b.x - muro.a.x) * corte.t,
          y: muro.a.y + (muro.b.y - muro.a.y) * corte.t,
        });
        setCorte(null);
      }
      return;
    }

    if (herramienta === "columna") {
      colocarColumna(ajustarAlDibujar(aPlano(e)).punto);
      return;
    }

    if (herramienta === "capa") {
      if (mpp === null) return;
      const p = aPlano(e);
      const caras = terminaciones?.caras ?? [];
      if (capaAMano) {
        const enCara = puntoEnCara(p, caras, ALCANCE_ABERTURA * u);
        if (enCara) setPuntosDeCapa([...puntosDeCapa, enCara]);
      } else {
        // Adentro de un ambiente, todo su perímetro; afuera de todos, las
        // caras de afuera.
        const ambiente = dibujo.ambientes.find((a) => adentro(p, a.puntos));
        ponerCapa(tramosDeAmbiente(caras, ambiente?.id ?? null, dibujo.muros));
      }
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

      if (agarrado.tipo === "muroEntero") {
        const base = alAgarrar.current?.dibujo ?? dibujo;
        const muro = base.muros.find((m) => m.id === agarrado.id);
        if (!muro) return;
        const p = aPlano(e);
        let dx = p.x - agarrado.inicio.x;
        let dy = p.y - agarrado.inicio.y;

        // Los que se mueven: el muro, y con las puntas unidas también las
        // puntas de los que llegan a él.
        const propio = new Set([muro.id]);
        // Se prueba pegar cada punta y el medio de su línea a lo que haya cerca
        // —una cara, una esquina, la línea de otro muro— y gana el que menos
        // tiene que corregirse: así se lo alinea por la línea de la que se lo
        // agarra.
        const medio = { x: (muro.a.x + muro.b.x) / 2, y: (muro.a.y + muro.b.y) / 2 };
        let mejor: { cx: number; cy: number; guias: Guia[] } | null = null;
        for (const q of [muro.a, muro.b, medio]) {
          const objetivo = { x: q.x + dx, y: q.y + dy };
          const ajuste = ajustar(objetivo, {
            previo: null,
            ortogonal: false,
            tolerancia: IMAN * u,
            vertices: verticesMenos(undefined, propio).filter(
              (v) => !mismoPunto(v, muro.a) && !mismoPunto(v, muro.b)
            ),
            muros: lineasDeApoyo(propio),
            guias: conGuias,
          });
          if (!ajuste.iman) continue;
          const cx = ajuste.punto.x - objetivo.x;
          const cy = ajuste.punto.y - objetivo.y;
          if (!mejor || Math.hypot(cx, cy) < Math.hypot(mejor.cx, mejor.cy)) {
            mejor = { cx, cy, guias: ajuste.guias };
          }
        }
        if (mejor) {
          dx += mejor.cx;
          dy += mejor.cy;
        }
        setGuias(mejor?.guias ?? []);

        const corrido = (q: Punto) => ({ x: q.x + dx, y: q.y + dy });
        const muros = base.muros.map((m) => {
          if (m.id === muro.id) return { ...m, a: corrido(m.a), b: corrido(m.b) };
          if (!puntasJuntas) return m;
          const pegada = (q: Punto) => mismoPunto(q, muro.a) || mismoPunto(q, muro.b);
          return {
            ...m,
            a: pegada(m.a) ? corrido(m.a) : m.a,
            b: pegada(m.b) ? corrido(m.b) : m.b,
          };
        });
        // Las aberturas del muro van con él; las de los vecinos que se
        // estiraron se quedan donde estaban en el plano.
        const enSuLugar = aberturasEnSuLugar(base.aberturas, base.muros, muros, mpp, u);
        setTrazo({
          escala,
          dibujo: {
            ...dibujo,
            muros,
            aberturas: enSuLugar.map((ab, i) =>
              ab.muroId === muro.id ? base.aberturas[i] : ab
            ),
          },
        });
        setSucio(true);
        return;
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

      if (agarrado.tipo === "puntaDeCapa") {
        const capa = dibujo.capas.find((c) => c.id === agarrado.capaId);
        const muro = dibujo.muros.find((m) => m.id === agarrado.cara.muroId);
        const tramo = capa?.tramos[agarrado.tramo];
        const { cara } = agarrado;
        const largo = muro ? distancia(muro.a, muro.b) : 0;
        if (!capa || !muro || !tramo || !(largo > 0) || !(cara.largo > 0)) return;
        const dx = (cara.b.x - cara.a.x) / cara.largo;
        const dy = (cara.b.y - cara.a.y) / cara.largo;
        const p = aPlano(e);
        let s = cara.desde + (p.x - cara.a.x) * dx + (p.y - cara.a.y) * dy;
        // Se pega a donde llegan otros muros, a las jambas de las aberturas y
        // a las puntas de la cara.
        const enganches = [
          cara.desde,
          cara.hasta,
          ...cortesDeMuro(muro, dibujo.muros, mpp).map((t) => t * largo),
          ...(mpp === null
            ? []
            : dibujo.aberturas
                .filter((ab) => ab.muroId === muro.id)
                .flatMap((ab) => [ab.t * largo - ab.ancho / mpp / 2, ab.t * largo + ab.ancho / mpp / 2])),
        ];
        const cerca = enganches.reduce<number | null>(
          (mejor, x) =>
            Math.abs(x - s) < IMAN * u && (mejor === null || Math.abs(x - s) < Math.abs(mejor - s)) ? x : mejor,
          null
        );
        s = Math.min(cara.hasta, Math.max(cara.desde, cerca ?? s));
        // Sin pasar la otra punta: un tramo de al menos un centímetro.
        const minimo = mpp !== null ? 0.01 / mpp : 1;
        s =
          agarrado.fin === "desde"
            ? Math.min(s, tramo.hasta * largo - minimo)
            : Math.max(s, tramo.desde * largo + minimo);
        const nuevo = { ...tramo, [agarrado.fin]: s / largo };
        setTrazo({
          escala,
          dibujo: {
            ...dibujo,
            capas: dibujo.capas.map((c) =>
              c.id === capa.id
                ? { ...c, tramos: c.tramos.map((t, i) => (i === agarrado.tramo ? nuevo : t)) }
                : c
            ),
          },
        });
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
            // Corriendo una buña, las esquinas de su propio ambiente sí
            // atraen: es contra ellas que se la deja a la altura del muro.
            ...dibujo.ambientes.flatMap((amb) =>
              amb.id === agarrado.id && agarrado.de !== "buna" ? [] : amb.puntos
            ),
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
        if (agarrado.de === "buna") {
          setTrazo(conBuna(agarrado.id, anilloCorrido(agarrado.lleva ?? [], indice, corrido)));
          setGuias(alineadoCon ? [{ desde: alineadoCon, hasta: corrido.a }] : []);
          setSucio(true);
          return;
        }
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
            : agarrado.tipo === "cajon"
              ? dibujo.cajones.find((c) => c.id === agarrado.id)?.puntos[agarrado.indice]
              : agarrado.tipo === "buna"
                ? anilloDelAmbiente(agarrado.id)[agarrado.indice]
                : agarrado.tipo === "cielorraso"
                  ? contornoDelAmbiente(agarrado.id)[agarrado.indice]
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

      // Una esquina de otro muro a mano manda sobre todo lo demás: es lo que
      // se quiere cuando se acerca la punta a ella, aunque quede unos
      // milímetros fuera de la línea del muro —alinear la cara de un muro con
      // la de otro—. Sin esto, "estirar" ataba la punta a su línea y no la
      // dejaba llegar.
      const crudo = aPlano(e);
      const esquina =
        agarrado.tipo === "muro"
          ? verticesMenos(origen, enMovimiento).reduce<{ p: Punto; d: number } | null>(
              (mejor, v) => {
                const d = distancia(v, crudo);
                return d <= IMAN * u && (!mejor || d < mejor.d) ? { p: v, d } : mejor;
              },
              null
            )
          : null;

      // Un muro solo se estira; una esquina de varios no tiene una línea que
      // seguir, y un punto de un contorno tampoco.
      const estirada = estirar(
        crudo,
        agarrado.tipo === "muro" && enMovimiento?.size === 1 && !esquina ? agarrado.eje : null,
        enMovimiento
      );
      const ajuste = esquina
        ? { punto: esquina.p, iman: true, guias: [] as Guia[] }
        : ajustar(estirada.punto, {
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
        if (agarrado.tipo === "buna") {
          const anillo = anilloDelAmbiente(agarrado.id);
          if (anillo.length === 0) return;
          setTrazo(conBuna(agarrado.id, conPuntoMovido(anillo, agarrado.indice, destino)));
          setSucio(true);
          return;
        }
        const contorno =
          agarrado.tipo === "losa"
            ? losaAgarrada?.puntos
            : agarrado.tipo === "cajon"
              ? dibujo.cajones.find((c) => c.id === agarrado.id)?.puntos
              : agarrado.tipo === "cielorraso"
                ? contornoDelAmbiente(agarrado.id)
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
      herramienta === "tabique" ||
      herramienta === "losa" ||
      herramienta === "cajon"
    ) {
      const ajuste = ajustarAlDibujar(aPlano(e));
      setCursor(ajuste);
      setGuias(ajuste.guias);
    } else if (herramienta === "capa") {
      setPunteroDeCapa(aPlano(e));
    } else if (herramienta === "cortar") {
      // El muro que está debajo del puntero y dónde se lo cortaría: en la
      // línea de otro muro, si pasa cerca; si no, donde está el puntero.
      const p = aPlano(e);
      const cercano = muroCercano(p, murosPorSuCuerpo, ALCANCE_ABERTURA * u);
      const muro = cercano ? dibujo.muros.find((m) => m.id === cercano.id) : undefined;
      if (!muro) {
        setCorte(null);
        return;
      }
      const largo = distancia(muro.a, muro.b);
      const enLinea = proyectar(p, muro.a, muro.b);
      const crudo = largo > 0 ? distancia(muro.a, enLinea) / largo : 0.5;
      const posibles = cortesDeMuro(muro, dibujo.muros, mpp);
      const cerca = posibles.reduce<number | null>(
        (mejor, t) =>
          Math.abs(t - crudo) * largo < IMAN * u &&
          (mejor === null || Math.abs(t - crudo) < Math.abs(mejor - crudo))
            ? t
            : mejor,
        null
      );
      setCorte({ muroId: muro.id, t: cerca ?? crudo, posibles, enganchado: cerca !== null });
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
    partirEn(m, proyectar(acomodado, m.a, m.b));
  };

  /** Parte un muro en un punto de su línea. */
  const partirEn = (m: Muro, corte: Punto) => {
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
        // Las capas dibujadas sobre el original: cada tramo, en la mitad que
        // le toca —o en las dos, partido—, con sus fracciones rehechas.
        capas: dibujo.capas.map((capa) => ({
          ...capa,
          tramos: capa.tramos.flatMap((t): TramoDeCapa[] => {
            if (t.muroId !== m.id) return [t];
            if (t.cara === "a") return [t];
            if (t.cara === "b") return [{ ...t, muroId: segundo.id }];
            const partes: TramoDeCapa[] = [];
            if (t.desde < dondeCorta) {
              partes.push({ ...t, desde: t.desde / dondeCorta, hasta: Math.min(t.hasta, dondeCorta) / dondeCorta });
            }
            if (t.hasta > dondeCorta) {
              partes.push({
                ...t,
                muroId: segundo.id,
                desde: (Math.max(t.desde, dondeCorta) - dondeCorta) / (1 - dondeCorta),
                hasta: (t.hasta - dondeCorta) / (1 - dondeCorta),
              });
            }
            return partes;
          }),
        })),
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
    de: "ambiente" | "losa" | "cajon" | "cielorraso" | "buna" = "ambiente"
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

    if (de === "buna") {
      // Partir un lado deja dos, y los dos llevan lo que llevaba el entero.
      const anillo = anilloDelAmbiente(amb.id);
      if (anillo.length === 0) return;
      cambiar(
        conBuna(amb.id, [
          ...anillo.slice(0, indice + 1),
          { x: nuevo.x, y: nuevo.y, lleva: anillo[indice].lleva },
          ...anillo.slice(indice + 1),
        ])
      );
      return;
    }

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
    de: "ambiente" | "losa" | "cajon" | "cielorraso" | "buna" = "ambiente"
  ) => {
    if (amb.puntos.length <= 3) return;
    if (de === "buna") {
      const anillo = anilloDelAmbiente(amb.id);
      if (anillo.length <= 3) return;
      cambiar(conBuna(amb.id, anillo.filter((_, k) => k !== indice)));
      return;
    }
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
  /**
   * Corre un muro entero, en el plano. Con las puntas unidas, las de los que
   * llegan a él lo acompañan. Sus aberturas van con él; las de los vecinos
   * quedan donde estaban.
   */
  const correrMuro = (muro: Muro, dx: number, dy: number) => {
    const corrido = (q: Punto) => ({ x: q.x + dx, y: q.y + dy });
    const pegada = (q: Punto) => mismoPunto(q, muro.a) || mismoPunto(q, muro.b);
    const muros = dibujo.muros.map((m) =>
      m.id === muro.id
        ? { ...m, a: corrido(m.a), b: corrido(m.b) }
        : puntasJuntas
          ? { ...m, a: pegada(m.a) ? corrido(m.a) : m.a, b: pegada(m.b) ? corrido(m.b) : m.b }
          : m
    );
    const enSuLugar = aberturasEnSuLugar(dibujo.aberturas, dibujo.muros, muros, mpp, u);
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        muros,
        aberturas: enSuLugar.map((ab, i) => (ab.muroId === muro.id ? dibujo.aberturas[i] : ab)),
      },
    });
  };

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
      if (puntosDeCapa.length > 0) setPuntosDeCapa([]);
      else if (enCurso.length > 0) setEnCurso([]);
      else if (reglaMarcada) setReglaMarcada(null);
      else if (medicion) setMedicion(null);
      else if (copiado) setCopiado(null);
      else if (primeroDeEsquina) setPrimeroDeEsquina(null);
      // Primero se sale del modo cielorraso y recién después se suelta lo
      // elegido: salir es lo que se busca con Escape estando adentro.
      else if (verCielorraso) setVerCielorraso(false);
      else setSeleccion(null);
    } else if (e.key === "Enter") {
      if (herramienta === "ambiente") cerrarAmbiente(enCurso);
      else if (herramienta === "losa") cerrarLosa(enCurso);
      else if (herramienta === "cajon") cerrarCajon(enCurso);
      else if (herramienta === "capa") terminarCapaAMano();
      else setEnCurso([]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      borrarSeleccion();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      deshacer();
    } else if (
      e.key.startsWith("Arrow") &&
      seleccion?.tipo === "muro" &&
      herramienta === "seleccionar"
    ) {
      const elegido = dibujo.muros.find((m) => m.id === seleccion.id);
      if (!elegido) return;
      // El ajuste fino: un centímetro por tecla, diez con Shift.
      e.preventDefault();
      const paso = (e.shiftKey ? 0.1 : 0.01) / (mpp ?? 0.01);
      const [dx, dy] =
        e.key === "ArrowLeft"
          ? [-paso, 0]
          : e.key === "ArrowRight"
            ? [paso, 0]
            : e.key === "ArrowUp"
              ? [0, -paso]
              : [0, paso];
      correrMuro(elegido, dx, dy);
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
  const capaElegida =
    seleccion?.tipo === "capa" ? dibujo.capas.find((c) => c.id === seleccion.id) ?? null : null;
  const cajonElegido =
    seleccion?.tipo === "cajon" ? dibujo.cajones.find((c) => c.id === seleccion.id) ?? null : null;
  const medidaDelCajon = cajonElegido
    ? terminaciones?.cajones.find((c) => c.id === cajonElegido.id) ?? null
    : null;
  /** Lo que mide la capa elegida, sumando todas sus piezas. */
  const superficieDeLaCapa = capaElegida
    ? (terminaciones?.caras ?? []).reduce(
        (t, cara) =>
          t + cara.capas.filter((c) => c.capaId === capaElegida.id).reduce((s, c) => s + c.superficie, 0),
        0
      )
    : 0;
  /**
   * La pila donde está la capa elegida: ella y las capas que pisa o que la
   * pisan —en alguna cara, tramo y franja de altura—, de la de contra el muro
   * a la de afuera.
   */
  const pilaDeLaCapa = useMemo(() => {
    if (!capaElegida || !terminaciones) return [];
    const suyas = terminaciones.piezas.filter((p) => p.capa.id === capaElegida.id);
    const pisa = (a: PiezaDeCapa, b: PiezaDeCapa) =>
      a.cara.muroId === b.cara.muroId &&
      (a.cara.punta ?? a.cara.lado) === (b.cara.punta ?? b.cara.lado) &&
      Math.min(a.s1, b.s1) - Math.max(a.s0, b.s0) > 1e-6 &&
      Math.min(a.arriba, b.arriba) - Math.max(a.abajo, b.abajo) > 1e-6;
    const ids = new Set(
      terminaciones.piezas.filter((p) => suyas.some((q) => pisa(p, q))).map((p) => p.capa.id)
    );
    ids.add(capaElegida.id);
    return dibujo.capas.filter((c) => ids.has(c.id));
  }, [capaElegida, terminaciones, dibujo.capas]);

  /**
   * Lleva una capa al lugar de otra en la lista —antes si sube, después si
   * baja—: es lo que decide quién se apoya en quién.
   */
  const moverCapaA = (id: string, destino: string) => {
    const desde = dibujo.capas.findIndex((c) => c.id === id);
    const hasta = dibujo.capas.findIndex((c) => c.id === destino);
    if (desde < 0 || hasta < 0 || desde === hasta) return;
    const capas = [...dibujo.capas];
    const [capa] = capas.splice(desde, 1);
    capas.splice(hasta, 0, capa);
    cambiar({ escala, dibujo: { ...dibujo, capas } });
  };

  /** Las piezas de la capa elegida y cuánto mide a lo largo, por su línea media. */
  const piezasDeLaElegida = capaElegida
    ? (terminaciones?.piezas ?? []).filter((p) => p.capa.id === capaElegida.id)
    : [];
  const largoDeLaCapa = piezasDeLaElegida.reduce(
    (t, p) => t + (p.s1 - p.s0) * (mpp ?? 0) * proporcionAlLargo(p),
    0
  );
  /** Los muros en corte, para el fondo de la planta chiquita. */
  const fondoDePlanta = useMemo(
    () => Array.from(franjas.values()).flatMap((fs) => fs.map((f) => f.puntos)),
    [franjas]
  );

  /**
   * Las puntas de los tramos de la capa elegida, para correrlas a lo largo de
   * su cara. Sólo donde termina el tramo, no donde lo corta otro muro.
   */
  const puntasDeLaCapa =
    herramienta === "seleccionar" && capaElegida
      ? (terminaciones?.piezas ?? [])
          .filter((p) => p.capa.id === capaElegida.id && p.cara.punta === null)
          .flatMap((p) => {
            const muro = dibujo.muros.find((m) => m.id === p.cara.muroId);
            const tramo = capaElegida.tramos[p.tramo];
            if (!muro || !tramo) return [];
            const largo = distancia(muro.a, muro.b);
            const [a, b, c, d] = p.puntos;
            return (["desde", "hasta"] as const)
              .filter((fin) => Math.abs((fin === "desde" ? p.s0 : p.s1) - tramo[fin] * largo) < 0.5)
              .map((fin) => {
                // En la punta, un poco hacia adentro del tramo: en un rincón
                // las puntas de los dos muros caen en el mismo lugar, y así
                // cada una se agarra sin tapar a la otra.
                const inicio = { x: (a.x + d.x) / 2, y: (a.y + d.y) / 2 };
                const final = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
                const [desde, hacia] = fin === "desde" ? [inicio, final] : [final, inicio];
                const largoDePieza = distancia(desde, hacia);
                const adentro = largoDePieza > 0 ? Math.min(12 * u, largoDePieza / 3) / largoDePieza : 0;
                return {
                  clave: `${p.tramo}-${fin}-${p.s0}`,
                  punto: {
                    x: desde.x + (hacia.x - desde.x) * adentro,
                    y: desde.y + (hacia.y - desde.y) * adentro,
                  },
                  capaId: capaElegida.id,
                  tramo: p.tramo,
                  fin,
                  cara: p.cara,
                };
              });
          })
      : [];

  /**
   * Tocar una pieza de capa: la elige, con su tramo; con Copiar, es tocar su
   * muro.
   */
  const tocarPiezaDeCapa = (e: React.PointerEvent, p: PiezaDeCapa) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    lienzo.current?.focus({ preventScroll: true });
    if (herramienta === "copiar") {
      const muro = dibujo.muros.find((m) => m.id === p.cara.muroId);
      if (muro) tocarMuroParaCopiar(muro);
      return;
    }
    setMuroDeOrigen(null);
    elegir({ tipo: "capa", id: p.capa.id, tramo: p.tramo });
  };

  /** Agarra la punta de un tramo de una capa para correrla. */
  const agarrarPuntaDeCapa = (
    e: React.PointerEvent,
    capaId: string,
    tramo: number,
    fin: "desde" | "hasta",
    cara: Cara
  ) => {
    lienzo.current?.focus({ preventScroll: true });
    setSeleccion({ tipo: "capa", id: capaId, tramo });
    agarrar(e, { tipo: "puntaDeCapa", capaId, tramo, fin, cara });
  };

  /** Saca de la capa elegida el tramo que se tocó. */
  const quitarTramo = () => {
    const tramo = seleccion?.tramo;
    if (!capaElegida || tramo === undefined) return;
    cambiarCapa(capaElegida.id, { tramos: capaElegida.tramos.filter((_, i) => i !== tramo) });
    setSeleccion({ tipo: "capa", id: capaElegida.id });
  };

  /** Si la obra tiene capas de las de antes: de los tipos, de los ambientes o de las caras. */
  const hayCapasDeAntes = useMemo(() => tieneCapasDeAntes(dibujo, mapaDeTipos), [dibujo, mapaDeTipos]);

  const pasarCapasDeLaObra = async () => {
    const si = await preguntar(
      "Las capas de los tipos de muro y de los ambientes pasan a dibujarse sobre las caras, en todas las plantas de la obra. Los tipos quedan sólo con el ladrillo.",
      "Pasar las capas"
    );
    if (!si) return;
    iniciarPaseDeCapas(async () => {
      const r = await pasarCapas();
      if (r.error) setError(r.error);
      // El dibujo cambió en la base: se lo vuelve a leer entero.
      else window.location.reload();
    });
  };

  /** La capa que saldría con un clic, para verla antes de ponerla. */
  const piezasDeLaPrevia = useMemo(() => {
    if (herramienta !== "capa" || !terminaciones) return [];
    const caras = terminaciones.caras;
    let tramos: TramoDeCapa[] = [];
    if (capaAMano) {
      const proximo = punteroDeCapa ? puntoEnCara(punteroDeCapa, caras, ALCANCE_ABERTURA * u) : null;
      tramos = tramosDePolilinea(proximo ? [...puntosDeCapa, proximo] : puntosDeCapa, dibujo.muros);
    } else if (punteroDeCapa) {
      const ambiente = dibujo.ambientes.find((a) => adentro(punteroDeCapa, a.puntos));
      tramos = tramosDeAmbiente(caras, ambiente?.id ?? null, dibujo.muros);
    }
    if (tramos.length === 0) return [];
    const previa: CapaDibujada = { id: "previa", ...moldeDeCapa, tramos };
    return piezasDeCapas(
      { ...dibujo, capas: [...dibujo.capas, previa] },
      caras,
      mpp,
      alturaDePlanta
    ).filter((p) => p.capa.id === "previa");
  }, [herramienta, terminaciones, capaAMano, punteroDeCapa, puntosDeCapa, dibujo, moldeDeCapa, mpp, alturaDePlanta, u]);
  // Elegir la buña es elegir su ambiente: el panel es el mismo —la buña se
  // pone en la caja del cielorraso— y lo único que cambia es cuál de los dos
  // anillos se agarra en el plano.
  const ambienteElegido =
    seleccion?.tipo === "ambiente" || seleccion?.tipo === "buna"
      ? dibujo.ambientes.find((a) => a.id === seleccion.id) ?? null
      : null;
  const bunaElegida = seleccion?.tipo === "buna" ? ambienteElegido : null;
  /** La buña del ambiente elegido, aparte para no perderla de vista adentro
   *  de los `onChange` del panel. */
  const bunaDelAmbiente = ambienteElegido?.buna ?? null;
  /** El modo cielorraso vale mientras haya un ambiente elegido: sin él no hay
   *  cielorraso que dibujar. */
  const enCielorraso = verCielorraso && ambienteElegido !== null;
  const contornoDelCielorraso = ambienteElegido ? contornoDeCielorraso(ambienteElegido) : [];

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
    herramienta === "tabique" ||
    herramienta === "losa" ||
    herramienta === "cajon";
  // La columna no traza nada, pero su punto se marca con el mismo imán.
  const marcando = dibujando || herramienta === "columna";
  // Las figuras sólo se dejan tocar con Seleccionar: dibujando, un clic sobre
  // un muro es un punto nuevo que se le pega, no una selección. Y sólo las del
  // modo en que se está: las del otro se ven, pero no se tocan.
  const enElPlano = herramienta === "seleccionar" && modo === "arquitectura";
  /** En el modo cielorraso el resto del plano no se toca: el clic es siempre
   *  para el cielorraso o su buña. */
  const tocable = enElPlano && !enCielorraso ? "auto" : "none";
  const tocableDelCielorraso = enElPlano ? "auto" : "none";
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
  /** Cuánto suman las capas de piso del ambiente elegido: el paquete que va
   *  sobre la losa. */
  const paqueteDePiso = ambienteElegido
    ? ambienteElegido.piso.reduce((t, capa) => t + (capa.espesor ?? 0), 0)
    : 0;
  /** Si Propiedades no tiene nada que mostrar: ni algo elegido ni una
   *  herramienta con opciones. */
  const sinPropiedades =
    seleccion === null &&
    (herramienta === "seleccionar" || herramienta === "mover" || herramienta === "ambiente");
  const anilloElegido = bunaElegida ? anilloDeBuna(bunaElegida) : [];
  const contorno = bunaElegida && anilloElegido.length >= 3
    ? {
        de: "buna" as const,
        id: bunaElegida.id,
        puntos: anilloElegido.map((p) => ({ x: p.x, y: p.y })),
      }
    : // En el modo cielorraso lo que se agarra es su borde, no el del
      // ambiente, que ahí ni siquiera se deja tocar.
      enCielorraso && ambienteElegido
    ? { de: "cielorraso" as const, id: ambienteElegido.id, puntos: contornoDelCielorraso }
    : ambienteElegido
    ? { de: "ambiente" as const, id: ambienteElegido.id, puntos: ambienteElegido.puntos }
    : losaElegida
      ? { de: "losa" as const, id: losaElegida.id, puntos: losaElegida.puntos }
      : cajonElegido
        ? { de: "cajon" as const, id: cajonElegido.id, puntos: cajonElegido.puntos }
        : null;

  /** De qué color van las agarraderas de lo que se está editando: la buña en
   *  el suyo, porque su anillo nace encima de otro contorno y hay que poder
   *  saber cuál de los dos se agarra. */
  const colorDelContorno = contorno?.de === "buna" ? BUNA : ACENTO;

  // Lo que saldría si se hiciera clic ahora: la columna en el punto marcado, o
  // la viga con su ancho hacia el lado que le toca.
  const columnaFantasma =
    herramienta === "columna" && cursor && mpp !== null
      ? huellaDeColumna(
          {
            ...moldeDeColumna,
            id: "",
            nombre: "",
            p: cursor.punto,
            desde: null,
            arriba: null,
            visto: false,
          },
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
          {
            id: "",
            a: previo,
            b: cursor.punto,
            referencia,
            altura: null,
            ...(tipoDelMolde
              ? medidasDelMuro(tipoDelMolde)
              : { espesor, tarea: null, revestimiento: SIN_REVESTIMIENTO }),
            tipo: null,
            zocalo: { exterior: null, interior: null },
          },
          [],
          mpp,
          u
        )
      : null;
  const vigaEnCurso =
    (herramienta === "viga" || herramienta === "tabique") &&
    previo &&
    cursor &&
    mpp !== null &&
    !mismoPunto(previo, cursor.punto)
      ? huellaDeViga(
          herramienta === "tabique"
            ? { ancho: moldeDeTabique.ancho, referencia: moldeDeTabique.referencia, a: previo, b: cursor.punto }
            : { ...moldeDeViga, a: previo, b: cursor.punto },
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

  /**
   * Con qué arranca la terminación propia de un ambiente: las capas que hoy
   * le dan sus muros —las del lado de su tipo que da al ambiente—, para
   * cambiar sólo lo distinto. Sin muros con tipo, una capa vacía.
   */
  const capasDeLosMurosDe = (ambienteId: string): CapaDeMuro[] => {
    for (const cara of terminaciones?.caras ?? []) {
      if (cara.ambienteId !== ambienteId || cara.punta !== null) continue;
      const tipo = dibujo.muros.find((m) => m.id === cara.muroId)?.tipo;
      const delTipo = tipo ? mapaDeTipos.get(tipo) : undefined;
      if (delTipo) {
        const capas = delTipo[ladoDeCara(cara.lado, null)];
        if (capas.length > 0) return capas;
      }
    }
    return [{ ...CAPA_NUEVA }];
  };
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
        (m) =>
          m.id !== muroElegido.id &&
          (muroElegido.tipo ? m.tipo === null : m.tarea === null) &&
          Math.abs(m.espesor - muroElegido.espesor) < 1e-9
      )
    : [];
  const tipoDelElegido = muroElegido?.tipo ? mapaDeTipos.get(muroElegido.tipo) ?? null : null;
  const usosDelTipo = tipoDelElegido
    ? dibujo.muros.filter((m) => m.tipo === tipoDelElegido.id).length
    : 0;

  /**
   * El corte del muro elegido: su núcleo y, a cada lado, lo que lleva —las
   * capas de un tipo de antes contra el ladrillo, y encima las dibujadas en
   * alguna de sus caras, en el orden de la pila—, y a qué da cada lado.
   */
  const corteDelElegido = (() => {
    if (!muroElegido || mpp === null) return null;
    const delTipo = tipoDelElegido;
    const ladoDe = (lado: 1 | -1) => {
      const dibujadas = new Map<string, CapaDibujada>();
      for (const p of terminaciones?.piezas ?? []) {
        if (p.cara.muroId === muroElegido.id && p.cara.punta === null && p.cara.lado === lado) {
          dibujadas.set(p.capa.id, p.capa);
        }
      }
      const viejas = delTipo ? delTipo[lado === -1 ? "exterior" : "interior"] : [];
      return [
        ...viejas.map((c) => ({ id: undefined, tarea: c.tarea, espesor: c.espesor })),
        ...dibujadas.values(),
      ].map((c) => ({
        id: c.id,
        color: c.tarea ? colorDeCapa(c.tarea) : "#9a9a9a",
        espesor: c.espesor,
        nombre: c.tarea ? nombreDeCapa.get(c.tarea) ?? "?" : "Sin tarea",
      }));
    };
    const aQueDa = (lado: 1 | -1) => {
      const cara = carasDelMuro.find((c) => c.punta === null && c.lado === lado && c.ambienteId !== null);
      return cara ? nombreDeAmbiente(cara.ambienteId) : "Afuera";
    };
    const tareaDelNucleo = delTipo ? delTipo.nucleo.tarea : muroElegido.tarea;
    return {
      exterior: ladoDe(-1),
      interior: ladoDe(1),
      nucleo: {
        color: LADRILLO,
        espesor: delTipo ? delTipo.nucleo.espesor : muroElegido.espesor,
        nombre: tareaDelNucleo ? tipoPorId.get(tareaDelNucleo)?.nombre ?? "Ladrillo" : "Sin definir",
      },
      afuera: aQueDa(-1),
      adentro: aQueDa(1),
    };
  })();

  /**
   * Agrega una capa en una cara del muro elegido, de punta a punta, con lo del
   * molde de la herramienta Capa, y la elige para definirla. Va encima de lo
   * que ya tenga esa cara.
   */
  const agregarCapaAlLado = (lado: -1 | 1) => {
    if (!muroElegido) return;
    const rango = rangoDeLado(muroElegido.id, lado);
    if (!rango) return;
    const id = crypto.randomUUID();
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        capas: [
          ...dibujo.capas,
          {
            id,
            ...moldeDeCapa,
            tramos: [
              {
                muroId: muroElegido.id,
                cara: lado,
                desde: rango[0],
                hasta: rango[1],
              },
            ],
          },
        ],
      },
    });
    setMuroDeOrigen(muroElegido.id);
    setSeleccion({ tipo: "capa", id, tramo: 0 });
  };

  /** El largo de un muro por su línea marcada, en píxeles. */
  const largoDeMuro = (id: string) => {
    const m = dibujo.muros.find((x) => x.id === id);
    return m ? distancia(m.a, m.b) : 0;
  };

  /** Las capas dibujadas con espesor, como se ven en la planta —cortadas en
   *  los vanos—: entran en el contorno de los muros. */
  const formasDeCapas =
    mpp === null
      ? []
      : (terminaciones?.piezas ?? [])
          .filter((p) => p.capa.espesor > 0)
          .flatMap((p) => trozosEnPlanta(p, dibujo.aberturas, largoDeMuro(p.cara.muroId), mpp));

  /** Las piezas de capa que se dibujan: las de la planta y, encima, la que
   *  saldría con un clic. Nada si las capas están ocultas. */
  const piezasADibujar = ve("capas")
    ? [
        ...(terminaciones?.piezas ?? []).map((p) => ({ p, previa: false })),
        ...piezasDeLaPrevia.map((p) => ({ p, previa: true })),
      ]
    : [];

  /** Las capas dibujadas que lleva una cara del muro elegido, en orden. */
  const capasEnLaCara = (cara: Cara): CapaDibujada[] => {
    const ids = new Set(
      (terminaciones?.piezas ?? [])
        .filter((p) => p.cara.muroId === cara.muroId && (p.cara.punta ?? p.cara.lado) === (cara.punta ?? cara.lado))
        .filter((p) => p.cara.punta !== null || p.cara.ambienteId === cara.ambienteId)
        .map((p) => p.capa.id)
    );
    return dibujo.capas.filter((c) => ids.has(c.id));
  };

  /** Las capas dibujadas que lleva el muro elegido en alguna de sus caras. */
  const capasDelElegido = muroElegido
    ? dibujo.capas.filter((c) => c.tramos.some((tr) => tr.muroId === muroElegido.id))
    : [];

  /**
   * Le pone a una cara una capa —una que el muro ya lleva en otra cara, o una
   * nueva con lo del molde (`null`)—: un canto entero, o un lado de punta a
   * punta. Es como el revoque da la vuelta por la punta de un muro.
   */
  const ponerCapaEnCara = (capaId: string | null, cara: Cara) => {
    const largo = muroElegido ? distancia(muroElegido.a, muroElegido.b) : 0;
    if (!muroElegido || !(largo > 0)) return;
    const rango = cara.punta === null ? rangoDeLado(muroElegido.id, cara.lado) : ([0, 1] as const);
    if (!rango) return;
    const tramo: TramoDeCapa = {
      muroId: muroElegido.id,
      cara: cara.punta ?? cara.lado,
      desde: rango[0],
      hasta: rango[1],
    };
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        capas:
          capaId === null
            ? [...dibujo.capas, { id: crypto.randomUUID(), ...moldeDeCapa, tramos: [tramo] }]
            : dibujo.capas.map((c) =>
                c.id === capaId ? { ...c, tramos: juntar([...c.tramos, tramo]) } : c
              ),
      },
    });
  };

  /** Saca una capa de una cara del muro elegido; las demás caras quedan. */
  const quitarCapaDeCara = (capaId: string, cara: Cara) => {
    if (!muroElegido) return;
    const deLaCara = cara.punta ?? cara.lado;
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        capas: dibujo.capas
          .map((c) =>
            c.id === capaId
              ? {
                  ...c,
                  tramos: c.tramos.filter((tr) => !(tr.muroId === muroElegido.id && tr.cara === deLaCara)),
                }
              : c
          )
          .filter((c) => c.tramos.length > 0),
      },
    });
  };

  /**
   * Saca una capa de las caras de un muro y la deja en los demás. Si era el
   * único muro que la llevaba, la capa se va.
   */
  const quitarCapaDelMuro = (capaId: string, muroId: string) => {
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        capas: dibujo.capas
          .map((capa) =>
            capa.id === capaId
              ? { ...capa, tramos: capa.tramos.filter((tr) => tr.muroId !== muroId) }
              : capa
          )
          .filter((capa) => capa.tramos.length > 0),
      },
    });
  };

  /** Largo, mampostería sin vanos ni hormigón, y su volumen. */
  const medidasDelElegido = (() => {
    if (!muroElegido || mpp === null) return null;
    const alto = muroElegido.altura ?? alturaDePlanta;
    const prismas = prismasDeHormigon(estructura, mpp, alturaDePlanta, pisoAPiso);
    const { superficie } = mamposteriaDeMuro(muroElegido, dibujo.aberturas, prismas, mpp, alto, dibujo.muros);
    const espesor = tipoDelElegido ? tipoDelElegido.nucleo.espesor : muroElegido.espesor;
    return { largo: distancia(muroElegido.a, muroElegido.b) * mpp, superficie, volumen: superficie * espesor };
  })();

  /**
   * Lo que suman las capas dibujadas en cada canto del muro elegido —el
   * revoque de la punta suelta—, en metros: el muro terminado es así de más
   * largo que su línea.
   */
  const cantosDelElegido = (() => {
    const cantos = { a: 0, b: 0 };
    if (!muroElegido || mpp === null) return cantos;
    for (const p of terminaciones?.piezas ?? []) {
      if (p.cara.muroId !== muroElegido.id || p.cara.punta === null) continue;
      cantos[p.cara.punta] = Math.max(cantos[p.cara.punta], (p.n0 + p.grosor) * mpp);
    }
    return cantos;
  })();
  /** Lo que mide el muro elegido terminado: su línea más sus cantos. */
  const largoTerminado = medidasDelElegido
    ? medidasDelElegido.largo + cantosDelElegido.a + cantosDelElegido.b
    : null;

  /**
   * La punta del muro elegido que queda quieta al escribirle el largo: la
   * última que se tocó, o si no la que está unida a otro muro —la otra suele
   * ser la suelta—.
   */
  const puntaFijaDelElegido: "a" | "b" = (() => {
    if (!muroElegido) return "a";
    if (puntaFija?.id === muroElegido.id) return puntaFija.punta;
    const unida = (p: Punto) =>
      dibujo.muros.some((o) => o.id !== muroElegido.id && (mismoPunto(o.a, p) || mismoPunto(o.b, p)));
    return !unida(muroElegido.a) && unida(muroElegido.b) ? "b" : "a";
  })();

  /**
   * Le da al muro elegido el largo terminado que se escribe: la punta fija no
   * se mueve, y la otra va por la línea del muro hasta donde haga falta,
   * descontando el revoque de los cantos. Con las puntas unidas, lo que llega
   * a la punta que se mueve va con ella.
   */
  const darLargo = (total: number | null) => {
    if (!muroElegido || mpp === null || total === null) return;
    const marcado = total - cantosDelElegido.a - cantosDelElegido.b;
    if (!(marcado > 0.01)) return;
    const fija = puntaFijaDelElegido;
    const libre = fija === "a" ? "b" : "a";
    const desde = muroElegido[fija];
    const hasta = muroElegido[libre];
    const largo = distancia(desde, hasta);
    if (!(largo > 0)) return;
    const destino = {
      x: desde.x + ((hasta.x - desde.x) / largo) * (marcado / mpp),
      y: desde.y + ((hasta.y - desde.y) / largo) * (marcado / mpp),
    };
    const seMueve = (m: Muro, punta: "a" | "b") =>
      puntasJuntas ? mismoPunto(m[punta], hasta) : m.id === muroElegido.id && punta === libre;
    const muros = dibujo.muros.map((m) => ({
      ...m,
      a: seMueve(m, "a") ? destino : m.a,
      b: seMueve(m, "b") ? destino : m.b,
    }));
    cambiar({
      escala,
      dibujo: { ...dibujo, muros, aberturas: aberturasEnSuLugar(dibujo.aberturas, dibujo.muros, muros, mpp, u) },
    });
  };

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
      {dialogoDeConfirmacion}

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
          {/* El edificio armado con lo guardado: por eso es un enlace a otra
              pantalla y no una vista de lo que se está dibujando. */}
          <Link
            href={`/obras/${slug}/plantas/3d?desde=${planta.id}`}
            title={sucio ? "El 3D muestra lo guardado: guardá antes para ver estos cambios" : undefined}
            style={{ ...botonDeNiveles, textDecoration: "none" }}
          >
            3D
          </Link>
          <span style={nombreEnBarra}>{nombre || "Planta sin nombre"}</span>
        </div>

        <div style={ladoDeBarra}>
          {hayCapasDeAntes && (
            <button
              type="button"
              onClick={() => void pasarCapasDeLaObra()}
              disabled={sucio || pasandoCapas}
              title={sucio ? "Guardá antes de pasarlas" : undefined}
              style={botonDeNiveles}
            >
              {pasandoCapas ? "Pasando..." : "Pasar capas al dibujo"}
            </button>
          )}
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
              setPunteroDeCapa(null);
              setCursor(null);
              setFantasma(null);
              setGuias([]);
            }}
            onDoubleClick={() => {
              if (herramienta === "ambiente") cerrarAmbiente(enCurso);
              else if (herramienta === "losa") cerrarLosa(enCurso);
              else if (herramienta === "cajon") cerrarCajon(enCurso);
              else if (herramienta === "muro" || herramienta === "viga" || herramienta === "tabique") setEnCurso([]);
              else if (herramienta === "capa" && capaAMano) terminarCapaAMano();
            }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ display: "block", touchAction: "none", userSelect: "none" }}
          >
            {/* El rayado fino del hormigón, del mismo tamaño en la pantalla
                a cualquier zoom. */}
            <defs>
              <pattern
                id="rayado-de-hormigon"
                patternUnits="userSpaceOnUse"
                width={5 * u}
                height={5 * u}
                patternTransform="rotate(45)"
              >
                <line x1={0} y1={0} x2={0} y2={5 * u} stroke="#3a3a3a" strokeWidth={0.7 * u} />
              </pattern>
            </defs>
            {ve("plano") && (
              <image
                href={imagen.url}
                width={imagen.ancho}
                height={imagen.alto}
                preserveAspectRatio="none"
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* La arquitectura. En el modo de estructura queda de fondo: se ve,
                porque la estructura se dibuja mirándola, pero no se toca. */}
            <g opacity={modo === "estructura" ? 0.4 : 1}>
              {ve("ambientes") && dibujo.ambientes.map((a, i) => {
                const elegido = ambienteElegido?.id === a.id;
                const color = COLORES[i % COLORES.length];
                const centro = centroDe(a.puntos);
                return (
                  <g key={a.id}>
                    <polygon
                      points={a.puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill={PASTELES[i % PASTELES.length]}
                      fillOpacity={elegido ? 0.95 : 0.7}
                      stroke={elegido ? color : "none"}
                      strokeWidth={2 * u}
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

              {/* Los cajones de cielorraso, punteados como en un plano. */}
              {ve("cajones") && dibujo.cajones.map((c) => {
                const elegido = cajonElegido?.id === c.id;
                return (
                  <polygon
                    key={c.id}
                    points={c.puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill={elegido ? ACENTO : "#6b6b6b"}
                    fillOpacity={elegido ? 0.18 : 0.08}
                    stroke={elegido ? ACENTO : "#333333"}
                    strokeWidth={(elegido ? 2 : 1.3) * u}
                    strokeDasharray={`${6 * u} ${4 * u}`}
                    style={{ pointerEvents: tocable }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      lienzo.current?.focus({ preventScroll: true });
                      elegir({ tipo: "cajon", id: c.id });
                    }}
                  />
                );
              })}

              {/* Las capas de todos los muros van primero y los ladrillos
                  encima: en una esquina el ladrillo de un muro corta las capas
                  del otro, el revoque de afuera da la vuelta y el de adentro
                  se interrumpe donde llega el otro muro. */}
              {/* Cada pasada va en un grupo con su transparencia: donde dos
                  muros se pisan en la esquina el color no se oscurece, y la L
                  se lee pareja. */}
              {/* Los muros en corte, como en un plano: blancos, con el contorno
                  de afuera grueso. Primero cada pieza —ladrillo, capas de antes
                  y capas dibujadas— con un trazo grueso, y encima todas llenas
                  de blanco: de cada trazo queda sólo la mitad de afuera del
                  conjunto, así dos muros que se tocan se leen como uno. Después,
                  las líneas finas entre el ladrillo y sus capas. */}
              {ve("muros") && (
                <g style={{ pointerEvents: "none" }}>
                  {(["trazo", "relleno"] as const).map((pasada) => (
                    <g key={pasada}>
                      {[...fondoDePlanta, ...(ve("capas") ? formasDeCapas : [])].map((puntos, k) => (
                        <polygon
                          key={k}
                          points={puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                          fill={pasada === "relleno" ? "#ffffff" : "none"}
                          stroke={pasada === "trazo" ? "#1f1f1f" : "none"}
                          strokeWidth={pasada === "trazo" ? 3 * u : 0}
                          strokeLinejoin="miter"
                        />
                      ))}
                    </g>
                  ))}
                  {dibujo.muros.map((m) =>
                    (franjas.get(m.id) ?? []).map((f, k) => {
                      const elegido = muroElegido?.id === m.id;
                      const nucleo = f.clase === "nucleo";
                      // El ladrillo no lleva línea propia —la juntura entre dos
                      // muros no se dibuja—: sólo se tiñe el elegido o el
                      // encimado. Las capas de antes, su línea fina.
                      if (nucleo && !elegido && !encimados.has(m.id)) return null;
                      return (
                        <polygon
                          key={`${m.id}-${f.clase}-${k}`}
                          points={f.puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                          fill={nucleo ? (elegido ? "#fbd9c5" : "#fecaca") : elegido ? "#fdeee5" : "none"}
                          stroke={elegido ? ACENTO : "#7a7a7a"}
                          strokeWidth={(elegido ? 1.2 : 0.6) * u}
                        />
                      );
                    })
                  )}
                </g>
              )}

              {dibujo.muros.map((m) => {
                const cuerpo = cuerpos.get(m.id);
                if (!cuerpo || !ve("muros")) return null;
                const elegido = muroElegido?.id === m.id;
                const grosor = cuerpo.grosor;
                const largoEnPantalla = distancia(m.a, m.b) * v.k;
                return (
                  <g key={m.id}>
                    {/* El muro en corte: el núcleo con el color de siempre y
                        cada capa de los lados como una franja más clara, con
                        su espesor. Sin capas, el núcleo es todo el muro. Sin
                        remate en las puntas: el cuerpo ya viene estirado lo
                        justo en cada esquina (`cuerpoDeMuro`). */}
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
                    {mpp !== null && ve("cotas") && !elegido && largoEnPantalla > 70 && (
                      <Cota a={cuerpo.ejeA} b={cuerpo.ejeB} u={u} separacion={grosor / 2 + 9 * u}>
                        {formatMetros(distancia(m.a, m.b) * mpp)}
                      </Cota>
                    )}
                    {mpp !== null && elegido && (
                      <CotaDeMuro muro={m} cuerpo={cuerpo} mpp={mpp} u={u} cantos={cantosDelElegido} />
                    )}
                  </g>
                );
              })}

              {/* Las capas dibujadas, pegadas a las caras: cada una con el
                  color de su tarea; la que no tiene espesor —una pintura—,
                  como una línea. Encima, la que saldría con un clic. */}
              {piezasADibujar.map(({ p, previa }, i) => {
                const elegida = capaElegida?.id === p.capa.id;
                const color = elegida ? ACENTO : p.capa.tarea ? colorDeCapa(p.capa.tarea) : "#9a9a9a";
                const [a, b, c, d] = p.puntos;
                const medio = (x: Punto, y: Punto) => ({ x: (x.x + y.x) / 2, y: (x.y + y.y) / 2 });
                const desde = medio(a, d);
                const hasta = medio(b, c);
                return (
                  <g key={`${p.capa.id}-${i}`} opacity={previa ? 0.55 : 1}>
                    {/* Cortada en los vanos que la cruzan a su altura: en la
                        planta una puerta abre el revoque, aunque arriba de
                        ella el dintel se compute. */}
                    {(mpp === null
                      ? [p.capa.espesor > 0 ? p.puntos : [a, b]]
                      : trozosEnPlanta(p, dibujo.aberturas, largoDeMuro(p.cara.muroId), mpp)
                    ).map((trozo, k) =>
                      p.capa.espesor > 0 ? (
                        <polygon
                          key={k}
                          points={trozo.map((q) => `${q.x},${q.y}`).join(" ")}
                          fill={elegida || previa ? color : "#ffffff"}
                          stroke={elegida ? "#111111" : "#7a7a7a"}
                          strokeWidth={(elegida ? (seleccion?.tramo === p.tramo ? 2.5 : 1) : 0.6) * u}
                          style={{ pointerEvents: "none" }}
                        />
                      ) : (
                        <line
                          key={k}
                          x1={trozo[0].x}
                          y1={trozo[0].y}
                          x2={trozo[1].x}
                          y2={trozo[1].y}
                          stroke={color}
                          strokeWidth={2 * u}
                          style={{ pointerEvents: "none" }}
                        />
                      )
                    )}
                    {!previa && (
                      <line
                        x1={desde.x}
                        y1={desde.y}
                        x2={hasta.x}
                        y2={hasta.y}
                        stroke="transparent"
                        strokeWidth={Math.max(p.grosor, 12 * u)}
                        style={{
                          pointerEvents: tocable === "auto" || herramienta === "copiar" ? "stroke" : "none",
                        }}
                        onPointerDown={(e) => tocarPiezaDeCapa(e, p)}
                      />
                    )}
                  </g>
                );
              })}
              {/* Las puntas de los tramos de la capa elegida: se arrastran a lo
                  largo de la cara. Sólo donde termina el tramo, no donde lo
                  corta otro muro. */}
              {puntasDeLaCapa.map((h) => (
                <circle
                  key={h.clave}
                  cx={h.punto.x}
                  cy={h.punto.y}
                  r={5 * u}
                  fill="#ffffff"
                  stroke={ACENTO}
                  strokeWidth={2 * u}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => agarrarPuntaDeCapa(e, h.capaId, h.tramo, h.fin, h.cara)}
                />
              ))}

              {/* Los puntos ya marcados de la capa a mano. */}
              {herramienta === "capa" &&
                puntosDeCapa.map((q, i) => (
                  <circle
                    key={i}
                    cx={q.punto.x}
                    cy={q.punto.y}
                    r={3.5 * u}
                    fill={ACENTO}
                    style={{ pointerEvents: "none" }}
                  />
                ))}

              {/* Esquina: el primer muro, esperando el segundo. */}
              {herramienta === "esquina" &&
                primeroDeEsquina &&
                (() => {
                  // En la estructura, la viga elegida: su huella.
                  const huella = modo === "estructura" ? huellas.get(primeroDeEsquina) : undefined;
                  if (huella) {
                    return (
                      <polygon
                        points={huella.map((q) => `${q.x},${q.y}`).join(" ")}
                        fill={ACENTO}
                        fillOpacity={0.55}
                        style={{ pointerEvents: "none" }}
                      />
                    );
                  }
                  const cuerpo = cuerpos.get(primeroDeEsquina);
                  return cuerpo ? (
                    <line
                      x1={cuerpo.a.x}
                      y1={cuerpo.a.y}
                      x2={cuerpo.b.x}
                      y2={cuerpo.b.y}
                      stroke={ACENTO}
                      strokeOpacity={0.55}
                      strokeWidth={cuerpo.grosor}
                      strokeLinecap="butt"
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null;
                })()}

              {/* Cortar: las líneas por donde se puede partir el muro —las
                  caras de los muros que llegan a él—, y en rojo lleno la que
                  se usaría con un clic. */}
              {herramienta === "cortar" &&
                corte &&
                (() => {
                  const cuerpo = cuerpos.get(corte.muroId);
                  if (!cuerpo) return null;
                  const largo = distancia(cuerpo.ejeA, cuerpo.ejeB);
                  if (!(largo > 0)) return null;
                  const nx = -(cuerpo.ejeB.y - cuerpo.ejeA.y) / largo;
                  const ny = (cuerpo.ejeB.x - cuerpo.ejeA.x) / largo;
                  const medio = cuerpo.grosor / 2 + 10 * u;
                  const linea = (t: number, activa: boolean) => {
                    const c = {
                      x: cuerpo.ejeA.x + (cuerpo.ejeB.x - cuerpo.ejeA.x) * t,
                      y: cuerpo.ejeA.y + (cuerpo.ejeB.y - cuerpo.ejeA.y) * t,
                    };
                    return (
                      <line
                        key={(activa ? "a" : "p") + t}
                        x1={c.x - nx * medio}
                        y1={c.y - ny * medio}
                        x2={c.x + nx * medio}
                        y2={c.y + ny * medio}
                        stroke={ui.ROJO}
                        strokeWidth={(activa ? 2 : 1) * u}
                        strokeDasharray={activa ? undefined : `${4 * u} ${3 * u}`}
                        style={{ pointerEvents: "none" }}
                      />
                    );
                  };
                  return (
                    <g>
                      {corte.posibles.map((t) => linea(t, false))}
                      {linea(corte.t, true)}
                    </g>
                  );
                })()}

              {ve("aberturas") && dibujo.aberturas.map((ab) => {
                const muro = murosPorSuCuerpo.find((m) => m.id === ab.muroId);
                if (!muro) return null;
                const forma = formaDeAbertura(muro, ab.t, ab.ancho, mpp, u);
                const elegida = aberturaElegida?.id === ab.id;
                const color = COLOR_ABERTURA[ab.tipo];
                return (
                  <g key={ab.id}>
                    {/* Blanca encima del muro: un vano es un hueco en la pared.
                        La puerta, sin borde: la cierran sus marcos. */}
                    <polygon
                      points={forma.puntos}
                      fill="#ffffff"
                      stroke={elegida ? ACENTO : ab.tipo === "puerta" ? "none" : color}
                      strokeWidth={(elegida ? 2.5 : 1.5) * u}
                      style={{
                        pointerEvents: herramienta === "copiar" ? "auto" : tocable,
                        cursor: herramienta === "seleccionar" ? "move" : herramienta === "copiar" ? "copy" : undefined,
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        lienzo.current?.focus({ preventScroll: true });
                        if (herramienta === "copiar") {
                          e.stopPropagation();
                          tocarAberturaParaCopiar(ab);
                          return;
                        }
                        elegir({ tipo: "abertura", id: ab.id });
                        agarrar(e, { tipo: "abertura", id: ab.id });
                      }}
                    />
                    {ab.tipo === "puerta" &&
                      (() => {
                        const puerta = puertaEnPlanta(forma, ab.mano ?? "derecha", ab.lado, mpp, u, ab.marco);
                        const trazo = elegida ? ACENTO : "#1f1f1f";
                        return (
                          <g style={{ pointerEvents: "none" }}>
                            {/* Donde termina el muro, de cara a cara: como el
                                contorno de los muros. */}
                            {puerta.jambas.map((j, k) => (
                              <polyline key={`j${k}`} points={j} fill="none" stroke="#1f1f1f" strokeWidth={1.5 * u} />
                            ))}
                            {puerta.marcos.map((m, k) => (
                              <polygon key={k} points={m} fill="#ffffff" stroke={trazo} strokeWidth={0.9 * u} />
                            ))}
                            <polygon points={puerta.hoja} fill="#ffffff" stroke={trazo} strokeWidth={0.9 * u} />
                            <path d={puerta.arco} fill="none" stroke={trazo} strokeWidth={0.7 * u} />
                          </g>
                        );
                      })()}
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
            {mpp !== null && hayEstructura && ve("estructura") && (
              <g opacity={modo === "estructura" ? 1 : 0.7}>
                {estructura.losas.map((l) => {
                  const elegida = losaElegida?.id === l.id;
                  const centro = centroDe(l.puntos);
                  return (
                    <g key={l.id}>
                      <polygon
                        points={enPuntos(l.puntos)}
                        fill={HORMIGON}
                        fillOpacity={elegida ? 0.2 : 0.04}
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
                  // Como se dibuja en planta según el plano de corte: la de
                  // arriba en proyección —sólo su contorno, de trazos—, la de
                  // abajo en gris claro, y la que el plano atraviesa cortada,
                  // rayada como las columnas.
                  const medida = vigasMedidas.get(v.id);
                  const donde = medida ? enElCorte(medida.desde, medida.hasta) : "arriba";
                  const linea = elegida ? ACENTO : donde === "abajo" ? GRIS_BAJO_EL_CORTE : metalica ? ACERO : "#1f1f1f";
                  return (
                    <g key={v.id}>
                      {donde === "cortada" && !metalica && (
                        <polygon points={enPuntos(huella)} fill="#ffffff" style={{ pointerEvents: "none" }} />
                      )}
                      <polygon
                        points={enPuntos(huella)}
                        fill={
                          elegida
                            ? ACENTO
                            : donde === "abajo"
                              ? FONDO_BAJO_EL_CORTE
                              : donde === "cortada" && !metalica
                                ? "url(#rayado-de-hormigon)"
                                : "none"
                        }
                        fillOpacity={elegida ? 0.3 : 1}
                        stroke={linea}
                        strokeWidth={(donde === "cortada" ? 1.4 : 0.9) * u}
                        strokeDasharray={donde === "arriba" ? `${6 * u} ${3 * u}` : undefined}
                        style={{ pointerEvents: "none" }}
                      />
                      {metalica && (
                        <line
                          x1={ejeA.x}
                          y1={ejeA.y}
                          x2={ejeB.x}
                          y2={ejeB.y}
                          stroke={linea}
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
                      {/* La de hormigón, blanca abajo del rayado: tapa lo que
                          tenga debajo. */}
                      {!metalica && (
                        <polygon points={enPuntos(huella)} fill="#ffffff" style={{ pointerEvents: "none" }} />
                      )}
                      <polygon
                        points={enPuntos(huella)}
                        fill={metalica ? "#ffffff" : elegida ? ACENTO : "url(#rayado-de-hormigon)"}
                        fillOpacity={metalica ? 0.9 : elegida ? 0.55 : 1}
                        stroke={metalica ? color : elegida ? ACENTO : "#1f1f1f"}
                        strokeWidth={(metalica ? 2 : 1.4) * u}
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
                    d={puertaEnPlanta(formaDelFantasma, molde.mano, fantasma.lado, mpp, u).arco}
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
              // Las capas ya se ven en el corte del muro: la línea es sólo para
              // las caras del muro elegido, que se tocan para elegir cuál se
              // termina.
              const deAntes = cara.capas.some((c) => !c.dibujada);
              if (!delMuroElegido) return null;

              const largo = cara.largo || 1;
              // Hacia afuera del muro, para que la línea no pise el cuerpo ni
              // sus capas dibujadas.
              const nx = (-(cara.b.y - cara.a.y) / largo) * cara.lado;
              const ny = ((cara.b.x - cara.a.x) / largo) * cara.lado;
              const acabado = dibujo.muros.find((m) => m.id === cara.muroId)?.acabado;
              const encima =
                mpp !== null && acabado && cara.punta === null
                  ? (cara.lado === -1 ? acabado.exterior : acabado.interior) / mpp
                  : 0;
              const elegida =
                delMuroElegido && (cara.clave === caraElegida || cara.clave === caraSenalada);
              // Azul: el muro elegido ya va en el color de acento.
              const color = elegida
                ? AZUL
                : deAntes
                  ? colorDeCapa(cara.capas[cara.capas.length - 1].tarea)
                  : "#9ca3af";
              const corrida = (desde: Punto, hasta: Punto, cuanto: number) => ({
                x1: desde.x + nx * (cuanto + encima),
                y1: desde.y + ny * (cuanto + encima),
                x2: hasta.x + nx * (cuanto + encima),
                y2: hasta.y + ny * (cuanto + encima),
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
                        strokeWidth={(elegida ? 6 : deAntes ? 3 : 1.5) * (parte.tipo === "pano" ? 1 : 0.5) * u}
                        strokeDasharray={
                          !elegida && !deAntes ? `${4 * u} ${3 * u}` : undefined
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
                </g>
              );
            })}

            {/* El velo del modo cielorraso: todo lo dibujado hasta acá queda
                atrás, lavado, y lo que sigue —el cielorraso, su buña y las
                agarraderas— se lee limpio encima. Más barato y más parejo que
                atenuar cada cosa por su lado. */}
            {enCielorraso && tamano && (
              <rect
                x={v.x}
                y={v.y}
                width={tamano.w / v.k}
                height={tamano.h / v.k}
                fill="#ffffff"
                opacity={0.72}
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* El cielorraso del ambiente elegido, como figura llena: en el
                modo cielorraso es lo que se está dibujando. */}
            {enCielorraso && ambienteElegido && contornoDelCielorraso.length >= 3 && (
              <polygon
                points={contornoDelCielorraso.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={BUNA}
                fillOpacity={0.12}
                stroke={BUNA}
                strokeWidth={1.5 * u}
                strokeDasharray={`${7 * u} ${4 * u}`}
                style={{ pointerEvents: tocableDelCielorraso }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  // Tocar el cielorraso vuelve a ponerlo a él al alcance de
                  // la mano: es la forma de salir de la buña sin salir del
                  // modo.
                  elegir({ tipo: "ambiente", id: ambienteElegido.id });
                }}
              />
            )}

            {/* Las buñas: la línea por donde termina el cielorraso. Van
                después de todo el plano —los muros se dibujan llenos de
                blanco y la taparían, porque corre justo sobre la cara—, lado
                por lado: los apagados no se dibujan. Se elige aparte del
                ambiente, que es lo que deja correrle los bordes. */}
            {(ve("bunas") || enCielorraso) && dibujo.ambientes.map((a) =>
              ladosDeBuna(anilloDeBuna(a))
                .filter((lado) => lado.lleva)
                .map((lado) => (
                  <g key={`buna-${a.id}-${lado.indice}`}>
                    {/* Una línea de 2 px no se puede agarrar: el clic va a
                        esta, ancha y transparente, como en los lados de un
                        ambiente. */}
                    <line
                      x1={lado.a.x}
                      y1={lado.a.y}
                      x2={lado.b.x}
                      y2={lado.b.y}
                      stroke="transparent"
                      strokeWidth={10 * u}
                      style={{
                        pointerEvents: tocableDelCielorraso === "auto" ? "stroke" : "none",
                        cursor: "pointer",
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        lienzo.current?.focus({ preventScroll: true });
                        elegir({ tipo: "buna", id: a.id });
                      }}
                    />
                    <line
                      x1={lado.a.x}
                      y1={lado.a.y}
                      x2={lado.b.x}
                      y2={lado.b.y}
                      stroke={BUNA}
                      strokeWidth={(bunaElegida?.id === a.id ? 3.5 : 2) * u}
                      strokeLinecap="round"
                      style={{ pointerEvents: "none" }}
                    />
                  </g>
                ))
            )}

            {/* Los vértices de lo seleccionado, para arrastrarlos. */}
            {herramienta === "seleccionar" && muroElegido && (
              <>
                {/* La punta fija —la última que se tocó— va llena: es desde
                    donde se mide el largo que se escribe. */}
                {[muroElegido.a, muroElegido.b].map((p, i) => {
                  const fija = puntaFijaDelElegido === (i === 0 ? "a" : "b");
                  return (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={6 * u}
                      fill={fija ? ACENTO : "#ffffff"}
                      stroke={fija ? "#ffffff" : ACENTO}
                      strokeWidth={2 * u}
                      style={{ cursor: "move" }}
                      onPointerDown={(e) => {
                        if (e.button === 0) setPuntaFija({ id: muroElegido.id, punta: i === 0 ? "a" : "b" });
                        agarrar(e, {
                          tipo: "muro",
                          id: muroElegido.id,
                          punta: i === 0 ? "a" : "b",
                          desde: p,
                          eje: ejeDesde(i === 0 ? muroElegido.b : muroElegido.a, p),
                        });
                      }}
                    />
                  );
                })}
                {/* El medio de su línea: de ahí se lo mueve entero. */}
                <rect
                  x={(muroElegido.a.x + muroElegido.b.x) / 2 - 5 * u}
                  y={(muroElegido.a.y + muroElegido.b.y) / 2 - 5 * u}
                  width={10 * u}
                  height={10 * u}
                  fill={ACENTO}
                  stroke="#ffffff"
                  strokeWidth={1.5 * u}
                  style={{ cursor: "move" }}
                  onPointerDown={(e) =>
                    agarrar(e, { tipo: "muroEntero", id: muroElegido.id, inicio: aPlano(e) })
                  }
                />
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
                        lleva:
                          contorno.de === "buna"
                            ? anilloElegido.map((v) => v.lleva)
                            : undefined,
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
                  stroke={colorDelContorno}
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

            {/* Con la buña elegida, el punto del medio de cada lado dice si
                ese borde lleva: relleno sí, hueco no. Un clic lo cambia. */}
            {herramienta === "seleccionar" &&
              contorno?.de === "buna" &&
              ladosDeBuna(anilloElegido).map((lado) => {
                // El punto va corrido hacia adentro del anillo y no sobre la
                // línea: el medio del lado es de donde se lo agarra para
                // correrlo, y un punto ahí se queda con ese clic.
                const centro = centroDe(anilloElegido.map((p) => ({ x: p.x, y: p.y })));
                const mitad = {
                  x: (lado.a.x + lado.b.x) / 2,
                  y: (lado.a.y + lado.b.y) / 2,
                };
                const hacia = { x: centro.x - mitad.x, y: centro.y - mitad.y };
                const lejos = Math.hypot(hacia.x, hacia.y) || 1;
                const corrida = Math.min(11 * u, lejos / 2);
                const medio = {
                  x: mitad.x + (hacia.x / lejos) * corrida,
                  y: mitad.y + (hacia.y / lejos) * corrida,
                };
                return (
                  <circle
                    key={`llevaBuna-${lado.indice}`}
                    cx={medio.x}
                    cy={medio.y}
                    r={5 * u}
                    fill={lado.lleva ? BUNA : "#ffffff"}
                    stroke={BUNA}
                    strokeWidth={2 * u}
                    style={{ cursor: "pointer" }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      cambiar(conBuna(contorno.id, conLadoCambiado(anilloElegido, lado.indice)));
                    }}
                  />
                );
              })}

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
          <div style={ayudas}>
            {(marcando || herramienta === "seleccionar") && (
              <>
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
              </>
            )}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setCapasAbiertas(!capasAbiertas)}
                aria-expanded={capasAbiertas}
                style={botonDeCapas}
              >
                <IconoHerramienta nombre="capa" size={14} />
                Capas
                {ocultas > 0 && <span style={{ color: ACENTO }}>· {ocultas}</span>}
              </button>
              {capasAbiertas && (
                <div style={menuDeCapas}>
                  {CAPAS_DE_VISTA.map((c) => (
                    <label key={c.valor} style={ayuda}>
                      <input
                        type="checkbox"
                        checked={ve(c.valor)}
                        onChange={(e) => ponerCapaDeVista(c.valor, e.target.checked)}
                      />
                      {c.nombre}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p style={pista}>
            {pistaDe(
              herramienta,
              modo,
              herramienta === "capa" ? puntosDeCapa.length : enCurso.length,
              reglaMarcada !== null,
              copiado !== null,
              capaAMano
            )}
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
              <section style={bloqueDePanel}>
                <Encabezado
                  icono={
                    copiado?.de === "muro" ? "muro" : copiado?.de === "abertura" ? "abertura" : copiado ? "ambiente" : "copiar"
                  }
                  color={copiado?.de === "muro" ? LADRILLO : copiado ? "#3b6fb6" : "#9a9a9a"}
                  titulo={
                    copiado?.de === "muro"
                      ? copiado.tipo
                        ? mapaDeTipos.get(copiado.tipo)?.nombre ?? "Muro"
                        : copiado.tarea
                          ? tipoPorId.get(copiado.tarea)?.nombre ?? "Muro"
                          : "Muro sin tipo"
                      : copiado?.de === "abertura"
                        ? copiado.nombre || NOMBRE_TIPO[copiado.tipo]
                        : copiado?.de === "ambiente"
                          ? copiado.nombre || "Ambiente"
                          : "Copiar"
                  }
                  detalle={copiado ? "Tocá los que van igual" : "Tocá un muro, una abertura o un ambiente"}
                >
                  {copiado && <BotonIcono icono="quitar" nombre="Tomar otro" onClick={() => setCopiado(null)} />}
                </Encabezado>
                {copiado?.de === "muro" && (
                  <Seccion titulo="Se lleva">
                    <Fila icono="espesor" nombre="Espesor">
                      <Pastilla>{formatEspesor(copiado.espesor)}</Pastilla>
                    </Fila>
                    <Fila icono="altura" nombre="Altura">
                      <Pastilla apagada={copiado.altura === null}>
                        {copiado.altura === null ? formatMedida(alturaDePlanta) : formatMedida(copiado.altura)}
                      </Pastilla>
                    </Fila>
                    <Fila icono="zocalo" nombre="Zócalos">
                      <Pastilla apagada={!copiado.zocalo.exterior && !copiado.zocalo.interior}>
                        {[copiado.zocalo.exterior, copiado.zocalo.interior]
                          .map((z) => (z ? nombreDeCapa.get(z) ?? "?" : "—"))
                          .join(" / ")}
                      </Pastilla>
                    </Fila>
                    <Fila icono="capa" nombre="Capas">
                      <Pastilla apagada={copiado.capas.length === 0}>
                        <span style={{ display: "flex", gap: "3px" }}>
                          {[...new Set(copiado.capas.map((c) => c.capaId))].map((id) => {
                            const tarea = dibujo.capas.find((c) => c.id === id)?.tarea;
                            return (
                              <span
                                key={id}
                                title={tarea ? nombreDeCapa.get(tarea) ?? "?" : "Sin tarea"}
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 2,
                                  background: tarea ? colorDeCapa(tarea) : "#9a9a9a",
                                }}
                              />
                            );
                          })}
                        </span>
                        {new Set(copiado.capas.map((c) => c.capaId)).size || "ninguna"}
                      </Pastilla>
                    </Fila>
                  </Seccion>
                )}
                {copiado?.de === "abertura" && (
                  <Seccion titulo="Se lleva">
                    <Fila icono="espesor" nombre="Medidas">
                      <Pastilla>
                        {formatMedida(copiado.ancho)} × {formatMedida(copiado.alto)}
                      </Pastilla>
                    </Fila>
                    {copiado.tipo === "ventana" ? (
                      <>
                        <Fila icono="altura" nombre="Antepecho">
                          <Pastilla apagada={copiado.antepecho === null}>
                            {copiado.antepecho === null ? "—" : formatMedida(copiado.antepecho)}
                          </Pastilla>
                        </Fila>
                        <Fila icono="abertura" nombre="Abre">
                          <Pastilla apagada={copiado.apertura === null}>
                            {copiado.apertura === null
                              ? "—"
                              : `${nombreDeApertura(copiado.apertura)}${copiado.hojas ? ` · ${copiado.hojas}` : ""}`}
                          </Pastilla>
                        </Fila>
                      </>
                    ) : (
                      <Fila icono="abertura" nombre="Mano">
                        <Pastilla>{copiado.mano === "izquierda" ? "Izquierda" : "Derecha"}</Pastilla>
                      </Fila>
                    )}
                  </Seccion>
                )}
                {copiado?.de === "ambiente" && (
                  <Seccion titulo="Se lleva">
                    <Fila icono="piso" nombre="Piso">
                      <Pastilla apagada={copiado.piso.length === 0}>
                        {copiado.piso.length === 0 ? "—" : resumenDeCapas(copiado.piso, nombreDeCapa)}
                      </Pastilla>
                    </Fila>
                    <Fila icono="tipo" nombre="Cielorraso">
                      <Pastilla apagada={copiado.cielorraso.length === 0}>
                        {copiado.cielorraso.length === 0 ? "—" : resumenDeCapas(copiado.cielorraso, nombreDeCapa)}
                        {copiado.alturaCielorraso !== null && ` · ${formatMedida(copiado.alturaCielorraso)}`}
                      </Pastilla>
                    </Fila>
                  </Seccion>
                )}
              </section>
            )}

            {herramienta === "esquina" && avisoDeEsquina && (
              <section style={bloque}>
                <p style={alerta}>{avisoDeEsquina}</p>
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
                  <span style={rotulo}>Tipología</span>
                  <select
                    value={aberturaDelMolde ? aberturaDelMolde.nombre : NUEVO_TIPO}
                    onChange={(e) => {
                      const t = tiposDeAberturas.find(
                        (x) => x.tipo === tipoAbertura && x.nombre === e.target.value
                      );
                      if (t) usarTipoDeAbertura(t);
                      else nuevoTipoDeAbertura();
                    }}
                    style={ui.input}
                  >
                    {tiposDeAberturas
                      .filter((t) => t.tipo === tipoAbertura)
                      .map((t) => (
                        <option key={t.nombre} value={t.nombre}>
                          {t.nombre} · {formatMedidaFina(t.ancho)} × {formatMedidaFina(t.alto)}
                          {t.tipo === "puerta" && t.marco !== null ? ` · marco ${formatEspesor(t.marco)}` : ""}
                        </option>
                      ))}
                    <option value={NUEVO_TIPO}>+ Nuevo tipo</option>
                  </select>
                </label>
                {!aberturaDelMolde && (
                  <label style={campo}>
                    <span style={rotulo}>Nombre</span>
                    <input
                      type="text"
                      value={molde.nombre}
                      onChange={(e) => cambiarMolde("nombre", e.target.value)}
                      style={ui.input}
                    />
                  </label>
                )}
                <div style={dosCampos}>
                  <label style={campo}>
                    <span style={rotulo}>Ancho (m)</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={molde.ancho}
                      onChange={(e) => medirMolde("ancho", e.target.value)}
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
                      onChange={(e) => medirMolde("alto", e.target.value)}
                      style={ui.input}
                    />
                  </label>
                </div>
                {tipoAbertura === "ventana" && (
                  <CamposDeApertura
                    apertura={molde.apertura}
                    hojas={molde.hojas}
                    alCambiar={cambiarDelMolde}
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
                  <>
                    <label style={campo}>
                      <span style={rotulo}>Marco</span>
                      <SelectorDeMarco
                        key={molde.nombre}
                        valor={molde.marco}
                        alCambiar={(marco) => cambiarDelMolde({ marco })}
                      />
                    </label>
                    <CampoMano
                      valor={molde.mano}
                      alCambiar={(mano) =>
                        setMoldes({ ...moldes, puerta: { ...moldes.puerta, mano } })
                      }
                    />
                  </>
                )}
                <TareasDeAbertura
                  tareas={molde.tareas}
                  catalogo={tareasDelCatalogo}
                  alCambiar={(tareas) => cambiarDelMolde({ tareas })}
                />
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
                    <label style={campo}>
                      <span style={rotulo}>Marco</span>
                      <SelectorDeMarco
                        key={aberturaElegida.id}
                        valor={aberturaElegida.marco}
                        alCambiar={(marco) => cambiarTipo(aberturaElegida, { marco })}
                      />
                    </label>
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
                <TareasDeAbertura
                  tareas={aberturaElegida.tareas}
                  catalogo={tareasDelCatalogo}
                  alCambiar={(tareas) => cambiarTipo(aberturaElegida, { tareas })}
                />
                <Renglon nombre="Vano">
                  {formatM2(aberturaElegida.ancho * aberturaElegida.alto)}
                </Renglon>
                <button type="button" onClick={borrarSeleccion} style={botonBorrar}>
                  Borrar {NOMBRE_TIPO[aberturaElegida.tipo].toLowerCase()}
                </button>
              </section>
            )}

            {herramienta === "capa" && (
              <section style={bloqueDePanel}>
                <Encabezado
                  icono="capa"
                  color={moldeDeCapa.tarea ? colorDeCapa(moldeDeCapa.tarea) : "#9a9a9a"}
                  titulo="Capa nueva"
                  detalle={capaAMano ? "A mano, sobre las caras" : "Por todo el perímetro"}
                />
                <Seccion titulo="Cómo">
                  <Fila icono="capa" nombre="Se pone">
                    <Segmentado
                      valor={capaAMano ? "mano" : "ambiente"}
                      opciones={[
                        { valor: "ambiente", nombre: "Por ambiente", figura: <FiguraDeModo aMano={false} /> },
                        { valor: "mano", nombre: "A mano", figura: <FiguraDeModo aMano /> },
                      ]}
                      alCambiar={(m) => {
                        setCapaAMano(m === "mano");
                        setPuntosDeCapa([]);
                      }}
                    />
                  </Fila>
                </Seccion>
                <Seccion titulo="Capa">
                  <CamposDeCapa
                    capa={moldeDeCapa}
                    tareas={tareasDeCapa}
                    alto={alturaDePlanta}
                    alCambiar={(cambios) => setMoldeDeCapa({ ...moldeDeCapa, ...cambios })}
                  />
                </Seccion>
                {capaAMano && puntosDeCapa.length > 1 && (
                  <button type="button" onClick={terminarCapaAMano} style={botonChico}>
                    Terminar
                  </button>
                )}
              </section>
            )}

            {herramienta === "cajon" && !cajonElegido && (
              <section style={bloqueDePanel}>
                <Encabezado icono="cajon" color="#6b6b6b" titulo="Cajón nuevo" detalle="Su contorno, como un ambiente" />
                <Seccion titulo="Cajón">
                  <Fila icono="altura" nombre="Fondo">
                    <CampoNumero
                      valor={moldeDeCajon.fondo}
                      unidad="m"
                      paso={0.05}
                      vacio={formatMedida(Math.max(alturaDePlanta - 0.2, 0.1))}
                      alCambiar={(fondo) => setMoldeDeCajon({ ...moldeDeCajon, fondo: fondo && fondo > 0 ? fondo : null })}
                    />
                  </Fila>
                </Seccion>
                <Seccion titulo="Capas" cuenta={moldeDeCajon.capas.length}>
                  <EditorDeCapas
                    capas={moldeDeCajon.capas}
                    disponibles={capasDisponibles}
                    primero={RUBROS_DE_CIELORRASO}
                    conTotal
                    alCambiar={(capas) => setMoldeDeCajon({ ...moldeDeCajon, capas })}
                  />
                </Seccion>
              </section>
            )}

            {cajonElegido && (
              <section style={bloqueDePanel}>
                <Encabezado
                  icono="cajon"
                  color="#6b6b6b"
                  titulo="Cajón"
                  detalle={
                    medidaDelCajon?.ambienteId
                      ? dibujo.ambientes.find((a) => a.id === medidaDelCajon.ambienteId)?.nombre || "Ambiente sin nombre"
                      : "Sin ambiente"
                  }
                >
                  <BotonIcono icono="borrar" nombre="Borrar cajón" peligro onClick={borrarSeleccion} />
                </Encabezado>
                <Seccion titulo="Cajón">
                  <Fila icono="altura" nombre="Fondo">
                    <CampoNumero
                      key={cajonElegido.id}
                      valor={cajonElegido.fondo}
                      unidad="m"
                      paso={0.05}
                      alCambiar={(fondo) => fondo !== null && fondo > 0 && cambiarCajon(cajonElegido.id, { fondo })}
                    />
                  </Fila>
                  <Fila icono="cajon" nombre="Frente">
                    <Pastilla apagada>{formatMedida(medidaDelCajon?.alto ?? 0)} m</Pastilla>
                  </Fila>
                </Seccion>
                <Seccion titulo="Capas" cuenta={cajonElegido.capas.length}>
                  <EditorDeCapas
                    capas={cajonElegido.capas}
                    disponibles={capasDisponibles}
                    primero={RUBROS_DE_CIELORRASO}
                    conTotal
                    alCambiar={(capas) => cambiarCajon(cajonElegido.id, { capas })}
                  />
                </Seccion>
                {medidaDelCajon && (
                  <Medidas
                    valores={[
                      { valor: formatM2(medidaDelCajon.area), nombre: "fondo" },
                      { valor: formatMetros(medidaDelCajon.frentes), nombre: "de frente" },
                      { valor: formatM2(medidaDelCajon.superficie), nombre: "en total" },
                    ]}
                  />
                )}
              </section>
            )}

            {herramienta === "seleccionar" && capaElegida && (
              <section style={bloqueDePanel}>
                <Encabezado
                  icono="capa"
                  color={capaElegida.tarea ? colorDeCapa(capaElegida.tarea) : "#9a9a9a"}
                  titulo={
                    capaElegida.tarea
                      ? nombreDeCapa.get(capaElegida.tarea) ?? "Tarea que ya no está"
                      : "Capa sin tarea"
                  }
                  detalle={capaElegida.tarea ? tipoPorId.get(capaElegida.tarea)?.rubro : undefined}
                >
                  {muroDeOrigen && dibujo.muros.some((m) => m.id === muroDeOrigen) && (
                    <BotonIcono
                      icono="muro"
                      nombre="Volver al muro"
                      onClick={() => elegir({ tipo: "muro", id: muroDeOrigen })}
                    />
                  )}
                  <BotonIcono icono="borrar" nombre="Borrar capa" peligro onClick={borrarSeleccion} />
                </Encabezado>
                <Seccion titulo="Capa">
                  <CamposDeCapa
                    capa={capaElegida}
                    tareas={tareasDeCapa}
                    alto={alturaDePlanta}
                    alCambiar={(cambios) => cambiarCapa(capaElegida.id, cambios)}
                  />
                </Seccion>
                {pilaDeLaCapa.length > 1 && (
                  <Seccion titulo="Pila" cuenta={pilaDeLaCapa.length}>
                    <Pila
                      capas={pilaDeLaCapa.map((c) => ({
                        id: c.id,
                        color: c.tarea ? colorDeCapa(c.tarea) : "#9a9a9a",
                        nombre: c.tarea ? nombreDeCapa.get(c.tarea) ?? "Tarea que ya no está" : "Sin tarea",
                        espesor: formatEspesor(c.espesor),
                      }))}
                      elegida={capaElegida.id}
                      alElegir={(id) => elegir({ tipo: "capa", id })}
                      alMover={moverCapaA}
                    />
                  </Seccion>
                )}
                <Seccion titulo="Tramos" cuenta={capaElegida.tramos.length}>
                  <MiniPlanta
                    fondo={fondoDePlanta}
                    piezas={piezasDeLaElegida.map((p) => ({
                      puntos: p.capa.espesor > 0 ? p.puntos : [p.puntos[0], p.puntos[1]],
                      color: capaElegida.tarea ? colorDeCapa(capaElegida.tarea) : "#9a9a9a",
                      elegida: seleccion?.tramo === p.tramo,
                      linea: !(p.capa.espesor > 0),
                      tramo: p.tramo,
                    }))}
                    alElegir={(tramo) => setSeleccion({ tipo: "capa", id: capaElegida.id, tramo })}
                  />
                  {seleccion?.tramo !== undefined && capaElegida.tramos.length > 1 && (
                    <button type="button" onClick={quitarTramo} style={botonChico}>
                      Quitar tramo
                    </button>
                  )}
                </Seccion>
                <Medidas
                  valores={[
                    { valor: formatM2(superficieDeLaCapa), nombre: "superficie" },
                    { valor: formatM3(superficieDeLaCapa * capaElegida.espesor), nombre: "volumen" },
                    { valor: formatMetros(largoDeLaCapa), nombre: "largo" },
                  ]}
                />
              </section>
            )}

            {herramienta === "muro" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Muro</h3>
                <SelectorDeTipo
                  valor={tipoMolde}
                  tipos={tipos}
                  alCambiar={setTipoMolde}
                  alCrear={() => crearTipo(null)}
                />
                {tipoDelMolde ? (
                  <>
                    <input
                      type="text"
                      value={tipoDelMolde.nombre}
                      onChange={(e) => cambiarTipoDeMuro(tipoDelMolde.id, { nombre: e.target.value })}
                      aria-label="Nombre del tipo"
                      style={ui.input}
                    />
                    <TipoDeMuroEditor
                      composicion={tipoDelMolde}
                      tareas={tareasDeCapa}
                      alCambiar={(composicion) => cambiarTipoDeMuro(tipoDelMolde.id, { composicion })}
                    />
                    {!dibujo.muros.some((m) => m.tipo === tipoDelMolde.id) && (
                      <button
                        type="button"
                        onClick={() => borrarTipo(tipoDelMolde.id)}
                        style={botonBorrar}
                      >
                        Borrar tipo
                      </button>
                    )}
                  </>
                ) : (
                  <div style={dosCampos}>
                    <label style={campo}>
                      <span style={rotulo}>Mampostería</span>
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
                  </div>
                )}
                {errorDeTipo && <p style={alerta}>{errorDeTipo}</p>}
                <label style={campo}>
                  <span style={rotulo}>Línea de referencia</span>
                  <SelectorReferencia
                    valor={referencia}
                    opciones={REFERENCIAS_DE_MURO}
                    alCambiar={setReferencia}
                  />
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
                {moldeDeColumna.material !== "metalica" && (
                  <TareaDePieza
                    valor={moldeDeColumna.tarea}
                    tipos={tareasDePieza(tiposDeMuro, "columnas")}
                    alCambiar={(tarea) => setMoldeDeColumna({ ...moldeDeColumna, tarea })}
                  />
                )}
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
                {moldeDeViga.material !== "metalica" && (
                  <TareaDePieza
                    valor={moldeDeViga.tarea}
                    tipos={tareasDePieza(tiposDeMuro, "vigas")}
                    alCambiar={(tarea) => setMoldeDeViga({ ...moldeDeViga, tarea })}
                  />
                )}
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

            {herramienta === "tabique" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Tabique</h3>
                <label style={campo}>
                  <span style={rotulo}>Nombre</span>
                  <input
                    type="text"
                    value={moldeDeTabique.nombre}
                    placeholder={proximoTabique}
                    onChange={(e) => setMoldeDeTabique({ ...moldeDeTabique, nombre: e.target.value })}
                    style={ui.input}
                  />
                </label>
                <TareaDePieza
                  valor={moldeDeTabique.tarea}
                  tipos={tareasDePieza(tiposDeMuro, "tabiques")}
                  alCambiar={(tarea) => setMoldeDeTabique({ ...moldeDeTabique, tarea })}
                />
                <label style={campo}>
                  <span style={rotulo}>Espesor (m)</span>
                  <CampoMetros
                    valor={moldeDeTabique.ancho}
                    alCambiar={(ancho) => setMoldeDeTabique({ ...moldeDeTabique, ancho })}
                  />
                </label>
                <label style={campo}>
                  <span style={rotulo}>Línea de referencia</span>
                  <SelectorReferencia
                    valor={moldeDeTabique.referencia}
                    alCambiar={(referencia) => setMoldeDeTabique({ ...moldeDeTabique, referencia })}
                  />
                </label>
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
                <TareaDePieza
                  valor={moldeDeLosa.tarea}
                  tipos={tareasDePieza(tiposDeMuro, "losas")}
                  alCambiar={(tarea) => setMoldeDeLosa({ ...moldeDeLosa, tarea })}
                />
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
              <section style={bloqueDePanel}>
                <Encabezado
                  icono="muro"
                  color={LADRILLO}
                  titulo={
                    tipoDelElegido?.nombre ??
                    (muroElegido.tarea ? tipoPorId.get(muroElegido.tarea)?.nombre ?? "Muro" : "Muro sin tipo")
                  }
                  detalle={corteDelElegido ? `${corteDelElegido.afuera} · ${corteDelElegido.adentro}` : undefined}
                >
                  {Math.abs(muroElegido.a.x - muroElegido.b.x) > 1e-6 &&
                    Math.abs(muroElegido.a.y - muroElegido.b.y) > 1e-6 && (
                      <BotonIcono icono="escuadrar" nombre="Escuadrar" onClick={() => escuadrarMuro(muroElegido)} />
                    )}
                  <BotonIcono icono="borrar" nombre="Borrar muro" peligro onClick={borrarSeleccion} />
                </Encabezado>

                <Seccion titulo="Núcleo">
                  <Fila icono="tipo" nombre="Tipo">
                    <div style={conBoton}>
                      <Desplegable
                        valor={muroElegido.tipo ?? ""}
                        opciones={[
                          { valor: "", nombre: "Sin tipo" },
                          ...tipos.map((tp) => ({ valor: tp.id, nombre: tp.nombre })),
                        ]}
                        alCambiar={(id) => ponerTipo(muroElegido, id || null)}
                      />
                      <BotonIcono icono="mas" nombre="Tipo nuevo" onClick={() => crearTipo(muroElegido)} />
                    </div>
                  </Fila>
                  {tipoDelElegido && (
                    <Fila icono="nombre" nombre="Nombre">
                      <input
                        type="text"
                        value={tipoDelElegido.nombre}
                        onChange={(e) => cambiarTipoDeMuro(tipoDelElegido.id, { nombre: e.target.value })}
                        aria-label="Nombre del tipo"
                        style={textoEnPastilla}
                      />
                    </Fila>
                  )}
                  <Fila icono="muro" nombre="Ladrillo">
                    <SelectorDeTarea
                      valor={tipoDelElegido ? tipoDelElegido.nucleo.tarea : muroElegido.tarea}
                      tareas={tiposDeMuro}
                      primero={RUBROS_DE_MURO}
                      vacio="Sin definir"
                      alCambiar={(tarea) =>
                        tipoDelElegido
                          ? cambiarTipoDeMuro(tipoDelElegido.id, {
                              composicion: {
                                nucleo: { ...tipoDelElegido.nucleo, tarea },
                                exterior: tipoDelElegido.exterior,
                                interior: tipoDelElegido.interior,
                              },
                            })
                          : cambiarMuros(new Set([muroElegido.id]), { tarea })
                      }
                    />
                  </Fila>
                  <Fila icono="espesor" nombre="Espesor">
                    <CampoNumero
                      valor={tipoDelElegido ? tipoDelElegido.nucleo.espesor : muroElegido.espesor}
                      unidad="cm"
                      factor={100}
                      paso={0.5}
                      alCambiar={(escrito) => {
                        if (escrito === null || !(escrito > 0)) return;
                        // Al medio centímetro: 12, 15, 16,5.
                        const espesor = Math.max(0.005, aMedioCentimetro(escrito));
                        if (tipoDelElegido) {
                          cambiarTipoDeMuro(tipoDelElegido.id, {
                            composicion: {
                              nucleo: { ...tipoDelElegido.nucleo, espesor },
                              exterior: tipoDelElegido.exterior,
                              interior: tipoDelElegido.interior,
                            },
                          });
                        } else {
                          cambiarMuros(new Set([muroElegido.id]), { espesor });
                        }
                      }}
                    />
                  </Fila>
                  {/* Las capas de un tipo de antes, mientras no se pasen al dibujo. */}
                  {tipoDelElegido && tipoDelElegido.exterior.length + tipoDelElegido.interior.length > 0 && (
                    <TipoDeMuroEditor
                      composicion={tipoDelElegido}
                      tareas={tareasDeCapa}
                      alCambiar={(composicion) => cambiarTipoDeMuro(tipoDelElegido.id, { composicion })}
                    />
                  )}
                  {largoTerminado !== null && (
                    <Fila icono="espesor" nombre="Largo">
                      <CampoNumero
                        key={muroElegido.id}
                        valor={Math.round(largoTerminado * 1000) / 1000}
                        unidad="m"
                        paso={0.01}
                        alCambiar={darLargo}
                      />
                    </Fila>
                  )}
                  <Fila icono="altura" nombre="Altura">
                    <CampoNumero
                      key={muroElegido.id}
                      valor={muroElegido.altura}
                      unidad="m"
                      paso={0.05}
                      vacio={formatMedida(alturaDePlanta)}
                      alCambiar={(altura) =>
                        ponerAlturaDeMuro(muroElegido.id, altura !== null && altura > 0 ? altura : null)
                      }
                    />
                  </Fila>
                  <Fila icono="agarre" nombre="Agarre">
                    <Segmentado
                      valor={muroElegido.referencia}
                      opciones={REFERENCIAS_DE_MURO.map((ref) => ({
                        valor: ref.valor,
                        nombre: ref.nombre,
                        figura: <FiguraDeAgarre referencia={ref.valor} />,
                      }))}
                      alCambiar={(nueva) => {
                        // El muro no se mueve: se corre la línea con sus puntos.
                        const muros = conOtraReferencia(dibujo.muros, muroElegido.id, nueva, mpp);
                        cambiar({
                          escala,
                          dibujo: {
                            ...dibujo,
                            muros,
                            aberturas: aberturasEnSuLugar(dibujo.aberturas, dibujo.muros, muros, mpp, u),
                          },
                        });
                      }}
                    />
                  </Fila>
                  {muroUnido && (
                    <Fila icono="unir" nombre="Unidos">
                      <label style={casillaChica}>
                        <input
                          type="checkbox"
                          checked={puntasJuntas}
                          onChange={(e) => setPuntasJuntas(e.target.checked)}
                        />
                        se mueven juntos
                      </label>
                    </Fila>
                  )}
                  {tipoDelElegido && (
                    <div style={pieDeTipo}>
                      <span style={nota}>
                        {usosDelTipo === 1 ? "1 muro" : `${usosDelTipo} muros`} de este tipo
                      </span>
                      {sinTipoDelMismoEspesor.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            cambiarMuros(new Set(sinTipoDelMismoEspesor.map((m) => m.id)), {
                              tipo: tipoDelElegido.id,
                              ...medidasDelMuro(tipoDelElegido),
                            })
                          }
                          style={botonChico}
                        >
                          + {sinTipoDelMismoEspesor.length} sin tipo de {formatEspesor(muroElegido.espesor)}
                        </button>
                      )}
                    </div>
                  )}
                  {errorDeTipo && <p style={alerta}>{errorDeTipo}</p>}
                </Seccion>

                {corteDelElegido && (
                  <Seccion
                    titulo="Corte"
                    cuenta={corteDelElegido.exterior.length + 1 + corteDelElegido.interior.length}
                  >
                    <CorteDeMuro
                      {...corteDelElegido}
                      alAbrir={(id) => {
                        setMuroDeOrigen(muroElegido.id);
                        elegir({ tipo: "capa", id });
                      }}
                      alQuitar={(id) => quitarCapaDelMuro(id, muroElegido.id)}
                      alAgregar={agregarCapaAlLado}
                    />
                  </Seccion>
                )}

                <Seccion titulo="Zócalo">
                  <Fila icono="zocalo" nombre={corteDelElegido?.afuera ?? "Exterior"}>
                    <SelectorDeTarea
                      valor={muroElegido.zocalo.exterior}
                      tareas={tareasPorMetro}
                      vacio="—"
                      alCambiar={(z) =>
                        cambiarMuros(new Set([muroElegido.id]), {
                          zocalo: { ...muroElegido.zocalo, exterior: z },
                        })
                      }
                    />
                  </Fila>
                  <Fila icono="zocalo" nombre={corteDelElegido?.adentro ?? "Interior"}>
                    <SelectorDeTarea
                      valor={muroElegido.zocalo.interior}
                      tareas={tareasPorMetro}
                      vacio="—"
                      alCambiar={(z) =>
                        cambiarMuros(new Set([muroElegido.id]), {
                          zocalo: { ...muroElegido.zocalo, interior: z },
                        })
                      }
                    />
                  </Fila>
                </Seccion>

                {carasDelMuro.length > 0 && mpp !== null && (
                  <Seccion titulo="Caras" cuenta={carasDelMuro.length} cerrada>
                    {carasDelMuro.map((cara) => (
                      <button
                        key={cara.clave}
                        type="button"
                        onClick={() => setCaraElegida(cara.clave)}
                        onMouseEnter={() => setCaraSenalada(cara.clave)}
                        onMouseLeave={() => setCaraSenalada(null)}
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
                                .join(" + ") +
                              (cara.propias || cara.capas.every((c) => c.dibujada) ? "" : " (del ambiente)")}
                        </span>
                      </button>
                    ))}
                    {caraAbierta && !caraAbierta.propias && (
                      <CapasDeLaCara
                        enLaCara={capasEnLaCara(caraAbierta)}
                        delMuro={capasDelElegido.filter(
                          (c) => !capasEnLaCara(caraAbierta).some((e) => e.id === c.id)
                        )}
                        nombre={(c) => (c.tarea ? nombreDeCapa.get(c.tarea) ?? "?" : "Sin tarea")}
                        alSumar={(id) => ponerCapaEnCara(id, caraAbierta)}
                        alQuitar={(id) => quitarCapaDeCara(id, caraAbierta)}
                      />
                    )}
                    {caraAbierta?.propias && (
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
                    )}
                  </Seccion>
                )}

                {encimados.has(muroElegido.id) && (
                  <p style={alerta}>Está encimado con otro muro: ese tramo se cuenta dos veces.</p>
                )}

                {medidasDelElegido && (
                  <Medidas
                    valores={[
                      { valor: formatMetros(medidasDelElegido.largo), nombre: "largo" },
                      { valor: formatM2(medidasDelElegido.superficie), nombre: "sin vanos" },
                      { valor: formatM3(medidasDelElegido.volumen), nombre: "ladrillo" },
                    ]}
                  />
                )}
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
                {/* Las tres terminaciones del ambiente, cada una en su caja y de
                    abajo hacia arriba como en un corte: el piso, el
                    cielorraso y las paredes. Cada caja dice en qué orden van
                    sus capas, que es lo que no se entendía. */}
                <div style={cajaDeCapas}>
                  <p style={tituloDeCaja}>Piso</p>
                  <EditorDeCapas
                    capas={ambienteElegido.piso}
                    disponibles={capasDisponibles}
                    primero={RUBROS_DE_PISO}
                    conTotal
                    alCambiar={(nuevas) => cambiarAmbiente(ambienteElegido.id, { piso: nuevas })}
                  />
                  {/* El paquete de piso es lo que separa la losa del piso
                      terminado: si la estructura dice otra cosa, una de las
                      dos está mal. */}
                  {estructura.bajoNpt !== null &&
                    paqueteDePiso > 0 &&
                    Math.abs(paqueteDePiso - estructura.bajoNpt) > 0.005 && (
                      <p style={alerta}>
                        Estas capas suman {formatCm(paqueteDePiso)} y la estructura dice que la
                        losa queda {formatCm(estructura.bajoNpt)} bajo el piso terminado.
                      </p>
                    )}
                </div>

                <div style={cajaDeCapas}>
                  <p style={tituloDeCaja}>Cielorraso</p>
                  <label style={campo}>
                    <span style={rotulo}>A qué altura del piso está (m)</span>
                    <CampoMetros
                      key={ambienteElegido.id}
                      valor={ambienteElegido.alturaCielorraso}
                      vacio={`${formatMedida(alturaDePlanta)} — contra la losa`}
                      alCambiar={(alturaCielorraso) =>
                        cambiarAmbiente(ambienteElegido.id, { alturaCielorraso })
                      }
                      alVaciar={() =>
                        cambiarAmbiente(ambienteElegido.id, { alturaCielorraso: null })
                      }
                    />
                  </label>
                  {/* El modo cielorraso: el plano se transparenta y lo único
                      que se puede mover es este borde y su buña. */}
                  <button
                    type="button"
                    style={enCielorraso ? botonChicoPuesto : botonChico}
                    onClick={() => setVerCielorraso(!verCielorraso)}
                  >
                    {enCielorraso ? "Listo, volver al plano" : "Dibujar el cielorraso"}
                  </button>
                  {enCielorraso && (
                    <p style={ayuda}>
                      {mpp === null
                        ? "Sin escala no se puede medir."
                        : `${formatM2(areaDe(contornoDelCielorraso) * mpp * mpp)} de cielorraso`}
                      {ambienteElegido.contornoCielorraso === null
                        ? " — llega hasta los muros del ambiente."
                        : " — con su propio borde."}
                    </p>
                  )}
                  {ambienteElegido.contornoCielorraso !== null && (
                    <button
                      type="button"
                      style={botonChico}
                      onClick={() =>
                        cambiarAmbiente(ambienteElegido.id, { contornoCielorraso: null })
                      }
                    >
                      Que llegue hasta los muros
                    </button>
                  )}

                  <EditorDeCapas
                    capas={ambienteElegido.cielorraso}
                    disponibles={capasDisponibles}
                    primero={RUBROS_DE_CIELORRASO}
                    conTotal
                    alCambiar={(nuevas) =>
                      cambiarAmbiente(ambienteElegido.id, { cielorraso: nuevas })
                    }
                  />

                  {/* La buña: arranca siendo el perímetro y no guarda forma.
                      Se le corren los bordes en el plano, y ahí se queda con
                      los suyos. */}
                  <label style={casilla}>
                    <input
                      type="checkbox"
                      checked={ambienteElegido.buna !== null}
                      onChange={(e) =>
                        cambiarAmbiente(ambienteElegido.id, {
                          buna: e.target.checked ? { tarea: "", anillo: null } : null,
                        })
                      }
                    />
                    Lleva buña
                  </label>
                  {ambienteElegido.buna && (
                    <>
                      <SelectorDeTarea
                        valor={ambienteElegido.buna.tarea || null}
                        tareas={tareasPorMetro}
                        vacio="—"
                        alCambiar={(tarea) =>
                          cambiarAmbiente(ambienteElegido.id, {
                            buna: { tarea: tarea ?? "", anillo: bunaDelAmbiente?.anillo ?? null },
                          })
                        }
                      />
                      <p style={ayuda}>
                        {mpp === null
                          ? "Sin escala no se puede medir."
                          : `${formatMetros(largoDeBuna(anilloDeBuna(ambienteElegido), mpp))} de buña`}
                        {ambienteElegido.buna.anillo === null
                          ? " — sigue el borde del cielorraso."
                          : " — con su propio contorno."}
                      </p>
                      {ambienteElegido.buna.anillo !== null && (
                        <button
                          type="button"
                          style={botonChico}
                          onClick={() =>
                            cambiarAmbiente(ambienteElegido.id, {
                              buna: { tarea: bunaDelAmbiente?.tarea ?? "", anillo: null },
                            })
                          }
                        >
                          Volver al borde del cielorraso
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Las paredes: las capas de los muros, o una terminación
                    propia del ambiente que las reemplaza en todas sus caras
                    —el baño, con su porcelanato y su revoque—. */}
                {ambienteElegido.capas.length > 0 && (
                <div style={cajaDeCapas}>
                  <div style={cabezaDeParedes}>
                    <p style={tituloDeCaja}>Paredes</p>
                    <div style={selectorDeParedes}>
                      <button
                        type="button"
                        onClick={() => cambiarAmbiente(ambienteElegido.id, { capas: [] })}
                        style={ambienteElegido.capas.length === 0 ? opcionElegida : opcion}
                      >
                        Las del muro
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          ambienteElegido.capas.length === 0 &&
                          cambiarAmbiente(ambienteElegido.id, {
                            capas: aCapas(capasDeLosMurosDe(ambienteElegido.id)),
                          })
                        }
                        style={ambienteElegido.capas.length > 0 ? opcionElegida : opcion}
                      >
                        Propias
                      </button>
                    </div>
                  </div>
                  {ambienteElegido.capas.length > 0 && (
                    <ListaDeCapas
                      capas={ambienteElegido.capas.map(aCapaDeMuro)}
                      tareas={tareasDeCapa}
                      alCambiar={(nuevas) =>
                        cambiarAmbiente(ambienteElegido.id, {
                          // Vaciarla del todo vuelve a "las del muro".
                          capas: aCapas(nuevas),
                        })
                      }
                    />
                  )}
                </div>
                )}
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
                {columnaElegida.material !== "metalica" && (
                  <TareaDePieza
                    valor={columnaElegida.tarea}
                    tipos={tareasDePieza(tiposDeMuro, "columnas")}
                    alCambiar={(tarea) => cambiarPieza("columnas", columnaElegida.id, { tarea })}
                    sinTarea={estructura.columnas.filter(
                      (p) =>
                        p.id !== columnaElegida.id && p.tarea === null && p.material !== "metalica"
                    )}
                    plural="columnas"
                    ponerA={(ids, tarea) => cambiarPiezas("columnas", ids, { tarea })}
                  />
                )}
                {columnaElegida.material !== "metalica" && (
                  <label style={casilla}>
                    <input
                      type="checkbox"
                      checked={columnaElegida.visto}
                      onChange={(e) =>
                        cambiarPieza("columnas", columnaElegida.id, { visto: e.target.checked })
                      }
                    />
                    Hormigón visto
                  </label>
                )}

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

            {vigaElegida && vigaElegida.tabique && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Tabique seleccionado</h3>
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
                <TareaDePieza
                  valor={vigaElegida.tarea}
                  tipos={tareasDePieza(tiposDeMuro, "tabiques")}
                  alCambiar={(tarea) => cambiarPieza("vigas", vigaElegida.id, { tarea })}
                  sinTarea={estructura.vigas.filter(
                    (p) => p.id !== vigaElegida.id && p.tabique && p.tarea === null
                  )}
                  plural="tabiques"
                  ponerA={(ids, tarea) => cambiarPiezas("vigas", ids, { tarea })}
                />
                <label style={campo}>
                  <span style={rotulo}>Espesor (m)</span>
                  <CampoMetros
                    key={vigaElegida.id}
                    valor={vigaElegida.ancho}
                    alCambiar={(ancho) => cambiarPieza("vigas", vigaElegida.id, { ancho })}
                  />
                </label>
                <label style={campo}>
                  <span style={rotulo}>Línea de referencia</span>
                  <SelectorReferencia
                    valor={vigaElegida.referencia}
                    alCambiar={(referencia) => cambiarPieza("vigas", vigaElegida.id, { referencia })}
                  />
                </label>
                {(() => {
                  const medida = hormigon?.vigas.find((v) => v.id === vigaElegida.id);
                  if (!medida) return null;
                  return (
                    <>
                      <Renglon nombre="Largo">{formatMetros(medida.largo)}</Renglon>
                      <Renglon nombre="Alto">{formatMetros(medida.hasta - medida.desde)}</Renglon>
                      <Renglon nombre="Nivel">
                        {formatNivel(medida.desde)} a {formatNivel(medida.hasta)}
                      </Renglon>
                      <Renglon nombre="Hormigón" fuerte>
                        {formatM3(medida.neto)}
                      </Renglon>
                    </>
                  );
                })()}
                <button type="button" onClick={borrarSeleccion} style={botonBorrar}>
                  Borrar tabique
                </button>
              </section>
            )}

            {vigaElegida && !vigaElegida.tabique && (
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
                {vigaElegida.material !== "metalica" && (
                  <TareaDePieza
                    valor={vigaElegida.tarea}
                    tipos={tareasDePieza(tiposDeMuro, "vigas")}
                    alCambiar={(tarea) => cambiarPieza("vigas", vigaElegida.id, { tarea })}
                    sinTarea={estructura.vigas.filter(
                      (p) =>
                        p.id !== vigaElegida.id && p.tarea === null && p.material !== "metalica" && !p.tabique
                    )}
                    plural="vigas"
                    ponerA={(ids, tarea) => cambiarPiezas("vigas", ids, { tarea })}
                  />
                )}

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
                <TareaDePieza
                  valor={losaElegida.tarea}
                  tipos={tareasDePieza(tiposDeMuro, "losas")}
                  alCambiar={(tarea) => cambiarPieza("losas", losaElegida.id, { tarea })}
                  sinTarea={estructura.losas.filter(
                    (p) => p.id !== losaElegida.id && p.tarea === null
                  )}
                  plural="losas"
                  ponerA={(ids, tarea) => cambiarPiezas("losas", ids, { tarea })}
                />
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
                    <span style={rotulo}>Nivel, desde el NPT (m)</span>
                    <CampoBajoNpt
                      key={losaElegida.id}
                      valor={losaElegida.bajoNpt}
                      vacio={
                        estructura.bajoNpt !== null
                          ? `${formatNivel(-estructura.bajoNpt)} — el de la planta`
                          : "sin definir"
                      }
                      alCambiar={(bajoNpt) => cambiarPieza("losas", losaElegida.id, { bajoNpt })}
                    />
                  </label>
                </div>
                {/* Sólo si no es lo de toda la planta: una losa rebajada. */}
                <p style={nota}>
                  Dónde queda su cara de arriba respecto del piso terminado que sostiene: −0,05 es
                  cinco centímetros más abajo. Vacío, lo de toda la planta.
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
                      {/* Para que el número no parezca corto contra el largo
                          por la altura: donde hay hormigón no hay ladrillo. */}
                      {terminaciones.hormigonEnMuros > 0.005 && (
                        <p style={detalleRenglon}>
                          Ya descontados {formatM2(terminaciones.hormigonEnMuros)} que ocupan las
                          columnas y las vigas.
                        </p>
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

                  {terminaciones && terminaciones.zocalos.length > 0 && (
                    <Grupo titulo="Zócalos">
                      {terminaciones.zocalos.map((z) => (
                        <Renglon key={z.capa} nombre={nombreDeCapa.get(z.capa) ?? "?"}>
                          {formatMetros(z.largo)}
                        </Renglon>
                      ))}
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

            {modo === "estructura" && cuantasSinTarea > 0 && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Tareas del cómputo</h3>
                <button type="button" onClick={ponerTareasSugeridas} style={botonChico}>
                  Ponerles su tarea a {cuantasSinTarea === 1 ? "la pieza" : `las ${cuantasSinTarea} piezas`} sin tarea
                </button>
              </section>
            )}

            {modo === "estructura" && (
              <section style={bloque}>
                <h3 style={tituloBloque}>Niveles de la estructura</h3>
                {/* La estructura no está al nivel del piso terminado: la losa
                    que sostiene el piso de arriba termina unos centímetros
                    antes. Eso es lo que se carga acá, y de ahí sale todo. */}
                <label style={campo}>
                  <span style={rotulo}>Nivel de la losa, desde el NPT que sostiene (m)</span>
                  <CampoBajoNpt
                    valor={estructura.bajoNpt}
                    vacio={
                      nivelesDeLaLosa.bajoNpt !== null
                        ? `${formatNivel(-nivelesDeLaLosa.bajoNpt)} — lo que deja la altura`
                        : "sin definir"
                    }
                    alCambiar={(bajoNpt) => agregarAEstructura({ bajoNpt })}
                  />
                  <span style={nota}>
                    La cara de arriba de la losa: −0,05 es cinco centímetros bajo el piso terminado.
                  </span>
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
 * La cota del muro elegido, como en un plano: una línea de cota afuera del
 * muro —pasando sus capas—, con sus líneas de referencia y sus marcas en las
 * puntas, y el largo bien grande en el medio. Mide la línea marcada, que es la
 * que tiene los puntos para estirar: lo que se le da de largo al muro.
 */
function CotaDeMuro({
  muro,
  cuerpo,
  mpp,
  u,
  cantos,
}: {
  muro: Muro;
  cuerpo: { ejeA: Punto; grosor: number };
  mpp: number;
  u: number;
  /** El revoque de cada punta, en metros: la cota mide el muro terminado. */
  cantos: { a: number; b: number };
}) {
  const largoMarcado = distancia(muro.a, muro.b);
  if (!(largoMarcado > 0)) return null;
  const d = { x: (muro.b.x - muro.a.x) / largoMarcado, y: (muro.b.y - muro.a.y) / largoMarcado };
  const a = { x: muro.a.x - (d.x * cantos.a) / mpp, y: muro.a.y - (d.y * cantos.a) / mpp };
  const b = { x: muro.b.x + (d.x * cantos.b) / mpp, y: muro.b.y + (d.y * cantos.b) / mpp };
  const largo = distancia(a, b);
  const n = { x: -d.y, y: d.x };
  // Dónde está el muro terminado sobre la normal, desde la línea marcada.
  const centro = (cuerpo.ejeA.x - a.x) * n.x + (cuerpo.ejeA.y - a.y) * n.y;
  const bajo = centro - cuerpo.grosor / 2 - (muro.acabado?.exterior ?? 0) / mpp;
  const alto = centro + cuerpo.grosor / 2 + (muro.acabado?.interior ?? 0) / mpp;
  // Del lado de la línea marcada, o, si va por el eje, arriba o a la izquierda.
  let lado: 1 | -1;
  if (Math.abs(centro) > 1e-6) lado = centro > 0 ? -1 : 1;
  else lado = n.y < 0 || (n.y === 0 && n.x < 0) ? 1 : -1;
  const borde = lado === 1 ? Math.max(0, alto) : Math.max(0, -bajo);
  const o = { x: n.x * lado, y: n.y * lado };
  const enLinea = borde + 22 * u;
  const p = (q: Punto, k: number) => ({ x: q.x + o.x * k, y: q.y + o.y * k });
  const a1 = p(a, enLinea);
  const b1 = p(b, enLinea);
  const marca = (q: Punto) => {
    // La marca de arquitecto: un trazo a 45° sobre cada punta.
    const t = 5 * u;
    const m = { x: (d.x + o.x) * t, y: (d.y + o.y) * t };
    return `M${q.x - m.x} ${q.y - m.y}L${q.x + m.x} ${q.y + m.y}`;
  };
  const medio = p({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, enLinea);
  const texto = formatMetros(largo * mpp);
  const ancho = (texto.length * 7.5 + 14) * u;
  const alto_ = 19 * u;
  return (
    <g style={{ pointerEvents: "none" }}>
      <path
        d={`M${p(a, borde + 4 * u).x} ${p(a, borde + 4 * u).y}L${p(a, enLinea + 5 * u).x} ${p(a, enLinea + 5 * u).y}M${p(b, borde + 4 * u).x} ${p(b, borde + 4 * u).y}L${p(b, enLinea + 5 * u).x} ${p(b, enLinea + 5 * u).y}`}
        stroke={ACENTO}
        strokeWidth={0.8 * u}
        fill="none"
      />
      <line x1={a1.x} y1={a1.y} x2={b1.x} y2={b1.y} stroke={ACENTO} strokeWidth={u} />
      <path d={`${marca(a1)}${marca(b1)}`} stroke={ACENTO} strokeWidth={1.6 * u} fill="none" />
      <rect
        x={medio.x - ancho / 2}
        y={medio.y - alto_ / 2}
        width={ancho}
        height={alto_}
        rx={alto_ / 2}
        fill="#ffffff"
        stroke={ACENTO}
        strokeWidth={u}
      />
      <text
        x={medio.x}
        y={medio.y + 4.5 * u}
        textAnchor="middle"
        fontSize={13 * u}
        fontWeight={700}
        fill={ACENTO}
      >
        {texto}
      </text>
    </g>
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
  conTotal = false,
  alturaCielorraso = null,
}: {
  capas: Capa[];
  disponibles: CapaDisponible[];
  alCambiar: (nuevas: Capa[]) => void;
  /** Los rubros que van arriba en el desplegable. */
  primero: string[];
  conAltura?: boolean;
  /** Si al pie va cuánto suman los espesores: el paquete de un piso. */
  conTotal?: boolean;
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
  /** Sube una capa un lugar: el orden es parte de lo que se carga. */
  const subir = (cual: number) =>
    alCambiar(
      capas.map((capa, k) =>
        k === cual - 1 ? capas[cual] : k === cual ? capas[cual - 1] : capa
      )
    );
  const total = capas.reduce((t, capa) => t + (capa.espesor ?? 0), 0);
  const sinEspesor = capas.filter((capa) => capa.espesor === null).length;

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
            <span style={accionesDeCapa}>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => subir(i)}
                  title="Pasarla antes que la de arriba"
                  aria-label="Subir esta capa"
                  style={botonQuitar}
                >
                  ↑
                </button>
              )}
              <button
                type="button"
                onClick={() => alCambiar(capas.filter((_, k) => k !== i))}
                title="Sacar esta capa"
                aria-label="Sacar esta capa"
                style={botonQuitar}
              >
                ×
              </button>
            </span>
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
        <option value="">
          {capas.length === 0 ? "Agregar la primera capa…" : "Agregar la capa que sigue…"}
        </option>
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
      {conTotal && total > 0 && (
        <div style={renglonFuerte}>
          <span style={nombreRenglon}>
            Suman
            {sinEspesor > 0 &&
              ` (sin ${sinEspesor === 1 ? "la que no tiene" : `las ${sinEspesor} que no tienen`} espesor)`}
          </span>
          <span style={valorRenglon}>{formatCm(total)}</span>
        </div>
      )}
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
 * El tipo de un muro, de los de la obra, con "+ Nuevo" al lado. Borrar un
 * tipo va por el desplegable: "Sin tipo" lo suelta del muro.
 */
/** Una tarea del catálogo del cómputo. */
type TareaDelCatalogo = { id: string; nombre: string; rubro: string; unidad: string };

/**
 * Las tareas de un tipo de abertura: el amure del premarco, la colocación. Se
 * agregan del catálogo, por rubro, y cada una se marca después por separado en
 * el 3D.
 */
function TareasDeAbertura({
  tareas,
  catalogo,
  alCambiar,
}: {
  tareas: string[];
  catalogo: TareaDelCatalogo[];
  alCambiar: (tareas: string[]) => void;
}) {
  const porId = new Map(catalogo.map((c) => [c.id, c] as const));
  const rubros = Array.from(new Set(catalogo.map((c) => c.rubro)));
  return (
    <div style={campo}>
      <span style={rotulo}>Tareas</span>
      {tareas.map((id) => {
        const tarea = porId.get(id);
        return (
          <div key={id} style={renglon}>
            <span style={nombreConMuestra}>
              <span style={{ ...muestra, background: colorDeCapa(id) }} />
              <span style={nombreRenglon}>
                {tarea ? `${tarea.nombre} (${tarea.unidad})` : "Tarea que ya no está en el catálogo"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => alCambiar(tareas.filter((x) => x !== id))}
              title="Sacar esta tarea"
              aria-label="Sacar esta tarea"
              style={botonQuitar}
            >
              ×
            </button>
          </div>
        );
      })}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) alCambiar([...tareas, e.target.value]);
        }}
        style={ui.input}
        aria-label="Agregar una tarea"
      >
        <option value="">Agregar tarea…</option>
        {rubros.map((rubro) => (
          <optgroup key={rubro} label={rubro}>
            {catalogo
              .filter((c) => c.rubro === rubro && !tareas.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.unidad})
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function SelectorDeTipo({
  valor,
  tipos,
  alCambiar,
  alCrear,
}: {
  valor: string | null;
  tipos: TipoMuro[];
  alCambiar: (id: string | null) => void;
  alCrear: () => void;
}) {
  return (
    <div style={filaDeTipo}>
      <select
        value={valor ?? ""}
        onChange={(e) => alCambiar(e.target.value || null)}
        style={ui.input}
        aria-label="Tipo de muro"
      >
        <option value="">Sin tipo</option>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre} · {Math.round(espesorTotal(t) * 1000) / 10} cm
          </option>
        ))}
      </select>
      <button type="button" onClick={alCrear} style={botonNuevoTipo} title="Nuevo tipo de muro">
        + Nuevo
      </button>
    </div>
  );
}

const filaDeTipo = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "6px",
};

const botonNuevoTipo = {
  ...ui.secondaryButton,
  padding: "6px 10px",
  fontSize: "12px",
};

const pieDeTipo = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
};

/**
 * De qué está hecho un muro. Las mamposterías y las estructuras van primero,
 * que es donde está casi todo lo que puede ser un muro; cada opción dice su
 * unidad, porque de ella depende qué se le cuenta.
 */
function SelectorDeTipoDeMuro({
  valor,
  tipos,
  alCambiar,
  primero = RUBROS_DE_MURO,
  vacio = "Sin tipo",
}: {
  valor: string | null;
  tipos: TipoDeMuro[];
  alCambiar: (nuevo: string | null) => void;
  /** Los rubros que van arriba de la lista, en ese orden. */
  primero?: string[];
  /** Cómo se lee la opción de no elegir ninguna. */
  vacio?: string;
}) {
  const orden = (rubro: string) => {
    const i = primero.findIndex((r) => r.toLowerCase() === rubro.toLowerCase());
    return i === -1 ? primero.length : i;
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
      <option value="">{vacio}</option>
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

function SelectorReferencia<T extends string>({
  valor,
  alCambiar,
  opciones = REFERENCIAS as unknown as readonly { valor: T; nombre: string }[],
}: {
  valor: T;
  alCambiar: (nueva: T) => void;
  /** Las de una viga, por defecto; un muro suma sus caras terminadas. */
  opciones?: readonly { valor: T; nombre: string }[];
}) {
  return (
    <select
      value={valor}
      onChange={(e) => alCambiar(e.target.value as T)}
      style={ui.input}
    >
      {opciones.map((r) => (
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
 * Dónde queda la cara de arriba de una losa respecto del piso terminado que
 * sostiene, **escrito como un nivel**: −0,05.
 *
 * Lo que se guarda es cuánto más abajo queda (`bajoNpt`, en positivo), pero
 * así no lo escribe nadie: un nivel por debajo de otro lleva el signo menos,
 * y el campo que pedía "0,05" rechazaba el "−0,05" sin decir nada. Acá se
 * muestra y se escribe con su signo. Si se lo escribe sin él vale lo mismo:
 * una losa no queda por encima del piso que sostiene.
 */
function CampoBajoNpt({
  valor,
  vacio,
  alCambiar,
}: {
  /** Cuánto más abajo, en metros y en positivo, o null si no se cargó. */
  valor: number | null;
  vacio?: string;
  alCambiar: (bajoNpt: number | null) => void;
}) {
  return (
    <CampoNivel
      // Cero sin signo: "-0" en el campo no dice nada.
      valor={valor === null ? null : valor === 0 ? 0 : -valor}
      vacio={vacio}
      alCambiar={(nivel) => alCambiar(nivel === null ? null : Math.abs(nivel))}
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

type ClaseConTarea = "columnas" | "vigas" | "tabiques" | "losas";

const esM3 = (unidad: string) => /^m[³3]$/i.test(unidad.trim());
const esM2 = (unidad: string) => /^m[²2]$/i.test(unidad.trim());

/**
 * Las tareas que puede ser una pieza de hormigón: las que se cotizan por
 * volumen, y en una losa también por superficie —la de viguetas va en m²—.
 * Lo que el plano pasa de cada una depende de eso: los m³ o los m².
 */
function tareasDePieza(tipos: TipoDeMuro[], clase: ClaseConTarea): TipoDeMuro[] {
  return tipos.filter((t) => esM3(t.unidad) || (clase === "losas" && esM2(t.unidad)));
}

/** Qué se busca en el nombre de la tarea que le toca a cada clase. */
const SUGERENCIA: Record<ClaseConTarea, RegExp[]> = {
  columnas: [/columna/i],
  vigas: [/viga/i],
  tabiques: [/tabique.*h°/i, /tabique/i],
  // La maciza antes que cualquier otra losa: es la que se dibuja por contorno
  // con su espesor.
  losas: [/losa.*maciza/i, /losa/i],
};

/**
 * La tarea con que arranca el molde de una clase: la del catálogo que la
 * nombra —"Columnas H°A°"—, en m³, del rubro Estructuras si hay. Es sólo un
 * punto de partida: así la primera columna ya sale con su tarea, y si la obra
 * usa otra se cambia en el molde una vez.
 */
function tareaSugerida(tipos: TipoDeMuro[], clase: ClaseConTarea): string | null {
  const candidatas = tipos.filter((t) => esM3(t.unidad));
  for (const patron of SUGERENCIA[clase]) {
    const que = candidatas.filter((t) => patron.test(t.nombre));
    const elegida = que.find((t) => /estructura/i.test(t.rubro)) ?? que[0];
    if (elegida) return elegida.id;
  }
  return null;
}

/**
 * Qué tarea del cómputo es una pieza de hormigón, y el atajo para ponérsela a
 * las otras de su clase que no tienen: casi todas las columnas de una obra son
 * la misma tarea, y elegirla una por una es trabajo sin decisión.
 */
function TareaDePieza({
  valor,
  tipos,
  alCambiar,
  sinTarea = [],
  plural = "",
  ponerA,
}: {
  valor: string | null;
  tipos: TipoDeMuro[];
  alCambiar: (tarea: string | null) => void;
  /** Las otras de su clase sin tarea, si es una pieza ya dibujada. */
  sinTarea?: { id: string }[];
  plural?: string;
  ponerA?: (ids: string[], tarea: string) => void;
}) {
  return (
    <>
      <label style={campo}>
        <span style={rotulo}>Tarea del cómputo</span>
        <SelectorDeTipoDeMuro
          valor={valor}
          tipos={tipos}
          alCambiar={alCambiar}
          primero={["Estructuras"]}
          vacio="Sin tarea: no se pasa"
        />
      </label>
      {valor !== null && ponerA && sinTarea.length > 0 && (
        <button
          type="button"
          onClick={() =>
            ponerA(
              sinTarea.map((p) => p.id),
              valor
            )
          }
          style={botonChico}
        >
          {sinTarea.length === 1
            ? `Ponérsela a la otra de las ${plural} sin tarea`
            : `Ponérsela a las ${sinTarea.length} ${plural} sin tarea`}
        </button>
      )}
    </>
  );
}

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
  // Un tabique se nombra por su espesor, como en la planilla: "M1: 15".
  if (viga.tabique) return String(Math.round(viga.ancho * 1000) / 10).replace(".", ",");
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

/** Una medida con el medio centímetro, si lo tiene: 0,895. */
function formatMedidaFina(metros: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(metros);
}

function aMolde(inicial: {
  nombre: string;
  ancho: number;
  alto: number;
  antepecho: number | null;
  apertura: Apertura | null;
  hojas: number | null;
  marco: number | null;
  tareas?: string[];
}): Molde {
  return {
    marco: inicial.marco,
    tareas: inicial.tareas ?? [],
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
  // Lo que suman las capas dibujadas de cada lado: el vano las corta también,
  // y el blanco tiene que taparlas hasta la cara terminada.
  const afuera = mpp !== null && muro.acabado ? muro.acabado.exterior / mpp : 0;
  const adentro = mpp !== null && muro.acabado ? muro.acabado.interior / mpp : 0;

  return {
    a: en(-medio, 0),
    b: en(medio, 0),
    medio,
    en,
    medioGrosor,
    /** Medio espesor del cuerpo del muro, sin el aire de `medioGrosor`. */
    medioCuerpo: medioGrosor - 2 * u,
    /** Lo que suman las capas dibujadas afuera (−normal) y adentro (+normal). */
    afuera,
    adentro,
    puntos: [
      en(-medio, -medioGrosor - afuera),
      en(medio, -medioGrosor - afuera),
      en(medio, medioGrosor + adentro),
      en(-medio, medioGrosor + adentro),
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

/** El marco de una puerta a lo largo del muro, y el espesor de su hoja, en metros. */
const MARCO = 0.05;
const HOJA_DE_PUERTA = 0.04;

/**
 * Una puerta como se dibuja en un plano: un **marco** en cada jamba —el ancho
 * del muro, 5 cm a lo largo—, la **hoja** con su espesor, abierta a 90° desde
 * el marco de la bisagra, y el arco que barre hasta el otro marco.
 *
 * La mano se mira **de frente y empujando**: quien empuja está del lado
 * contrario a donde abre, y las bisagras le quedan a la derecha o a la
 * izquierda. De ahí sale en qué jamba va la bisagra.
 */
function puertaEnPlanta(
  forma: ReturnType<typeof formaDeAbertura>,
  mano: Mano,
  lado: 1 | -1,
  mpp: number | null,
  u: number,
  /** De cara a cara, en metros; null: el del muro con sus capas. */
  profundidad: number | null = null
): { marcos: string[]; hoja: string; arco: string; jambas: string[] } {
  const { medio, medioCuerpo, afuera, adentro, en } = forma;
  const haciaDonde = lado === -1 ? -1 : 1;
  const sentido = (mano === "derecha" ? 1 : -1) * -haciaDonde;
  const marco = Math.min(mpp !== null ? MARCO / mpp : 3 * u, medio / 3);
  const espesor = mpp !== null ? Math.max(HOJA_DE_PUERTA / mpp, u) : 2 * u;
  const luz = Math.max(medio - marco, 0);
  const puntos = (pp: Punto[]) => pp.map((p) => `${p.x},${p.y}`).join(" ");
  // Las caras terminadas del muro, sobre la normal.
  const cara0 = -(medioCuerpo + afuera);
  const cara1 = medioCuerpo + adentro;
  // El marco va al ras de la cara hacia donde abre; si es del muro, de cara a cara.
  const hondo = profundidad !== null && mpp !== null ? Math.min(profundidad / mpp, cara1 - cara0) : cara1 - cara0;
  const [m0, m1] = haciaDonde > 0 ? [cara1 - hondo, cara1] : [cara0, cara0 + hondo];
  const marcos = [-1, 1].map((s) =>
    puntos([en(s * medio, m0), en(s * luz, m0), en(s * luz, m1), en(s * medio, m1)])
  );
  // Las puntas del muro en el vano, de cara a cara: donde el muro termina.
  const jambas = [-1, 1].map((s) => puntos([en(s * medio, cara0), en(s * medio, cara1)]));
  // La hoja sale del marco de la bisagra, contra la cara hacia donde abre.
  const cara = haciaDonde > 0 ? m1 : m0;
  const largoDeHoja = 2 * luz;
  const hoja = puntos([
    en(sentido * luz, cara),
    en(sentido * (luz - espesor), cara),
    en(sentido * (luz - espesor), cara + haciaDonde * largoDeHoja),
    en(sentido * luz, cara + haciaDonde * largoDeHoja),
  ]);
  const punta = en(sentido * luz, cara + haciaDonde * largoDeHoja);
  const cerrada = en(-sentido * luz, cara);
  const bisagra = en(sentido * luz, cara);
  const giro =
    (punta.x - bisagra.x) * (cerrada.y - bisagra.y) - (punta.y - bisagra.y) * (cerrada.x - bisagra.x);
  const arco = `M ${punta.x} ${punta.y} A ${largoDeHoja} ${largoDeHoja} 0 0 ${giro > 0 ? 1 : 0} ${cerrada.x} ${cerrada.y}`;
  return { marcos, hoja, arco, jambas };
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
  copiado: boolean,
  capaAMano = false
) {
  switch (herramienta) {
    case "capa":
      if (!capaAMano) return "Clic adentro de un ambiente: la capa va por todo su perímetro. Afuera, por las caras de afuera.";
      return puntos === 0
        ? "Clic sobre la cara de un muro donde empieza la capa."
        : "Clic en cada punto, sobre las caras. Doble clic o Enter para terminar.";
    case "cajon":
      return puntos < 3
        ? "Clic en cada esquina del cajón: su fondo y sus frentes, los lados que no van contra un muro."
        : "Para cerrarlo, clic en la primera esquina o Enter.";
    case "copiar":
      return copiado
        ? "Clic en cada uno que va igual. Esc para tomar otro."
        : "Clic en un muro, una abertura o un ambiente para tomar sus propiedades.";
    case "seleccionar":
      return modo === "estructura"
        ? "Clic en una columna, una viga o una losa para verla y moverla. La punta de una viga se estira derecha; lejos de su línea, gira. Doble clic en un lado de una losa le suma un punto. Supr borra."
        : "Clic en algo para verlo y moverlo. La punta de un muro se estira derecha; lejos de su línea, gira. Doble clic parte un muro o suma un punto a un ambiente. Supr borra.";
    case "esquina":
      return modo === "estructura"
        ? "Clic en una viga y después en la otra: se alargan o se recortan hasta unirse en escuadra."
        : "Clic en un muro y después en el otro: se alargan o se recortan hasta unirse en escuadra.";
    case "cortar":
      return "Pasá por un muro: el corte se engancha en las caras de los muros que llegan. Clic parte el muro.";
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
/** El de la buña: una línea del cielorraso, que no es ni muro ni ambiente. */
const BUNA = "#a16207";
/** El color de lo que se mide y no queda: distinto de todo lo que se guarda. */
const VIOLETA = "#7c3aed";
/** El de las guías: finito y frío, para que no se confunda con el trazo. */
const CELESTE = "#0891b2";
/** El del hormigón: toda la estructura va de un color que no usa nada más. */
const HORMIGON = "#3730a3";
/** Lo que queda por debajo del plano de corte: se ve, en gris claro. */
const GRIS_BAJO_EL_CORTE = "#b4b4b4";
const FONDO_BAJO_EL_CORTE = "#ececec";
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
/** Los rellenos de los ambientes: pasteles, uno por cada color de arriba. */
const PASTELES = ["#dbe6f8", "#d7efe3", "#f8e8d2", "#e6defa", "#f9dde9", "#d5eef2"];

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

/** Los marcos que se ofrecen: los de los tabiques de todos los días. */
const MARCOS = [0.08, 0.1, 0.12, 0.15, 0.18, 0.2];

/**
 * El marco de una puerta: el del muro, uno de la lista o uno escrito. "Otro"
 * abre el campo para escribirlo.
 */
function SelectorDeMarco({
  valor,
  alCambiar,
}: {
  valor: number | null;
  alCambiar: (marco: number | null) => void;
}) {
  const deLaLista = valor !== null && MARCOS.some((m) => Math.abs(m - valor) < 1e-6);
  const [otro, setOtro] = useState(valor !== null && !deLaLista);
  const elegido = otro ? "otro" : valor === null ? "muro" : String(valor);
  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <select
        value={elegido}
        onChange={(e) => {
          const v = e.target.value;
          setOtro(v === "otro");
          if (v === "muro") alCambiar(null);
          else if (v !== "otro") alCambiar(Number(v));
        }}
        style={ui.input}
      >
        <option value="muro">El del muro</option>
        {MARCOS.map((m) => (
          <option key={m} value={String(m)}>
            {formatEspesor(m)}
          </option>
        ))}
        <option value="otro">Otro</option>
      </select>
      {otro && (
        <CampoNumero
          valor={valor}
          unidad="cm"
          factor={100}
          paso={0.5}
          vacio="de cara a cara"
          alCambiar={(m) => alCambiar(m && m > 0 ? m : null)}
        />
      )}
    </div>
  );
}

/** En la lista de tipologías, la opción de crear una: no choca con un nombre. */
const NUEVO_TIPO = "\u0000nuevo";

const botonDeCapas = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  border: "none",
  background: "none",
  padding: 0,
  fontSize: "12px",
  fontFamily: "inherit",
  color: "#333333",
  cursor: "pointer",
};

const menuDeCapas = {
  position: "absolute" as const,
  top: "26px",
  right: "-10px",
  display: "grid",
  gap: "7px",
  padding: "10px 12px",
  background: "#ffffff",
  border: "1px solid #e5e5e5",
  borderRadius: "10px",
  boxShadow: "0 6px 18px rgba(0, 0, 0, 0.08)",
  whiteSpace: "nowrap" as const,
  zIndex: 5,
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

/** Una terminación del ambiente —su piso, su cielorraso— en su propia caja:
 *  lo que hay adentro es de ella y de nada más. */

/** Un panel hecho con las piezas de `PanelPropiedades`: sin espacio entre
 *  secciones, que ya traen su raya y su aire. */
const bloqueDePanel = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)" };

/** Los rubros que van arriba en la tarea de una capa. */
const RUBROS_DE_CAPA = ["Revoques", "Revestimientos", "Pintura", "Aislaciones"];

/** Tarea, espesor y altura de una capa: la nueva y la elegida. */
function CamposDeCapa({
  capa,
  tareas,
  alto,
  alCambiar,
}: {
  capa: Omit<CapaDibujada, "id" | "tramos">;
  tareas: TipoDeMuro[];
  alto: number;
  alCambiar: (cambios: Partial<CapaDibujada>) => void;
}) {
  return (
    <>
      <Fila icono="tarea" nombre="Tarea">
        <SelectorDeTarea
          valor={capa.tarea}
          tareas={tareas}
          primero={RUBROS_DE_CAPA}
          alCambiar={(tarea) => alCambiar({ tarea })}
        />
      </Fila>
      <Fila icono="espesor" nombre="Espesor">
        <CampoNumero
          valor={capa.espesor}
          unidad="cm"
          factor={100}
          paso={0.5}
          alCambiar={(espesor) => alCambiar({ espesor: espesor ?? 0 })}
        />
      </Fila>
      <AlturaDeCapa
        alto={alto}
        cielorraso={null}
        desde={capa.desde}
        hasta={capa.hasta}
        color={capa.tarea ? colorDeCapa(capa.tarea) : "#9a9a9a"}
        alCambiar={alCambiar}
      />
    </>
  );
}

/** El color del núcleo, en la cabecera y en el corte de un muro: el gris
 *  oscuro con que se lo dibuja en la planta, que no se confunde con las capas. */
const LADRILLO = "#55524c";

/** Una pastilla para escribir texto, como las de `PanelPropiedades`. */
const textoEnPastilla = {
  width: "100%",
  boxSizing: "border-box" as const,
  height: "28px",
  border: "none",
  borderRadius: "6px",
  background: "#f1f0ec",
  padding: "0 8px",
  fontSize: "13px",
  fontFamily: "inherit",
};

/** Un desplegable con su botón al lado. */
const conBoton = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 28px",
  gap: "4px",
  alignItems: "center",
};

const casillaChica = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  color: "#555555",
};

/**
 * De qué línea se agarra un muro, dibujado: el muro en corte —revoque,
 * ladrillo, revoque— y en rojo la línea.
 */
function FiguraDeAgarre({ referencia }: { referencia: ReferenciaDeMuro }) {
  const x = {
    exteriorTerminada: 3,
    exterior: 7,
    centro: 12,
    interior: 17,
    interiorTerminada: 21,
  }[referencia];
  return (
    <svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true">
      <rect x="3" y="2" width="4" height="14" fill="#d6d3cc" />
      <rect x="7" y="2" width="10" height="14" fill="#c9a08c" />
      <rect x="17" y="2" width="4" height="14" fill="#d6d3cc" />
      <line x1={x} x2={x} y1="0" y2="18" stroke="#d92d20" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Las capas de una cara: las que lleva, con su × para sacarlas de esa cara, y
 * las que el muro lleva en otras caras, con su + para que ésta las lleve
 * también —el revoque que da la vuelta por el canto—. Al final, una nueva.
 */
function CapasDeLaCara({
  enLaCara,
  delMuro,
  nombre,
  alSumar,
  alQuitar,
}: {
  enLaCara: CapaDibujada[];
  delMuro: CapaDibujada[];
  nombre: (c: CapaDibujada) => string;
  /** Una capa del muro, por su id, o una nueva (`null`). */
  alSumar: (id: string | null) => void;
  alQuitar: (id: string) => void;
}) {
  const color = (c: CapaDibujada) => (c.tarea ? colorDeCapa(c.tarea) : "#9a9a9a");
  return (
    <div style={capasDeCara}>
      {enLaCara.map((c) => (
        <span key={c.id} style={fichaDeCapa} title={nombre(c)}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: color(c), flex: "0 0 auto" }} />
          <span style={textoDeFicha}>{nombre(c)}</span>
          <button
            type="button"
            onClick={() => alQuitar(c.id)}
            aria-label={`Sacar ${nombre(c)} de esta cara`}
            title="Sacar de esta cara"
            style={botonDeFicha}
          >
            ×
          </button>
        </span>
      ))}
      {delMuro.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => alSumar(c.id)}
          title={`Que esta cara lleve también ${nombre(c)}`}
          style={fichaParaSumar}
        >
          <span style={{ color: "#888888" }}>+</span>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: color(c), flex: "0 0 auto" }} />
          <span style={textoDeFicha}>{nombre(c)}</span>
        </button>
      ))}
      <button type="button" onClick={() => alSumar(null)} title="Una capa nueva en esta cara" style={fichaParaSumar}>
        <span style={{ color: "#888888" }}>+</span> nueva
      </button>
    </div>
  );
}

const capasDeCara = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "6px",
  padding: "4px 0",
};

const fichaDeCapa = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  maxWidth: "100%",
  background: "#f1f0ec",
  borderRadius: "6px",
  padding: "3px 4px 3px 8px",
  fontSize: "12px",
};

const fichaParaSumar = {
  ...fichaDeCapa,
  padding: "3px 8px",
  background: "transparent",
  border: "1px dashed #cccccc",
  cursor: "pointer",
  fontFamily: "inherit",
  color: "#555555",
};

const textoDeFicha = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
  maxWidth: "170px",
};

const botonDeFicha = {
  border: "none",
  background: "none",
  color: "#999999",
  fontSize: "14px",
  lineHeight: 1,
  cursor: "pointer",
  padding: "0 4px",
};

/** Cómo se pone una capa, dibujado: el contorno entero o una polilínea suelta. */
function FiguraDeModo({ aMano }: { aMano: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {aMano ? (
        <>
          <path d="M5 19V8h12" />
          <circle cx="5" cy="19" r="1.8" fill="currentColor" />
          <circle cx="5" cy="8" r="1.8" fill="currentColor" />
          <circle cx="17" cy="8" r="1.8" fill="currentColor" />
        </>
      ) : (
        <rect x="4" y="5" width="16" height="14" />
      )}
    </svg>
  );
}

const cabezaDeParedes = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const selectorDeParedes = {
  display: "inline-flex",
  border: "1px solid #dcdcdc",
  borderRadius: "999px",
  overflow: "hidden",
};

const opcion = {
  background: "#ffffff",
  border: "none",
  padding: "4px 10px",
  fontSize: "12px",
  color: "#555555",
  cursor: "pointer",
};

const opcionElegida = {
  ...opcion,
  background: "#111111",
  color: "#ffffff",
};

/** Una capa del ambiente, como la edita la lista de capas. */
function aCapaDeMuro(c: Capa): CapaDeMuro {
  return { tarea: c.tarea || null, espesor: c.espesor ?? 0, desde: c.desde ?? 0, hasta: c.hasta };
}

/**
 * Y de vuelta. Una capa sin tarea todavía se guarda con la tarea vacía: si se
 * la descartara, la fila recién agregada desaparecería antes de elegirla. Las
 * cuentas no la miden.
 */
function aCapas(capas: CapaDeMuro[]): Capa[] {
  return capas.map((c) => ({
    tarea: c.tarea ?? "",
    espesor: c.espesor > 0 ? c.espesor : null,
    hasta: c.hasta,
    ...(c.desde > 0 ? { desde: c.desde } : {}),
  }));
}

const cajaDeCapas = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "10px",
  padding: "12px",
  border: "1px solid #e8e8e8",
  borderRadius: "12px",
  background: "#fafafa",
};

const tituloDeCaja = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#111111",
  margin: 0,
};

const accionesDeCapa = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
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

/** El mismo botón, mientras lo que prende está prendido. */
const botonChicoPuesto = {
  ...botonChico,
  background: BUNA,
  borderColor: BUNA,
  color: "#ffffff",
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
