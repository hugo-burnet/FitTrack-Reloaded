/* ================= FABRIQUE D'ÉTAT PAR DÉFAUT =================
   Source UNIQUE de la forme d'un état neuf. Consommée par :
     - Store.charger()        → comble les champs manquants/invalides d'un état chargé
     - Store.reinitialiser()  → état vierge à la remise à zéro
   Avoir une seule fabrique évite la divergence qui causait le bug T1 (la remise à
   zéro reconstruisait un état incomplet, sans `plan` → crash de l'onglet Repas).
   Pur (sans DOM), testable. Chaque appel renvoie des structures INDÉPENDANTES
   (clones) pour qu'aucune référence ne soit partagée entre deux états. */

import { OBJ_DEFAUT, PLAN, PROG_DEFAUT, COURSES_DEFAUT } from './data.js';
import { jourLocal, cloneProfond, slug } from './utils.js';
import { SCHEMA_ACTUEL } from './migrations.js';

/* liste de courses par défaut (articles dérivables du plan + horizon 7 jours) */
export function coursesParDefaut(){
  return { items: COURSES_DEFAUT.map(c => ({ id: slug(c.nom), ...c })), coches: {}, maj: null, jours: 7 };
}

/* état complet neuf, à la version de schéma courante */
export function etatParDefaut(){
  return {
    schema: SCHEMA_ACTUEL,
    poids: [],
    mensurations: [],
    /* profil corporel (E5) — `stature` = taille en cm (à NE PAS confondre avec le
       tour de taille des mensurations). Renseigné via le calculateur de besoins. */
    profil: { sexe: null, age: null, stature: null },
    /* objectif explicite : pilote le calculateur de besoins et (à venir) le Verdict */
    objectif: { type: 'recompo' },
    objectifKcal: OBJ_DEFAUT,
    repas: { jour: jourLocal(), coches: {}, planJour: null },
    plan: cloneProfond(PLAN),
    journalRepas: [],
    programmes: cloneProfond(PROG_DEFAUT),
    programmeActif: PROG_DEFAUT[0].id,
    seances: [],
    courses: coursesParDefaut(),
    brouillons: {},
    autoExport: false,
  };
}
