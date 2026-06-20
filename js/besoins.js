/* ================= MOTEUR DE BESOINS CALORIQUES & MACROS (E5) =================
   Fonctions pures (sans DOM, testables). Chaîne de calcul :
     1. BMR  — métabolisme de base, formule de Mifflin-St Jeor (la plus fiable en
               population générale).
     2. TDEE — BMR × facteur d'activité, le facteur étant déduit de la fréquence
               réelle des séances (repli possible sur une fréquence fournie).
     3. Ajustement selon l'objectif : sèche (déficit), recompo (maintien),
        masse (surplus léger).
     4. Répartition macros : protéines en g/kg de poids (selon l'objectif),
        lipides en % des kcal, glucides = le reste. Fibres indicatives.

   La cible obtenue est un POINT DE DÉPART personnalisé (remplace le 2545 kcal codé
   en dur) ; elle reste surchargeable à la main, et le Verdict l'ajustera sur le réel. */

/* ---- objectifs supportés ---- */
export const OBJECTIFS = ['seche', 'recompo', 'masse'];

/* ajustement calorique appliqué au TDEE selon l'objectif */
export const AJUST_OBJECTIF = { seche: -0.20, recompo: 0, masse: 0.10 };

/* protéines visées (g par kg de poids) selon l'objectif — plus haut en déficit
   pour préserver le muscle, plus modéré en surplus */
export const PROT_PAR_KG = { seche: 2.2, recompo: 2.0, masse: 1.8 };

/* part des kcal allouée aux lipides (le reste, hors protéines, va aux glucides) */
export const PART_LIPIDES = 0.25;

/* fibres indicatives : ~14 g pour 1000 kcal (repère santé classique) */
export const FIBRES_PAR_1000KCAL = 14;

/* ---- 1. BMR (Mifflin-St Jeor) ----
   homme : 10·kg + 6,25·cm − 5·âge + 5
   femme : 10·kg + 6,25·cm − 5·âge − 161 */
export function bmr({ sexe, poids, stature, age }){
  if(![poids, stature, age].every(Number.isFinite)) return null;
  const base = 10 * poids + 6.25 * stature - 5 * age;
  if(sexe === 'homme') return base + 5;
  if(sexe === 'femme') return base - 161;
  return null;   /* sexe requis (les deux formules diffèrent de 166 kcal) */
}

/* ---- 2. facteur d'activité depuis la fréquence hebdo de séances ----
   barème standard sédentaire→athlète, borné. */
export function facteurActivite(seancesParSemaine){
  const n = Number(seancesParSemaine) || 0;
  if(n <= 0) return 1.2;     /* sédentaire */
  if(n <= 2) return 1.375;   /* léger */
  if(n <= 4) return 1.55;    /* modéré */
  if(n <= 6) return 1.725;   /* élevé */
  return 1.9;                /* très élevé */
}

/* fréquence hebdo moyenne déduite de l'historique des séances sur `semaines` semaines
   glissantes (depuis `refISO`, format AAAA-MM-JJ). Pure : on lui passe les données. */
export function frequenceHebdo(seances, refISO, semaines = 4){
  if(!Array.isArray(seances) || !refISO || semaines <= 0) return 0;
  const ref = new Date(refISO + 'T12:00:00').getTime();
  const debut = ref - semaines * 7 * 864e5;
  const n = seances.filter(s => {
    if(!s || !s.date) return false;
    const t = new Date(s.date + 'T12:00:00').getTime();
    return Number.isFinite(t) && t > debut && t <= ref;
  }).length;
  return n / semaines;
}

/* ---- 3+4. besoins complets ----
   entrée : { sexe, age, stature, poids, objectif, seancesParSemaine }
   sortie : { valide, manque[], bmr, facteur, tdee, kcal, macros{proteines,lipides,glucides,fibres} } */
export function calculerBesoins({ sexe, age, stature, poids, objectif = 'recompo', seancesParSemaine = 0 } = {}){
  const manque = [];
  if(sexe !== 'homme' && sexe !== 'femme') manque.push('sexe');
  if(!Number.isFinite(age)) manque.push('age');
  if(!Number.isFinite(stature)) manque.push('stature');
  if(!Number.isFinite(poids)) manque.push('poids');
  const obj = OBJECTIFS.includes(objectif) ? objectif : 'recompo';
  if(manque.length) return { valide:false, manque, objectif:obj };

  const valBmr = bmr({ sexe, poids, stature, age });
  const facteur = facteurActivite(seancesParSemaine);
  const tdee = valBmr * facteur;
  const kcal = Math.round(tdee * (1 + AJUST_OBJECTIF[obj]));

  /* macros : protéines (g/kg) d'abord, lipides en % des kcal, glucides = reste (borné ≥ 0) */
  const proteines = Math.round(PROT_PAR_KG[obj] * poids);
  const lipides = Math.round((kcal * PART_LIPIDES) / 9);
  const kcalRestantes = Math.max(0, kcal - proteines * 4 - lipides * 9);
  const glucides = Math.round(kcalRestantes / 4);
  const fibres = Math.round((kcal / 1000) * FIBRES_PAR_1000KCAL);

  return {
    valide: true, manque: [], objectif: obj,
    bmr: Math.round(valBmr), facteur, tdee: Math.round(tdee), kcal,
    macros: { proteines, lipides, glucides, fibres },
  };
}
