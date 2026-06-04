export const obras = [
  {
    id: "san-isidro",
    nombre: "Edificio San Isidro",
    ubicacion: "San Isidro, Buenos Aires",
    estado: "En ejecución",
    avance: 42,
    fechaInicio: "01/06/2026",
    fechaFin: "01/12/2026",
    gastoTotal: 84500000,
    empresaA: 50000000,
    empresaB: 34500000,
  },
  {
    id: "tigre",
    nombre: "Viviendas Tigre",
    ubicacion: "Tigre, Buenos Aires",
    estado: "Proyecto",
    avance: 12,
    fechaInicio: "15/07/2026",
    fechaFin: "15/03/2027",
    gastoTotal: 22100000,
    empresaA: 11100000,
    empresaB: 11000000,
  },
  {
    id: "belgrano",
    nombre: "Reforma Belgrano",
    ubicacion: "CABA",
    estado: "Finalizada",
    avance: 100,
    fechaInicio: "10/02/2026",
    fechaFin: "30/05/2026",
    gastoTotal: 38150000,
    empresaA: 20000000,
    empresaB: 18150000,
  },
];

export const gastos = [
  {
    id: "G-001",
    obraId: "san-isidro",
    fecha: "04/06/2026",
    rubro: "Hormigón armado",
    concepto: "Hormigón para platea",
    proveedor: "Hormigonera Norte",
    empresaPagadora: "Empresa A",
    monto: 12500000,
    estado: "Pagado",
  },
  {
    id: "G-002",
    obraId: "san-isidro",
    fecha: "08/06/2026",
    rubro: "Hierro",
    concepto: "Compra de barras de acero",
    proveedor: "Aceros San Martín",
    empresaPagadora: "Empresa B",
    monto: 8200000,
    estado: "Pagado",
  },
  {
    id: "G-003",
    obraId: "san-isidro",
    fecha: "12/06/2026",
    rubro: "Albañilería",
    concepto: "Materiales varios",
    proveedor: "Corralón Central",
    empresaPagadora: "Empresa A",
    monto: 3600000,
    estado: "Pendiente",
  },
];

export const documentos = [
  {
    id: "D-001",
    obraId: "san-isidro",
    nombre: "Planta arquitectura PB",
    tipo: "PDF",
    categoria: "Planos",
    fecha: "04/06/2026",
  },
  {
    id: "D-002",
    obraId: "san-isidro",
    nombre: "Plano estructura",
    tipo: "DWG",
    categoria: "Estructura",
    fecha: "06/06/2026",
  },
];

export const fotos = [
  {
    id: "F-001",
    obraId: "san-isidro",
    fecha: "04/06/2026",
    etapa: "Movimiento de suelo",
    descripcion: "Inicio de tareas preliminares.",
  },
  {
    id: "F-002",
    obraId: "san-isidro",
    fecha: "10/06/2026",
    etapa: "Hormigón armado",
    descripcion: "Armado de platea.",
  },
];

export const avances = [
  {
    id: "A-001",
    obraId: "san-isidro",
    rubro: "Demolición",
    avance: 100,
  },
  {
    id: "A-002",
    obraId: "san-isidro",
    rubro: "Movimiento de suelo",
    avance: 80,
  },
  {
    id: "A-003",
    obraId: "san-isidro",
    rubro: "Hormigón armado",
    avance: 45,
  },
  {
    id: "A-004",
    obraId: "san-isidro",
    rubro: "Albañilería",
    avance: 10,
  },
];

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}