"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as ui from "@/components/ui";
import { type CapaDeVista, useCapasDeVista } from "@/lib/capas-de-vista";
import { cantidadEnUnidad } from "@/lib/avance-del-plano";
import { formatNivel } from "@/lib/format";
import type { Campo, CaraEn3D, ClaseDeSolido, Modelo, Solido } from "@/lib/planta-3d";

/** Un piso del edificio, con la planta que le toca. */
export type PisoEn3D = {
  numero: number;
  nombre: string;
  /** El nivel de piso terminado, sobre el ±0,00 de la obra. */
  cota: number;
  /** El id de su planta, o null si no tiene. */
  planta: string | null;
};

/** Una tarea que el dibujo lleva, para marcar su avance. */
export type TareaDeAvance = {
  id: string;
  nombre: string;
  rubro: string;
  /** En qué se cotiza: dice si lo que se suma son m² o m³. */
  unidad: string;
  /** Si está en el cómputo: sin eso no hay con qué pesarla en el avance. */
  enComputo: boolean;
  /** Si es subtarea, el id de su madre: el pastinado va debajo del porcelanato. */
  madre: string | null;
};

/** Una cosa marcada como hecha, en un piso, de una tarea. */
export type MarcaDeAvance = {
  planta: string;
  piso: number;
  objeto: string;
  tarea: string;
  cantidad: number;
  fecha: string;
};

/** Qué se tocó: una cosa del dibujo de una planta, en uno de sus pisos. */
type Elegido = { piso: number; planta: string; objeto: string };

/** Para qué se mira: el edificio, o el avance de una tarea. */
type Vista = "ver" | "avance" | "pintar";

/** Lo que se tocó con el bote de pintura (`lib/planta-pintura.ts`). */
export type PinceladaEn3D =
  | { donde: "cara"; tramo: CaraEn3D["tramo"] }
  | { donde: "cielorraso"; ambienteId: string }
  | { donde: "cajon"; cajonId: string };

/**
 * Lo que el bote tiene debajo: qué se pintaría, cómo se lo resalta y, si no se
 * puede, por qué.
 */
type Objetivo = {
  clave: string;
  planta: string;
  pincelada: PinceladaEn3D;
  /** Lo que se resalta, a la altura de un piso. */
  malla: (cota: number) => THREE.Mesh | null;
  bloqueo?: string;
};

/**
 * El edificio levantado, para recorrerlo con el mouse.
 *
 * Cada piso es el modelo de su planta (`lib/planta-3d.ts`) puesto a su cota.
 * La planta se arma una vez y se repite: cuatro pisos tipo son cuatro copias
 * de la misma geometría, cada una a su altura.
 *
 * El visor no decide nada del edificio: los sólidos, las aristas que se ven y
 * los datos de cada cosa vienen hechos del servidor. Acá se dibuja, se gira y
 * se dice qué se tocó.
 *
 * El plano del dibujo (x, y hacia abajo) queda acostado: en three, la x es la
 * misma, la y del plano es la z, y la altura es la y.
 */
export default function Edificio3D({
  modelos,
  pisos,
  rutaDePlantas,
  editar,
  tareasDeAvance = [],
  marcas = [],
  marcar,
  inicial,
  cabecera,
  acciones,
  plantaDeOrigen,
  pinturas = [],
  pintar,
}: {
  /** La planta de la que se vino: el botón 2D vuelve a ella. */
  plantaDeOrigen?: { href: string; nombre: string };
  /** Lo que la pantalla pone a la izquierda de la barra: volver y el título. */
  cabecera?: ReactNode;
  /** Lo que la pantalla suma a la barra, a la derecha: definir los pisos. */
  acciones?: ReactNode;
  /**
   * Con qué abre: una tarea —se la ve como en Avance, sólo lo que la lleva—,
   * un piso por su nombre y una pieza por el suyo. Es lo que manda el cómputo
   * para mostrar de dónde sale un número del plano.
   */
  inicial?: { tarea: string | null; nivel: string | null; cosa: string | null; pintar?: boolean };
  /** Las pinturas que ofrece el bote: las del rubro Pintura, sin sus subtareas. */
  pinturas?: { id: string; nombre: string }[];
  /** Pinta —o despinta— lo tocado de una planta, y guarda. */
  pintar?: (planta: string, tarea: string, pincelada: PinceladaEn3D) => Promise<{ error?: string }>;
  /** El modelo de cada planta, por su id. */
  modelos: Record<string, Modelo>;
  pisos: PisoEn3D[];
  /** Adónde se va a editar una planta: `/obras/<obra>/plantas`. */
  rutaDePlantas: string;
  /** Cambia una medida de una cosa de una planta y la guarda. */
  editar: (
    planta: string,
    objeto: string,
    clave: string,
    valor: number | null
  ) => Promise<{ error?: string }>;
  tareasDeAvance?: TareaDeAvance[];
  marcas?: MarcaDeAvance[];
  /** Marca o desmarca una cosa como hecha, y rehace el avance de su rubro. */
  marcar?: (marca: {
    planta: string;
    piso: number;
    objeto: string;
    tarea: string;
    hecho: boolean;
    fecha: string;
  }) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const caja = useRef<HTMLDivElement>(null);
  /** Lo que arma el visor una vez: la escena y cómo manejarla. */
  const visor = useRef<{
    edificio: THREE.Group;
    resaltado: THREE.Group;
    /** Lo que el bote resalta: la cara que se pintaría. */
    apuntado: THREE.Group;
    controles: OrbitControls;
    encuadrar: (caja: THREE.Box3) => void;
    dibujar: () => void;
  } | null>(null);
  /** Para qué pisos se acomodó la cámara la última vez. */
  const ultimoEncuadre = useRef<string | null>(null);
  /** Las mallas que se pueden tocar, con qué es cada triángulo. */
  const tocables = useRef<THREE.Mesh[]>([]);

  // Las mismas capas de vista que la planta: lo que se oculta allá se oculta acá.
  const { ve, poner } = useCapasDeVista();
  /** Las que se ven, en una cadena: cambia sólo cuando cambia alguna. */
  const prendidas = OPCIONES.filter((o) => ve(o.clave))
    .map((o) => o.clave)
    .join(",");
  /** El piso que se mira solo, por su número; null son todos. */
  /** Los menús que flotan sobre el modelo: cerrados no tapan nada. */
  const [conCapasAbiertas, setConCapasAbiertas] = useState(false);
  const [conPisosAbiertos, setConPisosAbiertos] = useState(false);
  const [soloElPiso, setSoloElPiso] = useState<number | null>(() =>
    inicial?.nivel ? pisos.find((p) => nombreDe(p) === inicial.nivel)?.numero ?? null : null
  );
  const [elegido, setElegido] = useState<Elegido | null>(() => {
    // La pieza que se pidió —"C03", "V07"—, en el piso pedido, si lleva la tarea.
    if (!inicial?.cosa || !inicial.tarea) return null;
    const piso = pisos.find((p) => nombreDe(p) === inicial.nivel && p.planta !== null);
    const modelo = piso?.planta ? modelos[piso.planta] : undefined;
    if (!piso?.planta || !modelo) return null;
    const objeto = Object.keys(modelo.objetos).find(
      (o) =>
        modelo.objetos[o].nombre === inicial.cosa &&
        modelo.objetos[o].tareas?.some((t) => t.tarea === inicial.tarea)
    );
    return objeto ? { piso: piso.numero, planta: piso.planta, objeto } : null;
  });
  const [errorAlEditar, setErrorAlEditar] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();
  const [vista, setVista] = useState<Vista>(() =>
    inicial?.pintar && pintar
      ? "pintar"
      : inicial?.tarea && tareasDeAvance.some((t) => t.id === inicial.tarea)
        ? "avance"
        : "ver"
  );
  /** La pintura del bote: la de interiores, que es la de casi todo, hasta que se elija otra. */
  const [pinturaElegida, setPinturaElegida] = useState<string | null>(
    () => (pinturas.find((p) => /interior/i.test(p.nombre)) ?? pinturas[0])?.id ?? null
  );
  const [errorAlPintar, setErrorAlPintar] = useState<string | null>(null);
  const [pintando, iniciarPintado] = useTransition();
  /**
   * Qué hacer con un toque mientras se pinta. El visor se arma una sola vez y
   * su manejo del mouse no ve el estado de cada momento: lo lee de acá.
   */
  const pintor = useRef<((toque: THREE.Intersection) => void) | null>(null);
  /** Lo mismo con el mouse encima, sin tocar: resalta lo que se pintaría. */
  const sobrevuelo = useRef<((toque: THREE.Intersection | null) => void) | null>(null);
  /** La tarea cuyo avance se mira, por su id. */
  const [tareaVista, setTareaVista] = useState<string | null>(() =>
    inicial?.tarea && tareasDeAvance.some((t) => t.id === inicial.tarea) ? inicial.tarea : null
  );
  /**
   * El rubro que se mira, en los dos modos: en Ver deja sólido lo que lo lleva
   * y el resto apenas insinuado; en Avance es de qué rubro son las tareas que
   * se ofrecen. Se queda al cambiar de modo —mirando la mampostería se pasa a
   * Ver y se la sigue viendo—. null son todos.
   */
  const [rubroVisto, setRubroVisto] = useState<string | null>(
    () => tareasDeAvance.find((t) => t.id === inicial?.tarea)?.rubro ?? null
  );
  /**
   * En Ver, los rubros apagados, como las capas: lo de un rubro con el ojo
   * abierto se ve sólido y lo del resto apenas insinuado. Se pueden mirar
   * varios a la vez. Ninguno apagado es todo el edificio, como siempre.
   */
  const [rubrosApagados, setRubrosApagados] = useState<string[]>(() => {
    const delInicial = tareasDeAvance.find((t) => t.id === inicial?.tarea)?.rubro;
    return delInicial
      ? Array.from(new Set(tareasDeAvance.map((t) => t.rubro))).filter((r) => r !== delInicial)
      : [];
  });
  /** El día con que se marca lo hecho. */
  const [dia, setDia] = useState(hoy);
  const [marcando, iniciarMarcado] = useTransition();
  const [errorAlMarcar, setErrorAlMarcar] = useState<string | null>(null);
  const tareaEnAvance = vista === "avance" ? tareaVista : null;
  /** Lo hecho de la tarea que se mira: planta, piso y cosa. */
  const hechasDeLaTarea = marcas
    .filter((m) => m.tarea === tareaEnAvance)
    .map((m) => `${m.planta}|${m.piso}|${m.objeto}`)
    .sort()
    .join(",");
  /**
   * Las tareas del rubro mirado, en una cadena: el edificio se rehace sólo
   * cuando cambia el rubro, y no en cada render por venir la lista de afuera.
   * Vacía con una tarea en Avance, que ya se pinta por ella; mientras no haya
   * una elegida, el rubro se ve igual que en Ver.
   */
  // En Ver manda lo prendido de cada rubro; con todos apagados no queda nada
  // sólido —"-" no es ninguna tarea—.
  const tareasDelRubro =
    vista === "ver"
      ? rubrosApagados.length === 0
        ? ""
        : tareasDeAvance
            .filter((t) => !rubrosApagados.includes(t.rubro))
            .map((t) => t.id)
            .sort()
            .join(",") || "-"
      : vista === "avance" && rubroVisto !== null && tareaEnAvance === null
        ? tareasDeAvance
            .filter((t) => t.rubro === rubroVisto)
            .map((t) => t.id)
            .sort()
            .join(",")
        : "";

  /** Guarda una medida de lo elegido y vuelve a pedir el edificio: el modelo
   *  se rehace en el servidor, con las mismas cuentas de siempre. */
  const guardarCampo = (clave: string, valor: number | null) => {
    if (!elegido) return;
    const { planta, objeto } = elegido;
    iniciarGuardado(async () => {
      const resultado = await editar(planta, objeto, clave, valor);
      setErrorAlEditar(resultado.error ?? null);
      if (!resultado.error) router.refresh();
    });
  };

  // ---- El visor: una vez --------------------------------------------------
  useEffect(() => {
    const contenedor = caja.current;
    if (!contenedor) return;

    const escena = new THREE.Scene();
    escena.background = new THREE.Color("#f4f4f4");

    const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    const render = new THREE.WebGLRenderer({ antialias: true });
    render.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    contenedor.appendChild(render.domElement);
    render.domElement.style.display = "block";

    // Una luz pareja y otra de costado: sin la segunda, las caras de un muro
    // blanco se ven todas iguales y no se entiende el volumen.
    escena.add(new THREE.HemisphereLight("#ffffff", "#c9c9c9", 1.6));
    const sol = new THREE.DirectionalLight("#ffffff", 1.4);
    sol.position.set(30, 60, 20);
    escena.add(sol);

    const edificio = new THREE.Group();
    const resaltado = new THREE.Group();
    const apuntado = new THREE.Group();
    escena.add(edificio, resaltado, apuntado);
    // Una cámara nueva no está acomodada para nada.
    ultimoEncuadre.current = null;

    const controles = new OrbitControls(camara, render.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.12;
    // Que no se pueda mirar desde abajo del suelo.
    controles.maxPolarAngle = Math.PI / 2 - 0.02;
    // Mover la vista corre el punto que se mira en el plano de la pantalla:
    // es lo que se espera de "arrastrar el modelo".
    controles.screenSpacePanning = true;
    // Como en cualquier programa de 3D: arrastrar con el izquierdo gira, con
    // la rueda apretada (o el derecho) corre la vista, y la rueda acerca.
    controles.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };
    controles.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    const dibujar = () => render.render(escena, camara);
    controles.addEventListener("change", dibujar);

    const medir = () => {
      const { clientWidth: ancho, clientHeight: alto } = contenedor;
      if (ancho === 0 || alto === 0) return;
      render.setSize(ancho, alto, false);
      render.domElement.style.width = "100%";
      render.domElement.style.height = "100%";
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
      dibujar();
    };
    const observador = new ResizeObserver(medir);
    observador.observe(contenedor);
    medir();

    // El amortiguado del giro necesita seguir actualizando un rato después de
    // soltar el mouse.
    let cuadro = 0;
    const animar = () => {
      controles.update();
      cuadro = requestAnimationFrame(animar);
    };
    animar();

    // Tocar: un clic que no fue un arrastre. Se compara dónde bajó y dónde
    // subió el botón, porque girar también empieza con un clic.
    const rayo = new THREE.Raycaster();
    let bajo: { x: number; y: number } | null = null;
    const alBajar = (e: PointerEvent) => {
      bajo = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
    };
    const alSubir = (e: PointerEvent) => {
      if (!bajo || Math.hypot(e.clientX - bajo.x, e.clientY - bajo.y) > 4) return;
      const marco = render.domElement.getBoundingClientRect();
      rayo.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - marco.left) / marco.width) * 2 - 1,
          -((e.clientY - marco.top) / marco.height) * 2 + 1
        ),
        camara
      );
      const toques = rayo.intersectObjects(tocables.current, false);
      // Una columna va adentro del muro y sus caras coinciden: de lo que
      // está a la misma distancia se elige la estructura, que es lo que se
      // ve ahí.
      const toque =
        toques.find(
          (t) =>
            t.distance - toques[0].distance < 0.02 &&
            ESTRUCTURA.has((t.object.userData as DatosDeMalla).clase)
        ) ?? toques[0];
      if (!toque || toque.faceIndex === undefined || toque.faceIndex === null) {
        setElegido(null);
        return;
      }
      // Con el bote en la mano, tocar es pintar.
      if (pintor.current) {
        pintor.current(toque);
        return;
      }
      // De qué sólido es el triángulo que se tocó: la malla tiene los de
      // todos fundidos, y guarda dónde termina cada uno.
      const datos = toque.object.userData as DatosDeMalla;
      const cual = datos.hasta.findIndex((fin) => toque.faceIndex! < fin);
      const objeto = datos.objetos[cual];
      setElegido(objeto ? { piso: datos.piso, planta: datos.planta, objeto } : null);
    };
    // La rueda apretada, en Windows, abre el desplazamiento automático del
    // navegador: acá es para correr la vista.
    const sinAutoDesplazar = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    // Con el bote en la mano, lo que hay debajo del mouse se resalta antes de
    // tocarlo. Una vez por cuadro, y no mientras se arrastra.
    let cuadroDeSobrevuelo = 0;
    const alMover = (e: PointerEvent) => {
      if (!sobrevuelo.current || e.buttons !== 0) return;
      cancelAnimationFrame(cuadroDeSobrevuelo);
      const { clientX, clientY } = e;
      cuadroDeSobrevuelo = requestAnimationFrame(() => {
        const marco = render.domElement.getBoundingClientRect();
        rayo.setFromCamera(
          new THREE.Vector2(
            ((clientX - marco.left) / marco.width) * 2 - 1,
            -((clientY - marco.top) / marco.height) * 2 + 1
          ),
          camara
        );
        const toques = rayo.intersectObjects(tocables.current, false);
        const toque = toques[0];
        sobrevuelo.current?.(toque && toque.faceIndex !== undefined && toque.faceIndex !== null ? toque : null);
      });
    };
    const alSalir = () => {
      cancelAnimationFrame(cuadroDeSobrevuelo);
      sobrevuelo.current?.(null);
    };
    render.domElement.addEventListener("pointerdown", alBajar);
    render.domElement.addEventListener("pointerup", alSubir);
    render.domElement.addEventListener("pointermove", alMover);
    render.domElement.addEventListener("pointerleave", alSalir);
    render.domElement.addEventListener("mousedown", sinAutoDesplazar);

    visor.current = {
      edificio,
      resaltado,
      apuntado,
      controles,
      dibujar,
      // La cámara, de tres cuartos y desde arriba, a la distancia en que entra
      // todo lo que se está mostrando.
      encuadrar: (limites) => {
        const centro = limites.getCenter(new THREE.Vector3());
        const radio = Math.max(limites.getSize(new THREE.Vector3()).length() / 2, 2);
        const distancia = radio / Math.sin((camara.fov * Math.PI) / 360);
        camara.position.set(
          centro.x + distancia * 0.62,
          centro.y + distancia * 0.55,
          centro.z + distancia * 0.62
        );
        camara.near = distancia / 200;
        camara.far = distancia * 20;
        camara.updateProjectionMatrix();
        controles.target.copy(centro);
        controles.update();
        dibujar();
      },
    };

    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      render.domElement.removeEventListener("pointerdown", alBajar);
      render.domElement.removeEventListener("mousedown", sinAutoDesplazar);
      render.domElement.removeEventListener("pointerup", alSubir);
      render.domElement.removeEventListener("pointermove", alMover);
      render.domElement.removeEventListener("pointerleave", alSalir);
      cancelAnimationFrame(cuadroDeSobrevuelo);
      controles.dispose();
      render.dispose();
      render.domElement.remove();
      visor.current = null;
      tocables.current = [];
    };
  }, []);

  // ---- El bote de pintura ------------------------------------------------
  // Lo que hay debajo del mouse se resalta —la cara entera que se pintaría,
  // entre las alturas en que iría la pintura—, y tocar manda eso mismo: la cara
  // que viene calculada del servidor (`modelo.caras`), no un punto.
  useEffect(() => {
    const armado = visor.current;
    const limpiar = () => {
      if (!armado) return;
      for (const hijo of [...armado.apuntado.children]) {
        armado.apuntado.remove(hijo);
        const malla = hijo as THREE.Mesh;
        malla.geometry.dispose();
        (malla.material as THREE.Material).dispose();
      }
    };
    /** Los pisos que son de una planta y se están mirando: lo que se pinta en
     *  ella se pinta en todos. */
    const pisosDe = (planta: string) =>
      pisos.filter((p) => p.planta === planta && (soloElPiso === null || p.numero === soloElPiso));
    if (!armado || vista !== "pintar" || !pintar || !pinturaElegida) {
      pintor.current = null;
      sobrevuelo.current = null;
      limpiar();
      armado?.dibujar();
      return;
    }

    const material = (color: string) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
    /** Los sólidos de una cosa —un cajón, un cielorraso—, a la altura de su piso. */
    const deLaCosa = (modelo: Modelo, objeto: string, clase: ClaseDeSolido) => (cota: number) => {
      const geometrias = modelo.solidos.filter((x) => x.objeto === objeto && x.clase === clase).map(geometriaDe);
      if (geometrias.length === 0) return null;
      const fundida = mergeGeometries(geometrias);
      geometrias.forEach((g) => g.dispose());
      fundida.translate(0, cota, 0);
      return new THREE.Mesh(fundida, material(ACENTO));
    };

    const objetivoDe = (toque: THREE.Intersection): Objetivo | null => {
      const datos = toque.object.userData as DatosDeMalla;
      const cual = datos.hasta.findIndex((fin) => toque.faceIndex! < fin);
      const objeto = datos.objetos[cual] ?? "";
      const modelo = modelos[datos.planta];
      const normal = toque.face?.normal;
      const piso = pisos.find((p) => p.numero === datos.piso);
      if (!modelo || !normal || !piso) return null;
      const { cota } = piso;
      // La clave no es del piso: es lo mismo en todos los de la planta.

      if (objeto.startsWith("cajon:")) {
        return {
          clave: `${datos.planta}|${objeto}`,
          planta: datos.planta,
          pincelada: { donde: "cajon", cajonId: objeto.slice("cajon:".length) },
          malla: deLaCosa(modelo, objeto, "cielorraso"),
        };
      }
      if (datos.clase === "cielorraso" && objeto.startsWith("ambiente:")) {
        return {
          clave: `${datos.planta}|${objeto}|cielorraso`,
          planta: datos.planta,
          pincelada: { donde: "cielorraso", ambienteId: objeto.slice("ambiente:".length) },
          malla: deLaCosa(modelo, objeto, "cielorraso"),
        };
      }
      // La losa vista desde abajo: el cielorraso aplicado del ambiente que
      // queda debajo, con la forma de su piso.
      if (datos.clase === "losa" && normal.y < -0.5) {
        const p = { x: toque.point.x, y: toque.point.z };
        const suPiso = modelo.solidos.find((x) => x.clase === "piso" && adentroDe(p, x.puntos));
        if (!suPiso) return null;
        const alto = toque.point.y - cota;
        return {
          clave: `${datos.planta}|${suPiso.objeto}|cielorraso`,
          planta: datos.planta,
          pincelada: { donde: "cielorraso", ambienteId: suPiso.objeto.slice("ambiente:".length) },
          malla: (enCota) => {
            const g = geometriaDe({ ...suPiso, desde: alto - 0.012, hasta: alto - 0.002 });
            g.translate(0, enCota, 0);
            return new THREE.Mesh(g, material(ACENTO));
          },
        };
      }
      // Una pared: la cara pintable más cerca de lo tocado, del lado que se ve.
      if (
        (datos.clase === "muro" || datos.clase === "capa" || datos.clase === "pintura") &&
        Math.abs(normal.y) < 0.5
      ) {
        const p = { x: toque.point.x + normal.x * 0.05, y: toque.point.z + normal.z * 0.05 };
        const largoDeNormal = Math.hypot(normal.x, normal.z) || 1;
        let mejor: CaraEn3D | null = null;
        let lejos = 0.4;
        for (const cara of modelo.caras) {
          // Que mire para el mismo lado que lo tocado: un canto no se confunde
          // con la cara larga que dobla en su punta.
          if ((cara.n[0] * normal.x + cara.n[1] * normal.z) / largoDeNormal < 0.7) continue;
          // Del lado de la cara al que mira, no del de atrás.
          if ((p.x - cara.a[0]) * cara.n[0] + (p.y - cara.a[1]) * cara.n[1] < -0.02) continue;
          const d = distanciaASegmento(p, cara.a, cara.b);
          if (d < lejos) {
            lejos = d;
            mejor = cara;
          }
        }
        if (!mejor) return null;
        const cara = mejor;
        const abajo = cara.abajo ?? 0;
        return {
          clave: `${datos.planta}|${cara.tramo.muroId}|${cara.tramo.cara}|${cara.tramo.desde}`,
          planta: datos.planta,
          pincelada: { donde: "cara", tramo: cara.tramo },
          bloqueo:
            cara.abajo === null
              ? "Esa cara está revestida hasta arriba: no queda nada a la vista para pintar."
              : undefined,
          malla: (cota) => {
            // Un paño delante de la cara terminada, entre sus dos alturas.
            const afuera = cara.grosor + 0.006;
            const [ax, ay] = [cara.a[0] + cara.n[0] * afuera, cara.a[1] + cara.n[1] * afuera];
            const [bx, by] = [cara.b[0] + cara.n[0] * afuera, cara.b[1] + cara.n[1] * afuera];
            const y0 = cota + abajo;
            const y1 = cota + cara.arriba;
            const g = new THREE.BufferGeometry();
            g.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(
                [ax, y0, ay, bx, y0, by, bx, y1, by, ax, y0, ay, bx, y1, by, ax, y1, ay],
                3
              )
            );
            return new THREE.Mesh(g, material(cara.abajo === null ? "#b91c1c" : ACENTO));
          },
        };
      }
      return null;
    };

    let ultima = "";
    sobrevuelo.current = (toque) => {
      const objetivo = toque ? objetivoDe(toque) : null;
      const clave = objetivo?.clave ?? "";
      if (clave === ultima) return;
      ultima = clave;
      limpiar();
      // En cada piso de la planta: se pinta en todos.
      if (objetivo) {
        for (const p of pisosDe(objetivo.planta)) {
          const malla = objetivo.malla(p.cota);
          if (malla) armado.apuntado.add(malla);
        }
      }
      armado.dibujar();
    };

    pintor.current = (toque) => {
      const objetivo = objetivoDe(toque);
      if (!objetivo) {
        setErrorAlPintar("Tocá una pared, un cielorraso, la losa desde abajo o un cajón.");
        return;
      }
      if (objetivo.bloqueo) {
        setErrorAlPintar(objetivo.bloqueo);
        return;
      }
      setErrorAlPintar(null);
      iniciarPintado(async () => {
        const r = await pintar(objetivo.planta, pinturaElegida, objetivo.pincelada);
        setErrorAlPintar(r.error ?? null);
        if (!r.error) router.refresh();
      });
    };

    return () => {
      pintor.current = null;
      sobrevuelo.current = null;
      limpiar();
    };
  }, [vista, pintar, pinturaElegida, modelos, pisos, soloElPiso, router]);

  // ---- El edificio: cada vez que cambia qué se muestra --------------------
  useEffect(() => {
    const armado = visor.current;
    if (!armado) return;
    const { edificio } = armado;

    // Lo anterior se tira entero: geometrías y materiales son de la placa de
    // video y no se liberan solos.
    const descartables: { dispose: () => void }[] = [];
    const seVen = new Set(prendidas.split(","));
    const visibles = (clase: ClaseDeSolido) => seVen.has(CAPA_DE[clase]);

    const materiales = new Map<ClaseDeSolido, THREE.Material>();
    const materialDe = (clase: ClaseDeSolido) => {
      let material = materiales.get(clase);
      if (!material) {
        const { color, opacidad } = ASPECTO[clase];
        material = new THREE.MeshLambertMaterial({
          color,
          transparent: opacidad < 1,
          opacity: opacidad,
          // Lo transparente no tapa lo que tiene detrás.
          depthWrite: opacidad === 1,
          // Una columna va adentro del muro y sus caras coinciden con las
          // de él: sin esto las dos pelean por el mismo lugar y sale un
          // rayado. La arquitectura se corre un pelo hacia atrás y gana la
          // estructura, que es lo que se quiere ver ahí.
          polygonOffset: !ESTRUCTURA.has(clase),
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        });
        materiales.set(clase, material);
        descartables.push(material);
      }
      return material;
    };
    const filo = new THREE.LineBasicMaterial({ color: "#4b4b4b", transparent: true, opacity: 0.55 });
    descartables.push(filo);

    // Mirando un rubro, lo que no lo lleva no se va: queda apenas insinuado,
    // igual que en Avance, para no perder de vista dónde está parado lo que
    // se mira. No se puede tocar.
    const delRubro = new Set(tareasDelRubro ? tareasDelRubro.split(",") : []);
    const hayRubro = delRubro.size > 0;
    const insinuado = new THREE.MeshBasicMaterial({
      color: "#b8bcc2",
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });
    descartables.push(insinuado);
    /** Si una pieza lleva alguna tarea del rubro mirado. La pieza que dice qué
     *  lleva manda: el cielorraso de un baño no lleva su contrapiso. */
    const esDelRubro = (modelo: Modelo, solido: Solido) =>
      (solido.tareas ?? modelo.objetos[solido.objeto]?.tareas?.map((t) => t.tarea) ?? []).some(
        (id) => delRubro.has(id)
      );

    // Cada planta se arma una vez: una malla por clase —y, con un rubro
    // mirado, una por clase y lado—, con todos sus sólidos fundidos en una
    // sola geometría, y sus aristas.
    type Pieza = {
      malla: THREE.Mesh;
      clase: ClaseDeSolido;
      objetos: string[];
      hasta: number[];
      /** No es del rubro mirado: se ve de refilón y no se toca. */
      insinuada: boolean;
    };
    const plantas = new Map<string, { piezas: Pieza[]; aristas: THREE.LineSegments[] }>();
    for (const [id, modelo] of Object.entries(modelos)) {
      const porGrupo = new Map<
        string,
        {
          clase: ClaseDeSolido;
          insinuada: boolean;
          geometrias: THREE.BufferGeometry[];
          objetos: string[];
        }
      >();
      for (const solido of modelo.solidos) {
        if (!visibles(solido.clase)) continue;
        const insinuada = hayRubro && !esDelRubro(modelo, solido);
        const clave = `${solido.clase}|${insinuada}`;
        const grupo = porGrupo.get(clave) ?? {
          clase: solido.clase,
          insinuada,
          geometrias: [],
          objetos: [],
        };
        grupo.geometrias.push(geometriaDe(solido));
        grupo.objetos.push(solido.objeto);
        porGrupo.set(clave, grupo);
      }

      const piezas: Pieza[] = [];
      const aristas: THREE.LineSegments[] = [];
      for (const { clase, insinuada, geometrias, objetos } of porGrupo.values()) {
        // Dónde termina cada sólido en la lista de triángulos de la fundida.
        const hasta: number[] = [];
        let triangulos = 0;
        for (const g of geometrias) {
          triangulos += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
          hasta.push(triangulos);
        }
        const fundida = mergeGeometries(geometrias);
        for (const g of geometrias) g.dispose();
        if (!fundida) continue;
        descartables.push(fundida);
        piezas.push({
          malla: new THREE.Mesh(fundida, insinuada ? insinuado : materialDe(clase)),
          clase,
          objetos,
          hasta,
          insinuada,
        });
        // Con un rubro mirado, las aristas salen de lo que quedó sólido: las
        // guardadas son de todos los sólidos de la clase y dibujarían también
        // el contorno de lo insinuado.
        if (hayRubro && !insinuada) {
          const bordes = new THREE.EdgesGeometry(fundida, 25);
          descartables.push(bordes);
          aristas.push(new THREE.LineSegments(bordes, filo));
        }
      }

      // Las aristas vienen resueltas: sólo las que son un quiebre de verdad,
      // con lo del mismo material unificado.
      for (const { clase, lineas } of hayRubro ? [] : modelo.aristas) {
        if (!visibles(clase) || lineas.length === 0) continue;
        const posiciones = new Float32Array(lineas.length);
        for (let i = 0; i < lineas.length; i += 3) {
          posiciones[i] = lineas[i];
          posiciones[i + 1] = lineas[i + 2];
          posiciones[i + 2] = lineas[i + 1];
        }
        const geometria = new THREE.BufferGeometry();
        geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
        descartables.push(geometria);
        aristas.push(new THREE.LineSegments(geometria, filo));
      }
      plantas.set(id, { piezas, aristas });
    }

    // Y se repite en cada piso que la tiene, a su cota.
    const mallas: THREE.Mesh[] = [];
    if (tareaEnAvance) {
      // ---- El avance de una tarea ----
      // Piso por piso, porque cada uno avanza por su lado: lo hecho en verde,
      // lo que falta en blanco, y lo que no lleva la tarea apenas insinuado,
      // para ubicarse. Sólo lo que la lleva se puede tocar.
      const hechas = new Set(hechasDeLaTarea.split(","));
      const aspecto = {
        hecho: new THREE.MeshLambertMaterial({ color: HECHO }),
        pendiente: new THREE.MeshLambertMaterial({ color: "#f8f8f6" }),
        contexto: new THREE.MeshBasicMaterial({
          color: "#b8bcc2",
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
        }),
      };
      const filoDeAvance = new THREE.LineBasicMaterial({ color: "#5c5f66" });
      descartables.push(aspecto.hecho, aspecto.pendiente, aspecto.contexto, filoDeAvance);
      for (const piso of pisos) {
        if (soloElPiso !== null && piso.numero !== soloElPiso) continue;
        const modelo = piso.planta ? modelos[piso.planta] : undefined;
        if (!piso.planta || !modelo) continue;
        const nivel = new THREE.Group();
        nivel.position.y = piso.cota;
        const grupos = {
          hecho: { geometrias: [] as THREE.BufferGeometry[], objetos: [] as string[] },
          pendiente: { geometrias: [] as THREE.BufferGeometry[], objetos: [] as string[] },
          contexto: { geometrias: [] as THREE.BufferGeometry[], objetos: [] as string[] },
        };
        for (const solido of modelo.solidos) {
          // La pieza que dice qué lleva manda: el cielorraso de un baño no
          // lleva su contrapiso.
          const lleva = solido.tareas
            ? solido.tareas.includes(tareaEnAvance)
            : modelo.objetos[solido.objeto]?.tareas?.some((t) => t.tarea === tareaEnAvance);
          const estado = !lleva
            ? "contexto"
            : hechas.has(`${piso.planta}|${piso.numero}|${solido.objeto}`)
              ? "hecho"
              : "pendiente";
          grupos[estado].geometrias.push(geometriaDe(solido));
          grupos[estado].objetos.push(solido.objeto);
        }
        for (const estado of ["hecho", "pendiente", "contexto"] as const) {
          const { geometrias, objetos } = grupos[estado];
          if (geometrias.length === 0) continue;
          const hasta: number[] = [];
          let triangulos = 0;
          for (const g of geometrias) {
            triangulos += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
            hasta.push(triangulos);
          }
          const fundida = mergeGeometries(geometrias);
          for (const g of geometrias) g.dispose();
          if (!fundida) continue;
          descartables.push(fundida);
          const malla = new THREE.Mesh(fundida, aspecto[estado]);
          nivel.add(malla);
          if (estado === "contexto") continue;
          const datos: DatosDeMalla = { planta: piso.planta, piso: piso.numero, clase: "muro", objetos, hasta };
          malla.userData = datos;
          mallas.push(malla);
          const bordes = new THREE.EdgesGeometry(fundida, 25);
          descartables.push(bordes);
          nivel.add(new THREE.LineSegments(bordes, filoDeAvance));
        }
        edificio.add(nivel);
      }
    }
    for (const piso of tareaEnAvance ? [] : pisos) {
      if (soloElPiso !== null && piso.numero !== soloElPiso) continue;
      const planta = piso.planta ? plantas.get(piso.planta) : undefined;
      if (!piso.planta || !planta) continue;
      const nivel = new THREE.Group();
      nivel.position.y = piso.cota;
      for (const { malla, clase, objetos, hasta, insinuada } of planta.piezas) {
        const copia = malla.clone();
        nivel.add(copia);
        // Lo que no es del rubro mirado está para ubicarse, no para tocarlo.
        if (insinuada) continue;
        const datos: DatosDeMalla = {
          planta: piso.planta,
          piso: piso.numero,
          clase,
          objetos,
          hasta,
        };
        copia.userData = datos;
        mallas.push(copia);
      }
      for (const lineas of planta.aristas) nivel.add(lineas.clone());
      edificio.add(nivel);
    }
    // El rayo las necesita con su lugar ya calculado.
    edificio.updateMatrixWorld(true);
    tocables.current = mallas;

    // El suelo, en el ±0,00 de la obra: da la referencia de qué está enterrado.
    const limites = new THREE.Box3().setFromObject(edificio);
    if (!limites.isEmpty()) {
      const lado = Math.ceil(Math.max(limites.getSize(new THREE.Vector3()).length() * 1.4, 10));
      const suelo = new THREE.GridHelper(lado, lado, "#bdbdbd", "#dedede");
      const centro = limites.getCenter(new THREE.Vector3());
      suelo.position.set(centro.x, 0, centro.z);
      edificio.add(suelo);
      descartables.push(suelo.geometry, suelo.material as THREE.Material);
      // La cámara se acomoda sólo cuando cambia qué pisos se miran: prender
      // o apagar los cielorrasos no puede sacarla de donde se la dejó.
      const clave = String(soloElPiso);
      if (ultimoEncuadre.current !== clave) {
        ultimoEncuadre.current = clave;
        armado.encuadrar(limites);
      } else {
        armado.dibujar();
      }
    } else {
      armado.dibujar();
    }

    return () => {
      edificio.clear();
      tocables.current = [];
      for (const cosa of descartables) cosa.dispose();
    };
  }, [modelos, pisos, prendidas, soloElPiso, tareaEnAvance, hechasDeLaTarea, tareasDelRubro]);

  // ---- Lo elegido, resaltado ----------------------------------------------
  useEffect(() => {
    const armado = visor.current;
    if (!armado) return;
    const piso = elegido ? pisos.find((p) => p.numero === elegido.piso) : undefined;
    const modelo = elegido ? modelos[elegido.planta] : undefined;
    // Mirando un piso solo, lo elegido en otro no se resalta: quedaba flotando
    // a su cota, sin el edificio alrededor.
    if (!elegido || !piso || !modelo || (soloElPiso !== null && elegido.piso !== soloElPiso)) {
      armado.dibujar();
      return;
    }

    // Los sólidos de la cosa —un muro con una puerta son varios—, del color de
    // lo seleccionado y un pelo por delante de lo que tapan.
    //
    // Sólo los que están a la vista. Resaltar uno apagado o insinuado lo hace
    // aparecer de la nada y miente sobre qué es del rubro: tocando el piso del
    // baño mirando Aislaciones se encendía también su cielorraso de durlock,
    // que es de Cielorrasos y estaba insinuado. Lo mismo con una capa apagada.
    const seVen = new Set(prendidas.split(","));
    const delRubro = new Set(tareasDelRubro ? tareasDelRubro.split(",") : []);
    const geometrias = modelo.solidos
      .filter((s) => {
        if (s.objeto !== elegido.objeto) return false;
        // En Avance no juegan las capas de vista: se pinta por la tarea.
        if (tareaEnAvance) return !s.tareas || s.tareas.includes(tareaEnAvance);
        if (!seVen.has(CAPA_DE[s.clase])) return false;
        if (delRubro.size === 0) return true;
        const suyas = s.tareas ?? modelo.objetos[s.objeto]?.tareas?.map((t) => t.tarea) ?? [];
        return suyas.some((id) => delRubro.has(id));
      })
      .map(geometriaDe);
    const fundida = geometrias.length > 0 ? mergeGeometries(geometrias) : null;
    for (const g of geometrias) g.dispose();
    if (!fundida) {
      armado.dibujar();
      return;
    }
    const material = new THREE.MeshBasicMaterial({
      color: ACENTO,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const malla = new THREE.Mesh(fundida, material);
    malla.position.y = piso.cota;
    armado.resaltado.add(malla);
    armado.dibujar();

    return () => {
      armado.resaltado.clear();
      fundida.dispose();
      material.dispose();
      armado.dibujar();
    };
  }, [elegido, modelos, pisos, tareaEnAvance, prendidas, tareasDelRubro, soloElPiso]);

  const conPlanta = pisos.filter((p) => p.planta !== null && modelos[p.planta] !== undefined);
  const ficha = elegido ? modelos[elegido.planta]?.objetos[elegido.objeto] ?? null : null;

  /**
   * La ficha, acotada al rubro que se mira: una cosa es de varios rubros a la
   * vez —el ambiente tiene su piso, su cielorraso y sus paredes— y contarlos
   * todos mientras se mira uno desmiente el filtro. El baño mirando
   * Aislaciones muestra su cementicia y no el durlock ni el porcelanato.
   *
   * Lo que no sale de ninguna tarea —la superficie, un espesor, un nivel— es
   * lo que la cosa **es** y se muestra siempre.
   */
  const delRubroMirado = new Set(tareasDelRubro ? tareasDelRubro.split(",") : []);
  const renglonesDeLaFicha = (ficha?.renglones ?? []).flatMap(
    ([que, cuanto, partes]): [string, string][] => {
      if (delRubroMirado.size === 0 || !partes) return [[que, cuanto]];
      const suyas = partes.filter((p) => p.tarea !== null && delRubroMirado.has(p.tarea));
      return suyas.length > 0 ? [[que, suyas.map((p) => p.texto).join(" + ")]] : [];
    }
  );
  const camposDeLaFicha = (ficha?.campos ?? []).filter(
    (c) =>
      delRubroMirado.size === 0 || !c.tareas || c.tareas.some((id) => delRubroMirado.has(id))
  );
  const pisoElegido = elegido ? pisos.find((p) => p.numero === elegido.piso) ?? null : null;

  // ---- El avance de la tarea que se mira ----------------------------------
  const rubros = Array.from(new Set(tareasDeAvance.map((t) => t.rubro)));
  const tareaElegida = tareasDeAvance.find((t) => t.id === tareaVista) ?? null;
  /** Lo que mide una cosa de la tarea elegida, en su unidad. */
  const cuantoDe = (planta: string, objeto: string) => {
    const t = modelos[planta]?.objetos[objeto]?.tareas?.find((x) => x.tarea === tareaElegida?.id);
    return t && tareaElegida ? cantidadEnUnidad(t, tareaElegida.unidad) ?? 0 : 0;
  };
  // Todo lo que el edificio tiene de la tarea, y lo hecho: en los pisos que
  // se miran —uno solo, o todos—, así coincide con el renglón del cómputo.
  const pisosQueSeMiran = conPlanta.filter((p) => soloElPiso === null || p.numero === soloElPiso);
  let totalDeLaTarea = 0;
  if (tareaElegida) {
    for (const p of pisosQueSeMiran) {
      for (const objeto of Object.keys(modelos[p.planta!].objetos)) totalDeLaTarea += cuantoDe(p.planta!, objeto);
    }
  }
  const marcasDeLaTarea = marcas.filter((m) => m.tarea === tareaElegida?.id);
  const hechoDeLaTarea = marcasDeLaTarea
    .filter((m) => soloElPiso === null || m.piso === soloElPiso)
    .reduce((s, m) => s + m.cantidad, 0);
  /**
   * Las tareas de lo elegido, con lo que mide de cada una: una ventana lleva
   * el amure de su premarco y su colocación, y cada una se tilda aparte.
   */
  // En el orden de la lista de tareas: cada subtarea detrás de su madre. Con
  // un rubro elegido arriba, sólo las de ese rubro: mirando Cielorrasos, el
  // porcelanato del mismo baño no va.
  const tareasDelElegido = tareasDeAvance.flatMap((tarea) => {
    if (vista === "ver" ? rubrosApagados.includes(tarea.rubro) : rubroVisto !== null && tarea.rubro !== rubroVisto)
      return [];
    const medida = ficha?.tareas?.find((x) => x.tarea === tarea.id);
    return medida ? [{ tarea, cantidad: cantidadEnUnidad(medida, tarea.unidad) }] : [];
  });
  /** Si va sangrada: es subtarea y su madre está en la lista. */
  const esHija = (tarea: TareaDeAvance) =>
    tarea.madre !== null && tareasDelElegido.some((x) => x.tarea.id === tarea.madre);
  /** Si lo elegido ya tiene hecha una tarea, y desde qué día. */
  const marcaDe = (tareaId: string) =>
    elegido
      ? marcas.find(
          (m) =>
            m.tarea === tareaId &&
            m.planta === elegido.planta &&
            m.piso === elegido.piso &&
            m.objeto === elegido.objeto
        ) ?? null
      : null;

  /** Marca o desmarca una tarea de lo elegido; el edificio vuelve con el avance rehecho. */
  const alternarHecho = (tareaId: string) => {
    if (!elegido || !marcar) return;
    const { planta, piso, objeto } = elegido;
    const hecho = marcaDe(tareaId) === null;
    iniciarMarcado(async () => {
      const r = await marcar({ planta, piso, objeto, tarea: tareaId, hecho, fecha: dia });
      setErrorAlMarcar(r.error ?? null);
      if (!r.error) router.refresh();
    });
  };

  return (
    <div style={marco}>
      {/* Una sola barra, como en un programa de 3D: a la izquierda dónde se
          está, a la derecha para qué se mira y los pisos de la obra. Lo que
          cambia qué se ve flota sobre el modelo. */}
      <div style={barra}>
        <div style={grupo}>{cabecera}</div>
        <div style={grupo}>
          <div style={selectorDeModo} role="group" aria-label="Para qué se mira">
            {VISTAS.filter((v) => v.valor !== "pintar" || (pintar && pinturas.length > 0)).map((v) => (
              <button
                key={v.valor}
                type="button"
                aria-pressed={vista === v.valor}
                onClick={() => {
                  if (v.valor === "avance" && vista === "ver") {
                    const prendidos = rubros.filter((r) => !rubrosApagados.includes(r));
                    setRubroVisto(prendidos.length === 1 ? prendidos[0] : null);
                  }
                  if (v.valor === "ver" && vista === "avance") {
                    setRubrosApagados(rubroVisto === null ? [] : rubros.filter((r) => r !== rubroVisto));
                  }
                  setErrorAlPintar(null);
                  setVista(v.valor);
                  setElegido(null);
                }}
                style={vista === v.valor ? botonDeModoActivo : botonDeModo}
              >
                {v.nombre}
              </button>
            ))}
          </div>
          {acciones}
        </div>
      </div>

      <div style={cuerpo}>
        <div style={visorConControles}>
          <div ref={caja} style={vista === "pintar" ? { ...lienzo, cursor: "crosshair" } : lienzo} />

          {/* A la izquierda, qué se ve: las capas en Ver, y el rubro —en
              Avance, con su tarea—. */}
          {/* En Pintar, a la izquierda sólo las capas: para apagar el
              cielorraso y llegar a la pared de atrás. La pintura se elige en
              el panel de la derecha, que no tapa el modelo. */}
          {vista === "pintar" && (
            <Menu
              lado="izquierda"
              ancho="240px"
              titulo="Capas"
              abierto={conCapasAbiertas}
              alTocar={() => setConCapasAbiertas(!conCapasAbiertas)}
            >
              <div style={seccionFlotante}>
                {OPCIONES.map((o) => (
                  <button
                    key={o.clave}
                    type="button"
                    aria-pressed={ve(o.clave)}
                    onClick={() => poner(o.clave, !ve(o.clave))}
                    style={ve(o.clave) ? filaDeCapa : filaDeCapaApagada}
                  >
                    <Ojo abierto={ve(o.clave)} />
                    {o.nombre}
                  </button>
                ))}
              </div>
            </Menu>
          )}

          {vista !== "pintar" && (vista === "ver" || rubros.length > 0) && (
            <Menu
              lado="izquierda"
              ancho="240px"
              titulo={vista === "ver" ? "Capas" : "Rubro"}
              resumen={
                vista === "ver"
                  ? rubrosApagados.length === 0
                    ? undefined
                    : rubros.length - rubrosApagados.length === 1
                      ? rubros.find((r) => !rubrosApagados.includes(r))
                      : `${rubros.length - rubrosApagados.length} de ${rubros.length} rubros`
                  : tareaElegida?.nombre ?? rubroVisto ?? "Todos"
              }
              abierto={conCapasAbiertas}
              alTocar={() => setConCapasAbiertas(!conCapasAbiertas)}
            >
              {vista === "ver" && (
                <div style={seccionFlotante}>
                  {OPCIONES.map((o) => (
                    <button
                      key={o.clave}
                      type="button"
                      aria-pressed={ve(o.clave)}
                      onClick={() => poner(o.clave, !ve(o.clave))}
                      style={ve(o.clave) ? filaDeCapa : filaDeCapaApagada}
                    >
                      <Ojo abierto={ve(o.clave)} />
                      {o.nombre}
                    </button>
                  ))}
                </div>
              )}

              {/* El rubro se queda al cambiar de Ver a Avance: en Ver deja
                  sólido lo suyo y el resto insinuado, en Avance elige de qué
                  son las tareas. Sin tareas en el dibujo no hay qué filtrar. */}
              {rubros.length > 0 && (
                <div style={seccionFlotante}>
                  {vista === "ver" && <span style={rotuloFlotante}>Rubro</span>}
                  {/* En Ver, cada rubro con su ojo, como las capas: se
                      prenden varios a la vez, y Todos los prende o los apaga
                      juntos. En Avance, uno solo, el de las tareas. */}
                  {vista === "ver" ? (
                    <div style={seccionFlotante} role="group" aria-label="Rubros">
                      <button
                        type="button"
                        aria-pressed={rubrosApagados.length === 0}
                        onClick={() => setRubrosApagados(rubrosApagados.length === 0 ? rubros : [])}
                        style={rubrosApagados.length === rubros.length ? filaDeCapaApagada : filaDeCapa}
                      >
                        <Ojo abierto={rubrosApagados.length < rubros.length} />
                        Todos
                      </button>
                      {rubros.map((r) => {
                        const prendido = !rubrosApagados.includes(r);
                        return (
                          <button
                            key={r}
                            type="button"
                            aria-pressed={prendido}
                            onClick={() => {
                              setRubrosApagados(
                                prendido ? [...rubrosApagados, r] : rubrosApagados.filter((x) => x !== r)
                              );
                              setElegido(null);
                            }}
                            style={prendido ? filaDeCapa : filaDeCapaApagada}
                          >
                            <Ojo abierto={prendido} />
                            <span style={nombreDePiso}>{r}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                  <div style={seccionFlotante} role="group" aria-label="Rubro">
                    {[null, ...rubros].map((cual) => (
                      <button
                        key={cual ?? ""}
                        type="button"
                        aria-pressed={rubroVisto === cual}
                        onClick={() => {
                          setRubroVisto(cual);
                          // Para ver un avance hace falta una tarea: la primera del rubro.
                          if (vista === "avance") {
                            setTareaVista(tareasDeAvance.find((t) => t.rubro === cual)?.id ?? null);
                          }
                          setElegido(null);
                        }}
                        style={rubroVisto === cual ? filaDePisoPuesta : filaDePiso}
                      >
                        <span style={nombreDePiso}>{cual ?? "Todos"}</span>
                      </button>
                    ))}
                  </div>
                  )}
                  <div style={selectores}>
                    {vista === "avance" && (
                      <select
                        value={tareaVista ?? ""}
                        onChange={(e) => {
                          setTareaVista(e.target.value || null);
                          setElegido(null);
                        }}
                        style={selector}
                        aria-label="Tarea"
                        disabled={!rubroVisto}
                      >
                        <option value="" disabled>
                          Tarea
                        </option>
                        {tareasDeAvance
                          .filter((t) => t.rubro === rubroVisto)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.madre ? `↳ ${t.nombre}` : t.nombre}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </Menu>
          )}

          {/* A la derecha, los pisos apilados como en el edificio: el de
              arriba, arriba. Uno solo, o todos. */}
          <Menu
            lado="derecha"
            ancho="150px"
            titulo="Pisos"
            resumen={soloElPiso === null ? "Todos" : nombreDe(pisos.find((p) => p.numero === soloElPiso)!)}
            abierto={conPisosAbiertos}
            alTocar={() => setConPisosAbiertos(!conPisosAbiertos)}
          >
            <div style={seccionFlotante} role="group" aria-label="Piso">
              <button
                type="button"
                aria-pressed={soloElPiso === null}
                onClick={() => setSoloElPiso(null)}
                style={soloElPiso === null ? filaDePisoPuesta : filaDePiso}
              >
                Todos
              </button>
              {[...conPlanta].reverse().map((p) => (
                <button
                  key={p.numero}
                  type="button"
                  aria-pressed={soloElPiso === p.numero}
                  onClick={() => setSoloElPiso(soloElPiso === p.numero ? null : p.numero)}
                  style={soloElPiso === p.numero ? filaDePisoPuesta : filaDePiso}
                >
                  <span style={nombreDePiso}>{nombreDe(p)}</span>
                  <span style={nivelDePiso}>{formatNivel(p.cota)}</span>
                </button>
              ))}
            </div>
          </Menu>

          {/* En el mismo lugar que el 3D de la planta: de vuelta a ella. */}
          {plantaDeOrigen && (
            <Link href={plantaDeOrigen.href} title={`Volver a ${plantaDeOrigen.nombre}`} style={ui.botonDeVista}>
              2D
            </Link>
          )}
        </div>

        <aside style={panel}>
          {vista === "pintar" ? (
            <>
              <div style={seccionFlotante} role="group" aria-label="Pintura">
                <p style={{ ...sobretitulo, marginBottom: "6px" }}>Pintura</p>
                {pinturas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={pinturaElegida === p.id}
                    onClick={() => setPinturaElegida(p.id)}
                    style={pinturaElegida === p.id ? filaDePisoPuesta : filaDePiso}
                  >
                    <span style={nombreDePiso}>{p.nombre}</span>
                  </button>
                ))}
              </div>
              {pintando && <p style={vacio}>Pintando…</p>}
              {errorAlPintar && <p style={errorDeCampo}>{errorAlPintar}</p>}
            </>
          ) : vista === "avance" ? (
            tareaElegida || (ficha && elegido) ? (
              <>
                {tareaElegida && (
                  <>
                    <div>
                      <p style={sobretitulo}>{tareaElegida.rubro}</p>
                      <h3 style={tituloDeFicha}>{tareaElegida.nombre}</h3>
                    </div>
                    <div style={{ display: "grid", gap: "6px" }}>
                      <div style={barraDeAvance}>
                        <div
                          style={{
                            ...rellenoDeAvance,
                            width: `${totalDeLaTarea > 0 ? Math.min(100, (hechoDeLaTarea / totalDeLaTarea) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <p style={dondeEsta}>
                        {formatCantidad(hechoDeLaTarea)} de {formatCantidad(totalDeLaTarea)} {tareaElegida.unidad}
                        {totalDeLaTarea > 0 && ` · ${Math.round((hechoDeLaTarea / totalDeLaTarea) * 100)} %`}
                      </p>
                    </div>
                    {!tareaElegida.enComputo && <p style={errorDeCampo}>No está en el cómputo</p>}
                  </>
                )}
                {ficha && elegido && (
                  <div style={tareaElegida ? modificar : { display: "grid", gap: "10px" }}>
                    <div>
                      {/* De una capa por cara, la cara: a qué ambiente da. */}
                      <p style={sobretitulo}>{ficha.titulo === "Capa" ? "Cara" : ficha.titulo}</p>
                      <h3 style={tituloDeFicha}>
                        {ficha.renglones.find(([que]) => que === "Cara")?.[1] ?? (ficha.nombre || ficha.titulo)}
                      </h3>
                      {pisoElegido && <p style={dondeEsta}>{nombreDe(pisoElegido)}</p>}
                    </div>
                    {tareasDelElegido.length === 0 ? (
                      <p style={vacio}>Sin tareas.</p>
                    ) : (
                      <>
                        <input
                          type="date"
                          value={dia}
                          onChange={(e) => setDia(e.target.value || hoy())}
                          style={ui.input}
                          aria-label="Día"
                        />
                        <ul style={tareasDeLaCosa}>
                          {tareasDelElegido.map(({ tarea, cantidad }) => {
                            const marca = marcaDe(tarea.id);
                            const sePuede = marca !== null || (tarea.enComputo && (cantidad ?? 0) > 0);
                            return (
                              <li key={tarea.id}>
                                <label
                                  style={{
                                    ...tareaDeLaCosa,
                                    ...(tarea.id === tareaElegida?.id ? tareaQueSeMira : {}),
                                    ...(esHija(tarea) ? subtareaDeLaCosa : {}),
                                    cursor: sePuede && marcar ? "pointer" : "default",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={marca !== null}
                                    disabled={marcando || !marcar || !sePuede}
                                    onChange={() => alternarHecho(tarea.id)}
                                    style={tilde}
                                  />
                                  <span style={queTarea}>
                                    <span style={nombreDeTarea}>{tarea.nombre}</span>
                                    <span style={detalleDeTarea}>
                                      {tarea.rubro}
                                      {cantidad !== null && ` · ${formatCantidad(cantidad)} ${tarea.unidad}`}
                                      {!tarea.enComputo && " · no está en el cómputo"}
                                    </span>
                                  </span>
                                  <span style={marca ? estadoHecho : estadoPendiente}>
                                    {marca ? formatDia(marca.fecha) : "Pendiente"}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                    {errorAlMarcar && <p style={errorDeCampo}>{errorAlMarcar}</p>}
                  </div>
                )}
              </>
            ) : (
              <p style={vacio}>Elegí un rubro y una tarea, o tocá algo del edificio.</p>
            )
          ) : ficha && elegido ? (
            <>
              <div>
                <p style={sobretitulo}>{ficha.titulo}</p>
                <h3 style={tituloDeFicha}>{ficha.nombre || ficha.titulo}</h3>
                {pisoElegido && (
                  <p style={dondeEsta}>
                    {nombreDe(pisoElegido)} · NPT {formatNivel(pisoElegido.cota)}
                  </p>
                )}
              </div>
              <dl style={lista}>
                {renglonesDeLaFicha.map(([que, cuanto]) => (
                  <div key={que} style={renglon}>
                    <dt style={queEs}>{que}</dt>
                    <dd style={cuantoEs}>{cuanto}</dd>
                  </div>
                ))}
              </dl>
              {camposDeLaFicha.length > 0 && (
                <div style={modificar}>
                  <p style={sobretitulo}>Modificar{guardando ? " · guardando…" : ""}</p>
                  {camposDeLaFicha.map((campo) => (
                    <CampoEditable
                      key={`${elegido.planta}|${elegido.objeto}|${campo.clave}`}
                      campo={campo}
                      alGuardar={(valor) => guardarCampo(campo.clave, valor)}
                    />
                  ))}
                  {errorAlEditar && <p style={errorDeCampo}>{errorAlEditar}</p>}
                  <p style={notaDeCampo}>
                    Se guarda al salir del campo o con Enter, en todos los pisos que son esta
                    planta.
                  </p>
                </div>
              )}
              <Link href={`${rutaDePlantas}/${elegido.planta}`} style={enlace}>
                Abrir su planta para editarla
              </Link>
            </>
          ) : (
            <p style={vacio}>Tocá un muro, una abertura, un piso o una pieza de la estructura para ver qué es.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * Una medida de lo elegido, para corregirla ahí mismo.
 *
 * No guarda con cada tecla: rehacer el edificio a cada letra lo haría saltar
 * mientras se escribe "2,6". Guarda al salir del campo o con Enter, y sólo si
 * lo escrito es una medida que sirve y distinta de la que había; si no, el
 * campo vuelve a mostrar la que tiene.
 */
function CampoEditable({
  campo,
  alGuardar,
}: {
  campo: Campo;
  alGuardar: (valor: number | null) => void;
}) {
  const comoTexto = (valor: number | null) => (valor === null ? "" : String(valor));
  const [texto, setTexto] = useState(comoTexto(campo.valor));
  const [visto, setVisto] = useState(campo.valor);

  // Cuando el edificio vuelve del servidor con el valor nuevo, el campo lo
  // sigue.
  if (visto !== campo.valor) {
    setVisto(campo.valor);
    setTexto(comoTexto(campo.valor));
  }

  const confirmar = () => {
    if (texto.trim() === "") {
      // Vacío es "lo que le toca sola", donde eso existe.
      if (campo.vacio !== undefined && campo.valor !== null) alGuardar(null);
      else setTexto(comoTexto(campo.valor));
      return;
    }
    const n = Number(texto.replace(",", "."));
    const sirve =
      Number.isFinite(n) && (campo.conSigno || (campo.desdeCero ? n >= 0 : n > 0));
    if (!sirve) {
      setTexto(comoTexto(campo.valor));
      return;
    }
    if (n !== campo.valor) alGuardar(n);
  };

  return (
    <label style={campoEditable}>
      <span style={queEs}>{campo.nombre}</span>
      <input
        type="text"
        inputMode="decimal"
        value={texto}
        placeholder={campo.vacio}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setTexto(comoTexto(campo.valor));
          }
        }}
        style={ui.input}
      />
    </label>
  );
}

/** Lo que una malla dice de sí misma al tocarla. */
type DatosDeMalla = {
  planta: string;
  piso: number;
  clase: ClaseDeSolido;
  /** De qué cosa es cada sólido fundido en ella, en orden. */
  objetos: string[];
  /** En qué triángulo termina cada uno. */
  hasta: number[];
};

/** La geometría de un sólido: su huella levantada entre sus dos alturas. */
/**
 * Un menú que flota en una esquina de arriba del modelo. Cerrado es sólo su
 * botón —el nombre y lo que está elegido—, para no tapar el edificio;
 * tocándolo se despliega debajo.
 */
function Menu({
  lado,
  ancho,
  titulo,
  resumen,
  abierto,
  alTocar,
  children,
}: {
  lado: "izquierda" | "derecha";
  /** El ancho desplegado: cerrado mide lo que su botón. */
  ancho: string;
  titulo: string;
  resumen?: string;
  abierto: boolean;
  alTocar: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        ...flotante,
        ...(lado === "izquierda" ? { left: "12px" } : { right: "12px" }),
        ...(abierto ? { width: ancho } : { maxWidth: "260px" }),
      }}
    >
      <button type="button" aria-expanded={abierto} onClick={alTocar} style={cabezaDeMenu}>
        <span style={tituloDeMenu}>{titulo}</span>
        {resumen && <span style={resumenDeMenu}>{resumen}</span>}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          style={{ flex: "0 0 auto", marginLeft: "auto", transform: abierto ? "rotate(180deg)" : undefined }}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierto && <div style={cuerpoDeMenu}>{children}</div>}
    </div>
  );
}

/** Prendida o apagada, como en las capas de cualquier programa de dibujo. */
function Ojo({ abierto }: { abierto: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <path
        d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {abierto ? (
        <circle cx="8" cy="8" r="2" fill="currentColor" />
      ) : (
        <path d="M2.5 13.5 13.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      )}
    </svg>
  );
}

function geometriaDe(solido: Solido): THREE.BufferGeometry {
  const forma = new THREE.Shape();
  for (let i = 0; i < solido.puntos.length; i += 2) {
    // La y del plano crece hacia abajo; la de la forma, hacia arriba.
    const x = solido.puntos[i];
    const y = -solido.puntos[i + 1];
    if (i === 0) forma.moveTo(x, y);
    else forma.lineTo(x, y);
  }
  const geometria = new THREE.ExtrudeGeometry(forma, {
    depth: solido.hasta - solido.desde,
    bevelEnabled: false,
  });
  // Se levanta acostada: girarla la para, y queda con la y del plano hacia
  // el fondo y la altura hacia arriba.
  geometria.rotateX(-Math.PI / 2);
  geometria.translate(0, solido.desde, 0);
  return geometria;
}

/** Si un punto del plano está adentro de una huella dada como x0, y0, x1, y1… */
function adentroDe(p: { x: number; y: number }, puntos: number[]) {
  let dentro = false;
  for (let i = 0, j = puntos.length - 2; i < puntos.length; j = i, i += 2) {
    const [ax, ay, bx, by] = [puntos[i], puntos[i + 1], puntos[j], puntos[j + 1]];
    if (ay > p.y !== by > p.y && p.x < ((bx - ax) * (p.y - ay)) / (by - ay) + ax) dentro = !dentro;
  }
  return dentro;
}

/** Cuánto hay de un punto a un segmento, en el plano. */
function distanciaASegmento(p: { x: number; y: number }, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const largo2 = dx * dx + dy * dy;
  const t = largo2 > 0 ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / largo2)) : 0;
  return Math.hypot(p.x - (a[0] + dx * t), p.y - (a[1] + dy * t));
}

function nombreDe(piso: PisoEn3D) {
  if (piso.nombre.trim() !== "") return piso.nombre.trim();
  if (piso.numero === 0) return "Planta baja";
  return piso.numero > 0 ? `${piso.numero}.º piso` : `${-piso.numero}.º subsuelo`;
}

// ---- Aspecto ----------------------------------------------------------------

const ACENTO = "#e8590c";

/** Lo que se prende y se apaga con "Estructura". */
const ESTRUCTURA = new Set<ClaseDeSolido>(["losa", "viga", "columna", "metal"]);

/** Las capas de vista del 3D: las de la planta que tienen volumen. */
const OPCIONES: { clave: CapaDeVista; nombre: string }[] = [
  { clave: "muros", nombre: "Muros" },
  { clave: "capas", nombre: "Capas" },
  { clave: "aberturas", nombre: "Aberturas" },
  { clave: "ambientes", nombre: "Pisos" },
  { clave: "cielorrasos", nombre: "Cielorrasos" },
  { clave: "estructura", nombre: "Estructura" },
];

/** Con qué capa de vista se prende y apaga cada clase de sólido. */
const CAPA_DE: Record<ClaseDeSolido, CapaDeVista> = {
  muro: "muros",
  capa: "capas",
  pintura: "capas",
  vidrio: "aberturas",
  puerta: "aberturas",
  piso: "ambientes",
  cielorraso: "cielorrasos",
  losa: "estructura",
  viga: "estructura",
  columna: "estructura",
  metal: "estructura",
};

const VISTAS: { valor: Vista; nombre: string }[] = [
  { valor: "ver", nombre: "Ver" },
  { valor: "avance", nombre: "Avance" },
  { valor: "pintar", nombre: "Pintar" },
];

/** Lo hecho, en el 3D y en el panel. */
const HECHO = "#2f9e44";

/** Hoy, en el día de quien mira (no en el de Greenwich): AAAA-MM-DD. */
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 2026-11-23 → 23/11/2026. */
function formatDia(fecha: string) {
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}

function formatCantidad(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

/**
 * De qué color va cada cosa. La arquitectura, clara, como una maqueta; el
 * hormigón, gris; lo metálico, oscuro; la hoja de una puerta, madera; y lo
 * que es para ver a través —el vidrio, el cielorraso— transparente.
 */
const ASPECTO: Record<ClaseDeSolido, { color: string; opacidad: number }> = {
  muro: { color: "#fbfaf7", opacidad: 1 },
  // Un pelo más cálida que el ladrillo: se lee dónde termina el muro y
  // empieza el revoque.
  capa: { color: "#f2eee6", opacidad: 1 },
  // Celeste: se ve de lejos qué paredes ya están pintadas.
  pintura: { color: "#9fcbee", opacidad: 1 },
  vidrio: { color: "#7cc4e8", opacidad: 0.4 },
  puerta: { color: "#b08457", opacidad: 1 },
  piso: { color: "#e3d7c3", opacidad: 1 },
  cielorraso: { color: "#ffffff", opacidad: 0.55 },
  losa: { color: "#b9bec7", opacidad: 1 },
  viga: { color: "#9aa1ad", opacidad: 1 },
  columna: { color: "#8a919e", opacidad: 1 },
  metal: { color: "#3f4754", opacidad: 1 },
};

const marco = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "10px",
  flex: "1 1 auto",
  minHeight: 0,
};

const barra = {
  flex: "0 0 auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const grupo = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minWidth: 0,
};

/** El visor y lo que flota sobre él. */
const visorConControles = {
  position: "relative" as const,
  minWidth: 0,
  minHeight: 0,
  border: ui.BORDE,
  borderRadius: "14px",
  overflow: "hidden" as const,
  background: "#f4f4f4",
};

/**
 * Los paneles que flotan sobre el modelo, como las barras de herramientas de
 * un programa de 3D: blancos, con sombra, en las esquinas de arriba.
 */
const flotante = {
  position: "absolute" as const,
  top: "12px",
  display: "flex",
  flexDirection: "column" as const,
  gap: "14px",
  maxHeight: "calc(100% - 24px)",
  overflowY: "auto" as const,
  boxSizing: "border-box" as const,
  padding: "4px",
  background: "rgba(255, 255, 255, 0.94)",
  border: ui.BORDE,
  borderRadius: "12px",
  boxShadow: ui.SOMBRA,
};

/** El botón de un menú: lo que se ve con el menú cerrado. */
const cabezaDeMenu = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  width: "100%",
  minWidth: 0,
  padding: "8px 10px",
  background: "transparent",
  border: "none",
  borderRadius: "8px",
  color: "#111111",
  fontFamily: "inherit",
  textAlign: "left" as const,
  cursor: "pointer",
};
const tituloDeMenu = {
  flex: "0 0 auto",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "#8a8a8a",
};
const resumenDeMenu = {
  minWidth: 0,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
  whiteSpace: "nowrap" as const,
  fontSize: "13px",
  fontWeight: 500,
};
const cuerpoDeMenu = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "14px",
  padding: "2px 6px 6px",
};

const seccionFlotante = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "2px",
};

const rotuloFlotante = {
  padding: "2px 8px 6px",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "#8a8a8a",
};

const selectores = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "6px",
};

/** Una capa: el ojo y su nombre, en un renglón que se toca entero. */
const filaDeCapa = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  padding: "7px 8px",
  background: "transparent",
  border: "none",
  borderRadius: "8px",
  color: "#111111",
  fontSize: "13px",
  fontFamily: "inherit",
  textAlign: "left" as const,
  cursor: "pointer",
};
const filaDeCapaApagada = { ...filaDeCapa, color: "#a5a5a5" };

/** Un piso: su nombre y su nivel, en dos columnas alineadas. */
const filaDePiso = {
  ...filaDeCapa,
  justifyContent: "space-between",
};
const filaDePisoPuesta = {
  ...filaDePiso,
  background: "#111111",
  color: "#ffffff",
  fontWeight: 600,
};
const nombreDePiso = {
  minWidth: 0,
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
  whiteSpace: "nowrap" as const,
};
const nivelDePiso = {
  fontSize: "11px",
  opacity: 0.7,
  fontWeight: 400,
  fontVariantNumeric: "tabular-nums" as const,
};

const selectorDeModo = {
  display: "flex",
  height: "38px",
  boxSizing: "border-box" as const,
  border: "1px solid #111111",
  borderRadius: "999px",
  overflow: "hidden" as const,
};

const botonDeModo = {
  background: "#ffffff",
  color: "#111111",
  border: "none",
  padding: "0 16px",
  fontSize: "14px",
  fontFamily: "inherit",
  cursor: "pointer",
};

const botonDeModoActivo = {
  ...botonDeModo,
  background: "#111111",
  color: "#ffffff",
  fontWeight: 600,
};

const selector = {
  ...ui.input,
  padding: "7px 10px",
  fontSize: "13px",
};

const cuerpo = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 280px",
  gap: "12px",
};

const lienzo = {
  position: "absolute" as const,
  inset: 0,
  cursor: "grab",
};

const panel = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "14px",
  minHeight: 0,
  overflowY: "auto" as const,
  padding: "16px",
  background: "#ffffff",
  border: ui.BORDE,
  borderRadius: "14px",
  boxShadow: ui.SOMBRA,
};

const sobretitulo = {
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#777777",
  margin: 0,
};

const tituloDeFicha = {
  fontSize: "18px",
  fontWeight: 600,
  margin: "4px 0 0",
  overflowWrap: "anywhere" as const,
};

const dondeEsta = {
  fontSize: "13px",
  color: "#555555",
  margin: "4px 0 0",
};

const lista = {
  display: "grid",
  gap: "10px",
  margin: 0,
};

const renglon = {
  display: "grid",
  gap: "2px",
  borderTop: "1px solid #eeeeee",
  paddingTop: "8px",
};

const queEs = {
  fontSize: "12px",
  color: "#777777",
};

const cuantoEs = {
  margin: 0,
  fontSize: "14px",
  color: "#111111",
  overflowWrap: "anywhere" as const,
};

const barraDeAvance = {
  height: "8px",
  borderRadius: "999px",
  background: "#eeeeee",
  overflow: "hidden" as const,
};

const rellenoDeAvance = {
  height: "100%",
  background: HECHO,
};

const enlace = {
  fontSize: "13px",
  color: "#111111",
};

const modificar = {
  display: "grid",
  gap: "10px",
  borderTop: "1px solid #eeeeee",
  paddingTop: "12px",
};

const campoEditable = {
  display: "grid",
  gap: "4px",
};

/** Las tareas de lo elegido: una por renglón, con su tilde y su estado. */
const tareasDeLaCosa = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "6px",
};

const tareaDeLaCosa = {
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "10px",
  padding: "8px 10px",
  border: "1px solid #eeeeee",
  borderRadius: "10px",
};

/** Una subtarea, debajo de su madre: el pastinado, del porcelanato. */
const subtareaDeLaCosa = { marginLeft: "22px" };

/** La que se está mirando en el 3D, para ubicarla en la lista. */
const tareaQueSeMira = { borderColor: "#cfcfcf", background: "#fafafa" };

const tilde = { width: "16px", height: "16px", margin: 0, accentColor: HECHO };

const queTarea = { display: "grid", gap: "2px", minWidth: 0 };

const nombreDeTarea = { fontSize: "13px", color: "#111111", overflowWrap: "anywhere" as const };

const detalleDeTarea = { fontSize: "12px", color: "#777777" };

const estadoHecho = { fontSize: "12px", fontWeight: 600, color: HECHO, whiteSpace: "nowrap" as const };

const estadoPendiente = { fontSize: "12px", color: "#9a9a9a", whiteSpace: "nowrap" as const };

const errorDeCampo = {
  fontSize: "13px",
  color: ui.ROJO,
  margin: 0,
};

const notaDeCampo = {
  fontSize: "12px",
  color: "#8a8a8a",
  lineHeight: 1.4,
  margin: 0,
};

const vacio = {
  fontSize: "13px",
  color: "#777777",
  lineHeight: 1.5,
  margin: 0,
};
