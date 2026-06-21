import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basesKcal, facteurFlex, flexSature, consoQuotidienne, FLEX_MIN, FLEX_MAX,
         kcalItem, protItem, glucItem, lipItem, fibItem, protCible, macrosCible, macrosPlat,
         kcalBaseMenu, facteurMenu, menuSature, MENU_MIN, MENU_MAX } from '../js/nutrition.js';
import { ALIMENTS } from '../js/data.js';

const { fixe, flex } = basesKcal();

test('basesKcal : parts fixe et flex strictement positives', () => {
  assert.ok(fixe > 0);
  assert.ok(flex > 0);
});

test('facteurFlex : vaut 1 quand l\'objectif égale exactement le total du plan', () => {
  assert.ok(Math.abs(facteurFlex(fixe + flex) - 1) < 1e-9);
});

test('facteurFlex : sature à la borne basse pour un objectif très bas', () => {
  assert.equal(facteurFlex(0), FLEX_MIN);
  assert.equal(facteurFlex(fixe), FLEX_MIN);   // 0 kcal de flex demandé → borné à 0.4
});

test('facteurFlex : sature à la borne haute pour un objectif très élevé', () => {
  assert.equal(facteurFlex(100000), FLEX_MAX);
});

test('facteurFlex : reste dans [FLEX_MIN, FLEX_MAX] sur toute la plage réaliste', () => {
  for(let obj = 1600; obj <= 4000; obj += 50){
    const f = facteurFlex(obj);
    assert.ok(f >= FLEX_MIN && f <= FLEX_MAX, `objectif ${obj} → ${f} hors bornes`);
  }
});

test('flexSature : signale bas / haut / null selon la saturation', () => {
  assert.equal(flexSature(0), 'bas');
  assert.equal(flexSature(100000), 'haut');
  assert.equal(flexSature(fixe + flex), null);   // pile à 1, pas de saturation
});

test('consoQuotidienne : agrège le plan par aliment (parts non-flex déterministes)', () => {
  const c = consoQuotidienne(2545);
  assert.equal(c.banane, 3);     // pdej + coll + post
  assert.equal(c.whey, 2);       // pdej + post
  assert.equal(c.poulet, 220);
  assert.equal(c.skyr, 480);     // coll + dîner
  assert.equal(c.pois, 190);
  assert.equal(c.choco, 2);
  assert.ok('riz' in c && 'avoine' in c);
});

test('consoQuotidienne : la part flex (riz) suit l\'objectif kcal', () => {
  assert.ok(consoQuotidienne(4000).riz > consoQuotidienne(1600).riz);
});

/* ---- macros complètes (E3) ---- */

test('glucItem/lipItem/fibItem : par 100 g (riz) et par unité (banane)', () => {
  // riz : 78 g gluc / 1 g lip / 1,3 g fib pour 100 g → ×140 g
  assert.ok(Math.abs(glucItem('riz', 140) - 78*1.4) < 1e-9);
  assert.ok(Math.abs(lipItem('riz', 140)  - 1*1.4)  < 1e-9);
  assert.ok(Math.abs(fibItem('riz', 140)  - 1.3*1.4) < 1e-9);
  // banane : valeurs par unité, indépendantes de /100
  assert.equal(glucItem('banane', 2), ALIMENTS.banane.glucU * 2);
  assert.equal(lipItem('banane', 2),  ALIMENTS.banane.lipU * 2);
  assert.equal(fibItem('banane', 2),  ALIMENTS.banane.fibU * 2);
});

test('macros par item : cohérence kcal ≈ 4·prot + 4·gluc + 9·lip (±15 %)', () => {
  for(const cle of Object.keys(ALIMENTS)){
    const q = ALIMENTS[cle].unite!==undefined ? 1 : 100;
    const kcal = kcalItem(cle, q);
    const calcule = 4*protItem(cle,q) + 4*glucItem(cle,q) + 9*lipItem(cle,q);
    assert.ok(Math.abs(kcal - calcule) <= kcal*0.15 + 5,
      `${cle} : kcal ${kcal} vs macros ${calcule}`);
  }
});

test('macrosCible : 4 macros entières et strictement positives', () => {
  const m = macrosCible(2545);
  for(const k of ['prot','gluc','lip','fib']){
    assert.ok(Number.isInteger(m[k]), `${k} doit être entier`);
    assert.ok(m[k] > 0, `${k} doit être > 0`);
  }
});

test('macrosCible : prot identique à protCible (même base de calcul)', () => {
  assert.equal(macrosCible(2545).prot, protCible(2545));
  // les glucides (part flex : riz/avoine) montent avec l'objectif kcal
  assert.ok(macrosCible(4000).gluc > macrosCible(1600).gluc);
});

/* ================= MENU GÉNÉRÉ : échelle globale (stepper proportionnel) =================
   Contrairement au flex (seuls riz/avoine bougent), un menu généré rééchelonne TOUT du
   même facteur global = objectif / kcal du menu, borné [0.5, 2.0]. */

/* menu-fixture : aliments de base, mélange g (poulet/riz/patate-douce) et unités (banane/whey) */
const MENU = [
  { id:'pdej', nom:'Petit-déj', items:[['avoine',80],['whey',1],['banane',1]] },
  { id:'dej',  nom:'Déjeuner',  items:[['poulet',180],['riz',120],['huile-olive',10]] },
  { id:'diner',nom:'Dîner',     items:[['oeuf',150],['patate-douce',200]] },
];
const kcalMenu = () => MENU.reduce((s,r)=>s+r.items.reduce((a,[c,q])=>a+kcalItem(c,q),0),0);

test('kcalBaseMenu : somme des portions stockées (g et unités)', () => {
  assert.ok(Math.abs(kcalBaseMenu(MENU) - kcalMenu()) < 1e-9);
  assert.equal(kcalBaseMenu([]), 0);
  assert.equal(kcalBaseMenu(null), 0);
});

test('facteurMenu : vaut 1 quand l\'objectif égale les kcal du menu', () => {
  assert.ok(Math.abs(facteurMenu(Math.round(kcalMenu()), MENU) - 1) < 0.01);
});

test('facteurMenu : sature aux bornes [MENU_MIN, MENU_MAX]', () => {
  assert.equal(facteurMenu(0, MENU), MENU_MIN);
  assert.equal(facteurMenu(1000000, MENU), MENU_MAX);
  assert.equal(facteurMenu(2000, []), 1);   // menu vide → pas de division par 0
});

test('menuSature : bas / haut / null selon le facteur global', () => {
  const k = kcalMenu();
  assert.equal(menuSature(Math.round(k), MENU), null);
  assert.equal(menuSature(Math.round(k*MENU_MIN/2), MENU), 'bas');
  assert.equal(menuSature(Math.round(k*MENU_MAX*2), MENU), 'haut');
  assert.equal(menuSature(2000, []), null);
});

test('macrosCible (genere) : TOUTES les macros suivent l\'objectif (pas seulement les glucides)', () => {
  const bas = macrosCible(1700, MENU, ALIMENTS, true);
  const haut = macrosCible(2800, MENU, ALIMENTS, true);
  assert.ok(haut.prot > bas.prot, 'les protéines doivent monter avec l\'objectif');
  assert.ok(haut.gluc > bas.gluc);
  assert.ok(haut.lip > bas.lip);
});

test('consoQuotidienne (genere) : TOUS les aliments suivent l\'objectif (= portions du menu)', () => {
  const bas  = consoQuotidienne(1700, MENU, ALIMENTS, true);
  const haut = consoQuotidienne(2800, MENU, ALIMENTS, true);
  // le poulet (non-flex) grossit avec l'objectif en mode généré, contrairement au flex
  assert.ok(haut.poulet > bas.poulet, 'poulet doit suivre l\'objectif en mode généré');
  assert.ok(haut.riz > bas.riz);
  // cohérence : la conso/jour = la somme des qteAjustee du menu rééchelonné
  for(const cle of ['poulet','riz','oeuf','patate-douce']){
    const attendu = MENU.reduce((s,r)=>s + r.items.filter(([c])=>c===cle).reduce((a,[,q])=>{
      const f = facteurMenu(2800, MENU); const pas = ALIMENTS[cle].unite!==undefined?1:5;
      return a + Math.max(pas, Math.round(q*f/pas)*pas);
    },0), 0);
    assert.equal(haut[cle], attendu, `conso ${cle}`);
  }
});

test('consoQuotidienne (genere=false) : flex inchangé (poulet figé, riz suit) — ISO', () => {
  const bas = consoQuotidienne(1700, MENU), haut = consoQuotidienne(2800, MENU);
  assert.equal(bas.poulet, haut.poulet);   // non-flex figé en mode plan fixe
  assert.ok(haut.riz > bas.riz);            // flex suit
});

test('macrosCible (genere) : kcal du menu rééchelonné ≈ objectif sur la plage non saturée', () => {
  const k = kcalMenu();
  for(let obj = Math.ceil(k*MENU_MIN); obj <= Math.floor(k*MENU_MAX); obj += 50){
    const m = macrosCible(obj, MENU, ALIMENTS, true);
    const kcal = 4*m.prot + 4*m.gluc + 9*m.lip;   // reconstitution Atwater des macros cible
    assert.ok(Math.abs(kcal - obj) <= obj*0.10 + 60, `objectif ${obj} → ${kcal} kcal (écart trop grand)`);
  }
});

/* ---- plats composés (E4) ---- */

test('macrosPlat : somme des composants (par 100 g et par unité)', () => {
  // poulet 200 g + riz 100 g + banane 1
  const m = macrosPlat([['poulet',200],['riz',100],['banane',1]]);
  const attendu = {
    kcal: kcalItem('poulet',200)+kcalItem('riz',100)+kcalItem('banane',1),
    prot: protItem('poulet',200)+protItem('riz',100)+protItem('banane',1),
    gluc: glucItem('poulet',200)+glucItem('riz',100)+glucItem('banane',1),
  };
  assert.ok(Math.abs(m.kcal-attendu.kcal)<1e-9);
  assert.ok(Math.abs(m.prot-attendu.prot)<1e-9);
  assert.ok(Math.abs(m.gluc-attendu.gluc)<1e-9);
});

test('macrosPlat : ignore les composants inconnus ou de quantité ≤ 0 (jamais NaN)', () => {
  const m = macrosPlat([['poulet',100],['inconnu-xyz',50],['riz',0],['banane',-2]]);
  assert.deepEqual(
    { kcal:Math.round(m.kcal), prot:Math.round(m.prot) },
    { kcal:Math.round(kcalItem('poulet',100)), prot:Math.round(protItem('poulet',100)) });
  assert.deepEqual(macrosPlat([]), { kcal:0, prot:0, gluc:0, lip:0, fib:0 });
  assert.deepEqual(macrosPlat(null), { kcal:0, prot:0, gluc:0, lip:0, fib:0 });
});
