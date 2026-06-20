import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bmr, facteurActivite, frequenceHebdo, calculerBesoins,
  AJUST_OBJECTIF, PROT_PAR_KG, PART_LIPIDES,
} from '../js/besoins.js';

/* Moteur de besoins (E5) — fonctions pures, cœur du calculateur. */

test('bmr : Mifflin-St Jeor homme vs femme (écart constant de 166)', () => {
  const h = bmr({ sexe:'homme', poids:80, stature:180, age:30 });
  const f = bmr({ sexe:'femme', poids:80, stature:180, age:30 });
  assert.equal(h, 10*80 + 6.25*180 - 5*30 + 5);   // 1780
  assert.equal(h - f, 166);
});

test('bmr : null si une donnée manque ou sexe absent', () => {
  assert.equal(bmr({ sexe:'homme', poids:80, stature:180 }), null);     // âge manquant
  assert.equal(bmr({ sexe:'autre', poids:80, stature:180, age:30 }), null);
});

test('facteurActivite : barème par paliers de fréquence hebdo', () => {
  assert.equal(facteurActivite(0), 1.2);
  assert.equal(facteurActivite(2), 1.375);
  assert.equal(facteurActivite(4), 1.55);
  assert.equal(facteurActivite(6), 1.725);
  assert.equal(facteurActivite(7), 1.9);
});

test('frequenceHebdo : moyenne sur la fenêtre glissante', () => {
  const seances = [
    { date:'2026-06-01' }, { date:'2026-06-03' }, { date:'2026-06-10' },
    { date:'2026-06-17' }, { date:'2026-01-01' },   // hors fenêtre 4 sem.
  ];
  // ref = 2026-06-20, 4 semaines → 4 séances retenues / 4 = 1/sem
  assert.equal(frequenceHebdo(seances, '2026-06-20', 4), 1);
  assert.equal(frequenceHebdo([], '2026-06-20', 4), 0);
  assert.equal(frequenceHebdo(null, '2026-06-20'), 0);
});

test('calculerBesoins : invalide tant qu\'il manque une donnée, liste les manques', () => {
  const r = calculerBesoins({ sexe:'homme', objectif:'recompo' });
  assert.equal(r.valide, false);
  assert.deepEqual(r.manque.sort(), ['age','poids','stature']);
});

test('calculerBesoins : recompo = maintien (TDEE), macros cohérentes', () => {
  const r = calculerBesoins({ sexe:'homme', age:30, stature:180, poids:80, objectif:'recompo', seancesParSemaine:4 });
  assert.equal(r.valide, true);
  // BMR 1780 × 1.55 = 2759 ; recompo → ajustement 0
  assert.equal(r.tdee, 2759);
  assert.equal(r.kcal, 2759);
  // protéines = 2.0 g/kg × 80 = 160 g
  assert.equal(r.macros.proteines, Math.round(PROT_PAR_KG.recompo * 80));
  // lipides = 25% des kcal / 9
  assert.equal(r.macros.lipides, Math.round(r.kcal * PART_LIPIDES / 9));
  // somme des macros ≈ kcal (à l'arrondi près)
  const kcalMacros = r.macros.proteines*4 + r.macros.lipides*9 + r.macros.glucides*4;
  assert.ok(Math.abs(kcalMacros - r.kcal) <= 6);
});

test('calculerBesoins : sèche = déficit, masse = surplus', () => {
  const base = { sexe:'homme', age:30, stature:180, poids:80, seancesParSemaine:4 };
  const seche = calculerBesoins({ ...base, objectif:'seche' });
  const masse = calculerBesoins({ ...base, objectif:'masse' });
  const tdee = 2759;
  assert.equal(seche.kcal, Math.round(tdee * (1 + AJUST_OBJECTIF.seche)));
  assert.equal(masse.kcal, Math.round(tdee * (1 + AJUST_OBJECTIF.masse)));
  assert.ok(seche.kcal < tdee && masse.kcal > tdee);
  // protéines plus élevées en sèche qu'en masse
  assert.ok(seche.macros.proteines > masse.macros.proteines);
});

test('calculerBesoins : objectif inconnu retombe sur recompo', () => {
  const r = calculerBesoins({ sexe:'femme', age:25, stature:165, poids:60, objectif:'n_importe_quoi' });
  assert.equal(r.objectif, 'recompo');
  assert.equal(r.valide, true);
});
