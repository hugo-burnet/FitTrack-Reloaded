import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basesKcal, facteurFlex, flexSature, consoQuotidienne, FLEX_MIN, FLEX_MAX,
         kcalItem, protItem, glucItem, lipItem, fibItem, protCible, macrosCible } from '../js/nutrition.js';
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
