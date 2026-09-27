import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculate,
  classifyCRate,
  estimateSocFromVoltage,
  formatDuration,
  packVoltages,
  recommendedCurrent,
  validate,
} from '../js/calc.js';

test('NiMH 1600 mAh a 800 mA desde 0 % tarda 2 h 48 min', () => {
  const r = calculate({ chemistry: 'nimh', cells: 8, capacityMah: 1600, currentMa: 800, stateOfCharge: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.minutes, 168);
  assert.equal(formatDuration(r.minutes), '2 h 48 min');
  assert.equal(r.level, 'ok');
});

test('LiPo 1200 mAh a 1200 mA desde 0 % tarda 1 h 12 min', () => {
  const r = calculate({ chemistry: 'lipo', cells: 2, capacityMah: 1200, currentMa: 1200, stateOfCharge: 0 });
  assert.equal(r.minutes, 72);
  assert.equal(r.cRate, 1);
  assert.equal(r.level, 'ok');
});

test('el nivel de carga inicial reduce el tiempo', () => {
  const r = calculate({ chemistry: 'lipo', cells: 2, capacityMah: 1200, currentMa: 1200, stateOfCharge: 50 });
  assert.equal(r.minutes, 36);
  assert.equal(r.missingMah, 600);
});

test('NiCd usa factor 1,2', () => {
  const r = calculate({ chemistry: 'nicd', cells: 8, capacityMah: 1000, currentMa: 1000, stateOfCharge: 0 });
  assert.equal(r.minutes, 72);
});

test('clasificación de tasa C', () => {
  assert.equal(classifyCRate('nimh', 0.1), 'trickle');
  assert.equal(classifyCRate('nimh', 0.5), 'ok');
  assert.equal(classifyCRate('nimh', 1.5), 'caution');
  assert.equal(classifyCRate('nimh', 3), 'danger');
  assert.equal(classifyCRate('lipo', 0.1), 'ok');
  assert.equal(classifyCRate('lipo', 1.5), 'caution');
  assert.equal(classifyCRate('liion', 0.8), 'caution');
  assert.equal(classifyCRate('liion', 1.2), 'danger');
});

test('voltajes del pack', () => {
  assert.deepEqual(packVoltages('nimh', 8), { nominal: 9.6, full: 11.6, min: 8, storage: null });
  assert.deepEqual(packVoltages('lipo', 3), { nominal: 11.1, full: 12.6, min: 9, storage: 11.4 });
});

test('corriente recomendada', () => {
  assert.deepEqual(recommendedCurrent('lipo', 1500), { min: 750, max: 1500 });
  assert.deepEqual(recommendedCurrent('liion', 2000), { min: 600, max: 1000 });
});

test('validación de entradas', () => {
  assert.equal(validate({ capacityMah: 1000, currentMa: 500, stateOfCharge: 0 }).length, 0);
  assert.equal(validate({ capacityMah: 0, currentMa: 500, stateOfCharge: 0 }).length, 1);
  assert.equal(validate({ capacityMah: 1000, currentMa: NaN, stateOfCharge: 120 }).length, 2);
  const r = calculate({ chemistry: 'lipo', cells: 2, capacityMah: -1, currentMa: 1000 });
  assert.equal(r.ok, false);
});

test('formato de duración', () => {
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(120), '2 h');
  assert.equal(formatDuration(961), '16 h 1 min');
});

test('estimación de carga por voltaje (LiPo)', () => {
  assert.deepEqual(estimateSocFromVoltage('lipo', 7.68, 2), { ok: true, perCell: 3.84, soc: 50, warning: null });
  assert.equal(estimateSocFromVoltage('lipo', 3.84, 2).soc, 50);
  assert.equal(estimateSocFromVoltage('lipo', 3.855, 2).soc, 55);
  assert.equal(estimateSocFromVoltage('lipo', 4.2, 1).soc, 100);
  assert.equal(estimateSocFromVoltage('lipo', 12.6, 3).soc, 100);
});

test('estimación de carga por voltaje: advertencias y casos inválidos', () => {
  assert.equal(estimateSocFromVoltage('lipo', 2.4, 2).ok, false);
  assert.equal(estimateSocFromVoltage('lipo', 7.4, 1).ok, false);
  const low = estimateSocFromVoltage('liion', 2.9, 1);
  assert.equal(low.soc, 0);
  assert.equal(low.warning, 'overdischarged');
  assert.equal(estimateSocFromVoltage('lipo', 4.3, 1).warning, 'overcharged');
  assert.deepEqual(estimateSocFromVoltage('nimh', 9.6, 8), { ok: false, reason: 'unsupported' });
});
