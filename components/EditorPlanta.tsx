"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import BotonConfirmar from "@/components/BotonConfirmar";
import * as ui from "@/components/ui";
import { formatM2, formatMetros } from "@/lib/format";
import {
  type Abertura,
  type Ambiente,
  type Apertura,
  type Capa,
  type Dibujo,
  type Escala,
  type Mano,
  type Muro,
  type Punto,
  type Referencia,
  type TipoAbertura,
  ABERTURA_INICIAL,
  APERTURAS,
  HOJAS_MAXIMO,
  REFERENCIAS,
  ESPESORES,
  ESPESOR_INICIAL,
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

type Herramienta =
  | "seleccionar"
  | "mover"
  | "escala"
  | "muro"
  | "ambiente"
  | "abertura"
  | "medir"
  | "copiar";

/** Qué parte del plano se ve: la esquina de arriba a la izquierda, en píxeles
 *  de la imagen, y cuántos píxeles de pantalla ocupa cada uno de ellos. */
type Vista = { x: number; y: number; k: number };

type Seleccion = { tipo: "muro" | "ambiente" | "abertura"; id: string } | null;

/**
 * Lo que se está arrastrando. De un muro, un extremo, por dónde está: los
 * extremos que coinciden se mueven juntos y la esquina no se desarma. Una
 * abertura se desliza sobre su muro.
 */
type Agarre =
  // Una punta de un muro. `desde` es dónde está ahora: con las puntas unidas
  // se mueven todas las que coinciden ahí, y sin unir, sólo la de este muro.
  | { tipo: "muro"; id: string; punta: "a" | "b"; desde: Punto }
  | { tipo: "ambiente"; id: string; indice: number }
  // Un lado entero de un ambiente: se corre en paralelo, como una pared. Lleva
  // el polígono de antes y dónde se agarró, para medir cuánto se corrió.
  | { tipo: "lado"; id: string; indice: number; inicio: Punto; puntos: Punto[] }
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
  | { de: "cara"; capas: Capa[] }
  | {
      de: "ambiente";
      nombre: string;
      capas: Capa[];
      piso: string[];
      cielorraso: string[];
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

const HERRAMIENTAS: { valor: Herramienta; nombre: string }[] = [
  { valor: "seleccionar", nombre: "Seleccionar" },
  { valor: "mover", nombre: "Mover" },
  { valor: "escala", nombre: "Escala" },
  { valor: "muro", nombre: "Muro" },
  { valor: "ambiente", nombre: "Ambiente" },
  { valor: "abertura", nombre: "Abertura" },
  { valor: "medir", nombre: "Medir" },
  { valor: "copiar", nombre: "Copiar" },
];

/** Una capa de terminación que se puede elegir: una tarea del catálogo del
 *  cómputo que se mide en m². */
export type CapaDisponible = { id: string; nombre: string; rubro: string };

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
}) {
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
  const [vista, setVista] = useState<Vista | null>(null);
  const [tamano, setTamano] = useState<{ w: number; h: number } | null>(null);

  /** Los puntos de lo que se está dibujando y todavía no es nada. */
  const [enCurso, setEnCurso] = useState<Punto[]>([]);
  const [cursor, setCursor] = useState<{ punto: Punto; iman: boolean } | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);

  const [espesor, setEspesor] = useState(ESPESOR_INICIAL);
  const [referencia, setReferencia] = useState<Referencia>("centro");
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
  const pisos = Math.max(1, Math.round(Number(repeticiones)) || 1);

  // Lo que sale del dibujo y no cambia mientras sólo se mueve el puntero. Se
  // rehace cuando cambian los muros, las aberturas, la escala o el zoom, y no
  // en cada movimiento: con una planta entera son miles de cuentas.
  const { cuerpos, murosPorSuCuerpo, bordes, solapes } = useMemo(() => {
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
    if (mpp !== null) {
      for (const m of dibujo.muros) {
        const cuerpo = cuerpos.get(m.id);
        if (!cuerpo) continue;
        bordes.set(m.id, { esquinas: esquinasDeCuerpo(cuerpo), caras: carasDeCuerpo(cuerpo) });
      }

      // Los rincones son de los dos muros que los forman: si uno se mueve, el
      // rincón deja de atraer.
      for (let i = 0; i < dibujo.muros.length; i++) {
        const uno = bordes.get(dibujo.muros[i].id);
        if (!uno) continue;
        for (let j = i + 1; j < dibujo.muros.length; j++) {
          const otro = bordes.get(dibujo.muros[j].id);
          if (!otro) continue;
          const rincones = crucesDeCaras(uno.caras, otro.caras);
          uno.esquinas.push(...rincones);
          otro.esquinas.push(...rincones);
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
  const largoEncimado = solapes.reduce((t, s) => t + s.largo, 0) * (mpp ?? 0);

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

  const elegirHerramienta = (h: Herramienta) => {
    setHerramienta(h);
    setEnCurso([]);
    setCursor(null);
    setFantasma(null);
    setGuias([]);
    setMedicion(null);
    if (h !== "copiar") setCopiado(null);
    if (h !== "escala") setReglaMarcada(null);
  };

  const borrarSeleccion = () => {
    if (!seleccion) return;
    const { tipo, id } = seleccion;
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
              { ...dibujo.caras, [clave]: capas.map(({ tarea, hasta }) => ({ tarea, hasta })) },
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
        capas: cara.capas.map(({ tarea, hasta }) => ({ tarea, hasta })),
      });
      return;
    }
    // De un ambiente, a una cara le tocan sus paredes.
    ponerCapasDeCara(cara.clave, copiado.capas);
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
    setSeleccion({ tipo: "ambiente", id });
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
      ...dibujo.ambientes.flatMap((a) => a.puntos),
    ];
    return excluido ? todos.filter((p) => !mismoPunto(p, excluido)) : todos;
  };

  /** Las líneas sobre las que se apoya un punto: cada muro por su línea
   *  marcada y por sus dos caras. */
  const lineasDeApoyo = (sinLasDe?: Set<string>): { a: Punto; b: Punto }[] =>
    dibujo.muros.flatMap((m) =>
      sinLasDe?.has(m.id) ? [] : [m, ...(bordes.get(m.id)?.caras ?? [])]
    );

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
              { id: crypto.randomUUID(), a: ultimo, b: p, espesor, referencia, altura: null },
            ],
          },
        });
      }
      setEnCurso([p]);
      return;
    }

    if (herramienta === "ambiente") {
      if (enCurso.length >= 3 && mismoPunto(enCurso[0], p)) {
        cerrarAmbiente(enCurso);
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
            ...dibujo.ambientes.flatMap((amb) => (amb.id === agarrado.id ? [] : amb.puntos)),
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
        setTrazo({
          escala,
          dibujo: {
            ...dibujo,
            ambientes: dibujo.ambientes.map((amb) =>
              amb.id === agarrado.id ? { ...amb, puntos: corrido.puntos } : amb
            ),
          },
        });
        setGuias(alineadoCon ? [{ desde: alineadoCon, hasta: corrido.a }] : []);
        setSucio(true);
        return;
      }

      const origen =
        agarrado.tipo === "muro"
          ? agarrado.desde
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

      const ajuste = ajustar(aPlano(e), {
        previo: null,
        ortogonal: false,
        tolerancia: IMAN * u,
        vertices: verticesMenos(origen, enMovimiento),
        muros: lineasDeApoyo(enMovimiento),
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
        setTrazo({
          escala,
          dibujo: {
            ...dibujo,
            muros: dibujo.muros.map((m) => ({
              ...m,
              a: seMueve(m, "a") ? destino : m.a,
              b: seMueve(m, "b") ? destino : m.b,
            })),
          },
        });
        agarrado.desde = destino;
      } else {
        setTrazo({
          escala,
          dibujo: {
            ...dibujo,
            ambientes: dibujo.ambientes.map((a) =>
              a.id === agarrado.id
                ? {
                    ...a,
                    puntos: a.puntos.map((p, i) =>
                      i === agarrado.indice ? destino : p
                    ),
                  }
                : a
            ),
          },
        });
      }
      setSucio(true);
      return;
    }

    if (
      herramienta === "escala" ||
      herramienta === "muro" ||
      herramienta === "ambiente" ||
      herramienta === "medir"
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
  const agregarPunto = (amb: { id: string; puntos: Punto[] }, indice: number, crudo: Punto) => {
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

    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        ambientes: dibujo.ambientes.map((otro) =>
          otro.id === amb.id
            ? {
                ...otro,
                puntos: [
                  ...otro.puntos.slice(0, indice + 1),
                  nuevo,
                  ...otro.puntos.slice(indice + 1),
                ],
              }
            : otro
        ),
      },
    });
  };

  /** Saca un punto de un ambiente. Con tres ya no: dos puntos no encierran nada. */
  const quitarPunto = (amb: { id: string; puntos: Punto[] }, indice: number) => {
    if (amb.puntos.length <= 3) return;
    cambiar({
      escala,
      dibujo: {
        ...dibujo,
        ambientes: dibujo.ambientes.map((otro) =>
          otro.id === amb.id
            ? { ...otro, puntos: otro.puntos.filter((_, k) => k !== indice) }
            : otro
        ),
      },
    });
  };

  /**
   * Los atajos del editor. Se escuchan en la ventana y no en el lienzo: con el
   * foco en el lienzo dejaban de andar apenas se tocaba un botón del panel
   * —Escuadrar, por ejemplo—, y el Ctrl+Z de después no deshacía nada.
   */
  const alTeclear = useEffectEvent((e: KeyboardEvent) => {
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
        repeticiones: Number(repeticiones),
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
    herramienta === "medir";
  // Las figuras sólo se dejan tocar con Seleccionar: dibujando, un clic sobre
  // un muro es un punto nuevo que se le pega, no una selección.
  const tocable = herramienta === "seleccionar" ? "auto" : "none";

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
          { id: "", a: previo, b: cursor.punto, espesor, referencia, altura: null },
          [],
          mpp,
          u
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
      <div style={columnaLienzo}>
        <div style={barra}>
          <div style={grupoBotones}>
            {HERRAMIENTAS.map((h) => (
              <button
                key={h.valor}
                type="button"
                onClick={() => elegirHerramienta(h.valor)}
                style={herramienta === h.valor ? botonHerramientaActivo : botonHerramienta}
              >
                {h.nombre}
              </button>
            ))}
          </div>

          <div style={grupoBotones}>
            <button
              type="button"
              onClick={deshacer}
              disabled={pasado.length === 0 && enCurso.length === 0}
              style={botonHerramienta}
            >
              Deshacer
            </button>
            <button type="button" onClick={() => setVista(null)} style={botonHerramienta}>
              Encuadrar
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

        <div
          ref={lienzo}
          tabIndex={0}
          style={{
            ...cajaLienzo,
            cursor:
              herramienta === "mover"
                ? "grab"
                : dibujando || herramienta === "abertura"
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
              else if (herramienta === "muro") setEnCurso([]);
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
                      else setSeleccion({ tipo: "ambiente", id: a.id });
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
                    style={{ pointerEvents: tocable === "auto" ? "stroke" : "none" }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      lienzo.current?.focus({ preventScroll: true });
                      setSeleccion({ tipo: "muro", id: m.id });
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
                      setSeleccion({ tipo: "abertura", id: ab.id });
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
              ambienteElegido?.puntos.map((p, i) => {
                const q = ambienteElegido.puntos[(i + 1) % ambienteElegido.puntos.length];
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
                      if (esDobleToque(`lado-${ambienteElegido.id}-${i}`, e.timeStamp)) {
                        e.stopPropagation();
                        agregarPunto(ambienteElegido, i, aPlano(e));
                        return;
                      }
                      agarrar(e, {
                        tipo: "lado",
                        id: ambienteElegido.id,
                        indice: i,
                        inicio: aPlano(e),
                        puntos: ambienteElegido.puntos,
                      });
                    }}
                  />
                );
              })}
            {herramienta === "seleccionar" &&
              ambienteElegido?.puntos.map((p, i) => (
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
                    if (esDobleToque(`punto-${ambienteElegido.id}-${i}`, e.timeStamp)) {
                      e.stopPropagation();
                      quitarPunto(ambienteElegido, i);
                      return;
                    }
                    agarrar(e, { tipo: "ambiente", id: ambienteElegido.id, indice: i });
                  }}
                />
              ))}

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
            {dibujando && cursor && (
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
        </div>

        <p style={pista}>
          {pistaDe(herramienta, enCurso.length, reglaMarcada !== null, copiado !== null)}
        </p>
      </div>

      <aside style={panel}>
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
              <input
                type="number"
                min="1"
                step="1"
                value={repeticiones}
                onChange={(e) => {
                  setRepeticiones(e.target.value);
                  setSucio(true);
                }}
                style={ui.input}
              />
            </label>
          </div>
        </section>

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
            <h3 style={tituloBloque}>Copiar terminación</h3>
            {copiado ? (
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
                      {resumenDeCapas(copiado.piso.map(capaEntera), nombreDeCapa)}
                    </Renglon>
                    <Renglon nombre="Cielorraso">
                      {resumenDeCapas(copiado.cielorraso.map(capaEntera), nombreDeCapa)}
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
                Tocá la cara de un muro, o adentro de un ambiente, para tomar su terminación.
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

        {dibujando && (
          <label style={casilla}>
            <input
              type="checkbox"
              checked={ortogonal}
              onChange={(e) => setOrtogonal(e.target.checked)}
            />
            Trazar a escuadra
          </label>
        )}

        {(dibujando || herramienta === "seleccionar") && (
          <label style={casilla}>
            <input
              type="checkbox"
              checked={conGuias}
              onChange={(e) => setConGuias(e.target.checked)}
            />
            Guías: alinear con otras esquinas
          </label>
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
              capas={ambienteElegido.cielorraso.map(capaEntera)}
              disponibles={capasDisponibles}
              primero={RUBROS_DE_CIELORRASO}
              alCambiar={(nuevas) =>
                cambiarAmbiente(ambienteElegido.id, { cielorraso: nuevas.map((c) => c.tarea) })
              }
            />

            <p style={subtitulo}>Piso</p>
            <EditorDeCapas
              capas={ambienteElegido.piso.map(capaEntera)}
              disponibles={capasDisponibles}
              primero={RUBROS_DE_PISO}
              alCambiar={(nuevas) =>
                cambiarAmbiente(ambienteElegido.id, { piso: nuevas.map((c) => c.tarea) })
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
              suyas.
            </p>
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

        <section style={bloque}>
          <h3 style={tituloBloque}>Medidas</h3>

          {medidas === null ? (
            <p style={nota}>Marcá la escala para ver las medidas.</p>
          ) : (
            <>
              <p style={subtitulo}>Muros</p>
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

              {solapes.length > 0 && (
                <p style={alerta}>
                  {solapes.length === 1
                    ? "Hay dos muros encimados"
                    : `Hay ${solapes.length} pares de muros encimados`}
                  : {formatMetros(largoEncimado)} están contados dos veces. Van en rojo en el
                  plano.
                </p>
              )}

              <p style={subtitulo}>Ambientes</p>
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

              {terminaciones && terminaciones.porCapa.length > 0 && (
                <>
                  <p style={subtitulo}>Terminaciones de pared</p>
                  <FilasDeCapas filas={terminaciones.porCapa} nombres={nombreDeCapa} />
                  {/* Lo que falta: sin esto, un baño terminado y el resto sin
                      tocar se leería como la planta entera. */}
                  {terminaciones.sinTerminacion > 0.005 && (
                    <Renglon nombre="Caras sin terminación">
                      {formatM2(terminaciones.sinTerminacion)}
                    </Renglon>
                  )}
                </>
              )}

              {terminaciones && terminaciones.pisos.length > 0 && (
                <>
                  <p style={subtitulo}>Pisos</p>
                  <FilasDeCapas filas={terminaciones.pisos} nombres={nombreDeCapa} />
                  {terminaciones.sinPiso > 0.005 && (
                    <Renglon nombre="Ambientes sin piso">
                      {formatM2(terminaciones.sinPiso)}
                    </Renglon>
                  )}
                </>
              )}

              {terminaciones && terminaciones.cielorrasos.length > 0 && (
                <>
                  <p style={subtitulo}>Cielorrasos</p>
                  <FilasDeCapas filas={terminaciones.cielorrasos} nombres={nombreDeCapa} />
                  {terminaciones.sinCielorraso > 0.005 && (
                    <Renglon nombre="Ambientes sin cielorraso">
                      {formatM2(terminaciones.sinCielorraso)}
                    </Renglon>
                  )}
                </>
              )}

              {medidas.aberturas.length > 0 && (
                <>
                  <p style={subtitulo}>Aberturas</p>
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
                </>
              )}

              {pisos > 1 && (
                <>
                  <p style={subtitulo}>En los {pisos} pisos</p>
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
                  {/* Pared, piso y cielorraso juntos: en el edificio entero lo
                      que importa es cuánto hay de cada tarea. */}
                  {terminaciones &&
                    porTarea([
                      ...terminaciones.porCapa,
                      ...terminaciones.pisos,
                      ...terminaciones.cielorrasos,
                    ]).map(({ capa, superficie }) => (
                      <Renglon key={capa} nombre={nombreDeCapa.get(capa) ?? "Tarea eliminada"}>
                        {formatM2(superficie * pisos)}
                      </Renglon>
                    ))}
                </>
              )}
            </>
          )}
        </section>

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
      </aside>
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
                <option value="techo">el techo</option>
                <option value="cielorraso">
                  el cielorraso{alturaCielorraso ? ` (${formatMedida(alturaCielorraso)})` : ""}
                </option>
                <option value="otra">otra altura</option>
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
        </div>
      ))}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) alCambiar([...capas, { tarea: e.target.value, hasta: "techo" }]);
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

/** Los m² de cada capa, con su color: un bloque de las medidas. */
function FilasDeCapas({
  filas,
  nombres,
}: {
  filas: { capa: string; superficie: number }[];
  nombres: Map<string, string>;
}) {
  return (
    <>
      {filas.map(({ capa, superficie }) => (
        <div key={capa} style={renglon}>
          <span style={nombreConMuestra}>
            <span style={{ ...muestra, background: colorDeCapa(capa) }} />
            <span style={nombreRenglon}>
              {nombres.get(capa) ?? "Tarea que ya no está en el catálogo"}
            </span>
          </span>
          <span style={valorRenglon}>{formatM2(superficie)}</span>
        </div>
      ))}
    </>
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

// Los rubros que van primero en el desplegable de capas, según qué se
// termina: los que tocan arriba y el resto del catálogo después.
const RUBROS_DE_PARED = ["Revoques", "Revestimientos", "Pintura", "Aislaciones"];
const RUBROS_DE_PISO = ["Contrapisos", "Pisos", "Aislaciones"];
const RUBROS_DE_CIELORRASO = ["Cielorrasos", "Pintura"];

/** Las capas en una línea: "Revoque + Porcelanato", o que no hay ninguna. */
function resumenDeCapas(capas: Capa[], nombres: Map<string, string>) {
  return capas.length === 0
    ? "ninguna"
    : capas.map((capa) => nombres.get(capa.tarea) ?? "?").join(" + ");
}

/** Una capa de piso o de cielorraso: no tiene altura, es la tarea sola. */
function capaEntera(tarea: string): Capa {
  return { tarea, hasta: "techo" };
}

/** Junta por tarea: la misma en la pared y en el piso es una sola cantidad. */
function porTarea(filas: { capa: string; superficie: number }[]) {
  const sumas = new Map<string, number>();
  for (const { capa, superficie } of filas) {
    sumas.set(capa, (sumas.get(capa) ?? 0) + superficie);
  }
  return Array.from(sumas, ([capa, superficie]) => ({ capa, superficie }));
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
  puntos: number,
  reglaMarcada: boolean,
  copiado: boolean
) {
  switch (herramienta) {
    case "copiar":
      return copiado
        ? "Clic en cada cara o ambiente que lleva esa terminación. Esc para tomar otra."
        : "Clic en la cara de un muro o adentro de un ambiente para tomar su terminación.";
    case "seleccionar":
      return "Clic en algo para verlo y moverlo; una abertura, de una esquina para alinearla. Doble clic parte un muro o suma un punto a un ambiente. Supr borra.";
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

const marco = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 300px",
  gap: "20px",
  alignItems: "stretch",
};

const columnaLienzo = {
  minWidth: 0,
};

const barra = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap" as const,
  gap: "12px",
  marginBottom: "12px",
};

const grupoBotones = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "6px",
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

const botonGuardarQuieto = {
  ...botonHerramienta,
  color: "#999999",
  cursor: "default",
};

const cajaLienzo = {
  height: "calc(100vh - 170px)",
  minHeight: "520px",
  border: ui.BORDE,
  borderRadius: "12px",
  background: "#f4f4f4",
  overflow: "hidden" as const,
  outline: "none",
};

const pista = {
  fontSize: "13px",
  color: "#777777",
  margin: "10px 2px 0",
};

const panel = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "22px",
  minWidth: 0,
};

const bloque = {
  display: "grid",
  gap: "10px",
};

const tituloBloque = {
  fontSize: "14px",
  fontWeight: 600,
  margin: 0,
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

const nombreRenglon = {
  minWidth: 0,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
  whiteSpace: "nowrap" as const,
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
