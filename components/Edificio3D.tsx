"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as ui from "@/components/ui";
import { type CapaDeVista, useCapasDeVista } from "@/lib/capas-de-vista";
import { cantidadEnUnidad } from "@/lib/avance-del-plano";
import { formatNivel } from "@/lib/format";
import type { Campo, ClaseDeSolido, Modelo, Solido } from "@/lib/planta-3d";

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

/** Qué hace arrastrar con el botón izquierdo. */
type Modo = "girar" | "mover";

/** Para qué se mira: el edificio, o el avance de una tarea. */
type Vista = "ver" | "avance";

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
}: {
  /**
   * Con qué abre: una tarea —se la ve como en Avance, sólo lo que la lleva—,
   * un piso por su nombre y una pieza por el suyo. Es lo que manda el cómputo
   * para mostrar de dónde sale un número del plano.
   */
  inicial?: { tarea: string | null; nivel: string | null; cosa: string | null };
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
  const [soloElPiso, setSoloElPiso] = useState<number | null>(() =>
    inicial?.nivel ? pisos.find((p) => nombreDe(p) === inicial.nivel)?.numero ?? null : null
  );
  const [modo, setModo] = useState<Modo>("girar");
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
    inicial?.tarea && tareasDeAvance.some((t) => t.id === inicial.tarea) ? "avance" : "ver"
  );
  /** La tarea cuyo avance se mira, por su id. */
  const [tareaVista, setTareaVista] = useState<string | null>(() =>
    inicial?.tarea && tareasDeAvance.some((t) => t.id === inicial.tarea) ? inicial.tarea : null
  );
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
    escena.add(edificio, resaltado);
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
      // De qué sólido es el triángulo que se tocó: la malla tiene los de
      // todos fundidos, y guarda dónde termina cada uno.
      const datos = toque.object.userData as DatosDeMalla;
      const cual = datos.hasta.findIndex((fin) => toque.faceIndex! < fin);
      const objeto = datos.objetos[cual];
      setElegido(objeto ? { piso: datos.piso, planta: datos.planta, objeto } : null);
    };
    render.domElement.addEventListener("pointerdown", alBajar);
    render.domElement.addEventListener("pointerup", alSubir);

    visor.current = {
      edificio,
      resaltado,
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
      render.domElement.removeEventListener("pointerup", alSubir);
      controles.dispose();
      render.dispose();
      render.domElement.remove();
      visor.current = null;
      tocables.current = [];
    };
  }, []);

  // ---- Qué hace arrastrar -------------------------------------------------
  useEffect(() => {
    const armado = visor.current;
    if (!armado) return;
    const accion = modo === "mover" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    armado.controles.mouseButtons.LEFT = accion;
    // Con un dedo, lo mismo.
    armado.controles.touches.ONE = modo === "mover" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  }, [modo]);

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

    // Cada planta se arma una vez: una malla por clase, con todos sus
    // sólidos fundidos en una sola geometría, y sus aristas.
    type Pieza = { malla: THREE.Mesh; clase: ClaseDeSolido; objetos: string[]; hasta: number[] };
    const plantas = new Map<string, { piezas: Pieza[]; aristas: THREE.LineSegments[] }>();
    for (const [id, modelo] of Object.entries(modelos)) {
      const porClase = new Map<ClaseDeSolido, { geometrias: THREE.BufferGeometry[]; objetos: string[] }>();
      for (const solido of modelo.solidos) {
        if (!visibles(solido.clase)) continue;
        const grupo = porClase.get(solido.clase) ?? { geometrias: [], objetos: [] };
        grupo.geometrias.push(geometriaDe(solido));
        grupo.objetos.push(solido.objeto);
        porClase.set(solido.clase, grupo);
      }

      const piezas: Pieza[] = [];
      for (const [clase, { geometrias, objetos }] of porClase) {
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
        piezas.push({ malla: new THREE.Mesh(fundida, materialDe(clase)), clase, objetos, hasta });
      }

      // Las aristas vienen resueltas: sólo las que son un quiebre de verdad,
      // con lo del mismo material unificado.
      const aristas: THREE.LineSegments[] = [];
      for (const { clase, lineas } of modelo.aristas) {
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
      for (const { malla, clase, objetos, hasta } of planta.piezas) {
        const copia = malla.clone();
        const datos: DatosDeMalla = {
          planta: piso.planta,
          piso: piso.numero,
          clase,
          objetos,
          hasta,
        };
        copia.userData = datos;
        nivel.add(copia);
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
  }, [modelos, pisos, prendidas, soloElPiso, tareaEnAvance, hechasDeLaTarea]);

  // ---- Lo elegido, resaltado ----------------------------------------------
  useEffect(() => {
    const armado = visor.current;
    if (!armado) return;
    const piso = elegido ? pisos.find((p) => p.numero === elegido.piso) : undefined;
    const modelo = elegido ? modelos[elegido.planta] : undefined;
    if (!elegido || !piso || !modelo) {
      armado.dibujar();
      return;
    }

    // Todos los sólidos de la cosa —un muro con una puerta son varios—, del
    // color de lo seleccionado y un pelo por delante de lo que tapan.
    // Mirando el avance de una tarea, sólo las piezas que la llevan.
    const geometrias = modelo.solidos
      .filter(
        (s) =>
          s.objeto === elegido.objeto && (!tareaEnAvance || !s.tareas || s.tareas.includes(tareaEnAvance))
      )
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
  }, [elegido, modelos, pisos, tareaEnAvance]);

  const conPlanta = pisos.filter((p) => p.planta !== null && modelos[p.planta] !== undefined);
  const ficha = elegido ? modelos[elegido.planta]?.objetos[elegido.objeto] ?? null : null;
  const pisoElegido = elegido ? pisos.find((p) => p.numero === elegido.piso) ?? null : null;

  // ---- El avance de la tarea que se mira ----------------------------------
  const rubros = Array.from(new Set(tareasDeAvance.map((t) => t.rubro)));
  const tareaElegida = tareasDeAvance.find((t) => t.id === tareaVista) ?? null;
  const rubroElegido = tareaElegida?.rubro ?? null;
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
    if (rubroElegido !== null && tarea.rubro !== rubroElegido) return [];
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
      <div style={barra}>
        <div style={grupo}>
          {/* Qué hace arrastrar: girar el modelo o correrlo. */}
          <div style={selectorDeModo} role="group" aria-label="Qué hace arrastrar">
            {MODOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                aria-pressed={modo === m.valor}
                onClick={() => setModo(m.valor)}
                style={modo === m.valor ? botonDeModoActivo : botonDeModo}
              >
                {m.nombre}
              </button>
            ))}
          </div>
          {/* Para qué se mira: el edificio, o el avance de una tarea. */}
          <div style={selectorDeModo} role="group" aria-label="Para qué se mira">
            {VISTAS.map((v) => (
              <button
                key={v.valor}
                type="button"
                aria-pressed={vista === v.valor}
                onClick={() => {
                  setVista(v.valor);
                  setElegido(null);
                }}
                style={vista === v.valor ? botonDeModoActivo : botonDeModo}
              >
                {v.nombre}
              </button>
            ))}
          </div>
          {vista === "ver" &&
            OPCIONES.map((o) => (
              <label key={o.clave} style={casilla}>
                <input
                  type="checkbox"
                  checked={ve(o.clave)}
                  onChange={(e) => poner(o.clave, e.target.checked)}
                />
                {o.nombre}
              </label>
            ))}
          {vista === "avance" && (
            <>
              <select
                value={rubroElegido ?? ""}
                onChange={(e) => {
                  // Al cambiar de rubro, su primera tarea.
                  setTareaVista(tareasDeAvance.find((t) => t.rubro === e.target.value)?.id ?? null);
                  setElegido(null);
                }}
                style={selector}
                aria-label="Rubro"
              >
                <option value="" disabled>
                  Rubro
                </option>
                {rubros.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={tareaVista ?? ""}
                onChange={(e) => {
                  setTareaVista(e.target.value || null);
                  setElegido(null);
                }}
                style={{ ...selector, maxWidth: "340px" }}
                aria-label="Tarea"
                disabled={!rubroElegido}
              >
                <option value="" disabled>
                  Tarea
                </option>
                {tareasDeAvance
                  .filter((t) => t.rubro === rubroElegido)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.madre ? `↳ ${t.nombre}` : t.nombre}
                    </option>
                  ))}
              </select>
            </>
          )}
        </div>

        <label style={casilla}>
          Piso
          <select
            value={soloElPiso ?? ""}
            onChange={(e) => setSoloElPiso(e.target.value === "" ? null : Number(e.target.value))}
            style={selector}
          >
            <option value="">Todos</option>
            {/* De arriba hacia abajo, como en la definición de pisos. */}
            {[...conPlanta].reverse().map((p) => (
              <option key={p.numero} value={p.numero}>
                {nombreDe(p)} · {formatNivel(p.cota)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={cuerpo}>
        <div ref={caja} style={{ ...lienzo, cursor: modo === "mover" ? "move" : "grab" }} />

        <aside style={panel}>
          {vista === "avance" ? (
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
                {ficha.renglones.map(([que, cuanto]) => (
                  <div key={que} style={renglon}>
                    <dt style={queEs}>{que}</dt>
                    <dd style={cuantoEs}>{cuanto}</dd>
                  </div>
                ))}
              </dl>
              {ficha.campos.length > 0 && (
                <div style={modificar}>
                  <p style={sobretitulo}>Modificar{guardando ? " · guardando…" : ""}</p>
                  {ficha.campos.map((campo) => (
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

      <p style={pista}>
        {modo === "mover"
          ? "Arrastrá para mover la vista. La rueda acerca y aleja; un clic sin arrastrar elige."
          : "Arrastrá para girar. La rueda acerca y aleja; con el botón derecho también se mueve; un clic sin arrastrar elige."}
      </p>
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

const MODOS: { valor: Modo; nombre: string }[] = [
  { valor: "girar", nombre: "Girar" },
  { valor: "mover", nombre: "Mover" },
];

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
  flexWrap: "wrap" as const,
  gap: "12px",
};

const grupo = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap" as const,
  gap: "16px",
};

const selectorDeModo = {
  display: "flex",
  border: "1px solid #111111",
  borderRadius: "999px",
  overflow: "hidden" as const,
};

const botonDeModo = {
  background: "#ffffff",
  color: "#111111",
  border: "none",
  padding: "7px 14px",
  fontSize: "13px",
  cursor: "pointer",
};

const botonDeModoActivo = {
  ...botonDeModo,
  background: "#111111",
  color: "#ffffff",
  fontWeight: 600,
};

const casilla = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  color: "#333333",
};

const selector = {
  ...ui.input,
  width: "auto",
  padding: "7px 10px",
  fontSize: "14px",
};

const cuerpo = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 280px",
  gap: "12px",
};

const lienzo = {
  minWidth: 0,
  minHeight: 0,
  border: ui.BORDE,
  borderRadius: "14px",
  overflow: "hidden" as const,
  background: "#f4f4f4",
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

const pista = {
  flex: "0 0 auto",
  fontSize: "13px",
  color: "#777777",
  margin: 0,
};
