import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assainirEtat, assainirDates, serieValide, assainirSeance,
  assainirRepasPlan, assainirProgrammes, assainirJournalRepas, assainirCoursesItems,
} from '../js/sanitize.js';

/* Garde-fou sur le code défensif le plus critique (jusqu'ici non testé) :
   il ne doit JAMAIS lever et toujours renvoyer des données propres. */

test('assainirDates : ne garde que les entrées objet datées', () => {
  assert.deepEqual(assainirDates([{date:'2026-01-01',kg:80},{kg:79},null,'x']),
                   [{date:'2026-01-01',kg:80}]);
  assert.deepEqual(assainirDates('pas un tableau'), []);
});

test('serieValide : reps numérique obligatoire ; charge OU duree (null toléré)', () => {
  assert.equal(serieValide({charge:40,reps:10}), true);
  assert.equal(serieValide({charge:null,reps:10}), true);
  assert.equal(serieValide({duree:30,reps:3}), true);
  assert.equal(serieValide({duree:null,reps:3}), true);
  assert.equal(serieValide({reps:'x'}), false);
  assert.equal(serieValide({charge:40}), false);   /* reps manquant */
  assert.equal(serieValide(null), false);
});

test('assainirSeance : écarte les exercices sans série valide et les séances vides', () => {
  const ok = assainirSeance({date:'2026-01-01', exercices:[
    {nom:'Squat', series:[{charge:60,reps:5},{reps:'NaN'}]},   /* 2e série tombe */
    {nom:'Vide', series:[{reps:null}]},                        /* exercice vidé → écarté */
  ]});
  assert.equal(ok.exercices.length, 1);
  assert.equal(ok.exercices[0].series.length, 1);
  assert.equal(assainirSeance({date:'x'}), null);          /* pas d'exercices */
  assert.equal(assainirSeance({exercices:[]}), null);      /* pas de date */
  assert.equal(assainirSeance(null), null);
});

test('assainirRepasPlan : aliments connus + quantités numériques ; null si rien d\'exploitable', () => {
  assert.deepEqual(
    assainirRepasPlan([{id:'dej', items:[['riz',100],['inconnu',50],['poulet','x']]}]),
    [{id:'dej', items:[['riz',100]]}]);
  /* un repas valide (id+items) mais aux aliments tous inconnus survit avec items vide */
  assert.deepEqual(assainirRepasPlan([{id:'x', items:[['inconnu',1]]}]), [{id:'x', items:[]}]);
  /* null seulement quand AUCUN repas ne survit au filtre de forme (ici : pas d'id) */
  assert.equal(assainirRepasPlan([{items:[['riz',100]]}]), null);
  assert.equal(assainirRepasPlan('nope'), null);
});

test('assainirProgrammes : exige id + jours[] dont chaque jour a un tableau exercices', () => {
  const p = assainirProgrammes([
    {id:'a', jours:[{id:'j', exercices:[]}]},
    {id:'b'},          /* pas de jours */
    {jours:[]},        /* pas d'id */
  ]);
  assert.equal(p.length, 1);
  assert.equal(p[0].id, 'a');
});

test('assainirJournalRepas : exige date + id, items toujours tableau', () => {
  const j = assainirJournalRepas([{date:'2026-01-01', id:1}, {id:2}, {date:'x'}]);
  assert.equal(j.length, 1);
  assert.deepEqual(j[0].items, []);
});

test('assainirCoursesItems : ne garde que les objets avec id', () => {
  assert.deepEqual(assainirCoursesItems([{id:'a'}, 2, null, {nom:'sans id'}]), [{id:'a'}]);
});

test('assainirEtat : ne lève jamais et purge en place', () => {
  const etat = { poids:[{date:'2026-01-01',kg:80},'bad'], seances:'oops',
                 courses:{items:[{id:1},2]} };
  assert.doesNotThrow(() => assainirEtat(etat));
  assert.equal(etat.poids.length, 1);
  assert.deepEqual(etat.seances, []);
  assert.deepEqual(etat.courses.items, [{id:1}]);
  assert.equal(assainirEtat(null), null);
});
