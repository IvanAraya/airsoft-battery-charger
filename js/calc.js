// Cálculos puros para la carga de baterías de réplicas de airsoft.
// Sin dependencias del DOM para poder probarlos con `node --test`.

export const CHEMISTRIES = {
  nimh: {
    id: 'nimh',
    name: 'NiMH',
    family: 'nickel',
    cell: { nominal: 1.2, full: 1.45, min: 1.0, storage: null },
    // Factor de ineficiencia: la carga de NiMH pierde energía en forma de calor.
    efficiencyFactor: 1.4,
    cells: [6, 7, 8, 9, 10, 11, 12],
    defaultCells: 8,
    recommended: { min: 0.5, max: 1.0 },
    limits: { trickle: 0.1, caution: 1.0, danger: 2.0 },
    tips: [
      'Usa un cargador inteligente con corte por −ΔV o por temperatura.',
      'Con cargadores “de pared” sin corte automático (≈0,1C) no superes 14–16 h.',
      'Deja enfriar la batería antes de cargarla si viene de uso intenso.',
      'Evita descargarla por debajo de 1,0 V por celda.',
    ],
  },
  nicd: {
    id: 'nicd',
    name: 'NiCd',
    family: 'nickel',
    cell: { nominal: 1.2, full: 1.45, min: 1.0, storage: null },
    efficiencyFactor: 1.2,
    cells: [6, 7, 8, 9, 10, 11, 12],
    defaultCells: 8,
    recommended: { min: 1.0, max: 1.0 },
    limits: { trickle: 0.1, caution: 1.0, danger: 2.0 },
    tips: [
      'Descárgala por completo de vez en cuando para evitar el efecto memoria.',
      'Usa un cargador con corte por −ΔV para evitar la sobrecarga.',
      'Con cargadores lentos (≈0,1C) no superes 14–16 h.',
      'Contiene cadmio: recíclala en un punto autorizado.',
    ],
  },
  lipo: {
    id: 'lipo',
    name: 'LiPo',
    family: 'lithium',
    cell: { nominal: 3.7, full: 4.2, min: 3.0, storage: 3.8 },
    // Factor que aproxima la fase CV (voltaje constante) al final de la carga.
    efficiencyFactor: 1.2,
    cells: [1, 2, 3, 4],
    defaultCells: 2,
    recommended: { min: 0.5, max: 1.0 },
    limits: { trickle: 0, caution: 1.0, danger: 2.0 },
    tips: [
      'Carga siempre con un cargador balanceador conectado al conector de balance.',
      'Nunca la dejes cargando sin supervisión; usa una bolsa ignífuga.',
      'No la descargues por debajo de 3,0 V por celda.',
      'Si no la vas a usar, guárdala a voltaje de almacenamiento (≈3,8 V por celda).',
      'Si está hinchada o dañada, no la cargues.',
    ],
  },
  liion: {
    id: 'liion',
    name: 'Li-Ion',
    family: 'lithium',
    cell: { nominal: 3.6, full: 4.2, min: 3.0, storage: 3.7 },
    efficiencyFactor: 1.2,
    cells: [1, 2, 3, 4],
    defaultCells: 3,
    recommended: { min: 0.3, max: 0.5 },
    limits: { trickle: 0, caution: 0.5, danger: 1.0 },
    tips: [
      'Usa un cargador para litio con perfil CC/CV y balanceo de celdas.',
      'No superes 4,2 V por celda ni descargues por debajo de 3,0 V.',
      'Guárdala a ≈3,7 V por celda si no la vas a usar en semanas.',
      'Nunca la dejes cargando sin supervisión.',
    ],
  },
};

export function getChemistry(id) {
  const chem = CHEMISTRIES[id];
  if (!chem) throw new Error(`Química desconocida: ${id}`);
  return chem;
}

/** Voltajes del pack según química y número de celdas en serie. */
export function packVoltages(chemistryId, cells) {
  const { cell } = getChemistry(chemistryId);
  const round = (v) => Math.round(v * cells * 100) / 100;
  return {
    nominal: round(cell.nominal),
    full: round(cell.full),
    min: round(cell.min),
    storage: cell.storage == null ? null : round(cell.storage),
  };
}

/** Etiqueta del pack, p. ej. "9,6 V (8 celdas)" o "7,4 V 2S". */
export function packLabel(chemistryId, cells) {
  const chem = getChemistry(chemistryId);
  const v = packVoltages(chemistryId, cells).nominal.toLocaleString('es', { maximumFractionDigits: 2 });
  return chem.family === 'lithium' ? `${v} V ${cells}S` : `${v} V (${cells} celdas)`;
}

/**
 * Clasifica la tasa C de carga.
 * level: 'trickle' | 'ok' | 'caution' | 'danger'
 */
export function classifyCRate(chemistryId, cRate) {
  const { limits, family } = getChemistry(chemistryId);
  if (cRate > limits.danger) return 'danger';
  if (cRate > limits.caution) return 'caution';
  if (family === 'nickel' && cRate <= limits.trickle) return 'trickle';
  return 'ok';
}

/** Corriente de carga recomendada (mA) para una capacidad dada. */
export function recommendedCurrent(chemistryId, capacityMah) {
  const { recommended } = getChemistry(chemistryId);
  return {
    min: Math.round(capacityMah * recommended.min),
    max: Math.round(capacityMah * recommended.max),
  };
}

/** Valida entradas; devuelve lista de mensajes de error (vacía si todo está bien). */
export function validate({ capacityMah, currentMa, stateOfCharge }) {
  const errors = [];
  if (!Number.isFinite(capacityMah) || capacityMah <= 0) errors.push('La capacidad debe ser mayor que 0 mAh.');
  if (!Number.isFinite(currentMa) || currentMa <= 0) errors.push('La corriente de carga debe ser mayor que 0 mA.');
  if (!Number.isFinite(stateOfCharge) || stateOfCharge < 0 || stateOfCharge > 100) {
    errors.push('El nivel de carga actual debe estar entre 0 y 100 %.');
  }
  return errors;
}

/**
 * Calcula el tiempo estimado de carga.
 * - Níquel (NiMH/NiCd): t = mAh × (1 − SoC) / mA × factor de ineficiencia.
 * - Litio (LiPo/Li-Ion): t = mAh × (1 − SoC) / mA × factor que aproxima la fase CV.
 */
export function calculate({ chemistry, cells, capacityMah, currentMa, stateOfCharge = 0 }) {
  const errors = validate({ capacityMah, currentMa, stateOfCharge });
  if (errors.length) return { ok: false, errors };

  const chem = getChemistry(chemistry);
  const missingMah = capacityMah * (1 - stateOfCharge / 100);
  const hours = (missingMah / currentMa) * chem.efficiencyFactor;
  const cRate = currentMa / capacityMah;

  return {
    ok: true,
    hours,
    minutes: Math.round(hours * 60),
    missingMah: Math.round(missingMah),
    cRate,
    level: classifyCRate(chemistry, cRate),
    recommended: recommendedCurrent(chemistry, capacityMah),
    voltages: packVoltages(chemistry, cells),
    label: packLabel(chemistry, cells),
  };
}

/** Formatea minutos como "2 h 48 min". */
export function formatDuration(totalMinutes) {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${rest} min`;
}
