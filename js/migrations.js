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

export const SCHEMA_ACTUEL = 1;

export const MIGRATIONS = [
  /* exemple de forme à venir :
     { de:1, vers:2, appliquer(etat){ etat.profil = etat.profil || {}; } }, */
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
