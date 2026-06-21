import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTS, PLAN, OBJ_DEFAUT } from '../js/data.js';
import { macrosCible } from '../js/nutrition.js';
import {
  qteAjustee, macrosRepas, entreesDuJour, extras, consomme,
  entreeJournalRepas, deplacerAliment, suggestionsProteine, supprimerMenu,
} from '../js/repas-logique.js';

/* ---- qteAjustee : non-flex figé, flex bougé et arrondi 5 g ---- */
test('qteAjustee : aliment non-flex inchangé', () => {
  // poulet n'est pas flex → quantité rendue telle quelle, quel que soit l'objectif
  assert.equal(qteAjustee('poulet', 220, 1800, PLAN), 220);
  assert.equal(qteAjustee('poulet', 220, 3500, PLAN), 220);
});
test('qteAjustee : aliment flex ajusté et arrondi au multiple de 5 g', () => {
  // riz est flex ; à l'objectif de référence le facteur ≈ 1 → reste proche de la base
  const q = qteAjustee('riz', 140, OBJ_DEFAUT, PLAN);
  assert.equal(q % 5, 0);
  assert.ok(q > 0);
  // objectif plus bas → facteur < 1 → quantité réduite
  assert.ok(qteAjustee('riz', 140, 1800, PLAN) < q);
});
test('qteAjustee : clé inconnue rendue telle quelle (jamais NaN)', () => {
  assert.equal(qteAjustee('inconnu', 50, 2000, PLAN), 50);
});

/* ---- macrosRepas : 5 macros, somme = macrosCible du plan entier ---- */
test('macrosRepas : agréger tous les repas = macrosCible (cohérence moteur)', () => {
  const tot = PLAN.reduce((s, r) => {
    const m = macrosRepas(r, OBJ_DEFAUT, PLAN);
    return { prot:s.prot+m.prot, gluc:s.gluc+m.gluc, lip:s.lip+m.lip, fib:s.fib+m.fib };
  }, { prot:0, gluc:0, lip:0, fib:0 });
  const cible = macrosCible(OBJ_DEFAUT, PLAN);
  // mêmes quantités ajustées des deux côtés ; ±1 g d'écart possible sur l'arrondi
  // final (les deux moteurs arrondissent au gramme près à des points de coupe ≈ x,5)
  const proche = (a, b) => assert.ok(Math.abs(a - b) <= 1, `${a} vs ${b}`);
  proche(Math.round(tot.prot), cible.prot);
  proche(Math.round(tot.gluc), cible.gluc);
  proche(Math.round(tot.lip), cible.lip);
  proche(Math.round(tot.fib), cible.fib);
});

/* ================= MENU GÉNÉRÉ : stepper proportionnel (échelle globale) =================
   genere=true → TOUS les aliments bougent du même facteur, et la cible suit le menu. */
const MENU_GEN = [
  { id:'pdej', nom:'Petit-déj', items:[['avoine',80],['whey',1],['banane',1]] },
  { id:'dej',  nom:'Déjeuner',  items:[['poulet',180],['riz',120],['huile-olive',10]] },
  { id:'diner',nom:'Dîner',     items:[['oeuf',150],['patate-douce',200]] },
];

test('qteAjustee (genere) : un aliment NON-flex (poulet) bouge aussi avec l\'objectif', () => {
  // en flex, le poulet est figé ; en menu généré, il suit le facteur global
  assert.equal(qteAjustee('poulet', 180, 3500, MENU_GEN), 180);              // flex : figé
  const bas  = qteAjustee('poulet', 180, 1700, MENU_GEN, ALIMENTS, true);
  const haut = qteAjustee('poulet', 180, 2800, MENU_GEN, ALIMENTS, true);
  assert.ok(haut > bas, 'le poulet doit grossir avec l\'objectif en mode généré');
  assert.equal(haut % 5, 0);                                                 // arrondi 5 g
});
test('qteAjustee (genere) : aliment en unités arrondi à l\'unité, jamais sous 1', () => {
  const q = qteAjustee('whey', 1, 1700, MENU_GEN, ALIMENTS, true);
  assert.ok(Number.isInteger(q) && q >= 1);
});

test('macrosRepas (genere) : somme des repas = macrosCible(genere) ET kcal ≈ objectif (stepper)', () => {
  const proche = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (tol ${tol})`);
  for(let obj = 1800; obj <= 3200; obj += 100){
    const tot = MENU_GEN.reduce((s, r) => {
      const m = macrosRepas(r, obj, MENU_GEN, ALIMENTS, true);
      return { kcal:s.kcal+m.kcal, prot:s.prot+m.prot, gluc:s.gluc+m.gluc, lip:s.lip+m.lip, fib:s.fib+m.fib };
    }, { kcal:0, prot:0, gluc:0, lip:0, fib:0 });
    const cible = macrosCible(obj, MENU_GEN, ALIMENTS, true);
    // la cible affichée == somme réelle des repas (cohérence cible ↔ quantités)
    proche(Math.round(tot.prot), cible.prot, 1);
    proche(Math.round(tot.gluc), cible.gluc, 1);
    proche(Math.round(tot.lip),  cible.lip,  1);
    proche(Math.round(tot.fib),  cible.fib,  1);
    // et le total kcal du menu rééchelonné suit l'objectif (à l'arrondi des portions près)
    proche(Math.round(tot.kcal), obj, obj*0.08 + 60);
  }
});

test('entreeJournalRepas (genere) : journalise les quantités rééchelonnées', () => {
  const repas = MENU_GEN[1];   // déjeuner
  const e = entreeJournalRepas(repas, '2026-06-21', 2800, MENU_GEN, ALIMENTS, true);
  const m = macrosRepas(repas, 2800, MENU_GEN, ALIMENTS, true);
  assert.equal(e.kcal, Math.round(m.kcal));
  // poulet (non-flex) rééchelonné > base 180 g pour un objectif au-dessus du menu de base
  const poulet = e.items.find(i => i.cle === 'poulet');
  assert.ok(poulet.qte > 180);
});

/* ---- agrégation du journal ---- */
const journal = [
  { date:'2026-06-20', id:'dej', kcal:600, prot:50, gluc:60, lip:15, fib:5 },
  { date:'2026-06-21', id:'pdej', kcal:500, prot:30, gluc:55, lip:12, fib:6 },
  { date:'2026-06-21', id:'x1', horsPlan:true, kcal:200, prot:10, gluc:20, lip:8, fib:2 },
  { date:'2026-06-21', id:'legacy', kcal:100, prot:5 }, // sans gluc/lip/fib (V3.1−)
];

test('entreesDuJour : ne garde que la date demandée', () => {
  const j = entreesDuJour(journal, '2026-06-21');
  assert.equal(j.length, 3);
  assert.ok(j.every(e => e.date === '2026-06-21'));
});
test('entreesDuJour : journal absent → tableau vide', () => {
  assert.deepEqual(entreesDuJour(undefined, '2026-06-21'), []);
});
test('extras : ne garde que les entrées hors-plan', () => {
  const j = entreesDuJour(journal, '2026-06-21');
  const x = extras(j);
  assert.equal(x.length, 1);
  assert.equal(x[0].id, 'x1');
});
test('consomme : somme les macros, legacy compté 0 jamais NaN', () => {
  const j = entreesDuJour(journal, '2026-06-21');
  const c = consomme(j);
  assert.equal(c.kcal, 800);   // 500 + 200 + 100
  assert.equal(c.prot, 45);    // 30 + 10 + 5
  assert.equal(c.gluc, 75);    // 55 + 20 + 0
  assert.equal(c.lip, 20);     // 12 + 8 + 0
  assert.equal(c.fib, 8);      // 6 + 2 + 0
  assert.ok(Number.isFinite(c.gluc));
});

/* ---- entreeJournalRepas : entrée fidèle au repas ---- */
test('entreeJournalRepas : structure et items du repas', () => {
  const repas = PLAN.find(r => r.id === 'dej');
  const e = entreeJournalRepas(repas, '2026-06-21', OBJ_DEFAUT, PLAN);
  assert.equal(e.date, '2026-06-21');
  assert.equal(e.id, 'dej');
  assert.equal(e.nom, 'Déjeuner');
  assert.equal(e.objectifKcal, OBJ_DEFAUT);
  assert.equal(e.items.length, repas.items.length);
  // macros = arrondis de macrosRepas
  const m = macrosRepas(repas, OBJ_DEFAUT, PLAN);
  assert.equal(e.kcal, Math.round(m.kcal));
  assert.equal(e.prot, Math.round(m.prot));
  // item poulet : 220 g (non-flex), unité 'g'
  const poulet = e.items.find(i => i.cle === 'poulet');
  assert.equal(poulet.qte, 220);
  assert.equal(poulet.unite, 'g');
  assert.equal(poulet.nom, ALIMENTS['poulet'].nom);
});

/* ---- deplacerAliment : mutation contrôlée ---- */
const repasFixture = () => ([
  { id:'a', nom:'A', items:[['poulet',100],['riz',50]] },
  { id:'b', nom:'B', items:[['skyr',200]] },
]);
test('deplacerAliment : déplace et retourne true', () => {
  const r = repasFixture();
  assert.equal(deplacerAliment(r, 'a', 'riz', 'b'), true);
  assert.deepEqual(r[0].items, [['poulet',100]]);
  assert.deepEqual(r[1].items, [['skyr',200],['riz',50]]);
});
test('deplacerAliment : déjà présent dans la cible → false, rien ne bouge', () => {
  const r = repasFixture();
  r[1].items.push(['riz',10]);
  const avant = JSON.stringify(r);
  assert.equal(deplacerAliment(r, 'a', 'riz', 'b'), false);
  assert.equal(JSON.stringify(r), avant);
});
test('deplacerAliment : repas ou aliment absent → false', () => {
  const r = repasFixture();
  assert.equal(deplacerAliment(r, 'a', 'inconnu', 'b'), false);
  assert.equal(deplacerAliment(r, 'zzz', 'riz', 'b'), false);
  assert.equal(deplacerAliment(r, 'a', 'riz', 'zzz'), false);
});

/* ---- suggestionsProteine (déplacé depuis RepasModule, tests historiques) ---- */
test('suggestionsProteine : couvre le déficit avec whey / skyr / poulet', () => {
  const s = suggestionsProteine(20);
  assert.equal(s.length, 3);
  const whey = s.find(o => o.cle === 'whey');
  assert.equal(whey.qte, 1);
  assert.equal(whey.unite, 'shaker');
  assert.equal(whey.prot, 23);
  assert.equal(whey.kcal, 115);
  const skyr = s.find(o => o.cle === 'skyr');
  assert.equal(skyr.unite, 'g');
  assert.equal(skyr.qte, 180);
  const poulet = s.find(o => o.cle === 'poulet');
  assert.equal(poulet.qte, 110);
});
test('suggestionsProteine : reste petit → au moins 1 unité / quantité minimale', () => {
  const s = suggestionsProteine(5);
  assert.equal(s.find(o => o.cle === 'whey').qte, 1);
  assert.ok(s.find(o => o.cle === 'skyr').qte >= 20);
});

/* ---- supprimerMenu : garde-fou « au moins un menu » ---- */
test('supprimerMenu : retire le menu et réactive le premier restant', () => {
  const plans = [{ id:'m1' }, { id:'m2' }, { id:'m3' }];
  const r = supprimerMenu(plans, 'm2');
  assert.deepEqual(r.plansAlim.map(p => p.id), ['m1', 'm3']);
  assert.equal(r.planAlimActif, 'm1');
});
test('supprimerMenu : refuse de descendre sous un seul menu', () => {
  assert.equal(supprimerMenu([{ id:'m1' }], 'm1'), null);
});
test('supprimerMenu : id inconnu → null (rien à faire)', () => {
  assert.equal(supprimerMenu([{ id:'m1' }, { id:'m2' }], 'zzz'), null);
});
