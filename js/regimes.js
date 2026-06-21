/* ================= RÉGIMES & ALLERGIES (fonctions pures, V-Nutri) =================
   Filtre le générateur de menus selon des contraintes alimentaires. Plutôt que de taguer
   les ~170 aliments, on DÉDUIT les contraintes violées par chaque aliment depuis sa
   catégorie (Viandes / Poissons / Œufs & laitages / Oléagineux…) + quelques ensembles curés
   pour les cas que la catégorie ne tranche pas (œuf vs laitage, poudres laitières, soja,
   gluten, fruits à coque vs graines). Pur et sans DOM ; `aliments` injectable. */

import { ALIMENTS } from './data.js';

/* régimes proposés (ordre d'affichage) */
export const REGIMES = [
  { cle: 'vegetarien',        nom: 'Végétarien' },
  { cle: 'vegan',             nom: 'Végan' },
  { cle: 'sans-gluten',       nom: 'Sans gluten' },
  { cle: 'sans-lactose',      nom: 'Sans lactose' },
  { cle: 'sans-fruits-coque', nom: 'Sans fruits à coque' },
  { cle: 'sans-poisson',      nom: 'Sans poisson' },
  { cle: 'sans-oeuf',         nom: 'Sans œuf' },
  { cle: 'sans-soja',         nom: 'Sans soja' },
];
export const REGIMES_CLES = REGIMES.map(r => r.cle);

/* ensembles curés (par clé d'aliment) là où la catégorie ne suffit pas */
const OEUFS = new Set(['oeuf', 'blanc-oeuf']);
const LAITAGES_HORS_CAT = new Set(['whey', 'whey-iso', 'caseine']);   /* poudres laitières (cat. Compléments) */
const GRAINES = new Set(['graine-courge', 'graine-tournesol', 'graine-chia', 'graine-lin']);   /* pas des fruits à coque */
const SOJA = new Set(['tofu', 'tofu-ferme', 'tempeh', 'edamame', 'proteine-veg']);
const MIEL = new Set(['miel']);
const GLUTEN = new Set([
  'avoine', 'pain-complet', 'pain-blanc', 'pain-mie', 'pates-cru', 'pates-cuit', 'pates-bolo',
  'semoule', 'boulgour-cru', 'muesli', 'cornflakes', 'pizza', 'burger', 'lasagnes', 'quiche',
  'sandwich-jb', 'nuggets', 'biscuit', 'cookie', 'madeleine', 'barre-prot',
]);

/* ensemble des régimes qu'un aliment VIOLE (donc qui doivent l'exclure) */
export function violationsAliment(cle, aliments = ALIMENTS){
  const out = new Set();
  const a = aliments[cle];
  if(!a) return out;
  const cat = a.cat;
  const oeuf = OEUFS.has(cle);
  const viande = cat === 'Viandes';
  const poisson = cat === 'Poissons';
  const laitage = (cat === 'Œufs & laitages' && !oeuf) || LAITAGES_HORS_CAT.has(cle);
  const noix = cat === 'Oléagineux' && !GRAINES.has(cle);
  const soja = SOJA.has(cle);
  const gluten = GLUTEN.has(cle);
  const miel = MIEL.has(cle);

  if(viande || poisson) out.add('vegetarien');
  if(viande || poisson || laitage || oeuf || miel) out.add('vegan');
  if(gluten) out.add('sans-gluten');
  if(laitage) out.add('sans-lactose');
  if(noix) out.add('sans-fruits-coque');
  if(poisson) out.add('sans-poisson');
  if(oeuf) out.add('sans-oeuf');
  if(soja) out.add('sans-soja');
  return out;
}

/* l'aliment respecte-t-il TOUS les régimes sélectionnés ? */
export function satisfaitRegimes(cle, regimes, aliments = ALIMENTS){
  if(!regimes || !regimes.length) return true;
  const v = violationsAliment(cle, aliments);
  return !regimes.some(r => v.has(r));
}
