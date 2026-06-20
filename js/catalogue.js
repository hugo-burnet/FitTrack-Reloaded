/* ================= CATALOGUE D'ALIMENTS (pur) =================
   Réunit la base curée embarquée (ALIMENTS_BASE) et les aliments perso de
   l'utilisateur (etat.aliments.perso) en une seule table de consultation.
   Fonctions PURES (sans DOM, testables) : on passe `perso` en paramètre.

   - Un aliment perso dont la clé existe déjà dans la base la REMPLACE (l'utilisateur
     a la priorité sur ses propres données).
   - Les aliments perso portent `perso:true` (utile à l'UI : badge, édition).
   - La recherche est accent-insensible et sous-chaîne ; le filtre par catégorie est exact. */

import { ALIMENTS_BASE, ORDRE_CATEGORIES } from './data/aliments-base.js';

/* table fusionnée base + perso (perso gagne sur collision de clé) */
export function catalogue(perso){
  const out = { ...ALIMENTS_BASE };
  if(perso && typeof perso === 'object'){
    Object.keys(perso).forEach(cle=>{
      const a = perso[cle];
      if(a && typeof a === 'object') out[cle] = { ...a, perso:true };
    });
  }
  return out;
}

/* normalise pour la recherche : minuscules + sans accents/diacritiques */
export function normaliser(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* tableau [{cle, ...aliment}] trié par catégorie (ORDRE_CATEGORIES) puis par nom */
export function tousAliments(perso){
  const cat = catalogue(perso);
  const rang = c => { const i = ORDRE_CATEGORIES.indexOf(c); return i<0 ? ORDRE_CATEGORIES.length : i; };
  return Object.keys(cat)
    .map(cle => ({ cle, ...cat[cle] }))
    .sort((a,b)=> rang(a.cat)-rang(b.cat) || normaliser(a.nom).localeCompare(normaliser(b.nom)));
}

/* catégories réellement présentes, dans l'ordre canonique (perso en plus à la fin) */
export function categoriesPresentes(perso){
  const present = new Set(Object.values(catalogue(perso)).map(a=>a.cat).filter(Boolean));
  const ordonnees = ORDRE_CATEGORIES.filter(c=>present.has(c));
  const autres = [...present].filter(c=>!ORDRE_CATEGORIES.includes(c)).sort();
  return [...ordonnees, ...autres];
}

/* recherche/filtre : { terme, cat } → tableau trié [{cle, ...}].
   terme vide = pas de filtre texte ; cat absente/'' = toutes catégories. */
export function rechercher({ terme = '', cat = '' } = {}, perso){
  const t = normaliser(terme);
  return tousAliments(perso).filter(a =>
    (!cat || a.cat === cat) &&
    (!t || normaliser(a.nom).includes(t))
  );
}
