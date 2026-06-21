/* ================= MOTEUR NUTRITIONNEL (fonctions pures) =================
   Extrait de RepasModule pour être testable hors DOM. Le plan nutritionnel fixe
   les protéines/lipides ; seuls les aliments `flex` (glucides) s'ajustent par un
   facteur, borné pour rester réaliste, afin d'atteindre l'objectif kcal. */

import { ALIMENTS, PLAN } from './data.js';

export const FLEX_MIN = 0.4, FLEX_MAX = 1.8;

/* Menus GÉNÉRÉS/AJUSTÉS (generateur.js) : contrairement au plan fixe historique (où seuls
   les glucides `flex` bougent), on rééchelonne TOUT le menu d'un facteur global pour suivre
   l'objectif kcal. Bornes plus larges que le flex : le menu entier peut grossir/maigrir. */
export const MENU_MIN = 0.5, MENU_MAX = 2.0;
const clampMenu = f => Math.max(MENU_MIN, Math.min(MENU_MAX, f));

/* item-fns : `aliments` injectable (défaut = base ALIMENTS) → l'Ut peut passer le
   catalogue fusionné base+perso (catalogue.js) pour calculer aussi ses aliments perso. */
export function kcalItem(cle, q, aliments=ALIMENTS){ const a=aliments[cle]; return a.unite!==undefined ? a.kcalU*q : a.kcal100*q/100; }
export function protItem(cle, q, aliments=ALIMENTS){ const a=aliments[cle]; return a.unite!==undefined ? a.protU*q : a.prot100*q/100; }
/* macros complètes (E3) : glucides / lipides / fibres, même logique unité vs 100 g.
   Tolère un aliment sans la donnée (legacy) → 0, jamais NaN. */
export function glucItem(cle, q, aliments=ALIMENTS){ const a=aliments[cle]; return a.unite!==undefined ? (a.glucU||0)*q : (a.gluc100||0)*q/100; }
export function lipItem(cle, q, aliments=ALIMENTS){  const a=aliments[cle]; return a.unite!==undefined ? (a.lipU ||0)*q : (a.lip100 ||0)*q/100; }
export function fibItem(cle, q, aliments=ALIMENTS){  const a=aliments[cle]; return a.unite!==undefined ? (a.fibU ||0)*q : (a.fib100 ||0)*q/100; }

/* Toutes les fonctions ci-dessous prennent le plan en paramètre (défaut = PLAN, le plan
   de référence) : à l'exécution on leur passe le plan éditable de l'utilisateur (etat.plan).
   Déplacer un aliment d'un repas à l'autre ne change PAS ces totaux — ils agrègent tout le
   plan, quel que soit le regroupement par repas. */

/* kcal de base : part fixe (non-flex) et part ajustable (flex) du plan */
export function basesKcal(plan = PLAN){
  let fixe=0, flex=0;
  plan.forEach(r=>r.items.forEach(([cle,q])=>{
    (ALIMENTS[cle].flex ? (flex+=kcalItem(cle,q)) : (fixe+=kcalItem(cle,q)));
  }));
  return {fixe, flex};
}

/* facteur appliqué aux aliments flex pour viser l'objectif, borné [0.4, 1.8] */
export function facteurFlex(objectifKcal, plan = PLAN){
  const {fixe, flex} = basesKcal(plan);
  if(flex<=0) return 1;
  const f = (objectifKcal - fixe) / flex;
  return Math.max(FLEX_MIN, Math.min(FLEX_MAX, f));
}

/* ---- échelle globale d'un menu généré (toutes portions au prorata de l'objectif) ----
   `aliments` injectable (catalogue base+perso) → un menu généré peut contenir des aliments perso. */

/* kcal de base du menu = somme des portions stockées (= telles que générées/ajustées) */
export function kcalBaseMenu(plan, aliments = ALIMENTS){
  let k = 0;
  (plan || []).forEach(r => r.items.forEach(([cle, q]) => { if(aliments[cle]) k += kcalItem(cle, q, aliments); }));
  return k;
}

/* facteur global appliqué à TOUS les aliments du menu, borné [0.5, 2.0] */
export function facteurMenu(objectifKcal, plan, aliments = ALIMENTS){
  const base = kcalBaseMenu(plan, aliments);
  if(base <= 0) return 1;
  return clampMenu(objectifKcal / base);
}

/* le facteur global sature-t-il une borne ? 'bas' | 'haut' | null (cf. flexSature, mais menu entier) */
export function menuSature(objectifKcal, plan, aliments = ALIMENTS){
  const base = kcalBaseMenu(plan, aliments);
  if(base <= 0) return null;
  const f = objectifKcal / base;
  if(f < MENU_MIN) return 'bas';
  if(f > MENU_MAX) return 'haut';
  return null;
}

/* protéines cibles du jour = ce que délivre le plan (flex ajusté à l'objectif) */
export function protCible(objectifKcal, plan = PLAN){
  const f = facteurFlex(objectifKcal, plan);
  let p = 0;
  plan.forEach(r=>r.items.forEach(([cle,q])=>{
    const qte = ALIMENTS[cle].flex ? Math.round(q*f/5)*5 : q;
    p += protItem(cle, qte);
  }));
  return Math.round(p);
}

/* macros d'un plat composé (E4) : somme des macros de ses composants [[cle,qté],…].
   `aliments` injectable (base ou catalogue fusionné base+perso). Un composant dont
   l'aliment est inconnu (perso supprimé, autre appareil) ou de quantité ≤ 0 est ignoré. */
export function macrosPlat(composants, aliments = ALIMENTS){
  const t = { kcal:0, prot:0, gluc:0, lip:0, fib:0 };
  (composants || []).forEach(([cle, q]) => {
    if(!aliments[cle] || !(q > 0)) return;
    t.kcal += kcalItem(cle, q, aliments); t.prot += protItem(cle, q, aliments);
    t.gluc += glucItem(cle, q, aliments); t.lip += lipItem(cle, q, aliments); t.fib += fibItem(cle, q, aliments);
  });
  return t;
}

/* macros cibles du jour = ce que délivre le plan (flex ajusté à l'objectif).
   Renvoie {prot, gluc, lip, fib} en grammes arrondis. Même règle d'arrondi de
   quantité (flex → multiple de 5 g) que protCible/qteAjustee, pour cohérence d'affichage. */
export function macrosCible(objectifKcal, plan = PLAN, aliments = ALIMENTS, genere = false){
  let prot=0, gluc=0, lip=0, fib=0;
  if(genere){
    /* menu généré : facteur global sur TOUS les aliments (arrondi 5 g / 1 unité) */
    const f = facteurMenu(objectifKcal, plan, aliments);
    plan.forEach(r=>r.items.forEach(([cle,q])=>{
      const a = aliments[cle]; if(!a) return;
      const pas = a.unite!==undefined ? 1 : 5;
      const qte = Math.max(pas, Math.round(q*f/pas)*pas);
      prot += protItem(cle, qte, aliments);
      gluc += glucItem(cle, qte, aliments);
      lip  += lipItem(cle, qte, aliments);
      fib  += fibItem(cle, qte, aliments);
    }));
    return { prot:Math.round(prot), gluc:Math.round(gluc), lip:Math.round(lip), fib:Math.round(fib) };
  }
  const f = facteurFlex(objectifKcal, plan);
  plan.forEach(r=>r.items.forEach(([cle,q])=>{
    const qte = ALIMENTS[cle].flex ? Math.round(q*f/5)*5 : q;
    prot += protItem(cle, qte);
    gluc += glucItem(cle, qte);
    lip  += lipItem(cle, qte);
    fib  += fibItem(cle, qte);
  }));
  return { prot:Math.round(prot), gluc:Math.round(gluc), lip:Math.round(lip), fib:Math.round(fib) };
}

/* consommation quotidienne par aliment, dérivée du plan. Sert à calculer une liste de courses
   « plan × jours » (specs 4.3) : ferme la boucle plan → conso → liste, et se met à jour avec
   l'objectif kcal. Renvoie {cle: qté/jour}. Deux modes (mêmes arrondis que qteAjustee) :
   - plan fixe (genere=false) : seul le flex (riz/avoine) suit l'objectif ;
   - menu généré (genere=true) : TOUS les aliments suivent le facteur global. Catalogue
     injectable (un menu généré peut contenir des aliments perso). */
export function consoQuotidienne(objectifKcal, plan = PLAN, aliments = ALIMENTS, genere = false){
  const out = {};
  if(genere){
    const f = facteurMenu(objectifKcal, plan, aliments);
    plan.forEach(r=>r.items.forEach(([cle,q])=>{
      const a = aliments[cle]; if(!a) return;
      const pas = a.unite!==undefined ? 1 : 5;
      out[cle] = (out[cle]||0) + Math.max(pas, Math.round(q*f/pas)*pas);
    }));
    return out;
  }
  const f = facteurFlex(objectifKcal, plan);
  plan.forEach(r=>r.items.forEach(([cle,q])=>{
    const qte = ALIMENTS[cle].flex ? Math.round(q*f/5)*5 : q;   /* même arrondi que qteAjustee */
    out[cle] = (out[cle]||0) + qte;
  }));
  return out;
}

/* le facteur sature-t-il à une borne ? renvoie 'bas' | 'haut' | null
   (sert à avertir que le total réel diverge de la cible — cf. specs 4.1) */
export function flexSature(objectifKcal, plan = PLAN){
  const {fixe, flex} = basesKcal(plan);
  if(flex<=0) return null;
  const f = (objectifKcal - fixe) / flex;
  if(f < FLEX_MIN) return 'bas';
  if(f > FLEX_MAX) return 'haut';
  return null;
}
