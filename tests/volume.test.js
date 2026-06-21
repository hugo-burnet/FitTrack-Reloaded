import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROG_DEFAUT } from '../js/data.js';
import { groupeExercice, etatVolume, volumeParGroupe, REPERE_MIN, REPERE_MAX } from '../js/volume.js';

/* ---- groupeExercice : classement attendu sur les noms du programme par défaut ---- */
const ATTENDU = {
  'Chest press machine': 'Pectoraux',
  'Développé incliné haltères (30°)': 'Pectoraux',
  'Développé épaules haltères assis': 'Épaules',
  'Élévations latérales': 'Épaules',
  'Extension triceps poulie': 'Triceps',
  'Tirage vertical': 'Dos',
  'Rowing unilatéral buste appuyé': 'Dos',
  'Face pull': 'Épaules',
  'Curl incliné haltères': 'Biceps',
  'Curl marteau': 'Biceps',
  'Presse horizontale': 'Quadriceps',
  'Leg curl assis': 'Ischios',
  'Leg extension': 'Quadriceps',
  'Mollets assis': 'Mollets',
  'Curl-up (McGill big 3)': 'Abdos/Gainage',
  'Side plank (McGill big 3)': 'Abdos/Gainage',
  'Bird-dog (McGill big 3)': 'Abdos/Gainage',
  'Hip thrust': 'Fessiers',
  'Leg curl allongé': 'Ischios',
  'Fentes bulgares haltères': 'Quadriceps',
  'Rowing machine appui pectoral': 'Dos',   // « pectoral » dans le nom mais c'est du dos
  'Curl au choix': 'Biceps',
};
test('groupeExercice : tous les exercices du programme par défaut bien classés', () => {
  for(const [nom, g] of Object.entries(ATTENDU)) assert.equal(groupeExercice(nom), g, nom);
});
test('groupeExercice : nom inconnu → Autre', () => {
  assert.equal(groupeExercice('Truc bizarre'), 'Autre');
  assert.equal(groupeExercice(''), 'Autre');
  assert.equal(groupeExercice(null), 'Autre');
});
test('groupeExercice : aucun exercice par défaut ne tombe en « Autre »', () => {
  const noms = new Set();
  PROG_DEFAUT[0].jours.forEach(j => j.exercices.forEach(e => noms.add(e.nom)));
  const orphelins = [...noms].filter(n => groupeExercice(n) === 'Autre');
  assert.deepEqual(orphelins, []);
});

/* ---- etatVolume : bornes 10-20 ---- */
test('etatVolume : sous / ok / sur', () => {
  assert.equal(etatVolume(REPERE_MIN - 1), 'sous');
  assert.equal(etatVolume(REPERE_MIN), 'ok');
  assert.equal(etatVolume(REPERE_MAX), 'ok');
  assert.equal(etatVolume(REPERE_MAX + 1), 'sur');
});

/* ---- volumeParGroupe ---- */
const REF = '2026-06-20';
const jour = n => { const d = new Date(REF + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const exo = (nom, nSeries) => ({ nom, series: Array.from({ length: nSeries }, () => ({ charge: 50, reps: 10 })) });

test('volumeParGroupe : compte les séries par groupe sur la fenêtre, trié desc', () => {
  const seances = [
    { date: jour(-1), exercices: [exo('Chest press machine', 4), exo('Tirage vertical', 3)] },
    { date: jour(-3), exercices: [exo('Développé incliné haltères', 4)] },
  ];
  const v = volumeParGroupe(seances, REF, 7);
  assert.equal(v.total, 11);
  assert.equal(v.parGroupe[0].groupe, 'Pectoraux');   // 8 séries → en tête
  assert.equal(v.parGroupe[0].series, 8);
  assert.equal(v.parGroupe.find(g => g.groupe === 'Dos').series, 3);
});
test('volumeParGroupe : exclut les séances hors fenêtre', () => {
  const seances = [
    { date: jour(-2), exercices: [exo('Chest press machine', 5)] },
    { date: jour(-10), exercices: [exo('Chest press machine', 5)] },   // hors fenêtre 7 j
  ];
  const v = volumeParGroupe(seances, REF, 7);
  assert.equal(v.total, 5);
});
test('volumeParGroupe : ajustements = groupes principaux entraînés hors zone', () => {
  const seances = [
    { date: jour(-1), exercices: [exo('Chest press machine', 25)] },   // Pectoraux sur-dosé
    { date: jour(-2), exercices: [exo('Curl marteau', 3)] },           // Biceps sous-dosé
    { date: jour(-2), exercices: [exo('Tirage vertical', 12)] },       // Dos ok → pas d'ajustement
    { date: jour(-2), exercices: [exo('Mollets assis', 2)] },          // Mollets : pas un groupe principal
  ];
  const v = volumeParGroupe(seances, REF, 7);
  const groupes = v.ajustements.map(a => a.groupe).sort();
  assert.deepEqual(groupes, ['Biceps', 'Pectoraux']);
  assert.equal(v.ajustements.find(a => a.groupe === 'Pectoraux').etat, 'sur');
  assert.equal(v.ajustements.find(a => a.groupe === 'Biceps').etat, 'sous');
});
test('volumeParGroupe : sans refISO → toutes les séances comptées', () => {
  const seances = [{ date: '2020-01-01', exercices: [exo('Chest press machine', 4)] }];
  assert.equal(volumeParGroupe(seances, null).total, 4);
});
test('volumeParGroupe : aucune séance → vide, pas d\'ajustement', () => {
  const v = volumeParGroupe([], REF, 7);
  assert.equal(v.total, 0);
  assert.deepEqual(v.parGroupe, []);
  assert.deepEqual(v.ajustements, []);
});
