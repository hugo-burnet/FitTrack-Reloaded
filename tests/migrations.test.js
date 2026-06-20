import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrer, SCHEMA_ACTUEL } from '../js/migrations.js';

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
