import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrer, MIGRATIONS, SCHEMA_ACTUEL } from '../js/migrations.js';

/* Cadre de migrations versionnées : socle des évolutions de schéma v3+.
   On teste le moteur avec des migrations injectées (la liste réelle est vide en V2). */

test('migrer : tamponne le schéma courant sur des données legacy sans `schema`', () => {
  const e = {};
  migrer(e);
  assert.equal(e.schema, SCHEMA_ACTUEL);
});

test('migrer : applique en chaîne des migrations ordonnées', () => {
  const migs = [
    { de:1, vers:2, appliquer:e => { e.a = 1; } },
    { de:2, vers:3, appliquer:e => { e.b = e.a + 1; } },
  ];
  const e = { schema:1 };
  migrer(e, migs, 3);
  assert.deepEqual({ a:e.a, b:e.b, schema:e.schema }, { a:1, b:2, schema:3 });
});

test('migrer : ne ré-applique pas une migration déjà passée', () => {
  let cpt = 0;
  const migs = [{ de:1, vers:2, appliquer:() => { cpt++; } }];
  migrer({ schema:2 }, migs, 2);
  assert.equal(cpt, 0);
});

test('migrer : s\'arrête proprement si aucune migration ne couvre la version', () => {
  const e = { schema:1 };
  const migs = [{ de:2, vers:3, appliquer:() => { throw new Error('ne doit pas tourner'); } }];
  assert.doesNotThrow(() => migrer(e, migs, 3));
  assert.equal(e.schema, 3);   /* version cible tamponnée même sans chemin complet */
});

test('migrer : robuste aux entrées non-objet', () => {
  assert.doesNotThrow(() => migrer(null));
  assert.doesNotThrow(() => migrer(undefined));
});

/* ---- migrations réelles (liste MIGRATIONS) ---- */

test('migration v1 (legacy) → schéma courant : profil + objectif + aliments.perso', () => {
  const e = { poids: [] };   /* état d'avant V3, sans schema */
  migrer(e);
  assert.equal(e.schema, SCHEMA_ACTUEL);
  assert.deepEqual(e.profil, { sexe:null, age:null, stature:null });
  assert.equal(e.objectif.type, 'recompo');
  assert.ok(e.aliments && typeof e.aliments.perso === 'object');
});

test('migration v2 → v3 : ajoute aliments.perso sans toucher au reste', () => {
  const e = { schema:2, profil:{ sexe:'homme', age:30, stature:178 }, objectif:{ type:'seche' } };
  migrer(e);
  assert.equal(e.schema, SCHEMA_ACTUEL);
  assert.deepEqual(e.aliments.perso, {});
  assert.equal(e.objectif.type, 'seche');        /* objectif existant préservé */
  assert.equal(e.profil.stature, 178);           /* profil existant préservé */
});

test('migration v2 → v3 : ne dé-référence pas un aliments.perso déjà présent', () => {
  const perso = { 'mon-truc': { nom:'Mon truc', cat:'Compléments', kcal100:100 } };
  const e = { schema:2, aliments:{ perso } };
  migrer(e);
  assert.equal(e.aliments.perso, perso);   /* même référence : pas écrasé */
});

test('migration v3 → v4 : l\'ancien plan devient le menu actif d\'une collection', () => {
  const plan = [{id:'dej', items:[['riz',120]]}];
  const e = { schema:3, plan };
  migrer(e);
  assert.equal(e.schema, SCHEMA_ACTUEL);
  assert.ok(!('plan' in e), 'l\'ancien champ plan est retiré');
  assert.equal(e.plansAlim.length, 1);
  assert.equal(e.plansAlim[0].id, 'principal');
  assert.deepEqual(e.plansAlim[0].repas, plan);   /* repas préservés tels quels */
  assert.equal(e.planAlimActif, 'principal');
});

test('migration v4 → v5 : ajoute la collection plats[] vide', () => {
  const e = { schema:4, plansAlim:[{id:'principal',nom:'M',repas:[]}], planAlimActif:'principal' };
  migrer(e);
  assert.equal(e.schema, SCHEMA_ACTUEL);
  assert.deepEqual(e.plats, []);
});

test('migration v4 → v5 : ne dé-référence pas un plats[] déjà présent', () => {
  const plats = [{ id:'p1', nom:'Bowl', composants:[['riz',100]] }];
  const e = { schema:4, plats };
  migrer(e);
  assert.equal(e.plats, plats);   /* même référence : pas écrasé */
});

test('migration v5 → v6 : ajoute la collection etatsJour[] vide', () => {
  const e = { schema:5, plats:[] };
  migrer(e);
  assert.equal(e.schema, SCHEMA_ACTUEL);
  assert.deepEqual(e.etatsJour, []);
});

test('migration v5 → v6 : ne dé-référence pas un etatsJour[] déjà présent', () => {
  const etatsJour = [{ date:'2026-06-20', sommeil:7.5, courbatures:3 }];
  const e = { schema:5, etatsJour };
  migrer(e);
  assert.equal(e.etatsJour, etatsJour);   /* même référence : pas écrasé */
});

test('migration v6 → v7 : ajoute les préférences alimentaires par défaut', () => {
  const e = { schema:6, etatsJour:[] };
  migrer(e);
  assert.equal(e.schema, SCHEMA_ACTUEL);
  assert.deepEqual(e.preferencesAlim, { aimes:[], evites:[], faciliteSeulement:true });
});

test('migration v6 → v7 : ne dé-référence pas des préférences déjà présentes', () => {
  const preferencesAlim = { aimes:['poulet-blanc'], evites:['oeuf'], faciliteSeulement:false };
  const e = { schema:6, preferencesAlim };
  migrer(e);
  assert.equal(e.preferencesAlim, preferencesAlim);   /* même référence : pas écrasé */
});

test('migration v1 (legacy) → schéma courant : profil + perso + plansAlim + plats + etatsJour + prefs en une chaîne', () => {
  const e = { poids:[], plan:[{id:'dej', items:[['riz',100]]}] };
  migrer(e);
  assert.equal(e.schema, SCHEMA_ACTUEL);
  assert.ok(e.profil && e.aliments && Array.isArray(e.plansAlim) && Array.isArray(e.plats) && Array.isArray(e.etatsJour));
  assert.ok(e.preferencesAlim && Array.isArray(e.preferencesAlim.aimes));
  assert.equal(e.planAlimActif, 'principal');
});
