/* ================= VERSIONNEMENT DE SCHÉMA & MIGRATIONS =================
   Cadre pur (sans DOM, testable) pour faire évoluer la forme de l'état persisté
   sans casser les anciens enregistrements. `etat.schema` porte la version.

   - SCHEMA_ACTUEL : version cible de l'état en mémoire.
   - MIGRATIONS    : liste ORDONNÉE de {de, vers, appliquer(etat)}. Chaque migration
                     transforme l'état en place d'une version à la suivante.
   - migrer(etat)  : applique en chaîne les migrations applicables puis tamponne la
                     version cible. Idempotent ; ne lève jamais.

   En V2 la liste est vide : le « schéma 1 » correspond à la forme historique de
   l'app. Les évolutions v3+ (profil, macros complètes, multi-menus, charge de
   séance…) s'ajouteront ici, chacune testée isolément. */

export const SCHEMA_ACTUEL = 3;

export const MIGRATIONS = [
  /* v1 → v2 : profil utilisateur + objectif explicite (E5). Le calculateur de
     besoins (besoins.js) les consomme ; le Verdict les consommera ensuite
     (multi-objectif). Valeurs neutres par défaut, à renseigner via l'UI. */
  { de:1, vers:2, appliquer(etat){
      if(!etat.profil || typeof etat.profil !== 'object') etat.profil = { sexe:null, age:null, stature:null };
      if(!etat.objectif || typeof etat.objectif !== 'object') etat.objectif = { type:'recompo' };
  } },
  /* v2 → v3 : aliments perso (E2). L'éditeur d'aliments alimente `aliments.perso`
     (dictionnaire {cle: {nom, cat, macros}}), fusionné à la base curée par catalogue.js. */
  { de:2, vers:3, appliquer(etat){
      if(!etat.aliments || typeof etat.aliments !== 'object') etat.aliments = { perso:{} };
      if(!etat.aliments.perso || typeof etat.aliments.perso !== 'object') etat.aliments.perso = {};
  } },
];

/* Applique les migrations dont `de` correspond à la version courante, en chaîne,
   jusqu'à atteindre `cible`. Les paramètres `migrations`/`cible` sont injectables
   pour les tests. Les données legacy sans `schema` sont traitées comme version 1. */
export function migrer(etat, migrations = MIGRATIONS, cible = SCHEMA_ACTUEL){
  if(!etat || typeof etat !== 'object') return etat;
  let v = Number.isInteger(etat.schema) ? etat.schema : 1;
  let avance = true;
  while(avance && v < cible){
    avance = false;
    for(const m of migrations){
      if(m && m.de === v && typeof m.appliquer === 'function'){
        m.appliquer(etat);
        v = m.vers;
        avance = true;
        break;
      }
    }
  }
  etat.schema = cible;
  return etat;
}
