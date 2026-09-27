import { calculate, estimateSocFromVoltage, formatDuration, getChemistry } from './calc.js';

const STORAGE_KEY = 'airsoft-battery-charger:v1';

const form = document.getElementById('calc-form');
const cellsSelect = document.getElementById('cells');
const capacityInput = document.getElementById('capacity');
const currentInput = document.getElementById('current');
const socInput = document.getElementById('soc');
const socOut = document.getElementById('soc-out');
const voltageInput = document.getElementById('voltage');

const $ = (id) => document.getElementById(id);
const fmtNumber = (n, digits = 1) => n.toLocaleString('es', { maximumFractionDigits: digits });
const fmtVolts = (v) => `${fmtNumber(v, 2)} V`;

const LEVEL_TEXT = {
  trickle: 'Carga lenta: segura, pero limita la carga a 14–16 h si el cargador no tiene corte automático.',
  ok: 'Corriente adecuada para esta química.',
  caution: 'Corriente alta: úsala solo si el fabricante la admite y con cargador inteligente.',
  danger: 'Corriente excesiva: riesgo de sobrecalentamiento o daño. Reduce la corriente.',
};

function selectedChemistry() {
  return form.elements.chemistry.value;
}

function populateCells(chemistryId, preferred) {
  const chem = getChemistry(chemistryId);
  const value = chem.cells.includes(preferred) ? preferred : chem.defaultCells;
  cellsSelect.replaceChildren(
    ...chem.cells.map((n) => {
      const volts = fmtNumber(n * chem.cell.nominal, 2);
      const text = chem.family === 'lithium' ? `${n}S · ${volts} V` : `${n} celdas · ${volts} V`;
      return new Option(text, String(n), false, n === value);
    }),
  );
}

const VOLTAGE_WARNING = {
  overcharged: 'Sobre 4,2 V por celda: la batería está sobrecargada. No la cargues.',
  overdischarged: 'Bajo 3,0 V por celda: revisa que el número de celdas sea correcto; si lo es, está sobredescargada. Si está hinchada no la cargues; si no, cárgala a baja corriente y vigílala.',
};

// Actualiza el bloque de voltaje según la química y, si hay un voltaje
// ingresado, estima la carga y mueve el control deslizante.
function applyVoltage() {
  const chem = getChemistry(selectedChemistry());
  const supported = Boolean(chem.socCurve);
  $('voltage-field').hidden = !supported;
  $('nickel-note').hidden = supported;

  const output = $('voltage-result');
  if (!supported) {
    output.hidden = true;
    return;
  }

  $('soc-table').replaceChildren(
    ...[...chem.socCurve].reverse().map(([v, pct]) => {
      const row = document.createElement('tr');
      row.append(
        Object.assign(document.createElement('td'), { textContent: `${v.toLocaleString('es', { minimumFractionDigits: 2 })} V` }),
        Object.assign(document.createElement('td'), { textContent: `${pct} %` }),
      );
      return row;
    }),
  );

  if (voltageInput.value === '') {
    output.hidden = true;
    return;
  }

  const estimate = estimateSocFromVoltage(chem.id, Number(voltageInput.value), Number(cellsSelect.value));
  output.hidden = false;
  if (!estimate.ok) {
    output.dataset.level = 'caution';
    output.textContent = estimate.reason === 'out-of-range'
      ? `${fmtNumber(estimate.perCell, 2)} V por celda está fuera de rango: revisa la medición y el número de celdas.`
      : 'Ingresa un voltaje válido.';
    return;
  }

  socInput.value = estimate.soc;
  const summary = `${fmtNumber(estimate.perCell, 2)} V por celda → ≈${estimate.soc} %`;
  output.dataset.level = estimate.warning ? 'danger' : 'ok';
  output.textContent = estimate.warning ? `${summary}. ${VOLTAGE_WARNING[estimate.warning]}` : summary;
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Almacenamiento no disponible: se ignora.
  }
}

function render() {
  const chemistry = selectedChemistry();
  const input = {
    chemistry,
    cells: Number(cellsSelect.value),
    capacityMah: Number(capacityInput.value),
    currentMa: Number(currentInput.value),
    stateOfCharge: Number(socInput.value),
  };
  socOut.textContent = `${input.stateOfCharge} %`;
  saveState(input);

  const chem = getChemistry(chemistry);
  $('tips').replaceChildren(...chem.tips.map((t) => Object.assign(document.createElement('li'), { textContent: t })));

  const result = calculate(input);
  const errors = $('errors');
  if (!result.ok) {
    errors.replaceChildren(...result.errors.map((e) => Object.assign(document.createElement('p'), { textContent: e })));
    errors.hidden = false;
    $('result-body').hidden = true;
    return;
  }
  errors.hidden = true;
  $('result-body').hidden = false;

  $('time').textContent = input.stateOfCharge >= 100 ? 'Batería llena' : formatDuration(result.minutes);
  $('pack-label').textContent = `${chem.name} ${result.label}`;

  const crate = $('crate');
  crate.dataset.level = result.level;
  $('crate-value').textContent = `${fmtNumber(result.cRate, 2)}C`;
  $('crate-text').textContent = LEVEL_TEXT[result.level];
  $('crate-help-example').textContent =
    `En esta batería de ${input.capacityMah} mAh: 1C = ${input.capacityMah} mA y 0,5C = ${Math.round(input.capacityMah / 2)} mA.`;

  const { min, max } = result.recommended;
  $('recommended').textContent = min === max ? `${min} mA` : `${min}–${max} mA`;
  $('missing').textContent = `${result.missingMah} mAh`;
  $('v-nominal').textContent = fmtVolts(result.voltages.nominal);
  $('v-full').textContent = fmtVolts(result.voltages.full);
  $('v-min').textContent = fmtVolts(result.voltages.min);
  $('storage-row').hidden = result.voltages.storage == null;
  if (result.voltages.storage != null) $('v-storage').textContent = fmtVolts(result.voltages.storage);
}

function init() {
  const saved = loadState();
  if (saved) {
    const radio = form.querySelector(`input[name="chemistry"][value="${saved.chemistry}"]`);
    if (radio) radio.checked = true;
    if (saved.capacityMah > 0) capacityInput.value = saved.capacityMah;
    if (saved.currentMa > 0) currentInput.value = saved.currentMa;
    if (Number.isFinite(saved.stateOfCharge)) socInput.value = saved.stateOfCharge;
  }
  populateCells(selectedChemistry(), saved?.cells);

  const onFormEvent = (e) => {
    if (e.type === 'change' && e.target.name === 'chemistry') {
      populateCells(selectedChemistry(), Number(cellsSelect.value));
    }
    // Mover el control a mano reemplaza la estimación por voltaje.
    if (e.target === socInput) voltageInput.value = '';
    applyVoltage();
    render();
  };
  form.addEventListener('change', onFormEvent);
  form.addEventListener('input', onFormEvent);
  form.addEventListener('submit', (e) => e.preventDefault());
  applyVoltage();
  render();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const banner = $('update-banner');
  let waitingWorker = null;
  let updateRequested = false;

  const showUpdate = (worker) => {
    waitingWorker = worker;
    banner.hidden = false;
  };

  $('update-btn').addEventListener('click', () => {
    if (!waitingWorker) return;
    updateRequested = true;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Solo recarga cuando el usuario aceptó la actualización; la primera
    // instalación también toma el control y no debe recargar la página.
    if (!updateRequested) return;
    updateRequested = false;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
      // Busca actualizaciones cuando la app vuelve a primer plano.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (err) {
      console.warn('No se pudo registrar el service worker:', err);
    }
  });
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function setupInstallButton() {
  const button = $('install-btn');
  let deferredPrompt = null;

  // Chrome/Edge (Android y escritorio) emiten este evento cuando la app es instalable.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    if (isStandalone()) return;
    deferredPrompt = event;
    button.hidden = false;
  });

  button.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    button.hidden = true;
    // Un prompt solo se puede usar una vez; si el usuario lo rechaza,
    // Chrome volverá a emitir beforeinstallprompt más adelante.
    await prompt.prompt();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    button.hidden = true;
  });
}

init();
setupInstallButton();
registerServiceWorker();
