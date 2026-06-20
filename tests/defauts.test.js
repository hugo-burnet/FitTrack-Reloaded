import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etatParDefaut, coursesParDefaut } from '../js/defaults.js';
import { SCHEMA_ACTUEL } from '../js/migrations.js';

/* La fabrique unique etatParDefaut() est la source partagée par Store.charger()
   et Store.reinitialiser(). Sa complétude est ce qui corrige T1. */

test('etatParDefaut : forme complète et cohérente', () => {
  const e = etatParDefaut();
  for(const k of ['poids','mensurations','journalRepas','seances'])
    assert.ok(Array.isArray(e[k]), `${k} doit être un tableau`);
  assert.equal(e.schema, SCHEMA_ACTUEL);
  assert.equal(typeof e.objectifKcal, 'number');
  assert.ok(e.repas && e.repas.coches && e.repas.planJour === null);
  assert.ok(Array.isArray(e.plansAlim) && e.plansAlim.length);
  assert.ok(e.plansAlim.some(p => p.id === e.planAlimActif), 'planAlimActif doit exister');
  assert.ok(e.plansAlim[0].repas.length, 'le menu par défaut doit avoir des repas');
  assert.ok(e.aliments && typeof e.aliments.perso === 'object');
  assert.ok(Array.isArray(e.programmes) && e.programmes.length);
  assert.ok(e.programmes.some(p => p.id === e.programmeActif), 'programmeActif doit exister');
  assert.ok(e.courses && Array.isArray(e.courses.items) && e.courses.items.length);
  assert.equal(e.courses.jours, 7);
  assert.equal(e.autoExport, false);
  assert.ok(e.brouillons && typeof e.brouillons === 'object');
});

test('etatParDefaut : instances indépendantes (aucune référence partagée)', () => {
  const a = etatParDefaut(), b = etatParDefaut();
  a.plansAlim[0].repas.push({id:'x', items:[]});
  a.poids.push({date:'2026-01-01', kg:80});
  a.programmes[0].nom = 'modifié';
  assert.notEqual(a.plansAlim[0].repas.length, b.plansAlim[0].repas.length);
  assert.equal(b.poids.length, 0);
  assert.notEqual(b.programmes[0].nom, 'modifié');
});

test('coursesParDefaut : items avec id dérivé + horizon 7 jours', () => {
  const c = coursesParDefaut();
  assert.ok(c.items.length && c.items.every(it => typeof it.id === 'string' && it.id));
  assert.equal(c.jours, 7);
  assert.deepEqual(c.coches, {});
});

/* Régression T1 : l'onglet Repas lit `repas.planJour || repas du menu actif` → le menu
   actif DOIT avoir des repas dans un état neuf, sinon le rendu plante (bug T1). */
test('régression T1 : un état neuf fournit un plan effectif non vide', () => {
  const e = etatParDefaut();
  const menu = e.plansAlim.find(p => p.id === e.planAlimActif);
  const planEffectif = e.repas.planJour || (menu && menu.repas);
  assert.ok(Array.isArray(planEffectif) && planEffectif.length,
            'plan effectif manquant → l\'onglet Repas planterait (bug T1)');
});
