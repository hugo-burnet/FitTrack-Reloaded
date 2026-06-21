import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererMenu } from '../js/generateur.js';
import { POOL_GENERATEUR, PREP_FACILES } from '../js/data/generateur-pool.js';

/* Le générateur doit tomber JUSTE sur les 3 macros (prot/gluc/lip → kcal), rester dans des
   portions mangeables, respecter goûts/évictions/facilité, et ne jamais lever ni produire de NaN. */

const CIBLES = { kcal: 2920, prot: 145, gluc: 403, lip: 81, fib: 41 };   /* recompo 72,5 kg */
const clesDe = r => r.repas.flatMap(rp => rp.items.map(([c]) => c));
const prepDe = cle => (POOL_GENERATEUR.find(e => e.cle === cle) || {}).prep;

test('genererMenu : atteint les macros cibles à ~10 % près, sans saturation', () => {
  const r = genererMenu(CIBLES, { faciliteSeulement: true });
  for(const k of ['prot', 'gluc', 'lip']){
    assert.ok(Math.abs(r.ecarts[k]) <= CIBLES[k] * 0.1, `${k} hors tolérance : écart ${r.ecarts[k]}`);
  }
  assert.ok(Math.abs(r.ecarts.kcal) <= CIBLES.kcal * 0.08, `kcal hors tolérance : ${r.ecarts.kcal}`);
  assert.deepEqual(r.saturations, []);
});

test('genererMenu : macros entières, portions > 0, repas non vides, jamais de NaN', () => {
  const r = genererMenu(CIBLES, { faciliteSeulement: true });
  assert.ok(r.repas.length >= 3);
  for(const rp of r.repas){
    assert.ok(rp.items.length > 0);
    for(const [cle, q] of rp.items){ assert.ok(q > 0 && Number.isFinite(q), `${cle}=${q}`); }
  }
  for(const k of ['kcal', 'prot', 'gluc', 'lip', 'fib']){
    assert.ok(Number.isInteger(r.macros[k]), `${k} non entier`);
  }
});

test('genererMenu : cohérence énergétique kcal ≈ 4·prot + 4·gluc + 9·lip', () => {
  const r = genererMenu(CIBLES, { faciliteSeulement: true });
  const atwater = 4 * r.macros.prot + 4 * r.macros.gluc + 9 * r.macros.lip;
  assert.ok(Math.abs(atwater - r.macros.kcal) <= 30, `Atwater ${atwater} vs kcal ${r.macros.kcal}`);
});

test('genererMenu : `evites` est un filtre dur (l\'aliment n\'apparaît jamais)', () => {
  const r = genererMenu(CIBLES, { faciliteSeulement: true, evites: ['oeuf', 'whey', 'whey-iso'] });
  const cles = clesDe(r);
  assert.ok(!cles.includes('oeuf') && !cles.includes('whey') && !cles.includes('whey-iso'));
  assert.deepEqual(r.saturations, []);   /* reste atteignable sans eux */
});

test('genererMenu : `aimes` est préféré mais complété si capacité insuffisante', () => {
  /* n'aime que riz en glucides : doit quand même atteindre la cible en complétant */
  const r = genererMenu(CIBLES, { faciliteSeulement: true, aimes: ['poulet-blanc', 'riz', 'skyr'] });
  const cles = clesDe(r);
  assert.ok(cles.includes('poulet-blanc') && cles.includes('riz') && cles.includes('skyr'), 'aimés présents');
  assert.ok(Math.abs(r.ecarts.gluc) <= CIBLES.gluc * 0.1, 'glucides atteints malgré peu d\'aimés');
});

test('genererMenu : faciliteSeulement n\'emploie que des aliments faciles', () => {
  const r = genererMenu(CIBLES, { faciliteSeulement: true });
  for(const cle of clesDe(r)){
    const p = prepDe(cle);
    if(p !== undefined) assert.ok(PREP_FACILES.includes(p), `${cle} (${p}) non facile`);
  }
});

test('genererMenu : cible irréaliste → saturations signalées, jamais d\'échec ni de NaN', () => {
  const extreme = { kcal: 6000, prot: 400, gluc: 800, lip: 150, fib: 60 };
  const r = genererMenu(extreme, { faciliteSeulement: true });
  assert.ok(r.saturations.length > 0, 'doit signaler la saturation');
  assert.ok(Number.isFinite(r.macros.kcal) && r.macros.prot > 0);
  assert.ok(r.repas.length > 0);
});

test('genererMenu : robuste à des options vides / absentes', () => {
  assert.doesNotThrow(() => genererMenu(CIBLES));
  assert.doesNotThrow(() => genererMenu(CIBLES, { aimes: [], evites: [] }));
});
