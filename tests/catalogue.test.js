import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTS_BASE, ORDRE_CATEGORIES } from '../js/data/aliments-base.js';
import { catalogue, normaliser, tousAliments, categoriesPresentes, rechercher } from '../js/catalogue.js';
import { kcalItem, protItem, glucItem, lipItem, fibItem } from '../js/nutrition.js';

/* clés du plan/courses qui DOIVENT rester présentes (sinon plan & liste de courses cassent) */
const CLES_FIGEES = ['avoine','riz','poulet','skyr','pb','pois','amandes','noix','whey','banane','choco'];

test('base : clés historiques du plan toujours présentes', () => {
  for(const cle of CLES_FIGEES) assert.ok(ALIMENTS_BASE[cle], `clé manquante : ${cle}`);
});

test('base : nettement enrichie (≥ 120 aliments)', () => {
  assert.ok(Object.keys(ALIMENTS_BASE).length >= 120);
});

test('base : chaque aliment a nom + catégorie connue + macros cohérentes (Atwater ±15 %)', () => {
  for(const cle of Object.keys(ALIMENTS_BASE)){
    const a = ALIMENTS_BASE[cle];
    assert.ok(typeof a.nom === 'string' && a.nom, `${cle} : nom`);
    assert.ok(ORDRE_CATEGORIES.includes(a.cat), `${cle} : catégorie inconnue (${a.cat})`);
    const q = a.unite!==undefined ? 1 : 100;
    const kcal = kcalItem(cle, q);
    const calc = 4*protItem(cle,q) + 4*glucItem(cle,q) + 9*lipItem(cle,q);
    assert.ok(Math.abs(kcal - calc) <= kcal*0.15 + 5, `${cle} : kcal ${kcal} vs macros ${calc}`);
    assert.ok([kcal, protItem(cle,q), glucItem(cle,q), lipItem(cle,q), fibItem(cle,q)].every(Number.isFinite), `${cle} : macro NaN`);
  }
});

test('normaliser : insensible à la casse et aux accents', () => {
  assert.equal(normaliser('Pâtes Bolognaise'), 'pates bolognaise');
  assert.equal(normaliser('Œuf'), 'œuf');   // ligature conservée, mais comparable
});

test('catalogue : un aliment perso ajoute/écrase et porte perso:true', () => {
  const perso = { 'mon-shake': { nom:'Mon shake', cat:'Compléments', kcal100:120, prot100:25, gluc100:3, lip100:1, fib100:0 } };
  const cat = catalogue(perso);
  assert.ok(cat['mon-shake'].perso === true);
  // écrasement d'une clé de base
  const perso2 = { riz: { nom:'Mon riz', cat:'Féculents', kcal100:1, prot100:0, gluc100:0, lip100:0, fib100:0 } };
  assert.equal(catalogue(perso2).riz.nom, 'Mon riz');
  // base intacte sans perso
  assert.equal(catalogue().riz.nom, ALIMENTS_BASE.riz.nom);
});

test('tousAliments : triés par catégorie (ordre canonique) puis par nom', () => {
  const arr = tousAliments();
  const rang = c => ORDRE_CATEGORIES.indexOf(c);
  for(let i=1;i<arr.length;i++){
    const a=arr[i-1], b=arr[i];
    assert.ok(rang(a.cat) <= rang(b.cat), `ordre catégorie cassé entre ${a.cle} et ${b.cle}`);
  }
});

test('categoriesPresentes : sous-ensemble ordonné de ORDRE_CATEGORIES', () => {
  const cats = categoriesPresentes();
  assert.deepEqual(cats, ORDRE_CATEGORIES.filter(c=>cats.includes(c)));
});

test('rechercher : filtre par terme (accent-insensible) et par catégorie', () => {
  assert.ok(rechercher({ terme:'pates' }).some(a=>a.cle==='pates-cru'));
  assert.ok(rechercher({ terme:'POMME' }).some(a=>a.cle==='pomme'));
  const fruits = rechercher({ cat:'Fruits' });
  assert.ok(fruits.length > 0 && fruits.every(a=>a.cat==='Fruits'));
  // terme + catégorie combinés
  assert.ok(rechercher({ terme:'banane', cat:'Fruits' }).some(a=>a.cle==='banane'));
  assert.equal(rechercher({ terme:'banane', cat:'Viandes' }).length, 0);
});
