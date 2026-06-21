import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dernierePerf, perfPrecedente, historiqueExo, tousLesExos, fmtPerf,
  brouillonDerniere, permuterExo, construireRecap, serieProgression,
} from '../js/muscu-perf.js';

/* historique : 3 séances, le développé couché présent dans 2, gainage dans 1 */
const seances = [
  { date:'2026-06-01', jourId:'push', jourNom:'Push', exercices:[
    { nom:'Couché', series:[{charge:40,reps:10},{charge:40,reps:9}], unilateral:false },
  ]},
  { date:'2026-06-08', jourId:'push', jourNom:'Push', exercices:[
    { nom:'Couché', series:[{charge:42,reps:10},{charge:42,reps:9}], unilateral:false },
    { nom:'Gainage', series:[{duree:30,reps:3}], gainage:true },
  ]},
  { date:'2026-06-15', jourId:'pull', jourNom:'Pull', exercices:[
    { nom:'Rowing', series:[{charge:30,reps:12}], unilateral:true },
  ]},
];

test('dernierePerf : la plus récente occurrence par nom', () => {
  const p = dernierePerf(seances, 'Couché');
  assert.equal(p.date, '2026-06-08');
  assert.equal(p.series[0].charge, 42);
  assert.equal(dernierePerf(seances, 'Inconnu'), null);
});

test('perfPrecedente : occurrence strictement avant la date', () => {
  const p = perfPrecedente(seances, '2026-06-08', 'Couché');
  assert.equal(p.series[0].charge, 40);            // la séance du 01, pas celle du 08
  assert.equal(perfPrecedente(seances, '2026-06-01', 'Couché'), null);
});

test('historiqueExo : n dernières, plus récente en premier', () => {
  const h = historiqueExo(seances, 'Couché', 3);
  assert.equal(h.length, 2);
  assert.equal(h[0].date, '2026-06-08');
  assert.equal(h[1].date, '2026-06-01');
  assert.equal(historiqueExo(seances, 'Couché', 1).length, 1);
});

test('tousLesExos : union programmes+séances, triée (fr)', () => {
  const programmes = [{ jours:[{ exercices:[{ nom:'Squat' }, { nom:'Couché' }] }] }];
  const noms = tousLesExos(programmes, seances);
  assert.deepEqual(noms, ['Couché', 'Gainage', 'Rowing', 'Squat']);
});

/* ---- fmtPerf ---- */
test('fmtPerf : charges égales → forme compacte', () => {
  assert.equal(fmtPerf([{charge:40,reps:10},{charge:40,reps:8}], false), '40 kg · 10/8');
});
test('fmtPerf : charges variables → détail série par série', () => {
  assert.equal(fmtPerf([{charge:40,reps:10},{charge:38,reps:9}], false), '40×10 · 38×9');
});
test('fmtPerf : unilatéral ajoute /côté', () => {
  assert.equal(fmtPerf([{charge:30,reps:12},{charge:30,reps:12}], true), '30 kg/côté · 12/12');
});
test('fmtPerf : gainage → temps + reps', () => {
  assert.equal(fmtPerf([{duree:30,reps:3}], false), '30 s · 3');
});
test('fmtPerf : séries vides → chaîne vide', () => {
  assert.equal(fmtPerf([], false), '');
  assert.equal(fmtPerf(null, false), '');
});

/* ---- brouillonDerniere ---- */
test('brouillonDerniere : recopie la dernière perf en chaînes, par exercice', () => {
  const jour = { id:'push', exercices:[{ nom:'Couché' }, { nom:'Jamais fait' }] };
  const d = brouillonDerniere(seances, jour, '2026-06-22');
  assert.equal(d.date, '2026-06-22');
  assert.deepEqual(d.blocs[0], [{charge:'42',reps:'10'},{charge:'42',reps:'9'}]);
  assert.deepEqual(d.blocs[1], []);                // pas d'historique
  assert.equal(d.unis[0], false);
});
test('brouillonDerniere : gainage → temps dans le champ charge', () => {
  const jour = { id:'p', exercices:[{ nom:'Gainage', gainage:true }] };
  const d = brouillonDerniere(seances, jour, '2026-06-22');
  assert.deepEqual(d.blocs[0], [{charge:'30',reps:'3'}]);
});

/* ---- permuterExo ---- */
test('permuterExo : échange exos et tableaux du brouillon en phase', () => {
  const exos = [{nom:'A'},{nom:'B'},{nom:'C'}];
  const draft = { blocs:[['a'],['b'],['c']], unis:[true,false,true] };
  assert.equal(permuterExo(exos, draft, 0, +1), true);
  assert.deepEqual(exos.map(e=>e.nom), ['B','A','C']);
  assert.deepEqual(draft.blocs, [['b'],['a'],['c']]);
  assert.deepEqual(draft.unis, [false,true,true]);
});
test('permuterExo : hors limites → false, rien ne bouge', () => {
  const exos = [{nom:'A'},{nom:'B'}];
  assert.equal(permuterExo(exos, null, 0, -1), false);
  assert.equal(permuterExo(exos, null, 1, +1), false);
  assert.deepEqual(exos.map(e=>e.nom), ['A','B']);
});

/* ---- construireRecap ---- */
test('construireRecap : exo en progrès → ton up et XP gagné', () => {
  // séance du 08 (Couché 42 vs 40 le 01) : 1RM en hausse
  const r = construireRecap(seances, '2026-06-08', { id:'push', nom:'Push' },
    [{ nom:'Couché', series:[{charge:42,reps:10},{charge:42,reps:9}], unilateral:false }]);
  const l = r.lignes[0];
  assert.equal(l.statut, 'compare');
  assert.equal(l.ton, 'up');
  assert.ok(l.dE1 > 0);
  assert.equal(r.monte, 1);
  assert.equal(r.baisse, 0);
  assert.ok(r.xpGagne > 0);
  assert.equal(r.total, 1);
});
test('construireRecap : exercice jamais fait → statut nouveau', () => {
  const r = construireRecap(seances, '2026-06-20', { id:'x', nom:'X' },
    [{ nom:'Tout neuf', series:[{charge:20,reps:10}], unilateral:false }]);
  assert.equal(r.lignes[0].statut, 'nouveau');
});

/* ---- serieProgression ---- */
test('serieProgression : points triés par date avec tendance', () => {
  const s = serieProgression(seances, 'Couché');
  assert.equal(s.estGainage, false);
  assert.equal(s.pts.length, 2);
  assert.equal(s.pts[0].date, '2026-06-01');
  assert.equal(s.pts[0].tendance, 'none');   // premier point
  assert.equal(s.pts[1].tendance, 'up');     // 42 > 40
  assert.equal(s.labelMesure, '1RM estimé (kg)');
});
test('serieProgression : gainage → mesure = temps, volume doublé si unilatéral', () => {
  const s = serieProgression(seances, 'Gainage');
  assert.equal(s.estGainage, true);
  assert.equal(s.pts[0].e1rm, 30);           // meilleur temps
  assert.equal(s.labelVol, 'Temps sous tension (s·reps)');
});
