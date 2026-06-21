import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phasesHebdo, compresserBlocs, analyserCycles } from '../js/cycles.js';

/* hebdo synthétique : seul .charge compte pour phasesHebdo */
const H = (...charges) => charges.map((c, i) => ({ charge: c, finSemaine: `s${i}` }));

/* ---- phasesHebdo ---- */
test('phasesHebdo : démarrage, accumulation, deload', () => {
  assert.deepEqual(phasesHebdo(H(100, 110, 121, 80)),
    ['demarrage', 'accumulation', 'accumulation', 'deload']);   // 80 ≤ 0,7·121
});
test('phasesHebdo : charge stable → maintien', () => {
  assert.deepEqual(phasesHebdo(H(100, 100, 100)), ['demarrage', 'maintien', 'maintien']);
});
test('phasesHebdo : deload jugé sur le pic récent (3 sem)', () => {
  // 60 ≤ 0,7·max(100,100,100)=70 → deload
  assert.equal(phasesHebdo(H(100, 100, 100, 60))[3], 'deload');
});

/* ---- compresserBlocs ---- */
test('compresserBlocs : regroupe les phases consécutives', () => {
  const hebdo = H(100, 110, 121, 80);
  const blocs = compresserBlocs(hebdo, phasesHebdo(hebdo));
  assert.equal(blocs.length, 3);   // demarrage | accumulation×2 | deload
  assert.equal(blocs[1].type, 'accumulation');
  assert.equal(blocs[1].nbSemaines, 2);
  assert.equal(blocs[2].type, 'deload');
});

/* ---- analyserCycles (intégration sur des séances datées) ---- */
const REF = '2026-06-20';
const jour = n => { const d = new Date(REF + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
/* place une charge hebdo : la semaine d'INDEX de sortie j (0 = plus ancienne) sur nbSem semaines */
const seancesDepuisCharges = (charges) => charges.map((c, j) =>
  ({ date: jour(-((charges.length - 1 - j) * 7)), exercices: [{ nom: 'X', series: [{ charge: c, reps: 1 }] }] }));

test('analyserCycles : deux cycles accumulation→deload détectés', () => {
  const seances = seancesDepuisCharges([100, 110, 120, 75, 110, 125, 140, 90]);
  const r = analyserCycles(seances, REF, 8);
  assert.equal(r.hebdo.length, 8);
  assert.equal(r.nbCycles, 2);
  assert.equal(r.phaseActuelle, 'deload');
  assert.equal(r.semainesDansPhase, 1);
  assert.equal(r.semainesDepuisDeload, 0);
});
test('analyserCycles : phase courante = accumulation en pleine montée', () => {
  const r = analyserCycles(seancesDepuisCharges([100, 110, 122, 136]), REF, 4);
  assert.equal(r.phaseActuelle, 'accumulation');
  assert.equal(r.semainesDepuisDeload, null);   // jamais de deload
  assert.equal(r.nbCycles, 0);
});
test('analyserCycles : ignore les semaines vides en tête', () => {
  // 8 semaines demandées, mais entraînement seulement sur les 3 dernières
  const seances = [
    { date: jour(-14), exercices: [{ nom: 'X', series: [{ charge: 100, reps: 1 }] }] },
    { date: jour(-7), exercices: [{ nom: 'X', series: [{ charge: 110, reps: 1 }] }] },
    { date: jour(0), exercices: [{ nom: 'X', series: [{ charge: 122, reps: 1 }] }] },
  ];
  const r = analyserCycles(seances, REF, 8);
  assert.equal(r.hebdo.length, 3);              // tête vide retirée
  assert.equal(r.hebdo[0].charge, 100);
});
test('analyserCycles : aucune séance → phase inconnue, sans lever', () => {
  const r = analyserCycles([], REF, 12);
  assert.equal(r.phaseActuelle, 'inconnue');
  assert.equal(r.nbCycles, 0);
  assert.deepEqual(r.blocs, []);
});
