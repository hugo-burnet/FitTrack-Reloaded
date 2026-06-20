import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCompliance, scoreRisk, alerteSurcharge, alerteSousCharge } from '../js/scores.js';

test('scoreCompliance : tout à la cible → 100, confiance fiable', () => {
  const r = scoreCompliance({ seancesRealisees: 5, seancesPlanifiees: 5, joursProt: 7, joursKcal: 7 });
  assert.equal(r.score, 100);
  assert.equal(r.confiance, 'fiable');
});

test('scoreCompliance : kcal non suivis (null) → renormalisé sur séances+prot, confiance indicatif', () => {
  // séances 100 % (0,5) + prot 100 % (0,3) sur poids 0,8 → 100
  const r = scoreCompliance({ seancesRealisees: 5, seancesPlanifiees: 5, joursProt: 7, joursKcal: null });
  assert.equal(r.score, 100);
  assert.equal(r.confiance, 'indicatif');
});

test('scoreCompliance : moitié des séances seulement', () => {
  // séances 0,5 → 50 ; prot 0 ; kcal 0 → (0,5*0,5)/1 = 0,25 → 25
  const r = scoreCompliance({ seancesRealisees: 2, seancesPlanifiees: 4, joursProt: 0, joursKcal: 0 });
  assert.equal(r.score, 25);
});

test('scoreCompliance : aucune entrée exploitable → indisponible', () => {
  assert.deepEqual(scoreCompliance({ seancesPlanifiees: 0, fenetre: 0, joursKcal: null }), { score: null, confiance: 'indisponible' });
});

test('scoreRisk : ACWR en zone, pas de signal → risque faible', () => {
  const r = scoreRisk({ acwr: 1.0, monotonie: 1.0, declinForce: 0, totalForce: 5 });
  assert.equal(r.score, 0);
  assert.equal(r.niveau, 'faible');
  assert.equal(r.confiance, 'fiable');
});

test('scoreRisk : ACWR très haut + monotonie + déclin → risque élevé', () => {
  const r = scoreRisk({ acwr: 1.6, monotonie: 2.5, declinForce: 3, totalForce: 3 });
  assert.equal(r.score, 100);     // 50 + 20 + 30 borné à 100
  assert.equal(r.niveau, 'élevé');
});

test('scoreRisk : aucune entrée → indisponible', () => {
  const r = scoreRisk({});
  assert.equal(r.score, null);
  assert.equal(r.confiance, 'indisponible');
});

test('alerteSurcharge : ACWR > 1,5 déclenche, sinon monotonie, sinon risk', () => {
  assert.equal(alerteSurcharge({ acwr: 1.7 }).actif, true);
  assert.equal(alerteSurcharge({ acwr: 1.7 }).cls, 'v-baisse');
  assert.equal(alerteSurcharge({ acwr: 1.0, monotonie: 2.5 }).actif, true);
  assert.equal(alerteSurcharge({ acwr: 1.0, monotonie: 1.0, risk: 70 }).actif, true);
  assert.equal(alerteSurcharge({ acwr: 1.0, monotonie: 1.0, risk: 20 }).actif, false);
  assert.equal(alerteSurcharge({}).actif, false);
});

test('alerteSousCharge : ACWR < 0,8 (et > 0) déclenche', () => {
  assert.equal(alerteSousCharge({ acwr: 0.7 }).actif, true);
  assert.equal(alerteSousCharge({ acwr: 0.7 }).cls, 'v-hausse');
  assert.equal(alerteSousCharge({ acwr: 1.0 }).actif, false);
  assert.equal(alerteSousCharge({ acwr: null }).actif, false);
});
