import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serieE1rm, regressionLineaire, projeterExercice, etaObjectif } from '../js/projection.js';

const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

/* ---- regressionLineaire ---- */
test('regressionLineaire : droite parfaite → pente exacte, r²=1, erreur-type nulle', () => {
  const r = regressionLineaire([{x:0,y:0},{x:1,y:2},{x:2,y:4},{x:3,y:6}]);
  proche(r.pente, 2); proche(r.ordonnee, 0); proche(r.r2, 1); proche(r.sePente, 0);
  assert.equal(r.n, 4);
});
test('regressionLineaire : nuage bruité → r² < 1, erreur-type > 0', () => {
  const r = regressionLineaire([{x:0,y:0},{x:1,y:3},{x:2,y:2},{x:3,y:7}]);
  assert.ok(r.pente > 0);
  assert.ok(r.r2 < 1 && r.r2 >= 0);
  assert.ok(r.sePente > 0);
});
test('regressionLineaire : < 2 points ou x constant → null', () => {
  assert.equal(regressionLineaire([{x:1,y:1}]), null);
  assert.equal(regressionLineaire([{x:2,y:1},{x:2,y:5}]), null);
});

/* ---- serieE1rm ---- */
const seances = [
  { date:'2026-05-04', jourId:'push', exercices:[{ nom:'Couché', series:[{charge:40,reps:10}] }] },
  { date:'2026-05-11', jourId:'push', exercices:[{ nom:'Couché', series:[{charge:42,reps:10}] }] },
  { date:'2026-05-18', jourId:'push', exercices:[{ nom:'Couché', series:[{charge:44,reps:10}] }] },
  { date:'2026-05-25', jourId:'push', exercices:[{ nom:'Couché', series:[{charge:46,reps:10}] }] },
];

test('serieE1rm : un point par séance, trié, meilleur e1RM', () => {
  const pts = serieE1rm(seances, 'Couché');
  assert.equal(pts.length, 4);
  assert.equal(pts[0].date, '2026-05-04');
  proche(pts[0].e1rm, 40 * (1 + 10/30));   // 53.333…
  assert.ok(pts[3].e1rm > pts[0].e1rm);
});
test('serieE1rm : deux séances le même jour → garde la meilleure', () => {
  const s = [
    { date:'2026-05-04', exercices:[{ nom:'X', series:[{charge:40,reps:10}] }] },
    { date:'2026-05-04', exercices:[{ nom:'X', series:[{charge:50,reps:10}] }] },
  ];
  const pts = serieE1rm(s, 'X');
  assert.equal(pts.length, 1);
  proche(pts[0].e1rm, 50 * (1 + 10/30));
});
test('serieE1rm : exercice absent → vide', () => {
  assert.deepEqual(serieE1rm(seances, 'Inconnu'), []);
});

/* ---- projeterExercice ---- */
test('projeterExercice : progression régulière → pente kg/sem > 0, fiable', () => {
  const p = projeterExercice(seances, 'Couché');
  assert.equal(p.fiable, true);
  assert.equal(p.nbPoints, 4);
  // +2 kg de charge/semaine × facteur 4/3 ≈ 2,667 kg e1RM/semaine
  proche(p.pente, 2 * (1 + 10/30), 1e-6);
  proche(p.r2, 1, 1e-9);
  assert.equal(p.confiance, 'fiable');
});
test('projeterExercice : < 2 points → non fiable, pente null', () => {
  const p = projeterExercice([seances[0]], 'Couché');
  assert.equal(p.fiable, false);
  assert.equal(p.pente, null);
  assert.ok(p.e1rmActuel > 0);
});
test('projeterExercice : fenêtre exclut les points trop anciens', () => {
  // refISO juste après la dernière séance, fenêtre 10 j → ne garde que les 2 dernières
  const p = projeterExercice(seances, 'Couché', '2026-05-26', 10);
  assert.equal(p.nbPoints, 2);
});

/* ---- etaObjectif ---- */
test('etaObjectif : pente positive → ETA = gain / pente, bande resserrée si pente nette', () => {
  const p = projeterExercice(seances, 'Couché');
  const eta = etaObjectif(p, 8);             // +8 kg d'e1RM
  proche(eta.semaines, 8 / p.pente, 1e-6);   // ≈ 3 semaines
  assert.equal(eta.tendance, 'hausse');
  // ajustement parfait (sePente=0) → bande = point
  proche(eta.min, eta.semaines, 1e-6);
  proche(eta.max, eta.semaines, 1e-6);
});
test('etaObjectif : pente nulle/négative → pas d\'ETA (tendance plat)', () => {
  assert.equal(etaObjectif({ pente: 0, sePente: 0 }, 5).semaines, null);
  assert.equal(etaObjectif({ pente: -1, sePente: 0 }, 5).tendance, 'plat');
});
test('etaObjectif : gain ≤ 0 ou projection absente → null', () => {
  assert.equal(etaObjectif({ pente: 2, sePente: 0 }, 0).semaines, null);
  assert.equal(etaObjectif(null, 5).semaines, null);
});
test('etaObjectif : pente bruitée → bande [min < semaines < max]', () => {
  const eta = etaObjectif({ pente: 2, sePente: 0.5 }, 10);   // 10/2 = 5 sem
  proche(eta.semaines, 5);
  assert.ok(eta.min < 5);          // pente optimiste 2,5 → 4 sem
  assert.ok(eta.max > 5);          // pente pessimiste 1,5 → 6,67 sem
});
