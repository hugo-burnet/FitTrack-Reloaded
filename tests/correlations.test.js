import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  correlation, interpreter, decrireCorrelation,
  pairesSommeilCourbatures, pairesVolumeForce, pairesKcalPoids, correlationsDisponibles, MIN_POINTS,
} from '../js/correlations.js';

const proche = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≈ ${b}`);

/* ---- correlation (Pearson) ---- */
test('correlation : relation linéaire parfaite → r = ±1', () => {
  proche(correlation([{x:1,y:2},{x:2,y:4},{x:3,y:6}]).r, 1);
  proche(correlation([{x:1,y:6},{x:2,y:4},{x:3,y:2}]).r, -1);
});
test('correlation : variance nulle ou < 3 points → r null', () => {
  assert.equal(correlation([{x:1,y:5},{x:2,y:5},{x:3,y:5}]).r, null);   // y constant
  assert.equal(correlation([{x:1,y:2},{x:2,y:4}]).r, null);             // n < 3
});
test('correlation : ignore les points non numériques', () => {
  const c = correlation([{x:1,y:2},{x:2,y:4},{x:3,y:6},{x:null,y:9},{x:4,y:'a'}]);
  assert.equal(c.n, 3);
  proche(c.r, 1);
});

/* ---- interpreter ---- */
test('interpreter : seuils de force', () => {
  assert.equal(interpreter(null), 'indéterminée');
  assert.equal(interpreter(0.1), 'négligeable');
  assert.equal(interpreter(-0.3), 'faible');
  assert.equal(interpreter(0.5), 'modérée');
  assert.equal(interpreter(-0.7), 'forte');
  assert.equal(interpreter(0.9), 'très forte');
});

/* ---- decrireCorrelation : sensible au signe ---- */
test('decrireCorrelation : sommeil↔courbatures négatif = lecture attendue', () => {
  assert.match(decrireCorrelation('sommeil-courbatures', -0.7), /plus tu dors, moins/i);
  assert.match(decrireCorrelation('volume-force', -0.6), /rendements décroissants/i);
  assert.equal(decrireCorrelation('sommeil-courbatures', null), 'Pas assez de données pour conclure.');
  assert.equal(decrireCorrelation('volume-force', 0.05), 'Aucun lien net sur tes données.');
});

/* ---- builders ---- */
test('pairesSommeilCourbatures : ne garde que les jours complets', () => {
  const ej = [{ sommeil: 8, courbatures: 1 }, { sommeil: 6 }, { courbatures: 4 }, { sommeil: 5, courbatures: 7 }];
  const p = pairesSommeilCourbatures(ej);
  assert.equal(p.points.length, 2);
  assert.deepEqual(p.points[0], { x: 8, y: 1 });
});
test('pairesVolumeForce : un point (volume, e1RM) par séance contenant l\'exo', () => {
  const seances = [
    { date: '2026-01-01', exercices: [{ nom: 'Couché', series: [{ charge: 40, reps: 10 }, { charge: 40, reps: 10 }] }] },
    { date: '2026-01-08', exercices: [{ nom: 'Autre', series: [{ charge: 20, reps: 10 }] }] },
  ];
  const p = pairesVolumeForce(seances, 'Couché');
  assert.equal(p.points.length, 1);
  assert.equal(p.points[0].x, 800);                 // 40×10 ×2 séries
  proche(p.points[0].y, 40 * (1 + 10 / 30));
});
test('pairesKcalPoids : apporte kcal sem. N vs Δ poids sem. N+1', () => {
  const poids = [
    { date: '2026-01-01', kg: 80 }, { date: '2026-01-08', kg: 80.5 },
    { date: '2026-01-15', kg: 81 }, { date: '2026-01-22', kg: 81.2 },
  ];
  const journalRepas = [
    { date: '2026-01-02', kcal: 2800 }, { date: '2026-01-09', kcal: 2900 }, { date: '2026-01-16', kcal: 2600 },
  ];
  const p = pairesKcalPoids(journalRepas, poids);
  // semaines 0,1,2 ont une kcal ; Δ poids existe pour 0→1 et 1→2 et 2→3
  assert.ok(p.points.length >= 2);
  assert.equal(p.points[0].x, 2800);
  proche(p.points[0].y, 0.5);                       // 80,5 − 80
});

/* ---- orchestrateur ---- */
test('correlationsDisponibles : n\'expose que les relations ≥ MIN_POINTS, triées par |r|', () => {
  const etatsJour = [];
  for(let i = 0; i < MIN_POINTS + 1; i++) etatsJour.push({ date: `2026-02-0${i + 1}`, sommeil: 8 - i * 0.5, courbatures: i });   // sommeil↑ → courbatures↓
  const etat = { etatsJour, seances: [], journalRepas: [], poids: [] };
  const r = correlationsDisponibles(etat);
  assert.ok(r.length >= 1);
  const sc = r.find(c => c.cle === 'sommeil-courbatures');
  assert.ok(sc && sc.r < 0 && sc.n === etatsJour.length);
  assert.match(sc.insight, /plus tu dors/i);
});
test('correlationsDisponibles : données insuffisantes → tableau vide', () => {
  assert.deepEqual(correlationsDisponibles({ etatsJour: [{ sommeil: 8, courbatures: 1 }], seances: [], journalRepas: [], poids: [] }), []);
  assert.deepEqual(correlationsDisponibles({}), []);
});
