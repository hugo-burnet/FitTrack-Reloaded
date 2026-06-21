import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POOL_GENERATEUR, PREP_FACILES, REPAS_STRUCTURE } from '../js/data/generateur-pool.js';
import { ALIMENTS } from '../js/data.js';

const ROLES = ['prot', 'gluc', 'lip', 'fibre'];
const SLOTS = REPAS_STRUCTURE.map(r => r.id);

test('pool : chaque entrée référence un aliment existant de la base', () => {
  for(const e of POOL_GENERATEUR) assert.ok(ALIMENTS[e.cle], `clé inconnue dans ALIMENTS : ${e.cle}`);
});

test('pool : rôle et préparation valides', () => {
  for(const e of POOL_GENERATEUR){
    assert.ok(ROLES.includes(e.role), `${e.cle} : rôle invalide ${e.role}`);
    assert.ok(PREP_FACILES.includes(e.prep), `${e.cle} : prep non facile ${e.prep}`);
  }
});

test('pool : slots non vides et connus', () => {
  for(const e of POOL_GENERATEUR){
    assert.ok(Array.isArray(e.slots) && e.slots.length, `${e.cle} : slots manquants`);
    for(const s of e.slots) assert.ok(SLOTS.includes(s), `${e.cle} : slot inconnu ${s}`);
  }
});

test('pool : bornes cohérentes (0 ≤ min ≤ base ≤ max, pas > 0)', () => {
  for(const e of POOL_GENERATEUR){
    assert.ok(Number.isFinite(e.min) && Number.isFinite(e.max) && Number.isFinite(e.base) && Number.isFinite(e.pas), `${e.cle} : champ numérique manquant`);
    assert.ok(e.pas > 0, `${e.cle} : pas doit être > 0`);
    assert.ok(e.min >= 0, `${e.cle} : min négatif`);
    assert.ok(e.min <= e.base && e.base <= e.max, `${e.cle} : base hors bornes`);
  }
});

test('pool : pas de clé dupliquée', () => {
  const cles = POOL_GENERATEUR.map(e => e.cle);
  assert.equal(new Set(cles).size, cles.length, 'doublon de clé dans le pool');
});

test('pool : chaque rôle propose plusieurs aliments (variété)', () => {
  for(const role of ROLES){
    const n = POOL_GENERATEUR.filter(e => e.role === role).length;
    assert.ok(n >= 3, `rôle ${role} trop pauvre (${n})`);
  }
});

test('pool : aliments « unité » correctement tagués', () => {
  for(const e of POOL_GENERATEUR){
    const estUnite = ALIMENTS[e.cle].unite !== undefined;
    if(estUnite) assert.ok(e.unite === true, `${e.cle} : aliment unité non tagué unite:true`);
    else assert.ok(e.unite === undefined, `${e.cle} : aliment /100g tagué unite par erreur`);
  }
});
