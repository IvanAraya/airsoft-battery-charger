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
    // El voltaje de NiMH/NiCd es casi plano: no sirve para estimar la carga.
    socCurve: null,
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
    socCurve: null,
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
    // Voltaje en reposo por celda → % de carga (aproximado).
    socCurve: [
      [3.5, 0], [3.61, 5], [3.69, 10], [3.73, 20], [3.77, 30], [3.8, 40],
      [3.84, 50], [3.87, 60], [3.95, 70], [4.02, 80], [4.11, 90], [4.2, 100],
    ],
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
    socCurve: [
      [3.0, 0], [3.3, 5], [3.5, 10], [3.6, 20], [3.66, 30], [3.72, 40],
      [3.78, 50], [3.85, 60], [3.92, 70], [4.0, 80], [4.1, 90], [4.2, 100],
    ],
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

/**
 * Estima el % de carga a partir del voltaje medido en reposo.
 * Acepta el voltaje total del pack o el voltaje por celda: en litio una celda
 * nunca supera 5 V y un pack 2S nunca baja de 6 V, así que > 5 V se toma como total.
 */
export function estimateSocFromVoltage(chemistryId, volts, cells) {
  const { socCurve } = getChemistry(chemistryId);
  if (!socCurve) return { ok: false, reason: 'unsupported' };
  if (!Number.isFinite(volts) || volts <= 0) return { ok: false, reason: 'invalid' };

  const perCell = volts > 5 ? volts / cells : volts;
  if (perCell < 2.5 || perCell > 4.35) return { ok: false, reason: 'out-of-range', perCell };

  let soc;
  const first = socCurve[0];
  const last = socCurve[socCurve.length - 1];
  if (perCell <= first[0]) soc = first[1];
  else if (perCell >= last[0]) soc = last[1];
  else {
    for (let i = 1; i < socCurve.length; i++) {
      const [v1, p1] = socCurve[i];
      if (perCell <= v1) {
        const [v0, p0] = socCurve[i - 1];
        soc = p0 + ((perCell - v0) / (v1 - v0)) * (p1 - p0);
        break;
      }
    }
  }

  let warning = null;
  if (perCell > 4.25) warning = 'overcharged';
  else if (perCell < 3.0) warning = 'overdischarged';

  return { ok: true, perCell, soc: Math.round(Math.min(100, Math.max(0, soc))), warning };
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
