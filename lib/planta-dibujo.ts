/**
 * El dibujo de una planta y las medidas que salen de él.
 *
 * Una planta es un plano con lo que se calcó encima: muros y ambientes. Todo
 * está en **píxeles de la imagen**, y la escala —dos puntos marcados sobre la
 * regla del plano y los metros que hay entre ellos— es lo que lo vuelve
 * metros. Guardar píxeles y no metros es a propósito: si la escala se corrige,
 * el calco sigue encima del plano y las medidas se rehacen solas.
 *
 * Sin importar nada: lo usan el editor al dibujar y el servidor al listar, y
 * si cada uno midiera a su manera la pantalla mostraría un número y el listado
 * otro. Es el mismo criterio que `lib/medicion.ts`.
 */

export type Punto = { x: number; y: number };

/** Dos puntos sobre la regla del plano y cuánto miden de verdad. */
export type Escala = { a: Punto; b: Punto; metros: number };

/**
 * Qué es la línea que se marca al trazar un muro: su eje o una de sus caras.
 * Un plano dibuja el muro con dos líneas, las caras, y el eje no está en
 * ningún lado: calcando una cara se pisa una línea que existe.
 */
export const REFERENCIAS = [
  { valor: "exterior", nombre: "Cara exterior" },
  { valor: "centro", nombre: "Centro" },
  { valor: "interior", nombre: "Cara interior" },
] as const;

export type Referencia = (typeof REFERENCIAS)[number]["valor"];

/**
 * De qué línea se toma un muro: las de una viga, más **las caras
 * terminadas** —el borde de afuera del revoque—. En un muro con capas, "cara
 * exterior" es la del ladrillo y "cara exterior terminada" la del revoque: es
 * la que se alinea con la de otro muro cuando lo que tiene que coincidir es lo
 * que se ve. Sin capas, las dos son la misma.
 */
export const REFERENCIAS_DE_MURO = [
  { valor: "exteriorTerminada", nombre: "Cara exterior terminada" },
  { valor: "exterior", nombre: "Cara exterior del ladrillo" },
  { valor: "centro", nombre: "Centro del ladrillo" },
  { valor: "interior", nombre: "Cara interior del ladrillo" },
  { valor: "interiorTerminada", nombre: "Cara interior terminada" },
] as const;

export type ReferenciaDeMuro = (typeof REFERENCIAS_DE_MURO)[number]["valor"];

export type Muro = {
  id: string;
  /** Los dos puntos que se marcaron: la línea de referencia. */
  a: Punto;
  b: Punto;
  /** En metros. Es un dato del muro, no del dibujo: no depende de la escala. */
  espesor: number;
  /**
   * Dónde queda el cuerpo del muro respecto de la línea marcada
   * (`cuerpoDeMuro`, en `planta-trazo.ts`). El largo se mide sobre la línea
   * marcada, sea cual sea: es la que se calcó del plano.
   */
  referencia: ReferenciaDeMuro;
  /**
   * De piso a techo, en metros, si no es la de la planta: un antepecho de
   * balcón, un murete, una pared que no llega arriba. Null es "la de la
   * planta", que es lo de casi todos, y así cambiar la altura de la planta
   * los mueve a todos menos a los que tienen la suya.
   */
  altura: number | null;
  /**
   * De qué está hecho: una tarea del catálogo del cómputo, por su id —ladrillo
   * hueco del 8, del 12 portante, ladrillo común, un tabique de placa de
   * yeso—. Null: todavía no se dijo. Es lo que hace que el dibujo dé los m²
   * (o los m³) de cada mampostería sin medir nada aparte.
   */
  tarea: string | null;
  /**
   * Su tipo de muro de la obra (`lib/tipos-de-muro.ts`), por id: la pila de
   * capas de la que está hecho. Con tipo, `espesor` es la suma de sus capas y
   * `tarea` la de su núcleo —se mantienen al día al cambiar el tipo—, y sus
   * caras llevan las capas del tipo y no las del ambiente. Null: un muro de
   * antes de los tipos, que sigue como era.
   */
  tipo: string | null;
  /**
   * Cuánto suman las capas de cada lado, en metros: lo que el muro crece
   * hacia afuera y hacia adentro de su núcleo. **La línea de referencia es la
   * del núcleo** —el ladrillo—: agregar un revoque exterior engorda el muro
   * hacia afuera sin correr el ladrillo. Sale del tipo y se mantiene al día con
   * él; cero en un muro sin tipo, que es todo núcleo.
   */
  revestimiento: { exterior: number; interior: number };
  /**
   * El zócalo de cada lado, por la tarea del catálogo (se cotiza en metros
   * lineales). Null: ese lado no lleva. Es del tramo y no del tipo: el mismo
   * muro lleva zócalo de un lado y del otro no.
   */
  zocalo: { exterior: string | null; interior: string | null };
  /**
   * Cuánto suman de cada lado las **capas dibujadas** sobre sus caras, en
   * metros: lo que va más allá del cuerpo. No se guarda —sale de las capas
   * (`conAcabado`)—; es lo que hace que la cara terminada de un muro sea la de
   * afuera de su última capa, y que agarrarlo de ahí sea agarrarlo de lo que
   * se ve.
   */
  acabado?: { exterior: number; interior: number };
};

/**
 * Una capa de la terminación de una pared: qué tarea es y hasta dónde sube.
 *
 * No todas llegan a la misma altura. Con un cielorraso suspendido a 2,40, el
 * porcelanato llega al cielorraso, el revoque de abajo lo pasa unos
 * centímetros y la pintura de un muro sin cielorraso va hasta la losa. Por eso
 * la altura es de cada capa y no de la pared.
 *
 *   "techo"       toda la altura del muro, hasta la losa.
 *   "cielorraso"  hasta el cielorraso del ambiente al que da la cara. Si el
 *                 ambiente no tiene, hasta la losa.
 *   un número     esa altura desde el piso, en metros.
 *
 * Y su **espesor**, en metros: no es lo mismo un revoque de 1 cm que uno de 2.
 * La superficie alcanza para cotizar la mano de obra, pero el material —la
 * mezcla de un revoque, el hormigón de un contrapiso— sale del volumen, y el
 * volumen es superficie por espesor. Null: no se cargó; la capa mide sus m²
 * igual, y no da m³.
 *
 * Las capas de un piso y de un cielorraso son del mismo tipo, por el espesor:
 * un contrapiso de 8 y una carpeta de 2. Ahí `hasta` no dice nada.
 */
export type Capa = {
  tarea: string;
  hasta: "techo" | "cielorraso" | number;
  espesor: number | null;
  /** Desde qué altura sube, en metros: el látex de 2,10 para arriba sobre
   *  un porcelanato. Sin cargar, del piso. */
  desde?: number;
};

/**
 * La buña del cielorraso: la línea que se marca donde el cielorraso termina,
 * para darle terminación. Se cotiza por metro lineal, así que lo único que
 * necesita es la tarea y por dónde pasa.
 *
 * `anillo` en null es la buña perimetral: no guarda forma, es el contorno del
 * ambiente y lo sigue si después se corre un muro. Guarda sus puntos recién
 * cuando se corre uno de sus lados —el que pasa por delante de un placard— o
 * se apaga alguno. Cada punto dice si el lado que **arranca** en él lleva
 * buña: así lo apagado no se despega de su lado cuando el anillo cambia.
 */
export type Buna = {
  /** La tarea del catálogo, de las que se cotizan por metro. "" sin elegir. */
  tarea: string;
  anillo: { x: number; y: number; lleva: boolean }[] | null;
};

export type Ambiente = {
  id: string;
  nombre: string;
  /** El contorno, sin repetir el primer punto al final. */
  puntos: Punto[];
  /**
   * La terminación de sus paredes, capa por capa desde el muro hacia afuera:
   * azotado, revoque, revestimiento. Cada capa es una tarea del catálogo del
   * cómputo, por su id. Vale para todas las caras de muro que dan a este
   * ambiente, salvo la que tenga la suya (`Dibujo.caras`).
   */
  capas: Capa[];
  /**
   * A qué altura está el cielorraso, en metros desde el piso. Null: no hay
   * cielorraso suspendido y el techo es la losa, a la altura de la planta.
   */
  alturaCielorraso: number | null;
  /** De qué es el cielorraso, por capas: placa de yeso, y encima pintura. Se
   *  miden por la superficie del cielorraso. */
  cielorraso: Capa[];
  /**
   * Hasta dónde llega el cielorraso, cuando no es todo el ambiente: el durlock
   * que muere contra el frente de un placard, por ejemplo. Null —lo normal— es
   * el contorno del ambiente, y lo sigue si después se corre un muro. Se
   * dibuja en el modo cielorraso.
   */
  contornoCielorraso: Punto[] | null;
  /** Su buña, o null si el cielorraso no lleva. */
  buna: Buna | null;
  /** El piso, por capas desde la losa: contrapiso, carpeta, porcelanato. Se
   *  miden por la superficie del ambiente. */
  piso: Capa[];
};

/**
 * Un cajón de cielorraso: un pedazo de cielorraso más bajo que el resto —el de
 * una cocina sobre la mesada, el que tapa una viga o una cañería—. Se dibuja
 * por su contorno, como un ambiente, y tiene la altura de su fondo.
 *
 * Se computa su fondo —el área— y sus **frentes**: los lados que no van
 * contra un muro, por lo que baja desde el cielorraso del ambiente (o la losa)
 * hasta el fondo. Un cajón de 20 cm de frente a lo largo de una mesada suma
 * esos 20 cm por el largo de la mesada.
 */
export type Cajon = {
  id: string;
  /** El contorno, sin repetir el primer punto al final. */
  puntos: Punto[];
  /** A qué altura del piso está su fondo, en metros. */
  fondo: number;
  /** De qué es, por capas: placa de yeso y encima pintura. Van en todo el
   *  cajón: el fondo y los frentes. */
  capas: Capa[];
  /**
   * Las pinturas, **cara por cara** (el bote de pintura del 3D): un cajón se
   * pinta como una pared, sólo en lo que se ve —el fondo y el frente, no el
   * lateral contra el muro—.
   */
  pinturas: PinturaDeCajon[];
};

/** Una cara de un cajón: su fondo, o uno de sus lados por su lugar en el
 *  contorno (el lado que arranca en `puntos[i]`). */
export type CaraDeCajon = "fondo" | number;

/** Una pintura de un cajón y en qué caras va. */
export type PinturaDeCajon = { tarea: string; caras: CaraDeCajon[] };

/**
 * Una banquina: el cajón al revés, en el piso. La base de albañilería —de
 * ladrillo o de hormigón— sobre la que se apoyan los muebles de una cocina o
 * un placard. Se dibuja por su contorno, como un cajón, y sube desde el piso
 * del ambiente lo que diga su alto.
 *
 * Se computa su arriba —el área—, sus **frentes** por lo que sube —los lados
 * que no van contra un muro— y su volumen: el ladrillo se cotiza por m³ y el
 * revoque por m², y cuál lleva cada capa lo dice la unidad de su tarea.
 */
export type Banquina = {
  id: string;
  /** El contorno, sin repetir el primer punto al final. */
  puntos: Punto[];
  /** Cuánto sube desde el piso, en metros. */
  alto: number;
  /** De qué es, por capas: el ladrillo, el revoque, la carpeta de arriba. */
  capas: Capa[];
  /** El revestimiento de sus frentes —el porcelanato que sigue al del piso,
   *  el cerámico de abajo del mueble—, o null si no lleva. */
  revestimiento: RevestimientoDeBanquina | null;
};

/**
 * El revestimiento de una banquina: una tarea y en qué lados va, como la buña
 * del cielorraso, que se prende y se apaga lado por lado.
 *
 * Los lados van **por su lugar en el contorno** —el que arranca en
 * `puntos[i]`, como las caras de un cajón— y no marcados en cada punto, como
 * el anillo de la buña: los puntos de una banquina los rehacen todas las
 * herramientas de contorno que comparte con el ambiente y el cajón (mover una
 * esquina pone un `Punto` nuevo en su lugar), y una marca guardada adentro del
 * punto se perdería en cualquiera de ellas. Con índices, lo único que los
 * mueve es sumar o sacar puntos, y eso pasa en tres lugares que los corren a
 * mano: `ladosConPuntoAgregado`, `ladosConPuntoQuitado` y `ladosCorridos`.
 */
export type RevestimientoDeBanquina = {
  /** La tarea del catálogo. "" sin elegir. */
  tarea: string;
  /** Los lados que lo llevan, sin repetir. */
  lados: number[];
};

/**
 * Los lados revestidos después de meter un punto en el lado `indice`: ese lado
 * queda partido en dos y **las dos mitades** siguen como estaba él; los que
 * vienen después corren un lugar.
 */
export function ladosConPuntoAgregado(lados: number[], indice: number): number[] {
  return lados.flatMap((l) => (l < indice ? [l] : l === indice ? [l, l + 1] : [l + 1]));
}

/**
 * Los lados revestidos después de sacar el punto `indice`: el lado que
 * arrancaba en él desaparece, y el de antes —que ahora llega hasta el punto
 * siguiente— se queda con lo suyo. Los de después corren un lugar para atrás.
 */
export function ladosConPuntoQuitado(lados: number[], indice: number): number[] {
  return lados.filter((l) => l !== indice).map((l) => (l > indice ? l - 1 : l));
}

/**
 * Los lados revestidos después de correr el lado `indice` (`moverLado`).
 * `origen` dice de qué punto viejo sale cada nuevo; correr un lado puede
 * sumar puntos —el escalón—, y los dos que salen del mismo viejo son parte del
 * lado corrido: llevan lo que llevaba él. Igual que `anilloCorrido` con la
 * buña. `lados` es lo de **al agarrarlo**: se rehace desde ahí en cada movida.
 */
export function ladosCorridos(lados: number[], indice: number, origen: number[]): number[] {
  const llevaba = new Set(lados);
  const n = origen.length;
  const nuevos: number[] = [];
  for (let k = 0; k < n; k++) {
    const deAca = origen[k];
    const lleva = deAca === origen[(k + 1) % n] ? llevaba.has(indice) : llevaba.has(deAca);
    if (lleva) nuevos.push(k);
  }
  return nuevos;
}

export type TipoAbertura = "puerta" | "ventana";

/**
 * Cómo abre una ventana. Son los sistemas que ofrece cualquier fabricante de
 * aberturas, con el nombre con que se piden.
 */
export const APERTURAS = [
  { valor: "abrir", nombre: "De abrir" },
  { valor: "corrediza", nombre: "Corrediza" },
  { valor: "fijo", nombre: "Paño fijo" },
  { valor: "guillotina", nombre: "Guillotina" },
  { valor: "ventiluz", nombre: "Ventiluz" },
  { valor: "banderola", nombre: "Banderola" },
  { valor: "desplazable", nombre: "Desplazable" },
  { valor: "oscilobatiente", nombre: "Oscilobatiente" },
] as const;

export type Apertura = (typeof APERTURAS)[number]["valor"];

export function nombreDeApertura(apertura: Apertura): string {
  return APERTURAS.find((a) => a.valor === apertura)?.nombre ?? apertura;
}

/** Cuántas hojas se ofrecen como máximo: más que eso ya es un frente a medida. */
export const HOJAS_MAXIMO = 6;

/**
 * La mano de una puerta: de qué lado quedan las bisagras **mirándola de frente
 * y empujando**. Hay quien la nombra al revés, tirando; por eso la regla está
 * escrita acá y en la pantalla, y el dibujo de la hoja la muestra sin palabras.
 */
export type Mano = "derecha" | "izquierda";

/**
 * Una puerta o una ventana, puesta sobre un muro.
 *
 * No tiene coordenadas propias: vive en su muro, a una fracción de su largo.
 * Así, si el muro se mueve o se corrige la escala, la abertura va con él y no
 * queda flotando al lado. El ancho y el alto son datos de la carpintería, en
 * metros: no salen del dibujo.
 *
 * El nombre es el de la planilla de carpinterías —P1, V2—, y es un **tipo**:
 * todas las P1 de la planta miden lo mismo.
 */
export type Abertura = {
  id: string;
  muroId: string;
  /** Dónde está su centro sobre el muro: 0 en un extremo, 1 en el otro. */
  t: number;
  tipo: TipoAbertura;
  nombre: string;
  ancho: number;
  alto: number;
  /**
   * Sólo en puertas; null en ventanas. No es parte del tipo: la misma P1 se
   * pide derecha en un ambiente e izquierda en el de al lado, y al carpintero
   * hay que decirle cuántas de cada una.
   */
  mano: Mano | null;
  /**
   * Sólo en ventanas: a qué altura del piso arranca, en metros. Cero es una
   * ventana hasta el piso; **null es "no se cargó"**, que no es lo mismo: una
   * ventana guardada antes de que existiera este dato no está a ras del piso,
   * simplemente no se sabe. Va por ventana y no por tipo: la misma V1 se
   * coloca a 0,90 en un dormitorio y a 1,10 sobre una mesada.
   */
  antepecho: number | null;
  /**
   * Hacia qué lado del muro abre la hoja: 1 o -1, sobre la normal del muro
   * (la dirección a→b girada un cuarto de vuelta). Con la mano, define el
   * dibujo del barrido.
   */
  lado: 1 | -1;
  /**
   * Sólo en ventanas: cómo abre y en cuántas hojas. **Son parte del tipo**,
   * como el ancho y el alto: una V1 es una corrediza de dos hojas de 1,20 ×
   * 1,10, y es eso lo que se le pide al fabricante. Null en puertas, y en una
   * ventana guardada antes de que existieran: "sin cargar", no "paño fijo".
   */
  apertura: Apertura | null;
  hojas: number | null;
  /**
   * Sólo en puertas: cuánto mide el marco de cara a cara, en metros —el de un
   * tabique de 10, 12 o 15—. Es del tipo, como el ancho. Null: el del muro,
   * con sus capas.
   */
  marco: number | null;
  /**
   * Las tareas del cómputo que lleva, por id: el amure del premarco, la
   * colocación. **Son del tipo**: todas las V01 llevan lo mismo. El plano las
   * cuenta —una por abertura, o su superficie o su perímetro, según en qué se
   * cotice la tarea— y en el 3D se marca cada una por separado.
   */
  tareas: string[];
};

/**
 * Un tipo de abertura de la planta —P01, V02—: sus medidas y cómo es, para
 * ponerlo de nuevo sin cargarlo otra vez. Existe aunque todavía no haya
 * ninguna colocada.
 */
export type TipoDeAbertura = Pick<
  Abertura,
  "tipo" | "nombre" | "ancho" | "alto" | "antepecho" | "apertura" | "hojas" | "marco" | "tareas"
>;

// ---- La estructura --------------------------------------------------------
//
// El hormigón armado se dibuja sobre el mismo plano, en su propia capa. Es la
// estructura **de arriba** del piso: las columnas que lo atraviesan y las
// vigas y la losa que lo cubren. Las alturas se miden desde el nivel de piso
// terminado de la planta, que es siempre 0,00 (`planta-estructura.ts`).

/**
 * De dónde se agarra una columna al ponerla: su centro o una de sus cuatro
 * esquinas, nombradas como se ven en el plano —superior izquierda, superior
 * derecha, inferior izquierda, inferior derecha—.
 */
export const ANCLAS = [
  { valor: "si", nombre: "Esquina superior izquierda" },
  { valor: "sd", nombre: "Esquina superior derecha" },
  { valor: "centro", nombre: "Centro" },
  { valor: "ii", nombre: "Esquina inferior izquierda" },
  { valor: "id", nombre: "Esquina inferior derecha" },
] as const;

export type Ancla = (typeof ANCLAS)[number]["valor"];

/**
 * De qué es una columna. Cambia qué se le computa: la de hormigón lleva m³ y
 * se queda con el nudo donde llegan las vigas; la metálica es un perfil, se
 * mide por su largo y no le saca hormigón a nadie.
 */
export const MATERIALES = [
  { valor: "hormigon", nombre: "Hormigón armado" },
  { valor: "metalica", nombre: "Metálica" },
] as const;

export type Material = (typeof MATERIALES)[number]["valor"];

/**
 * Una columna: se pone con un toque, como una abertura. Sin girar, sus lados
 * van con los ejes del plano: el ancho en horizontal y la profundidad en
 * vertical.
 */
export type Columna = {
  id: string;
  /** El de la planilla de estructura: C01. */
  nombre: string;
  /** El punto que se marcó: el ancla. */
  p: Punto;
  ancla: Ancla;
  /**
   * Cuánto está girada, en grados y en el sentido de las agujas del reloj
   * como se ve en el plano. Gira **alrededor de su ancla**, que queda donde
   * se la marcó: una columna tomada de una esquina se acomoda a un muro en
   * diagonal sin soltarse de esa esquina.
   */
  giro: number;
  material: Material;
  /**
   * Hormigón visto: no se revoca. El frente que da a la cara de un muro no
   * lleva sus terminaciones, y si sobresale no hace mochetas de revoque.
   */
  visto: boolean;
  /**
   * Sólo en las metálicas: qué perfil es —"IPN 200", "Tubo 100×100×4"—. Es
   * lo que se le pide al herrero y lo que dice cuánto pesa el metro; vacío,
   * se la junta por su sección.
   */
  perfil: string;
  /**
   * Qué tarea del cómputo es, por su id: "Columnas H°A°". Es lo que el plano
   * le pasa al cómputo, igual que el tipo de un muro. Null: todavía no se
   * dijo, y su hormigón no se pasa. Una metálica no la usa: se cotiza en kg.
   */
  tarea: string | null;
  /** En metros. */
  ancho: number;
  profundidad: number;
  /**
   * De dónde arranca, en metros sobre el piso terminado de la planta. Null:
   * de la cara de arriba de la losa de abajo, que queda **debajo** del piso
   * terminado —lo que diga `Estructura.bajoNpt`—; sin ese dato, del piso
   * terminado. Con número, negativo si arranca más abajo.
   */
  desde: number | null;
  /**
   * Dónde termina, medido **desde el piso terminado de arriba**: negativo si
   * termina antes de llegar a él, que es lo de siempre —una columna llega al
   * fondo de la losa, unos centímetros por debajo del piso que esa losa
   * sostiene—. Null: hasta el fondo de la losa que tiene encima.
   *
   * Lo de antes de `altura`: se sigue leyendo en las que lo tienen, pero ya
   * no se escribe. Al ponerle una altura se borra.
   */
  arriba: number | null;
  /**
   * Cuánto sube desde donde arranca, en metros. Todo se mide **desde el NPT**
   * de la planta, como los muros y los tabiques: de dónde arranca y cuánto
   * sube. Null: lo que diga `arriba` si lo tiene, y si no hasta el fondo de
   * la losa que tiene encima.
   */
  altura: number | null;
};

/** Una viga: se traza como un muro, con su línea de referencia. */
export type Viga = {
  id: string;
  /** V01. */
  nombre: string;
  a: Punto;
  b: Punto;
  referencia: Referencia;
  /**
   * De hormigón o metálica, como las columnas. Cambia dos cosas: qué se le
   * computa —m³ o metros de perfil— y **dónde va respecto de la losa**: la de
   * hormigón se cuela con ella y su alto la incluye; la metálica la sostiene
   * desde abajo.
   */
  material: Material;
  /** Sólo en las metálicas: qué perfil es, "IPN 200". */
  perfil: string;
  /**
   * Qué tarea del cómputo es, por su id: "Columnas H°A°". Es lo que el plano
   * le pasa al cómputo, igual que el tipo de un muro. Null: todavía no se
   * dijo, y su hormigón no se pasa. Una metálica no la usa: se cotiza en kg.
   */
  tarea: string | null;
  /** En metros: 0,12 × 0,45. **En las de hormigón, el alto incluye la losa.** */
  ancho: number;
  alto: number;
  /**
   * A qué altura está su cara de arriba, en metros sobre el piso terminado.
   * Null: donde le toca por su material —en la cara de arriba de la losa que
   * tiene encima si es de hormigón, en el fondo de esa losa si es metálica—.
   * Con número, una viga invertida o una de un entrepiso.
   */
  nivel: number | null;
  /**
   * Un **tabique** de hormigón —el de un ascensor, un núcleo—: se dibuja como
   * una viga, por su línea y su espesor (`ancho`), pero va de losa a losa como
   * una columna, y como una columna se queda con el hormigón de los nudos.
   * `alto` y `nivel` no se usan.
   */
  tabique: boolean;
  /**
   * Sólo en tabiques: de dónde arranca, en metros sobre el piso terminado de
   * la planta —negativo si arranca más abajo—. Null: de la cara de arriba de
   * la losa de abajo, como una columna.
   */
  desde: number | null;
  /**
   * Sólo en tabiques: cuánto sube desde donde arranca, en metros. Null: hasta
   * el fondo de la losa que tiene encima. Un tabique que no llega a la losa
   * —el de una baranda, un murete de hormigón— lleva la suya.
   */
  altura: number | null;
};

/** Una losa: se dibuja como un ambiente, por su contorno. */
export type Losa = {
  id: string;
  /** L01. */
  nombre: string;
  puntos: Punto[];
  /**
   * Qué tarea del cómputo es: una losa maciza en m³, una de viguetas en m².
   * Null: todavía no se dijo.
   */
  tarea: string | null;
  /** En metros. */
  espesor: number;
  /**
   * Cuánto más abajo que el piso terminado que sostiene queda su cara de
   * arriba, en metros, si no es lo de toda la planta (`Estructura.bajoNpt`):
   * la losa rebajada de un baño o de un balcón. Null: lo de la planta.
   */
  bajoNpt: number | null;
};

export type Estructura = {
  columnas: Columna[];
  vigas: Viga[];
  losas: Losa[];
  /**
   * **Cuánto más abajo que el piso terminado que sostiene queda la cara de
   * arriba de la losa**, en metros: lo que ocupan el contrapiso, la carpeta y
   * el piso. La estructura no está al nivel del piso terminado: la losa que
   * sostiene el piso de arriba termina unos centímetros antes, y es desde ese
   * piso terminado —el del piso de arriba— que se la ubica.
   *
   * Null: no se dijo. La losa va entonces con su fondo a la altura de piso a
   * techo de la planta, que es como se la ubicaba antes de que la obra
   * tuviera sus pisos definidos.
   */
  bajoNpt: number | null;
};

export const ESTRUCTURA_VACIA: Estructura = {
  columnas: [],
  vigas: [],
  losas: [],
  bajoNpt: null,
};

/** Con qué arranca cada pieza: las secciones más comunes, para corregir de ahí. */
export const COLUMNA_INICIAL = { ancho: 0.2, profundidad: 0.2 };
export const VIGA_INICIAL = { ancho: 0.12, alto: 0.45 };
/** El de un núcleo de ascensor, el más común. */
export const TABIQUE_INICIAL = { ancho: 0.15 };
export const LOSA_INICIAL = { espesor: 0.12 };

/**
 * Un tramo de una capa dibujada: un pedazo de una cara de un muro.
 *
 * No tiene coordenadas propias, como una abertura: vive en su muro, entre dos
 * fracciones de su línea marcada. Así, si el muro se mueve o se alarga, la
 * capa va con él. Puede salir apenas de 0..1: en una esquina la cara sigue un
 * poco más allá de los puntos marcados.
 */
export type TramoDeCapa = {
  muroId: string;
  /** Qué cara: un lado sobre la normal del muro (1 o -1), o un canto —la
   *  punta del muro— entero. */
  cara: 1 | -1 | "a" | "b";
  /** Entre dónde y dónde, a lo largo: 0 en el primer punto, 1 en el otro. En
   *  un canto no se usa: va entero. */
  desde: number;
  hasta: number;
};

/**
 * Una capa de terminación **dibujada sobre las caras de los muros**, como una
 * polilínea de AutoCAD: el revoque, el porcelanato, la pintura. Se dibuja
 * eligiendo un ambiente —y va por todo su perímetro— o a mano, tramo por
 * tramo. Lo que se ve es lo que se computa.
 *
 * Se apilan en el orden de la lista: la primera va contra el muro y cada una
 * se apoya sobre la cara de las que tiene debajo en ese tramo y esa altura. El
 * porcelanato sobre el revoque, la pintura sobre el revoque de 2,10 para
 * arriba.
 */
export type CapaDibujada = {
  id: string;
  /** Tarea del catálogo, por id. Null: todavía no se eligió. */
  tarea: string | null;
  /** En metros. Cero en una pintura: se ve como una línea de color. */
  espesor: number;
  /** Desde qué altura sube, en metros sobre el piso. */
  desde: number;
  /** Hasta dónde: la losa, el cielorraso del ambiente o una altura. */
  hasta: "techo" | "cielorraso" | number;
  tramos: TramoDeCapa[];
};

export type Dibujo = {
  muros: Muro[];
  ambientes: Ambiente[];
  aberturas: Abertura[];
  estructura: Estructura;
  /** Las capas dibujadas sobre las caras de los muros, de la de abajo a la de
   *  arriba. */
  capas: CapaDibujada[];
  /** Los cajones de cielorraso. */
  cajones: Cajon[];
  /** Las banquinas: las bases de albañilería de los muebles, en el piso. */
  banquinas: Banquina[];
  /** Los tipos de abertura guardados, además de los que ya están colocados. */
  tiposDeAbertura: TipoDeAbertura[];
  /**
   * Las capas de las caras de muro que no llevan las de su ambiente: la pared
   * de la bañera que va con otro revestimiento, o una cara que no da a ningún
   * ambiente dibujado —el frente, una medianera—.
   *
   * La clave es **qué cara es, no dónde está**: `muro|lado|ambiente`, la cara
   * de ese muro que da a ese ambiente (o a ninguno). Así sobrevive a que el
   * muro se mueva o se alargue, que es lo que una posición no aguanta. Una
   * lista vacía es "esta cara no lleva nada", distinto de no tener entrada.
   */
  caras: Record<string, Capa[]>;
};

export const DIBUJO_VACIO: Dibujo = {
  muros: [],
  ambientes: [],
  aberturas: [],
  estructura: ESTRUCTURA_VACIA,
  capas: [],
  cajones: [],
  banquinas: [],
  tiposDeAbertura: [],
  caras: {},
};

/** Con qué arranca cada tipo: las medidas más comunes, para corregir de ahí. */
export const ABERTURA_INICIAL: Record<
  TipoAbertura,
  {
    nombre: string;
    ancho: number;
    alto: number;
    antepecho: number | null;
    apertura: Apertura | null;
    hojas: number | null;
    marco: number | null;
  }
> = {
  puerta: { nombre: "P1", ancho: 0.8, alto: 2.05, antepecho: null, apertura: null, hojas: null, marco: null },
  ventana: {
    nombre: "V1",
    ancho: 1.2,
    alto: 1.1,
    antepecho: 0.9,
    apertura: "corrediza",
    hojas: 2,
    marco: null,
  },
};

/** Los espesores que se ofrecen: los de la mampostería de todos los días. */
export const ESPESORES = [0.08, 0.1, 0.12, 0.15, 0.18, 0.2, 0.3];
export const ESPESOR_INICIAL = 0.15;

export function distancia(a: Punto, b: Punto): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Cuántos metros es un píxel.
 *
 * Null mientras no haya escala, o si la que hay no sirve (los dos puntos en el
 * mismo lugar, una distancia en cero). Null y no un uno: un dibujo sin escala
 * que midiera "en píxeles" mostraría 1.240 m de muro y parecería un dato.
 */
export function metrosPorPixel(escala: Escala | null): number | null {
  if (!escala) return null;
  const pixeles = distancia(escala.a, escala.b);
  if (!(pixeles > 0) || !(escala.metros > 0)) return null;
  return escala.metros / pixeles;
}

/** Área de un polígono en las unidades de sus puntos, al cuadrado. */
export function areaDe(puntos: Punto[]): number {
  let suma = 0;
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i];
    const q = puntos[(i + 1) % puntos.length];
    suma += p.x * q.y - q.x * p.y;
  }
  return Math.abs(suma) / 2;
}

/** Perímetro de un polígono cerrado. */
export function perimetroDe(puntos: Punto[]): number {
  let suma = 0;
  for (let i = 0; i < puntos.length; i++) {
    suma += distancia(puntos[i], puntos[(i + 1) % puntos.length]);
  }
  return suma;
}

/** El centro de un polígono, para apoyar su nombre. */
export function centroDe(puntos: Punto[]): Punto {
  // El centroide de área, no el promedio de los vértices: en una L el promedio
  // se va para el lado que tiene más esquinas y el nombre cae sobre un muro.
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i];
    const q = puntos[(i + 1) % puntos.length];
    const cruz = p.x * q.y - q.x * p.y;
    area += cruz;
    cx += (p.x + q.x) * cruz;
    cy += (p.y + q.y) * cruz;
  }
  if (Math.abs(area) < 1e-9) {
    const n = puntos.length || 1;
    return {
      x: puntos.reduce((t, p) => t + p.x, 0) / n,
      y: puntos.reduce((t, p) => t + p.y, 0) / n,
    };
  }
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

export type MedidaDeMuro = { id: string; largo: number; espesor: number };

export type MedidaDeAmbiente = {
  id: string;
  nombre: string;
  area: number;
  perimetro: number;
};

/** Las aberturas iguales, juntas: un renglón de la planilla de carpinterías. */
export type GrupoDeAberturas = {
  tipo: TipoAbertura;
  nombre: string;
  ancho: number;
  alto: number;
  /** La mano, en puertas: derechas e izquierdas van en renglones aparte. */
  mano: Mano | null;
  /** El antepecho, en ventanas: las de distinta altura van en renglones aparte. */
  antepecho: number | null;
  /** Cómo abre y en cuántas hojas, en ventanas. */
  apertura: Apertura | null;
  hojas: number | null;
  cantidad: number;
  /** El vano de todas: ancho × alto × cantidad. */
  superficie: number;
};

export type Medidas = {
  muros: MedidaDeMuro[];
  /** Metros de muro juntados por espesor, del más fino al más grueso. */
  murosPorEspesor: { espesor: number; cantidad: number; largo: number }[];
  /** Metros lineales de muro, todos los espesores. */
  largoDeMuros: number;
  /**
   * m² de pared de **una cara**: largo por altura. Un muro interior tiene dos
   * y se revoca de los dos lados; cuál lleva qué terminación todavía no se
   * marca, así que acá va la cara y no un total que supondría que todas se
   * terminan igual.
   */
  paredUnaCara: number;
  /** La planilla de carpinterías: puertas primero, cada tipo en un renglón. */
  aberturas: GrupoDeAberturas[];
  cantidadDeAberturas: number;
  /** m² que ocupan puertas y ventanas en los muros. */
  vanos: number;
  /**
   * La pared de una cara sin los vanos: lo que de verdad se revoca. El vano se
   * descuenta una vez porque la medida es de una cara; el que mida las dos
   * tiene que descontarlo de las dos.
   */
  paredSinVanos: number;
  ambientes: MedidaDeAmbiente[];
  areaDeAmbientes: number;
};

/**
 * Las medidas de una planta, en metros.
 *
 * Null si no hay escala: no hay nada que medir todavía. Son las de **un** piso;
 * multiplicar por los pisos que repiten la planta es de quien las muestra,
 * porque hay pantallas que quieren las dos cosas.
 */
export function medir(
  dibujo: Dibujo,
  escala: Escala | null,
  altura: number
): Medidas | null {
  const mpp = metrosPorPixel(escala);
  if (mpp === null) return null;

  const muros = dibujo.muros.map((m) => ({
    id: m.id,
    largo: distancia(m.a, m.b) * mpp,
    espesor: m.espesor,
  }));

  const grupos = new Map<number, { cantidad: number; largo: number }>();
  for (const m of muros) {
    const g = grupos.get(m.espesor) ?? { cantidad: 0, largo: 0 };
    g.cantidad += 1;
    g.largo += m.largo;
    grupos.set(m.espesor, g);
  }

  const largoDeMuros = muros.reduce((t, m) => t + m.largo, 0);

  // Se juntan por nombre **y** medidas: dos "P1" de distinto ancho son un error
  // de carga, y en dos renglones se ve; sumadas en uno, se escondería.
  const planilla = new Map<string, GrupoDeAberturas>();
  for (const ab of dibujo.aberturas) {
    const clave = [
      ab.tipo,
      ab.nombre,
      ab.ancho,
      ab.alto,
      ab.mano ?? "",
      ab.antepecho ?? "",
      ab.apertura ?? "",
      ab.hojas ?? "",
    ].join("|");
    const g = planilla.get(clave) ?? {
      tipo: ab.tipo,
      nombre: ab.nombre,
      ancho: ab.ancho,
      alto: ab.alto,
      mano: ab.mano,
      antepecho: ab.antepecho,
      apertura: ab.apertura,
      hojas: ab.hojas,
      cantidad: 0,
      superficie: 0,
    };
    g.cantidad += 1;
    g.superficie += ab.ancho * ab.alto;
    planilla.set(clave, g);
  }
  const aberturas = Array.from(planilla.values()).sort(
    (a, b) =>
      (a.tipo === b.tipo ? 0 : a.tipo === "puerta" ? -1 : 1) ||
      a.nombre.localeCompare(b.nombre, "es", { numeric: true }) ||
      a.ancho - b.ancho ||
      (a.mano ?? "").localeCompare(b.mano ?? "") ||
      (a.apertura ?? "").localeCompare(b.apertura ?? "") ||
      (a.hojas ?? 0) - (b.hojas ?? 0) ||
      (a.antepecho ?? -1) - (b.antepecho ?? -1)
  );
  const vanos = aberturas.reduce((t, g) => t + g.superficie, 0);
  // Cada muro con su altura: la propia si la tiene, y si no la de la planta.
  const alturaDePlanta = altura > 0 ? altura : 0;
  const paredUnaCara = dibujo.muros.reduce(
    (t, m) => t + distancia(m.a, m.b) * mpp * (m.altura ?? alturaDePlanta),
    0
  );

  const ambientes = dibujo.ambientes.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    // El área escala con el cuadrado: un píxel es un cuadradito de mpp × mpp.
    area: areaDe(a.puntos) * mpp * mpp,
    perimetro: perimetroDe(a.puntos) * mpp,
  }));

  return {
    muros,
    murosPorEspesor: Array.from(grupos.entries())
      .map(([espesor, g]) => ({ espesor, ...g }))
      .sort((a, b) => a.espesor - b.espesor),
    largoDeMuros,
    paredUnaCara,
    aberturas,
    cantidadDeAberturas: dibujo.aberturas.length,
    vanos,
    // Nunca negativa: vanos más grandes que la pared son un dato mal cargado
    // (un alto mayor que la altura de la planta), no una pared que debe m².
    paredSinVanos: Math.max(0, paredUnaCara - vanos),
    ambientes,
    areaDeAmbientes: ambientes.reduce((t, a) => t + a.area, 0),
  };
}

// ---- Leer lo guardado -----------------------------------------------------
//
// El dibujo y la escala viven en columnas jsonb: para TypeScript son "cualquier
// cosa". Acá se convierten en lo que dicen ser, tirando lo que no cierre. Un
// muro con una coordenada rota se pierde, pero el resto del dibujo abre: la
// alternativa es que un dato malo deje la planta entera sin poder mirarse.

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/**
 * Las capas de una pared, de un piso o de un cielorraso. Una capa guardada
 * cuando todavía era sólo el id de su tarea —antes de que cada una tuviera su
 * altura, y como se guardaron siempre las de piso y cielorraso— sube hasta el
 * techo, que es lo que medía entonces, y no tiene espesor cargado.
 */
function leerCapas(valor: unknown): Capa[] {
  if (!Array.isArray(valor)) return [];

  const capas: Capa[] = [];
  for (const cruda of valor) {
    if (typeof cruda === "string") {
      capas.push({ tarea: cruda, hasta: "techo", espesor: null });
      continue;
    }
    if (typeof cruda !== "object" || cruda === null) continue;
    const r = cruda as Record<string, unknown>;
    if (typeof r.tarea !== "string") continue;
    const altura = numero(r.hasta);
    const espesor = numero(r.espesor);
    const desde = numero(r.desde);
    capas.push({
      tarea: r.tarea,
      hasta: r.hasta === "cielorraso" ? "cielorraso" : altura !== null && altura > 0 ? altura : "techo",
      espesor: espesor !== null && espesor > 0 ? espesor : null,
      ...(desde !== null && desde > 0 ? { desde } : {}),
    });
  }
  return capas;
}

function punto(valor: unknown): Punto | null {
  if (typeof valor !== "object" || valor === null) return null;
  const { x, y } = valor as Record<string, unknown>;
  const nx = numero(x);
  const ny = numero(y);
  return nx === null || ny === null ? null : { x: nx, y: ny };
}

export function leerEscala(valor: unknown): Escala | null {
  if (typeof valor !== "object" || valor === null) return null;
  const crudo = valor as Record<string, unknown>;
  const a = punto(crudo.a);
  const b = punto(crudo.b);
  const metros = numero(crudo.metros);
  if (!a || !b || metros === null || metros <= 0) return null;
  return { a, b, metros };
}

export function leerDibujo(valor: unknown): Dibujo {
  if (typeof valor !== "object" || valor === null) return DIBUJO_VACIO;
  const crudo = valor as Record<string, unknown>;

  const muros: Muro[] = [];
  for (const m of Array.isArray(crudo.muros) ? crudo.muros : []) {
    if (typeof m !== "object" || m === null) continue;
    const r = m as Record<string, unknown>;
    const a = punto(r.a);
    const b = punto(r.b);
    const espesor = numero(r.espesor);
    const alturaPropia = numero(r.altura);
    if (typeof r.id !== "string" || !a || !b) continue;
    muros.push({
      id: r.id,
      a,
      b,
      espesor: espesor !== null && espesor > 0 ? espesor : ESPESOR_INICIAL,
      // Un muro guardado antes de que existiera la referencia se marcó por su eje.
      referencia: REFERENCIAS_DE_MURO.find((ref) => ref.valor === r.referencia)?.valor ?? "centro",
      altura: alturaPropia !== null && alturaPropia > 0 ? alturaPropia : null,
      tarea: typeof r.tarea === "string" && r.tarea !== "" ? r.tarea : null,
      tipo: typeof r.tipo === "string" && r.tipo !== "" ? r.tipo : null,
      revestimiento: leerRevestimiento(r.revestimiento),
      zocalo: leerZocalo(r.zocalo),
    });
  }

  const ambientes: Ambiente[] = [];
  for (const amb of Array.isArray(crudo.ambientes) ? crudo.ambientes : []) {
    if (typeof amb !== "object" || amb === null) continue;
    const r = amb as Record<string, unknown>;
    const puntos = (Array.isArray(r.puntos) ? r.puntos : [])
      .map(punto)
      .filter((p): p is Punto => p !== null);
    const alturaCielorraso = numero(r.alturaCielorraso);
    // Con menos de tres puntos no encierra nada.
    if (typeof r.id !== "string" || puntos.length < 3) continue;
    ambientes.push({
      id: r.id,
      nombre: typeof r.nombre === "string" ? r.nombre : "",
      puntos,
      capas: leerCapas(r.capas),
      alturaCielorraso:
        alturaCielorraso !== null && alturaCielorraso > 0 ? alturaCielorraso : null,
      cielorraso: leerCapas(r.cielorraso),
      piso: leerCapas(r.piso),
      contornoCielorraso: leerContorno(r.contornoCielorraso),
      buna: leerBuna(r.buna),
    });
  }

  // Una abertura sin su muro no está en ningún lado: se va con él.
  const idsDeMuros = new Set(muros.map((m) => m.id));
  const aberturas: Abertura[] = [];
  for (const ab of Array.isArray(crudo.aberturas) ? crudo.aberturas : []) {
    if (typeof ab !== "object" || ab === null) continue;
    const r = ab as Record<string, unknown>;
    const t = numero(r.t);
    const ancho = numero(r.ancho);
    const alto = numero(r.alto);
    if (typeof r.id !== "string" || typeof r.muroId !== "string") continue;
    if (!idsDeMuros.has(r.muroId) || t === null) continue;
    if (ancho === null || ancho <= 0 || alto === null || alto <= 0) continue;
    const tipo = r.tipo === "ventana" ? "ventana" : "puerta";
    const antepecho = numero(r.antepecho);
    const hojas = numero(r.hojas);
    const apertura = APERTURAS.find((a) => a.valor === r.apertura)?.valor ?? null;
    aberturas.push({
      id: r.id,
      muroId: r.muroId,
      t: Math.min(1, Math.max(0, t)),
      tipo,
      nombre: typeof r.nombre === "string" ? r.nombre : "",
      ancho,
      alto,
      // Una puerta guardada antes de que existiera la mano abre como derecha:
      // es un valor a revisar, pero sin él no se podría dibujar la hoja.
      mano: tipo === "ventana" ? null : r.mano === "izquierda" ? "izquierda" : "derecha",
      // Sin inventar: una ventana que no lo trae queda "sin cargar".
      antepecho: tipo === "ventana" && antepecho !== null && antepecho >= 0 ? antepecho : null,
      lado: r.lado === -1 ? -1 : 1,
      apertura: tipo === "ventana" ? apertura : null,
      hojas:
        tipo === "ventana" && hojas !== null && Number.isInteger(hojas) && hojas >= 1
          ? hojas
          : null,
      marco: tipo === "puerta" ? marcoDe(r.marco) : null,
      tareas: tareasDe(r.tareas),
    });
  }

  const caras: Record<string, Capa[]> = {};
  if (typeof crudo.caras === "object" && crudo.caras !== null && !Array.isArray(crudo.caras)) {
    for (const [clave, capas] of Object.entries(crudo.caras)) {
      if (Array.isArray(capas)) caras[clave] = leerCapas(capas);
    }
  }

  const capas = leerCapasDibujadas(crudo.capas, idsDeMuros);
  return {
    muros: conAcabado(muros, capas),
    ambientes,
    aberturas,
    estructura: leerEstructura(crudo.estructura),
    capas,
    cajones: leerCajones(crudo.cajones),
    banquinas: leerBanquinas(crudo.banquinas),
    tiposDeAbertura: leerTiposDeAbertura(crudo.tiposDeAbertura),
    caras,
  };
}

/** El marco de una puerta, en metros, o null: el del muro. */
function marcoDe(valor: unknown): number | null {
  const n = numero(valor);
  return n !== null && n > 0 && n < 1 ? n : null;
}

/** Las tareas de una abertura, por id: sin vacías ni repetidas. */
function tareasDe(valor: unknown): string[] {
  const ids = (Array.isArray(valor) ? valor : []).filter((v): v is string => typeof v === "string" && v !== "");
  return Array.from(new Set(ids));
}

/** Los tipos de abertura guardados —en el dibujo o en la tabla de la obra—;
 *  uno sin nombre o sin medidas no sirve. */
export function leerTiposDeAbertura(valor: unknown): TipoDeAbertura[] {
  const tipos: TipoDeAbertura[] = [];
  for (const v of Array.isArray(valor) ? valor : []) {
    if (typeof v !== "object" || v === null) continue;
    const r = v as Record<string, unknown>;
    const ancho = numero(r.ancho);
    const alto = numero(r.alto);
    if (typeof r.nombre !== "string" || r.nombre.trim() === "") continue;
    if (ancho === null || ancho <= 0 || alto === null || alto <= 0) continue;
    const tipo = r.tipo === "ventana" ? "ventana" : "puerta";
    const antepecho = numero(r.antepecho);
    const hojas = numero(r.hojas);
    tipos.push({
      tipo,
      nombre: r.nombre.trim(),
      ancho,
      alto,
      antepecho: tipo === "ventana" && antepecho !== null && antepecho >= 0 ? antepecho : null,
      apertura: tipo === "ventana" ? APERTURAS.find((a) => a.valor === r.apertura)?.valor ?? null : null,
      hojas: tipo === "ventana" && hojas !== null && Number.isInteger(hojas) && hojas >= 1 ? hojas : null,
      marco: tipo === "puerta" ? marcoDe(r.marco) : null,
      tareas: tareasDe(r.tareas),
    });
  }
  return tipos;
}

/** Los cajones de cielorraso; uno con menos de tres puntos no encierra nada. */
function leerCajones(valor: unknown): Cajon[] {
  const cajones: Cajon[] = [];
  for (const c of Array.isArray(valor) ? valor : []) {
    if (typeof c !== "object" || c === null) continue;
    const r = c as Record<string, unknown>;
    const puntos = (Array.isArray(r.puntos) ? r.puntos : [])
      .map(punto)
      .filter((p): p is Punto => p !== null);
    const fondo = numero(r.fondo);
    if (typeof r.id !== "string" || puntos.length < 3) continue;
    const pinturas: PinturaDeCajon[] = [];
    for (const p of Array.isArray(r.pinturas) ? r.pinturas : []) {
      if (typeof p !== "object" || p === null) continue;
      const crudo = p as Record<string, unknown>;
      if (typeof crudo.tarea !== "string" || crudo.tarea === "") continue;
      const caras = (Array.isArray(crudo.caras) ? crudo.caras : []).filter(
        (c): c is CaraDeCajon =>
          c === "fondo" || (typeof c === "number" && Number.isInteger(c) && c >= 0 && c < puntos.length)
      );
      if (caras.length > 0) pinturas.push({ tarea: crudo.tarea, caras: Array.from(new Set(caras)) });
    }
    cajones.push({
      id: r.id,
      puntos,
      fondo: fondo !== null && fondo > 0 ? fondo : 2.4,
      capas: leerCapas(r.capas),
      pinturas,
    });
  }
  return cajones;
}

/** Las banquinas, como los cajones: una con menos de tres puntos no encierra
 *  nada, y una sin alto que sirva sale con la de una cocina, 10 cm. */
function leerBanquinas(valor: unknown): Banquina[] {
  const banquinas: Banquina[] = [];
  for (const b of Array.isArray(valor) ? valor : []) {
    if (typeof b !== "object" || b === null) continue;
    const r = b as Record<string, unknown>;
    const puntos = (Array.isArray(r.puntos) ? r.puntos : [])
      .map(punto)
      .filter((p): p is Punto => p !== null);
    const alto = numero(r.alto);
    if (typeof r.id !== "string" || puntos.length < 3) continue;
    // El revestimiento, sin lados que no existen ni repetidos: un dibujo
    // guardado a medias no puede revestir un lado de más.
    let revestimiento: RevestimientoDeBanquina | null = null;
    if (typeof r.revestimiento === "object" && r.revestimiento !== null) {
      const crudo = r.revestimiento as Record<string, unknown>;
      const lados = (Array.isArray(crudo.lados) ? crudo.lados : []).filter(
        (l): l is number => typeof l === "number" && Number.isInteger(l) && l >= 0 && l < puntos.length
      );
      revestimiento = {
        tarea: typeof crudo.tarea === "string" ? crudo.tarea : "",
        lados: Array.from(new Set(lados)).sort((a, b) => a - b),
      };
    }
    banquinas.push({
      id: r.id,
      puntos,
      alto: alto !== null && alto > 0 ? alto : 0.1,
      capas: leerCapas(r.capas),
      revestimiento,
    });
  }
  return banquinas;
}

/**
 * Los muros con cuánto suman de cada lado sus capas dibujadas (`Muro.acabado`).
 *
 * Se apilan como en la planta (`piezasDeCapas`) pero sin geometría: por los
 * tramos de cada lado, en el orden de la lista, cada uno sobre los de antes
 * que pisa a lo largo y en altura. De cada lado vale la pila más alta: un
 * porcelanato en un pedazo de la pared ya corre la cara terminada.
 */
export function conAcabado(muros: Muro[], capas: CapaDibujada[]): Muro[] {
  const pilas = new Map<string, { desde: number; hasta: number; abajo: number; arriba: number; tope: number }[]>();
  for (const capa of capas) {
    const abajo = capa.desde;
    const arriba = typeof capa.hasta === "number" ? capa.hasta : Infinity;
    for (const t of capa.tramos) {
      if (t.cara !== 1 && t.cara !== -1) continue;
      const clave = `${t.muroId}|${t.cara}`;
      const pila = pilas.get(clave) ?? [];
      let base = 0;
      for (const o of pila) {
        if (Math.min(o.hasta, t.hasta) - Math.max(o.desde, t.desde) <= 1e-6) continue;
        if (Math.min(o.arriba, arriba) - Math.max(o.abajo, abajo) <= 1e-6) continue;
        base = Math.max(base, o.tope);
      }
      pila.push({ desde: t.desde, hasta: t.hasta, abajo, arriba, tope: base + capa.espesor });
      pilas.set(clave, pila);
    }
  }
  const alto = (clave: string) => Math.max(0, ...(pilas.get(clave) ?? []).map((o) => o.tope));
  return muros.map((m) => {
    const exterior = alto(`${m.id}|-1`);
    const interior = alto(`${m.id}|1`);
    if (exterior === 0 && interior === 0 && !m.acabado) return m;
    return { ...m, acabado: { exterior, interior } };
  });
}

/**
 * Las capas dibujadas. Un tramo sin su muro no está en ningún lado y se va; una
 * capa que se queda sin tramos, también.
 */
function leerCapasDibujadas(valor: unknown, muros: Set<string>): CapaDibujada[] {
  const capas: CapaDibujada[] = [];
  for (const c of Array.isArray(valor) ? valor : []) {
    if (typeof c !== "object" || c === null) continue;
    const r = c as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    const tramos: TramoDeCapa[] = [];
    for (const t of Array.isArray(r.tramos) ? r.tramos : []) {
      if (typeof t !== "object" || t === null) continue;
      const q = t as Record<string, unknown>;
      const desde = numero(q.desde);
      const hasta = numero(q.hasta);
      const cara = q.cara === 1 || q.cara === -1 || q.cara === "a" || q.cara === "b" ? q.cara : null;
      if (typeof q.muroId !== "string" || !muros.has(q.muroId) || cara === null) continue;
      if (desde === null || hasta === null) continue;
      tramos.push({ muroId: q.muroId, cara, desde: Math.min(desde, hasta), hasta: Math.max(desde, hasta) });
    }
    if (tramos.length === 0) continue;
    const espesor = numero(r.espesor);
    const desde = numero(r.desde);
    const hasta = numero(r.hasta);
    capas.push({
      id: r.id,
      tarea: idDeTarea(r.tarea),
      espesor: espesor !== null && espesor >= 0 && espesor < 1 ? espesor : 0,
      desde: desde !== null && desde >= 0 ? desde : 0,
      hasta:
        r.hasta === "cielorraso" ? "cielorraso" : hasta !== null && hasta > 0 ? hasta : "techo",
      tramos,
    });
  }
  return capas;
}

/** Una medida en metros que tiene que ser mayor que cero, o lo de siempre. */
function medida(valor: unknown, siFalta: number): number {
  const n = numero(valor);
  return n !== null && n > 0 ? n : siFalta;
}

/** Una medida que puede ser cero pero no negativa, o null si no está. */
function noNegativo(valor: unknown): number | null {
  const n = numero(valor);
  return n !== null && n >= 0 ? n : null;
}

/** El id de una tarea del catálogo, o null. Una pieza de antes no lo trae. */
function idDeTarea(valor: unknown): string | null {
  return typeof valor === "string" && valor !== "" ? valor : null;
}

/** Lo que suman las capas de cada lado; cero lo que no se entiende. */
function leerRevestimiento(valor: unknown): Muro["revestimiento"] {
  const r = (typeof valor === "object" && valor !== null ? valor : {}) as Record<string, unknown>;
  const metros = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n < 2 ? n : 0;
  };
  return { exterior: metros(r.exterior), interior: metros(r.interior) };
}

/** El zócalo de un muro: la tarea de cada lado, o nada. */
function leerZocalo(valor: unknown): Muro["zocalo"] {
  const r = (typeof valor === "object" && valor !== null ? valor : {}) as Record<string, unknown>;
  const tarea = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
  return { exterior: tarea(r.exterior), interior: tarea(r.interior) };
}

/** Un contorno propio guardado —el del cielorraso—: con menos de tres puntos
 *  no encierra nada y vale como si no estuviera. */
function leerContorno(valor: unknown): Punto[] | null {
  const puntos = (Array.isArray(valor) ? valor : [])
    .map(punto)
    .filter((p): p is Punto => p !== null);
  return puntos.length >= 3 ? puntos : null;
}

/**
 * La buña de un ambiente. Un anillo de menos de tres puntos no encierra nada:
 * vuelve a ser perimetral, que es lo que el ambiente ya sabe dibujar.
 */
function leerBuna(valor: unknown): Buna | null {
  if (typeof valor !== "object" || valor === null) return null;
  const r = valor as Record<string, unknown>;
  const crudos = Array.isArray(r.anillo) ? r.anillo : [];
  const anillo: Buna["anillo"] = [];
  for (const v of crudos) {
    const p = punto(v);
    if (p === null) continue;
    const lleva = (v as Record<string, unknown>).lleva;
    anillo.push({ ...p, lleva: lleva !== false });
  }
  return {
    tarea: typeof r.tarea === "string" ? r.tarea : "",
    anillo: anillo.length >= 3 ? anillo : null,
  };
}

/**
 * La estructura guardada. Un dibujo de antes de que existiera no la trae, y
 * abre con la estructura vacía.
 */
function leerEstructura(valor: unknown): Estructura {
  if (typeof valor !== "object" || valor === null) return ESTRUCTURA_VACIA;
  const crudo = valor as Record<string, unknown>;

  const columnas: Columna[] = [];
  for (const c of Array.isArray(crudo.columnas) ? crudo.columnas : []) {
    if (typeof c !== "object" || c === null) continue;
    const r = c as Record<string, unknown>;
    const p = punto(r.p);
    const desde = numero(r.desde);
    if (typeof r.id !== "string" || !p) continue;
    columnas.push({
      id: r.id,
      nombre: typeof r.nombre === "string" ? r.nombre : "",
      p,
      ancla: ANCLAS.find((a) => a.valor === r.ancla)?.valor ?? "centro",
      // Una columna guardada antes de que existieran: derecha y de hormigón.
      giro: numero(r.giro) ?? 0,
      material: MATERIALES.find((m) => m.valor === r.material)?.valor ?? "hormigon",
      visto: r.visto === true,
      perfil: typeof r.perfil === "string" ? r.perfil : "",
      tarea: idDeTarea(r.tarea),
      ancho: medida(r.ancho, COLUMNA_INICIAL.ancho),
      profundidad: medida(r.profundidad, COLUMNA_INICIAL.profundidad),
      desde,
      arriba: numero(r.arriba),
      altura: (() => {
        const altura = numero(r.altura);
        return altura !== null && altura > 0 ? altura : null;
      })(),
    });
  }

  const vigas: Viga[] = [];
  for (const v of Array.isArray(crudo.vigas) ? crudo.vigas : []) {
    if (typeof v !== "object" || v === null) continue;
    const r = v as Record<string, unknown>;
    const a = punto(r.a);
    const b = punto(r.b);
    if (typeof r.id !== "string" || !a || !b) continue;
    vigas.push({
      id: r.id,
      nombre: typeof r.nombre === "string" ? r.nombre : "",
      a,
      b,
      referencia: REFERENCIAS.find((ref) => ref.valor === r.referencia)?.valor ?? "centro",
      material: MATERIALES.find((m) => m.valor === r.material)?.valor ?? "hormigon",
      perfil: typeof r.perfil === "string" ? r.perfil : "",
      tarea: idDeTarea(r.tarea),
      ancho: medida(r.ancho, VIGA_INICIAL.ancho),
      alto: medida(r.alto, VIGA_INICIAL.alto),
      nivel: numero(r.nivel),
      tabique: r.tabique === true,
      desde: numero(r.desde),
      altura: (() => {
        const altura = numero(r.altura);
        return altura !== null && altura > 0 ? altura : null;
      })(),
    });
  }

  const losas: Losa[] = [];
  for (const l of Array.isArray(crudo.losas) ? crudo.losas : []) {
    if (typeof l !== "object" || l === null) continue;
    const r = l as Record<string, unknown>;
    const puntos = (Array.isArray(r.puntos) ? r.puntos : [])
      .map(punto)
      .filter((p): p is Punto => p !== null);
    if (typeof r.id !== "string" || puntos.length < 3) continue;
    losas.push({
      id: r.id,
      nombre: typeof r.nombre === "string" ? r.nombre : "",
      puntos,
      tarea: idDeTarea(r.tarea),
      espesor: medida(r.espesor, LOSA_INICIAL.espesor),
      bajoNpt: noNegativo(r.bajoNpt),
    });
  }

  return { columnas, vigas, losas, bajoNpt: noNegativo(crudo.bajoNpt) };
}
