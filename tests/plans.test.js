import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuActif, repasActifs } from '../js/plans.js';
import { etatParDefaut } from '../js/defaults.js';

/* Multi-menus (E1) : helpers purs qui résolvent le menu courant et ses repas. */

test('menuActif : renvoie le menu dont l\'id == planAlimActif', () => {
  const etat = { plansAlim:[{id:'a', nom:'A', repas:[]}, {id:'b', nom:'B', repas:[]}], planAlimActif:'b' };
  assert.equal(menuActif(etat).id, 'b');
});

test('menuActif : repli sur le premier menu si l\'id actif est inconnu', () => {
  const etat = { plansAlim:[{id:'a', nom:'A', repas:[]}], planAlimActif:'inconnu' };
  assert.equal(menuActif(etat).id, 'a');
});

test('menuActif : null si collection vide ou état non conforme', () => {
  assert.equal(menuActif({ plansAlim:[] }), null);
  assert.equal(menuActif({}), null);
  assert.equal(menuActif(null), null);
});

test('repasActifs : repas du menu courant, tableau vide si rien', () => {
  const etat = etatParDefaut();
  assert.ok(Array.isArray(repasActifs(etat)) && repasActifs(etat).length);
  assert.deepEqual(repasActifs({ plansAlim:[] }), []);
  assert.deepEqual(repasActifs(null), []);
});

test('repasActifs : suit le menu actif', () => {
  const etat = { planAlimActif:'b', plansAlim:[
    {id:'a', nom:'A', repas:[{id:'dej', items:[['riz',100]]}]},
    {id:'b', nom:'B', repas:[{id:'dej', items:[['poulet',200]]}]},
  ]};
  assert.deepEqual(repasActifs(etat), [{id:'dej', items:[['poulet',200]]}]);
});
