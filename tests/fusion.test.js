import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionnerEtat } from '../js/fusion.js';
import { jourLocal } from '../js/utils.js';
import { etatParDefaut } from '../js/defaults.js';

/* fusion.js est partagé par l'import manuel ET la synchro : un bug y corrompt
   silencieusement les données. Ces tests verrouillent le comportement actuel
   (réconciliation par date/id, l'entrant gagne) sans rien y modifier. */

test('fusion : pesées réconciliées par date, l\'entrant gagne sur collision', () => {
  const etat = etatParDefaut();
  etat.poids = [{date:'2026-01-01',kg:80},{date:'2026-01-02',kg:79}];
  fusionnerEtat(etat, { poids:[{date:'2026-01-02',kg:78},{date:'2026-01-03',kg:77}] });
  assert.deepEqual(etat.poids.map(p=>[p.date,p.kg]),
                   [['2026-01-01',80],['2026-01-02',78],['2026-01-03',77]]);
});

test('fusion : séances par date+jourId (remplace l\'existant, ajoute les nouvelles)', () => {
  const etat = etatParDefaut();
  etat.seances = [{date:'2026-01-01', jourId:'push', exercices:[{nom:'A',series:[{charge:1,reps:1}]}]}];
  fusionnerEtat(etat, { seances:[
    {date:'2026-01-01', jourId:'push', exercices:[{nom:'A',series:[{charge:2,reps:2}]}]},
    {date:'2026-01-01', jourId:'pull', exercices:[{nom:'B',series:[{charge:3,reps:3}]}]},
  ]});
  assert.equal(etat.seances.length, 2);
  assert.equal(etat.seances.find(s=>s.jourId==='push').exercices[0].series[0].charge, 2);
});

test('fusion : articles de courses par id + cases cochées en OU', () => {
  const etat = etatParDefaut();
  etat.courses.items = [{id:'a',nom:'A',cat:'X'}];
  etat.courses.coches = {a:true};
  fusionnerEtat(etat, { courses:{ items:[{id:'a',nom:'A2',cat:'X'},{id:'b',nom:'B',cat:'X'}], coches:{b:true} } });
  assert.equal(etat.courses.items.length, 2);
  assert.equal(etat.courses.items.find(i=>i.id==='a').nom, 'A2');
  assert.deepEqual(etat.courses.coches, {a:true,b:true});
});

test('fusion : repas du jour coché sur un appareil reste coché (OU)', () => {
  const etat = etatParDefaut();
  const j = jourLocal();
  etat.repas = { jour:j, coches:{dej:true} };
  fusionnerEtat(etat, { repas:{ jour:j, coches:{diner:true} } });
  assert.deepEqual(etat.repas.coches, {dej:true, diner:true});
});

test('fusion : objectifKcal et plan entrants gagnent s\'ils sont valides', () => {
  const etat = etatParDefaut();
  fusionnerEtat(etat, { objectifKcal:2000, plan:[{id:'dej', items:[['riz',120]]}] });
  assert.equal(etat.objectifKcal, 2000);
  assert.deepEqual(etat.plan, [{id:'dej', items:[['riz',120]]}]);
});

test('fusion : journal des repas par date+id', () => {
  const etat = etatParDefaut();
  etat.journalRepas = [{date:'2026-01-01', id:'r1', kcal:100, items:[]}];
  fusionnerEtat(etat, { journalRepas:[
    {date:'2026-01-01', id:'r1', kcal:150, items:[]},   /* remplace */
    {date:'2026-01-01', id:'r2', kcal:200, items:[]},   /* ajoute */
  ]});
  assert.equal(etat.journalRepas.length, 2);
  assert.equal(etat.journalRepas.find(e=>e.id==='r1').kcal, 150);
});

test('fusion : une entrée malformée ne casse rien et ne lève pas', () => {
  const etat = etatParDefaut();
  assert.doesNotThrow(() => fusionnerEtat(etat, null));
  assert.doesNotThrow(() => fusionnerEtat(etat, { poids:'pas un tableau', seances:42 }));
  assert.ok(Array.isArray(etat.poids));
  assert.ok(Array.isArray(etat.seances));
});
