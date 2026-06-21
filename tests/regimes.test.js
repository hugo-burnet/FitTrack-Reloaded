import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTS } from '../js/data.js';
import { POOL_GENERATEUR } from '../js/data/generateur-pool.js';
import { REGIMES, REGIMES_CLES, violationsAliment, satisfaitRegimes } from '../js/regimes.js';

const viol = cle => [...violationsAliment(cle)].sort();

test('violationsAliment : viande → exclue de végétarien et végan', () => {
  assert.deepEqual(viol('poulet'), ['vegan', 'vegetarien']);
  assert.deepEqual(viol('boeuf-hache-5'), ['vegan', 'vegetarien']);
});
test('violationsAliment : poisson → végétarien, végan, sans-poisson', () => {
  assert.deepEqual(viol('saumon'), ['sans-poisson', 'vegan', 'vegetarien']);
  assert.deepEqual(viol('crevette'), ['sans-poisson', 'vegan', 'vegetarien']);
});
test('violationsAliment : laitage → végan + sans-lactose (pas végétarien)', () => {
  assert.deepEqual(viol('skyr'), ['sans-lactose', 'vegan']);
  assert.deepEqual(viol('whey'), ['sans-lactose', 'vegan']);   // poudre laitière hors catégorie
});
test('violationsAliment : œuf → végan + sans-oeuf, mais pas sans-lactose', () => {
  assert.deepEqual(viol('oeuf'), ['sans-oeuf', 'vegan']);
  assert.ok(!violationsAliment('oeuf').has('sans-lactose'));
});
test('violationsAliment : fruits à coque vs graines', () => {
  assert.ok(violationsAliment('amandes').has('sans-fruits-coque'));
  assert.ok(violationsAliment('pb').has('sans-fruits-coque'));         // cacahuète = allergène
  assert.ok(!violationsAliment('graine-chia').has('sans-fruits-coque')); // graine ≠ fruit à coque
});
test('violationsAliment : gluten et soja', () => {
  assert.ok(violationsAliment('pain-complet').has('sans-gluten'));
  assert.ok(violationsAliment('avoine').has('sans-gluten'));
  assert.ok(!violationsAliment('riz').has('sans-gluten'));
  assert.ok(violationsAliment('tofu-ferme').has('sans-soja'));
  assert.ok(violationsAliment('edamame').has('sans-soja'));
});
test('violationsAliment : aliment neutre (riz) ne viole rien ; inconnu → vide', () => {
  assert.deepEqual(viol('riz'), []);
  assert.deepEqual(viol('inconnu-xyz'), []);
});
test('violationsAliment : miel exclu du végan seulement', () => {
  assert.deepEqual(viol('miel'), ['vegan']);
});

test('satisfaitRegimes : sans régime → tout passe', () => {
  assert.equal(satisfaitRegimes('poulet', []), true);
  assert.equal(satisfaitRegimes('poulet', null), true);
});
test('satisfaitRegimes : combinaison de contraintes', () => {
  assert.equal(satisfaitRegimes('skyr', ['vegetarien']), true);    // laitage OK en végétarien
  assert.equal(satisfaitRegimes('skyr', ['vegan']), false);
  assert.equal(satisfaitRegimes('riz', ['vegan', 'sans-gluten', 'sans-fruits-coque']), true);
  assert.equal(satisfaitRegimes('pain-complet', ['sans-gluten']), false);
});

/* le pool garde des options sur chaque rôle pour les régimes courants → menus réalisables */
test('pool : végan laisse au moins une protéine, un glucide, un lipide et une fibre', () => {
  for(const role of ['prot', 'gluc', 'lip', 'fibre']){
    const n = POOL_GENERATEUR.filter(e => e.role === role && satisfaitRegimes(e.cle, ['vegan'], ALIMENTS)).length;
    assert.ok(n >= 1, `aucun aliment ${role} végan dans le pool`);
  }
});
test('REGIMES_CLES : 8 régimes, clés uniques', () => {
  assert.equal(REGIMES.length, 8);
  assert.equal(new Set(REGIMES_CLES).size, 8);
});
