import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chargeInterneSeance, fitnessFatigue,
  noteSommeil, noteCourbatures, noteForme, noteAcwrReadiness, noteDelai, noteFatigue,
  scoreReadiness, scoreRecovery, scoreProgression,
  etatJourPour, delaiDerniereSeance, readinessDuJour, recoveryDuJour, recoContextuelle,
} from '../js/readiness.js';

/* helpers : dates + séances de tonnage contrôlé */
const REF = '2026-06-20';
const jour = (n, ref = REF) => { const d = new Date(ref + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const seance = (date, charge, extra = {}) => ({ date, jourId: 'j', exercices: [{ nom: 'X', series: [{ charge, reps: 1 }] }], ...extra });
/* séance d'un exo donné avec une charge/reps précise (pour les e1RM/PR) */
const seanceExo = (date, nom, charge, reps = 5) => ({ date, jourId: 'j', exercices: [{ nom, series: [{ charge, reps }] }] });

/* ---- charge interne sRPE (Foster) ---- */
test('chargeInterneSeance : RPE × durée, null si effort non capté', () => {
  assert.equal(chargeInterneSeance({ rpe: 8, duree: 55 }), 440);
  assert.equal(chargeInterneSeance({ rpe: 8 }), null);
  assert.equal(chargeInterneSeance({ duree: 55 }), null);
  assert.equal(chargeInterneSeance({ rpe: 8, duree: 0 }), null);
  assert.equal(chargeInterneSeance(null), null);
});

/* ---- fitness-fatigue (réutilise les EWMA de charge.js) ---- */
test('fitnessFatigue : forme = fitness − fatigue (≈ 0 sur charge stable au long cours)', () => {
  const seances = [];
  for(let i = 59; i >= 0; i--) seances.push(seance(jour(-i), 100));
  const ff = fitnessFatigue(seances, REF);
  assert.ok(ff.fitness > 0 && ff.fatigue > 0);
  assert.ok(Math.abs(ff.forme) < 0.05 * ff.fitness, 'charge stable → forme proche de 0');
});

test('fitnessFatigue : pic récent → fatigue > fitness → forme négatif (surmenage)', () => {
  const seances = [];
  for(let i = 59; i >= 14; i--) seances.push(seance(jour(-i), 100));   /* base */
  for(let i = 13; i >= 0; i--) seances.push(seance(jour(-i), 400));    /* pic récent */
  const ff = fitnessFatigue(seances, REF);
  assert.ok(ff.fatigue > ff.fitness && ff.forme < 0);
});

/* ---- notes élémentaires : monotones, bornées, null si absent ---- */
test('notes élémentaires : bornes et sens de variation', () => {
  assert.equal(noteSommeil(8), 1); assert.equal(noteSommeil(4), 0); assert.equal(noteSommeil(6), 0.5);
  assert.equal(noteSommeil(10), 1); assert.equal(noteSommeil(null), null);
  assert.equal(noteCourbatures(0), 1); assert.equal(noteCourbatures(10), 0); assert.equal(noteCourbatures(null), null);
  assert.equal(noteForme(0, 100), 0.5); assert.equal(noteForme(25, 100), 1); assert.equal(noteForme(-25, 100), 0);
  assert.equal(noteForme(5, 0), null); assert.equal(noteForme(null, 100), null);
  assert.equal(noteAcwrReadiness(1.0), 1); assert.equal(noteAcwrReadiness(1.4), 0.6); assert.equal(noteAcwrReadiness(1.6), 0.2);
  assert.equal(noteAcwrReadiness(null), null);
  assert.ok(noteDelai(0) < noteDelai(2)); assert.equal(noteDelai(3), 1); assert.equal(noteDelai(-1), null);
  assert.ok(noteFatigue(70, 100) > noteFatigue(150, 100)); assert.equal(noteFatigue(70, 0), null);
});

/* ---- readiness ---- */
test('scoreReadiness : indisponible sans entrées', () => {
  const r = scoreReadiness({});
  assert.equal(r.score, null); assert.equal(r.feu, 'inconnu'); assert.equal(r.confiance, 'indisponible');
});

test('scoreReadiness : bonnes conditions → feu vert fiable ; mauvaises → rouge', () => {
  const bon = scoreReadiness({ sommeil: 8, courbatures: 1, forme: 5, fitness: 100, acwr: 1.0, delaiSollicitation: 2 });
  assert.ok(bon.score >= 70 && bon.feu === 'vert' && bon.confiance === 'fiable');
  const mauvais = scoreReadiness({ sommeil: 4.5, courbatures: 8, forme: -30, fitness: 100, acwr: 1.6, delaiSollicitation: 0 });
  assert.ok(mauvais.score < 45 && mauvais.feu === 'rouge');
});

test('scoreReadiness : sommeil seul → indicatif (pas fiable)', () => {
  const r = scoreReadiness({ sommeil: 8 });
  assert.ok(r.score != null && r.confiance === 'indicatif');
});

/* ---- recovery ---- */
test('scoreRecovery : récupéré vs fatigué', () => {
  const ok = scoreRecovery({ sommeil: 8, courbatures: 1, delaiDerniereSeance: 3, fatigue: 70, fitness: 100 });
  assert.ok(ok.score >= 70 && ok.niveau === 'récupéré' && ok.confiance === 'fiable');
  const ko = scoreRecovery({ sommeil: 5, courbatures: 9, delaiDerniereSeance: 0, fatigue: 160, fitness: 100 });
  assert.ok(ko.score < 45 && ko.niveau === 'fatigué');
  assert.equal(scoreRecovery({}).score, null);
});

/* ---- progression ---- */
test('scoreProgression : exos en hausse + PR → progresse', () => {
  const seances = [];
  for(let i = 0; i < 6; i++) seances.push(seanceExo(jour(-30 + i * 5), 'Squat', 60 + i * 5, 5));   /* charge croissante */
  const p = scoreProgression(seances, REF);
  assert.ok(p.score >= 60 && p.niveau === 'progresse');
  assert.ok(p.prs >= 1);
});

test('scoreProgression : charge plate → stagne ou régresse', () => {
  const seances = [];
  for(let i = 0; i < 6; i++) seances.push(seanceExo(jour(-30 + i * 5), 'Squat', 60, 5));   /* aucune progression */
  const p = scoreProgression(seances, REF);
  assert.ok(p.niveau !== 'progresse');
  assert.equal(p.prs, 0);
});

test('scoreProgression : indisponible sans historique exploitable', () => {
  assert.equal(scoreProgression([], REF).score, null);
});

/* ---- orchestrateurs (lisent l'état) ---- */
test('etatJourPour : dernière entrée ≤ refISO', () => {
  const ej = [{ date: jour(-3) }, { date: jour(-1) }, { date: jour(2) }];
  assert.equal(etatJourPour(ej, REF).date, jour(-1));
  assert.equal(etatJourPour([], REF), null);
});

test('delaiDerniereSeance : jours depuis la dernière séance', () => {
  assert.equal(delaiDerniereSeance([seance(jour(-2), 100)], REF), 2);
  assert.equal(delaiDerniereSeance([], REF), null);
});

test('readinessDuJour : combine état du jour (frais) + charge ; périmé ignoré', () => {
  const seances = []; for(let i = 30; i >= 1; i--) seances.push(seance(jour(-i), 100));
  const etat = { seances, etatsJour: [{ date: REF, sommeil: 8, courbatures: 1 }] };
  const r = readinessDuJour(etat, REF);
  assert.ok(r.score != null && r.confiance === 'fiable');
  /* état du jour périmé (hier) → courbatures/sommeil non comptés → dégradé en indicatif */
  const perime = { seances, etatsJour: [{ date: jour(-1), sommeil: 8, courbatures: 1 }] };
  assert.equal(readinessDuJour(perime, REF).confiance, 'indicatif');
});

test('recoveryDuJour : sans aucune donnée → indisponible, ne lève pas', () => {
  assert.doesNotThrow(() => recoveryDuJour({}, REF));
  assert.equal(recoveryDuJour({ seances: [], etatsJour: [] }, REF).score, null);
});

/* ---- recoContextuelle (D.4) : tempère selon le feu readiness ---- */
test('recoContextuelle : jour rouge + monter → ne pas monter, ton neutralisé, note', () => {
  const r = recoContextuelle({ statut: 'monter', ton: 'up', message: 'Level up !' }, 'rouge');
  assert.equal(r.tempere, true);
  assert.equal(r.ton, 'neutre');
  assert.match(r.noteReadiness, /rouge/i);
  assert.equal(r.message, 'Level up !');   // info d'origine conservée
});
test('recoContextuelle : jour orange + monter → prudence (tempéré, ton conservé)', () => {
  const r = recoContextuelle({ statut: 'monter', ton: 'up' }, 'orange');
  assert.equal(r.tempere, true);
  assert.equal(r.ton, 'up');
  assert.match(r.noteReadiness, /orange/i);
});
test('recoContextuelle : jour vert + monter → encouragement, pas tempéré', () => {
  const r = recoContextuelle({ statut: 'monter', ton: 'up' }, 'vert');
  assert.equal(r.tempere, false);
  assert.match(r.noteReadiness, /vert/i);
});
test('recoContextuelle : reco non-monter un jour rouge → note prudence, pas tempéré', () => {
  const r = recoContextuelle({ statut: 'reps', ton: 'neutre' }, 'rouge');
  assert.equal(r.tempere, false);
  assert.match(r.noteReadiness, /réserve|qualité/i);
});
test('recoContextuelle : feu inconnu/null → reco inchangée (note nulle)', () => {
  const r = recoContextuelle({ statut: 'monter', ton: 'up' }, 'inconnu');
  assert.equal(r.tempere, false);
  assert.equal(r.noteReadiness, null);
});
