/* ================= ASSAINISSEMENT DE L'ÉTAT =================
   Fonctions PURES qui valident la forme des données persistées.
   Utilisées à deux endroits, pour ne jamais faire confiance à une source externe :
     - Store.charger()                 → ce qui est déjà en stockage peut être corrompu
     - DonneesModule.importerJSON()    → un fichier importé peut être malformé
   Règle d'or : ne JAMAIS lever d'exception. On laisse tomber les entrées
   invalides et on renvoie des données propres, pour que le rendu ne crashe jamais. */

import { ALIMENTS } from './data.js';

export function estNombre(x){ return typeof x === 'number' && isFinite(x); }
export function estChaine(x){ return typeof x === 'string'; }

/* ---- plan de repas éditable : [{id, nom, items:[[cle,qté],…]}] ----
   On ne garde que les aliments connus (cle ∈ ALIMENTS) et les quantités numériques.
   Renvoie null si rien d'exploitable → Store/Import retombe sur le plan par défaut. */
export function assainirRepasPlan(arr){
  if(!Array.isArray(arr)) return null;
  const repas = arr
    .filter(r => r && typeof r === 'object' && estChaine(r.id) && Array.isArray(r.items))
    .map(r => ({
      ...r,
      items: r.items
        .filter(it => Array.isArray(it) && it.length >= 2 && estChaine(it[0]) && ALIMENTS[it[0]] && estNombre(it[1]))
        .map(([cle, q]) => [cle, q]),
    }));
  return repas.length ? repas : null;
}

/* ---- menus d'alimentation (E1) : [{id, nom, repas:[…]}] ----
   On exige id + nom-chaîne ; les repas sont assainis comme un plan (aliments connus).
   Un menu aux repas tous invalides survit avec repas:[] (comme un programme sans jour).
   Renvoie null si rien d'exploitable → Store/Import retombe sur les menus par défaut. */
export function assainirPlansAlim(arr){
  if(!Array.isArray(arr)) return null;
  const menus = arr
    .filter(m => m && typeof m === 'object' && estChaine(m.id))
    .map(m => ({ ...m, nom: estChaine(m.nom) ? m.nom : 'Menu', repas: assainirRepasPlan(m.repas) || [] }));
  return menus.length ? menus : null;
}

/* ---- entrées datées (pesées, mensurations) : la clé de fusion est `date` ---- */
export function assainirDates(arr){
  if(!Array.isArray(arr)) return [];
  return arr.filter(x => x && typeof x === 'object' && estChaine(x.date));
}

/* ---- série de muscu : charge {charge:number|null, reps} OU gainage {duree:number|null, reps} ---- */
export function serieValide(s){
  if(!s || typeof s !== 'object' || !estNombre(s.reps)) return false;
  if('duree' in s) return s.duree === null || estNombre(s.duree);   /* gainage : temps de maintien */
  return s.charge === null || estNombre(s.charge);                  /* charge classique */
}

/* ---- une séance : date + exercices[] dont chaque exercice a des séries valides ---- */
export function assainirSeance(s){
  if(!s || typeof s !== 'object' || !estChaine(s.date)) return null;
  if(!Array.isArray(s.exercices)) return null;
  const exercices = s.exercices
    .filter(e => e && typeof e === 'object' && estChaine(e.nom) && Array.isArray(e.series))
    .map(e => ({
      ...e,
      series: e.series.filter(serieValide).map(x => 'duree' in x ? { duree: x.duree, reps: x.reps } : { charge: x.charge, reps: x.reps }),
    }))
    .filter(e => e.series.length);          /* un exercice sans série valide est vide → écarté */
  if(!exercices.length) return null;        /* une séance sans exercice valide est inutile */
  return { ...s, exercices };
}
export function assainirSeances(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(assainirSeance).filter(Boolean);
}

/* ---- programmes : id + jours[] dont chaque jour.exercices est un tableau ---- */
export function assainirProgramme(p){
  if(!p || typeof p !== 'object' || !estChaine(p.id) || !Array.isArray(p.jours)) return null;
  const jours = p.jours.filter(j => j && typeof j === 'object' && Array.isArray(j.exercices));
  if(!jours.length) return null;
  return { ...p, jours };
}
export function assainirProgrammes(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(assainirProgramme).filter(Boolean);
}

/* ---- journal des repas : {date, id, items[]} ---- */
export function assainirJournalRepas(arr){
  if(!Array.isArray(arr)) return [];
  return arr
    .filter(e => e && typeof e === 'object' && estChaine(e.date) && e.id != null)
    .map(e => ({ ...e, items: Array.isArray(e.items) ? e.items.filter(it => it && typeof it === 'object') : [] }));
}

/* ---- articles de courses : {id, ...} ---- */
export function assainirCoursesItems(arr){
  if(!Array.isArray(arr)) return [];
  return arr.filter(it => it && typeof it === 'object' && it.id != null);
}

/* ---- plats composés (E4) : [{id, nom, composants:[[cle,qté],…]}] ----
   On exige id + nom-chaîne ; les composants gardent une `cle` chaîne et une quantité
   numérique > 0 (on ne valide PAS contre la base : un composant peut viser un aliment
   perso, résolu au calcul ; un inconnu rendra 0 macro, jamais NaN). Renvoie un tableau. */
export function assainirPlats(arr){
  if(!Array.isArray(arr)) return [];
  return arr
    .filter(p => p && typeof p === 'object' && estChaine(p.id))
    .map(p => ({
      ...p,
      nom: estChaine(p.nom) ? p.nom : 'Plat',
      composants: Array.isArray(p.composants)
        ? p.composants.filter(c => Array.isArray(c) && c.length >= 2 && estChaine(c[0]) && estNombre(c[1]) && c[1] > 0).map(([cle, q]) => [cle, q])
        : [],
    }));
}

/* ---- aliments perso (E2) : {cle: {nom, cat, kcal100, prot100, gluc100, lip100, fib100}} ----
   On ne garde que les entrées dont le nom est une chaîne non vide ; les macros absentes
   ou invalides sont ramenées à 0 (jamais NaN). Renvoie toujours un objet. */
export function assainirAlimentsPerso(obj){
  if(!obj || typeof obj !== 'object') return {};
  const num = v => estNombre(v) && v >= 0 ? v : 0;
  const out = {};
  for(const cle of Object.keys(obj)){
    const a = obj[cle];
    if(!a || typeof a !== 'object' || !estChaine(a.nom) || !a.nom.trim()) continue;
    out[cle] = {
      nom: a.nom.trim(),
      cat: estChaine(a.cat) && a.cat ? a.cat : 'Compléments',
      kcal100: num(a.kcal100), prot100: num(a.prot100),
      gluc100: num(a.gluc100), lip100: num(a.lip100), fib100: num(a.fib100),
    };
  }
  return out;
}

/* ---- état complet : assainit chaque section connue, en place et sans jamais lever ----
   Les valeurs par défaut / migrations restent gérées par Store.charger ; ici on ne fait
   que purger les formes invalides des collections. */
export function assainirEtat(etat){
  if(!etat || typeof etat !== 'object') return etat;
  if('poids' in etat)         etat.poids        = assainirDates(etat.poids);
  if('mensurations' in etat)  etat.mensurations = assainirDates(etat.mensurations);
  if('seances' in etat)       etat.seances      = assainirSeances(etat.seances);
  if('journalRepas' in etat)  etat.journalRepas = assainirJournalRepas(etat.journalRepas);
  if('plan' in etat)          etat.plan         = assainirRepasPlan(etat.plan);   /* legacy (≤ schéma 3) : géré par migration/fusion */
  if('plansAlim' in etat)     etat.plansAlim    = assainirPlansAlim(etat.plansAlim); /* null → Store re-défaut */
  if(etat.repas && typeof etat.repas === 'object' && 'planJour' in etat.repas)
    etat.repas.planJour = assainirRepasPlan(etat.repas.planJour);                  /* null → pas de surcharge */
  if(Array.isArray(etat.programmes)) etat.programmes = assainirProgrammes(etat.programmes);
  if(etat.courses && typeof etat.courses === 'object' && 'items' in etat.courses)
    etat.courses.items = assainirCoursesItems(etat.courses.items);
  if(etat.aliments && typeof etat.aliments === 'object' && 'perso' in etat.aliments)
    etat.aliments.perso = assainirAlimentsPerso(etat.aliments.perso);
  if('plats' in etat) etat.plats = assainirPlats(etat.plats);
  return etat;
}
