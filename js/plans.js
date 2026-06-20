/* ================= MENUS D'ALIMENTATION (E1) — helpers purs =================
   Multi-menus calqué sur le modèle Muscu (programmes[] + programmeActif) :
     etat.plansAlim     = [{ id, nom, repas:[{id, nom, items:[[cle,qté],…]}] }]
     etat.planAlimActif = id du menu courant

   Source de vérité unique : le menu actif porte les repas éditables (là où vivait
   l'ancien etat.plan). Fonctions PURES (sans DOM) pour rester testables et partagées
   par RepasModule (cible/écart, réorg) et CoursesModule (quantités dérivées). */

/* menu courant (objet) ou null si la collection est vide/incohérente */
export function menuActif(etat){
  if(!etat || !Array.isArray(etat.plansAlim) || !etat.plansAlim.length) return null;
  return etat.plansAlim.find(p => p && p.id === etat.planAlimActif) || etat.plansAlim[0];
}

/* repas du menu courant (tableau, jamais null → rendu sûr) */
export function repasActifs(etat){
  const m = menuActif(etat);
  return m && Array.isArray(m.repas) ? m.repas : [];
}
