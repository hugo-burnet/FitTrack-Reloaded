/* ================= MOTEUR REPAS (fonctions pures) =================
   Extrait de RepasModule (passe hygiénique) pour rendre la logique métier testable
   hors DOM. Le module ne garde que le rendu et les événements ; tout le calcul
   (quantités flex, macros d'un repas, agrégation du journal du jour, construction
   d'une entrée de journal, déplacement d'aliment, suggestions protéiques) vit ici.

   `aliments` est injectable (défaut = base ALIMENTS) → on passe au besoin le catalogue
   fusionné base+perso pour gérer aussi les aliments personnels. */

import { ALIMENTS } from './data.js';
import { facteurFlex, facteurMenu, kcalItem, protItem, glucItem, lipItem, fibItem } from './nutrition.js';

/* quantité d'un aliment ajustée à l'objectif. Deux modes :
   - plan fixe historique (genere=false) : seuls les aliments `flex` (glucides) bougent,
     par le facteur flex borné, arrondi au multiple de 5 g. Non-flex inchangé.
   - menu généré/ajusté (genere=true) : TOUS les aliments bougent du même facteur global
     (objectif / kcal du menu), arrondi 5 g (ou 1 unité). Le stepper rééchelonne tout le menu.
   `plan` = repas du menu actif (source du facteur), pas la surcharge du jour. */
export function qteAjustee(cle, qBase, objectifKcal, plan, aliments = ALIMENTS, genere = false){
  const a = aliments[cle];
  if(!a) return qBase;
  if(genere){
    const pas = a.unite !== undefined ? 1 : 5;
    return Math.max(pas, Math.round(qBase * facteurMenu(objectifKcal, plan, aliments) / pas) * pas);
  }
  if(!a.flex) return qBase;
  return Math.round(qBase * facteurFlex(objectifKcal, plan) / 5) * 5;
}

/* macros (5 valeurs) d'un repas, ajusté à l'objectif (flex ou échelle globale). Remplace
   les ex-méthodes repasKcal/Prot/Gluc/Lip/Fib en une passe unique. */
export function macrosRepas(repas, objectifKcal, plan, aliments = ALIMENTS, genere = false){
  return repas.items.reduce((s, [cle, q]) => {
    const qa = qteAjustee(cle, q, objectifKcal, plan, aliments, genere);
    return {
      kcal: s.kcal + kcalItem(cle, qa, aliments),
      prot: s.prot + protItem(cle, qa, aliments),
      gluc: s.gluc + glucItem(cle, qa, aliments),
      lip:  s.lip  + lipItem(cle, qa, aliments),
      fib:  s.fib  + fibItem(cle, qa, aliments),
    };
  }, { kcal:0, prot:0, gluc:0, lip:0, fib:0 });
}

/* ---- journal du jour (= réalité) ---- */

/* entrées du journal à la date donnée */
export function entreesDuJour(journal, date){
  return (journal || []).filter(e => e.date === date);
}

/* parmi des entrées, celles ajoutées hors-plan */
export function extras(entrees){
  return (entrees || []).filter(e => e.horsPlan);
}

/* agrège les macros consommées sur des entrées de journal.
   Anciennes entrées sans gluc/lip/fib (legacy V3.1−) → comptées 0, jamais NaN. */
export function consomme(entrees){
  return (entrees || []).reduce((s, e) => ({
    kcal: s.kcal + (e.kcal || 0), prot: s.prot + (e.prot || 0),
    gluc: s.gluc + (e.gluc || 0), lip: s.lip + (e.lip || 0), fib: s.fib + (e.fib || 0),
  }), { kcal:0, prot:0, gluc:0, lip:0, fib:0 });
}

/* construit l'entrée de journal d'un repas du plan coché : quantités ajustées,
   macros arrondies, items détaillés (nom/quantité/unité). */
export function entreeJournalRepas(repas, jour, objectifKcal, plan, aliments = ALIMENTS, genere = false){
  const m = macrosRepas(repas, objectifKcal, plan, aliments, genere);
  const items = repas.items.map(([cle, qBase]) => {
    const a = aliments[cle];
    const q = qteAjustee(cle, qBase, objectifKcal, plan, aliments, genere);
    return { cle, nom: a.nom, qte: q, unite: a.unite !== undefined ? (a.unite || 'unité') : 'g' };
  });
  return {
    date: jour, id: repas.id, nom: repas.nom,
    kcal: Math.round(m.kcal), prot: Math.round(m.prot),
    gluc: Math.round(m.gluc), lip: Math.round(m.lip), fib: Math.round(m.fib),
    objectifKcal, items,
  };
}

/* déplace l'aliment `cle` du repas `fromId` vers `toId`, dans le tableau `repas`
   (mutation en place). Renvoie true si déplacé, false sinon (repas absent, aliment
   absent de la source, ou déjà présent dans la cible). */
export function deplacerAliment(repas, fromId, cle, toId){
  const from = repas.find(r => r.id === fromId), to = repas.find(r => r.id === toId);
  if(!from || !to) return false;
  const i = from.items.findIndex(([c]) => c === cle);
  if(i < 0 || to.items.some(([c]) => c === cle)) return false;
  to.items.push(from.items.splice(i, 1)[0]);
  return true;
}

/* suggestions pour combler le déficit protéique restant (whey / skyr / poulet).
   `aliments` injectable mais ces 3 clés sont dans la base curée. */
export function suggestionsProteine(resteProt, aliments = ALIMENTS){
  return ['whey', 'skyr', 'poulet'].map(cle => {
    const a = aliments[cle];
    let qte, prot, kcal, unite;
    if(a.unite !== undefined){
      qte = Math.max(1, Math.round(resteProt / a.protU));
      unite = a.unite || 'unité'; prot = a.protU * qte; kcal = a.kcalU * qte;
    } else {
      qte = Math.max(20, Math.round((resteProt / a.prot100 * 100) / 10) * 10);   /* arrondi 10 g */
      unite = 'g'; prot = a.prot100 * qte / 100; kcal = a.kcal100 * qte / 100;
    }
    return { cle, nom: a.nom, qte, unite, prot: Math.round(prot), kcal: Math.round(kcal) };
  });
}

/* ---- CRUD menus (plansAlim) : transformations pures ---- */

/* supprime le menu `id` ; renvoie { plansAlim, planAlimActif } ou null si on
   tenterait de descendre sous 1 menu (le module affiche alors un avertissement). */
export function supprimerMenu(plansAlim, id){
  if(!Array.isArray(plansAlim) || plansAlim.length <= 1) return null;
  const reste = plansAlim.filter(p => p.id !== id);
  if(reste.length === plansAlim.length) return null;   /* id inconnu */
  return { plansAlim: reste, planAlimActif: reste[0].id };
}
