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

test('fusion : état du jour réconcilié par date, l\'entrant gagne sur collision', () => {
  const etat = etatParDefaut();
  etat.etatsJour = [{date:'2026-06-19',sommeil:7,courbatures:2},{date:'2026-06-20',sommeil:6,courbatures:5}];
  fusionnerEtat(etat, { etatsJour:[{date:'2026-06-20',sommeil:8,courbatures:1},{date:'2026-06-21',sommeil:7.5,courbatures:0}] });
  assert.deepEqual(etat.etatsJour.map(e=>[e.date,e.sommeil,e.courbatures]),
                   [['2026-06-19',7,2],['2026-06-20',8,1],['2026-06-21',7.5,0]]);
});

test('fusion : goûts alimentaires fusionnés (union, évité gagne, facilité à l\'entrant)', () => {
  const etat = etatParDefaut();
  etat.preferencesAlim = { aimes:['poulet-blanc','riz'], evites:['oeuf'], faciliteSeulement:true };
  fusionnerEtat(etat, { preferencesAlim:{ aimes:['skyr','riz'], evites:['saumon'], faciliteSeulement:false } });
  assert.deepEqual(etat.preferencesAlim.aimes.sort(), ['poulet-blanc','riz','skyr']);   /* union */
  assert.deepEqual(etat.preferencesAlim.evites.sort(), ['oeuf','saumon']);               /* union */
  assert.equal(etat.preferencesAlim.faciliteSeulement, false);                           /* entrant gagne */

  /* un aliment évité par l'entrant l'emporte sur un aimé local */
  const e2 = etatParDefaut();
  e2.preferencesAlim = { aimes:['skyr'], evites:[], faciliteSeulement:true };
  fusionnerEtat(e2, { preferencesAlim:{ aimes:[], evites:['skyr'], faciliteSeulement:true } });
  assert.deepEqual(e2.preferencesAlim.aimes, []);
  assert.deepEqual(e2.preferencesAlim.evites, ['skyr']);
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

test('fusion : objectifKcal entrant gagne s\'il est valide', () => {
  const etat = etatParDefaut();
  fusionnerEtat(etat, { objectifKcal:2000 });
  assert.equal(etat.objectifKcal, 2000);
});

test('fusion : menus (plansAlim) réconciliés par id, l\'entrant gagne', () => {
  const etat = etatParDefaut();   /* contient { id:'principal', … } */
  fusionnerEtat(etat, { plansAlim:[
    { id:'principal', nom:'Principal v2', repas:[{id:'dej', items:[['riz',120]]}] },  /* remplace */
    { id:'seche', nom:'Sèche', repas:[{id:'dej', items:[['poulet',200]]}] },          /* ajoute */
  ], planAlimActif:'seche' });
  assert.equal(etat.plansAlim.length, 2);
  assert.equal(etat.plansAlim.find(p=>p.id==='principal').nom, 'Principal v2');
  assert.equal(etat.planAlimActif, 'seche');
});

test('fusion : export legacy (plan unique) met à jour les repas du menu actif', () => {
  const etat = etatParDefaut();
  const avant = etat.plansAlim.length;
  fusionnerEtat(etat, { plan:[{id:'dej', items:[['riz',120]]}] });
  assert.equal(etat.plansAlim.length, avant);   /* pas de nouveau menu */
  const actif = etat.plansAlim.find(p=>p.id===etat.planAlimActif);
  assert.deepEqual(actif.repas, [{id:'dej', items:[['riz',120]]}]);
});

test('fusion : plats composés réconciliés par id, l\'entrant gagne', () => {
  const etat = etatParDefaut();
  etat.plats = [{ id:'bowl', nom:'Bowl', composants:[['poulet',150]] }];
  fusionnerEtat(etat, { plats:[
    { id:'bowl', nom:'Bowl v2', composants:[['poulet',200]] },   /* remplace */
    { id:'shake', nom:'Shake', composants:[['whey',1]] },        /* ajoute */
  ]});
  assert.equal(etat.plats.length, 2);
  assert.equal(etat.plats.find(p=>p.id==='bowl').nom, 'Bowl v2');
});

test('fusion : aliments perso réconciliés par clé, l\'entrant gagne', () => {
  const etat = etatParDefaut();
  etat.aliments.perso = { a:{ nom:'A', cat:'Fruits', kcal100:50 } };
  fusionnerEtat(etat, { aliments:{ perso:{
    a:{ nom:'A modifié', cat:'Fruits', kcal100:60 },   /* remplace */
    b:{ nom:'B', cat:'Sucré', kcal100:400 },           /* ajoute */
  } } });
  assert.equal(etat.aliments.perso.a.nom, 'A modifié');
  assert.equal(etat.aliments.perso.b.kcal100, 400);
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
