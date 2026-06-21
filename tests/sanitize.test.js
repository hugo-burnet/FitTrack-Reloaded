import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assainirEtat, assainirDates, serieValide, assainirSeance,
  assainirRepasPlan, assainirPlansAlim, assainirProgrammes, assainirJournalRepas, assainirCoursesItems,
  assainirAlimentsPerso, assainirPlats, assainirEtatsJour, assainirPreferencesAlim,
} from '../js/sanitize.js';

/* Garde-fou sur le code défensif le plus critique (jusqu'ici non testé) :
   il ne doit JAMAIS lever et toujours renvoyer des données propres. */

test('assainirDates : ne garde que les entrées objet datées', () => {
  assert.deepEqual(assainirDates([{date:'2026-01-01',kg:80},{kg:79},null,'x']),
                   [{date:'2026-01-01',kg:80}]);
  assert.deepEqual(assainirDates('pas un tableau'), []);
});

test('serieValide : reps numérique obligatoire ; charge OU duree (null toléré)', () => {
  assert.equal(serieValide({charge:40,reps:10}), true);
  assert.equal(serieValide({charge:null,reps:10}), true);
  assert.equal(serieValide({duree:30,reps:3}), true);
  assert.equal(serieValide({duree:null,reps:3}), true);
  assert.equal(serieValide({reps:'x'}), false);
  assert.equal(serieValide({charge:40}), false);   /* reps manquant */
  assert.equal(serieValide(null), false);
});

test('assainirSeance : écarte les exercices sans série valide et les séances vides', () => {
  const ok = assainirSeance({date:'2026-01-01', exercices:[
    {nom:'Squat', series:[{charge:60,reps:5},{reps:'NaN'}]},   /* 2e série tombe */
    {nom:'Vide', series:[{reps:null}]},                        /* exercice vidé → écarté */
  ]});
  assert.equal(ok.exercices.length, 1);
  assert.equal(ok.exercices[0].series.length, 1);
  assert.equal(assainirSeance({date:'x'}), null);          /* pas d'exercices */
  assert.equal(assainirSeance({exercices:[]}), null);      /* pas de date */
  assert.equal(assainirSeance(null), null);
});

test('assainirRepasPlan : aliments connus + quantités numériques ; null si rien d\'exploitable', () => {
  assert.deepEqual(
    assainirRepasPlan([{id:'dej', items:[['riz',100],['inconnu',50],['poulet','x']]}]),
    [{id:'dej', items:[['riz',100]]}]);
  /* un repas valide (id+items) mais aux aliments tous inconnus survit avec items vide */
  assert.deepEqual(assainirRepasPlan([{id:'x', items:[['inconnu',1]]}]), [{id:'x', items:[]}]);
  /* null seulement quand AUCUN repas ne survit au filtre de forme (ici : pas d'id) */
  assert.equal(assainirRepasPlan([{items:[['riz',100]]}]), null);
  assert.equal(assainirRepasPlan('nope'), null);
});

test('assainirPlansAlim : exige id + nom ; repas nettoyés (aliments connus) ; null si vide', () => {
  const m = assainirPlansAlim([
    { id:'a', nom:'Sèche', repas:[{id:'dej', items:[['riz',100],['inconnu',50]]}] },
    { id:'b', repas:[{id:'x', items:[['inconnu',1]]}] },   /* nom manquant → défaut ; repas vidés */
    { nom:'sans id' },                                      /* pas d'id → écarté */
  ]);
  assert.equal(m.length, 2);
  assert.deepEqual(m[0].repas, [{id:'dej', items:[['riz',100]]}]);
  assert.equal(m[1].nom, 'Menu');         /* nom par défaut */
  assert.deepEqual(m[1].repas, [{id:'x', items:[]}]);
  assert.equal(assainirPlansAlim([{nom:'x'}]), null);   /* aucun menu valide */
  assert.equal(assainirPlansAlim('nope'), null);
});

test('assainirProgrammes : exige id + jours[] dont chaque jour a un tableau exercices', () => {
  const p = assainirProgrammes([
    {id:'a', jours:[{id:'j', exercices:[]}]},
    {id:'b'},          /* pas de jours */
    {jours:[]},        /* pas d'id */
  ]);
  assert.equal(p.length, 1);
  assert.equal(p[0].id, 'a');
});

test('assainirJournalRepas : exige date + id, items toujours tableau', () => {
  const j = assainirJournalRepas([{date:'2026-01-01', id:1}, {id:2}, {date:'x'}]);
  assert.equal(j.length, 1);
  assert.deepEqual(j[0].items, []);
});

test('assainirCoursesItems : ne garde que les objets avec id', () => {
  assert.deepEqual(assainirCoursesItems([{id:'a'}, 2, null, {nom:'sans id'}]), [{id:'a'}]);
});

test('assainirPlats : exige id + nom ; composants à clé chaîne et quantité > 0', () => {
  const p = assainirPlats([
    { id:'bowl', nom:'Bowl', composants:[['poulet',200],['riz',-1],[42,10],['banane',1]] },
    { id:'nu', composants:'oops' },        /* nom manquant → défaut ; composants invalides → [] */
    { nom:'sans id' },                      /* pas d'id → écarté */
  ]);
  assert.equal(p.length, 2);
  assert.deepEqual(p[0].composants, [['poulet',200],['banane',1]]);   /* qté ≤ 0 et clé non-chaîne écartées */
  assert.equal(p[1].nom, 'Plat');
  assert.deepEqual(p[1].composants, []);
  assert.deepEqual(assainirPlats('nope'), []);
});

test('assainirAlimentsPerso : exige un nom, normalise macros et défaut de catégorie', () => {
  const out = assainirAlimentsPerso({
    bon:    { nom:' Mon shake ', cat:'Compléments', kcal100:120, prot100:25, gluc100:3, lip100:1, fib100:0 },
    partiel:{ nom:'Sans macros' },                       /* macros absentes → 0, cat par défaut */
    negatif:{ nom:'Négatif', prot100:-5, gluc100:'x' },  /* valeurs invalides → 0 */
    sansnom:{ cat:'Fruits', kcal100:50 },                /* pas de nom → écarté */
    vide:   { nom:'   ' },                               /* nom blanc → écarté */
    pasobjet: 42,
  });
  assert.deepEqual(Object.keys(out).sort(), ['bon','negatif','partiel']);
  assert.equal(out.bon.nom, 'Mon shake');               /* trim */
  assert.deepEqual(out.partiel, { nom:'Sans macros', cat:'Compléments', kcal100:0, prot100:0, gluc100:0, lip100:0, fib100:0 });
  assert.equal(out.negatif.prot100, 0);
  assert.equal(out.negatif.gluc100, 0);
  assert.deepEqual(assainirAlimentsPerso('nope'), {});
  assert.deepEqual(assainirAlimentsPerso(null), {});
});

test('assainirSeance : effort de séance (duree/rpe) borné, invalides supprimés', () => {
  const base = { date:'2026-01-01', exercices:[{nom:'Squat', series:[{charge:60,reps:5}]}] };
  const ok = assainirSeance({ ...base, duree:55, rpe:8 });
  assert.equal(ok.duree, 55);
  assert.equal(ok.rpe, 8);
  const ko = assainirSeance({ ...base, duree:-3, rpe:42 });
  assert.ok(!('duree' in ko), 'durée ≤ 0 supprimée');
  assert.ok(!('rpe' in ko), 'rpe hors [0,10] supprimé');
  const nan = assainirSeance({ ...base, duree:'x', rpe:NaN });
  assert.ok(!('duree' in nan) && !('rpe' in nan));   /* jamais NaN */
});

test('assainirEtatsJour : date obligatoire, sommeil/courbatures ≥ 0 sinon null, courbatures ≤ 10', () => {
  const out = assainirEtatsJour([
    { date:'2026-06-20', sommeil:7.5, courbatures:4 },
    { date:'2026-06-21', sommeil:-1, courbatures:99 },   /* sommeil <0 → null ; courbatures bornées à 10 */
    { date:'2026-06-22' },                               /* champs absents → null */
    { sommeil:8 },                                       /* pas de date → écarté */
    null,
  ]);
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { date:'2026-06-20', sommeil:7.5, courbatures:4 });
  assert.deepEqual(out[1], { date:'2026-06-21', sommeil:null, courbatures:10 });
  assert.deepEqual(out[2], { date:'2026-06-22', sommeil:null, courbatures:null });
  assert.deepEqual(assainirEtatsJour('nope'), []);
});

test('assainirPreferencesAlim : clés-chaînes dédoublonnées, évité gagne sur aimé, facilité par défaut', () => {
  const p = assainirPreferencesAlim({ aimes:['poulet-blanc','poulet-blanc','oeuf',42], evites:['oeuf',null], faciliteSeulement:false });
  assert.deepEqual(p.aimes, ['poulet-blanc']);     /* dédoublonné, oeuf retiré (évité), 42 ignoré */
  assert.deepEqual(p.evites, ['oeuf']);
  assert.equal(p.faciliteSeulement, false);
  assert.deepEqual(assainirPreferencesAlim(null), { aimes:[], evites:[], faciliteSeulement:true, regimes:[] });
  assert.equal(assainirPreferencesAlim({}).faciliteSeulement, true);   /* défaut = facile */
});

test('assainirPreferencesAlim : ne garde que les régimes connus', () => {
  const p = assainirPreferencesAlim({ regimes:['vegan','sans-gluten','regime-bidon','vegan',7] });
  assert.deepEqual(p.regimes.sort(), ['sans-gluten','vegan']);   /* dédoublonné, inconnu/non-chaîne retirés */
  assert.deepEqual(assainirPreferencesAlim({}).regimes, []);
});

test('assainirEtat : ne lève jamais et purge en place', () => {
  const etat = { poids:[{date:'2026-01-01',kg:80},'bad'], seances:'oops',
                 courses:{items:[{id:1},2]}, aliments:{perso:{x:{nom:'X',kcal100:10},y:{}}} };
  assert.doesNotThrow(() => assainirEtat(etat));
  assert.equal(etat.poids.length, 1);
  assert.deepEqual(etat.seances, []);
  assert.deepEqual(etat.courses.items, [{id:1}]);
  assert.deepEqual(Object.keys(etat.aliments.perso), ['x']);   /* y (sans nom) écarté */
  assert.equal(assainirEtat(null), null);
});
