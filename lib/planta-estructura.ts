/**
 * La estructura de hormigón de una planta: columnas, vigas y losas, y cuánto
 * hormigón lleva cada una.
 *
 * Es la estructura **de arriba** del piso: las columnas que lo atraviesan y
 * las vigas y la losa que lo cubren —"sobre planta baja", "sobre 1.º"—. Todas
 * las alturas se miden desde el nivel de piso terminado de la planta, que es
 * siempre 0,00; el fondo de losa cae, si no se dice otra cosa, a la altura de
 * piso a techo de la planta.
 *
 * Cada pieza es un prisma: una huella en planta y un tramo de altura. Con eso
 * alcanza para decir cuánto se pisan dos piezas, que es lo que hace falta para
 * no contar dos veces el hormigón de un nudo.
 *
 * Sin React y sin base: son cuentas, y se prueban solas.
 */

import {
  type Ancla,
  type Columna,
  type Material,
  type Estructura,
  type Losa,
  type Punto,
  type Viga,
  areaDe,
  distancia,
} from "@/lib/planta-dibujo";

// ---- Las huellas ----------------------------------------------------------

/**
 * El rectángulo que ocupa una columna en planta, en píxeles. Sin girar, sus
 * lados van con los ejes del plano: el ancho en horizontal, la profundidad en
 * vertical.
 *
 * El punto que se marcó es el **ancla**: el centro o una de las cuatro
 * esquinas. Una columna se ubica casi siempre por una esquina —la que coincide
 * con la del muro, o con el filo de la medianera—, y marcar esa esquina es más
 * exacto que calcular dónde cae el centro.
 *
 * **Gira alrededor del ancla**, que no se mueve. Las esquinas salen siempre
 * en el mismo orden —las que sin girar serían la superior izquierda, la
 * superior derecha, la inferior derecha y la inferior izquierda—, así que el
 * nombre de cada ancla sigue a su esquina aunque la columna esté dada vuelta.
 */
export function huellaDeColumna(columna: Columna, mpp: number): Punto[] {
  const ancho = columna.ancho / mpp;
  const profundidad = columna.profundidad / mpp;

  const x =
    columna.ancla === "centro"
      ? columna.p.x - ancho / 2
      : columna.ancla === "sd" || columna.ancla === "id"
        ? columna.p.x - ancho
        : columna.p.x;
  const y =
    columna.ancla === "centro"
      ? columna.p.y - profundidad / 2
      : columna.ancla === "ii" || columna.ancla === "id"
        ? columna.p.y - profundidad
        : columna.p.y;

  const derecha = [
    { x, y },
    { x: x + ancho, y },
    { x: x + ancho, y: y + profundidad },
    { x, y: y + profundidad },
  ];
  if (columna.giro % 360 === 0) return derecha;

  // Con la y hacia abajo, como en el plano, este giro es el de las agujas del
  // reloj.
  const angulo = (columna.giro * Math.PI) / 180;
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  return derecha.map((esquina) => {
    const dx = esquina.x - columna.p.x;
    const dy = esquina.y - columna.p.y;
    return { x: columna.p.x + dx * cos - dy * sen, y: columna.p.y + dx * sen + dy * cos };
  });
}

/**
 * Dónde quedaría el punto marcado de una columna si se la agarrara de otro
 * lado, **sin moverla**. Cambiar el ancla de una columna ya puesta no la tiene
 * que correr: sólo cambia desde dónde crece cuando se le cambia la sección, y
 * alrededor de qué punto gira.
 */
export function puntoDeAncla(columna: Columna, mpp: number, ancla: Ancla): Punto {
  const [si, sd, id, ii] = huellaDeColumna(columna, mpp);
  switch (ancla) {
    case "si":
      return si;
    case "sd":
      return sd;
    case "id":
      return id;
    case "ii":
      return ii;
    default:
      return { x: (si.x + id.x) / 2, y: (si.y + id.y) / 2 };
  }
}

/** Un giro llevado a entre -180 (sin incluir) y 180 grados. */
export function normalizarGiro(grados: number): number {
  const vuelta = ((grados % 360) + 360) % 360;
  return vuelta > 180 ? vuelta - 360 : vuelta;
}

/**
 * El rectángulo que ocupa una viga en planta, en píxeles.
 *
 * La línea marcada es su eje o una de sus caras, igual que en un muro
 * (`cuerpoDeMuro`): el ancho crece centrado o entero hacia un lado.
 */
export function huellaDeViga(viga: Viga, mpp: number): Punto[] {
  const largo = distancia(viga.a, viga.b);
  if (!(largo > 0)) return [];

  const nx = -(viga.b.y - viga.a.y) / largo;
  const ny = (viga.b.x - viga.a.x) / largo;
  const ancho = viga.ancho / mpp;
  const [desde, hasta] =
    viga.referencia === "exterior"
      ? [0, ancho]
      : viga.referencia === "interior"
        ? [-ancho, 0]
        : [-ancho / 2, ancho / 2];

  return [
    { x: viga.a.x + nx * desde, y: viga.a.y + ny * desde },
    { x: viga.b.x + nx * desde, y: viga.b.y + ny * desde },
    { x: viga.b.x + nx * hasta, y: viga.b.y + ny * hasta },
    { x: viga.a.x + nx * hasta, y: viga.a.y + ny * hasta },
  ];
}

// ---- Recortar polígonos ---------------------------------------------------

/**
 * Lo que queda de un polígono adentro de otro, que tiene que ser convexo
 * (Sutherland–Hodgman). El primero puede tener cualquier forma: la losa en L
 * recortada por el rectángulo de una viga.
 */
function recortar(sujeto: Punto[], convexo: Punto[]): Punto[] {
  if (sujeto.length < 3 || convexo.length < 3) return [];

  // De qué lado queda el adentro depende de en qué sentido está recorrido.
  let doble = 0;
  for (let i = 0; i < convexo.length; i++) {
    const p = convexo[i];
    const q = convexo[(i + 1) % convexo.length];
    doble += p.x * q.y - q.x * p.y;
  }
  const sentido = doble >= 0 ? 1 : -1;

  let salida = sujeto;
  for (let i = 0; i < convexo.length && salida.length > 0; i++) {
    const a = convexo[i];
    const b = convexo[(i + 1) % convexo.length];
    const lado = (p: Punto) =>
      ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) * sentido;

    const entrada = salida;
    salida = [];
    for (let k = 0; k < entrada.length; k++) {
      const actual = entrada[k];
      const anterior = entrada[(k - 1 + entrada.length) % entrada.length];
      const dActual = lado(actual);
      const dAnterior = lado(anterior);

      if (dActual >= 0 !== dAnterior >= 0) {
        // El lado cruza el borde: el punto donde lo corta.
        const t = dAnterior / (dAnterior - dActual);
        salida.push({
          x: anterior.x + (actual.x - anterior.x) * t,
          y: anterior.y + (actual.y - anterior.y) * t,
        });
      }
      if (dActual >= 0) salida.push(actual);
    }
  }
  return salida;
}

// ---- Los prismas ----------------------------------------------------------

/** Una pieza como volumen: su huella y entre qué alturas está. */
type Prisma = { huella: Punto[]; convexa: boolean; desde: number; hasta: number };

const HOLGURA = 1e-9;

/** La superficie que comparten dos huellas, en píxeles². */
function comun(una: Prisma, otra: Prisma): Punto[] {
  if (una.convexa) return recortar(otra.huella, una.huella);
  if (otra.convexa) return recortar(una.huella, otra.huella);
  // Dos formas cualesquiera no se saben recortar entre sí. No pasa: una losa
  // sólo se compara con columnas.
  return [];
}

/**
 * Cuánto del volumen de una pieza está ocupado por otras, en píxeles² · m.
 *
 * Se corta la altura de la pieza en tramos, en cada nivel donde otra empieza
 * o termina: adentro de un tramo, las que la pisan son siempre las mismas, y
 * lo tapado es la superficie que le sacan entre todas por el alto del tramo.
 *
 * Donde dos de las otras se pisan entre sí —una columna y una viga que llega
 * a ella— ese pedazo se le saca una sola vez. Más de dos a la vez en el mismo
 * punto no se corrige: no es una estructura, es un dibujo encimado.
 */
function tapado(pieza: Prisma, otras: Prisma[]): number {
  const niveles = new Set<number>([pieza.desde, pieza.hasta]);
  for (const otra of otras) {
    for (const nivel of [otra.desde, otra.hasta]) {
      if (nivel > pieza.desde + HOLGURA && nivel < pieza.hasta - HOLGURA) niveles.add(nivel);
    }
  }
  const cortes = Array.from(niveles).sort((a, b) => a - b);
  const superficie = areaDe(pieza.huella);

  let volumen = 0;
  for (let i = 0; i + 1 < cortes.length; i++) {
    const abajo = cortes[i];
    const arriba = cortes[i + 1];
    const activas = otras.filter(
      (otra) => otra.desde <= abajo + HOLGURA && otra.hasta >= arriba - HOLGURA
    );
    if (activas.length === 0) continue;

    const partes = activas.map((otra) => comun(pieza, otra));
    let sacado = partes.reduce((t, parte) => t + areaDe(parte), 0);

    // Lo que dos de ellas le sacan en el mismo lugar se había contado doble.
    for (let k = 0; k < activas.length; k++) {
      if (partes[k].length < 3) continue;
      for (let l = k + 1; l < activas.length; l++) {
        if (partes[l].length < 3) continue;
        if (activas[l].convexa) sacado -= areaDe(recortar(partes[k], activas[l].huella));
        else if (activas[k].convexa) sacado -= areaDe(recortar(partes[l], activas[k].huella));
      }
    }

    volumen += Math.min(superficie, Math.max(0, sacado)) * (arriba - abajo);
  }
  return volumen;
}

// ---- Las medidas ----------------------------------------------------------

export type PiezaMedida = {
  id: string;
  nombre: string;
  /** Entre qué alturas está, en metros sobre el piso terminado. */
  desde: number;
  hasta: number;
  /** m³ de la pieza entera, sin mirar a las demás. */
  bruto: number;
  /** m³ que le quedan, sacándole lo que es de otra pieza. */
  neto: number;
};

export type VigaMedida = PiezaMedida & {
  material: Material;
  /** El de la línea marcada. De una metálica es lo que se computa. */
  largo: number;
  /**
   * Cuánto asoma debajo del fondo de la losa que tiene encima, en metros: lo
   * que se ve de la viga desde abajo. Null si no tiene losa encima.
   */
  bajoLosa: number | null;
};
export type LosaMedida = PiezaMedida & { superficie: number };
/** De una metálica, el hormigón es cero y lo que cuenta es `alto`: su largo. */
export type ColumnaMedida = PiezaMedida & { material: Material; alto: number };

export type MedidaDeEstructura = {
  /** Todas, las de hormigón y las metálicas. */
  columnas: ColumnaMedida[];
  vigas: VigaMedida[];
  losas: LosaMedida[];
  /** m³ netos de cada clase y de todo. */
  totalColumnas: number;
  totalVigas: number;
  totalLosas: number;
  total: number;
  /** m³ que se descontaron por cruces: bruto menos neto. */
  descontado: number;
};

/**
 * A qué alturas va una losa, en metros sobre el piso terminado de la planta.
 *
 * **La losa sostiene el piso de arriba, y es desde ese piso terminado que se
 * la ubica**: su cara de arriba queda `bajoNpt` más abajo —lo que ocupan el
 * contrapiso, la carpeta y el piso—, y su fondo, un espesor más abajo todavía.
 * El piso terminado que sostiene está a `pisoAPiso` del de la planta.
 *
 * Sin `bajoNpt` o sin `pisoAPiso` —no se dijo cuánto, o la planta todavía no
 * es de ningún piso de la obra— no hay de dónde colgarla: va con su fondo a
 * la altura de piso a techo de la planta, y `bajoNpt` vuelve con lo que eso
 * deja entre la losa y el piso de arriba, si se sabe, para mostrarlo.
 */
export function nivelesDeLosa(
  espesor: number,
  bajoNpt: number | null,
  alturaDePlanta: number,
  pisoAPiso: number | null
): { arriba: number; fondo: number; bajoNpt: number | null } {
  if (bajoNpt !== null && pisoAPiso !== null) {
    const arriba = pisoAPiso - bajoNpt;
    return { arriba, fondo: arriba - espesor, bajoNpt };
  }
  const arriba = alturaDePlanta + espesor;
  return {
    arriba,
    fondo: alturaDePlanta,
    bajoNpt: pisoAPiso !== null ? pisoAPiso - arriba : null,
  };
}

/**
 * Cuánto hormigón lleva la estructura de una planta.
 *
 * **Los cruces se descuentan**, y quién se queda con el nudo está fijo:
 * primero la columna, después la losa, después la viga. Es la regla de un
 * cómputo métrico de hormigón: la columna va de corrido, la losa se mide
 * entera y la viga, por lo que asoma debajo de la losa y entre las caras de
 * las columnas. Entre dos vigas que se cruzan, el nudo es de la que se dibujó
 * primero.
 *
 * Las alturas, salvo que la pieza diga otra cosa:
 *
 *   losa      **referida al piso terminado que sostiene** —el del piso de
 *             arriba, a `pisoAPiso` del de la planta—: su cara de arriba queda
 *             `bajoNpt` por debajo de él (`nivelesDeLosa`). Si no se dijo
 *             cuánto, o la planta no es de ningún piso, su fondo va a la
 *             altura de piso a techo de la planta.
 *   viga      su cara de arriba, en la cara de arriba de la losa que tiene
 *             encima: **la altura de una viga incluye la losa**. Una de 12×45
 *             bajo una losa de 12 asoma 33.
 *   columna   desde la cara de arriba de la losa de abajo —`bajoNpt` por
 *             debajo del piso terminado de la planta— hasta el fondo de la
 *             losa que tiene encima.
 *
 * Las piezas **metálicas** —columnas y vigas— no entran en el hormigón: llevan
 * cero m³, no se quedan con ningún nudo, y lo suyo es el largo
 * (`ColumnaMedida.alto`, `VigaMedida.largo`). La viga metálica, además, va
 * **debajo** de su losa: su cara de arriba es el fondo de la losa.
 *
 * Es de **un** piso. Null sin escala: no hay con qué medir las huellas.
 */
export function medirEstructura(
  estructura: Estructura,
  mpp: number | null,
  alturaDePlanta: number,
  pisoAPiso: number | null = null
): MedidaDeEstructura | null {
  if (mpp === null) return null;

  const techo = alturaDePlanta > 0 ? alturaDePlanta : 0;
  const pixel2 = mpp * mpp;
  // Hasta dónde llega lo que no tiene una losa dibujada encima: la cara de
  // arriba de la estructura si se la refirió al piso que sostiene, y si no el
  // techo de la planta.
  const sinLosa =
    estructura.bajoNpt !== null && pisoAPiso !== null ? pisoAPiso - estructura.bajoNpt : techo;

  const losas = estructura.losas.map((losa) => {
    const niveles = nivelesDeLosa(
      losa.espesor,
      losa.bajoNpt ?? estructura.bajoNpt,
      techo,
      pisoAPiso
    );
    const prisma: Prisma = {
      huella: losa.puntos,
      convexa: false,
      desde: niveles.fondo,
      hasta: niveles.arriba,
    };
    const superficie = areaDe(losa.puntos) * pixel2;
    return { losa, prisma, superficie, bruto: superficie * losa.espesor };
  });

  // Las columnas arrancan en la cara de arriba de la losa de abajo, que está
  // lo mismo por debajo del piso terminado.
  const arranque = estructura.bajoNpt !== null ? -estructura.bajoNpt : 0;
  const columnas = estructura.columnas.map((columna) => {
    const huella = huellaDeColumna(columna, mpp);
    const desde = columna.desde ?? arranque;
    // Y llegan hasta el fondo de la losa que tienen encima: la más alta de
    // las que las cubren.
    let fondoDeSuLosa: number | null = null;
    for (const { prisma } of losas) {
      if (!(areaDe(recortar(prisma.huella, huella)) * pixel2 > 1e-6)) continue;
      fondoDeSuLosa = Math.max(fondoDeSuLosa ?? prisma.desde, prisma.desde);
    }
    // Salvo que diga dónde termina, medido desde el piso terminado de arriba.
    const hasta =
      columna.arriba !== null && pisoAPiso !== null
        ? pisoAPiso + columna.arriba
        : fondoDeSuLosa ?? sinLosa;
    const altura = Math.max(0, hasta - desde);
    const prisma: Prisma = { huella, convexa: true, desde, hasta: desde + altura };
    // Una metálica no lleva hormigón: es un perfil, y se mide por su largo.
    const bruto =
      columna.material === "metalica" ? 0 : columna.ancho * columna.profundidad * altura;
    return { columna, prisma, altura, bruto };
  });

  const vigas = estructura.vigas.map((viga) => {
    const huella = huellaDeViga(viga, mpp);
    const metalica = viga.material === "metalica";
    // Su cara de arriba: la de la losa más alta que tenga encima si es de
    // hormigón —se cuela con ella—, o el fondo de esa losa si es metálica
    // —la sostiene desde abajo—. Con el nivel puesto a mano, su losa es la que
    // la toca en altura.
    let arriba = viga.nivel;
    let fondoDeSuLosa: number | null = null;
    for (const { prisma } of losas) {
      if (!(areaDe(recortar(prisma.huella, huella)) * pixel2 > 1e-6)) continue;
      if (viga.nivel === null) {
        if (fondoDeSuLosa === null || prisma.desde > fondoDeSuLosa) {
          arriba = metalica ? prisma.desde : prisma.hasta;
          fondoDeSuLosa = prisma.desde;
        }
      } else if (
        prisma.hasta > viga.nivel - viga.alto + HOLGURA &&
        prisma.desde < viga.nivel - HOLGURA
      ) {
        fondoDeSuLosa = Math.min(fondoDeSuLosa ?? prisma.desde, prisma.desde);
      }
    }
    // Sin losa encima, su cara de arriba va adonde iría la de la estructura.
    const tope = arriba ?? sinLosa;
    const prisma: Prisma = { huella, convexa: true, desde: tope - viga.alto, hasta: tope };
    const largo = distancia(viga.a, viga.b) * mpp;
    return {
      viga,
      prisma,
      largo,
      bajoLosa: fondoDeSuLosa === null ? null : Math.max(0, fondoDeSuLosa - prisma.desde),
      // Una metálica no lleva hormigón: lo suyo es el largo del perfil.
      bruto: metalica ? 0 : viga.ancho * viga.alto * largo,
    };
  });

  // Sólo las de hormigón se quedan con el nudo. Un perfil metálico que llega
  // a una viga o atraviesa una losa no les saca hormigón: su sección es el
  // rectángulo que lo envuelve, no lo que ocupa.
  const prismasDeColumnas = columnas
    .filter((c) => c.columna.material === "hormigon")
    .map((c) => c.prisma);
  const prismasDeLosas = losas.map((l) => l.prisma);

  const columnasMedidas: ColumnaMedida[] = columnas.map(({ columna, prisma, altura, bruto }) => ({
    id: columna.id,
    nombre: columna.nombre,
    material: columna.material,
    desde: prisma.desde,
    hasta: prisma.hasta,
    alto: altura,
    bruto,
    neto: bruto,
  }));

  const losasMedidas: LosaMedida[] = losas.map(({ losa, prisma, superficie, bruto }) => ({
    id: losa.id,
    nombre: losa.nombre,
    desde: prisma.desde,
    hasta: prisma.hasta,
    superficie,
    bruto,
    neto: Math.max(0, bruto - tapado(prisma, prismasDeColumnas) * pixel2),
  }));

  const vigasMedidas: VigaMedida[] = vigas.map(({ viga, prisma, largo, bajoLosa, bruto }, i) => ({
    id: viga.id,
    nombre: viga.nombre,
    material: viga.material,
    desde: prisma.desde,
    hasta: prisma.hasta,
    largo,
    bajoLosa,
    bruto,
    neto:
      viga.material === "metalica"
        ? 0
        : Math.max(
            0,
            bruto -
              tapado(prisma, [
                ...prismasDeColumnas,
                ...prismasDeLosas,
                // Las vigas de hormigón de antes: el nudo es de la que se
                // dibujó primero. Un perfil que la cruza no le saca nada.
                ...vigas
                  .slice(0, i)
                  .filter((otra) => otra.viga.material === "hormigon")
                  .map((otra) => otra.prisma),
              ]) *
                pixel2
          ),
  }));

  const suma = (piezas: PiezaMedida[], cual: "bruto" | "neto") =>
    piezas.reduce((t, p) => t + p[cual], 0);
  const totalColumnas = suma(columnasMedidas, "neto");
  const totalVigas = suma(vigasMedidas, "neto");
  const totalLosas = suma(losasMedidas, "neto");
  const bruto =
    suma(columnasMedidas, "bruto") + suma(vigasMedidas, "bruto") + suma(losasMedidas, "bruto");
  const total = totalColumnas + totalVigas + totalLosas;

  return {
    columnas: columnasMedidas,
    vigas: vigasMedidas,
    losas: losasMedidas,
    totalColumnas,
    totalVigas,
    totalLosas,
    total,
    descontado: bruto - total,
  };
}

/**
 * El nombre que le toca a una pieza nueva: el prefijo y el número que sigue
 * al más alto que ya está. V01, V02; si se borró la V02, la próxima es V03 y
 * no otra V02, que es como se numera un plano.
 */
export function siguienteNombre(prefijo: string, usados: string[]): string {
  let mayor = 0;
  // Con cuántas cifras se viene numerando: después de C1 va C2, no C02.
  let cifras = 2;
  for (const nombre of usados) {
    // Sólo los de esta serie: la CM03 no hace que la próxima C sea la C04.
    const partes = nombre.trim().match(/^(.*?)(\d+)$/);
    if (!partes || partes[1] !== prefijo) continue;
    if (Number(partes[2]) >= mayor) {
      mayor = Number(partes[2]);
      cifras = partes[2].length;
    }
  }
  return `${prefijo}${String(mayor + 1).padStart(cifras, "0")}`;
}

/**
 * El nombre que se le ofrece a la próxima pieza: **sigue la serie de la
 * última** que se puso. Si a una columna se la llamó CM01, la que viene es
 * CM02 sin tener que escribirlo; sin ninguna antes, o si la última no termina
 * en número, arranca la serie de siempre (`porDefecto`: C, V, L).
 *
 * `piezas` son las de la misma clase, en el orden en que se dibujaron.
 */
export function nombreQueSigue(porDefecto: string, piezas: { nombre: string }[]): string {
  const ultima = piezas[piezas.length - 1]?.nombre.trim().match(/^(.*?)(\d+)$/);
  return siguienteNombre(
    ultima ? ultima[1] : porDefecto,
    piezas.map((p) => p.nombre)
  );
}

/** Los tipos se reexportan para quien sólo necesita la estructura. */
export type { Columna, Estructura, Losa, Viga };
