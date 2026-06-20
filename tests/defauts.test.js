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
  assert.ok(Array.isArray(e.plan) && e.plan.length);
  assert.ok(Array.isArray(e.programmes) && e.programmes.length);
  assert.ok(e.programmes.some(p => p.id === e.programmeActif), 'programmeActif doit exister');
  assert.ok(e.courses && Array.isArray(e.courses.items) && e.courses.items.length);
  assert.equal(e.courses.jours, 7);
  assert.equal(e.autoExport, false);
  assert.ok(e.brouillons && typeof e.brouillons === 'object');
});

test('etatParDefaut : instances indépendantes (aucune référence partagée)', () => {
  const a = etatParDefaut(), b = etatParDefaut();
  a.plan.push({id:'x', items:[]});
  a.poids.push({date:'2026-01-01', kg:80});
  a.programmes[0].nom = 'modifié';
  assert.notEqual(a.plan.length, b.plan.length);
  assert.equal(b.poids.length, 0);
  assert.notEqual(b.programmes[0].nom, 'modifié');
});

test('coursesParDefaut : items avec id dérivé + horizon 7 jours', () => {
  const c = coursesParDefaut();
  assert.ok(c.items.length && c.items.every(it => typeof it.id === 'string' && it.id));
  assert.equal(c.jours, 7);
  assert.deepEqual(c.coches, {});
});

/* Régression T1 : l'onglet Repas lit `repas.planJour || plan` → `plan` DOIT exister
   dans un état neuf, sinon `plan.map(...)` plante après une remise à zéro. */
test('régression T1 : un état neuf fournit un plan effectif non vide', () => {
  const e = etatParDefaut();
  const planEffectif = e.repas.planJour || e.plan;
  assert.ok(Array.isArray(planEffectif) && planEffectif.length,
            'plan effectif manquant → l\'onglet Repas planterait (bug T1)');
});
